#!/usr/bin/env node
/**
 * Pembroke Academy — drop the parts of a character nobody can see.
 *
 *     node tools/thin-character.mjs assets/stu_woman.glb
 *
 * Character-creator exports carry a full anatomy: a tongue, upper and
 * lower teeth, the wet films over the eyes, fingernails. On a portrait
 * render that detail is the point. On a figure forty-two units tall
 * halfway across a quad it is invisible — and it is not free, because
 * each of those parts has its own material and therefore its own draw
 * call. One such download arrived at eighty-four thousand triangles
 * across twenty-two draws, where the rest of the cohort costs six.
 *
 * This detaches those meshes. It does not touch the geometry that is
 * left, the skeleton, the skin weights or the clips — the risk in
 * shrinking a rigged character lives in rewriting the mesh, and this
 * rewrites nothing. The orphaned bytes are cleaned up by the
 * gltf-transform pass that follows, which drops accessors nothing
 * points at any more.
 *
 * Eyes, eyelashes and brows are deliberately kept. They are what stops
 * a face reading as a mannequin, and they are one draw each.
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";

/* Everything here is either inside the mouth, behind the eye, or
   smaller than a pixel at the distance these are seen from. */
const DROP = /tongue|teeth|tearline|occlusion|nails|cornea|moisture|^mouth$/i;

const file = process.argv[2];
if (!file){ console.error("usage: thin-character.mjs <file.glb>"); process.exit(1); }

const buf = readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67){       /* 'glTF' */
  console.error(`[thin] ${file} is not a GLB`); process.exit(1);
}
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
const rest = buf.slice(20 + jsonLen);          /* the BIN chunk, untouched */

const nameOf = (prim) => (json.materials?.[prim.material]?.name) || "";
/* Counted in primitives, not meshes. A draw call is a primitive, and a
   mesh can carry several — reporting the number of meshes as "draw
   calls dropped" understates the saving whenever one does, which is
   the number anyone reads this output for. */
let dropped = [], calls = 0, kept = 0;

for (const node of json.nodes || []){
  if (node.mesh === undefined) continue;
  const prims = json.meshes[node.mesh].primitives || [];
  /* only when every part of this mesh is sub-visible — a mesh that
     mixes a face with its teeth must stay whole */
  if (prims.length && prims.every(p => DROP.test(nameOf(p)))){
    dropped.push(prims.map(nameOf).join(","));
    calls += prims.length;
    delete node.mesh;
    delete node.skin;
  } else kept += prims.length;
}

if (!calls){
  console.log(`[thin] ${file}: nothing to drop, ${kept} draw call(s)`);
  process.exit(0);
}

/* rebuild the container: same binary chunk, a new JSON chunk */
const jsonOut = Buffer.from(JSON.stringify(json), "utf8");
const pad = (4 - (jsonOut.length % 4)) % 4;
const jsonPadded = Buffer.concat([jsonOut, Buffer.alloc(pad, 0x20)]);   /* spaces */
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonPadded.length + rest.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonPadded.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);       /* 'JSON' */

const before = statSync(file).size;
writeFileSync(file, Buffer.concat([header, jsonHeader, jsonPadded, rest]));
console.log(`[thin] ${file}: dropped ${calls} draw call(s) across ${dropped.length} ` +
            `mesh(es) — ${dropped.join(", ")}`);
console.log(`[thin] ${kept} draw call(s) left; run gltf-transform to reclaim the bytes ` +
            `(${(before / 1e6).toFixed(2)}MB so far)`);
