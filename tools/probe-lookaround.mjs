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

/* into walk mode, where looking about is what a visitor does */
await page.evaluate(() => document.getElementById("walkbtn")?.click());
await page.waitForTimeout(4000);

console.log(`\n  Turning on the spot, ${STEPS} steps through 360 degrees.\n`);
console.log("   yaw    draws   triangles   visible/total   background");
console.log("  " + "─".repeat(60));

/* THROUGH THE PAGE, not the element. locator.screenshot() waits for the
   element to be "stable" before it fires, and a canvas that is being
   animated is never stable — the first attempt at this probe timed out
   after twenty seconds without printing a single row. A page screenshot
   is a CDP capture of the viewport, which in walk mode IS the canvas,
   and is closer to what the visitor actually sees anyway. */
const measure = async (yaw) => {
  await page.evaluate(async (y) => {
    if (window.__walker) window.__walker.h = y;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, yaw);
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
  const png = await page.screenshot({ type: "png" });
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
  return { yaw: Math.round(yaw * 180 / Math.PI), ...inf, black };
};

const rows = [];
for (let i = 0; i < STEPS; i++){
  const r = await measure((i / STEPS) * Math.PI * 2);
  rows.push(r);
  console.log(`  ${String(r.yaw).padStart(4)}°  ${String(r.draws).padStart(6)}` +
              `   ${(r.tris / 1e6).toFixed(2).padStart(7)}M` +
              `   ${String(r.visible).padStart(5)}/${String(r.total).padEnd(6)}` +
              `   ${r.black.toFixed(1).padStart(6)}%` +
              (r.black > 40 ? "   <-- BLACK" : "") +
              (r.gone.length ? "   culled: " + r.gone.join(", ") : ""));
}

const worst = rows.reduce((a, b) => (b.black > a.black ? b : a), rows[0]);
const best  = rows.reduce((a, b) => (b.black < a.black ? b : a), rows[0]);
console.log(`\n  darkest ${worst.black.toFixed(1)}% at ${worst.yaw}° ` +
            `(${worst.draws} draws, ${worst.visible}/${worst.total} in frustum)`);
console.log(`  clearest ${best.black.toFixed(1)}% at ${best.yaw}° ` +
            `(${best.draws} draws, ${best.visible}/${best.total} in frustum)`);
console.log(worst.black - best.black > 25
  ? `\n  THE PICTURE DEPENDS ON WHICH WAY YOU FACE by ${(worst.black - best.black).toFixed(0)} points.\n`
  : `\n  No direction went dark. The turn is not what empties the screen.\n`);
await browser.close(); await close();
