/* Does the figure face you when a conversation opens?
 *
 *     node tools/probe-convo-facing.mjs [figure]
 *
 * Reported from a phone: "when starting conversation they should be
 * facing toward you". Marcus arrives in profile.
 *
 * convoOpen turns the body by measuring its own feet — "toes are
 * forward of ankles on every humanoid ever rigged, so the ankle-to-toe
 * vector IS the facing" — averaging both feet so a relaxed splay
 * cancels. Then g.rotation.y = -face.
 *
 * This measures the result rather than the intent: the angle between
 * where the chest actually points and the direction of the camera. 0 is
 * facing you; 90 is profile; 180 is their back. It also reports what
 * the feet say separately, so a wrong measurement can be told apart
 * from a wrong rotation applied to a right one. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || null;
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));

const rows = [];
for (let visit = 1; visit <= (WANT ? 6 : 3); visit++){
  await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 240_000 });
  await page.waitForFunction(() => (window.__convo.named() || []).length > 0,
                             null, { timeout: 240_000 }).catch(() => {});
  const cast = await page.evaluate(() => window.__convo.named()
    .map(s => ({ name: s.data?.name, body: s.g?.userData?.figure })));
  const targets = WANT ? cast.filter(c => c.body === WANT) : cast;
  if (!targets.length) continue;

  for (const t of targets){
    const r = await page.evaluate((nm) => {
      const THREE = window.__app.THREE;
      const s = window.__convo.named().find(x => x.data?.name === nm);
      if (!s) return null;
      window.__convo.open(s);
      return new Promise(res => setTimeout(() => {
        const g = s.g; g.updateMatrixWorld(true);
        /* the close-up camera sits on +Z looking at the origin, so the
           direction from figure to camera is what "toward you" means */
        let cam = null;
        (function find(o){ if (o.isCamera && o !== window.__app.camera && !cam) cam = o;
          (o.children || []).forEach(find); })(g.parent || {});
        /* The aliases matter, and their absence is why the first run of
           this printed a null chest for every figure and then concluded
           "all 9 face the camera": null > 40 is false, so every
           unmeasured row counted as a pass. This rig names them
           LeftClavicle and LeftUpperArm, not LeftShoulder and LeftArm. */
        const key = (n) => { let x = (n||"").split("|").pop().split(":").pop();
          x = x.replace(/^mixamorig\d*/i,"").replace(/[._]\d+$/,"")
               .replace(/[^a-z0-9]/gi,"").toLowerCase();
          return ({ leftclavicle: "leftshoulder", rightclavicle: "rightshoulder",
                    leftupperarm: "leftarm", rightupperarm: "rightarm",
                    lefttoe: "lefttoebase", righttoe: "righttoebase",
                    pelvis: "hips" })[x] || x; };
        const B = new Map();
        g.traverse(o => { if (o.isBone){ const k = key(o.name); if (!B.has(k)) B.set(k, o); } });
        const P = (k) => { const b = B.get(k); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
        /* chest facing: across the shoulders, rotated 90 in the ground
           plane — independent of the feet, which is the point */
        const ls = P("leftshoulder") || P("leftarm"), rs = P("rightshoulder") || P("rightarm");
        let chest = null;
        if (ls && rs){
          const across = ls.clone().sub(rs); across.y = 0; across.normalize();
          chest = new THREE.Vector3(-across.z, 0, across.x);      /* perpendicular */
        }
        const foot = (side) => {
          const a = P(side + "foot"), t = P(side + "toebase") || P(side + "toe");
          if (!a || !t) return null;
          const v = t.clone().sub(a); v.y = 0;
          return v.lengthSq() > 1e-9 ? v.normalize() : null;
        };
        const fl = foot("left"), fr = foot("right");
        const feet = (fl && fr) ? fl.clone().add(fr).normalize() : (fl || fr);
        const toCam = cam
          ? cam.getWorldPosition(new THREE.Vector3()).sub(g.getWorldPosition(new THREE.Vector3()))
          : new THREE.Vector3(0, 0, 1);
        toCam.y = 0; toCam.normalize();
        const deg = (v) => v ? +(Math.acos(Math.max(-1, Math.min(1, v.dot(toCam)))) * 180 / Math.PI).toFixed(1) : null;
        window.__convo.close();
        res({ chestOff: deg(chest), feetOff: deg(feet), rotY: +(g.rotation.y * 180 / Math.PI).toFixed(1) });
      }, 2500));
    }, t.name);
    if (r) rows.push({ ...t, ...r });
  }
  if (WANT && rows.length) break;
}

console.log(`\n  who              body     chest off   feet off   rotation.y`);
for (const r of rows)
  console.log(`  ${String(r.name).padEnd(16)} ${String(r.body).padEnd(8)} ` +
              `${String(r.chestOff).padStart(9)}   ${String(r.feetOff).padStart(8)}   ${String(r.rotY).padStart(8)}` +
              (r.chestOff != null && r.chestOff > 40 ? "   <<< not facing you" : ""));
const measured = rows.filter(r => r.chestOff != null);
const bad = measured.filter(r => r.chestOff > 40);
console.log(`\n  0 = facing you, 90 = profile, 180 = their back.`);
if (!rows.length) console.log(`  nothing measured.`);
else if (!measured.length)
  console.log(`  NO CHEST WAS MEASURED on any of ${rows.length} rows — no verdict.`
            + `\n  A row that could not be read is not a row that passed.`);
else {
  if (measured.length < rows.length)
    console.log(`  ${rows.length - measured.length} of ${rows.length} rows had no chest reading,`
              + ` excluded rather than counted as passes.`);
  console.log(bad.length
    ? `  ${bad.length} of ${measured.length} do not face the camera when the conversation opens.`
    : `  all ${measured.length} measured figures face the camera.`);
}
await browser.close(); await closeSrv();
