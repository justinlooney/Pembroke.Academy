/* Do the mesh's EDGES stretch when it is posed?
 *
 *     node tools/probe-edge-stretch.mjs [figure]
 *
 * probe-skin-tear reported "nothing drifts" and I read it as clearing
 * the skinning. It did not. It sampled only vertices weighted >= 0.98
 * to a single bone — 725 of 119,483, 0.6% of the mesh — and those are
 * rigid BY DEFINITION. The other 99.4% are blended across two to four
 * bones, and blended vertices are exactly where a mesh pulls apart.
 *
 * So this skins on the CPU, the way the GPU does — sum of
 * weight * (boneMatrix * bindMatrix * position) — and measures every
 * sampled EDGE against its own rest length. A torn mesh has edges many
 * times their rest length. A sound one holds them near constant however
 * the body moves.
 *
 * Reported as a ratio, so it means the same anywhere on the body, and
 * per bone-pair so a tear can be located. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const MODE = process.argv[3] === "synth" ? "synth" : "clip";
/* "uniform" removes the figure group's non-uniform breadth scale before
 * measuring — the controlled half of the A/B that tests whether that
 * scale is what tears the mesh. */
const UNI = process.argv.includes("uniform");
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction((w) => (window.__students || [])
  .some(s => s.g?.userData?.figure === w && s.g?.userData?.anim?.current) ? true : null,
  WANT, { timeout: 300_000 }).catch(() => {});

const out = await page.evaluate(({ want, mode, uni }) => {
  const THREE = window.__app.THREE;
  const s = (window.__students || []).find(x => x.g?.userData?.figure === want);
  if (!s) return { error: `${want} is not out today` };
  let m = null;
  s.g.traverse(o => { if (!m && o.isSkinnedMesh) m = o; });
  if (!m) return { error: "no SkinnedMesh" };
  const geo = m.geometry, idx = geo.attributes.skinIndex,
        wgt = geo.attributes.skinWeight, pos = geo.attributes.position;
  const index = geo.index;
  if (!index) return { error: "geometry is not indexed — no edges to measure" };

  /* the GPU's sum, on the CPU */
  const skinned = (i, out) => {
    out.set(0, 0, 0);
    const base = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix);
    const tmp = new THREE.Vector3(), mat = new THREE.Matrix4();
    for (let k = 0; k < 4; k++){
      const w = wgt.getComponent(i, k);
      if (w <= 1e-5) continue;
      const j = idx.getComponent(i, k);
      const b = m.skeleton.bones[j];
      if (!b) continue;
      mat.multiplyMatrices(b.matrixWorld, m.skeleton.boneInverses[j]);
      tmp.copy(base).applyMatrix4(mat).multiplyScalar(w);
      out.add(tmp);
    }
    return out.applyMatrix4(m.bindMatrixInverse);
  };

  /* sample edges from the index buffer */
  const edges = [];
  const step = Math.max(3, Math.floor(index.count / 12000) * 3);
  for (let t = 0; t + 2 < index.count; t += step){
    const a = index.getX(t), b = index.getX(t + 1);
    if (a !== b) edges.push([a, b]);
  }
  if (!edges.length) return { error: "no edges sampled" };

  const measure = () => {
    s.g.updateMatrixWorld(true);
    const A = new THREE.Vector3(), B = new THREE.Vector3(), out = [];
    for (const [a, b] of edges) out.push(skinned(a, A).distanceTo(skinned(b, B)));
    return out;
  };

  const breadth = [s.g.scale.x, s.g.scale.y, s.g.scale.z].map(v => +v.toFixed(4));
  if (uni) s.g.scale.set(1, 1, 1);
  s.g.updateMatrixWorld(true);

  let posed, bind, posedWorld, drove = "";
  if (mode === "synth"){
    /* No clip, no retarget, no animation. Start from the asset's own bind
     * pose and turn ONE bone by a known 45 deg. A sound rig barely changes
     * any edge length under that; a rig whose bind matrices and weights
     * disagree tears immediately. This separates a bad ASSET from a bad
     * POSE, which a clip-driven measurement cannot do. */
    m.skeleton.pose();
    bind = measure();
    let hinge = null;
    m.skeleton.bones.forEach(b => { if (!hinge && /RightUpperArm|RightArm/i.test(b.name)) hinge = b; });
    if (!hinge) return { error: "no right upper arm bone to turn" };
    hinge.quaternion.multiply(new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4));
    posed = measure();
    posedWorld = m.skeleton.bones.map(b => b ? b.matrixWorld.clone() : null);
    m.skeleton.pose();
    m.skeleton.update();
    drove = `${hinge.name} turned 45 deg from bind — no clip involved`;
  } else {
    posed = measure();
    /* Snapshot the ANIMATED bone matrices now. skeleton.pose() below wipes
     * them, and they cannot be restored afterwards: a borrowed clip's pose
     * is written by a post-mixer pass every frame, so replaying the mixer
     * brings back nothing. Everything downstream reads this snapshot. */
    posedWorld = m.skeleton.bones.map(b => b ? b.matrixWorld.clone() : null);
    m.skeleton.pose();
    bind = measure();
    m.skeleton.update();
    drove = `clip "${s.g.userData.anim?.current}"`;
  }

  /* ── is the instrument sound? ──────────────────────────────────────
   * Every ratio below divides by `bind`, which is this same CPU skinning
   * evaluated after skeleton.pose(). Two things could make that a lie:
   * the CPU sum could disagree with what the GPU does, or skeleton.pose()
   * could fail to reproduce the asset's actual bind pose.
   *
   * Both are testable at once. Skinning a vertex AT bind pose must
   * reproduce the raw geometry exactly — that is what a bind pose means.
   * So compare `bind` against the plain distance between the two raw
   * positions. Agreement validates the instrument; disagreement means
   * every number below is measuring my own arithmetic, not the mesh. */
  const A0 = new THREE.Vector3(), B0 = new THREE.Vector3();
  let rawWorst = 0, rawScale = 0;
  edges.forEach(([a, b], n) => {
    A0.fromBufferAttribute(pos, a); B0.fromBufferAttribute(pos, b);
    const raw = A0.distanceTo(B0);
    if (!(raw > 1e-6) || !(bind[n] > 1e-9)) return;
    /* bind lengths may sit in a uniformly scaled copy of geometry space,
     * so compare the RATIO's consistency, not the raw difference */
    const r = bind[n] / raw;
    rawScale += r;
    rawWorst = Math.max(rawWorst, r);
  });
  const rawMean = rawScale / edges.length;
  let rawSpread = 0;
  edges.forEach(([a, b], n) => {
    A0.fromBufferAttribute(pos, a); B0.fromBufferAttribute(pos, b);
    const raw = A0.distanceTo(B0);
    if (!(raw > 1e-6) || !(bind[n] > 1e-9)) return;
    rawSpread = Math.max(rawSpread, Math.abs(bind[n] / raw / rawMean - 1));
  });

  /* and against three.js's own skinning, which is the ground truth for
   * what the GPU will draw */
  let vsThree = null;
  if (typeof m.applyBoneTransform === "function"){
    const mine = new THREE.Vector3(), theirs = new THREE.Vector3();
    let worstGap = 0;
    for (let n = 0; n < Math.min(400, edges.length); n++){
      const i = edges[n][0];
      skinned(i, mine);
      theirs.fromBufferAttribute(pos, i);
      m.applyBoneTransform(i, theirs);
      worstGap = Math.max(worstGap, mine.distanceTo(theirs));
    }
    vsThree = +worstGap.toFixed(6);
  }

  /* A ratio divides by the rest length, so a near-degenerate sliver edge
   * yields a spectacular ratio from a trivial movement. Judge each edge
   * against the mesh's OWN typical edge, and report the sliver and the
   * ordinary cases separately so neither can masquerade as the other. */
  const lens = bind.filter(v => v > 0).slice().sort((a, b) => a - b);
  const medLen = lens[lens.length >> 1] || 1;
  let worst = 0, worstAt = -1, stretched = 0, usable = 0,
      slivers = 0, worstReal = 0, worstRealAt = -1, realUsable = 0;
  edges.forEach(([a], n) => {
    const r = bind[n], p = posed[n];
    if (!(r > 1e-4)) return;
    usable++;
    const ratio = p / r;
    if (ratio > 1.5 || ratio < 0.5) stretched++;
    if (ratio > worst){ worst = ratio; worstAt = a; }
    /* an edge worth believing: at least a fifth of a typical edge */
    if (r < medLen * 0.2){ if (ratio > 1.5 || ratio < 0.5) slivers++; return; }
    realUsable++;
    if (ratio > worstReal){ worstReal = ratio; worstRealAt = a; }
  });
  const realStretched = (() => {
    let c = 0;
    edges.forEach(([, ], n) => {
      const r = bind[n], p = posed[n];
      if (!(r > 1e-4) || r < medLen * 0.2) return;
      const ratio = p / r;
      if (ratio > 1.5 || ratio < 0.5) c++;
    });
    return c;
  })();
  /* the autopsy should follow the believable worst, not a sliver */
  if (worstRealAt >= 0) worstAt = worstRealAt;
  /* which bone owns the worst edge */
  let worstBone = "?";
  if (worstAt >= 0){
    let best = 0, bj = -1;
    for (let k = 0; k < 4; k++){
      const w = wgt.getComponent(worstAt, k);
      if (w > best){ best = w; bj = idx.getComponent(worstAt, k); }
    }
    worstBone = m.skeleton.bones[bj]?.name || "?";
  }
  /* Does skinIndex ever name a bone the skeleton does not have?  A vertex
   * whose weight lands on a missing bone loses that share of its position
   * and collapses toward the origin — sparse, extreme, exactly this shape. */
  const nBones = m.skeleton.bones.length;
  let maxIdx = -1, shortWeight = 0, danglers = 0;
  for (let i = 0; i < pos.count; i++){
    let live = 0, dangling = false;
    for (let k = 0; k < 4; k++){
      const j = idx.getComponent(i, k), w = wgt.getComponent(i, k);
      if (j > maxIdx) maxIdx = j;
      if (w <= 1e-5) continue;
      if (j >= nBones || !m.skeleton.bones[j]) { dangling = true; continue; }
      live += w;
    }
    if (dangling) danglers++;
    if (live < 0.99) shortWeight++;
  }

  /* the worst edge's own anatomy */
  let worstVert = null;
  if (worstAt >= 0){
    const pairs = [];
    for (let k = 0; k < 4; k++){
      const j = idx.getComponent(worstAt, k), w = wgt.getComponent(worstAt, k);
      if (w > 1e-5) pairs.push({ bone: m.skeleton.bones[j]?.name || `#${j} MISSING`,
                                 w: +w.toFixed(3) });
    }
    worstVert = pairs;
  }

  /* Where would EACH of the worst vertex's bones put it on its own?
   * Blending only explodes when the candidates disagree, so the spread
   * between them names the bone that is wrong. And each bone's bind-delta
   * is decomposed: a delta carrying scale != 1 blows up every vertex it
   * touches, however correct the weights are. */
  let spread = null, deltas = [];
  if (worstAt >= 0){
    const base = new THREE.Vector3().fromBufferAttribute(pos, worstAt)
                   .applyMatrix4(m.bindMatrix);
    const cand = [], mat = new THREE.Matrix4();
    for (let k = 0; k < 4; k++){
      const w = wgt.getComponent(worstAt, k);
      if (w <= 1e-5) continue;
      const j = idx.getComponent(worstAt, k), b = m.skeleton.bones[j];
      if (!b || !posedWorld[j]) continue;
      mat.multiplyMatrices(posedWorld[j], m.skeleton.boneInverses[j]);
      const p = base.clone().applyMatrix4(mat).applyMatrix4(m.bindMatrixInverse);
      const q = new THREE.Quaternion(), t = new THREE.Vector3(),
            sc = new THREE.Vector3();
      mat.decompose(t, q, sc);
      cand.push({ bone: b.name, w: +w.toFixed(3), p,
                  turn: +(2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI).toFixed(1),
                  scale: [sc.x, sc.y, sc.z].map(v => +v.toFixed(3)) });
    }
    let far = 0;
    for (let a = 0; a < cand.length; a++)
      for (let b2 = a + 1; b2 < cand.length; b2++)
        far = Math.max(far, cand[a].p.distanceTo(cand[b2].p));
    spread = { far: +far.toFixed(3), cand: cand.map(c => ({ bone: c.bone, w: c.w,
                turn: c.turn, scale: c.scale })) };
  }

  /* Every bone's bind-delta scale. These deltas are world-space, so they
   * ALL carry the character group's world scale — that is expected and is
   * cancelled downstream by bindMatrixInverse. A fault is a bone that
   * differs from its SIBLINGS, so each is compared to the median. */
  const scales = [];
  for (let j = 0; j < nBones; j++){
    const b = m.skeleton.bones[j];
    if (!b || !posedWorld[j]) continue;
    const mat = new THREE.Matrix4().multiplyMatrices(posedWorld[j],
                  m.skeleton.boneInverses[j]);
    const q = new THREE.Quaternion(), t = new THREE.Vector3(),
          sc = new THREE.Vector3();
    mat.decompose(t, q, sc);
    scales.push({ bone: b.name, s: [sc.x, sc.y, sc.z] });
  }
  const med = [0, 1, 2].map(a => {
    const v = scales.map(x => x.s[a]).sort((p, q2) => p - q2);
    return v[v.length >> 1];
  });
  for (const x of scales){
    const off = Math.max(...[0, 1, 2].map(a => Math.abs(x.s[a] / med[a] - 1)));
    if (off > 0.02) deltas.push({ bone: x.bone, off: +(off * 100).toFixed(1),
                                  scale: x.s.map(v => +v.toFixed(3)) });
  }
  const medianScale = med.map(v => +v.toFixed(3));

  return { sampled: edges.length, usable, stretched, worst: +worst.toFixed(2),
           worstBone, clip: s.g.userData.anim?.current, verts: pos.count,
           nBones, maxIdx, shortWeight, danglers, worstVert, spread, deltas,
           medianScale, drove, breadth, uni,
           rawMean: +rawMean.toFixed(4), rawSpread: +rawSpread.toFixed(4), vsThree,
           medLen: +medLen.toFixed(6), slivers, realStretched, realUsable,
           worstReal: +worstReal.toFixed(2) };
}, { want: WANT, mode: MODE, uni: UNI });

if (out.error) console.log("  " + out.error);
else {
  console.log(`\n${WANT} · ${out.drove} · ${out.verts} verts · ${out.usable} edges measured`);
  console.log(`  figure group breadth scale ${out.breadth.join(", ")}`
    + (out.uni ? "  -> forced to 1, 1, 1 for this run" : "  (left as the game sets it)") + "\n");
  console.log(`  INSTRUMENT CHECK — skinning at bind must reproduce the raw mesh`);
  console.log(`    bind/raw edge length: mean ${out.rawMean}, worst deviation from`);
  console.log(`    that mean ${(out.rawSpread * 100).toFixed(2)}%  (a few % means sound; large means the`);
  console.log(`    numbers below describe my arithmetic, not the mesh)`);
  console.log(`    my CPU skinning vs three.js applyBoneTransform, worst gap: `
    + (out.vsThree === null ? "unavailable" : out.vsThree));
  console.log(``);
  console.log(`  typical (median) rest edge length: ${out.medLen}`);
  console.log(`  ALL edges      — stretched past 1.5x or under 0.5x:  ${out.stretched} of ${out.usable}`
    + `, worst ${out.worst}x`);
  console.log(`  of those, on sliver edges under a fifth of typical:  ${out.slivers}`);
  console.log(`  ORDINARY edges — stretched:  ${out.realStretched} of ${out.realUsable}`
    + `, worst ${out.worstReal}x   (dominant bone ${out.worstBone})`);
  if (out.worstVert) console.log(`  worst edge's vertex is weighted: `
    + out.worstVert.map(p => `${p.bone} ${p.w}`).join(", "));
  console.log(`\n  skeleton has ${out.nBones} bones; highest skinIndex used is ${out.maxIdx}`);
  console.log(`  vertices weighted to a bone the skeleton lacks:  ${out.danglers}`);
  console.log(`  vertices whose surviving weight sums under 0.99: ${out.shortWeight}`);
  if (out.spread){
    console.log(`\n  where each bone alone would put that vertex — spread ${out.spread.far} units:`);
    for (const c of out.spread.cand)
      console.log(`    ${c.bone.padEnd(16)} w ${String(c.w).padEnd(6)} delta turns ${String(c.turn).padStart(6)} deg   scale ${c.scale.join(", ")}`);
  }
  console.log(`\n  every bind-delta carries the group's world scale [${out.medianScale.join(", ")}],`);
  console.log(`  which bindMatrixInverse cancels. Bones differing from that median by >2%:`);
  console.log(`    ` + (out.deltas.length
    ? out.deltas.map(d => `${d.bone} off ${d.off}% [${d.scale.join(", ")}]`).join("; ")
    : `none — every bone is scaled like its siblings, so scale is not the fault`));
  console.log(`\n  An edge's length is a property of the MESH, not the pose. Skinning`);
  console.log(`  bends a body; it does not lengthen the cloth between two vertices.`);
  const pct = out.realUsable ? (out.realStretched / out.realUsable * 100).toFixed(2) : "0";
  console.log(out.realStretched
    ? `\n  ${out.realStretched} of ${out.realUsable} ORDINARY edges (${pct}%) change length`
      + `\n  materially. The mesh IS being pulled apart, worst at ${out.worstBone}.`
    : `\n  No ordinary edge changes length materially — the ${out.stretched} flagged above are`
      + `\n  all degenerate slivers, where a ratio means nothing. The mesh is NOT being`
      + `\n  pulled apart, and the shredded render is something other than deformation.`);
}
await browser.close(); await closeSrv();
