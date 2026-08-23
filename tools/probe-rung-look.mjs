/* What does a figure look like with the quality ladder at the bottom?
 *
 *     node tools/probe-rung-look.mjs [figure]
 *
 * A phone panel reported: quality rung 5/5, ladder "nothing left to
 * give up", dpr 0.75, no shadows, on an Adreno. Every render made in
 * this investigation has been at FULL quality — SSAO on, bloom on,
 * shadows on, dpr 1. The opposite end of the ladder.
 *
 * The five rungs are all fill rate and post: SSAO, pixel ratio, shadow
 * map size, shadows off, bloom off. None of them touch skinning, so the
 * ladder cannot deform a body. But rung 0 removes SSAO and rung 3 turns
 * shadows off, and those two are what carve a deltoid out of a shoulder
 * and put a waist in a shirt. A white tee with neither is a flat
 * silhouette.
 *
 * So: the same close-up, twice — full quality, then every rung shed —
 * to see whether "shoulders and midsection look off" is geometry or
 * shading. */
import { serve, launch } from "./_harness.mjs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const OUT = resolve(new URL("..", import.meta.url).pathname, ".shots");
const WANT = process.argv[2] || null;
await mkdir(OUT, { recursive: true });
const { origin, close: closeSrv } = await serve();
const browser = await launch();

for (const shed of [false, true]){
  const page = await browser.newPage({ viewport: { width: 412, height: 915 },
                                       deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
  await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 240_000 });
  await page.waitForFunction(() => (window.__convo.named() || []).length > 0,
                             null, { timeout: 240_000 }).catch(() => {});
  const who = await page.evaluate((w) => {
    const named = window.__convo.named();
    const s = (w && named.find(x => x.g?.userData?.figure === w)) || named[0];
    if (!s) return null;
    window.__convo.open(s);
    return { n: s.data?.name, b: s.g?.userData?.figure };
  }, WANT);
  await page.waitForTimeout(2500);
  /* drive the ladder all the way down, as the phone did */
  const rung = await page.evaluate((doShed) => {
    if (!doShed) return window.__rung ? window.__rung() : null;
    let r = null;
    for (let i = 0; i < 8; i++){ const o = window.__shedRung(); r = o; if (o.done) break; }
    return r;
  }, shed);
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => {
    const p = window.__preset ? window.__preset() : {};
    return { rung: p.rung, ssao: p.ssao, bloom: p.bloom, dpr: p.dpr,
             shadows: window.__app.renderer.shadowMap.enabled };
  });
  const name = shed ? "rung-bottom" : "rung-full";
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120_000 });
  console.log(`  ${name.padEnd(12)} ${who ? who.n + " (" + who.b + ")" : "?"}` +
              `  rung ${state.rung}  ssao ${state.ssao}  bloom ${state.bloom}` +
              `  shadows ${state.shadows}  dpr ${state.dpr}`);
  await page.close();
}
console.log("\n  wrote .shots/rung-full.png and .shots/rung-bottom.png");
console.log("  Same body, same view, one variable: how much of the shading is left.");
await browser.close(); await closeSrv();
