/* Does the figure hold a pose a person could hold?
 *
 *     node tools/probe-pose-anatomy.mjs [figure]
 *
 * Two attempts at this bug picked a suspect first — the arms, then
 * breathe() — and measured only that. Both were wrong, and the second
 * was ruled out on a one-line read (release() clears `held`, and both
 * breathe() call sites are gated on held === true, so it does not run
 * in the close-up at all). So this nominates no culprit. It measures
 * every joint it can name and ranks them, and ANATOMY is the reference:
 * a knee does not bend backwards and a neck does not fold in half, on
 * any rig, from any donor, whatever the retarget believes.
 *
 * check-stance.mjs asks a related question but only of students PARKED
 * on the campus, and only of two heights — head near the top, hips near
 * half. It can pass while a figure is wrong at conversation distance,
 * which is exactly where these faults were reported.
 *
 * One page, one student, several samples in time: the A/B before this
 * compared char17 against char18 because the probe took whoever was
 * dealt first, and was worthless. Everything here is measured on the
 * same body, and nothing is reported unless a clip is confirmed
 * RUNNING — a bind pose already fooled me once. */
import { serve, launch } from "./_harness.mjs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const OUT = resolve(new URL("..", import.meta.url).pathname, ".shots");
const WANT = process.argv[2] || null;
await mkdir(OUT, { recursive: true });

const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));

let target = null;
for (let visit = 1; visit <= (WANT ? 6 : 1); visit++){
  await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 240_000 });
  await page.waitForFunction(() => (window.__convo.named() || []).length > 0,
                             null, { timeout: 240_000 });
  const cast = await page.evaluate(() => window.__convo.named()
    .map(s => ({ name: s.data?.name, body: s.g?.userData?.figure })));
  target = WANT ? cast.find(c => c.body === WANT) : cast[0];
  if (target) break;
  console.log(`visit ${visit}: no ${WANT} in [${cast.map(c => c.body).join(", ")}], dealing again`);
}
if (!target){ console.log(`${WANT} never dealt.`); await browser.close(); await closeSrv(); process.exit(1); }

/* lent, then RUNNING — neither inferred */
const lent = await page.waitForFunction((nm) => {
  const s = (window.__convo.named() || []).find(x => x.data?.name === nm);
  const r = s && s.roles;
  return r && (r.talk || r.idle || (r.gaits && r.gaits.length)) ? true : null;
}, target.name, { timeout: 180_000 }).then(() => true).catch(() => false);

await page.evaluate((nm) => {
  window.__convo.open(window.__convo.named().find(x => x.data?.name === nm));
}, target.name);

const playing = await page.waitForFunction(() => {
  const g = (window.__convo.named().find(s => s.g && s.g.parent &&
             s.g.parent !== window.__app.world) || {}).g;
  return g && g.userData.anim && g.userData.anim.current ? true : null;
}, null, { timeout: 60_000 }).then(() => true).catch(() => false);

console.log(`\nbody ${target.body}  ·  ${target.name}   lent=${lent}  clipRunning=${playing}`);
if (!playing){
  console.log("  NO CLIP RUNNING — refusing to report joint angles from a bind pose.");
  await page.screenshot({ path: `${OUT}/anatomy-${target.body}.png`, timeout: 120_000 });
  await browser.close(); await closeSrv(); process.exit(2);
}

const SAMPLES = 6;
const frames = [];
for (let i = 0; i < SAMPLES; i++){
  frames.push(await page.evaluate(() => {
    const THREE = window.__app.THREE;
    const g = (window.__convo.named().find(s => s.g && s.g.parent &&
               s.g.parent !== window.__app.world) || {}).g;
    g.updateMatrixWorld(true);
    const key = (s) => { s = (s || "").split("|").pop().split(":").pop();
      s = s.replace(/^mixamorig\d*/i, "").replace(/[._]\d+$/, "");
      return s.replace(/[^a-z0-9]/gi, "").toLowerCase(); };
    const B = {}; const names = [];
    g.traverse(o => { if (o.isBone){ names.push(o.name); const k = key(o.name); if (!B[k]) B[k] = o; } });
    const P = (b) => b ? b.getWorldPosition(new THREE.Vector3()) : null;
    /* the angle at joint b, between the limb coming in and going out.
       180 = straight; small = folded hard. */
    const bend = (a, b, c) => {
      const A = P(B[a]), Bp = P(B[b]), C = P(B[c]);
      if (!A || !Bp || !C) return null;
      const u = A.sub(Bp).normalize(), v = C.sub(Bp).normalize();
      return +(Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 180 / Math.PI).toFixed(1);
    };
    const pick = (...alts) => alts.find(k => B[k]) || alts[0];
    const ua = (s) => pick(s + "arm", s + "upperarm", s + "upper");
    const fa = (s) => pick(s + "forearm", s + "lowerarm");
    const hd = (s) => pick(s + "hand");
    const ul = (s) => pick(s + "upleg", s + "upperleg", s + "thigh");
    const ll = (s) => pick(s + "leg", s + "lowerleg", s + "shin");
    const ft = (s) => pick(s + "foot");
    /* This rig is NOT Mixamo-named. It reads
         Root, Pelvis, Spine, Spine1, Spine2, Chest, Neck, Head,
         RightClavicle, RightUpperArm, RightForeArm, RightHand,
         RightThigh, RightShin, RightFoot, RightToe
       and the first run of this probe asked for "hips", got nothing,
       and printed "spineBend — no bones matched" while still closing
       with "every measured joint is inside human range". The one chain
       that looks wrong in the render was the one chain not measured.
       Aliases now cover both vocabularies. */
    const root = pick("pelvis", "hips");
    const sp = pick("spine", "spine1"), ch = pick("chest", "spine2", "spine1");
    return { names, rootBone: root, chestBone: ch,
      leftElbow:  bend(ua("left"),  fa("left"),  hd("left")),
      rightElbow: bend(ua("right"), fa("right"), hd("right")),
      leftKnee:   bend(ul("left"),  ll("left"),  ft("left")),
      rightKnee:  bend(ul("right"), ll("right"), ft("right")),
      lowSpine:   bend(root, sp, pick("spine1", "spine2", "chest")),
      midSpine:   bend(sp, pick("spine1", "spine2"), ch),
      spineTotal: bend(root, ch, pick("head", "neck")),
      neckBend:   bend(ch, pick("neck"), pick("head")),
      leftShoulder:  bend(ch, pick("leftclavicle", "leftshoulder", ua("left")), ua("left")),
      rightShoulder: bend(ch, pick("rightclavicle", "rightshoulder", ua("right")), ua("right")),
      leftArmSwing:  bend(ch, ua("left"),  fa("left")),
      rightArmSwing: bend(ch, ua("right"), fa("right")),
    };
  }));
  await page.waitForTimeout(700);
}

console.log(`\n${frames[0].names.length} bones: ${frames[0].names.join(", ")}`);
console.log(`root joint matched: ${frames[0].rootBone}   chest: ${frames[0].chestBone}\n`);
/* Ranges a living joint stays inside. Deliberately generous — the point
   is to catch the impossible, not to grade the posture. */
const RANGE = {
  leftElbow: [30, 185], rightElbow: [30, 185],
  leftKnee: [55, 190], rightKnee: [55, 190],
  lowSpine: [130, 190], midSpine: [130, 190], spineTotal: [120, 190],
  neckBend: [95, 190],
  leftShoulder: [55, 185], rightShoulder: [55, 185],
  leftArmSwing: [10, 185], rightArmSwing: [10, 185],
};
const keys = Object.keys(RANGE);
const rows = keys.map(k => {
  const vals = frames.map(f => f[k]).filter(v => v != null);
  if (!vals.length) return { k, missing: true };
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const [a, b] = RANGE[k];
  const out = Math.max(a - lo, hi - b, 0);
  return { k, lo, hi, a, b, out };
});
rows.sort((x, y) => (y.out || 0) - (x.out || 0));
console.log("joint angles across " + SAMPLES + " samples  (deg; 180 = straight)\n");
for (const r of rows){
  if (r.missing){ console.log(`  ${r.k.padEnd(14)} — no bones matched`); continue; }
  const flag = r.out > 0 ? `  <<< OUTSIDE ${r.a}-${r.b} by ${r.out.toFixed(0)}` : "";
  console.log(`  ${r.k.padEnd(14)} ${String(r.lo).padStart(6)} .. ${String(r.hi).padStart(6)}${flag}`);
}
const bad = rows.filter(r => !r.missing && r.out > 0);
console.log(bad.length
  ? `\n  ${bad.length} joint(s) hold a pose a person cannot: ${bad.map(r => r.k).join(", ")}`
  : `\n  every measured joint is inside human range.`);
const missed = rows.filter(r => r.missing);
if (missed.length)
  console.log(`  BUT ${missed.length} were not measured at all (${missed.map(r => r.k).join(", ")}) —`
            + `\n  no conclusion covers a joint this probe could not find.`);
else if (!bad.length)
  console.log(`  Nothing was skipped, so the skeleton holds a possible pose and the`
            + `\n  next suspect is skinning, or a pose that is possible but wrong.`);

await page.screenshot({ path: `${OUT}/anatomy-${target.body}.png`, timeout: 120_000 });
console.log(`\nwrote .shots/anatomy-${target.body}.png`);
await browser.close(); await closeSrv();
