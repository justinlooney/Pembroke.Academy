/* Do the shoulders narrow when the body animates? Watched, not driven.
 *
 *     node tools/probe-shoulders.mjs [figure] [seconds] [--convo] [--mobile]
 *
 * Reported from a phone: "his shoulders are too narrow, the arms sit at a
 * bad angle, the shirt looks collapsed". probe-asset-skin rules the
 * skinning out for that body — char5 deforms less than most of the cast —
 * so if the shoulders still read wrong, the bones are in the wrong place
 * and it is the POSE, not the skin.
 *
 * Width is the world distance between the two upper-arm joints, over the
 * body's height, so it is a scale-free number that can be compared
 * between a rest pose and a live one, and between bodies of different
 * sizes. Rest is measured from skeleton.pose(), which is the shape the
 * mesh was actually bound in.
 *
 * A body whose shoulders sit at rest width while it animates is fine.
 * One that narrows several percent every frame is collapsing them, and
 * that is the reported fault stated as a number.
 *
 * Driving the clock has failed in this codebase three separate ways, so
 * this samples the live pose and touches nothing. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const SECS = +(process.argv[3] || 12);
const CONVO = process.argv.includes("--convo");
const MOBILE = process.argv.includes("--mobile");

const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage(MOBILE
  ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true }
  : { viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction((w) => (window.__students || [])
  .some(s => s.g?.userData?.figure === w && s.g?.userData?.anim?.current) ? true : null,
  WANT, { timeout: 240_000 }).catch(() => {});

if (CONVO){
  await page.waitForFunction(() => (window.__convo?.named() || []).length > 0,
                             null, { timeout: 120_000 }).catch(() => {});
  await page.evaluate((w) => {
    const s = (window.__convo.named() || []).find(x => x.g?.userData?.figure === w);
    if (s) window.__convo.open(s);
  }, WANT);
  await page.waitForTimeout(2500);
}

const setup = await page.evaluate((want) => {
  const THREE = window.__app.THREE;
  const s = (window.__students || []).find(x => x.g?.userData?.figure === want);
  if (!s) return { err: `${want} is not out today` };
  let m = null;
  s.g.traverse(o => { if (!m && o.isSkinnedMesh) m = o; });
  if (!m) return { err: "no SkinnedMesh" };
  const find = (re) => m.skeleton.bones.find(b => re.test((b.name || "").toLowerCase()));
  const L = find(/^(?!.*fore).*left.*(upperarm|arm)/),
        R = find(/^(?!.*fore).*right.*(upperarm|arm)/),
        head = find(/head/), foot = find(/left.*foot/);
  if (!L || !R) return { err: "no upper arm bones" };
  window.__sh = () => {
    const a = new THREE.Vector3(), b = new THREE.Vector3(),
          h = new THREE.Vector3(), f = new THREE.Vector3();
    s.g.updateMatrixWorld(true);
    L.getWorldPosition(a); R.getWorldPosition(b);
    (head || L).getWorldPosition(h); (foot || R).getWorldPosition(f);
    const tall = Math.abs(h.y - f.y) || 1;
    return { w: +(a.distanceTo(b) / tall).toFixed(4),
             clip: s.g.userData.anim?.current || null };
  };
  /* rest is the pose the mesh was bound in, restored afterwards */
  const live = window.__sh();
  const keep = m.skeleton.bones.map(b => b.quaternion.clone());
  m.skeleton.pose();
  const rest = window.__sh();
  m.skeleton.bones.forEach((b, i) => b.quaternion.copy(keep[i]));
  s.g.updateMatrixWorld(true);
  return { rest: rest.w, first: live.w, bones: m.skeleton.bones.length,
           left: L.name, right: R.name };
}, WANT);

if (setup.err){ console.log("  " + setup.err); await browser.close(); await closeSrv(); process.exit(1); }

const rows = [];
for (let i = 0; i < SECS; i++){
  rows.push(await page.evaluate(() => window.__sh()));
  await page.waitForTimeout(1000);
}
const ws = rows.map(r => r.w);
const lo = Math.min(...ws), hi = Math.max(...ws);
const mean = ws.reduce((a, b) => a + b, 0) / ws.length;

console.log(`\n${WANT} — shoulder width as a fraction of height` +
            (CONVO ? "  · close-up held open" : "  · campus") +
            (MOBILE ? "  · MOBILE 412x915" : ""));
console.log(`  joints ${setup.left} .. ${setup.right}\n`);
console.log(`  at REST (the pose the mesh was bound in):  ${setup.rest}`);
console.log(`  live:  min ${lo.toFixed(4)}  max ${hi.toFixed(4)}  mean ${mean.toFixed(4)}`);
console.log(`  clips seen: ${[...new Set(rows.map(r => r.clip))].join(", ")}`);
const drop = (1 - mean / setup.rest) * 100;
console.log(`\n  live width is ${drop >= 0 ? drop.toFixed(1) + "% NARROWER" :
             (-drop).toFixed(1) + "% wider"} than the bound pose.`);
console.log(Math.abs(drop) < 3
  ? `  The shoulders hold their bound width. Whatever reads as narrow is\n` +
    `  not the skeleton pulling them in.`
  : `  The shoulders do not hold their bound width — the bones are moving\n` +
    `  them, so this is a POSE fault and not the mesh or the weights.`);
await browser.close(); await closeSrv();
