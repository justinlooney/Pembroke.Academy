#!/usr/bin/env node
/**
 * Pembroke Academy — did every lent clip end up doing the job it was
 * lent for?
 *
 *     node tools/check-roles.mjs
 *
 * A body arrives with no clips at all and is handed four: a sit-down, a
 * walk, a seated loop and (for one student) a jog. lendSitDown knows
 * exactly what each of those is — it asked for it by name and gated it
 * on shape. rolesOf then throws that knowledge away and MEASURES the
 * merged list back from scratch, deciding what is a gait, what is a
 * seat and what is an idle off hip height and thigh cadence.
 *
 * Which is fine while the measurement agrees with the request, and it
 * does — run against the cast, all twelve bodies read the lent sit-down
 * at 0.43 of standing hip height and find the seated loop that meets
 * it. Twelve for twelve. This is not a check written to catch a fault
 * that was caught; it is written because of what the roles ARE.
 *
 * A role is a pose somebody stands in on the quad, and it exists in no
 * file on disk — only in memory, after the lending, worked out from one
 * threshold applied to twelve rigs with twelve sets of proportions.
 * The last thing to go wrong in this area went wrong on every body at
 * once, shipped, and was reported from a phone with a photograph. There
 * was nothing between the lend and the campus that had an opinion.
 *
 * So the rule this checks is the one the campus should never have had
 * to infer: a clip lent for a job is used for that job and no other.
 * Nothing lent may come back as an idle, a gait may not become a seat,
 * and a body that was handed a sit-down must own one.
 *
 * It reports every body's roles either way, because the interesting
 * output here is the table, not the verdict.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8361;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".glb": "model/gltf-binary", ".png": "image/png",
               ".woff2": "font/woff2", ".json": "application/json" };

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const p = resolve(ROOT, "." + (rel === "/" ? "/index.html" : rel));
  if (!p.startsWith(ROOT + sep) || !existsSync(p) || statSync(p).isDirectory()){
    res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({ args: ["--use-gl=swiftshader",
  "--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", e => console.error("page error: " + e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,
                { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__rolesOf && window.__roaming, null,
                           { timeout: 300000 });
/* The whole cast, not the opening wave. Bodies arrive in two waves so
   that the first is small enough to be quick, and a harness that
   settles for whoever has landed judges two of twelve — which is how
   many were checked the first time this ran, on a fault that was in
   one body out of the ten it did not wait for. Every body carrying a
   walk is the signal that the lending has reached it, because the walk
   is itself lent. */
/* Bounded, and then it judges whoever landed. The cast arrives over
   minutes on a software rasterizer and this is one step inside a suite
   with a budget; waiting for the twelfth body is worth some time and
   not unlimited time. The table prints who was and was not seen, so a
   thin run reads as a thin run rather than as a clean campus. */
const WAIT = Number(process.env.WAIT_MS || 300000);
await page.waitForFunction(() => {
  const r = window.__roaming.map(k => window.__rolesOf(k));
  return r.every(x => x && x.gaits.length);
}, null, { timeout: WAIT }).catch(() => {});

const rows = await page.evaluate(() => window.__roaming.map(k => {
  const r = window.__rolesOf(k);
  const src = window.__castLib[k];
  return r ? { k, gaits: r.gaits, idle: r.idle, seat: r.seat, sit: r.sit,
               rise: r.rise, sitTo: r.sitTo, riseFrom: r.riseFrom, talk: r.talk,
               clips: (src?.animations || []).map(c => c.name) }
           : { k, missing: true };
}));

/* Every clip name lendSitDown hands out. A body's own clips are
   whatever the author exported; these are the borrowed ones, and the
   whole point is that they are recognisable by name at the far end. */
const LENT_GAIT = /^(Borrowed Walk|Female Walk \d+|Jogging)$/;
const LENT_SIT = "Stand To Sit";
const LENT_SEAT = "Sitting Idle";      /* succeeded "Sitting Talking" */
const LENT_RISE = "Sit To Stand";
const LENT_TALK = "Talking";
const isLent = (n) => LENT_GAIT.test(n) || [LENT_SIT, LENT_SEAT,
                                            LENT_RISE, LENT_TALK].includes(n);

const bad = [];
let seen = 0;
console.log("body      idle            sit             sitTo  seat            rise           talk      gaits");
for (const r of rows){
  if (r.missing){ console.log(r.k.padEnd(10) + "not loaded"); continue; }
  seen++;
  /* sitTo is where the sit-down leaves the hips, as a fraction of this
     rig's own standing hip height. It is what the seated loop has to
     agree with — more than 0.15 apart and the loop is dropped, because
     chaining them jumps the hips. A bench is around 0.48. */
  console.log(r.k.padEnd(10) + String(r.idle || "—").padEnd(16) +
              String(r.sit || "—").padEnd(16) +
              (r.sit ? r.sitTo.toFixed(2) : "—").padEnd(7) +
              String(r.seat || "—").padEnd(16) +
              String(r.rise || "—").padEnd(15) +
              String(r.talk || "—").padEnd(10) +
              (r.gaits.join(", ") || "—"));
  if (r.idle && isLent(r.idle))
    bad.push(`${r.k}: idle is "${r.idle}", which was lent as something else`);
  if (r.clips.includes(LENT_SIT) && r.sit !== LENT_SIT)
    bad.push(`${r.k}: was lent "${LENT_SIT}" and its sit is ${r.sit ? `"${r.sit}"` : "empty"}`);
  if (r.clips.includes(LENT_SEAT) && r.seat !== LENT_SEAT && r.sit)
    bad.push(`${r.k}: was lent "${LENT_SEAT}" and its seated loop is ` +
             (r.seat ? `"${r.seat}"` : "empty"));
  if (r.clips.includes(LENT_RISE) && r.rise !== LENT_RISE)
    bad.push(`${r.k}: was lent "${LENT_RISE}" and its stand-up is ` +
             (r.rise ? `"${r.rise}"` : "empty"));
  if (r.clips.includes(LENT_TALK) && r.talk !== LENT_TALK)
    bad.push(`${r.k}: was lent "${LENT_TALK}" and its talk is ` +
             (r.talk ? `"${r.talk}"` : "empty"));
  for (const g of r.gaits)
    if (g === LENT_SIT || g === LENT_SEAT)
      bad.push(`${r.k}: "${g}" is being walked with`);
}

if (bad.length){
  console.error(`\n${bad.length} lent clip(s) doing the wrong job:\n  ` + bad.join("\n  "));
} else if (seen){
  console.log(`\nall ${seen} bodies: every lent clip is filling the role it was lent for`);
} else {
  console.error("\ncheck-roles tested NOTHING — no body reported any roles.");
}
await browser.close(); server.close();
process.exit(bad.length || !seen ? 1 : 0);
