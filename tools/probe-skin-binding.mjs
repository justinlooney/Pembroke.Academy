/* Does the mesh's skinIndex agree with the skeleton it is bound to?
 *
 *     node tools/probe-skin-binding.mjs [figure]
 *
 * The anatomy probe settled that the SKELETON holds an ordinary pose —
 * spine 173-178 deg, neck 172-175, knees and elbows relaxed — while the
 * render shows a crumpled torso. Bones right, mesh wrong is the
 * signature of a skinning fault rather than a posing one.
 *
 * And a clean rest pose does not rule that out, which is the trap I
 * fell into: at BIND pose skin deformation is the identity, so a mesh
 * whose joint indices disagree with its skeleton still renders
 * perfectly. The disagreement only appears once the figure is posed.
 *
 * So this asks the question at bind pose, where it can be asked
 * exactly. For each joint index used by the mesh, take the vertices it
 * dominates, find their centroid, and ask which bone is NEAREST. If
 * skinIndex agrees with skeleton.bones, the nearest bone is the one
 * that index names. If it does not, the pairs are printed — which is a
 * diagnosis rather than a suspicion. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__castLib, null, { timeout: 240_000 });
await page.waitForFunction((w) => {
  const lib = window.__castLib || {};
  return lib[w] ? true : null;
}, WANT, { timeout: 300_000 }).catch(() => {});

const out = await page.evaluate((want) => {
  const THREE = window.__app.THREE;
  const lib = window.__castLib || {};
  const entry = lib[want];
  if (!entry) return { error: `${want} not in __castLib. have: ${Object.keys(lib).join(", ")}` };
  const root = entry.scene || entry;
  const skins = [];
  root.traverse(o => { if (o.isSkinnedMesh) skins.push(o); });
  if (!skins.length) return { error: "no SkinnedMesh under " + want };

  const rows = [];
  for (const m of skins){
    /* Bind pose, exactly: undo whatever the campus has posed it into. */
    m.skeleton.pose();
    root.updateMatrixWorld(true);
    const geo = m.geometry;
    const idx = geo.attributes.skinIndex, wgt = geo.attributes.skinWeight, pos = geo.attributes.position;
    if (!idx || !wgt) { rows.push({ mesh: m.name, error: "no skin attributes" }); continue; }
    const bones = m.skeleton.bones;
    const sum = new Map();          /* joint index -> {v, n} */
    const v = new THREE.Vector3();
    const step = Math.max(1, Math.floor(pos.count / 20000));   /* sample, not all 200k */
    for (let i = 0; i < pos.count; i += step){
      for (let k = 0; k < 4; k++){
        const w = wgt.getComponent(i, k);
        if (w < 0.85) continue;                    /* dominated, not merely touched */
        const j = idx.getComponent(i, k);
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        let s = sum.get(j);
        if (!s) sum.set(j, s = { v: new THREE.Vector3(), n: 0 });
        s.v.add(v); s.n++;
      }
    }
    const bp = bones.map(b => b.getWorldPosition(new THREE.Vector3()));
    const pairs = [];
    for (const [j, s] of [...sum.entries()].sort((a, b) => a[0] - b[0])){
      if (s.n < 12) continue;                       /* too few to mean anything */
      const c = s.v.divideScalar(s.n);
      let best = -1, bestD = Infinity;
      bp.forEach((p, bi) => { const d = p.distanceTo(c); if (d < bestD){ bestD = d; best = bi; } });
      /* A TIE IS NOT A MISMATCH. Adjacent joints sit almost on top of
         each other — Spine2 and Chest, Foot and Toe — so whichever wins
         by a rounding error is arbitrary. The first run of this called
         three such ties a skinIndex mismatch on distances of 0.1
         against 0.1, which is not evidence of anything. A real
         mis-index puts the vertices on a bone limbs away, so the named
         bone has to be MATERIALLY farther before it counts: half a
         bone-length of slack, and at least 25% worse than the winner. */
      const dNamed = bones[j] ? bp[j].distanceTo(c) : Infinity;
      const slack = Math.max(0.5, bestD * 0.25);
      pairs.push({ j, named: bones[j] ? bones[j].name : "(no such bone)",
                   nearest: bones[best] ? bones[best].name : "?",
                   agree: best === j || dNamed <= bestD + slack,
                   tie: best !== j && dNamed <= bestD + slack, verts: s.n,
                   dToNamed: bones[j] ? +bp[j].distanceTo(c).toFixed(1) : null,
                   dToNearest: +bestD.toFixed(1) });
    }
    /* ── the inverse bind matrices, checked against the rest pose ────
       three.js skins by  boneMatrix[i] = bone.matrixWorld * boneInverses[i].
       At BIND pose that product must be the identity — that is what an
       inverse bind matrix is for. If a file's inverses do not
       correspond to its own rest pose, the mesh still renders perfectly
       at rest, because nothing is driving it, and deforms wrongly the
       moment any clip plays. Flawless standing still, smeared when
       animated, bones anatomically fine throughout: every symptom this
       bug has, and it survives both checks above.

       Measured as the largest deviation of the product from identity,
       reported in the file's own units for translation and in degrees
       for rotation, so a small numerical residue reads differently from
       a real mismatch. */
    const bind = [];
    const M = new THREE.Matrix4(), P = new THREE.Vector3();
    const Q = new THREE.Quaternion(), S = new THREE.Vector3();
    for (let i = 0; i < bones.length; i++){
      const inv = m.skeleton.boneInverses[i];
      if (!inv) continue;
      M.multiplyMatrices(bones[i].matrixWorld, inv);
      M.decompose(P, Q, S);
      const degOff = 2 * Math.acos(Math.min(1, Math.abs(Q.w))) * 180 / Math.PI;
      bind.push({ bone: bones[i].name, move: +P.length().toFixed(3),
                  turn: +degOff.toFixed(2),
                  scale: +Math.max(Math.abs(S.x - 1), Math.abs(S.y - 1), Math.abs(S.z - 1)).toFixed(3) });
    }
    bind.sort((a, b) => (b.turn + b.move) - (a.turn + a.move));
    rows.push({ mesh: m.name || "(unnamed)", bones: bones.length,
                verts: pos.count, sampled: Math.ceil(pos.count / step), pairs, bind });
  }
  return { rows };
}, WANT);

if (out.error) console.log("  " + out.error);
else for (const r of out.rows){
  if (r.error){ console.log(`  ${r.mesh}: ${r.error}`); continue; }
  console.log(`\nmesh ${r.mesh}  ·  ${r.bones} bones  ·  ${r.verts} verts (${r.sampled} sampled)`);
  const bad = r.pairs.filter(p => !p.agree);
  console.log(`  joints with dominated vertices: ${r.pairs.length}   disagreeing: ${bad.length}`);
  for (const p of r.pairs){
    const mark = p.tie ? "  ~  " : p.agree ? "  ok " : "  ** ";
    console.log(`${mark}index ${String(p.j).padStart(2)} names ${p.named.padEnd(16)}` +
                ` nearest ${p.nearest.padEnd(16)} verts ${String(p.verts).padStart(5)}` +
                (p.tie ? `   tie with ${p.nearest} at ${p.dToNamed} vs ${p.dToNearest} — not a mismatch` : "") +
                (p.agree ? "" : `   named ${p.dToNamed} away vs nearest ${p.dToNearest}`));
  }
  if (r.bind && r.bind.length){
    const off = r.bind.filter(b => b.turn > 1 || b.move > 0.05 || b.scale > 0.02);
    console.log(`\n  inverse bind vs rest pose — bone.matrixWorld * boneInverse should be identity`);
    for (const b of r.bind.slice(0, 8))
      console.log(`     ${b.bone.padEnd(16)} moves ${String(b.move).padStart(8)}` +
                  `  turns ${String(b.turn).padStart(7)} deg  scale off ${b.scale}`);
    console.log(off.length
      ? `  ** ${off.length} of ${r.bind.length} bones do NOT return identity at bind pose.`
        + `\n     The inverse bind matrices do not describe this rest pose: perfect`
        + `\n     standing still, wrong the moment anything animates it.`
      : `     all ${r.bind.length} bones return identity — the inverse bind matrices`
        + `\n     agree with the rest pose, and this is NOT the fault either.`);
  }
  console.log(bad.length
    ? `\n  ${bad.length} joint index(es) do not point at the bone their vertices sit on.`
      + `\n  That is a skinIndex/skeleton mismatch: identity at bind pose, smeared once posed.`
    : `\n  every joint index points at the bone its vertices sit on — the binding is sound,`
      + `\n  and the mesh is NOT mis-indexed. The fault is elsewhere.`);
}
await browser.close(); await closeSrv();
