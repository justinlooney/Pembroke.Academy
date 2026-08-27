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
 *   WARDROBE   dressFigure tints a mesh only if it can NAME it — shirt,
 *              jean, sneaker and so on. The cast was already down to
 *              CAST_DRESSABLE = [] before this branch; this counts the
 *              meshes it can actually find now.
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
 */
import { serve, launch, ROOT } from "./_harness.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const src = await readFile(resolve(ROOT, "index.html"), "utf8");
const perBody = Object.fromEntries(
  [...(src.match(/const CAST_SKIN = \{([\s\S]*?)\};/)?.[1] || "")
     .matchAll(/(char\d+):\s*(\d+)/g)].map(m => [m[1], +m[2]]));
const globalPower = +src.match(/const SKIN_TIGHTEN = .*: (\d+);/)[1];
const texCap = +src.match(/const TEX_CAP = .*: ([\d.]+);/)[1];

const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && (window.__students || []).length,
                           null, { timeout: 240_000 });
/* long enough for the crowd to ramp; the deal only ever shows a subset
 * per visit, so this reports who turned up rather than the whole cast */
await page.waitForTimeout(180_000);

const rows = await page.evaluate(() => {
  const canon = (s) => (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const NAMED = /hair|beard|moustache|scalp|brow|eyelash|shirt|top|jacket|suit|hoodie|sweater|short|pant|trouser|jean|bottom|denim|shoe|sneaker|boot|footwear|canvas|body|skin|head/i;
  const out = [], seen = new Set();
  for (const s of (window.__students || [])){
    const g = s.g, k = g?.userData?.figure;
    if (!k || seen.has(k)) continue; seen.add(k);
    let named = 0, meshes = 0, metal = 0, big = 0, tex = 0;
    const done = new Set();
    g.traverse(o => {
      if (!o.isMesh || !o.material) return;
      meshes++;
      if (NAMED.test(canon(o.name) + " " + canon(o.material.name))) named++;
      if ((o.material.metalness ?? 0) > 0.01) metal++;
      for (const slot of ["map","normalMap","roughnessMap","aoMap"]){
        const t = o.material[slot], img = t && t.image;
        if (!img || !img.width || done.has(t.uuid)) continue;
        done.add(t.uuid); tex++;
        big = Math.max(big, Math.max(img.width, img.height));
      }
    });
    out.push({ k, meshes, named, metal, big, tex });
  }
  return out.sort((a, b) => a.k.localeCompare(b.k));
});
await browser.close(); await closeSrv();

if (!rows.length){ console.log("  nobody on the quad — nothing measured"); process.exit(1); }

console.log(`\n  body     meshes  wardrobe can name   metalness > 0   largest map   tighten`);
let anyNamed = 0, anyMetal = 0, anyCapped = 0, noTighten = 0;
for (const r of rows){
  const power = perBody[r.k] ?? globalPower;
  anyNamed += r.named; anyMetal += r.metal;
  if (r.big > texCap) anyCapped++;
  if (power <= 1) noTighten++;
  console.log(`  ${r.k.padEnd(8)} ${String(r.meshes).padStart(6)}` +
              `   ${String(r.named).padStart(17)}` +
              `   ${String(r.metal).padStart(13)}` +
              `   ${(r.big + "px").padStart(11)}` +
              `   ${String(power).padStart(7)}${power <= 1 ? "  (none)" : ""}`);
}

console.log(`\n  ${rows.length} bodies on the quad this visit.\n`);
console.log(anyNamed
  ? `  WARDROBE  still finds ${anyNamed} nameable mesh(es) — dressFigure does work.`
  : `  WARDROBE  finds NOTHING to tint on any body. dressFigure walks every`
    + `\n            mesh of every figure and colours none of them. Dead.`);
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
