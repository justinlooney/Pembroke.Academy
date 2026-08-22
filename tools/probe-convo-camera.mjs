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
const VIEW = { width: 1100, height: 800 };
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
    let cam = null;
    (function find(o){ if (o.isCamera && o.type === "PerspectiveCamera" && !cam &&
        o !== window.__app.camera) cam = o;
      (o.children || []).forEach(find); })(g.parent);
    cam = cam || window.__app.camera;
    const bones = [];
    let head = null, foot = null;
    g.traverse(o => { if (!o.isBone) return;
      const p = o.getWorldPosition(new THREE.Vector3());
      bones.push(p);
      if (/head$/i.test(o.name) && !head) head = p;
      if (/leftfoot$/i.test(o.name) && !foot) foot = p; });
    const lo = Math.min(...bones.map(p => p.y)), hi = Math.max(...bones.map(p => p.y));
    const meshBox = new THREE.Box3().setFromObject(g);
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
  const hs = r.headScreen;
  console.log(hs && hs.y < 0
    ? `  >>> the head is ${-hs.y}px ABOVE the top edge — cut off.`
    : hs ? `  head is inside the frame, ${hs.y}px down from the top.` : "");
}
await browser.close(); await closeSrv();
