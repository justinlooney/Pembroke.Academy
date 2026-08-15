#!/usr/bin/env node
/**
 * Pembroke Academy — where does a frame actually go?
 *
 *     node tools/check-frame.mjs
 *
 * NOT a frame rate. This runs on a software rasterizer that draws the
 * campus at about a tenth of a frame a second, and this repository has
 * twice had an investigation measure the harness and report it as the
 * campus — "students crawl" and "nobody is walking" were both the
 * rasterizer. An fps number from here is worse than no number, because
 * somebody will act on it.
 *
 * So this counts the things that are the same on any GPU and that a
 * frame is actually made of:
 *
 *   DRAW CALLS    the number of times the CPU tells the GPU to draw.
 *                 On a phone this is usually the ceiling, not triangles.
 *   TRIANGLES     what the vertex stage chews through, and again in
 *                 every shadow pass.
 *   SHADOWS       a shadow map re-draws the casters from the light. A
 *                 caster nobody sees the shadow of is paid for twice
 *                 for nothing.
 *   PROGRAMS      each distinct shader is a compile at load and a state
 *                 change in the frame.
 *   TEXTURES      what has to fit in VRAM, and what a phone evicts.
 *
 * Everything is attributed to the part of the campus it belongs to, so
 * "the buildings" and "the people" and "the flora" can be compared
 * rather than argued about.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8317;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".glb": "model/gltf-binary", ".png": "image/png", ".woff2": "font/woff2" };

const srv = createServer(async (req, res) => {
  const p = resolve(ROOT, decodeURIComponent(req.url.split("?")[0]).slice(1) || "index.html");
  if (!p.startsWith(ROOT + sep) && p !== ROOT) return res.writeHead(403).end();
  if (!existsSync(p) || !statSync(p).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise((ok) => srv.listen(PORT, ok));

const browser = await chromium.launch({ args: ["--use-gl=swiftshader",
  "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
/* Generous: a software rasterizer under contention from another
   headless browser has taken well over the 30s default, and the run
   then dies on a timeout that says nothing about the campus. */
await page.goto(`http://localhost:${PORT}/index.html?crowd`,
  { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__crowd && window.__crowd().ready &&
  window.__students.length > 0, null, { timeout: 600000 });
await page.evaluate(() => window.__crowdFill());
await page.waitForTimeout(4000);

const r = await page.evaluate(() => {
  const { world, camera, renderer, THREE } = window.__app;
  const scene = world.parent || world;

  /* Attribute by the SCENE GRAPH, not by guessing at names. The first
     version matched names with a regex and put 399 of 475 meshes in
     "other", which is a breakdown that breaks nothing down. The campus
     builds its groups deliberately; the group an object hangs under is
     the answer, and the top-level child of the world is the coarsest
     honest bucket there is. */
  const topOf = (o) => {
    let last = o;
    for (let n = o; n && n !== scene; n = n.parent){
      if (n.parent === scene || n.parent === world) last = n;
    }
    return last;
  };
  const bucketOf = (o) => {
    if (o.userData?.figure) return "people: " + o.userData.figure;
    const t = topOf(o);
    return (t.name || t.type || "unnamed") + (t === o ? " (loose)" : "");
  };

  const B = {}, add = (b, k, v) => { (B[b] = B[b] || {})[k] = (B[b][k] || 0) + v; };
  const mats = new Set(), texes = new Set();
  let shadowTris = 0, shadowDraws = 0;

  camera.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

  scene.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) return;
    if (!o.visible) return;
    const g = o.geometry;
    if (!g || !g.attributes.position) return;
    const per = (g.index ? g.index.count : g.attributes.position.count) / 3;
    const n = o.isInstancedMesh ? o.count : 1;
    const tris = per * n;
    const b = bucketOf(o);
    add(b, "draws", o.isInstancedMesh ? 1 : 1);
    add(b, "tris", tris);
    add(b, "meshes", 1);
    if (o.isInstancedMesh) add(b, "instances", n);
    if (o.castShadow){ shadowTris += tris; shadowDraws++; add(b, "shadowTris", tris); }
    /* in view from where the camera actually is */
    if (o.boundingSphere || g.boundingSphere){
      const s = (g.boundingSphere || o.boundingSphere).clone();
      s.applyMatrix4(o.matrixWorld);
      if (frustum.intersectsSphere(s)){ add(b, "inViewDraws", 1); add(b, "inViewTris", tris); }
    }
    for (const m of [].concat(o.material)){
      if (!m) continue;
      mats.add(m);
      for (const k in m) if (m[k] && m[k].isTexture) texes.add(m[k]);
    }
  });

  /* Texture memory attributed the same way. This is the number a phone
     actually feels: a 3.5MB character file becomes 63.8MB of RGBA in
     VRAM, and the on-screen ceiling counts the 3.5 rather than the
     63.8. Sizes are the DECODED footprint — width x height x RGBA,
     plus a third again for the mip chain. */
  let texBytes = 0;
  const byTex = new Map();
  for (const t of texes){
    const im = t.image;
    const w = im?.width || im?.videoWidth || 0, h = im?.height || im?.videoHeight || 0;
    if (!w || !h) continue;
    const bytes = w * h * 4 * (t.generateMipmaps === false ? 1 : 1.33);
    texBytes += bytes;
    const k = w + "x" + h;
    byTex.set(k, (byTex.get(k) || 0) + bytes);
  }
  /* and per bucket, so "the people" can be weighed against "the halls" */
  const texByBucket = {};
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.visible || !(o.isMesh || o.isInstancedMesh || o.isSkinnedMesh)) return;
    const b = bucketOf(o);
    for (const mm of [].concat(o.material)){
      if (!mm) continue;
      for (const k in mm){
        const t = mm[k];
        if (!t || !t.isTexture || seen.has(t)) continue;
        seen.add(t);
        const im = t.image;
        const w = im?.width || im?.videoWidth || 0, h = im?.height || im?.videoHeight || 0;
        if (!w || !h) continue;
        texByBucket[b] = (texByBucket[b] || 0) + w * h * 4 * 1.33;
      }
    }
  });

  const info = renderer.info;
  return {
    buckets: B,
    render: { calls: info.render.calls, tris: info.render.triangles },
    programs: info.programs?.length ?? null,
    materials: mats.size,
    textures: texes.size,
    texMB: +(texBytes / 1048576).toFixed(1),
    byTex: [...byTex].map(([k, v]) => [k, +(v / 1048576).toFixed(1)])
                     .sort((a, b) => b[1] - a[1]),
    texByBucket: Object.fromEntries(Object.entries(texByBucket)
                   .map(([k, v]) => [k, +(v / 1048576).toFixed(1)])),
    shadowTris, shadowDraws,
    shadowMap: renderer.shadowMap.enabled ? renderer.shadowMap.type : "off",
    lights: (() => { let n = 0; scene.traverse(o => { if (o.isLight) n++; }); return n; })(),
    shadowLights: (() => { let n = 0; scene.traverse(o => { if (o.isLight && o.castShadow) n++; }); return n; })(),
    people: window.__students.filter(s => s.g && s.g.visible && !s.inside).length,
    pixelRatio: renderer.getPixelRatio(),
    size: (() => { const v = new THREE.Vector2(); renderer.getSize(v); return `${v.x}x${v.y}`; })(),
  };
});

const n = (x) => (x || 0).toLocaleString();
const m = (x) => ((x || 0) / 1e6).toFixed(2) + "M";
console.log(`renderer   ${r.size} at pixelRatio ${r.pixelRatio}`);
console.log(`draw calls ${n(r.render.calls)}   triangles ${m(r.render.tris)}   (three.js own count for the last frame)`);
console.log(`programs   ${r.programs}   materials ${r.materials}   textures ${r.textures} (~${r.texMB}MB decoded)`);
console.log(`lights     ${r.lights}, of which ${r.shadowLights} cast shadows (${r.shadowMap})`);
console.log(`shadows    ${n(r.shadowDraws)} casters, ${m(r.shadowTris)} triangles re-drawn per shadow pass`);
console.log(`people out ${r.people}`);
console.log("");
const head = ["", "meshes", "draws", "triangles", "in view", "tris in view", "shadow tris", "texture MB"];
const rows = Object.entries(r.buckets)
  .sort((a, b) => (b[1].tris || 0) - (a[1].tris || 0))
  .map(([k, v]) => [k, n(v.meshes), n(v.draws), m(v.tris),
                    n(v.inViewDraws), m(v.inViewTris), m(v.shadowTris),
                    (r.texByBucket[k] || 0).toFixed(1)]);
const w = head.map((_, i) => Math.max(head[i].length, ...rows.map(x => (x[i] || "").length)));
const line = (c) => c.map((x, i) => String(x || "").padEnd(w[i])).join("  ");
console.log(line(head));
console.log(w.map(x => "─".repeat(x)).join("  "));
rows.forEach(x => console.log(line(x)));
console.log("\ntexture memory by ORIGIN — a canvas the page drew, or an image it fetched");
for (const [k, v] of Object.entries(r.byOrigin || {}))
  console.log(`   ${String(v.mb.toFixed(1)).padStart(7)}MB  ${String(v.n).padStart(3)} textures  ${k}`);
console.log("\ntexture memory by resolution — the decoded footprint, not the file size");
for (const [dim, mb] of r.byTex)
  console.log(`   ${String(mb).padStart(7)}MB  ${dim}`);

await browser.close();
srv.close();
