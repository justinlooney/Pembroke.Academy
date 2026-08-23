/* Where does the close-up camera actually end up, and where is the head?
 *
 *     node tools/probe-convo-camera.mjs [figure]
 *
 * The framing fix measured the figure from its bones instead of the
 * mesh box, and the head is still cut off. Reasoning about why has been
 * wrong all day, so this measures it: the camera's position and aim, the
 * box the framing used, where the head bone actually is, and — the only
 * question that matters — where the head lands ON SCREEN once projected.
 *
 * A head above the top edge projects to y < 0 in pixels. That is a fact
 * about the picture, not an opinion about the render.
 *
 * The body is pinned by argument: the last three comparisons in this bug
 * silently compared two different bodies because the probe took whoever
 * was dealt first. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
/* The viewport is an argument now. The close-up is framed against the
 * canvas, so a desktop-shaped window and a phone-shaped one are different
 * questions, and "the head is cut off" is worth nothing until it says
 * WHICH shape it was cut off in. Phone: 412x915, what the diagnostics
 * panel reported from the device this bug was raised on. */
const VIEW = { width: +(process.argv[3] || 1100), height: +(process.argv[4] || 800) };
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: VIEW });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));

let target = null;
for (let visit = 1; visit <= 6; visit++){
  await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 240_000 });
  await page.waitForFunction(() => (window.__convo.named() || []).length > 0, null, { timeout: 240_000 });
  const cast = await page.evaluate(() => window.__convo.named()
    .map(s => ({ name: s.data?.name, body: s.g?.userData?.figure })));
  target = cast.find(c => c.body === WANT);
  if (target) break;
  console.log(`visit ${visit}: no ${WANT} in [${cast.map(c => c.body).join(", ")}]`);
}
if (!target){ console.log(`${WANT} never dealt.`); await browser.close(); await closeSrv(); process.exit(1); }

await page.waitForFunction((nm) => {
  const s = (window.__convo.named() || []).find(x => x.data?.name === nm);
  return s?.roles && (s.roles.talk || s.roles.idle) ? true : null;
}, target.name, { timeout: 180_000 }).catch(() => {});
await page.evaluate((nm) => window.__convo.open(
  window.__convo.named().find(x => x.data?.name === nm)), target.name);
await page.waitForTimeout(3000);

for (const at of ["just opened", "after 4s of drift"]){
  if (at !== "just opened") await page.waitForTimeout(4000);
  const r = await page.evaluate((view) => {
    const THREE = window.__app.THREE;
    const g = (window.__convo.named().find(s => s.g && s.g.parent &&
               s.g.parent !== window.__app.world) || {}).g;
    if (!g) return { error: "nobody in view" };
    g.updateMatrixWorld(true);
    /* the camera the close-up renders with — found by asking the scene
       the figure was reparented into, rather than assuming a name */
    /* Ask for the close-up camera rather than hunting for it. convoCam is
     * never added to convoScene, so walking the graph never found it and
     * this fell back to the campus camera — which put a whole body in 14
     * pixels and then declared the head "inside the frame". */
    const cam = window.__convo.cam && window.__convo.cam();
    if (!cam) return { error: "no close-up camera — window.__convo.cam is missing" };
    const bones = [];
    let head = null, foot = null;
    g.traverse(o => { if (!o.isBone) return;
      const p = o.getWorldPosition(new THREE.Vector3());
      bones.push(p);
      if (/head$/i.test(o.name) && !head) head = p;
      if (/leftfoot$/i.test(o.name) && !foot) foot = p; });
    const lo = Math.min(...bones.map(p => p.y)), hi = Math.max(...bones.map(p => p.y));
    const meshBox = new THREE.Box3().setFromObject(g);
    /* The TOP OF THE HEAD, not the head bone. The bone sits inside the
     * skull — on char17 at world y 37.8 while the scalp is above 45 — so
     * projecting the bone answers a different question than "is the head
     * cut off", and answered it reassuringly for as long as this probe
     * has existed.
     *
     * Box3.setFromObject does not answer it either: it reports 43.4 where
     * the skinned geometry reaches 45.7. So walk the vertices the way the
     * renderer does, applyBoneTransform then matrixWorld, and take the
     * highest one. */
    let scalp = null, skinTop = -Infinity, skinLow = Infinity;
    g.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const pos = o.geometry.attributes.position;
      const v = new THREE.Vector3();
      const step = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += step){
        v.fromBufferAttribute(pos, i);
        o.applyBoneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        if (v.y < skinLow) skinLow = v.y;
        if (v.y > skinTop){ skinTop = v.y; scalp = v.clone(); }
      }
    });
    const proj = (p) => { const v = p.clone().project(cam);
      return { x: Math.round((v.x + 1) / 2 * view.width),
               y: Math.round((1 - v.y) / 2 * view.height) }; };
    return {
      camPos: cam.position.toArray().map(n => +n.toFixed(1)),
      fov: cam.fov, aspect: +cam.aspect.toFixed(2),
      boneSpan: +(hi - lo).toFixed(1), boneLow: +lo.toFixed(1), boneHigh: +hi.toFixed(1),
      meshBoxY: [+meshBox.min.y.toFixed(1), +meshBox.max.y.toFixed(1)],
      meshBoxTall: +(meshBox.max.y - meshBox.min.y).toFixed(1),
      headWorldY: head ? +head.y.toFixed(1) : null,
      headScreen: head ? proj(head) : null,
      footScreen: foot ? proj(foot) : null,
      topOfBonesScreen: proj(new THREE.Vector3(0, hi, 0)),
      skinTall: Number.isFinite(skinTop) ? +(skinTop - skinLow).toFixed(1) : null,
      skinTopY: Number.isFinite(skinTop) ? +skinTop.toFixed(1) : null,
      scalpScreen: scalp ? proj(scalp) : null,
    };
  }, VIEW);
  if (r.error){ console.log("  " + r.error); break; }
  console.log(`\n=== ${target.body} · ${at} ===`);
  console.log(`  camera at        [${r.camPos.join(", ")}]  fov ${r.fov}  aspect ${r.aspect}`);
  console.log(`  bones span       ${r.boneSpan}  (y ${r.boneLow} .. ${r.boneHigh})`);
  console.log(`  MESH box         ${r.meshBoxTall} tall  (y ${r.meshBoxY[0]} .. ${r.meshBoxY[1]})`);
  console.log(`  head bone world  y ${r.headWorldY}`);
  console.log(`  head on screen   ${JSON.stringify(r.headScreen)}   viewport ${VIEW.width}x${VIEW.height}`);
  console.log(`  foot on screen   ${JSON.stringify(r.footScreen)}`);
  console.log(`  SKINNED body     ${r.skinTall} tall  (top of head at y ${r.skinTopY})`);
  console.log(`  top of head on screen  ${JSON.stringify(r.scalpScreen)}`);
  const hs = r.scalpScreen;
  console.log(hs && hs.y < 0
    ? `  >>> the top of the head is ${-hs.y}px ABOVE the top edge — CUT OFF.`
    : hs ? `  the whole head is in frame, ${hs.y}px below the top edge.` : "");
  console.log(`  (the head BONE lands at ${JSON.stringify(r.headScreen)} — inside the`);
  console.log(`   skull, which is why measuring it said the framing was fine)`);
}
await browser.close(); await closeSrv();
