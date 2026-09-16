#!/usr/bin/env node
/**
 * Pembroke Academy — what does the on-screen ceiling actually buy?
 *
 *     node tools/probe-onscreen-cost.mjs [seconds] [mb ...]
 *
 * ON_SCREEN_MB is spent in MEGABYTES OF DECODED TEXTURE, and that was
 * the right unit when it was written: every body was three 1024 maps,
 * 16MB a head, and 48MB meant three students. The note above the
 * constant says so in as many words.
 *
 * Capping textures at 1024 took a body to 5.33MB. The constant did not
 * move, so the same 48MB now admits NINE. The ceiling still holds — it
 * has never been breached — but what it permits behind that ceiling has
 * tripled, and nothing measures THAT.
 *
 * So this runs the campus at several ceilings and reports what each one
 * costs, in the two quantities that do not depend on which machine the
 * probe runs on: draw calls and triangles. Frame rate here is a fact
 * about a software rasterizer and is deliberately not the verdict.
 */
import { serve, launch, open } from "./_harness.mjs";

const SECONDS = Number(process.argv[2] || 150);
const CAPS = process.argv.slice(3).map(Number).filter(Boolean);
const MBS = CAPS.length ? CAPS : [16, 32, 48];

const { origin, close } = await serve();
const browser = await launch();

console.log(`\n  Each ceiling, ${SECONDS}s on the quad, peak of every number.\n`);
console.log("  ceiling   bodies   draws    triangles   per body");
console.log("  " + "─".repeat(58));
const rows = [];
for (const mb of MBS){
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${origin}/index.html?vrammb=${mb}&crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && (window.__students || []).length,
                             null, { timeout: 240_000 });
  /* Sampled rather than read once: the crowd ramps, students go inside
     and come back, and the number this ceiling is judged on is the WORST
     moment it allows — not whichever moment the probe happened to ask. */
  const peak = await page.evaluate(async (secs) => {
    let bodies = 0, draws = 0, tris = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < secs * 1000){
      const drawn = new Set();
      for (const s of (window.__students || [])){
        if (s.inside || !s.g || !s.g.visible) continue;
        const f = s.g.userData && s.g.userData.figure;
        if (f) drawn.add(f);
      }
      const inf = window.__app.renderer.info;
      if (drawn.size > bodies) bodies = drawn.size;
      if (inf.render.calls > draws) draws = inf.render.calls;
      if (inf.render.triangles > tris) tris = inf.render.triangles;
      await new Promise(r => setTimeout(r, 1000));
    }
    return { bodies, draws, tris };
  }, SECONDS);
  await page.close();
  rows.push({ mb, ...peak });
  console.log(`  ${(mb + "MB").padStart(7)}   ${String(peak.bodies).padStart(6)}` +
              `   ${String(peak.draws).padStart(5)}` +
              `   ${(peak.tris / 1e6).toFixed(2).padStart(7)}M` +
              `   ${peak.bodies ? (peak.draws / peak.bodies).toFixed(0).padStart(5) : "    –"}`);
}
await browser.close(); await close();

const base = rows[0];
if (rows.length > 1 && base.bodies){
  console.log(`\n  Against ${base.mb}MB:`);
  for (const r of rows.slice(1))
    console.log(`    ${r.mb}MB draws ${(r.draws / base.draws).toFixed(2)}x, ` +
                `triangles ${(r.tris / base.tris).toFixed(2)}x, ` +
                `bodies ${(r.bodies / base.bodies).toFixed(2)}x`);
}
console.log(`\n  A ceiling is a promise about the worst moment. These are the`);
console.log(`  worst moments each one allows.\n`);
