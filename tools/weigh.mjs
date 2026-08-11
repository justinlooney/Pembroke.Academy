#!/usr/bin/env node
/**
 * Pembroke Academy — what does a visit actually cost?
 *
 *     node tools/weigh.mjs [seconds]
 *
 * Not what is on disk. A directory listing counts files nobody fetches
 * — this repository was carrying sixty-two megabytes of exactly that —
 * and it cannot tell the difference between the bytes you wait for
 * before the campus is usable and the bytes that arrive quietly
 * afterwards. Only a real page load knows.
 *
 * So: drive the site, record every response, and split it three ways.
 *
 *   critical   fetched before the campus was walkable. This is the
 *              number a first visit feels, and the only one worth
 *              putting against a target.
 *   deferred   the late bodies and the outer world, which arrive while
 *              you are already looking at something.
 *   never      in assets/ and never requested. Free to delete, and
 *              worth knowing about, because it accumulates silently.
 *
 * It also reports triangles and draw calls from the quad, because
 * weight and framerate are different problems with different fixes and
 * conflating them wastes effort on the wrong one.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, extname, sep, basename } from "node:path";

const ROOT = "/home/user/Pembroke.Academy";
const SETTLE = (+process.argv[2] || 240) * 1000;
const PORT = 8211;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".glb":"model/gltf-binary", ".png":"image/png", ".jpg":"image/jpeg",
  ".svg":"image/svg+xml", ".json":"application/json", ".webp":"image/webp" };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/favicon.ico"){ res.writeHead(204); res.end(); return; }
  const p = resolve(ROOT, "." + (rel === "/" ? "/index.html" : rel));
  if (p !== ROOT && !p.startsWith(ROOT + sep)){ res.writeHead(403); res.end(); return; }
  if (!existsSync(p) || statSync(p).isDirectory()){ res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

/* Recorded per response rather than per request: a request that never
   finishes has cost nothing yet, and counting it would flatter nothing
   and mislead everyone. */
const got = new Map();
const t0 = Date.now();
page.on("response", async (r) => {
  const url = r.url();
  if (!url.startsWith(`http://127.0.0.1:${PORT}/`)) return;
  let size = 0;
  try { size = (await r.body()).length; } catch { /* aborted */ }
  const name = url.split(`:${PORT}/`)[1].split("?")[0];
  got.set(name, { size, at: Date.now() - t0 });
});

await page.goto(`http://127.0.0.1:${PORT}/?debug`, { waitUntil: "domcontentloaded" });

/* The moment the campus is walkable — everything after this is arriving
   behind a scene somebody is already looking at. */
let walkableAt = null;
await page.waitForFunction(() => window.__crowd?.().ready === true,
                           null, { timeout: SETTLE }).then(
  () => { walkableAt = Date.now() - t0; },
  () => console.log("(campus never became walkable within the window)"));
console.log(`campus walkable at ${walkableAt === null ? "never" : (walkableAt / 1000).toFixed(1) + "s"}`);

await page.waitForTimeout(Math.max(0, SETTLE - (Date.now() - t0)));

const scene = await page.evaluate(() => {
  const c = window.__crowd?.() || {};
  return { draws: c.draws, tris: c.tris, people: c.people };
}).catch(() => ({}));

/* ── the three buckets ────────────────────────────────────────────── */
const cut = walkableAt ?? Infinity;
let critical = 0, deferred = 0;
const rows = [];
for (const [name, r] of got){
  if (r.at <= cut) critical += r.size; else deferred += r.size;
  rows.push([name, r.size, r.at <= cut ? "critical" : "deferred", r.at]);
}
rows.sort((a, b) => b[1] - a[1]);

const onDisk = new Set();
const walk = (d) => readdirSync(resolve(ROOT, d), { withFileTypes: true }).forEach(e => {
  if (e.isDirectory()) walk(d + "/" + e.name);
  else if (/\.(glb|png|jpe?g|webp)$/i.test(e.name)) onDisk.add(d + "/" + e.name);
});
walk("assets");
let never = 0;
const unused = [];
for (const f of onDisk){
  if (got.has(f)) continue;
  const s = statSync(resolve(ROOT, f)).size;
  never += s;
  unused.push([f, s]);
}
unused.sort((a, b) => b[1] - a[1]);

const mb = (n) => (n / 1e6).toFixed(2).padStart(7) + "MB";
console.log("\n════ what a visit downloads ════");
console.log("critical  " + mb(critical) + "   before the campus is walkable");
console.log("deferred  " + mb(deferred) + "   after, while you are looking at it");
console.log("total     " + mb(critical + deferred));
console.log("never     " + mb(never) + "   on disk, never requested" +
            (unused.length ? " (" + unused.length + " files)" : ""));
if (scene.draws) console.log(`\nscene     ${scene.draws} draws, ${(scene.tris / 1e6).toFixed(2)}M triangles, ${scene.people} people`);

console.log("\n════ heaviest requests ════");
rows.slice(0, 22).forEach(([n, s, k, at]) =>
  console.log(`${mb(s)}  ${k.padEnd(8)} ${(at / 1000).toFixed(0).padStart(3)}s  ${basename(n)}`));

if (unused.length){
  console.log("\n════ never requested ════");
  unused.slice(0, 15).forEach(([n, s]) => console.log(`${mb(s)}  ${basename(n)}`));
}
await browser.close(); server.close();
