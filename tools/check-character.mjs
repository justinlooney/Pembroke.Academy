#!/usr/bin/env node
/**
 * Pembroke Academy — will this character work on the campus?
 *
 *     node tools/check-character.mjs mine.glb [more.glb ...]
 *     node tools/check-character.mjs                    (the whole cast)
 *
 * Written for somebody making their own. Every requirement below was
 * learned by shipping something that broke, and every one of them is
 * SILENT: the file loads, the figure draws, and the fault only shows
 * up as a student standing oddly on a lawn.
 *
 * ── what the campus asks of a body ───────────────────────────────────
 *
 * MEASURABLE. prepFigure scales every figure to about 42 units by its
 * own bounding box. A skeleton with corrupt inverse bind matrices makes
 * that box NaN, and NaN scale sends every vertex to NaN — which the GPU
 * draws as a shape the size of the county. That is the "mega giant
 * walking through campus", and it was one body doing it.
 *
 * NAMED BONES. A clip addresses bones by name, so a clip written for
 * one skeleton lands on another only if the names line up. Four
 * conventions are understood — Mixamo, the same with numeric suffixes,
 * Character Creator (CC_Base_L_Thigh) and Renderpeople
 * (rp_..._upperleg_l). Anything else binds nothing, loads without
 * complaint, and stands perfectly still.
 *
 * REST POSE vs BIND POSE, reported and deliberately NOT judged.
 * Borrowing motion measures each bone's change from its rest, and
 * "rest" is the node transforms in the file — but skinning uses the
 * skin's inverse bind matrices. A model exported in a pose it was not
 * bound in has the two disagreeing. Measured across this cast, on the
 * fourteen bones a clip actually drives:
 *
 *     kenta, isla, nathan     0 degrees
 *     tutor                   median 4      sophia   median 25
 *     alina 120   woman 120   ariel 139     nadia    139
 *     walker                  90 on every one of fourteen
 *
 * It looked at first like the answer to both borrowing failures, and
 * it is not: woman, ariel and alina sit down perfectly while resting
 * in the same band as nadia, who does not. So it is printed as a fact
 * about the file and nothing is concluded from it. What it is good
 * for is a hint about where to look when a borrowed clip comes out
 * wrong — walker, alone in resting 90 degrees from his bind pose on
 * every bone, is also the only body whose clips cannot be lent to
 * anybody.
 *
 * The honest summary: no measurement here has yet been found that
 * predicts a bad retarget. Render it and look at it.
 *
 * DRESSABLE, ideally. The wardrobe tints a student's shirt, shorts,
 * shoes, hair and skin — that is most of what makes a crowd read as
 * people rather than copies. It finds them by NAME, on the mesh or on
 * its material, either will do. Ten of the cast own nothing it can
 * find and wear their factory colours for ever.
 *
 * LIGHT, and the number that matters is not the one people watch.
 * Triangles are nearly free; images are not:
 *
 *     kenta   21,962 tris   1 image    0.24MB
 *     isla    82,566 tris   1 image    0.88MB
 *     nadia   45,094 tris  32 images   4.22MB
 *
 * Four times the file for half the triangles. Atlas the maps, or ship
 * fewer of them.
 *
 * IN PLACE. The campus drives position itself and paces playback from
 * how fast a student is really walking. A clip that also carries the
 * body forward fights it, and the feet skate.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { resolve, extname, sep, basename, relative } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8385;
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
               ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
               ".bin": "application/octet-stream" };

const args = process.argv.slice(2).filter(a => !a.startsWith("-"));
const files = args.length ? args
  : readdirSync(resolve(ROOT, "assets"))
      .filter(f => /^stu_.*\.glb$/.test(f))
      .map(f => "assets/" + f).sort();
if (!files.length){ console.error("nothing to check"); process.exit(1); }

/* Read what can be read without a browser: weight, triangles, images. */
function onDisk(p){
  const b = readFileSync(p);
  if (b.readUInt32LE(0) !== 0x46546c67) return { mb: +(b.length / 1e6).toFixed(2) };
  const j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString("utf8"));
  const tris = (j.meshes || []).reduce((t, m) => t + m.primitives.reduce(
    (s, pr) => s + (pr.indices !== undefined ? j.accessors[pr.indices].count / 3 : 0), 0), 0);
  return { mb: +(b.length / 1e6).toFixed(2), tris: Math.round(tris),
           meshes: (j.meshes || []).length, images: (j.images || []).length,
           specGloss: (j.materials || []).some(m => m.extensions &&
             m.extensions.KHR_materials_pbrSpecularGlossiness) };
}

const PAGE = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"/assets/vendor/three/build/three.module.js",
  "three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

/* the campus's own bone vocabulary, kept in step with index.html */
const RP = { hip:"hips", spine_01:"spine", spine_02:"spine1", spine_03:"spine2",
  neck:"neck", head:"head", shoulder:"shoulder", upperarm:"arm", lowerarm:"forearm",
  hand:"hand", upperleg:"upleg", lowerleg:"leg", foot:"foot", ball:"toebase" };
const CC = { hip:"hips", waist:"spine", spine01:"spine1", spine02:"spine2",
  necktwist01:"neck", head:"head", clavicle:"shoulder", upperarm:"arm",
  forearm:"forearm", hand:"hand", thigh:"upleg", calf:"leg", foot:"foot",
  toebase:"toebase" };
function canonBone(raw){
  let s = (raw || "").split("|").pop().split(":").pop();
  s = s.replace(/[._]\\d+$/, "");
  let m = /^rp_.+?_animated_\\d+_[a-z]+_(.+)$/i.exec(s);
  if (m){
    let b = m[1].toLowerCase(), side = "";
    const sm = /^(.*)_(l|r)$/.exec(b);
    if (sm){ b = sm[1]; side = sm[2] === "l" ? "left" : "right"; }
    const t = RP[b];
    return t ? (side && t !== "hips" ? side + t : t) : null;
  }
  m = /^CC_Base_(?:([LR])_)?(.+)$/i.exec(s);
  if (m){
    const side = m[1] ? (m[1].toUpperCase() === "L" ? "left" : "right") : "";
    const t = CC[m[2].toLowerCase()];
    return t ? (side && t !== "hips" ? side + t : t) : null;
  }
  m = /^(Left|Right)?(Pelvis|Chest|Clavicle|UpperArm|Thigh|Shin|Toe)$/.exec(s);
  if (m){
    const side = m[1] ? m[1].toLowerCase() : "";
    const t = { pelvis: "hips", chest: "chest", clavicle: "shoulder",
                upperarm: "arm", thigh: "upleg", shin: "leg", toe: "toebase" }[m[2].toLowerCase()];
    return side && t !== "hips" ? side + t : t;
  }
  s = s.replace(/^mixamorig\\d*/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return s ? s.replace(/^spine0(\\d)$/, "spine$1") : null;
}
/* the wardrobe's, likewise */
const canon = (s) => (s || "").toLowerCase();
function slotOf(meshName, matName){
  const tag = canon(meshName) + " " + canon(matName);
  return /hair|beard|moustache|mustache|scalp|brow|eyelash/i.test(tag) ? "hair"
       : /shirt|top|jacket|suit|hoodie|sweater/i.test(tag) ? "shirt"
       : /short|pant|trouser|jean|bottom|denim/i.test(tag) ? "shorts"
       : /shoe|sneaker|boot|footwear|canvas/i.test(tag) ? "sneakers"
       : /body|skin|head/i.test(tag) ? "skin" : null;
}
const CORE = ["hips","spine","leftupleg","leftleg","leftfoot",
              "rightupleg","rightleg","rightfoot","neck","head",
              "leftarm","leftforearm","rightarm","rightforearm"];

window.__check = (url) => new Promise((done) => loader.load(url, (g) => {
  const out = { clips: [], slots: [], missing: [], rest: null };
  const root = g.scene;
  root.updateMatrixWorld(true);

  /* measurable at all? */
  const box = new THREE.Box3().setFromObject(root);
  const span = box.max.y - box.min.y;
  out.span = Number.isFinite(span) ? +span.toFixed(3) : null;

  /* bones, and which vocabulary they speak */
  const bones = [];
  root.traverse(o => { if (o.isBone) bones.push(o); });
  out.bones = bones.length;
  const raw = bones[1] ? bones[1].name : (bones[0] ? bones[0].name : "");
  const names = bones.map(b => b.name);
  out.dialect = /^mixamorig/i.test(raw) ? "Mixamo"
              : /^CC_Base_/i.test(raw) ? "Character Creator"
              : /^rp_.+_animated_/i.test(raw) ? "Renderpeople"
              : names.some(n => /Thigh$|Shin$/.test(n)) ? "StudentProductionRig"
              : canonBone(raw) ? "plain" : "unrecognised";
  const have = new Set();
  for (const b of bones){ const k = canonBone(b.name); if (k) have.add(k); }
  out.missing = CORE.filter(c => !have.has(c));

  /* rest pose against bind pose, on the bones a clip drives */
  let sk = null;
  root.traverse(o => { if (o.isSkinnedMesh && !sk) sk = o; });
  if (sk && sk.skeleton){
    const A = new THREE.Matrix4(), B = new THREE.Matrix4();
    const p = new THREE.Vector3(), q1 = new THREE.Quaternion(), s1 = new THREE.Vector3();
    const q2 = new THREE.Quaternion();
    const degs = [];
    sk.skeleton.bones.forEach((b, i) => {
      if (!CORE.includes(canonBone(b.name))) return;
      A.copy(sk.bindMatrixInverse).multiply(b.matrixWorld);
      B.copy(sk.skeleton.boneInverses[i]).invert();
      A.decompose(p, q1, s1); B.decompose(p, q2, s1);
      degs.push(q1.angleTo(q2) * 180 / Math.PI);
    });
    degs.sort((a, b) => a - b);
    out.rest = degs.length
      ? { n: degs.length, median: +degs[Math.floor(degs.length / 2)].toFixed(1),
          worst: +degs[degs.length - 1].toFixed(1), over: degs.filter(d => d > 10).length }
      : null;
  }

  /* which side is "Left" actually on? */
  {
    const pick = (k) => { for (const b of bones) if (canonBone(b.name) === k) return b; return null; };
    const hips = pick("hips"), lf = pick("leftfoot"), rf = pick("rightfoot");
    if (hips && lf && rf){
      const v = new THREE.Vector3();
      hips.getWorldPosition(v); const hx = v.x;
      lf.getWorldPosition(v); const lx = v.x - hx;
      rf.getWorldPosition(v); const rx = v.x - hx;
      out.sides = { left: +lx.toFixed(3), right: +rx.toFixed(3) };
    }
  }

  /* what the wardrobe can find */
  const slots = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    const s = slotOf(o.name, o.material && o.material.name);
    if (s) slots.add(s);
  });
  out.slots = [...slots].sort();

  /* the clips: what they are, and whether they travel */
  let hips = null, foot = null;
  for (const b of bones){
    const k = canonBone(b.name);
    if (!hips && k === "hips") hips = b;
    if (!foot && /^(left|right)foot$/.test(k || "")) foot = b;
  }
  if (hips && foot && g.animations.length){
    const mixer = new THREE.AnimationMixer(root);
    const P = new THREE.Vector3(), F = new THREE.Vector3();
    const at = (act, t) => { act.time = t; mixer.setTime(t); root.updateMatrixWorld(true);
      hips.getWorldPosition(P); foot.getWorldPosition(F); return [P.y - F.y, P.x, P.z]; };
    for (const c of g.animations){
      const act = mixer.clipAction(c); act.reset(); act.play(); act.setEffectiveWeight(1);
      const N = 24, h = [], xz = [];
      for (let i = 0; i <= N; i++){
        const [hy, x, z] = at(act, Math.min(c.duration - 1e-4, c.duration * i / N));
        h.push(hy); xz.push([x, z]);
      }
      act.stop(); mixer.uncacheAction(c);
      const stand = Math.max(...h) || 1;
      const first = h[0] / stand, last = h[h.length - 1] / stand;
      const lo = Math.min(...h) / stand;
      let travel = 0;
      for (const [x, z] of xz) travel = Math.max(travel, Math.hypot(x - xz[0][0], z - xz[0][1]));
      /* thigh swing, the same measure the campus paces playback from */
      const t = c.tracks.find(tr =>
        /(upleg|thigh|upperleg)[^.]*\\.quaternion$/i.test(tr.name) && !/twist|share|roll/i.test(tr.name));
      out.clips.push({ name: c.name, dur: +c.duration.toFixed(2),
        first: +first.toFixed(2), last: +last.toFixed(2), lo: +lo.toFixed(2),
        travel: +(travel / stand).toFixed(2), swings: !!t });
    }
    mixer.uncacheRoot(root);
  } else {
    for (const c of g.animations) out.clips.push({ name: c.name, dur: +c.duration.toFixed(2) });
  }
  done(out);
}, undefined, (e) => done({ err: String(e).slice(0, 140) })));
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
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__check, null, { timeout: 20000 });

let worstVerdict = 0;
for (const f of files){
  const abs = resolve(ROOT, f);
  if (!existsSync(abs)){ console.log(`\n${f}\n  NOT FOUND`); worstVerdict = 2; continue; }
  const disk = onDisk(abs);
  const r = await page.evaluate(u => window.__check(u), "/" + relative(ROOT, abs).split(sep).join("/"));
  console.log(`\n── ${basename(f)} ${"─".repeat(Math.max(0, 56 - basename(f).length))}`);
  if (r.err){ console.log("  WILL NOT LOAD: " + r.err); worstVerdict = 2; continue; }

  /* Three separate questions, and a body can fail the second or third
     and still be a perfectly good student. Saying "will not work" of
     one that plainly does is worse than saying nothing. */
  const bad = [], warn = [], note = [];
  console.log(`  ${disk.mb}MB · ${disk.tris ?? "?"} triangles · ${disk.meshes ?? "?"} mesh(es) · ${disk.images ?? "?"} image(s)`);
  if (disk.images > 8) warn.push(`${disk.images} images — they, not the triangles, are the megabytes`);
  if (disk.specGloss) bad.push("specular-glossiness materials: GLTFLoader cannot read them and the figure arrives white");
  if (disk.mb > 3) warn.push(`${disk.mb}MB is heavy for one student — the cheapest here is 0.24MB`);

  if (!r.span) bad.push("no measurable height — the skeleton's inverse bind matrices are corrupt");
  console.log(`  skeleton: ${r.bones} bones, ${r.dialect}`);
  if (r.dialect === "unrecognised")
    warn.push("bone names in no vocabulary the campus knows — it can carry its own clips, but nothing can be lent to it");
  if (r.missing.length)
    warn.push("cannot be lent a clip that needs " + r.missing.join(", "));

  if (r.rest){
    const { n, median, worst, over } = r.rest;
    console.log(`  rest vs bind pose: median ${median}°, worst ${worst}°, ${over} of ${n} past 10°`);
    /* Reported, not judged — see the note at the top. Bodies that
       borrow motion perfectly rest in the same band as one that
       cannot, so a threshold here would fail the working ones. */
    if (median > 10)
      note.push(`rests ${median}° from its bind pose — if a borrowed clip looks wrong on it, start here`);
  } else console.log("  rest vs bind pose: no skin to compare against");

  if (r.sides){
    const mirrored = r.sides.left < r.sides.right;
    console.log(`  sides: LeftFoot at x ${r.sides.left > 0 ? "+" : ""}${r.sides.left}, ` +
                `RightFoot at x ${r.sides.right > 0 ? "+" : ""}${r.sides.right}` +
                (mirrored ? "  ← MIRRORED" : ""));
    if (mirrored)
      warn.push("Left and Right are swapped: the bone called Left is on the character's " +
                "right. Motion borrowed from another rig transfers SPATIALLY, so this " +
                "puts the donor's left arm on the right arm — rendered once as a figure " +
                "sitting down correctly with both arms over its head. The campus detects " +
                "and compensates, but fix it in the source and there is nothing to detect");
  }
  console.log(`  wardrobe can tint: ${r.slots.length ? r.slots.join(", ") : "NOTHING"}`);
  if (!r.slots.length)
    warn.push("no mesh or material named for the wardrobe — it wears its factory colours for ever, so a second copy is the same student twice");

  if (!r.clips.length) warn.push("no animation at all");
  for (const c of r.clips){
    const kind = c.first === undefined ? "?"
      : Math.abs(c.first - c.last) < 0.15
        ? (c.first <= 0.62 ? "a seated loop" : c.swings ? "standing or walking" : "standing")
      : c.first > 0.62 && c.last <= 0.62 ? "SITTING DOWN"
      : c.first <= 0.62 && c.last > 0.62 ? "STANDING UP" : "moving";
    console.log(`  clip "${(c.name || "?").slice(0, 26)}" ${c.dur}s — ${kind}` +
                (c.travel > 0.35 ? `, carries travel ${c.travel}` : ""));
    if (c.travel > 0.35) warn.push(`"${c.name}" travels — tick In Place, or the feet will skate`);
  }

  for (const x of bad)  console.log("  ✗ " + x);
  for (const w of warn) console.log("  ! " + w);
  for (const x of note) console.log("  · " + x);
  /* A summary of what it CAN do, not a grade. Every body here draws
     and walks; they differ in whether the wardrobe can dress them and
     whether a clip can be lent to them, and those are the two things
     worth knowing before making another one. */
  const can = [
    bad.length ? "does not load properly" : "loads and draws",
    r.slots.length ? `dressable (${r.slots.length}/5 slots)` : "plain colours only",
    r.dialect === "unrecognised" || r.missing.length
      ? "cannot be lent clips" : "can be lent clips",
    (disk.mb ?? 0) + "MB",
  ];
  console.log("  → " + can.join(" · "));
  worstVerdict = Math.max(worstVerdict, bad.length ? 2 : 0);
}
await browser.close(); server.close();
process.exit(worstVerdict === 2 ? 1 : 0);
