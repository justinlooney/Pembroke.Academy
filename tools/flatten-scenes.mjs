#!/usr/bin/env node
/**
 * Pembroke Academy — fold every scene in a GLB into the first one.
 *
 *     node tools/flatten-scenes.mjs assets/trees.glb
 *
 * `gltf-transform merge` puts each input model in a Scene of its own,
 * which is a reasonable thing for it to do and completely wrong for us:
 * three.js loads the default scene and nothing else, so a collection of
 * twelve trees merged that way arrives as one tree and eleven silent
 * absences. Nothing errors. The file is valid. You just get an elm.
 *
 * This moves every scene's roots into the first and drops the empties,
 * so the whole collection arrives together — which is exactly the shape
 * plantpack.glb already has, and the shape plantSpecies() wants, since
 * it picks what to plant by mesh-name prefix out of a single scene.
 *
 * Names are left alone. They are the only handle the placement code
 * has on which tree is which.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file){ console.error("usage: flatten-scenes.mjs <file.glb>"); process.exit(1); }

const buf = readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67){
  console.error(`[flat] ${file} is not a GLB`); process.exit(1);
}
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
const rest = buf.slice(20 + jsonLen);

const scenes = json.scenes || [];
if (scenes.length <= 1){
  const n = (scenes[0]?.nodes || []).length;
  console.log(`[flat] ${file}: already one scene, ${n} root(s)`);
  process.exit(0);
}

/* keep the default scene's identity, gather everyone else into it */
const keep = json.scene || 0;
const roots = [];
for (const s of scenes) for (const n of s.nodes || []) if (!roots.includes(n)) roots.push(n);
const names = roots.map(n => json.nodes[n]?.name || "?");

json.scenes = [{ name: scenes[keep].name || "Scene", nodes: roots }];
json.scene = 0;

const jsonOut = Buffer.from(JSON.stringify(json), "utf8");
const pad = (4 - (jsonOut.length % 4)) % 4;
const jsonPadded = Buffer.concat([jsonOut, Buffer.alloc(pad, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonPadded.length + rest.length, 8);
const chunk = Buffer.alloc(8);
chunk.writeUInt32LE(jsonPadded.length, 0);
chunk.writeUInt32LE(0x4e4f534a, 4);          /* 'JSON' */
writeFileSync(file, Buffer.concat([header, chunk, jsonPadded, rest]));

console.log(`[flat] ${file}: ${scenes.length} scenes folded into 1, ` +
            `${roots.length} root(s) — ${names.join(", ")}`);
