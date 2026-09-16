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
/* REPEAT=3 runs each ceiling three times. The campus is random enough
   that a single visit per ceiling is a sample of one, and the first
   version of this printed ratios off exactly that. */
const REPEAT = Math.max(1, Number(process.env.REPEAT || 1));

const { origin, close } = await serve();
const browser = await launch();

console.log(`\n  Each ceiling, ${SECONDS}s on the quad, peak of every number.\n`);
console.log("  ceiling   bodies   draws    triangles   frames");
console.log("  " + "─".repeat(58));
const rows = [];
for (const mb of [].concat(...Array.from({ length: REPEAT }, () => MBS)).sort((a, b) => a - b)){
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${origin}/index.html?vrammb=${mb}&crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && (window.__students || []).length,
                             null, { timeout: 240_000 });
  /* PER FRAME, and the three numbers taken TOGETHER.
     This sampled at 1Hz and kept the maximum of each number
     independently, which is two mistakes review caught in one line. A
     transient worst frame between two samples was never seen at all; and
     "draws per body" divided a peak draw count by a peak body count that
     could come from a different second entirely, in a different crowd
     state — a ratio of two things that never co-existed.
     So: hook the frame, and when a frame is the worst one yet BY DRAWS,
     record what the other two numbers were AT THAT MOMENT. A worst
     moment is a moment, not a collection of records. */
  const peak = await page.evaluate(async (secs) => {
    const drawnNow = () => {
      const d = new Set();
      for (const s of (window.__students || [])){
        if (s.inside || !s.g || !s.g.visible) continue;
        const f = s.g.userData && s.g.userData.figure;
        if (f) d.add(f);
      }
      return d.size;
    };
    let worst = { bodies: 0, draws: -1, tris: 0 }, frames = 0;
    const t0 = performance.now();
    await new Promise(done => {
      const tick = () => {
        const inf = window.__app.renderer.info.render;
        frames++;
        if (inf.calls > worst.draws)
          worst = { bodies: drawnNow(), draws: inf.calls, tris: inf.triangles };
        if (performance.now() - t0 >= secs * 1000) return done();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { ...worst, frames };
  }, SECONDS);
  await page.close();
  rows.push({ mb, ...peak });
  console.log(`  ${(mb + "MB").padStart(7)}   ${String(peak.bodies).padStart(6)}` +
              `   ${String(peak.draws).padStart(5)}` +
              `   ${(peak.tris / 1e6).toFixed(2).padStart(7)}M` +
              `   ${String(peak.frames).padStart(6)}`);
}
await browser.close(); await close();

/* NO RATIO TABLE. One visit per ceiling cannot support one: the campus
   randomises the cast order, the visit seed, the waypoints and who goes
   indoors when, so two runs at the SAME ceiling differ by more than the
   ceilings do — which is itself the finding, and the one thing a ratio
   column would hide behind a number that looks causal. Review said the
   same thing about the version that printed it.
   Run each ceiling several times with REPEAT= and read the spread. If
   the spreads overlap, the ceiling is not what moves these numbers. */
const byCap = new Map();
for (const r of rows) (byCap.get(r.mb) || byCap.set(r.mb, []).get(r.mb)).push(r);
if ([...byCap.values()].some(v => v.length > 1)){
  console.log(`\n  spread over ${[...byCap.values()][0].length} run(s) each:`);
  for (const [mb, rs] of byCap){
    const d = rs.map(r => r.draws);
    console.log(`    ${String(mb).padStart(3)}MB draws ${Math.min(...d)}-${Math.max(...d)}` +
                `   bodies ${Math.min(...rs.map(r => r.bodies))}-${Math.max(...rs.map(r => r.bodies))}`);
  }
}
console.log(`\n  A ceiling is a promise about the worst moment. These are the`);
console.log(`  worst moments each one allowed, one visit each unless REPEAT= says`);
console.log(`  otherwise — and one visit each is not a controlled comparison.\n`);
