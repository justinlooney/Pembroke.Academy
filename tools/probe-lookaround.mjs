#!/usr/bin/env node
/**
 * Pembroke Academy — does the campus survive being looked at sideways?
 *
 *     node tools/probe-lookaround.mjs
 *
 * Reported from a phone: "intermittent black on screen... it happens
 * when I look left and right." That correlation is the whole diagnosis
 * and it rules out most of what a black screen usually is. A lost GL
 * context does not care which way you are facing. Memory pressure does
 * not arrive on a turn and leave on the way back.
 *
 * Something that depends on the camera's DIRECTION does, and in a
 * three.js scene there is one mechanism with that shape: frustum
 * culling. Every object is tested as a bounding sphere against the six
 * planes of the view, and an object whose sphere is wrong vanishes at
 * exactly the angles where the wrong sphere leaves the frustum. The
 * photograph agrees: campus drawn in a strip, black beside it, and the
 * HUD compositing perfectly over the black because the HUD is DOM.
 *
 * So: stand on the quad, turn all the way round, and at every step
 * count what is actually being drawn and how much of the picture is
 * background. A body that culls wrongly costs one draw. The GROUND
 * culling wrongly is a black screen.
 */
import { serve, launch } from "./_harness.mjs";

const STEPS = Number(process.argv[2] || 24);
const { origin, close } = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=6`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && (window.__students || []).length,
                           null, { timeout: 240_000 });
await page.waitForTimeout(20_000);

/* ── DAYLIGHT, ASSERTED, BECAUSE THIS PROBE ALREADY LIED ONCE ────────
   The first run of this reported a 63-point swing in "background" and
   named four headings BLACK. It was measuring the NIGHT SKY. The campus
   follows the visitor's wall clock, the probe ran at 23:00, and looking
   across an open quad at midnight is dark for the best of reasons.
   Every draw count and frustum count in that run was identical between
   the "black" headings and the clear ones, which should have been the
   tell and instead read as "drawn but invisible".

   So the sky is now a controlled variable rather than whatever hour the
   probe happens to run at. The mode cycles on `n` and the control names
   itself in its own title; press until it says day, and refuse to
   report anything if it never gets there. A dark reading at night is
   not a finding, and a probe that cannot tell the two apart is worse
   than no probe. */
const modeIs = (want) => page.evaluate((w) =>
  new RegExp("Time of day: " + w + "\\b").test(
    document.getElementById("daynight")?.title || ""), want);
for (let i = 0; i < 8 && !(await modeIs("day")); i++){
  await page.keyboard.press("n");
  await page.waitForTimeout(700);
}
if (!await modeIs("day")){
  console.log("\n  could not reach DAY — refusing to measure darkness at night\n");
  await browser.close(); await close(); process.exit(1);
}
/* NOT best-effort. Swallowing this timeout would let the probe run on
   with the control claiming day and the render still night — which is
   exactly the failure that produced the last false reproduction, now
   dressed as a passing assertion. The title and window.__visual are two
   different claims; both have to hold. */
try {
  await page.waitForFunction(() => window.__visual === "day", null, { timeout: 30_000 });
} catch {
  console.log("\n  control says day, the render never agreed — refusing to measure\n");
  await browser.close(); await close(); process.exit(1);
}
const sky = await page.evaluate(() => window.__visual);

/* into walk mode, where looking about is what a visitor does */
await page.evaluate(() => document.getElementById("walkbtn")?.click());
await page.waitForTimeout(4000);
console.log(`\n  sky: ${sky}`);

console.log(`\n  Turning on the spot, ${STEPS} steps through 360 degrees.\n`);
console.log("   yaw    draws   triangles   visible/total   background");
console.log("  " + "─".repeat(60));

/* THROUGH THE PAGE, not the element. locator.screenshot() waits for the
   element to be "stable" before it fires, and a canvas that is being
   animated is never stable — the first attempt at this probe timed out
   after twenty seconds without printing a single row. A page screenshot
   is a CDP capture of the viewport, which in walk mode IS the canvas,
   and is closer to what the visitor actually sees anyway. */
/* DEGREES. walker.h is consumed as degrees — `const hr = walker.h *
   Math.PI / 180` in the walk step, and again in the minimap — and the
   first version of this set it in radians off a 0..2π loop. So the
   advertised 360-degree sweep turned the camera through 6.28 DEGREES,
   every row measured the same heading, and the differences between rows
   were whatever changed on its own while the probe stood still.
   Caught in review. It is the second way this probe lied about the same
   measurement, after photographing the night sky. */
const measure = async (deg) => {
  await page.evaluate(async (d) => {
    if (window.__walker) window.__walker.h = d;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, deg);
  await page.waitForTimeout(220);
  const inf = await page.evaluate(() => {
    const app = window.__app, THREE = app.THREE;
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        app.camera.projectionMatrix, app.camera.matrixWorldInverse));
    let total = 0, visible = 0; const gone = [];
    app.world.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      total++;
      if (!o.frustumCulled){ visible++; return; }
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const s = (o.boundingSphere || o.geometry.boundingSphere).clone();
      s.applyMatrix4(o.matrixWorld);
      if (frustum.intersectsSphere(s)) visible++;
      else if (o.geometry.boundingSphere.radius > 300) gone.push(o.name || "(unnamed)");
    });
    const r = app.renderer.info.render;
    return { draws: r.calls, tris: r.triangles, visible, total, gone: [...new Set(gone)].slice(0, 4) };
  });
  /* THE PICTURE IS THE OPTIONAL PART. A screenshot on a software
     rasterizer under load times out sometimes — it has now killed this
     probe twice, both times on a late step, both times discarding every
     row already collected. The frustum and draw numbers are the part
     that cannot be got any other way; the black percentage is
     corroboration. So a failed capture costs THAT ROW its percentage
     and nothing else. */
  let png = null;
  try { png = await page.screenshot({ type: "png", timeout: 45_000 }); }
  catch { return { yaw: Math.round(deg), ...inf, black: null }; }
  const black = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise(ok => { img.onload = ok; img.src = "data:image/png;base64," + b64; });
    const c = document.createElement("canvas");
    c.width = 300; c.height = 200;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] < 14 && d[i + 1] < 14 && d[i + 2] < 14) dark++;
    return dark / (d.length / 4) * 100;
  }, png.toString("base64"));
  return { yaw: Math.round(deg), ...inf, black };
};

const rows = [];
for (let i = 0; i < STEPS; i++){
  const r = await measure((i / STEPS) * 360);
  rows.push(r);
  console.log(`  ${String(r.yaw).padStart(4)}°  ${String(r.draws).padStart(6)}` +
              `   ${(r.tris / 1e6).toFixed(2).padStart(7)}M` +
              `   ${String(r.visible).padStart(5)}/${String(r.total).padEnd(6)}` +
              `   ${r.black === null ? "     ?" : r.black.toFixed(1).padStart(6)}%` +
              (r.black !== null && r.black > 40 ? "   <-- BLACK" : "") +
              (r.gone.length ? "   culled: " + r.gone.join(", ") : ""));
}

const shot = rows.filter(r => r.black !== null);
if (!shot.length){
  console.log(`\n  no heading was photographed — frustum numbers above stand alone\n`);
  await browser.close(); await close(); process.exit(0);
}
if (shot.length < rows.length)
  console.log(`\n  ${rows.length - shot.length} of ${rows.length} heading(s) went unphotographed` +
              ` — the verdict below covers the rest`);
const worst = shot.reduce((a, b) => (b.black > a.black ? b : a), shot[0]);
const best  = shot.reduce((a, b) => (b.black < a.black ? b : a), shot[0]);
console.log(`\n  darkest ${worst.black.toFixed(1)}% at ${worst.yaw}° ` +
            `(${worst.draws} draws, ${worst.visible}/${worst.total} in frustum)`);
console.log(`  clearest ${best.black.toFixed(1)}% at ${best.yaw}° ` +
            `(${best.draws} draws, ${best.visible}/${best.total} in frustum)`);
console.log(worst.black - best.black > 25
  ? `\n  THE PICTURE DEPENDS ON WHICH WAY YOU FACE by ${(worst.black - best.black).toFixed(0)} points.\n`
  : `\n  No direction went dark. The turn is not what empties the screen.\n`);
await browser.close(); await close();
