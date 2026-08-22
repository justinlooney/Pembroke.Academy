/* How are the skin weights actually distributed?
 *
 *     node tools/probe-skin-weights.mjs [figure]
 *
 * Everything else about these bodies has now been measured and is
 * sound: they rest in a T-pose, so do the donors, the two agree to
 * within a few degrees, 22 of 24 bones pair with mirrored=false,
 * skinIndex points at the bone its vertices sit on, and every inverse
 * bind returns identity. The retarget reproduces the donor's directions
 * to 3-6 degrees, measured from inside the function.
 *
 * What was passed over: only 11 of 24 bones had ANY vertex weighted
 * >= 0.85, and several had almost none — Pelvis 19 vertices, Spine2 13,
 * the feet about 50 — while Head had 3,518. On a well-weighted 119k
 * character most major bones own a block of vertices outright. Weights
 * smeared thinly across many joints shear a mesh when it moves, while
 * leaving bones, indices and inverse binds all correct, which is every
 * remaining fact in this bug.
 *
 * So this measures the distribution rather than the correspondence:
 * how many bones each vertex is split across, how much weight each bone
 * owns, and whether the weights are normalised at all. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__castLib, null, { timeout: 240_000 });
await page.waitForFunction((w) => (window.__castLib || {})[w] ? true : null,
                           WANT, { timeout: 300_000 }).catch(() => {});

const out = await page.evaluate((want) => {
  const lib = window.__castLib || {};
  const entry = lib[want];
  if (!entry) return { error: `${want} not loaded. have: ${Object.keys(lib).join(", ")}` };
  const root = entry.scene || entry;
  let m = null;
  root.traverse(o => { if (!m && o.isSkinnedMesh) m = o; });
  if (!m) return { error: "no SkinnedMesh" };
  const geo = m.geometry, idx = geo.attributes.skinIndex, wgt = geo.attributes.skinWeight;
  if (!idx || !wgt) return { error: "no skin attributes" };
  const bones = m.skeleton.bones.map(b => b.name);

  const perBone = new Array(bones.length).fill(0);   /* total weight owned */
  const domin  = new Array(bones.length).fill(0);    /* vertices it owns outright */
  const spread = [0, 0, 0, 0, 0];                    /* how many bones a vertex splits across */
  let unnormalised = 0, maxSum = 0, minSum = Infinity, biggestMin = 0;
  const n = idx.count;
  for (let i = 0; i < n; i++){
    let sum = 0, used = 0, best = 0, bestJ = -1;
    for (let k = 0; k < 4; k++){
      const w = wgt.getComponent(i, k);
      if (w <= 1e-4) continue;
      const j = idx.getComponent(i, k);
      sum += w; used++;
      perBone[j] = (perBone[j] || 0) + w;
      if (w > best){ best = w; bestJ = j; }
    }
    if (bestJ >= 0 && best >= 0.85) domin[bestJ]++;
    spread[Math.min(4, used)]++;
    maxSum = Math.max(maxSum, sum); minSum = Math.min(minSum, sum);
    if (Math.abs(sum - 1) > 0.02) unnormalised++;
    biggestMin = Math.max(biggestMin, best < 0.4 ? 1 : 0);
  }
  return { bones, perBone, domin, spread, verts: n, unnormalised,
           maxSum: +maxSum.toFixed(3), minSum: +minSum.toFixed(3),
           mesh: m.name || "(unnamed)" };
}, WANT);

if (out.error) console.log("  " + out.error);
else {
  console.log(`\n${WANT} · mesh ${out.mesh} · ${out.verts} vertices · ${out.bones.length} bones\n`);
  console.log("  bone              total weight   owns outright (w>=0.85)");
  const rows = out.bones.map((b, i) => ({ b, w: out.perBone[i] || 0, d: out.domin[i] || 0 }));
  for (const r of rows)
    console.log(`  ${r.b.padEnd(16)} ${r.w.toFixed(0).padStart(10)}   ${String(r.d).padStart(10)}` +
                (r.w < out.verts * 0.002 ? "   <<< almost nothing" : ""));
  console.log(`\n  vertices split across N bones:`);
  for (let k = 1; k <= 4; k++)
    console.log(`     ${k} bone${k > 1 ? "s" : ""}   ${String(out.spread[k]).padStart(7)}` +
                `  (${(out.spread[k] / out.verts * 100).toFixed(1)}%)`);
  console.log(`\n  weight sums: min ${out.minSum}, max ${out.maxSum};` +
              ` ${out.unnormalised} vertices (${(out.unnormalised / out.verts * 100).toFixed(2)}%) do not sum to 1`);
  const dead = rows.filter(r => r.w < out.verts * 0.002);
  console.log(dead.length
    ? `\n  ${dead.length} bone(s) carry almost no weight: ${dead.map(r => r.b).join(", ")}.`
      + `\n  A bone nothing is attached to moves no skin — the limb rotates and the`
      + `\n  geometry stays where it was, which shears rather than bends.`
    : `\n  Every bone carries real weight.`);
  if (out.unnormalised > out.verts * 0.01)
    console.log(`  AND the weights do not sum to 1 on ${(out.unnormalised / out.verts * 100).toFixed(1)}%` +
                ` of vertices — those\n  vertices are scaled toward or away from the origin as the body moves.`);
}
await browser.close(); await closeSrv();
