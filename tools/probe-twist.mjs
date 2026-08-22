/* Is the retarget getting the ROLL right, not just where limbs point?
 *
 *     node tools/probe-twist.mjs [figure] [clip]
 *
 * Everything measured in this bug so far is blind to twist. Joint
 * angles are computed from bone POSITIONS, so a limb rolled 90 degrees
 * along its own length reports an unchanged elbow. skinIndex and the
 * inverse bind matrices are twist-invariant too. And twist is exactly
 * what shears a mesh: the bone points where it should and the geometry
 * wrapped around it does not — flawless at rest, smeared once animated,
 * every joint anatomically fine throughout. That is every symptom this
 * bug has, and nothing has looked at it.
 *
 * So: drive the DONOR and the RECEIVER through the same clip AT THE
 * SAME CLIP TIME — the last A/B compared arbitrary moments of a 3.9s
 * clip and could not settle anything — and for each paired bone split
 * the orientation difference into
 *
 *     swing  where the bone points        (already known to be fine)
 *     twist  roll about its own axis      (never measured)
 *
 * Swing-twist decomposition about the bone's own direction, so the two
 * are separated rather than mixed into one "how different" number. */
import { serve, launch } from "./_harness.mjs";

const WANT = process.argv[2] || "char17";
const CLIP = process.argv[3] || "Talking";
const DONOR = { Talking: "assets/clip_talkstand.glb",
                "Sitting Idle": "assets/clip_sitidle.glb",
                "Sit To Stand": "assets/clip_standup.glb",
                "Female Walk 1": "assets/clip_walkf_1.glb" }[CLIP];
if (!DONOR){ console.log(`no donor file known for clip "${CLIP}"`); process.exit(1); }

const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction(([w, c]) => {
  const s = (window.__students || []).find(x => x.g?.userData?.figure === w);
  return s && s.g?.userData?.anim?.actions?.[c] ? true : null;
}, [WANT, CLIP], { timeout: 300_000 }).catch(() => {});

const out = await page.evaluate(async ([want, clipName, donorUrl]) => {
  const THREE = window.__app.THREE;
  const s = (window.__students || []).find(x => x.g?.userData?.figure === want);
  if (!s) return { error: `${want} is not out today` };
  const act = s.g.userData.anim?.actions?.[clipName];
  if (!act) return { error: `${want} has no "${clipName}"` };

  const { GLTFLoader } =
    await import("./assets/vendor/three/examples/jsm/loaders/GLTFLoader.js");
  const donor = await new Promise((res, rej) =>
    new GLTFLoader().load(donorUrl, res, undefined, rej)).catch(e => ({ err: String(e) }));
  if (donor.err) return { error: "donor: " + donor.err.slice(0, 90) };
  const dClip = donor.animations[0];
  if (!dClip) return { error: "donor carries no clip" };

  const key = (n) => { let x = (n || "").split("|").pop().split(":").pop();
    x = x.replace(/^mixamorig\d*/i, "").replace(/[._]\d+$/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    return ({ pelvis: "hips", chest: "chest", leftclavicle: "leftshoulder",
              rightclavicle: "rightshoulder", leftupperarm: "leftarm",
              rightupperarm: "rightarm", leftthigh: "leftupleg", rightthigh: "rightupleg",
              leftshin: "leftleg", rightshin: "rightleg" })[x] || x; };

  const map = (root, loose) => { const m = new Map();
    root.traverse(o => { if ((loose || o.isBone) && o.name){ const k = key(o.name); if (!m.has(k)) m.set(k, o); } });
    return m; };
  const R = map(s.g, false), D = map(donor.scene, true);

  const dMixer = new THREE.AnimationMixer(donor.scene);
  const dAct = dMixer.clipAction(dClip); dAct.play();
  act.play();

  /* swing-twist split about `axis`: the component of q that rotates
     around the axis is the twist; what is left is the swing. */
  const twistOf = (q, axis) => {
    const r = new THREE.Vector3(q.x, q.y, q.z);
    const proj = axis.clone().multiplyScalar(r.dot(axis));
    const t = new THREE.Quaternion(proj.x, proj.y, proj.z, q.w).normalize();
    return 2 * Math.acos(Math.min(1, Math.abs(t.w))) * 180 / Math.PI;
  };
  /* ── the child is NAMED, never "the first one found" ──────────────
     A bone's direction is the vector to its child, which is only
     comparable across two rigs if it is the SAME child on both. The
     first version took b.children.find(...), and at a branching joint
     that is whichever the exporter happened to list first — the spine
     on one rig and a leg on the other. It made hips, spine, spine1 and
     spine2 meaningless while printing them beside the limbs as though
     they were evidence. Only single-chain joints survived, and only by
     luck.

     So the chain is declared. A joint with no entry here has no
     comparable direction and is not reported at all, rather than
     reported wrongly. */
  const CHILD = {
    hips: "spine", spine: "spine1", spine1: "spine2", spine2: "neck",
    chest: "neck", neck: "head",
    leftshoulder: "leftarm", leftarm: "leftforearm", leftforearm: "lefthand",
    rightshoulder: "rightarm", rightarm: "rightforearm", rightforearm: "righthand",
    leftupleg: "leftleg", leftleg: "leftfoot", leftfoot: "lefttoebase",
    rightupleg: "rightleg", rightleg: "rightfoot", rightfoot: "righttoebase",
  };
  const dirOf = (m, k) => {
    const b = m.get(k), kid = m.get(CHILD[k]);
    if (!b || !kid) return null;
    const a = b.getWorldPosition(new THREE.Vector3());
    const c = kid.getWorldPosition(new THREE.Vector3());
    const v = c.sub(a); return v.lengthSq() > 1e-9 ? v.normalize() : null;
  };

  /* ── the basis the retarget INTENDS, captured at rest ─────────────
     The receiver's world quaternion is not supposed to equal the
     donor's. lendClip maps the donor's rest onto the receiver's, so the
     intended relationship carries a constant per-bone offset

         C = restDonor^-1 * restReceiver

     and comparing raw quaternions measures C, which is design rather
     than fault. The first version of this did exactly that and reported
     179.7 deg of "twist" at a shoulder — almost certainly two rigs whose
     upper-arm axes point opposite ways, exactly as intended.

     So C is measured here, at rest, before either is driven, and
     divided out below. What is left is the retarget's error. */
  /* stopAllAction only stops DRIVING the skeleton; it leaves whatever
     frame was last written standing. skeleton.pose() is what actually
     restores the bind pose, and without it "rest" would have been a
     random frame of whatever was playing when the probe attached. */
  s.g.userData.anim.mixer.stopAllAction();
  s.g.traverse(o => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  const restC = new Map();
  donor.scene.updateMatrixWorld(true); s.g.updateMatrixWorld(true);
  for (const [k, rb] of R){
    const db = D.get(k); if (!db) continue;
    const dq = db.getWorldQuaternion(new THREE.Quaternion());
    const rq = rb.getWorldQuaternion(new THREE.Quaternion());
    restC.set(k, dq.invert().multiply(rq));        /* donor^-1 * receiver */
  }
  const restDir = new Map();
  for (const k of R.keys()){
    const rd = dirOf(R, k), dd = dirOf(D, k);
    if (rd && dd) restDir.set(k, +(Math.acos(Math.max(-1, Math.min(1, rd.dot(dd)))) * 180 / Math.PI).toFixed(1));
  }


  const SAMPLES = 8, worst = new Map();
  let blended = 0, frozen = 0;
  for (let i = 0; i < SAMPLES; i++){
    const t = Math.min(dClip.duration - 1e-4, dClip.duration * i / SAMPLES);
    dAct.time = t; dMixer.setTime(t); donor.scene.updateMatrixWorld(true);
    /* ONE clip, not a blend. mixer.setTime steps EVERY action on the
       mixer, and students on the campus crossfade — so the previous
       version measured whatever mixture happened to be running and
       called it "Talking". A blend diverges most where motion is
       largest, which is the arms, and least at the spine and hips:
       exactly the result it produced. Every other action is stopped and
       zeroed here, and the count is reported so a silent blend cannot
       masquerade as a reading again. */
    let others = 0;
    for (const [nm, a2] of Object.entries(s.g.userData.anim.actions)){
      if (a2 === act) continue;
      /* running, not merely weighted — see probe-action-weights.mjs.
         Counting stopped actions inflated this to 6 when the real
         figure was an ordinary two-clip crossfade. */
      if (a2.isRunning()){ others++; }
      a2.stop(); a2.setEffectiveWeight(0);
    }
    if (i === 0) blended = others;
    act.setEffectiveWeight(1);
    /* NOT paused. three.js AnimationMixer.setTime() zeroes every
       action's time and then advances by the argument, and a paused
       action does not advance — so pausing first, assigning act.time,
       then calling setTime left the receiver at frame 0 for every
       sample while the donor moved. Eight identical rows compared
       against eight different ones. Drive it the way the mixer expects
       instead, and assert afterwards that the clock actually moved. */
    act.paused = false; act.setEffectiveTimeScale(1);
    const want = Math.min(act.getClip().duration - 1e-4, t);
    s.g.userData.anim.mixer.setTime(want); s.g.updateMatrixWorld(true);
    if (Math.abs(act.time - want) > 0.05) frozen++;

    for (const [k, rb] of R){
      const db = D.get(k); if (!db) continue;
      const rd = dirOf(R, k), dd = dirOf(D, k);
      if (!rd || !dd) continue;
      const rq = rb.getWorldQuaternion(new THREE.Quaternion());
      const dq = db.getWorldQuaternion(new THREE.Quaternion());
      /* intended = donor's orientation carried through the rest basis.
         What the receiver does beyond that is the error. */
      const C = restC.get(k); if (!C) continue;
      const intended = dq.clone().multiply(C);
      const err = intended.invert().premultiply(rq);
      const swing = +(Math.acos(Math.max(-1, Math.min(1, rd.dot(dd)))) * 180 / Math.PI).toFixed(1);
      const twist = +twistOf(err, dd).toFixed(1);
      const cur = worst.get(k);
      if (!cur || twist > cur.twist) worst.set(k, { swing, twist, rest: restDir.get(k) ?? null });
    }
  }
  act.paused = false;
  return { rows: [...worst.entries()].map(([k, v]) => ({ k, ...v })),
           donorBones: D.size, recvBones: R.size, dur: +dClip.duration.toFixed(2), blended, frozen };
}, [WANT, CLIP, DONOR]);

if (out.error){ console.log("  " + out.error); }
else {
  out.rows.sort((a, b) => b.twist - a.twist);
  console.log(`\n${WANT} · "${CLIP}" vs ${DONOR.split("/").pop()}  (${out.dur}s, 8 matched times)`);
  console.log(`donor joints ${out.donorBones}, receiver joints ${out.recvBones}, compared ${out.rows.length}`);
  console.log(out.blended
    ? `  ${out.blended} OTHER action(s) were live and have been stopped — the previous`
      + `\n  run of this measured a blend and labelled it "${CLIP}".\n`
    : `  no other action was live; this is one clip.\n`);
  if (out.frozen) console.log(`  ${out.frozen} of 8 samples did NOT advance the receiver's clock —\n` +
                              `  swing and twist below are not matched in time and prove nothing.\n`);
  console.log("  joint            swing   twist   restSwing   (deg; worst of 8 matched)");
  for (const r of out.rows)
    console.log(`  ${r.k.padEnd(16)} ${String(r.swing).padStart(5)}   ${String(r.twist).padStart(5)}` +
                `   ${String(r.rest ?? "-").padStart(9)}` +
                (r.twist > 30 || r.swing > 30 ? "   <<<" : ""));
  const bad = out.rows.filter(r => r.twist > 30);
  const swung = out.rows.filter(r => r.swing > 30);
  console.log(`\n  swing = where the limb points vs the donor, basis-independent.`);
  console.log(`  twist = roll left over AFTER the intended rest basis is divided out.`);
  console.log(`  restSwing = the same swing measured at REST, before any clip plays —`);
  console.log(`              a large value there is the rigs' own pose difference,`);
  console.log(`              not something the clip did.`);
  console.log(`\n  ${swung.length} joint(s) point more than 30 deg from the donor;` +
              ` ${bad.length} roll more than 30 deg.`);
  if (!swung.length && !bad.length)
    console.log(`  The retarget reproduces the donor on both channels. Neither is the fault.`);
  else if (swung.length && bad.length)
    console.log(`  BOTH channels are off, so this does not isolate one mechanism.`);
  else if (swung.length)
    console.log(`  Direction is wrong and roll is not: the retarget is not reproducing the\n` +
                `  donor's SHAPE, which is a pose fault rather than a shearing one.`);
  else
    console.log(`  Roll is wrong and direction is not: bones point where they should and are\n` +
                `  rolled about their own axes, which shears a mesh while leaving joint\n` +
                `  angles intact.`);
}
await browser.close(); await closeSrv();
