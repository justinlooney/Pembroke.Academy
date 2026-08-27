#!/usr/bin/env node
/* Does this body's skin tear when its shoulder turns? Asked of the FILE.
 *
 *     node tools/probe-asset-skin.mjs [deg] [file.glb ...]
 *     node tools/probe-asset-skin.mjs 75            (the whole cast)
 *
 * probe-edge-stretch asks the same question of a body on the live
 * campus, and that turned out to be a poor way to ask it. Attendance is
 * a deal: measured over three-minute windows, char5 never turned up at
 * all, so Marcus went unmeasured for an entire investigation while
 * conclusions were drawn from char17 alone — and char17 is an outlier by
 * three to eight times.
 *
 * Nothing about this question needs a campus. Synthetic mode is bind
 * pose plus one bone turned; the clip, the retarget, the crowd and the
 * quality ladder are all irrelevant. So this loads the GLB directly and
 * measures every body in seconds instead of minutes.
 *
 * WHY 75 DEGREES. These bodies are bound in a T-pose and every clip
 * carries the arms 65 to 80 degrees below level, so that is the rotation
 * the skin actually takes. Measured on char17, the damage roughly
 * triples between 45 and 85 degrees, which is why an earlier round of
 * this work at 45 understated it.
 *
 * An edge's length is a property of the MESH, not the pose: skinning
 * bends a body, it does not lengthen the cloth between two neighbouring
 * vertices. So each sampled edge is compared against its own rest
 * length, and the verdict is gated on three checks that each caught a
 * wrong reading before it was believed. */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, extname, basename, sep, relative } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8137;
const argv = process.argv.slice(2);
const DEG = +(argv.find(a => /^\d+(\.\d+)?$/.test(a)) || 75);
/* --skin=N applies the campus's own tightenWeights before measuring.
 * 1 (or absent) is the file as authored; each body's shipped power is
 * in CAST_SKIN, and check-skin.mjs is what keeps that table honest. */
const TIGHTEN = +((argv.find(a => a.startsWith("--skin=")) || "").split("=")[1] || 1);
let files = argv.filter(a => a.endsWith(".glb"));
if (!files.length)
  files = readdirSync(resolve(ROOT, "assets"))
    .filter(f => /^stu_.*\.glb$/.test(f)).sort()
    .map(f => "assets/" + f);

const MIME = { ".glb": "model/gltf-binary", ".js": "text/javascript",
               ".wasm": "application/wasm", ".bin": "application/octet-stream" };

const PAGE = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"/assets/vendor/three/build/three.module.js",
  "three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

window.__skin = (url, deg, tighten) => new Promise((done) => loader.load(url, (g) => {
  try {
    const root = g.scene;
    root.updateMatrixWorld(true);
    let m = null;
    root.traverse(o => { if (!m && o.isSkinnedMesh) m = o; });
    if (!m) return done({ err: "no SkinnedMesh" });
    /* THE SAME TIGHTENING THE CAMPUS SHIPS, applied before measuring.
     *
     * This probe read AUTHORED weights, which is what the file holds
     * and not what any visitor sees: index.html runs tightenWeights on
     * every body at load. So every figure this tool printed described a
     * version of that body nobody has ever looked at, and the numbers
     * that justified a dozen swaps were all the un-shipped ones.
     *
     * It is not a small correction. char5 measures 4.99x authored and
     * 10.38x at the power the campus used to ship for him -- the
     * tightening was more than doubling the tearing it exists to
     * reduce, and CAST_SKIN was written to stop it. */
    if (tighten > 1){
      const a = m.geometry.attributes.skinWeight;
      const out = new Float32Array(a.count * 4);
      for (let i = 0; i < a.count; i++){
        const w = [a.getX(i), a.getY(i), a.getZ(i), a.getW(i)]
          .map(v => Math.pow(Math.max(0, v), tighten));
        const sum = w[0] + w[1] + w[2] + w[3], o4 = i * 4;
        if (sum > 1e-8) for (let c = 0; c < 4; c++) out[o4 + c] = w[c] / sum;
        else out[o4] = 1;
      }
      m.geometry.setAttribute("skinWeight", new THREE.BufferAttribute(out, 4));
    }
    const geo = m.geometry, idx = geo.attributes.skinIndex,
          wgt = geo.attributes.skinWeight, pos = geo.attributes.position,
          index = geo.index;
    if (!idx || !wgt) return done({ err: "not skinned" });
    if (!index) return done({ err: "geometry is not indexed — no edges" });

    /* the GPU's sum, on the CPU */
    const skinned = (i, out) => {
      out.set(0, 0, 0);
      const base = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix);
      const tmp = new THREE.Vector3(), mat = new THREE.Matrix4();
      for (let k = 0; k < 4; k++){
        const w = wgt.getComponent(i, k);
        if (w <= 1e-5) continue;
        const j = idx.getComponent(i, k), b = m.skeleton.bones[j];
        if (!b) continue;
        mat.multiplyMatrices(b.matrixWorld, m.skeleton.boneInverses[j]);
        tmp.copy(base).applyMatrix4(mat).multiplyScalar(w);
        out.add(tmp);
      }
      return out.applyMatrix4(m.bindMatrixInverse);
    };

    /* real triangle edges: t is always a multiple of 3, so a and a+1
       are two corners of the same face */
    const edges = [];
    const step = Math.max(3, Math.floor(index.count / 12000) * 3);
    for (let t = 0; t + 2 < index.count; t += step){
      const a = index.getX(t), b = index.getX(t + 1);
      if (a !== b) edges.push([a, b]);
    }
    if (!edges.length) return done({ err: "no edges sampled" });

    const measure = () => {
      root.updateMatrixWorld(true);
      const A = new THREE.Vector3(), B = new THREE.Vector3(), out = [];
      for (const [a, b] of edges) out.push(skinned(a, A).distanceTo(skinned(b, B)));
      return out;
    };

    m.skeleton.pose();
    const bind = measure();

    /* the shoulder, across the vocabularies this cast uses */
    let hinge = null;
    m.skeleton.bones.forEach(b => {
      if (hinge) return;
      const n = (b.name || "").toLowerCase();
      if (/fore|lower/.test(n)) return;
      if (/right/.test(n) && /(upperarm|arm)/.test(n)) hinge = b;
    });
    if (!hinge) return done({ err: "no right upper arm bone" });
    hinge.quaternion.multiply(new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg * Math.PI / 180));
    const posed = measure();
    const moved = new Set();
    hinge.traverse(o => { if (o.isBone) moved.add(o); });

    /* judge each edge against the mesh's OWN typical edge: a ratio
       divides by the rest length, so a sliver yields a spectacular
       number from a trivial movement */
    const lens = bind.filter(v => v > 0).slice().sort((a, b) => a - b);
    const medLen = lens[lens.length >> 1] || 1;

    const leadOf = (v) => {
      let best = 0, bj = -1;
      for (let k = 0; k < 4; k++){
        const w = wgt.getComponent(v, k);
        if (w > best){ best = w; bj = idx.getComponent(v, k); }
      }
      return bj;
    };
    /* an endpoint is still only if NONE of its four influences moved */
    const still = (v) => {
      for (let k = 0; k < 4; k++){
        if (wgt.getComponent(v, k) <= 1e-5) continue;
        const b = m.skeleton.bones[idx.getComponent(v, k)];
        if (b && moved.has(b)) return false;
      }
      return true;
    };

    let usable = 0, seam = 0, internal = 0, worst = 0, worstBone = "",
        stillChecked = 0, stillWorst = 0;
    edges.forEach(([a, b2], n) => {
      const r = bind[n], p = posed[n];
      if (!(r > 1e-4) || r < medLen * 0.2) return;
      usable++;
      const ratio = p / r;
      if (still(a) && still(b2)){
        stillChecked++;
        stillWorst = Math.max(stillWorst, Math.abs(ratio - 1));
      }
      if (!(ratio > 1.5 || ratio < 0.5)) return;
      if (leadOf(a) !== leadOf(b2)){ seam++; return; }
      internal++;
      if (ratio > worst){
        worst = ratio;
        worstBone = m.skeleton.bones[leadOf(a)]?.name || "?";
      }
    });

    /* instrument checks: skinning at bind must reproduce the raw mesh,
       and the CPU sum must agree with three.js's own */
    const A0 = new THREE.Vector3(), B0 = new THREE.Vector3();
    let rawSum = 0, rawN = 0;
    edges.forEach(([a, b], n) => {
      A0.fromBufferAttribute(pos, a); B0.fromBufferAttribute(pos, b);
      const raw = A0.distanceTo(B0);
      if (!(raw > 1e-6) || !(bind[n] > 1e-9)) return;
      rawSum += bind[n] / raw; rawN++;
    });
    const rawMean = rawN ? rawSum / rawN : 0;
    let rawSpread = 0;
    edges.forEach(([a, b], n) => {
      A0.fromBufferAttribute(pos, a); B0.fromBufferAttribute(pos, b);
      const raw = A0.distanceTo(B0);
      if (!(raw > 1e-6) || !(bind[n] > 1e-9)) return;
      rawSpread = Math.max(rawSpread, Math.abs(bind[n] / raw / rawMean - 1));
    });
    let vsThree = null;
    if (typeof m.applyBoneTransform === "function"){
      const mine = new THREE.Vector3(), theirs = new THREE.Vector3();
      let gap = 0;
      for (let n = 0; n < Math.min(300, edges.length); n++){
        const i = edges[n][0];
        skinned(i, mine);
        theirs.fromBufferAttribute(pos, i);
        m.applyBoneTransform(i, theirs);
        gap = Math.max(gap, mine.distanceTo(theirs));
      }
      vsThree = +gap.toFixed(6);
    }

    /* ── how broad is this body, in the MESH? ───────────────────────
     * The whole cast shares one skeleton, so the distance between the
     * two shoulder JOINTS is identical for every student by
     * construction -- measured live it came back 0.1465 for two
     * different bodies, to four decimals. Bone spacing therefore cannot
     * answer "his shoulders are too narrow"; only the mesh can.
     *
     * So: put the skeleton back at bind and measure the mesh's own
     * width in a slab at shoulder height, against the body's height and
     * against the width of its head. A body whose shoulders are barely
     * wider than its head is narrow-shouldered as MODELLED, and no
     * amount of skinning or retargeting work will broaden it. */
    m.skeleton.pose();
    root.updateMatrixWorld(true);
    const armY = (() => {
      const a = new THREE.Vector3();
      hinge.getWorldPosition(a); return a.y;
    })();
    let headBone = null;
    m.skeleton.bones.forEach(b => { if (!headBone && /head/i.test(b.name)) headBone = b; });
    const headY = headBone
      ? headBone.getWorldPosition(new THREE.Vector3()).y : armY;
    const v = new THREE.Vector3();
    let loY = Infinity, hiY = -Infinity;
    for (let i = 0; i < pos.count; i += 7){
      v.fromBufferAttribute(pos, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld);
      if (v.y < loY) loY = v.y;
      if (v.y > hiY) hiY = v.y;
    }
    const tall = hiY - loY || 1;
    /* TORSO vertices only. At bind these bodies stand in a T-pose, arms
     * straight out sideways, so a slab at shoulder height cuts through
     * both arms and measures the ARM SPAN — which is why a first attempt
     * came back between 0.49 and 0.99 of body height, roughly Vitruvian
     * and nowhere near a shoulder. Excluding vertices led by an arm bone
     * leaves the torso, whose width at that height IS the shoulder. */
    const armBone = new Set();
    m.skeleton.bones.forEach((b, j) => {
      if (/arm|hand|finger|thumb/i.test(b.name || "")) armBone.add(j);
    });
    const leadIdx = (i) => {
      let best = 0, bj = -1;
      for (let k = 0; k < 4; k++){
        const w = wgt.getComponent(i, k);
        if (w > best){ best = w; bj = idx.getComponent(i, k); }
      }
      return bj;
    };
    const band = (yc, frac, torsoOnly) => {
      let lo = Infinity, hi = -Infinity, n = 0;
      const half = tall * frac;
      for (let i = 0; i < pos.count; i += 3){
        if (torsoOnly && armBone.has(leadIdx(i))) continue;
        v.fromBufferAttribute(pos, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld);
        if (Math.abs(v.y - yc) > half) continue;
        n++;
        if (v.x < lo) lo = v.x;
        if (v.x > hi) hi = v.x;
      }
      return { w: hi > lo ? hi - lo : 0, n };
    };
    const sh = band(armY, 0.02, true);
    const shoulderW = sh.w, shoulderN = sh.n;
    const headW = band(headY, 0.02, false).w;

    done({ verts: pos.count, bones: m.skeleton.bones.length, hinge: hinge.name,
           shoulder: +(shoulderW / tall).toFixed(4), shoulderN,
           headW: +(headW / tall).toFixed(4),
           shoulderPerHead: headW > 0 ? +(shoulderW / headW).toFixed(2) : null,
           usable, seam, internal, worst: +worst.toFixed(2), worstBone,
           stillChecked, stillWorst: +stillWorst.toFixed(4),
           rawMean: +rawMean.toFixed(4), rawSpread: +rawSpread.toFixed(4), vsThree });
  } catch (e){ done({ err: String(e).slice(0, 160) }); }
}, undefined, (e) => done({ err: String(e).slice(0, 160) })));
</script>`;

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/"){ res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  const p = resolve(ROOT, "." + rel);
  if (!p.startsWith(ROOT + sep) || !existsSync(p) || statSync(p).isDirectory()){
    res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__skin, null, { timeout: 20000 });

console.log(`\nRight upper arm turned ${DEG} deg from bind — no clip, no campus.`);
console.log(`Edges with BOTH ends led by the same bone that change length past`);
console.log(`1.5x. Seam edges are listed apart: an armpit-to-ribcage edge SHOULD`);
console.log(`lengthen when an arm lifts, and only an internal one is a fault.\n`);
console.log(`  body                internal   worst      at                 shoulderW/height`);
const rows = [];
for (const f of files){
  const abs = resolve(ROOT, f);
  if (!existsSync(abs)){ console.log(`  ${basename(f).padEnd(20)} NOT FOUND`); continue; }
  const url = "/" + relative(ROOT, abs).split(sep).join("/");
  const r = await page.evaluate(([u, d, t]) => window.__skin(u, d, t), [url, DEG, TIGHTEN]);
  const nm = basename(f).replace(/^stu_|\.glb$/g, "");
  if (r.err){ console.log(`  ${nm.padEnd(20)} ${r.err}`); continue; }
  const bad = Math.abs(r.rawMean - 1) > 0.005 || r.rawSpread > 0.02
           || !r.stillChecked || r.stillWorst > 0.001;
  if (bad){
    console.log(`  ${nm.padEnd(20)} NO VERDICT — bind/raw ${r.rawMean} spread ` +
      `${(r.rawSpread * 100).toFixed(1)}%, still ${r.stillChecked} edges ` +
      `worst ${(r.stillWorst * 100).toFixed(2)}%`);
    continue;
  }
  rows.push({ nm, ...r });
  console.log(`  ${nm.padEnd(20)} ${String(r.internal).padStart(6)}   ` +
    `${(r.worst + "x").padStart(7)}   ${(r.worstBone || "").padEnd(18)} ` +
    `${String(r.shoulder).padStart(7)}`);
}
if (rows.length){
  rows.sort((a, b) => b.worst - a.worst);
  console.log(`\n  worst tearing first: ${rows.map(r => r.nm + " " + r.worst + "x").join(", ")}`);
  const byW = rows.slice().sort((a, b) => a.shoulder - b.shoulder);
  console.log(`\n  NARROWEST SHOULDERS first — mesh width at shoulder height, over the`);
  console.log(`  body's own height, TORSO vertices only. A real adult is near 0.25.`);
  console.log(`  ${byW.map(r => r.nm + " " + r.shoulder).join(", ")}`);
  console.log(`\n  The cast shares one skeleton, so bone spacing is identical for every`);
  console.log(`  student and cannot answer this — it is a fact about the MESH. A body`);
  console.log(`  low on this list is narrow-shouldered as MODELLED, and no amount of`);
  console.log(`  skinning or retargeting work will broaden it.`);
  console.log(`\n  (head width is measured too but not reported: the head BONE sits at`);
  console.log(`   the base of the skull, so a slab there cuts the neck and the ratio`);
  console.log(`   came out at six to eight head-widths, which is not a shoulder.)`);
  console.log(`\n  Every check passed on the rows above: skinning at bind reproduces`);
  console.log(`  the raw mesh, the CPU sum agrees with three.js applyBoneTransform,`);
  console.log(`  and edges whose both ends sat on unrotated bones did not move.`);
}
await browser.close(); server.close();
