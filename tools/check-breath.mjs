#!/usr/bin/env node
/**
 * Pembroke Academy — does a standing figure stay where it was put?
 *
 *     node tools/check-breath.mjs
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
 * So this drives the real pair — the mixer re-seeking one frame, then
 * breathe() — for a simulated minute, and measures how far the head has
 * actually turned. Breathing is a couple of degrees. Anything past ten
 * is the bug coming back.
 *
 * It runs on the CAMPUS, not on files from assets/. An earlier version
 * lifted breathe() out of index.html with a regex and ran it on a GLB
 * straight off disk, which worked while bodies shipped with their own
 * clips and tested nothing from the moment they stopped: every pose a
 * student is held in is LENT at load, so the files it was reading had
 * no clips at all. It reported "all 0 bodies with something to hold
 * held it" and exited 0 — green, every run, through the whole session
 * in which a lent Idle went out twisting students on the spot.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8353;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".glb": "model/gltf-binary", ".png": "image/png",
               ".woff2": "font/woff2", ".json": "application/json" };
/* Held at 60fps for a minute. The fault it looks for grew with frame
   rate, so a slow sample would have understated it. */
const FPS = Number(process.env.FPS || 60);
const SECONDS = Number(process.env.SECONDS || 60);
const LIMIT = 10;                      /* degrees of head travel allowed */
/* ── how many bodies, and why not all of them ─────────────────────────
   Posing one body costs a fetch, a decode and a retarget of a 2.8MB
   character through the campus's own lendClip, and a software
   rasterizer takes about a minute over each — twelve of them is longer
   than the whole rest of the suite.
 *
 * The fault this looks for is in breathe(), not in the rigs: an offset
 * that accumulated into its own previous output, growing with frame
 * rate until every head had rolled through a full circle. That is the
 * same arithmetic on every skeleton. Three bodies exercise it; the
 * twelfth would exercise it identically.
 *
 * Which is a claim about THIS fault, so the count is a flag rather
 * than a constant: --all when a rig-shaped suspicion turns up, and the
 * report says how many were sampled either way so nobody reads three
 * as twelve. */
const SAMPLE = process.argv.includes("--all") ? Infinity
             : Number(process.env.BODIES || 3);

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const p = resolve(ROOT, "." + (rel === "/" ? "/index.html" : rel));
  if (!p.startsWith(ROOT + sep) || !existsSync(p) || statSync(p).isDirectory()){
    res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise(r => server.listen(PORT, r));

/* ── watch a body on the CAMPUS, not a file on disk ───────────────────
   This used to lift breathe() out of index.html with a regex and run it
   on a GLB straight from assets/. That worked while bodies shipped with
   their own clips, and tested nothing from the moment they stopped:
   every pose a student is held in is LENT at load, so the files it was
   reading have no clips at all and it reported "all 0 bodies with
   something to hold held it" — green, every run, for the whole session
   in which a lent Idle went out twisting students on the spot.

   So it drives the campus, lends each body the pose it will actually be
   held in, and watches the head. */
const browser = await chromium.launch({ args: ["--use-gl=swiftshader",
  "--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", e => console.error("page error: " + e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__castFiles && window.__breathe &&
  Object.keys(window.__castFiles).length > 0, null, { timeout: 300000 });

console.log(`a held figure breathing at ${FPS}fps for ${SECONDS}s — ` +
            `how far the head travels\n`);
const bad = [], unmeasured = [];
const all = await page.evaluate(() => Object.entries(window.__castFiles).sort());
/* Spread across the roster rather than the first N: the cast is sorted
   by name, and char10 landed months after char2. Taking the head of the
   list would sample only the oldest rigs. */
const step = Math.max(1, Math.ceil(all.length / Math.min(SAMPLE, all.length)));
const cast = SAMPLE >= all.length ? all : all.filter((_, i) => i % step === 0);
if (cast.length < all.length)
  console.log(`sampling ${cast.length} of ${all.length} bodies ` +
              `(--all for every one)\n`);
for (const [name, url] of cast){
  let r;
  try {
    r = await page.evaluate(async ([u, fps, secs]) => {
      /* the pose a student is actually held in: the seated loop is the
         longest one anybody holds, and it is lent from a donor */
      const res = await window.__poseAt(u, "assets/clip_talk.glb", null, 0.4, "seated");
      if (res.err) return { err: res.err };
      const { fig, mix, t } = window.__posed || {};
      if (!fig) return { err: "__poseAt parked nothing" };
      const THREE = window.__app.THREE;
      let head = null;
      fig.traverse(o => {
        const k = (o.name || "").split(":").pop().replace(/^mixamorig\d*/i, "");
        if (!head && o.isBone && /head/i.test(k) && !/top|end/i.test(k)) head = o;
      });
      if (!head) return { err: "no head bone" };
      /* The state that lets breathe() run away: a mixer re-seeking ONE
         frame. PropertyMixer only writes a bone whose accumulated value
         changed, so a held figure stops being written at all — and the
         first breathe() added to the bone in place, landing on its own
         previous output. Held, not playing, or this measures nothing. */
      const dt = 1 / fps;
      const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
      const d = new THREE.Quaternion();
      mix.setTime(t); fig.updateMatrixWorld(true);
      head.getWorldQuaternion(q0);
      let peak = 0;
      for (let f = 1; f <= Math.round(fps * secs); f++){
        mix.setTime(t);                      /* holdStill re-seeks each frame */
        window.__breathe(fig, f * dt, 0.7);
        fig.updateMatrixWorld(true);
        head.getWorldQuaternion(q1);
        d.copy(q0).invert().multiply(q1);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(d.w))) * 180 / Math.PI;
        if (ang > peak) peak = ang;
      }
      return { deg: peak };
    }, [url, FPS, SECONDS]);
  } catch (e){ r = { err: String(e).split("\n")[0].slice(0, 120) }; }
  if (r.err){
    console.log(name.padEnd(10) + "NOT MEASURED: " + r.err);
    unmeasured.push(`${name}: ${r.err}`);
    continue;
  }
  const deg = r.deg;
  const ok = deg <= LIMIT;
  console.log(name.padEnd(10) + (ok ? "held  " : "DRIFT ") +
              deg.toFixed(1) + "deg of travel at the head");
  if (!ok) bad.push(`${name}: ${deg.toFixed(1)}deg`);
}

if (bad.length){
  console.error(`\n${bad.length} body(ies) drift past ${LIMIT}deg while held:\n  ` +
                bad.join("\n  "));
}
if (unmeasured.length){
  console.error(`\n${unmeasured.length} body(ies) could not be measured, so nothing ` +
                `here vouches for them:\n  ` + unmeasured.join("\n  "));
}
const held = cast.length - unmeasured.length;
if (!bad.length && !unmeasured.length && held > 0){
  console.log(`\n${held} of ${all.length} bodies held a lent pose for ` +
              `${SECONDS}s — every head stays within ${LIMIT}deg`);
}
/* A pass on nothing is a failure. See above: that is exactly what this
   file did for a whole session. */
if (held === 0)
  console.error("check-breath tested NOTHING — no body could be posed at all.");
await browser.close(); server.close();
process.exit(bad.length || unmeasured.length || held === 0 ? 1 : 0);
