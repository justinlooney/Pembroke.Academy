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

  /* swing-twist split about `axis`: the component of q that rotates
     around the axis is the twist; what is left is the swing. */
  const twistOf = (q, axis) => {
    const r = new THREE.Vector3(q.x, q.y, q.z);
    const proj = axis.clone().multiplyScalar(r.dot(axis));
    const t = new THREE.Quaternion(proj.x, proj.y, proj.z, q.w).normalize();
    return 2 * Math.acos(Math.min(1, Math.abs(t.w))) * 180 / Math.PI;
  };
  const dirOf = (m, k) => {
    const b = m.get(k); if (!b) return null;
    const kid = b.children.find(c => m.get(key(c.name)) === c);
    if (!kid) return null;
    const a = b.getWorldPosition(new THREE.Vector3());
    const c = kid.getWorldPosition(new THREE.Vector3());
    const v = c.sub(a); return v.lengthSq() > 1e-9 ? v.normalize() : null;
  };

  const SAMPLES = 8, worst = new Map();
  for (let i = 0; i < SAMPLES; i++){
    const t = Math.min(dClip.duration - 1e-4, dClip.duration * i / SAMPLES);
    dAct.time = t; dMixer.setTime(t); donor.scene.updateMatrixWorld(true);
    act.paused = true; act.time = Math.min(act.getClip().duration - 1e-4, t);
    s.g.userData.anim.mixer.setTime(act.time); s.g.updateMatrixWorld(true);

    for (const [k, rb] of R){
      const db = D.get(k); if (!db) continue;
      const rd = dirOf(R, k), dd = dirOf(D, k);
      if (!rd || !dd) continue;
      const rq = rb.getWorldQuaternion(new THREE.Quaternion());
      const dq = db.getWorldQuaternion(new THREE.Quaternion());
      const diff = dq.clone().invert().premultiply(rq);      /* receiver relative to donor */
      const swing = +(Math.acos(Math.max(-1, Math.min(1, rd.dot(dd)))) * 180 / Math.PI).toFixed(1);
      const twist = +twistOf(diff, dd).toFixed(1);
      const cur = worst.get(k);
      if (!cur || twist > cur.twist) worst.set(k, { swing, twist });
    }
  }
  act.paused = false;
  return { rows: [...worst.entries()].map(([k, v]) => ({ k, ...v })),
           donorBones: D.size, recvBones: R.size, dur: +dClip.duration.toFixed(2) };
}, [WANT, CLIP, DONOR]);

if (out.error){ console.log("  " + out.error); }
else {
  out.rows.sort((a, b) => b.twist - a.twist);
  console.log(`\n${WANT} · "${CLIP}" vs ${DONOR.split("/").pop()}  (${out.dur}s, 8 matched times)`);
  console.log(`donor joints ${out.donorBones}, receiver joints ${out.recvBones}, compared ${out.rows.length}\n`);
  console.log("  joint            swing   twist    (deg; worst of 8 matched samples)");
  for (const r of out.rows)
    console.log(`  ${r.k.padEnd(16)} ${String(r.swing).padStart(5)}   ${String(r.twist).padStart(5)}` +
                (r.twist > 30 ? "   <<<" : ""));
  const bad = out.rows.filter(r => r.twist > 30);
  const swung = out.rows.filter(r => r.swing > 30);
  console.log(`\n  ${bad.length} joint(s) roll more than 30 deg away from the donor;` +
              ` ${swung.length} point more than 30 deg away.`);
  console.log(bad.length && bad.length > swung.length
    ? `  Twist dominates: the bones point roughly right and are ROLLED about their\n` +
      `  own axes, which is what shears a mesh while leaving joint angles intact.`
    : bad.length
      ? `  Both are off; twist is not the whole story.`
      : `  Twist is small. The retarget reproduces the donor's roll, and this is NOT\n` +
        `  the fault either.`);
}
await browser.close(); await closeSrv();
