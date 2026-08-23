/* Where does the non-uniform scale come from?
 *
 *     node tools/probe-scale-chain.mjs [figure]
 *
 * probe-edge-stretch found the mesh tears with NO clip playing — one bone
 * turned 45 deg from bind is enough — and that every bone's bind-delta
 * carries the scale [24.387, 22.857, 24.387]. x and z agree; y does not.
 *
 * A rotation under a non-uniform scale is not a rotation any more, it is
 * a shear, and blending sheared matrices across four bones is what pulls
 * a mesh into shards. prepFigure scales the figure with setScalar, which
 * is uniform, so the 6.7% in y enters somewhere else. This walks the
 * chain from the SkinnedMesh to the scene and prints every node's scale,
 * so the culprit names itself instead of being guessed at. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction((w) => (window.__students || [])
  .some(s => s.g?.userData?.figure === w) ? true : null, WANT, { timeout: 300_000 }).catch(() => {});

const out = await page.evaluate((want) => {
  const THREE = window.__app.THREE;
  const s = (window.__students || []).find(x => x.g?.userData?.figure === want);
  if (!s) return { error: `${want} is not out today` };
  let m = null;
  s.g.traverse(o => { if (!m && o.isSkinnedMesh) m = o; });
  if (!m) return { error: "no SkinnedMesh" };
  s.g.updateMatrixWorld(true);

  const dec = (mat) => {
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    mat.decompose(t, q, sc);
    return [sc.x, sc.y, sc.z].map(v => +v.toFixed(4));
  };
  const chain = [];
  for (let o = m; o; o = o.parent)
    chain.push({ name: o.name || o.type, type: o.type,
                 local: [o.scale.x, o.scale.y, o.scale.z].map(v => +v.toFixed(4)),
                 world: dec(o.matrixWorld) });

  /* the bone side of the same question */
  const root = m.skeleton.bones[0];
  const bchain = [];
  for (let o = root; o; o = o.parent)
    bchain.push({ name: o.name || o.type,
                  local: [o.scale.x, o.scale.y, o.scale.z].map(v => +v.toFixed(4)) });

  /* any bone carrying a local scale of its own */
  const odd = m.skeleton.bones.filter(b => b &&
    (Math.abs(b.scale.x - 1) > 1e-4 || Math.abs(b.scale.y - 1) > 1e-4 ||
     Math.abs(b.scale.z - 1) > 1e-4))
    .map(b => ({ bone: b.name, s: [b.scale.x, b.scale.y, b.scale.z].map(v => +v.toFixed(4)) }));

  /* Does the mesh node's own transform reach the render at all?
   * three.js defaults a SkinnedMesh to AttachedBindMode, which recomputes
   * bindMatrixInverse from the CURRENT matrixWorld every frame. If that is
   * on, matrixWorld and its inverse cancel and the node's transform has no
   * effect on where the vertices land -- so scaling the mesh to vary a
   * build would silently do nothing. The world box is the check that does
   * not depend on my reading of the shader: it is measured through the
   * skeleton, the same path the renderer uses. */
  const box = new THREE.Box3().setFromObject(s.g);
  const size = new THREE.Vector3(); box.getSize(size);

  /* Box3 turned out to report the same size whether the breadth sits on
   * the group or on the mesh, so it cannot answer this. Take the ground
   * truth instead: applyBoneTransform is three.js's own documented way to
   * get a skinned vertex, and matrixWorld puts it in the world. Measure
   * the body's actual width and height that way. */
  /* At BIND pose, so two runs are comparable: a clip caught at a different
   * moment changes the width by more than any breadth setting does. */
  m.skeleton.pose();
  s.g.updateMatrixWorld(true);
  const pos = m.geometry.attributes.position;
  const v = new THREE.Vector3();
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const step = Math.max(1, Math.floor(pos.count / 4000));
  for (let i = 0; i < pos.count; i += step){
    v.fromBufferAttribute(pos, i);
    m.applyBoneTransform(i, v);
    v.applyMatrix4(m.matrixWorld);
    const c = [v.x, v.y, v.z];
    for (let a = 0; a < 3; a++){
      if (c[a] < lo[a]) lo[a] = c[a];
      if (c[a] > hi[a]) hi[a] = c[a];
    }
  }
  const skinBox = [0, 1, 2].map(a => +(hi[a] - lo[a]).toFixed(3));

  return { chain, bchain, odd, bind: dec(m.bindMatrix),
           bindMode: m.bindMode,
           box: [size.x, size.y, size.z].map(v => +v.toFixed(3)),
           wide: +(size.x / size.y).toFixed(4),
           skinBox, skinWide: +(skinBox[0] / skinBox[1]).toFixed(4),
           inv0: dec(new THREE.Matrix4().copy(m.skeleton.boneInverses[0]).invert()),
           figureScale: [s.g.scale.x, s.g.scale.y, s.g.scale.z].map(v => +v.toFixed(4)) };
}, WANT);

if (out.error) { console.log("  " + out.error); }
else {
  console.log(`\n${WANT} — SkinnedMesh up to the scene (local scale | world scale)\n`);
  for (const c of out.chain)
    console.log(`  ${c.name.padEnd(26)} ${String(c.local.join(", ")).padEnd(22)} | ${c.world.join(", ")}`);
  console.log(`\n  bone root up to the scene (local scale)`);
  for (const c of out.bchain) console.log(`  ${c.name.padEnd(26)} ${c.local.join(", ")}`);
  console.log(`\n  bindMatrix scale        ${out.bind.join(", ")}`);
  console.log(`  boneInverse[0] inverted ${out.inv0.join(", ")}`);
  console.log(`  student group scale     ${out.figureScale.join(", ")}`);
  console.log(`  bindMode                ${out.bindMode}`
    + (out.bindMode === "attached"
       ? "   <- bindMatrixInverse is recomputed from matrixWorld every"
         + "\n                          frame, so the mesh node's own transform cancels"
         + "\n                          out and cannot change where a vertex lands"
       : ""));
  console.log(`  world box (Box3)        ${out.box.join(" x ")}  (width/height ${out.wide})`);
  console.log(`  world box (skinned)     ${out.skinBox.join(" x ")}  (width/height ${out.skinWide})`);
  console.log(`     measured through applyBoneTransform + matrixWorld, which is the`);
  console.log(`     path the renderer uses. This is the one that answers whether a`);
  console.log(`     breadth scale reaches the body. Measured at BIND pose, so two`);
  console.log(`     runs are comparable.`);
  console.log(`\n  bones carrying a local scale of their own: `
    + (out.odd.length ? out.odd.map(o => `${o.bone} [${o.s.join(", ")}]`).join("; ") : "none"));
  console.log(`\n  A node whose x and z agree but whose y differs is the one shearing`);
  console.log(`  every rotation beneath it.`);
}
await browser.close(); await closeSrv();
