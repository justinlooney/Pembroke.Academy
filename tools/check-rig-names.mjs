#!/usr/bin/env node
/**
 * Pembroke Academy — do the names in a character file line up?
 *
 *     node tools/check-rig-names.mjs [walker ariel ...]     (default: all)
 *
 * Names are load-bearing in this project twice over, and both times the
 * failure is silent.
 *
 * An animation track addresses a node by NAME. If the name is wrong the
 * track binds to nothing, the file loads without complaint, and the
 * figure stands perfectly still — which is how this repository once
 * shipped a statue and had to diagnose it in a browser. three.js does
 * not warn; it resolves what it can and drops the rest.
 *
 * And the wardrobe finds a shirt by name too, so a mesh nobody thought
 * to name leaves that student in factory colours for good. Ten of
 * sixteen bodies here own nothing the wardrobe can dress, which is a
 * fact about their files rather than a bug, but it is worth knowing
 * which is which.
 *
 * Complicating both: GLTFLoader rewrites every name on the way in.
 * PropertyBinding.sanitizeNodeName strips [ ] . : / and turns
 * whitespace into underscores, so mixamorig:LeftFoot arrives as
 * mixamorigLeftFoot; and createUniqueName appends _001, _064 and so on
 * when two nodes collide. Any check that reads the names in the FILE is
 * checking something the renderer never sees. So this reads them
 * through the loader, exactly as the campus does.
 *
 * Exit 1 if any clip binds to nothing at all — that one is never
 * intentional.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8311;
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".glb": "model/gltf-binary", ".png": "image/png",
               ".json": "application/json" };
const pick = process.argv.slice(2).filter(a => !a.startsWith("-"));
const bodies = readdirSync(resolve(ROOT, "assets"))
  .filter(f => /^stu_.*\.glb$/.test(f))
  .filter(f => !pick.length || pick.includes(f.replace(/^stu_|\.glb$/g, "")))
  .sort();

const PAGE = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"/assets/vendor/three/build/three.module.js",
  "three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

/* the campus's own two normalisers, verbatim — a check that used
   different ones would be checking a different program */
const canon = (s) => (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const boneKey = (s) => {
  s = (s || "").split("|").pop().split(":").pop();
  s = s.replace(/^mixamorig\\d*/i, "").replace(/[._]\\d+$/, "");
  return canon(s);
};

const FLAVOURS = [
  ["mixamo", /^mixamorig\\d*/i],
  ["character creator", /^CC_Base_/i],
  ["daz", /^(lThigh|rThigh|abdomen|hip)$/i],
  ["rigify", /^(DEF-|ORG-|MCH-)/i],
  ["ready player me / vrm", /^(J_Bip_|Bip01|Hips$|Spine$)/i],
];

window.__names = (url) => new Promise((done) => {
  loader.load(url, (gl) => {
    const root = gl.scene;
    const bones = [], meshes = [], byName = new Map();
    root.traverse(o => {
      if (o.name) byName.set(o.name, (byName.get(o.name) || 0) + 1);
      if (o.isBone) bones.push(o.name);
      else if (o.isMesh) meshes.push({ node: o.name || "",
                                       mat: o.material?.name || "",
                                       skinned: !!o.isSkinnedMesh });
    });

    let flavour = "unrecognised";
    for (const [label, rx] of FLAVOURS)
      if (bones.filter(n => rx.test(n)).length >= 3){ flavour = label; break; }

    /* Collision suffixes are the loader's fingerprint, not the
       author's: _001 on a bone means two nodes shared a name and
       three.js renamed one of them. Harmless on its own, and lethal
       when a clip written against the original name arrives later. */
    const suffixed = bones.filter(n => /_\\d{3}$/.test(n));
    const dupes = [...byName].filter(([, n]) => n > 1).map(([n]) => n);
    /* Two bones that differ only by the loader's suffix collapse to one
       key — so boneKey, which the campus uses to find a foot, would be
       ambiguous between them. */
    const keyed = new Map();
    for (const b of bones){
      const k = boneKey(b);
      keyed.set(k, (keyed.get(k) || []).concat(b));
    }
    const ambiguous = [...keyed].filter(([, v]) => v.length > 1);

    /* The one that matters. A track's name is "node.property"; the node
       half must resolve against the scene or the track does nothing. */
    const nodeSet = new Set();
    root.traverse(o => { if (o.name) nodeSet.add(o.name); });
    const clips = gl.animations.map(c => {
      const targets = new Set(), missed = new Set();
      for (const t of c.tracks){
        const node = t.name.split(".")[0];
        targets.add(node);
        if (!nodeSet.has(node)) missed.add(node);
      }
      return { name: c.name, dur: +c.duration.toFixed(2),
               tracks: c.tracks.length, targets: targets.size,
               missed: [...missed] };
    });

    /* which anatomy the campus looks for by name, and whether it is
       findable on this skeleton */
    const wants = ["hips", "head", "leftfoot", "rightfoot",
                   "lefthand", "righthand", "spine"];
    const keys = new Set(bones.map(boneKey));
    const findable = wants.map(w => [w, [...keys].some(k => k.includes(w))]);

    const tagOf = (m) => {
      const tag = canon(m.node) + " " + canon(m.mat);
      return /hair|beard|scalp|brow|eyelash/i.test(tag) ? "hair"
           : /shirt|top|jacket|suit|hoodie|sweater/i.test(tag) ? "shirt"
           : /short|pant|trouser|jean|bottom|denim/i.test(tag) ? "shorts"
           : /shoe|sneaker|boot|footwear|canvas/i.test(tag) ? "sneakers"
           : /body|skin|head/i.test(tag) ? "skin" : null;
    };

    done({ bones: bones.length, flavour, sample: bones.slice(0, 8),
           suffixed, dupes, ambiguous, clips, findable,
           meshes: meshes.map(m => ({ ...m, tag: tagOf(m) })) });
  }, undefined, (e) => done({ err: String(e).slice(0, 120) }));
});
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

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__names);

let dead = 0;
for (const f of bodies){
  const name = f.replace(/^stu_|\.glb$/g, "");
  const r = await page.evaluate((u) => window.__names(u), `/assets/${f}`);
  console.log("\n" + "═".repeat(70));
  console.log(name.toUpperCase() + "   " + (r.err ? "FAILED: " + r.err : ""));
  if (r.err) continue;
  console.log("─".repeat(70));
  console.log(`skeleton   ${r.bones} bones, named in the ${r.flavour} convention`);
  console.log(`           ${r.sample.join(", ")}${r.bones > 8 ? " ..." : ""}`);

  if (r.suffixed.length)
    console.log(`  NOTE     ${r.suffixed.length} bone(s) carry a loader collision suffix` +
                ` (e.g. ${r.suffixed.slice(0, 3).join(", ")})`);
  if (r.dupes.length)
    console.log(`  NOTE     duplicate node names: ${r.dupes.slice(0, 4).join(", ")}`);
  if (r.ambiguous.length)
    console.log(`  WARN     ${r.ambiguous.length} bone key(s) match more than one bone — ` +
                `the campus looks bones up by this key:\n           ` +
                r.ambiguous.slice(0, 3).map(([k, v]) => k + " <- " + v.join(" + ")).join("\n           "));

  console.log("\nclips");
  for (const c of r.clips){
    const bad = c.missed.length;
    console.log(`  ${(c.name || "?").padEnd(20)} ${String(c.dur).padStart(6)}s  ` +
                `${String(c.tracks).padStart(4)} tracks -> ${String(c.targets).padStart(3)} nodes` +
                (bad ? `   ${bad} ADDRESS NOTHING: ${c.missed.slice(0, 3).join(", ")}` : "   all resolve"));
    if (bad === c.targets){ dead++; console.log("           ^ this clip animates NOTHING"); }
  }

  console.log("\nthe bones the campus looks for by name");
  console.log("  " + r.findable.map(([w, ok]) => (ok ? "OK " : "-- ") + w).join("   "));

  console.log("\nmeshes and what the wardrobe makes of them");
  for (const m of r.meshes)
    console.log(`  ${(m.node || "(unnamed)").slice(0, 26).padEnd(28)}` +
                `${(m.mat || "(unnamed)").slice(0, 26).padEnd(28)}` +
                (m.tag || "— not dressable"));
}
console.log("\n" + "═".repeat(70));
console.log(dead ? `${dead} clip(s) animate nothing at all` : "every clip binds to something");
await browser.close(); server.close();
process.exit(dead ? 1 : 0);
