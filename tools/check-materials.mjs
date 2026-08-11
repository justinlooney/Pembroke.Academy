#!/usr/bin/env node
/**
 * Pembroke Academy — does every model still have its colour?
 *
 *     node tools/check-materials.mjs [--fix-list]
 *
 * Two ways a body arrives on the campus white, both silent, both
 * invisible until somebody walks up to one:
 *
 *   KHR_materials_pbrSpecularGlossiness
 *     Deprecated in glTF and REMOVED from three.js GLTFLoader — the
 *     vendored copy does not mention it once. Every diffuse texture in
 *     such a file is ignored and the material falls back to plain
 *     white. Three of this cast were shipping that way with thirty
 *     images each sitting unread inside them. Fixable without
 *     re-downloading anything: gltf-transform metalrough.
 *
 *   no colour at all
 *     No textures, no vertex colours, no baseColorFactor. Geometry and
 *     nothing else. Not fixable at all — the information is not in the
 *     file — so those have to be sourced again.
 *
 * Neither is visible across a lawn, which is why both survived: a
 * monochrome figure at sixty feet reads as somebody in pale clothes.
 * At conversational distance it reads as a mannequin.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "assets";
const SPEC = "KHR_materials_pbrSpecularGlossiness";

function read(file){
  const b = readFileSync(join(DIR, file));
  if (b.readUInt32LE(0) !== 0x46546c67) return null;
  return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString("utf8"));
}

const convert = [], colourless = [];
for (const f of readdirSync(DIR).filter(f => f.endsWith(".glb")).sort()){
  let j;
  try { j = read(f); } catch { continue; }
  if (!j || !(j.materials || []).length) continue;

  const spec = (j.materials || []).filter(m => m.extensions && m.extensions[SPEC]).length;
  if (spec){ convert.push([f, spec, (j.images || []).length]); continue; }

  /* Colour can arrive three ways. Any one of them is enough. */
  const attrs = new Set();
  (j.meshes || []).forEach(m => m.primitives.forEach(p =>
    Object.keys(p.attributes).forEach(a => attrs.add(a))));
  const mapped = (j.materials || []).some(m => m.pbrMetallicRoughness?.baseColorTexture);
  const tinted = (j.materials || []).some(m =>
    (m.pbrMetallicRoughness?.baseColorFactor || []).some(v => v < 0.98));
  if (!mapped && !tinted && !attrs.has("COLOR_0")){
    colourless.push([f, (j.materials || []).map(m => m.name || "?").join(", ")]);
  }
}

if (convert.length){
  console.log(`\n${convert.length} model(s) store their colour in ${SPEC},`);
  console.log(`which GLTFLoader does not read. They render white. Convert them:\n`);
  convert.forEach(([f, n, imgs]) =>
    console.log(`  ${f.padEnd(20)} ${n} material(s), ${imgs} image(s) currently unread`));
  console.log(`\n  gltf-transform metalrough assets/NAME.glb assets/NAME.glb\n`);
}
if (colourless.length){
  console.log(`\n${colourless.length} model(s) carry no colour of any kind — no texture,`);
  console.log(`no vertex colours, no baseColorFactor. Not fixable here; source them again:\n`);
  colourless.forEach(([f, mats]) => console.log(`  ${f.padEnd(20)} materials: ${mats}`));
  console.log();
}
if (!convert.length && !colourless.length) console.log("every model carries its own colour");

/* The convertible case fails the build, because it is a one-command fix
   and shipping it white is a choice nobody made on purpose. The
   colourless case only warns: it needs a new download, which is not
   something a run can do for itself. */
process.exit(convert.length ? 1 : 0);
