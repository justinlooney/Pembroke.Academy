#!/usr/bin/env node
/**
 * Pembroke Academy — can this clip donor be lent to the cast?
 *
 *     node tools/check-donor.mjs assets/clip_idle.glb [more.glb ...]
 *     node tools/check-donor.mjs                      (every clip_*.glb)
 *
 * A donor is a skeleton, its rest pose and one motion, with the mesh
 * thrown away. lendClip carries each bone's change FROM ITS OWN REST
 * onto the receiver's rest, which assumes the donor's rest is neutral.
 * When it is not, the receiver wears the difference: walker's rest sits
 * 90 degrees off his bind on all fourteen clip-driven bones, and his
 * Idle lent the woman a hunch and isla a backward bend. Both passed the
 * numeric gate. Both were obviously wrong on sight.
 *
 * So this reports two things and neither replaces the other:
 *
 *   BINDS      how many tracks landed on the receiver's bones, and what
 *              poseLooksWrong made of the result. A donor that binds
 *              nothing is dead on arrival and needs no picture.
 *   PICTURE    the lent pose drawn on each body at four moments of the
 *              clip, through the campus's own renderer and its own
 *              lendClip, written to .shots/. Both clips this project
 *              has had to withdraw were withdrawn on the strength of a
 *              picture, after the numbers had passed them.
 *
 * Comparing a donor's rest against another donor's is NOT a test: the
 * female walk donor sits 173 degrees from the sit donor on one bone and
 * lends perfectly, because two exporters put the same T-pose in
 * different local frames. Only the receiver's opinion counts.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, extname, sep, basename } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUT = resolve(ROOT, ".shots");
const PORT = 8307;
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".css": "text/css", ".glb": "model/gltf-binary",
               ".png": "image/png", ".woff2": "font/woff2",
               ".json": "application/json" };

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const only = process.argv.includes("--numbers");     /* skip the pictures */
const donors = (args.length ? args : readdirSync(resolve(ROOT, "assets"))
  .filter(f => /^clip_.*\.glb$/.test(f)).sort().map(f => "assets/" + f))
  .map(p => p.replace(/^\.?\//, ""));
if (!donors.length){
  console.error("no clip_*.glb in assets/ and none named");
  process.exit(1);
}

/* Whether a clip ends standing or seated changes what poseLooksWrong
   will accept — a sit that ends upright is a failure and an idle that
   ends folded is one too. Read from the name, which is the only thing
   a donor file carries. */
const expectOf = (p) => /talk|sit/.test(basename(p)) ? "sit" : "stand";

const srv = createServer(async (req, res) => {
  const p = resolve(ROOT, decodeURIComponent(req.url.split("?")[0]).slice(1) || "index.html");
  if (!p.startsWith(ROOT + sep) && p !== ROOT) return res.writeHead(403).end();
  if (!existsSync(p) || !statSync(p).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise((ok) => srv.listen(PORT, ok));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=swiftshader",
  "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on("pageerror", (e) => console.log("  page error:", String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.__castLib &&
  Object.keys(window.__castLib).length >= 3, null, { timeout: 180000 });
/* Let the rest of the cast finish arriving; a body still downloading is
   not evidence of anything. */
await page.waitForTimeout(20000);

const bodies = await page.evaluate(() => Object.keys(window.__castLib).sort());
console.log("receivers:", bodies.join(", "), "\n");

let bad = 0;
for (const donor of donors){
  const expect = expectOf(donor);
  console.log(`── ${basename(donor)}   (should end ${expect}) ──`);
  for (const k of bodies){
    const url = `assets/stu_${k}.glb`;
    const r = await page.evaluate(([u, d, e]) => window.__lendTo(u, d, null, e),
      [url, donor, expect]);
    const ok = !r.err && r.why === "clean";
    if (!ok) bad++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${k.padEnd(8)} ` +
      (r.err ? "ERR " + r.err : `${String(r.tracks).padStart(2)} tracks · ${r.why}`));
    if (only || r.err) continue;
    /* Four moments, evenly spread, so a clip that is right at the ends
       and wrong in the middle cannot hide between two samples. */
    for (let i = 0; i < 4; i++){
      /* Posed twice: once to learn the clip's duration from the lend
         itself, then again at the fraction wanted. Reading the duration
         off the donor file instead would be reading a different clip
         than the one on screen. */
      const pose = await page.evaluate(([u, d, frac, e]) =>
        window.__poseAt(u, d, null, 0, e).then(res =>
          res.err ? res : window.__poseAt(u, d, null, res.dur * frac, e)),
        [url, donor, (i + 0.5) / 4, expect]);
      if (pose.err) break;
      await page.waitForTimeout(250);
      await page.screenshot({ path: resolve(OUT,
        `${basename(donor, ".glb")}__${k}__${i}.png`) });
    }
  }
  console.log("");
}

await browser.close();
srv.close();
console.log(bad ? `${bad} pairing(s) the gate rejected` : "every pairing binds clean");
if (!only) console.log("The gate is not the verdict — look at .shots/ before wiring anything.");
process.exit(bad ? 1 : 0);
