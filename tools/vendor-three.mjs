#!/usr/bin/env node
/**
 * Pembroke Academy — vendor Three.js into the repo.
 *
 * The campus used to import Three.js from unpkg, which made a CDN a
 * single point of failure for the whole site: if unpkg is slow or down,
 * there is no campus, and no amount of caching our own assets helps.
 * Serving the engine from our own origin removes that, and lets the
 * service worker cache it on the same terms as the models.
 *
 *   npm install three@0.170.0
 *   node tools/vendor-three.mjs [path/to/node_modules]
 *
 * It copies the transitive closure of what index.html actually imports,
 * not just the entry points — the postprocessing passes pull in shaders
 * and helpers that are easy to miss by hand, and missing one is a blank
 * page. It also writes files.json, which the service worker precaches so
 * the engine is available offline from the very first visit.
 *
 * To upgrade: bump the version in package.json, rerun this, update the
 * VERSION in sw.js, and run the smoke test.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NM = process.argv[2] || "node_modules";
const SRC = path.join(NM, "three");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DST = path.join(ROOT, "assets/vendor/three");

if (!fs.existsSync(SRC)){
  console.error(`three not found at ${SRC} — npm install three@0.170.0 first`);
  process.exit(1);
}

/* Everything index.html imports by name. Entry points only; the closure
   below finds the rest. */
const ENTRIES = [
  "examples/jsm/controls/OrbitControls.js",
  "examples/jsm/environments/RoomEnvironment.js",
  "examples/jsm/geometries/RoundedBoxGeometry.js",
  "examples/jsm/libs/meshopt_decoder.module.js",
  "examples/jsm/loaders/GLTFLoader.js",
  "examples/jsm/objects/Reflector.js",
  "examples/jsm/postprocessing/EffectComposer.js",
  "examples/jsm/postprocessing/OutputPass.js",
  "examples/jsm/postprocessing/RenderPass.js",
  "examples/jsm/postprocessing/SMAAPass.js",
  "examples/jsm/postprocessing/SSAOPass.js",
  "examples/jsm/postprocessing/UnrealBloomPass.js",
  "examples/jsm/renderers/CSS2DRenderer.js",
  "examples/jsm/utils/SkeletonUtils.js",
];

const seen = new Set();
const missing = [];

function walk(rel){
  if (seen.has(rel)) return;
  const abs = path.join(SRC, rel);
  if (!fs.existsSync(abs)){ missing.push(rel); return; }
  seen.add(rel);
  /* Import statements only. A looser pattern picks up the doc URLs and
     colour-space strings in GLTFLoader's comments and reports them as
     unresolvable modules. */
  const re = /(?:^|\n)\s*(?:import|export)[\s\S]{0,400}?from\s*["']([^"']+)["']/g;
  const src = fs.readFileSync(abs, "utf8");
  let m;
  while ((m = re.exec(src))){
    const spec = m[1];
    if (spec === "three") continue;                       // resolved by the importmap
    if (spec.startsWith("three/addons/"))
      walk("examples/jsm/" + spec.slice("three/addons/".length));
    else if (spec.startsWith("."))
      /* POSIX join: these become URLs in files.json and the importmap, so
         a Windows-style backslash here would ship a path nothing can fetch */
      walk(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
    else missing.push(`${rel} -> ${spec}`);
  }
}

ENTRIES.forEach(walk);
if (missing.length){
  console.error("could not resolve:\n  " + missing.join("\n  "));
  process.exit(1);
}

const files = [...seen, "build/three.module.js"].sort();
fs.rmSync(DST, { recursive: true, force: true });
let bytes = 0;
for (const rel of files){
  const to = path.join(DST, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(SRC, rel), to);
  bytes += fs.statSync(to).size;
}

/* The service worker precaches from this, so the engine is present
   offline on the first visit rather than the second. Regenerating it is
   why this is a script and not a one-off copy. */
const version = JSON.parse(fs.readFileSync(path.join(SRC, "package.json"), "utf8")).version;
fs.writeFileSync(path.join(DST, "files.json"),
  JSON.stringify({ version, files }, null, 2) + "\n");

console.log(`three r${version}: ${files.length} modules, ${(bytes / 1e6).toFixed(2)}MB -> assets/vendor/three`);
console.log("remember to bump VERSION in sw.js, then run: node tools/smoke.mjs");
