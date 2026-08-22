/* Why do campus figures stop animating on a phone-shaped viewport?
 *
 *     node tools/probe-detail-freeze.mjs [--mobile]
 *
 * Measured: the same body on the same clip swings its arms 1.2
 * body-lengths on desktop and 0.000 on a 412x915 viewport at DPR 2.6.
 * Frozen mid-stride, one arm forward and one back, held indefinitely —
 * which is what "arms pulled behind the back" looks like when a walk
 * cycle stops at one instant.
 *
 * detailPass() decides a skeleton is not worth stepping when a figure
 * is too small to read. That judgement is about APPARENT size, which
 * depends on viewport height and field of view — so a narrow, tall
 * phone viewport can put plainly visible people the wrong side of it.
 *
 * This reports, per figure: whether its mixer is being stepped, how far
 * away it is, and how tall it actually appears in pixels. A figure
 * frozen while covering a large part of the screen is the fault. */
import { serve, launch } from "./_harness.mjs";
const MOBILE = process.argv.includes("--mobile");
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage(MOBILE
  ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko)"
        + " Chrome/141.0.0.0 Mobile Safari/537.36" }
  : { viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction(() => (window.__students || [])
  .some(s => s.g?.userData?.anim?.current) ? true : null, null, { timeout: 300_000 }).catch(() => {});
await page.waitForTimeout(6000);

const out = await page.evaluate(() => {
  const THREE = window.__app.THREE;
  const cam = window.__app.camera;
  const h = window.innerHeight;
  return (window.__students || []).map(s => {
    const g = s.g; if (!g) return null;
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const tall = box.max.y - box.min.y;
    const c = box.getCenter(new THREE.Vector3());
    const dist = cam.position.distanceTo(c);
    /* how many pixels of screen height this figure covers */
    const vFov = cam.fov * Math.PI / 180;
    const px = Math.round(tall / (2 * dist * Math.tan(vFov / 2)) * h);
    return { body: g.userData?.figure, who: s.data?.name || "(crowd)",
             animate: g.userData?.animate, held: s.held, mode: s.mode,
             clip: g.userData?.anim?.current || null,
             dist: Math.round(dist), px, visible: g.visible };
  }).filter(Boolean);
});

console.log(`\n${MOBILE ? "MOBILE 412x915 @2.6" : "desktop 1100x800 @1"}` +
            `   fov-corrected apparent height in screen pixels\n`);
console.log("  body     who               animate  held   clip              dist    px tall");
for (const r of out)
  console.log(`  ${String(r.body).padEnd(8)} ${String(r.who).padEnd(17)} ` +
              `${String(r.animate).padEnd(8)} ${String(r.held).padEnd(6)} ` +
              `${String(r.clip).padEnd(17)} ${String(r.dist).padStart(5)} ${String(r.px).padStart(6)}`);
const frozen = out.filter(r => r.animate === false && r.visible);
console.log(`\n  ${frozen.length} of ${out.length} visible figures have animate === false.`);
if (frozen.length){
  const biggest = Math.max(...frozen.map(r => r.px));
  console.log(`  The largest frozen figure covers ${biggest}px of screen height` +
              ` (viewport is ${MOBILE ? 915 : 800}px).`);
  console.log(biggest > 60
    ? `  A figure that tall is plainly visible. Freezing it is the fault: the walk\n` +
      `  stops mid-stride and holds one arm forward and one behind, indefinitely.`
    : `  All frozen figures are small enough that freezing them is defensible.`);
}
await browser.close(); await closeSrv();
