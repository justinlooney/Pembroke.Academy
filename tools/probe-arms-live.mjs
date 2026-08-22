/* Are the arms behind the back? Watched, not driven.
 *
 *     node tools/probe-arms-live.mjs [figure] [seconds]
 *
 * Three attempts to drive the receiver's mixer by hand all failed, in
 * three different ways — paused actions ignoring setTime, setTime
 * zeroing the assignment, and the clock simply not advancing. Each
 * produced numbers that looked like measurements.
 *
 * The campus already animates these figures. So this touches nothing:
 * it samples the live pose over several seconds and asks the one
 * question that was reported — do the hands ever come forward of the
 * shoulder line, or do they stay behind it?
 *
 * Forward is the ankle-to-toe vector, this codebase's own rule. A
 * person carries their hands ahead of the shoulders most of the time;
 * hands that are ALWAYS behind, across seconds of live animation, is
 * the reported fault stated as a number. And if the pose never changes
 * at all, that is reported too, because a still figure cannot answer
 * the question either. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const SECS = +(process.argv[3] || 12);
/* --mobile reproduces the device the fault was reported from: a narrow
   viewport at a real pixel ratio, which is also what makes the quality
   ladder shed rungs. Every render in this investigation until now was
   desktop at DPR 1, so a fault living on the mobile path could not have
   been seen. --convo holds the close-up open instead of watching the
   campus, because the reported screenshots were all conversations and
   the one Talking sample taken so far sat behind the shoulder line
   while every walking sample swung freely. */
const MOBILE = process.argv.includes("--mobile");
const CONVO  = process.argv.includes("--convo");
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage(MOBILE
  ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true,
      hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36" +
        " (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36" }
  : { viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction((w) => {
  const s = (window.__students || []).find(x => x.g?.userData?.figure === w);
  return s?.g?.userData?.anim?.current ? true : null;
}, WANT, { timeout: 300_000 }).catch(() => {});

const read = () => page.evaluate((want) => {
  const THREE = window.__app.THREE;
  const s = (window.__students || []).find(x => x.g?.userData?.figure === want);
  if (!s) return null;
  s.g.updateMatrixWorld(true);
  const key = (n) => { let x = (n || "").split("|").pop().split(":").pop();
    x = x.replace(/^mixamorig\d*/i, "").replace(/[._]\d+$/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    return ({ pelvis: "hips", leftclavicle: "leftshoulder", rightclavicle: "rightshoulder",
              leftupperarm: "leftarm", rightupperarm: "rightarm",
              lefttoe: "lefttoebase", righttoe: "righttoebase" })[x] || x; };
  const B = new Map();
  s.g.traverse(o => { if (o.isBone){ const k = key(o.name); if (!B.has(k)) B.set(k, o); } });
  const P = (k) => { const b = B.get(k); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const a = P("leftfoot"), t = P("lefttoebase"), h = P("hips");
  if (!a || !t || !h) return { missing: true };
  const fwd = t.clone().sub(a); fwd.y = 0;
  if (fwd.lengthSq() < 1e-9) return { missing: true };
  fwd.normalize();
  const scale = Math.max(1e-6, h.y - a.y);
  const arm = (side) => {
    const sh = P(side + "arm"), hd = P(side + "hand");
    return sh && hd ? +(hd.clone().sub(sh).dot(fwd) / scale).toFixed(3) : null;
  };
  return { clip: s.g.userData.anim?.current, mode: s.mode,
           L: arm("left"), R: arm("right") };
}, WANT);

if (CONVO){
  await page.waitForFunction(() => (window.__convo?.named() || []).length > 0,
                             null, { timeout: 240_000 }).catch(() => {});
  const who = await page.evaluate((w) => {
    const named = window.__convo.named();
    const s = named.find(x => x.g?.userData?.figure === w) || named[0];
    if (!s) return null;
    window.__convo.open(s);
    return { n: s.data?.name, b: s.g?.userData?.figure };
  }, WANT);
  console.log(who ? `  close-up open on ${who.n} (${who.b})` : "  could not open a close-up");
  await page.waitForTimeout(2500);
}
const first = await read();
if (!first || first.missing){ console.log(`  ${WANT} not measurable (out today?)`);
  await browser.close(); await closeSrv(); process.exit(1); }

const rows = [];
for (let i = 0; i < SECS; i++){
  const r = await read();
  if (r && !r.missing) rows.push(r);
  await page.waitForTimeout(1000);
}
console.log(`\n${WANT} — hand ahead of (+) or behind (-) the shoulder, live, ${rows.length} samples`);
console.log(`  ${MOBILE ? "MOBILE 412x915 @2.6" : "desktop 1100x800 @1"}` +
            `  ${CONVO ? "· close-up held open" : "· campus"}`);
console.log("  (body-lengths along the figure's own forward)\n");
console.log("   clip               mode        left     right");
for (const r of rows)
  console.log(`  ${String(r.clip).padEnd(18)} ${String(r.mode).padEnd(10)} ` +
              `${String(r.L).padStart(7)}   ${String(r.R).padStart(7)}`);
const col = (f) => rows.map(f).filter(v => v != null);
const L = col(r => r.L), R = col(r => r.R);
const stat = (v) => v.length
  ? { min: Math.min(...v).toFixed(3), max: Math.max(...v).toFixed(3),
      mean: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(3),
      moved: (Math.max(...v) - Math.min(...v)).toFixed(3) } : null;
const sL = stat(L), sR = stat(R);
console.log(`\n  left   min ${sL.min}  max ${sL.max}  mean ${sL.mean}   moved ${sL.moved}`);
console.log(`  right  min ${sR.min}  max ${sR.max}  mean ${sR.mean}   moved ${sR.moved}`);
if (+sL.moved < 0.01 && +sR.moved < 0.01)
  console.log(`\n  THE POSE NEVER CHANGED across ${rows.length} seconds — this figure is not`
            + `\n  animating, so nothing here says where an animated arm goes.`);
else if (+sL.max < 0 && +sR.max < 0)
  console.log(`\n  BOTH HANDS STAY BEHIND THE SHOULDER LINE for the whole sample.`
            + `\n  That is the reported fault, measured.`);
else
  console.log(`\n  The hands come forward of the shoulders during the sample`
            + `\n  (left reaches ${sL.max}, right ${sR.max}), so they are not pinned behind.`);
await browser.close(); await closeSrv();
