#!/usr/bin/env node
// Exercise the production retargeter on every installed body and donor.
// No campus rendering and no output files: joint directions are measured
// in a browser using the same GLTF loader and Three.js as the application.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { serve, launch, ROOT } from "./_harness.mjs";

const html = await readFile(ROOT + "/index.html", "utf8");
const start = html.indexOf("const RP_BONE = {"), end = html.indexOf("/* ── what can this body do?", start);
assert.ok(start > 0 && end > start, "locate the production retargeter");
const bodies = [...html.match(/const CAST_FILES = \{([\s\S]*?)\n\};/)[1]
  .matchAll(/^\s*(char\d+):\s*"([^"]+)"/gm)].map(m => [m[1], m[2]]);
const donors = (await readdir(ROOT + "/assets")).filter(f => /^clip_.*\.glb$/.test(f)).sort();
assert.ok(bodies.length && donors.length, "the test must exercise actual assets");
const server = await serve(), browser = await launch();
try {
  const page = await browser.newPage({ serviceWorkers: "block" }), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/__retarget-check.html", route => route.fulfill({ contentType: "text/html", body: `<!doctype html>
    <script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>
    <script type="module">
    import * as THREE from "three";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
    import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
    const RIGREST = false, RIGTRACE = "", RIGTRACE_FRAME = 0;
    ${html.slice(start, end)}
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    window.rigCheck = { THREE, lendClip, canonBone, load: url => loader.loadAsync(url) };
    </script>` }));
  await page.goto(server.origin + "/__retarget-check.html");
  await page.waitForFunction(() => window.rigCheck);
  const rows = await page.evaluate(async ({ bodies, donors }) => {
    const { THREE, lendClip, canonBone, load } = rigCheck;
    const sourceFiles = await Promise.all(donors.map(async name => [name, await load("assets/" + name)]));
    const mapBones = (root, loose) => {
      const map = new Map(); root.traverse(b => {
        const key = canonBone(b.name);
        if ((loose || b.isBone) && key && !map.has(key)) map.set(key, b);
      }); return map;
    };
    const position = b => b.getWorldPosition(new THREE.Vector3());
    const direction = (map, key) => {
      const child = key.includes("forearm") ? key.replace("forearm", "hand") : key.replace("arm", "forearm");
      if (!map.has(key) || !map.has(child)) throw new Error("Missing arm segment: " + key);
      return position(map.get(child)).sub(position(map.get(key))).normalize();
    };
    const rows = [];
    for (const [bodyKey, url] of bodies){
      const body = await load(url), target = body.scene, tm = mapBones(target, false);
      for (const [donorKey, donor] of sourceFiles){
        target.updateMatrixWorld(true); donor.scene.updateMatrixWorld(true);
        const sm = mapBones(donor.scene, true);
        const side = map => Math.sign(position(map.get("leftfoot")).x - position(map.get("hips")).x);
        const mirrored = side(sm) !== side(tm);
        const clip = donor.animations[0];
        const lent = lendClip(clip, target, donor.scene, donorKey, 30, !/walk|jog/.test(donorKey));
        const missing = ["leftarm", "leftforearm", "lefthand", "rightarm", "rightforearm", "righthand"].filter(key => !tm.has(key));
        if (missing.length){
          if (lent || !body.animations.length) throw new Error(bodyKey + ": incomplete rig must retain native animations");
          rows.push({ bodyKey, donorKey, nativeOnly: true, missing, worst: 0, samples: 0 });
          continue;
        }
        if (!lent) throw new Error(bodyKey + "/" + donorKey + ": no animation produced");
        const mx = new THREE.AnimationMixer(target), sx = new THREE.AnimationMixer(donor.scene);
        mx.clipAction(lent).play(); sx.clipAction(clip).play();
        let worst = 0, samples = 0;
        try {
          const times = lent.tracks[0].times;
          for (let i = 0; i < 12; i++){
            const time = times[Math.floor((times.length - 1) * i / 12)];
            mx.setTime(time); sx.setTime(time);
            target.updateMatrixWorld(true); donor.scene.updateMatrixWorld(true);
            for (const key of ["leftarm", "rightarm", "leftforearm", "rightforearm"]){
              const sourceKey = !mirrored ? key : key.startsWith("left") ? "right" + key.slice(4) : "left" + key.slice(5);
              let error;
              try { error = direction(sm, sourceKey).angleTo(direction(tm, key)) * 180 / Math.PI; }
              catch (e){ throw new Error(`${bodyKey}/${donorKey}: ${e.message}`); }
              if (!Number.isFinite(error)) throw new Error(bodyKey + ": invalid arm direction");
              worst = Math.max(worst, error); samples++;
            }
          }
        } finally { mx.stopAllAction(); sx.stopAllAction(); mx.uncacheRoot(target); sx.uncacheRoot(donor.scene); }
        rows.push({ bodyKey, donorKey, worst, samples });
      }
      // A check needs one body's geometry at a time, not the entire cast in memory.
      target.traverse(o => { if (o.isMesh){ o.geometry.dispose(); for (const m of [].concat(o.material)){
        for (const value of Object.values(m)) if (value?.isTexture) value.dispose(); m.dispose();
      } } });
    }
    return rows;
  }, { bodies, donors });
  assert.deepEqual(errors, []);
  assert.equal(rows.length, bodies.length * donors.length);
  for (const row of rows){
    if (row.nativeOnly) continue;
    assert.equal(row.samples, 48);
    assert.ok(row.worst < .25, `${row.bodyKey}/${row.donorKey}: arm direction differs by ${row.worst.toFixed(3)}°`);
  }
  const measured = rows.filter(r => !r.nativeOnly), nativeOnly = [...new Set(rows.filter(r => r.nativeOnly).map(r => r.bodyKey))];
  assert.ok(measured.length, "at least one complete rig must be tested");
  console.log(`ok — ${measured.length} body/donor pairs, ${rows.reduce((n, r) => n + r.samples, 0)} arm samples; worst error ${Math.max(...rows.map(r => r.worst)).toFixed(3)}°`);
  if (nativeOnly.length) console.log(`ok — incomplete rigs retain native animations: ${nativeOnly.join(", ")}`);
} finally { await browser.close(); server.close(); }
