/* How many clips is one figure playing at once?
 *
 *     node tools/probe-action-weights.mjs
 *
 * Found by accident: controlling the twist probe for blending reported
 * "6 OTHER action(s) were live". Six clips on one body at once — a walk,
 * a jog, a talk, a sit — blend into a pose whose joints are each
 * plausible and whose shape is not. That fits every fact this bug has:
 * every clip, every body, walking and talking alike, mesh crumpled,
 * joint angles fine, skinning and inverse binds sound, and the
 * retarget's own arithmetic correct to 3-6 degrees.
 *
 * Nothing is stopped or zeroed here. This is the campus as a visitor
 * gets it. */
import { serve, launch } from "./_harness.mjs";
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction(() => (window.__students || [])
  .some(s => s.g?.userData?.anim?.actions &&
             Object.keys(s.g.userData.anim.actions).length >= 3) ? true : null,
  null, { timeout: 300_000 }).catch(() => {});

for (const wait of [0, 15000, 30000]){
  if (wait) await page.waitForTimeout(wait);
  const rows = await page.evaluate(() => (window.__students || []).map(s => {
    const a = s.g?.userData?.anim;
    if (!a || !a.actions) return null;
    const live = Object.entries(a.actions)
      .map(([n, act]) => ({ n, w: +act.getEffectiveWeight().toFixed(3),
                            run: act.isRunning(), paused: act.paused }))
      /* RUNNING is what counts. A stopped action keeps whatever
         _effectiveWeight it last held, and getEffectiveWeight() reports
         it, but the mixer does not consult a stopped action at all — it
         contributes nothing to the pose. Filtering on weight counted
         five stopped clips as live and turned an ordinary crossfade
         into a six-way blend that was not happening. */
      .filter(x => x.run && x.w > 0.001);
    return { who: s.data?.name || "(crowd)", body: s.g?.userData?.figure,
             mode: s.mode, held: s.held, current: a.current,
             total: Object.keys(a.actions).length, live };
  }).filter(Boolean));

  console.log(`\n=== ${wait ? `after ${wait / 1000}s` : "as soon as clips exist"} ===`);
  for (const r of rows){
    const sum = r.live.reduce((t, x) => t + x.w, 0);
    const flag = r.live.length > 1 ? "  <<< more than one" : "";
    console.log(`  ${(r.who || "").padEnd(16)} ${String(r.body).padEnd(8)} mode ${String(r.mode).padEnd(9)}` +
                ` current ${String(r.current).padEnd(16)} live ${r.live.length}/${r.total}` +
                ` weight sum ${sum.toFixed(2)}${flag}`);
    if (r.live.length > 1)
      for (const x of r.live)
        console.log(`        ${x.n.padEnd(18)} weight ${String(x.w).padStart(6)}` +
                    `  running ${x.run}  paused ${x.paused}`);
  }
  const many = rows.filter(r => r.live.length > 1);
  console.log(`\n  ${many.length} of ${rows.length} figures are playing more than one clip.`);
  if (many.length){
    const worst = Math.max(...many.map(r => r.live.length));
    console.log(`  worst: ${worst} at once. three.js blends these by weight, so the figure`);
    console.log(`  holds none of the poses — it holds their average, which is a shape no`);
    console.log(`  clip describes and no body could hold.`);
  } else {
    console.log(`  Every figure holds exactly one clip. Blending is NOT the fault.`);
  }
}
await browser.close(); await closeSrv();
