#!/usr/bin/env node
/**
 * Pembroke Academy — look at one character properly.
 *
 *     node tools/character-sheet.mjs walker [ariel ...]
 *     node tools/character-sheet.mjs --all
 *
 * Every character fault in this project was found by looking at a
 * picture, and every one of them was missed first by a measurement.
 * A body with NaN inverse bind matrices reported clean geometry, clean
 * bone matrices and a perfectly ordinary skeleton, and drew a figure
 * the size of the county. A body whose mesh tears into wings reported
 * every bone exactly where it belonged, three times, to three different
 * probes. A body with no colour at all passed every check that counted
 * triangles.
 *
 * So this does not score anything. It draws the figure — at rest, and
 * stepped through each clip it carries — at a size where a person can
 * see what is wrong, and prints the few facts that explain what they
 * are looking at underneath. The verdict is yours.
 *
 * One PNG per character, written to .shots/.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUT = resolve(ROOT, ".shots");
const PORT = 8301;
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".glb": "model/gltf-binary", ".png": "image/png",
               ".json": "application/json" };

const args = process.argv.slice(2);
const all = args.includes("--all");
const pick = args.filter(a => !a.startsWith("--"));
const bodies = readdirSync(resolve(ROOT, "assets"))
  .filter(f => /^stu_.*\.glb$/.test(f))
  .filter(f => all || !pick.length ||
               pick.includes(f.replace(/^stu_|\.glb$/g, "")))
  .sort();
if (!bodies.length){
  console.log("no matching bodies. available:");
  readdirSync(resolve(ROOT, "assets")).filter(f => /^stu_.*\.glb$/.test(f))
    .forEach(f => console.log("  " + f.replace(/^stu_|\.glb$/g, "")));
  process.exit(1);
}

/* Six columns: the rest pose, then five moments spread across the
   clips. Lit the way the conversation view lights a face — key, fill
   and rim — because that is the harshest look the campus ever gives a
   body, and anything that survives it survives a lawn. */
const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#10141a;color:#dfe6f0;
  font:13px/1.5 ui-monospace,Menlo,monospace}
  #sheet{display:flex;flex-wrap:wrap}
  .cell{position:relative}
  .cap{position:absolute;left:6px;bottom:4px;font-size:11px;color:#9fb0c8;
    text-shadow:0 1px 2px #000}
  #facts{padding:10px 14px;white-space:pre-wrap;border-top:1px solid #2a3442}
</style>
<div id="sheet"></div><div id="facts"></div>
<script type="importmap">{"imports":{
  "three":"/assets/vendor/three/build/three.module.js",
  "three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const W = 300, H = 470;
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const canon = (s) => (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

window.__sheet = (url) => new Promise((done) => {
  loader.load(url, (gl) => {
    const sheet = document.getElementById("sheet");
    sheet.innerHTML = ""; document.getElementById("facts").textContent = "";
    const root = gl.scene;
    root.updateMatrixWorld(true);

    /* Facts worth having beside the picture, none of them a verdict. */
    let tris = 0, meshes = 0, images = 0, spike = 0;
    const mats = new Set(), slots = {}, finish = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      if (o.material){
        mats.add(o.material.name || "(unnamed)");
        for (const k of ["map","normalMap","roughnessMap","emissiveMap"])
          if (o.material[k]) images++;
        /* Shininess is a material fact, not a lighting one, and it is
           the first thing anyone says about a body that looks wet.
           Roughness near 0 is a mirror; cloth and skin live at 0.7-1.0.
           Metalness above 0 on a person is almost always an export
           artifact — nobody is made of metal. */
        const m = o.material;
        finish.push({
          mat: m.name || "(unnamed)",
          rough: m.roughness == null ? "-" : +m.roughness.toFixed(2),
          metal: m.metalness == null ? "-" : +m.metalness.toFixed(2),
          roughMap: !!m.roughnessMap, metalMap: !!m.metalnessMap,
          /* KHR_materials_specular / _ior arrive as MeshPhysicalMaterial
             properties, and they put a highlight on a surface whose
             roughness is already 1 — which is how cloth ends up looking
             wet with nothing obviously wrong in the usual two numbers. */
          spec: m.specularIntensity == null ? null : +m.specularIntensity.toFixed(2),
          specMap: !!m.specularIntensityMap,
          ior: m.ior == null ? null : +m.ior.toFixed(2),
        });
      }
      const tag = canon(o.name) + " " + canon(o.material?.name);
      const what = /hair|beard|scalp|brow|eyelash/i.test(tag) ? "hair"
                 : /shirt|top|jacket|suit|hoodie|sweater/i.test(tag) ? "shirt"
                 : /short|pant|trouser|jean|bottom|denim/i.test(tag) ? "shorts"
                 : /shoe|sneaker|boot|footwear|canvas/i.test(tag) ? "sneakers"
                 : /body|skin|head/i.test(tag) ? "skin" : null;
      if (what) slots[what] = (slots[what] || 0) + 1;
    });

    /* The campus corrects two material faults at load — metalness on a
       person, and a roughness low enough to look wet — so the sheet
       applies the same rule before drawing. Otherwise the pictures show
       a body nobody will ever see. The RAW values are still printed
       underneath, which is where "walker is too shiny" is answered.
       Keep this in step with deshine() in index.html. */
    root.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const tag = canon(o.name) + " " + canon(o.material.name);
      if (!/body|skin|head|hair|shirt|top|jacket|suit|short|pant|trouser|jean|shoe|sneaker|boot|eyelash|brow|scalp|avatar|mat$/i
            .test(tag)) return;
      const m = o.material;
      if (typeof m.metalness === "number" && m.metalness > 0) m.metalness = 0;
      if (typeof m.roughness === "number" && m.roughness < 0.5) m.roughness = 0.6;
      if (typeof m.specularIntensity === "number" && m.specularIntensity > 0.4)
        m.specularIntensity = 0.35;
    });

    const mixer = new THREE.AnimationMixer(root);
    /* rest pose first, then moments spread through the clips */
    const shots = [{ label: "as loaded", clip: null, t: 0 }];
    /* One cell per clip, up to eleven. Sampling two moments of a clip
       and none of another hides whichever one is broken, and the first
       version of this quietly dropped two of the walker's seven. */
    const per = gl.animations.length <= 4 ? 2 : 1;
    for (const c of gl.animations)
      for (let i = 0; i < per && shots.length < 12; i++)
        shots.push({ label: (c.name || "?").slice(0, 16) + " " +
                            (c.duration * (i + 0.5) / per).toFixed(1) + "s",
                     clip: c, t: c.duration * (i + 0.5) / per });

    /* framed on the REST pose for every cell, so a figure that flies
       apart in one clip is visibly bigger than its own box rather than
       quietly re-framed to look normal */
    const rest = new THREE.Box3().setFromObject(root);
    const ctr = rest.getCenter(new THREE.Vector3());
    const size = rest.getSize(new THREE.Vector3());
    const reach = Math.max(size.x, size.y, size.z);

    for (const s of shots){
      const r = new THREE.WebGLRenderer({ antialias: true });
      r.setSize(W, H); r.setPixelRatio(1);
      const sc = new THREE.Scene();
      sc.background = new THREE.Color(0x28303c);
      const key = new THREE.DirectionalLight(0xfff4e6, 1.35); key.position.set(-2, 3, 3);
      const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35); fill.position.set(3, 1, 1);
      const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(0, 2, -3);
      sc.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.18));
      /* a floor, so "hovering" and "sunk" are both obvious */
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(reach * 6, reach * 6),
                                   new THREE.MeshStandardMaterial({ color: 0x3a4654 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = rest.min.y; sc.add(floor);

      mixer.stopAllAction();
      /* "as loaded" is exactly that — the state the file arrives in,
         with nothing applied. Calling skeleton.pose() here instead put
         the figure somewhere off camera and drew an empty cell, which
         is a good demonstration of why this tool prints pictures. */
      if (s.clip){ mixer.clipAction(s.clip).reset().play(); mixer.setTime(s.t); }
      root.updateMatrixWorld(true);
      sc.add(root);

      const cam = new THREE.PerspectiveCamera(30, W / H, reach / 100, reach * 100);
      const d = reach * 2.4;
      cam.position.set(ctr.x + d * 0.35, ctr.y + size.y * 0.12, ctr.z + d);
      cam.lookAt(ctr);
      r.render(sc, cam);

      const cell = document.createElement("div");
      cell.className = "cell";
      cell.appendChild(r.domElement);
      const cap = document.createElement("div");
      cap.className = "cap"; cap.textContent = s.label;
      cell.appendChild(cap);
      sheet.appendChild(cell);
      sc.remove(root);
    }

    /* how far the skin strays from the spine, the one number that
       would have caught the wings */
    const v = new THREE.Vector3();
    root.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const pos = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 300));
      for (let i = 0; i < pos.count; i += step){
        v.fromBufferAttribute(pos, i);
        o.applyBoneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        if (!Number.isFinite(v.x)) { spike = Infinity; break; }
        spike = Math.max(spike, Math.hypot(v.x - ctr.x, v.z - ctr.z) / Math.max(size.y, 1e-6));
      }
    });

    const dressable = ["shirt","shorts","sneakers","hair"].filter(k => slots[k]);
    document.getElementById("facts").textContent =
      url.split("/").pop() + "\\n" +
      Math.round(tris).toLocaleString() + " triangles · " + meshes + " meshes · " +
      mats.size + " materials · " + images + " texture maps\\n" +
      "clips: " + (gl.animations.map(c => (c.name||"?") + " " + c.duration.toFixed(2) + "s")
                     .join(", ") || "none") + "\\n" +
      "wardrobe can tint: " + (dressable.join(", ") || "nothing — this body is always the same") +
      "\\nfinish: " + [...new Map(finish.map(f => [f.mat, f])).values()]
        .map(f => f.mat + "  rough " + f.rough + (f.roughMap ? "+map" : "") +
                  "  metal " + f.metal + (f.metalMap ? "+map" : "") +
                  (f.spec == null ? "" : "  spec " + f.spec + (f.specMap ? "+map" : "")) +
                  (f.ior == null ? "" : "  ior " + f.ior)).join("\\n        ") +
      "\\n   (raw file values. The pictures above have the campus"
      + " correction applied:\\n   on person parts, metalness -> 0,"
      + " roughness floored at 0.5, specular damped to 0.35.)\\n" +
      "\\nskin reaches " + (spike === Infinity ? "NaN — BROKEN" : spike.toFixed(2)) +
      " figure-heights from the spine" +
      "\\n   calibrated on this cast: sound bodies measure 0.02-0.80 (arms out" +
      "\\n   mid-stride); the one whose mesh tore into wings measured 7.15.";
    done(true);
  }, undefined, (e) => { document.getElementById("facts").textContent =
    "FAILED TO LOAD: " + e; done(false); });
});
</script>`;

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/"){ res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  const p = resolve(ROOT, "." + rel);
  if (!p.startsWith(ROOT + sep) || !existsSync(p) || statSync(p).isDirectory()){
    res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise(r => server.listen(PORT, r));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1220, height: 620 } });
page.on("pageerror", e => console.log("    [pageerror] " + e.message.slice(0, 140)));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__sheet);

for (const f of bodies){
  const name = f.replace(/^stu_|\.glb$/g, "");
  const ok = await page.evaluate((u) => window.__sheet(u), `/assets/${f}`);
  const out = `${OUT}/character-${name}.png`;
  await page.screenshot({ path: out, fullPage: true });
  const facts = await page.evaluate(() => document.getElementById("facts").textContent);
  console.log("\n" + "=".repeat(64) + "\n" + facts + "\n  -> " + out.replace(ROOT + "/", ""));
  if (!ok) console.log("  (load failed — the sheet shows nothing)");
}
await browser.close(); server.close();
