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

  return { chain, bchain, odd, bind: dec(m.bindMatrix),
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
  console.log(`\n  bones carrying a local scale of their own: `
    + (out.odd.length ? out.odd.map(o => `${o.bone} [${o.s.join(", ")}]`).join("; ") : "none"));
  console.log(`\n  A node whose x and z agree but whose y differs is the one shearing`);
  console.log(`  every rotation beneath it.`);
}
await browser.close(); await closeSrv();
