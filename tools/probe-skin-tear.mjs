/* Does the SKIN tear when the body is posed?
 *
 *     node tools/probe-skin-tear.mjs [figure]
 *
 * Rendered close up, at both ends of the quality ladder, char17's
 * jacket is shredded into overlapping shards and the sleeves are
 * corrugated into ribbons. Identical at rung 0 and rung 5, so it is not
 * the ladder. It is the mesh.
 *
 * Everything measured in this investigation was measured on BONES, or
 * on the mesh AT BIND POSE: joint indices point at the right bones,
 * every inverse bind returns identity, weights sum to 1, joint angles
 * are anatomically plausible, the retarget reproduces the donor to 3-6
 * degrees. All true, and none of it looks at a single skinned vertex
 * while the body is moving.
 *
 * The invariant that does: a vertex weighted ENTIRELY to one bone keeps
 * a constant position in that bone's local frame, whatever the pose.
 * Skinning is rigid for such a vertex by definition. If that offset
 * changes between bind pose and an animated frame, the vertex is being
 * dragged somewhere it does not belong — that is tearing, as a number.
 *
 * Reported in bone-lengths so it means the same on any rig. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction((w) => (window.__students || [])
  .some(s => s.g?.userData?.figure === w && s.g?.userData?.anim?.current) ? true : null,
  WANT, { timeout: 300_000 }).catch(() => {});

const out = await page.evaluate((want) => {
  const THREE = window.__app.THREE;
  const s = (window.__students || []).find(x => x.g?.userData?.figure === want);
  if (!s) return { error: `${want} is not out today` };
  let m = null;
  s.g.traverse(o => { if (!m && o.isSkinnedMesh) m = o; });
  if (!m) return { error: "no SkinnedMesh" };
  const geo = m.geometry, idx = geo.attributes.skinIndex,
        wgt = geo.attributes.skinWeight, pos = geo.attributes.position;
  const bones = m.skeleton.bones;

  /* sample vertices DOMINATED by one bone — those are the ones whose
     offset must be invariant */
  const picks = [];
  const step = Math.max(1, Math.floor(pos.count / 6000));
  for (let i = 0; i < pos.count; i += step){
    for (let k = 0; k < 4; k++){
      if (wgt.getComponent(i, k) >= 0.98){ picks.push([i, idx.getComponent(i, k)]); break; }
    }
  }
  if (!picks.length) return { error: "no vertex is dominated >= 0.98 by a single bone" };

  const local = (poseIt) => {
    if (poseIt) m.skeleton.pose();
    s.g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4(), v = new THREE.Vector3(), out = [];
    for (const [i, j] of picks){
      const b = bones[j]; if (!b){ out.push(null); continue; }
      inv.copy(b.matrixWorld).invert();
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      out.push(v.clone());
    }
    return out;
  };

  /* bone length, for scale */
  let span = 0;
  for (const b of bones){
    for (const c of b.children){
      if (!c.isBone) continue;
      span = Math.max(span, b.getWorldPosition(new THREE.Vector3())
                              .distanceTo(c.getWorldPosition(new THREE.Vector3())));
    }
  }
  span = span || 1;

  const posed = local(false);          /* as the campus is animating it */
  const bind  = local(true);           /* bind pose */
  m.skeleton.update();

  let worst = 0, worstBone = "", moved = 0;
  const per = new Map();
  picks.forEach(([, j], n) => {
    const a = posed[n], b = bind[n];
    if (!a || !b) return;
    const d = a.distanceTo(b) / span;
    if (d > 0.02) moved++;
    if (d > worst){ worst = d; worstBone = bones[j]?.name || "?"; }
    const cur = per.get(bones[j]?.name) || { n: 0, worst: 0 };
    cur.n++; cur.worst = Math.max(cur.worst, d);
    per.set(bones[j]?.name, cur);
  });
  return { sampled: picks.length, moved, worst: +worst.toFixed(3), worstBone,
           span: +span.toFixed(2), clip: s.g.userData.anim?.current,
           per: [...per].map(([b, v]) => ({ b, n: v.n, worst: +v.worst.toFixed(3) })) };
}, WANT);

if (out.error) console.log("  " + out.error);
else {
  console.log(`\n${WANT} · clip "${out.clip}" · ${out.sampled} vertices dominated >= 0.98`);
  console.log(`bone length used for scale: ${out.span}\n`);
  out.per.sort((a, b) => b.worst - a.worst);
  console.log("  bone              verts   worst drift (bone-lengths)");
  for (const p of out.per)
    console.log(`  ${String(p.b).padEnd(16)} ${String(p.n).padStart(6)}   ${String(p.worst).padStart(6)}` +
                (p.worst > 0.02 ? "   <<<" : ""));
  console.log(`\n  A vertex weighted 0.98+ to one bone must hold a CONSTANT offset in`);
  console.log(`  that bone's frame. Drift is the mesh being pulled apart.`);
  console.log(out.moved
    ? `\n  ${out.moved} of ${out.sampled} drift by more than 2% of a bone length;` +
      ` worst ${out.worst} at ${out.worstBone}.`
    : `\n  Nothing drifts. The skin is rigid where it should be — the tearing is` +
      `\n  NOT a skinning failure, and the render must be explained another way.`);
}
await browser.close(); await closeSrv();
