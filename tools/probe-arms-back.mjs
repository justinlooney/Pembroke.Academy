/* Are the arms behind the back? Measured, on the body's own forward axis.
 *
 *     node tools/probe-arms-back.mjs [figure] [clip]
 *
 * Reported from a phone: "shoulders and arms are pulled to behind their
 * back". Nothing measured in this bug would have caught that. Droop is
 * elevation, swing is where a limb points against the donor, and both
 * are blind to how far fore or aft of the torso an arm sits.
 *
 * Forward is taken from the ankle-to-toe vector, which is how this
 * codebase already decides which way a body faces — "toes are forward
 * of ankles on every humanoid ever rigged, so the ankle-to-toe vector
 * IS the facing" — rather than assuming +Z or -Z, which these rigs do
 * not agree on.
 *
 * Then, for each arm: how far the hand and elbow sit ahead of (+) or
 * behind (-) the shoulder, in body-lengths, on the receiver and on the
 * donor at the SAME clip time. A person talking carries their hands
 * ahead of the shoulder line. Behind it is the reported fault, and the
 * difference from the donor is how much of it the retarget introduced. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const CLIP = process.argv[3] || "Talking";
const DONOR = { Talking: "assets/clip_talkstand.glb",
                "Female Walk 1": "assets/clip_walkf_1.glb",
                "Sitting Idle": "assets/clip_sitidle.glb" }[CLIP];
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction(([w, c]) => {
  const s = (window.__students || []).find(x => x.g?.userData?.figure === w);
  return s?.g?.userData?.anim?.actions?.[c] ? true : null;
}, [WANT, CLIP], { timeout: 300_000 }).catch(() => {});

const out = await page.evaluate(async ([want, clipName, donorUrl]) => {
  const THREE = window.__app.THREE;
  const s = (window.__students || []).find(x => x.g?.userData?.figure === want);
  if (!s) return { error: `${want} is not out today` };
  const act = s.g.userData.anim?.actions?.[clipName];
  if (!act) return { error: `no "${clipName}" on ${want}` };
  const { GLTFLoader } = await import("./assets/vendor/three/examples/jsm/loaders/GLTFLoader.js");
  const donor = await new Promise((res, rej) =>
    new GLTFLoader().load(donorUrl, res, undefined, rej)).catch(e => ({ err: String(e) }));
  if (donor.err) return { error: "donor: " + donor.err.slice(0, 90) };

  const key = (n) => { let x = (n || "").split("|").pop().split(":").pop();
    x = x.replace(/^mixamorig\d*/i, "").replace(/[._]\d+$/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    return ({ pelvis: "hips", leftclavicle: "leftshoulder", rightclavicle: "rightshoulder",
              leftupperarm: "leftarm", rightupperarm: "rightarm", leftthigh: "leftupleg",
              rightthigh: "rightupleg", leftshin: "leftleg", rightshin: "rightleg",
              lefttoe: "lefttoebase", righttoe: "righttoebase" })[x] || x; };
  const map = (root, loose) => { const m = new Map();
    root.traverse(o => { if ((loose || o.isBone) && o.name){ const k = key(o.name); if (!m.has(k)) m.set(k, o); } });
    return m; };
  const R = map(s.g, false), D = map(donor.scene, true);
  const P = (m, k) => { const b = m.get(k); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };

  /* forward from ankle to toe, flattened — the codebase's own rule */
  const forwardOf = (m) => {
    const a = P(m, "leftfoot"), t = P(m, "lefttoebase");
    if (!a || !t) return null;
    const v = t.sub(a); v.y = 0;
    return v.lengthSq() > 1e-9 ? v.normalize() : null;
  };
  /* a body length to divide by, so two rigs of different size compare */
  const scaleOf = (m) => {
    const h = P(m, "hips"), f = P(m, "leftfoot");
    return h && f ? Math.max(1e-6, h.y - f.y) : 1;
  };
  const armOf = (m, side) => {
    const fwd = forwardOf(m); if (!fwd) return null;
    const sh = P(m, side + "arm"), el = P(m, side + "forearm"), hd = P(m, side + "hand");
    if (!sh || !el) return null;
    const k = scaleOf(m);
    const ahead = (p) => p ? +(p.clone().sub(sh).dot(fwd) / k).toFixed(3) : null;
    return { elbow: ahead(el), hand: ahead(hd) };
  };

  const dClip = donor.animations[0];
  const dMixer = new THREE.AnimationMixer(donor.scene);
  const dAct = dMixer.clipAction(dClip); dAct.play();
  for (const [, a2] of Object.entries(s.g.userData.anim.actions)){
    if (a2 !== act){ a2.stop(); a2.setEffectiveWeight(0); }
  }
  act.play(); act.setEffectiveWeight(1);

  const rows = [];
  for (let i = 0; i < 8; i++){
    const t = Math.min(dClip.duration - 1e-4, dClip.duration * i / 8);
    dAct.time = t; dMixer.setTime(t); donor.scene.updateMatrixWorld(true);
    act.paused = true; act.time = Math.min(act.getClip().duration - 1e-4, t);
    s.g.userData.anim.mixer.setTime(act.time); s.g.updateMatrixWorld(true);
    rows.push({ t: +t.toFixed(2),
                recvL: armOf(R, "left"), recvR: armOf(R, "right"),
                donL: armOf(D, "left"), donR: armOf(D, "right") });
  }
  act.paused = false;
  return { rows };
}, [WANT, CLIP, DONOR]);

if (out.error) console.log("  " + out.error);
else {
  console.log(`\n${WANT} · "${CLIP}"   how far the hand/elbow sits AHEAD of the shoulder`);
  console.log(`(body-lengths along the figure's own forward. negative = BEHIND the back)\n`);
  console.log("   t      recv L hand  recv R hand   donor L hand  donor R hand");
  for (const r of out.rows)
    console.log(`  ${String(r.t).padStart(4)}   ` +
      `${String(r.recvL?.hand ?? "-").padStart(11)}  ${String(r.recvR?.hand ?? "-").padStart(11)}   ` +
      `${String(r.donL?.hand ?? "-").padStart(12)}  ${String(r.donR?.hand ?? "-").padStart(12)}`);
  const avg = (f) => { const v = out.rows.map(f).filter(x => x != null);
    return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) : null; };
  const rL = avg(r => r.recvL?.hand), rR = avg(r => r.recvR?.hand);
  const dL = avg(r => r.donL?.hand), dR = avg(r => r.donR?.hand);
  console.log(`\n  mean hand position:  receiver L ${rL}  R ${rR}   donor L ${dL}  R ${dR}`);
  const behind = [rL, rR].filter(v => v != null && v < -0.02).length;
  const donorBehind = [dL, dR].filter(v => v != null && v < -0.02).length;
  console.log(behind && !donorBehind
    ? `\n  THE RECEIVER'S HANDS SIT BEHIND THE SHOULDER LINE AND THE DONOR'S DO NOT.`
      + `\n  That is the reported fault, and the retarget introduced it.`
    : behind && donorBehind
      ? `\n  Both are behind the shoulder line — the donor clip itself holds the arms back.`
      : `\n  Neither is behind the shoulder line on this clip.`);
}
await browser.close(); await closeSrv();
