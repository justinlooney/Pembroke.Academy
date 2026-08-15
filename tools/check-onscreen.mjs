#!/usr/bin/env node
/**
 * Pembroke Academy — does the on-screen ceiling actually hold?
 *
 *     node tools/check-onscreen.mjs
 *
 * ON_SCREEN_MB is a hard limit on the weight of the DISTINCT BODIES
 * being drawn at any moment. Bodies are downloaded once and shared by
 * every figure wearing them, so the quantity is bodies, not figures.
 *
 * The reason this is a test and not a code review: the ceiling is
 * enforced in four separate places — the opening draw, the crowd's
 * deal, a student coming out of a building, and the body upgrade at an
 * invisible moment — and any one of them forgetting it puts the campus
 * over without a word. So the campus is run and WATCHED, and the peak
 * is what is reported. A limit nobody measured is a comment.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8311;
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".css": "text/css", ".glb": "model/gltf-binary",
               ".png": "image/png", ".woff2": "font/woff2" };
const SECONDS = Number(process.argv[2] || 180);

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
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
await page.goto(`http://localhost:${PORT}/index.html?crowd`, { waitUntil: "load" });
await page.waitForFunction(() => window.__students, null, { timeout: 180000 });

/* The campus decides everything at a waypoint, and a headless tab draws
   about a tenth of a frame a second — so the simulation is stepped
   directly, the way every other crowd measurement here does it, and the
   peak is read between steps. */
const peak = await page.evaluate(async (secs) => {
  const seen = [];
  const sample = () => {
    const b = new Set();
    for (const s of window.__students){
      if (s.inside || !s.g || !s.g.visible) continue;
      const f = s.g.userData && s.g.userData.figure;
      if (f) b.add(f);
    }
    let mb = 0;
    for (const k of b) mb += (window.__castMB || {})[k] || 0;
    return { mb: +mb.toFixed(2), n: b.size, who: [...b].sort().join("+") };
  };
  for (let t = 0; t < secs; t++){
    window.__sim(30, 1 / 30);            /* one second of campus */
    seen.push(sample());
    await new Promise(r => setTimeout(r, 0));
  }
  return seen;
}, SECONDS);

const cap = await page.evaluate(() => window.__onScreenCap);
const worst = peak.reduce((a, b) => (b.mb > a.mb ? b : a), peak[0]);
const counts = {};
for (const p of peak) counts[p.n] = (counts[p.n] || 0) + 1;

console.log(`ceiling            ${cap}MB`);
console.log(`peak over ${String(SECONDS).padStart(3)}s     ${worst.mb}MB — ${worst.n} bodies: ${worst.who}`);
console.log(`bodies on screen   ` +
  Object.entries(counts).sort().map(([n, c]) => `${n}: ${c}s`).join("   "));
const distinct = new Set(peak.flatMap(p => p.who.split("+"))).size;
console.log(`distinct bodies seen over the run   ${distinct}`);

await browser.close();
srv.close();
if (worst.mb > cap + 1e-9){
  console.log(`\nOVER: ${worst.mb}MB against a ceiling of ${cap}MB`);
  process.exit(1);
}
console.log("\nthe ceiling held for every sampled second");
