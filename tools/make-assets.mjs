#!/usr/bin/env node
/**
 * Pembroke Academy — glTF 2.0 asset forge
 * Authors the campus prop library as valid binary glTF (.glb) files:
 *   assets/tree.glb   — low-poly elm, jittered canopy spheres + trunk
 *   assets/car.glb    — body, glass cabin, four wheels
 *   assets/lamp.glb   — wrought-iron post with an emissive amber head
 *   assets/bench.glb  — slatted quad bench
 * Zero dependencies: the GLB container (JSON chunk + BIN chunk) is
 * written by hand per the glTF 2.0 spec. Y-up, meters-ish units where
 * 1 unit = 1 scene pixel of the old CSS campus (people are ~40 tall).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "assets"), { recursive: true });

/* ── tiny mesh builders (positions + normals + indices per material) ── */
function prim(){ return { pos: [], nrm: [], idx: [] }; }

function addBox(p, cx, cy, cz, w, h, d){
  /* axis-aligned box centered at (cx, cy+h/2, cz) — cy is its base */
  const x0 = cx - w/2, x1 = cx + w/2;
  const y0 = cy, y1 = cy + h;
  const z0 = cz - d/2, z1 = cz + d/2;
  const faces = [
    [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1], [ 1,0,0]],
    [[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0], [-1,0,0]],
    [[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0], [0, 1,0]],
    [[x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1], [0,-1,0]],
    [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], [0,0, 1]],
    [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], [0,0,-1]],
  ];
  for (const [a, b, c, d2, n] of faces){
    const base = p.pos.length / 3;
    for (const v of [a, b, c, d2]){ p.pos.push(...v); p.nrm.push(...n); }
    p.idx.push(base, base+1, base+2, base, base+2, base+3);
  }
}

function addCylinder(p, cx, cy, cz, rBot, rTop, h, seg){
  const base = () => p.pos.length / 3;
  const ring = (y, r) => {
    const out = [];
    for (let i = 0; i <= seg; i++){
      const a = (i / seg) * Math.PI * 2;
      out.push([cx + Math.cos(a)*r, y, cz + Math.sin(a)*r, Math.cos(a), 0, Math.sin(a)]);
    }
    return out;
  };
  const b0 = base();
  for (const v of ring(cy, rBot)) { p.pos.push(v[0], v[1], v[2]); p.nrm.push(v[3], 0.2, v[5]); }
  for (const v of ring(cy + h, rTop)) { p.pos.push(v[0], v[1], v[2]); p.nrm.push(v[3], 0.2, v[5]); }
  for (let i = 0; i < seg; i++){
    const a = b0 + i, b = b0 + i + 1, c = b0 + seg + 1 + i, d = b0 + seg + 2 + i;
    p.idx.push(a, c, b, b, c, d);
  }
  /* top cap */
  const capC = base();
  p.pos.push(cx, cy + h, cz); p.nrm.push(0, 1, 0);
  const capR = base();
  for (const v of ring(cy + h, rTop)) { p.pos.push(v[0], v[1], v[2]); p.nrm.push(0, 1, 0); }
  for (let i = 0; i < seg; i++) p.idx.push(capC, capR + i + 1, capR + i);
}

function addBlobSphere(p, cx, cy, cz, r, squash, seedBase){
  /* organic canopy: lat/long sphere with seeded radial jitter, smooth normals */
  const LA = 7, LO = 10;
  const rand = (i) => { const x = Math.sin(seedBase * 91.7 + i * 47.3) * 43758.545; return x - Math.floor(x); };
  const start = p.pos.length / 3;
  for (let la = 0; la <= LA; la++){
    const phi = (la / LA) * Math.PI;
    for (let lo = 0; lo <= LO; lo++){
      const th = (lo / LO) * Math.PI * 2;
      const j = 1 + (rand(la * 31 + (lo % LO)) - 0.5) * 0.34;
      const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
      p.pos.push(cx + nx * r * j, cy + ny * r * squash * j, cz + nz * r * j);
      p.nrm.push(nx, ny, nz);
    }
  }
  for (let la = 0; la < LA; la++){
    for (let lo = 0; lo < LO; lo++){
      const a = start + la * (LO + 1) + lo, b = a + LO + 1;
      p.idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
}

/* ── GLB writer (glTF 2.0 core, one node per named primitive set) ── */
function writeGLB(path, name, parts){
  /* parts: [{prim, material:{baseColor:[r,g,b], metallic, roughness, emissive?}}] */
  const json = {
    asset: { version: "2.0", generator: "Pembroke Academy asset forge" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: [] }],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  const bins = [];
  let offset = 0;
  const pushView = (buf, target) => {
    const view = { buffer: 0, byteOffset: offset, byteLength: buf.byteLength };
    if (target) view.target = target;
    json.bufferViews.push(view);
    bins.push(buf);
    offset += buf.byteLength;
    const pad = (4 - (offset % 4)) % 4;
    if (pad){ bins.push(Buffer.alloc(pad)); offset += pad; }
    return json.bufferViews.length - 1;
  };
  parts.forEach((part, pi) => {
    const { pos, nrm, idx } = part.prim;
    const posBuf = Buffer.from(new Float32Array(pos).buffer);
    const nrmBuf = Buffer.from(new Float32Array(nrm).buffer);
    const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
    const vPos = pushView(posBuf, 34962), vNrm = pushView(nrmBuf, 34962), vIdx = pushView(idxBuf, 34963);
    const mins = [Infinity, Infinity, Infinity], maxs = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3)
      for (let k = 0; k < 3; k++){ mins[k] = Math.min(mins[k], pos[i+k]); maxs[k] = Math.max(maxs[k], pos[i+k]); }
    const aPos = json.accessors.push({ bufferView: vPos, componentType: 5126, count: pos.length/3, type: "VEC3", min: mins, max: maxs }) - 1;
    const aNrm = json.accessors.push({ bufferView: vNrm, componentType: 5126, count: nrm.length/3, type: "VEC3" }) - 1;
    const aIdx = json.accessors.push({ bufferView: vIdx, componentType: 5123, count: idx.length, type: "SCALAR" }) - 1;
    const m = part.material;
    const mi = json.materials.push({
      name: m.name || `${name}-mat${pi}`,
      pbrMetallicRoughness: {
        baseColorFactor: [...m.baseColor, 1],
        metallicFactor: m.metallic ?? 0,
        roughnessFactor: m.roughness ?? 0.9,
      },
      ...(m.emissive ? { emissiveFactor: m.emissive } : {}),
    }) - 1;
    json.meshes[0].primitives.push({ attributes: { POSITION: aPos, NORMAL: aNrm }, indices: aIdx, material: mi });
  });
  json.buffers.push({ byteLength: offset });

  let jsonStr = JSON.stringify(json);
  while (jsonStr.length % 4) jsonStr += " ";
  const jsonBuf = Buffer.from(jsonStr, "utf8");
  const binBuf = Buffer.concat(bins);
  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546C67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length, 12); out.writeUInt32LE(0x4E4F534A, 16);
  jsonBuf.copy(out, 20);
  const binHead = 20 + jsonBuf.length;
  out.writeUInt32LE(binBuf.length, binHead); out.writeUInt32LE(0x004E4942, binHead + 4);
  binBuf.copy(out, binHead + 8);
  writeFileSync(path, out);
  console.log(`wrote ${path}  (${(total/1024).toFixed(1)} KB, ${parts.length} prims)`);
}

/* ── the props ───────────────────────────────────────────────────── */
/* TREE — trunk + three-lobed jittered canopy (unit ~46 tall) */
{
  const trunk = prim(), canopyA = prim(), canopyB = prim();
  addCylinder(trunk, 0, 0, 0, 2.6, 1.7, 17, 7);
  addBlobSphere(canopyA, 0, 30, 0, 12.5, 0.86, 1);
  addBlobSphere(canopyA, -7, 25, 3, 7.5, 0.8, 2);
  addBlobSphere(canopyB, 7.5, 26, -2, 8, 0.82, 3);
  addBlobSphere(canopyB, 1, 37, 1, 7, 0.75, 4);
  writeGLB(join(root, "assets/tree.glb"), "elm", [
    { prim: trunk,   material: { name:"bark",   baseColor: [0.30, 0.22, 0.13], roughness: 1.0 } },
    { prim: canopyA, material: { name:"leafA",  baseColor: [0.22, 0.38, 0.16], roughness: 0.95 } },
    { prim: canopyB, material: { name:"leafB",  baseColor: [0.28, 0.46, 0.20], roughness: 0.95 } },
  ]);
}
/* CAR — body + cabin + wheels (~30 long) */
{
  const body = prim(), glass = prim(), wheels = prim(), trimP = prim();
  addBox(body, 0, 2.2, 0, 30, 6.5, 15);
  addBox(body, 12.5, 2.2, 0, 5, 4.5, 15);      /* hood step */
  addBox(glass, -1.5, 8.7, 0, 15, 5.5, 12.5);  /* cabin */
  for (const wx of [-9.5, 9.5]) for (const wz of [-7.2, 7.2]){
    const w = prim();
    addCylinder(w, wx, 0, wz, 3.1, 3.1, 2.6, 9);
    /* cylinders build vertically; rotate wheel by swapping axes inline */
    for (let i = 0; i < w.pos.length; i += 3){
      const y = w.pos[i+1], z = w.pos[i+2];
      w.pos[i+1] = z - wz + 3.1; w.pos[i+2] = y + wz - 0;
      const ny = w.nrm[i+1], nz = w.nrm[i+2];
      w.nrm[i+1] = nz; w.nrm[i+2] = ny;
    }
    wheels.pos.push(...w.pos); wheels.nrm.push(...w.nrm);
    const base = (wheels.pos.length - w.pos.length) / 3;
    wheels.idx.push(...w.idx.map(ix => ix + base));
  }
  addBox(trimP, 0, 1.6, 0, 31, 1.6, 15.6);     /* rocker/bumper line */
  writeGLB(join(root, "assets/car.glb"), "car", [
    { prim: body,   material: { name:"paint",  baseColor: [0.62, 0.16, 0.13], metallic: 0.35, roughness: 0.35 } },
    { prim: glass,  material: { name:"glass",  baseColor: [0.16, 0.22, 0.28], metallic: 0.7,  roughness: 0.12 } },
    { prim: wheels, material: { name:"tire",   baseColor: [0.05, 0.05, 0.06], roughness: 1.0 } },
    { prim: trimP,  material: { name:"trim",   baseColor: [0.10, 0.10, 0.11], roughness: 0.7 } },
  ]);
}
/* LAMP — fluted post + amber head (~48 tall) */
{
  const post = prim(), head = prim(), finial = prim();
  addBox(post, 0, 0, 0, 5, 3, 5);
  addCylinder(post, 0, 3, 0, 1.5, 1.1, 38, 7);
  addBox(head, 0, 41, 0, 7.5, 8, 7.5);
  addBox(finial, 0, 49, 0, 3, 2.4, 3);
  writeGLB(join(root, "assets/lamp.glb"), "lamp", [
    { prim: post,   material: { name:"iron",   baseColor: [0.10, 0.11, 0.13], metallic: 0.6, roughness: 0.5 } },
    { prim: head,   material: { name:"glow",   baseColor: [1.0, 0.86, 0.55], emissive: [1.0, 0.72, 0.28], roughness: 0.4 } },
    { prim: finial, material: { name:"iron2",  baseColor: [0.10, 0.11, 0.13], metallic: 0.6, roughness: 0.5 } },
  ]);
}
/* BENCH — two stone cheeks + oak slats (~26 long) */
{
  const stone = prim(), slats = prim();
  addBox(stone, -11, 0, 0, 4, 8, 10);
  addBox(stone, 11, 0, 0, 4, 8, 10);
  for (const sz of [-3.4, 0, 3.4]) addBox(slats, 0, 8, sz, 26, 1.8, 2.6);
  addBox(slats, 0, 12.5, -4.6, 26, 5.5, 1.6);  /* backrest */
  writeGLB(join(root, "assets/bench.glb"), "bench", [
    { prim: stone, material: { name:"stone", baseColor: [0.55, 0.52, 0.45], roughness: 1.0 } },
    { prim: slats, material: { name:"oak",   baseColor: [0.42, 0.30, 0.18], roughness: 0.85 } },
  ]);
}
console.log("asset forge complete.");
