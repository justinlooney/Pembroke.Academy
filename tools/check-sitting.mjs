#!/usr/bin/env node
/**
 * Pembroke Academy — is this clip sitting, standing up, or sitting down?
 *
 *     node tools/check-sitting.mjs [walker ...]      (default: all)
 *
 * A clip arrives from Mixamo named whatever the download was called,
 * and the name is not evidence. Three clips came into this repository
 * as Seat_A, Seat_B and Seat_C precisely because nobody could open them
 * — Drive is unreachable from the machine that added them — and putting
 * a seated loop on the stand-up branch would look exactly like a bug in
 * the branch rather than a mislabelled file.
 *
 * The hips settle it. Measured as a fraction of the figure's standing
 * height, across the clip:
 *
 *   high throughout        standing (an idle, a walk, a talk)
 *   low throughout         a seated loop
 *   low -> high            standing up
 *   high -> low            sitting down
 *
 * Also reports whether the clip carries travel. Mixamo's "In Place"
 * checkbox is easy to miss, and the campus drives position itself: a
 * clip that also moves the body fights it and the feet skate. And it
 * reports the pose at each end, because a sit-down whose final pose is
 * nowhere near the seated loop's will pop when the two are chained.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8361;
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".glb": "model/gltf-binary", ".png": "image/png" };
const pick = process.argv.slice(2).filter(a => !a.startsWith("-"));
const bodies = readdirSync(resolve(ROOT, "assets"))
  .filter(f => /^stu_.*\.glb$/.test(f))
  .filter(f => !pick.length || pick.includes(f.replace(/^stu_|\.glb$/g, "")))
  .sort();

const PAGE = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"/assets/vendor/three/build/three.module.js",
  "three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const boneKey = (s) => {
  s = (s || "").split("|").pop().split(":").pop();
  s = s.replace(/^mixamorig\\d*/i, "").replace(/[._]\\d+$/, "");
  return (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
};

window.__sit = (url) => new Promise((done) => {
  loader.load(url, (gl) => {
    const root = gl.scene;
    root.updateMatrixWorld(true);
    let hips = null, head = null, foot = null;
    root.traverse(o => {
      if (!o.isBone) return;
      const k = boneKey(o.name);
      if (!hips && /hip|pelvis/.test(k)) hips = o;
      if (!head && /head/.test(k) && !/top|end|front/.test(k)) head = o;
      if (!foot && /foot/.test(k) && !/end|toe/.test(k)) foot = o;
    });
    if (!hips || !head || !foot){ done({ err: "no hips, head or foot" }); return; }

    /* Standing height from the REST pose, so the yardstick does not
       change with the clip being measured. */
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    hips.getWorldPosition(p); foot.getWorldPosition(q);
    const restHip = p.y - q.y;

    const mixer = new THREE.AnimationMixer(root);
    const out = [];
    for (const clip of gl.animations){
      const act = mixer.clipAction(clip);
      act.reset(); act.play(); act.setEffectiveWeight(1);
      const STEPS = 60;
      const hipAt = [], travel = [];
      for (let i = 0; i <= STEPS; i++){
        /* Just short of the end, never AT it. mixer.setTime(duration)
           on a looping action wraps to frame 0, so the last sample was
           the FIRST pose wearing the last sample's name — which on a
           clip that starts crouched and ends standing drags the closing
           average back down towards the crouch. Caught by rendering the
           frames and finding t=duration identical to t=0. */
        const t = Math.min(clip.duration * i / STEPS, clip.duration - 1e-3);
        act.time = t; mixer.setTime(t);
        root.updateMatrixWorld(true);
        hips.getWorldPosition(p); foot.getWorldPosition(q);
        hipAt.push((p.y - q.y) / (restHip || 1));
        travel.push([p.x, p.z]);
      }
      act.stop(); mixer.uncacheAction(clip);

      const first = hipAt.slice(0, 6).reduce((a, c) => a + c, 0) / 6;
      const last = hipAt.slice(-6).reduce((a, c) => a + c, 0) / 6;
      const lo = Math.min(...hipAt), hi = Math.max(...hipAt);
      /* how far the hips wander in the ground plane, in hip-heights */
      let span = 0;
      for (const [x, z] of travel)
        span = Math.max(span, Math.hypot(x - travel[0][0], z - travel[0][1]));
      /* 0.62, not 0.72. A jog drops the hips to 0.68 at the bottom of
         its stride, and at 0.72 this called Jogging a sit-down — a
         threshold that cannot tell a running man from a seated one is
         not measuring what it claims to. Walker's seated clip sits at
         0.48, so there is plenty of room between the two. */
      const SEATED = 0.62;
      const MOVED = 0.15;                  /* a real transition, not a stride */
      const kind =
        Math.abs(first - last) < MOVED
          ? (first <= SEATED ? "SEATED LOOP"
             : hi - lo < 0.12 ? "standing" : "standing (moves)")
        : first > SEATED && last <= SEATED ? "SITTING DOWN"
        : first <= SEATED && last > SEATED ? "STANDING UP"
        : "standing (moves)";
      out.push({ clip: clip.name, dur: +clip.duration.toFixed(2), kind,
                 start: +first.toFixed(2), end: +last.toFixed(2),
                 lo: +lo.toFixed(2), hi: +hi.toFixed(2),
                 travel: +(span / (restHip || 1)).toFixed(2) });
    }
    done({ clips: out });
  }, undefined, (e) => done({ err: String(e).slice(0, 120) }));
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
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__sit, null, { timeout: 15000 });

console.log("hip height as a fraction of standing, at the start and end of each clip\n");
console.log("body      clip                   dur    start   end     range        travel  what it is");
for (const f of bodies){
  const name = f.replace(/^stu_|\.glb$/g, "");
  const r = await page.evaluate((u) => window.__sit(u), `/assets/${f}`);
  if (r.err){ console.log(`${name.padEnd(9)} FAILED: ${r.err}`); continue; }
  for (const c of r.clips){
    const slide = c.travel > 0.35 ? `  <-- carries travel, not "In Place"` : "";
    console.log(`${name.padEnd(9)} ${(c.clip || "?").slice(0, 21).padEnd(22)}` +
                `${String(c.dur).padStart(6)}  ${String(c.start).padStart(5)}  ` +
                `${String(c.end).padStart(5)}  ${String(c.lo).padStart(5)}-${String(c.hi).padEnd(5)}  ` +
                `${String(c.travel).padStart(5)}   ${c.kind}${slide}`);
  }
}
await browser.close(); server.close();
