#!/usr/bin/env node
/**
 * Pembroke Academy — does a standing figure stay where it was put?
 *
 *     node tools/check-breath.mjs [walker ariel ...]     (default: all)
 *
 * Students with no idle clip stand by holding one frame of their own
 * walk, and breathe() adds a slow rise and sway on top so the held
 * frame reads as a person waiting rather than a statue. That offset is
 * applied every frame, after the mixer, to the spine, neck and head.
 *
 * The first version of breathe() added to the bone in place — a bare
 * `rotation.x +=` — on the belief that the mixer rewrites the bone from
 * the clip every update and so resets it. It does not. PropertyMixer.apply
 * ends with
 *
 *     if ( buffer[ i ] !== buffer[ i + stride ] ) {
 *       // value has changed -> update scene graph
 *       binding.setValue( buffer, offset );
 *
 * and a held figure is a PAUSED action re-seeking the same frame, so the
 * accumulated value stops changing and three.js stops writing the bone
 * at all. The += then landed on its own previous output. Every body in
 * the cast reached 180° of head travel inside a minute — heads rotating
 * slowly through the full circle, which is what reached the live site as
 * "swaying head around and around" and "it looks like everyone is on
 * drugs". It was also frame-rate dependent, so it was worst on the
 * fastest phones and nearly invisible in a slow headless harness.
 *
 * So this drives the real pair — mixer.update(dt) then breathe() — for
 * a simulated minute and measures how far the head has actually
 * travelled. Breathing is a couple of degrees. Anything past ten is the
 * bug coming back.
 *
 * breathe() is read out of index.html rather than reimplemented here.
 * A copy would drift from the original and then this would pass while
 * the campus rolled its heads, which is the whole failure it exists to
 * catch.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8353;
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".glb": "model/gltf-binary", ".png": "image/png" };
/* Held at 60fps for a minute. The fault it looks for grew with frame
   rate, so a slow sample would have understated it. */
const FPS = Number(process.env.FPS || 60);
const SECONDS = Number(process.env.SECONDS || 60);
const LIMIT = 10;                      /* degrees of head travel allowed */

/* ── lift breathe() out of the page it ships in ────────────────────── */
const src = await readFile(resolve(ROOT, "index.html"), "utf8");
const from = src.indexOf("const BREATHE = /");
const mark = src.indexOf("function breathe(g, t, phase){", from);
if (from < 0 || mark < 0){
  console.error("check-breath: could not find breathe() in index.html — " +
                "if it was renamed, this check needs renaming with it");
  process.exit(2);
}
/* brace-match to the end of the function so this survives edits inside it */
let depth = 0, end = -1;
for (let i = src.indexOf("{", mark); i < src.length; i++){
  if (src[i] === "{") depth++;
  else if (src[i] === "}" && --depth === 0){ end = i + 1; break; }
}
if (end < 0){ console.error("check-breath: breathe() has no closing brace"); process.exit(2); }
const BREATHE_SRC = src.slice(from, end);
console.log(`breathe() lifted from index.html — ${BREATHE_SRC.split("\n").length} lines\n`);

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
const DEG = 180 / Math.PI;

/* ── verbatim from index.html ─────────────────────────────────────── */
${BREATHE_SRC}
/* ─────────────────────────────────────────────────────────────────── */

window.__breath = (url, fps, seconds) => new Promise((done) => {
  loader.load(url, (gl) => {
    const root = gl.scene;
    root.updateMatrixWorld(true);
    const holder = new THREE.Group(); holder.add(root);

    let head = null;
    root.traverse(o => {
      const k = boneKey(o.name);
      if (!head && o.isBone && /head/.test(k) && !/top|end/.test(k)) head = o;
    });
    if (!head){ done({ err: "no head bone" }); return; }

    const rest = new Map();
    root.traverse(o => { if (o.isBone) rest.set(o, o.quaternion.clone()); });

    const out = [];
    for (const clip of gl.animations){
      for (const [b, q] of rest) b.quaternion.copy(q);
      delete holder.userData.__breath;

      const mixer = new THREE.AnimationMixer(root);
      const act = mixer.clipAction(clip);
      act.reset(); act.play(); act.setEffectiveWeight(1);
      /* the state breathe() runs in, and the state that stops the mixer
         writing: paused, re-seeking one frame */
      act.paused = true;
      act.time = clip.duration * 0.3;

      const dt = 1 / fps;
      const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
      const d = new THREE.Quaternion();
      mixer.update(0); root.updateMatrixWorld(true);
      head.getWorldQuaternion(q0);
      let peak = 0;
      for (let i = 1; i <= Math.round(fps * seconds); i++){
        mixer.update(dt);
        act.time = clip.duration * 0.3;      /* holdStill re-seeks each frame */
        breathe(holder, i * dt, 0);
        root.updateMatrixWorld(true);
        head.getWorldQuaternion(q1);
        d.copy(q0).invert().multiply(q1);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(d.w))) * DEG;
        if (ang > peak) peak = ang;
      }
      act.stop(); mixer.uncacheAction(clip);
      out.push({ clip: clip.name, peak: +peak.toFixed(1) });
    }
    done({ bones: (holder.userData.__breath?.bones || []).map(b => b.name), clips: out });
  }, undefined, (er) => done({ err: String(er).slice(0, 120) }));
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
page.on("pageerror", e => { console.error("page error: " + e.message); });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__breath, { timeout: 15000 });

console.log(`a held figure breathing at ${FPS}fps for ${SECONDS}s — ` +
            `how far the head travels\n`);
const bad = [];
for (const f of bodies){
  const name = f.replace(/^stu_|\.glb$/g, "");
  const r = await page.evaluate(([u, fps, s]) => window.__breath(u, fps, s),
                                [`/assets/${f}`, FPS, SECONDS]);
  if (r.err){ console.log(name.padEnd(10) + "FAILED: " + r.err); continue; }
  const worst = Math.max(...r.clips.map(c => c.peak));
  const over = r.clips.filter(c => c.peak > LIMIT);
  console.log(`${name.padEnd(10)} worst ${String(worst).padStart(6)}deg over ` +
              `${r.clips.length} clip(s)   breathes through ` +
              r.bones.map(b => b.replace(/_\d+$/, "")).join(" > "));
  for (const c of over){
    console.log(`             ${c.clip}: ${c.peak}deg`);
    bad.push(`${name} / ${c.clip}  ${c.peak}deg`);
  }
}
console.log("\n" + "─".repeat(66));
if (bad.length){
  console.log(`breathing is compounding instead of settling — a held head\n` +
              `should move a couple of degrees, not:\n  ` + bad.join("\n  "));
} else {
  console.log(`every held head stays within ${LIMIT}deg — breathing settles`);
}
await browser.close(); server.close();
process.exit(bad.length ? 1 : 0);
