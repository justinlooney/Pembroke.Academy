#!/usr/bin/env node
/**
 * Pembroke Academy — are the two cast budgets still true?
 *
 *     node tools/check-vram.mjs
 *
 * The campus gates its crowd on two tables of measured numbers:
 *
 *     CAST_MB        what a body costs to DOWNLOAD, per body.
 *                    drawFirstWave spends FIRST_WAVE_MB of it.
 *     BODY_VRAM_MB   what a body costs in DECODED TEXTURE.
 *                    roomOnScreen spends ON_SCREEN_MB of it.
 *
 * Both were measured once, correctly, and both then rotted — because
 * measuring them is a manual step and swapping a body is not. Ten
 * bodies were replaced without either table being touched, and the two
 * failures that produced are the reason this file exists:
 *
 * THE CEILING UNDER-COUNTED. BODY_VRAM_MB is a single constant, 16.0,
 * written when every body carried 1024x1024 maps. The replacements
 * carry 2048x2048 — 21.33MB with mipmaps, a third more each. Three of
 * them on screen is 64MB against a ceiling that believes it is holding
 * 48. The ceiling exists to protect phone VRAM and it was the phone
 * that this quietly stopped protecting.
 *
 * THE FIRST WAVE STARVED. CAST_MB still held the OLD file sizes, which
 * are two to three times the new ones. The faculty board first at a
 * claimed 6.24MB of the 8.8MB wave, leaving 2.56MB — and exactly one
 * body in the table was small enough to fit that: char6 at 2.55. So
 * every visit opened with the same three people. Measured across
 * twenty-one visits while photographing swapped bodies: char17, char18
 * and char6 on essentially all of them, and seven of the fourteen
 * bodies on none. char14 never appeared in forty-eight minutes.
 *
 * So this reads both quantities off the real files and compares them to
 * what index.html believes. A wrong number here is not cosmetic: one
 * decides who a visitor ever meets, the other decides whether their
 * phone can hold them.
 *
 * The decoded figure is width x height x 4 bytes x 4/3 for the mip
 * chain, which is what a GPU actually reserves — not the file size,
 * which is the compressed thing and has never been what the ceiling
 * cared about.
 */
import { serve, launch, ROOT } from "./_harness.mjs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const TOL_MB = 0.05;      /* download: a rounding difference is fine */
const TOL_VRAM = 0.5;     /* decoded: half a megabyte either way */

const src = await readFile(resolve(ROOT, "index.html"), "utf8");

const grab = (re, what) => {
  const m = src.match(re);
  if (!m) { console.log(`  cannot find ${what} in index.html`); process.exit(1); }
  return m;
};

/* what the page believes */
const castFiles = Object.fromEntries(
  [...grab(/const CAST_FILES = \{([\s\S]*?)\n\};/, "CAST_FILES")[1]
     .matchAll(/^\s*(char\d+):\s*"([^"]+)"/gm)].map(m => [m[1], m[2]]));
const castMB = Object.fromEntries(
  [...grab(/const CAST_MB = \{([\s\S]*?)\};/, "CAST_MB")[1]
     .matchAll(/(char\d+):\s*([\d.]+)/g)].map(m => [m[1], +m[2]]));
const vramTable = src.match(/const CAST_VRAM_MB = \{([\s\S]*?)\};/);
const vramMB = vramTable
  ? Object.fromEntries([...vramTable[1].matchAll(/(char\d+):\s*([\d.]+)/g)]
      .map(m => [m[1], +m[2]]))
  : null;
const flatVram = +grab(/const BODY_VRAM_MB = ([\d.]+)/, "BODY_VRAM_MB")[1];
const onScreenCap = +grab(/const ON_SCREEN_MB = [^|]*\|\| ([\d.]+)/, "ON_SCREEN_MB")[1];
const firstWave = +grab(/const FIRST_WAVE_MB = ([\d.]+)/, "FIRST_WAVE_MB")[1];

const PAGE = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"/assets/vendor/three/build/three.module.js",
  "three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
/* Read the textures the way the GPU will see them: after the loader has
 * decompressed whatever the file used. Slicing image bytes out of the
 * bufferViews by hand does not work here — these files are meshopt
 * compressed, and a naive PNG header read off a compressed view
 * returns dimensions like 55537x49104. */
window.__vram = (url) => new Promise((done) => loader.load(url, (g) => {
  const maps = new Map();
  g.scene.traverse(o => {
    const m = o.material; if (!m) return;
    for (const slot of ["map","normalMap","roughnessMap","metalnessMap",
                        "emissiveMap","aoMap","alphaMap"]){
      const t = m[slot]; const img = t && t.image;
      if (!img || !img.width) continue;
      maps.set(t.uuid, { slot, w: img.width, h: img.height });
    }
  });
  const list = [...maps.values()];
  done({ maps: list,
         mb: list.reduce((a, t) => a + t.w * t.h * 4 * (4/3), 0) / 1048576 });
}, undefined, (e) => done({ err: String(e && e.message || e) })));
</script>`;

const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
/* The harness serves the repo and nothing else, and this page is not a
 * file in the repo — writing one there just to read it back would leave
 * litter behind on any run that died. Fulfil the request in the browser
 * instead; the URL still sits under the served origin, so the importmap
 * and the vendored three.js resolve exactly as they do for the campus. */
await page.route("**/__vram", (route) =>
  route.fulfill({ contentType: "text/html", body: PAGE }));
await page.goto(`${origin}/__vram`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__vram, null, { timeout: 30000 });

const rows = [];
for (const [k, path] of Object.entries(castFiles)){
  const bytes = (await stat(resolve(ROOT, path))).size / 1e6;
  const r = await page.evaluate((u) => window.__vram(u), `${origin}/${path}`);
  if (r.err){ console.log(`  ${k}: WILL NOT LOAD — ${r.err}`); continue; }
  rows.push({ k, path, bytes, vram: r.mb,
              dims: r.maps.map(m => `${m.w}x${m.h}`).join("+") || "none" });
}
await browser.close(); await closeSrv();

let bad = 0;
console.log(`\n  DOWNLOAD — what drawFirstWave spends, ${firstWave}MB a wave\n`);
console.log(`  body     file                        real MB   CAST_MB`);
for (const r of rows){
  const claim = castMB[r.k];
  const off = claim === undefined || Math.abs(claim - r.bytes) > TOL_MB;
  if (off) bad++;
  console.log(`  ${r.k.padEnd(8)} ${r.path.replace("assets/","").padEnd(26)}` +
              ` ${r.bytes.toFixed(2).padStart(7)}   ${String(claim ?? "—").padStart(7)}` +
              (off ? "   <-- WRONG" : ""));
}

console.log(`\n  DECODED TEXTURE — what roomOnScreen spends, ${onScreenCap}MB on screen\n`);
console.log(`  body     texture              real MB   charged`);
for (const r of rows){
  const claim = vramMB ? vramMB[r.k] : flatVram;
  const off = claim === undefined || Math.abs(claim - r.vram) > TOL_VRAM;
  if (off) bad++;
  console.log(`  ${r.k.padEnd(8)} ${r.dims.padEnd(20)} ${r.vram.toFixed(2).padStart(7)}` +
              `   ${String(claim ?? "—").padStart(7)}` + (off ? "   <-- WRONG" : ""));
}

/* HOW MANY PEOPLE THE CEILING ACTUALLY HOLDS.
 *
 * Not "do the three heaviest exceed it" — that was the first version of
 * this line and it kept saying THE CEILING CAN BE BREACHED after the
 * accounting was fixed, because three heavy bodies do still sum past
 * 48MB. They just never get there: roomOnScreen refuses the third. The
 * question worth printing is how many people a visitor sees, so this
 * admits bodies the way the campus does and counts. */
const heaviest = rows.slice().sort((a, b) => b.vram - a.vram);
const lightest = rows.slice().sort((a, b) => a.vram - b.vram);
const admit = (order) => {
  let mb = 0, n = 0;
  for (const r of order){ if (mb + r.vram > onScreenCap) break; mb += r.vram; n++; }
  return { n, mb };
};
const worst = admit(heaviest), best = admit(lightest);
console.log(`\n  ON SCREEN — a ${onScreenCap}MB ceiling, charged per body.\n`);
console.log(`  heaviest bodies   ${worst.n} fit (${worst.mb.toFixed(1)}MB)` +
            `  — ${heaviest.slice(0, worst.n).map(r => r.k).join(", ")}`);
console.log(`  lightest bodies   ${best.n} fit (${best.mb.toFixed(1)}MB)` +
            `  — ${lightest.slice(0, best.n).map(r => r.k).join(", ")}`);
if (worst.n < best.n)
  console.log(`\n  So the quad holds ${best.n} people on a light draw and only` +
              ` ${worst.n} on a heavy one.\n  Before the per-body charge it always` +
              ` believed ${Math.floor(onScreenCap / flatVram)}, and drew ` +
              `${Math.floor(onScreenCap / flatVram)} —\n  which is how a ${onScreenCap}MB` +
              ` ceiling came to hold ` +
              `${(heaviest.slice(0, Math.floor(onScreenCap / flatVram))
                   .reduce((a, r) => a + r.vram, 0)).toFixed(0)}MB.`);

/* Who can actually board.
 *
 * Modelled on what the page BELIEVES, not on the real bytes — the wave
 * is spent from CAST_MB, so a stale CAST_MB is what decides the guest
 * list, and a version of this that used the true file sizes would have
 * reported the campus healthy while it was opening with the same three
 * people every visit. Both are printed, because the gap between them
 * IS the bug. */
const fac = ["char18", "char17"].filter(k => castFiles[k]);
const board = (mbOf) => {
  const spent = fac.reduce((a, k) => a + (mbOf(k) ?? 9), 0);
  const room = firstWave - spent;
  const fit = rows.filter(r => !fac.includes(r.k) && (mbOf(r.k) ?? 9) <= room);
  return { spent, room, fit };
};
const believed = board((k) => castMB[k]);
const real = board((k) => rows.find(r => r.k === k)?.bytes);
console.log(`\n  FIRST WAVE — ${firstWave}MB, and the faculty board first.\n`);
console.log(`  as CAST_MB has it   faculty ${believed.spent.toFixed(2)}MB,` +
            ` ${believed.room.toFixed(2)}MB left, ` +
            `${believed.fit.length} of ${rows.length - fac.length} others fit` +
            `: ${believed.fit.map(r => r.k).join(", ") || "NOBODY"}`);
console.log(`  as the files are    faculty ${real.spent.toFixed(2)}MB,` +
            ` ${real.room.toFixed(2)}MB left, ` +
            `${real.fit.length} of ${rows.length - fac.length} others fit` +
            `: ${real.fit.map(r => r.k).join(", ") || "NOBODY"}`);
if (believed.fit.length < 3){
  bad++;
  console.log(`\n  THE WAVE IS STARVED. Only ${believed.fit.length} body can board behind` +
              ` the faculty,\n  so the campus opens with the same people every visit.` +
              ` With the real\n  sizes ${real.fit.length} could — which is the variety this` +
              ` wave was built to have.`);
}

console.log(bad ? `\n  ${bad} number(s) in index.html no longer match the files.`
                : `\n  Both tables match the files.`);
process.exit(bad ? 1 : 0);
