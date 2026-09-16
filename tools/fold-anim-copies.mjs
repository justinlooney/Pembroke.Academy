#!/usr/bin/env node
/**
 * Pembroke Academy — one body, five animations, out of five whole copies.
 *
 *     node tools/fold-anim-copies.mjs /tmp/blue.merged.glb
 *
 * Meshy (and Mixamo before it) hands out one file PER ANIMATION, each
 * carrying a complete copy of the character: the mesh, the texture, the
 * skeleton, and one clip. `gltf-transform merge` puts each of those in a
 * Scene of its own, so five downloads merge into five scenes, five
 * meshes, five skins and five copies of an 8192px texture — 357MB of GPU
 * memory for one student, and four of the five clips pointed at bones
 * three.js will never load, because it loads the default scene and
 * nothing else.
 *
 * flatten-scenes.mjs is NOT the tool for this. That one folds every
 * scene's roots into the first, which is right for a dozen DIFFERENT
 * trees and wrong here: it would stack five identical bodies in the same
 * spot, and the four hidden ones would still cost their draws.
 *
 * This keeps the first copy and RETARGETS the other clips onto it. The
 * rigs are identical — same exporter, same bone names, same bind — so
 * each channel is moved to the keeper's bone of the same name. What is
 * left over is orphaned, and `gltf-transform prune` reclaims it.
 *
 * It refuses rather than guesses. A bone the keeper does not have, or a
 * name that appears twice inside one copy, stops the run: a clip that
 * silently loses a channel is a body that animates from the knee down
 * and looks, on the quad, like nothing is wrong at all.
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";

const file = process.argv[2];
if (!file){ console.error("usage: fold-anim-copies.mjs <file.glb>"); process.exit(1); }

const buf = readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67){          /* 'glTF' */
  console.error(`[fold] ${file} is not a GLB`); process.exit(1);
}
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
const rest = buf.slice(20 + jsonLen);             /* the BIN chunk, untouched */

const scenes = json.scenes || [], nodes = json.nodes || [], anims = json.animations || [];
if (scenes.length <= 1){
  console.log(`[fold] ${file}: already one scene, ${anims.length} animation(s) — nothing to do`);
  process.exit(0);
}

/* every node reachable from a scene, and the name -> index map for it */
function subtree(sceneIdx){
  const seen = new Set(), stack = [...(scenes[sceneIdx].nodes || [])];
  while (stack.length){
    const n = stack.pop();
    if (seen.has(n)) continue; seen.add(n);
    for (const c of (nodes[n]?.children || [])) stack.push(c);
  }
  return seen;
}
function named(set, label){
  const map = new Map(), dupes = [];
  for (const n of set){
    const nm = nodes[n]?.name;
    if (!nm) continue;
    if (map.has(nm)) dupes.push(nm); else map.set(nm, n);
  }
  if (dupes.length){
    console.error(`[fold] ${label} has ${dupes.length} duplicated bone name(s) — ` +
                  `${[...new Set(dupes)].slice(0, 5).join(", ")}`);
    console.error(`[fold] retargeting by name cannot be trusted here. Stopping.`);
    process.exit(1);
  }
  return map;
}

const keep = json.scene || 0;
const sets = scenes.map((_, i) => subtree(i));
/* EVERY copy, not only the one that survives. The retarget below reads a
   channel's bone name out of the copy it came FROM and looks it up in the
   keeper — so an ambiguous name in a DISCARDED copy is just as dangerous,
   and checking the keeper alone never sees it. Two source bones sharing a
   name both resolve to the keeper's single node of that name, and the
   clip binds one of them to the wrong joint with nothing to say so.

   The copies are supposed to be identical, which is exactly why this has
   to be checked rather than assumed: if they are, the loop costs nothing
   and finds nothing. */
const names = sets.map((s, i) => named(s, `scene ${i}`));
const keepNames = names[keep];
/* which scene owns a node, so a clip can be told which copy it came from */
const owner = new Map();
sets.forEach((s, i) => { for (const n of s) if (!owner.has(n)) owner.set(n, i); });

let moved = 0, kept = 0;
for (const a of anims){
  const from = new Set((a.channels || [])
    .map(c => owner.get(c.target?.node)).filter(i => i !== undefined));
  if (from.size === 1 && from.has(keep)){ kept++; continue; }
  if (from.size > 1){
    console.error(`[fold] animation "${a.name || "?"}" targets ${from.size} different `
                  + `copies — this is not the one-file-per-clip shape. Stopping.`);
    process.exit(1);
  }
  for (const c of (a.channels || [])){
    const n = c.target?.node;
    if (n === undefined) continue;
    const nm = nodes[n]?.name;
    const to = nm !== undefined ? keepNames.get(nm) : undefined;
    if (to === undefined){
      console.error(`[fold] animation "${a.name || "?"}" drives "${nm ?? `node ${n}`}", `
                    + `which the kept copy does not have. Stopping rather than `
                    + `shipping a clip with a missing channel.`);
      process.exit(1);
    }
    c.target.node = to;
  }
  moved++;
}

json.scenes = [scenes[keep]];
json.scene = 0;

/* ── drop the copies, do not leave them for prune ───────────────────
   `gltf-transform prune` removes the orphaned meshes and skins in one
   pass, but it peels the orphaned BONES two at a time: measured on a
   three-copy merge it took 48 dead nodes down to 46, then 44. Handing
   it a skeleton it cannot finish and calling the file clean is how a
   character ships carrying four hidden rigs. So the indices are
   rewritten here, where the tool already knows exactly which nodes the
   kept copy uses. */
/* ── what may be in this file while its nodes are renumbered ────────
   Naming KHR_animation_pointer alone was a guard against the one
   extension I happened to think of, dressed as a guard against the
   class. The class is "anything that stores a NODE INDEX somewhere this
   tool does not rewrite", and the renumbering below moves every index
   underneath it: MSFT_lod keeps its `ids` array of node indices, and
   KHR_interactivity addresses nodes by index too. Neither would error.
   The LODs would simply point at other people's bones.

   So it is an allowlist, and the entries are here because they were
   checked: every one addresses materials, textures, or the encoding of
   buffer data, and none of them names a node. KHR_lights_punctual is
   the only one that appears ON a node, and what it holds there is a
   light index, which this tool does not touch.

   Refusing an unknown extension is the right way round. A file that
   could have been folded stops with its name printed and one line to
   add here once somebody has checked it; the alternative is a body that
   loads, draws, and is quietly wrong. */
const NODE_SAFE = new Set([
  "KHR_materials_ior", "KHR_materials_specular", "KHR_materials_unlit",
  "KHR_materials_emissive_strength", "KHR_materials_clearcoat",
  "KHR_materials_sheen", "KHR_materials_transmission", "KHR_materials_volume",
  "KHR_materials_iridescence", "KHR_materials_anisotropy",
  "KHR_materials_pbrSpecularGlossiness", "KHR_materials_variants",
  "KHR_texture_transform", "KHR_texture_basisu", "EXT_texture_webp",
  "EXT_meshopt_compression", "KHR_draco_mesh_compression",
  "KHR_mesh_quantization", "KHR_lights_punctual",
]);
const unknown = (json.extensionsUsed || []).filter(e => !NODE_SAFE.has(e));
if (unknown.length){
  console.error(`[fold] this file uses ${unknown.join(", ")}, which this tool has `
                + `not been checked against.`);
  console.error(`[fold] folding renumbers every node in the file. An extension that `
                + `stores a node index — KHR_animation_pointer inside its JSON `
                + `pointers, MSFT_lod in its ids array — would be left pointing at `
                + `the wrong bones, and nothing about the result would look wrong.`);
  console.error(`[fold] Stopping. If it holds no node indices, add it to NODE_SAFE.`);
  process.exit(1);
}
const live = subtree(keep);
/* a skeleton root can sit outside the scene graph, and dropping it would
   take the skin's bind with it */
const liveSkins = new Set();
for (const n of live) if (nodes[n].skin !== undefined) liveSkins.add(nodes[n].skin);
for (const si of liveSkins){
  const sk = json.skins[si];
  for (const j of [...(sk.joints || []), ...(sk.skeleton !== undefined ? [sk.skeleton] : [])])
    live.add(j);
}
const nodeMap = new Map();
[...live].sort((a, b) => a - b).forEach((n, i) => nodeMap.set(n, i));
const skinMap = new Map();
[...liveSkins].sort((a, b) => a - b).forEach((s, i) => skinMap.set(s, i));

/* NODES, and the word matters. This counted the same number and called
   them bones, which it cannot know: a dropped copy contributes its mesh
   node and its armature root as well as its skeleton. On the body this
   was written for that was 88 reported against 80 bones actually gone,
   and the eight it invented were the parts of the file the tool is
   proudest of removing. Count what is counted. */
const deadNodes = nodes.length - nodeMap.size, deadSkins = (json.skins || []).length - skinMap.size;
json.nodes = [...nodeMap.keys()].map(n => {
  const o = { ...nodes[n] };
  if (o.children) o.children = o.children.filter(c => nodeMap.has(c)).map(c => nodeMap.get(c));
  if (o.children && !o.children.length) delete o.children;
  if (o.skin !== undefined) o.skin = skinMap.get(o.skin);
  return o;
});
json.skins = [...skinMap.keys()].map(si => {
  const o = { ...json.skins[si] };
  o.joints = (o.joints || []).map(j => nodeMap.get(j));
  if (o.skeleton !== undefined) o.skeleton = nodeMap.get(o.skeleton);
  return o;
});
json.scenes[0] = { ...json.scenes[0],
                   nodes: (json.scenes[0].nodes || []).map(n => nodeMap.get(n)) };
for (const a of anims)
  for (const c of (a.channels || []))
    if (c.target?.node !== undefined) c.target.node = nodeMap.get(c.target.node);

const jsonOut = Buffer.from(JSON.stringify(json), "utf8");
const pad = (4 - (jsonOut.length % 4)) % 4;
const jsonPadded = Buffer.concat([jsonOut, Buffer.alloc(pad, 0x20)]);   /* spaces */
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonPadded.length + rest.length, 8);
const chunk = Buffer.alloc(8);
chunk.writeUInt32LE(jsonPadded.length, 0);
chunk.writeUInt32LE(0x4e4f534a, 4);               /* 'JSON' */

const before = statSync(file).size;
writeFileSync(file, Buffer.concat([header, chunk, jsonPadded, rest]));

console.log(`[fold] ${file}: ${scenes.length} copies -> 1, ` +
            `${moved} clip(s) retargeted, ${kept} already on the kept copy`);
console.log(`[fold] clips: ${anims.map(a => a.name || "?").join(", ")}`);
/* A warning, not a failure: the file is correct either way. But rolesOf
   picks a body's idle, gait and seat out of its OWN clip names, and two
   clips called the same thing give it no way to tell them apart. Worth
   knowing before the body reaches the quad and stands still all day. */
const dupClips = anims.map(a => a.name || "?")
  .filter((n, i, all) => all.indexOf(n) !== i);
if (dupClips.length)
  console.log(`[fold] NOTE: ${[...new Set(dupClips)].join(", ")} appears more than once. ` +
              `rolesOf reads these names — rename them before shipping.`);
console.log(`[fold] dropped ${deadNodes} node(s) and ${deadSkins} skin(s) from the ` +
            `discarded copies; ${json.nodes.length} node(s) left`);
console.log(`[fold] ${(before / 1e6).toFixed(2)}MB still — the orphaned meshes and their ` +
            `bytes go with 'gltf-transform prune' and the optimize pass after it`);
