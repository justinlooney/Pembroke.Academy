#!/usr/bin/env node
/**
 * Pembroke Academy — which of the old repairs still do anything?
 *
 *     node tools/check-legacy.mjs
 *
 * Twelve of the fourteen bodies have been replaced. Several mechanisms
 * in index.html were built for the cast that is now gone, and a repair
 * that no longer fires is worse than no repair: it still runs, it still
 * has to be read and understood by whoever comes next, and it still
 * looks like it is protecting something.
 *
 * This asks each one whether it still does work, on the live campus,
 * per body:
 *
 *   DESHINE    metalness 1 in the file, 0 after the campus corrects it.
 *              This one was the largest find of the whole investigation
 *              and it is worth knowing it still fires on new bodies.
 *   TIGHTEN    which power each body ships at, from CAST_SKIN. Power 1
 *              means tightenWeights returns immediately: no tightening
 *              at all for that body.
 *   TEXCAP     whether capTextures actually shrank anything.
 *
 * A mechanism that fires for nobody is a candidate for deletion. A
 * mechanism that fires for one body is a candidate for being replaced
 * by fixing that body.
 *
 * It has already claimed one. The WARDROBE was measured here across
 * four visits, found to name zero meshes on every body in the cast, and
 * is now deleted along with dressFigure — so the column that counted
 * what it could tint is gone too. A check that reports on a mechanism
 * nobody can call is the same dead weight it was written to find.
 */
import { serve, launch, ROOT } from "./_harness.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const src = await readFile(resolve(ROOT, "index.html"), "utf8");
const castFiles = Object.fromEntries(
  [...src.match(/const CAST_FILES = \{([\s\S]*?)\n\};/)[1]
     .matchAll(/^\s*(char\d+):\s*"([^"]+)"/gm)].map(m => [m[1], m[2]]));
const perBody = Object.fromEntries(
  [...(src.match(/const CAST_SKIN = \{([\s\S]*?)\};/)?.[1] || "")
     .matchAll(/(char\d+):\s*(\d+)/g)].map(m => [m[1], +m[2]]));
const globalPower = +src.match(/const SKIN_TIGHTEN = .*: (\d+);/)[1];
const texCap = +src.match(/const TEX_CAP = .*: ([\d.]+);/)[1];

const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
/* ACROSS VISITS, because one visit is not the cast.
 *
 * The deal shows a subset and the crowd ramps for minutes, so a single
 * visit saw ten of fourteen and the four it missed varied run to run.
 * A tool that concluded "this repair is dead" from that would be making
 * a claim about bodies it had never looked at, and one that FAILED on
 * it would fail on ordinary campus behaviour. So: revisit, accumulate,
 * and stop as soon as every body has been seen once. */
const VISITS = +(process.env.VISITS || 4);
const byBody = new Map();
for (let v = 1; v <= VISITS; v++){
  await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && (window.__students || []).length,
                             null, { timeout: 240_000 });
  await page.waitForTimeout(150_000);
  for (const r of await readBodies()) if (!byBody.has(r.k)) byBody.set(r.k, r);
  const left = Object.keys(castFiles).filter(k => !byBody.has(k));
  console.log(`  visit ${v}: ${byBody.size} of ${Object.keys(castFiles).length} seen` +
              (left.length ? ` — still missing ${left.join(", ")}` : " — all of them"));
  if (!left.length) break;
}
const rows = [...byBody.values()].sort((a, b) => a.k.localeCompare(b.k));

function readBodies(){ return page.evaluate(() => {
  const out = [], seen = new Set();
  for (const s of (window.__students || [])){
    const g = s.g, k = g?.userData?.figure;
    if (!k || seen.has(k)) continue; seen.add(k);
    let meshes = 0, metal = 0, big = 0, tex = 0;
    const done = new Set();
    g.traverse(o => {
      if (!o.isMesh || !o.material) return;
      meshes++;
      if ((o.material.metalness ?? 0) > 0.01) metal++;
      /* the runtime's own list, read off the page, so this cannot scan a
       * narrower set than capTextures and call an uncapped map capped */
      for (const slot of (window.__texSlots || ["map","normalMap","roughnessMap","aoMap"])){
        const t = o.material[slot], img = t && t.image;
        if (!img || !img.width || done.has(t.uuid)) continue;
        done.add(t.uuid); tex++;
        big = Math.max(big, Math.max(img.width, img.height));
      }
    });
    out.push({ k, meshes, metal, big, tex });
  }
  return out;
}); }
await browser.close(); await closeSrv();

if (!rows.length){ console.log("  nobody on the quad — nothing measured"); process.exit(1); }

console.log(`\n  body     meshes   metalness > 0   largest map   tighten`);
let anyMetal = 0, anyCapped = 0, noTighten = 0;
for (const r of rows){
  const power = perBody[r.k] ?? globalPower;
  anyMetal += r.metal;
  if (r.big > texCap) anyCapped++;
  if (power <= 1) noTighten++;
  console.log(`  ${r.k.padEnd(8)} ${String(r.meshes).padStart(6)}` +
              `   ${String(r.metal).padStart(13)}` +
              `   ${(r.big + "px").padStart(11)}` +
              `   ${String(power).padStart(7)}${power <= 1 ? "  (none)" : ""}`);
}

/* WHAT WAS NOT LOOKED AT. The campus deliberately shows a subset, so a
 * verdict drawn from one visit describes the bodies that turned up and
 * nothing else. "This repair no longer fires" is exactly the kind of
 * claim that must not be made about bodies nobody inspected — it is how
 * the wardrobe was retired, and it took four visits to earn it. */
const missing = Object.keys(castFiles).filter(k => !rows.some(r => r.k === k));
console.log(`\n  ${rows.length} of ${Object.keys(castFiles).length} bodies seen.`);
if (missing.length)
  console.log(`  NOT MEASURED: ${missing.join(", ")} — the verdicts below`
              + `\n  describe the bodies above and no others.\n`);
else console.log(`  every body in the cast was measured.\n`);
console.log(anyMetal
  ? `  DESHINE   ${anyMetal} material(s) still read metalness > 0 — IT IS NOT WORKING.`
  : `  DESHINE   every material reads metalness 0. Still doing its job, and`
    + `\n            still needed: these files all ship metalness 1.`);
console.log(anyCapped
  ? `  TEXCAP    ${anyCapped} body(s) still exceed ${texCap}px — cap is not firing.`
  : `  TEXCAP    every map is at or under ${texCap}px. Firing.`);
console.log(noTighten
  ? `  TIGHTEN   ${noTighten} of ${rows.length} ship at power 1, i.e. no tightening at all.`
  : `  TIGHTEN   every body is tightened.`);

/* A GUARD THAT CANNOT FAIL IS NOT A GUARD. This printed "IT IS NOT
 * WORKING" over a broken deshine and exited 0, which would have left a
 * check-* tool green through the single largest regression this
 * investigation ever found. The repairs that must still fire fail the
 * run; a repair found doing nothing is a report, not a fault — it is a
 * candidate for deletion, and that is a decision for a person. */
const broken = [];
if (anyMetal) broken.push(`deshine (${anyMetal} material(s) above metalness 0)`);
if (anyCapped) broken.push(`capTextures (${anyCapped} body(s) over ${texCap}px)`);
/* Not seeing a body across every visit is the deal being the deal, not
 * a repair being broken. It is stated above and left out of the verdict
 * so this fails on regressions rather than on attendance. */
if (broken.length){
  console.log(`\n  FAILED: ${broken.join("; ")}.`);
  process.exit(1);
}
console.log(`\n  Every repair that must still fire, fires.`);
