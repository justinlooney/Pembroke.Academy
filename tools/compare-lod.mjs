#!/usr/bin/env node
/**
 * Pembroke Academy — does the cheaper version still read?
 *
 *     node tools/compare-lod.mjs a.glb b.glb --height 96 --from 72
 *
 * A texture budget is decided by how close somebody gets, and "close"
 * is not a matter of opinion here: the campus has a waypoint graph, and
 * the nearest node to a building is the nearest a visitor can stand.
 * For the residence hall that distance is ZERO — a walkable node sits
 * against its footprint — so the facade is read close, not glanced at
 * across a lawn, and 2048 versus 1024 is a real question rather than a
 * rhetorical one.
 *
 * Both models are scaled to the same height the campus gives them,
 * lit the same, and photographed from the same camera at eye level.
 * The verdict is yours; this only makes sure you are comparing the
 * same thing twice.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, basename } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2);
/* The VALUE of a flag is not a file. Filtering only on the leading
   dashes left "96" and "72" in the list, and the run ended with two
   renders and two lines of "could not load 96". */
const flagVals = new Set();
args.forEach((a, i) => { if (a.startsWith("--")) flagVals.add(i + 1); });
const files = args.filter((a, i) => !a.startsWith("--") && !flagVals.has(i));
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : Number(args[i + 1]); };
const HEIGHT = opt("height", 96);      /* what the campus scales it to */
const FROM = opt("from", 72);          /* how far the viewer stands off */
const EYE = opt("eye", 34);            /* walk-mode eye height */
if (files.length < 2){ console.error("give two .glb files"); process.exit(1); }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary" };
const srv = createServer(async (req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]).slice(1);
  const p = u.startsWith("m/") ? files[+u.slice(2)] : resolve(ROOT, u || "index.html");
  if (!existsSync(p) || !statSync(p).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
/* Port 0, so the operating system hands out one nobody else holds.
   This file and check-dialogue.mjs used to name the same number, and two
   probes on one port means the second dies on EADDRINUSE before it
   checks anything — reading like a broken checkout rather than a
   clash. Left as a two-line change rather than a move onto
   tools/_harness.mjs, because this probe is not in CI and I cannot
   verify a larger edit to it. */
let PORT = 0;
await new Promise((ok) => srv.listen(0, ok));
PORT = srv.address().port;
await mkdir(resolve(ROOT, ".shots"), { recursive: true });

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#10141a}</style>
<script type="importmap">{"imports":{
  "three":"/assets/vendor/three/build/three.module.js",
  "three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
window.__shot = (url, H, FROM, EYE) => new Promise((done) => {
  loader.load(url, (g) => {
    const root = g.scene;
    root.updateMatrixWorld(true);
    let bb = new THREE.Box3().setFromObject(root);
    const size = bb.getSize(new THREE.Vector3());
    /* the campus scales a landmark by its HEIGHT, so do the same */
    const s = H / size.y;
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);
    bb = new THREE.Box3().setFromObject(root);
    const c = bb.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -bb.min.y, -c.z);
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setSize(900, 640); r.setPixelRatio(1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x9fb4cc);
    const sun = new THREE.DirectionalLight(0xfff2e0, 2.1); sun.position.set(-120, 180, 140);
    sc.add(sun, new THREE.HemisphereLight(0xbfd6ff, 0x6b6350, 1.0));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0x5f7048 }));
    floor.rotation.x = -Math.PI / 2; sc.add(floor);
    sc.add(root);
    bb = new THREE.Box3().setFromObject(root);
    const half = (bb.max.z - bb.min.z) / 2;
    const cam = new THREE.PerspectiveCamera(60, 900 / 640, 1, 6000);
    /* stood off the FACE of the building, at eye height, looking at it */
    cam.position.set(0, EYE, half + FROM);
    cam.lookAt(0, H * 0.42, 0);
    r.render(sc, cam);
    done(r.domElement.toDataURL("image/png"));
  }, undefined, (e) => done(null));
});
window.__ready = 1;
</script>`;

const browser = await chromium.launch({ args: ["--use-gl=swiftshader",
  "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 940, height: 700 } });
await page.route("**/lod.html", (r) => r.fulfill({ contentType: "text/html", body: PAGE }));
await page.goto(`http://localhost:${PORT}/lod.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });

const { writeFile } = await import("node:fs/promises");
for (let i = 0; i < files.length; i++){
  const png = await page.evaluate(([u, H, F, E]) => window.__shot(u, H, F, E),
    [`/m/${i}`, HEIGHT, FROM, EYE]);
  if (!png){ console.log(`  could not load ${files[i]}`); continue; }
  const out = resolve(ROOT, ".shots", "lod-" + basename(files[i], ".glb") + ".png");
  await writeFile(out, Buffer.from(png.split(",")[1], "base64"));
  console.log(`  ${out.replace(ROOT + "/", "")}   ${basename(files[i])}`);
}
console.log(`\nboth at ${HEIGHT} units tall, viewer ${FROM} units off the face at eye height ${EYE}`);
await browser.close();
srv.close();
