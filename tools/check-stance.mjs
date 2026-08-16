#!/usr/bin/env node
/**
 * Pembroke Academy — is everybody who was parked somewhere actually
 * standing (or seated) the way a person does?
 *
 *     node tools/check-stance.mjs
 *
 * The plan parks students: at doors, on the plaza, on the lawn with a
 * laptop. A parked student is `static` and stepStudents never steps
 * them (`if (s.static) continue`) — whatever pose the build left is
 * the pose they hold for the whole visit, and they are parked exactly
 * where a visitor walks up close. Two of the campus's worst field
 * reports were this: a loiterer LOOPING the lent sit-down at a door
 * ("stuck in a sitting down over and over again"), and Priya frozen
 * 0.7 seconds into the same clip, mid-bow, on the plaza — because the
 * stance picker took animations[0] on faith and on an authored body
 * animations[0] is "Stand To Sit".
 *
 * No screenshot judging here: the skeleton is measured. For a STANDING
 * student the head should sit near the top of the figure and the hips
 * near half height; a figure folded at the waist carries its head at
 * hip height and fails loudly. A student whose plan SEATS them (the
 * laptop pose) is exempt from the head test and instead must have
 * dropped hips — seated is the one pose where low is correct.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8367;
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
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 300000 });
/* the named cast is built in waves as bodies land; wait for the parked
   ones — the population this whole file is about */
await page.waitForFunction(() => window.__convo &&
  window.__convo.named().filter(s => s.static).length >= 3,
  null, { timeout: 300000 }).catch(() => {});
/* let the mixers write the held poses at least once */
await page.waitForTimeout(3000);

const rows = await page.evaluate(() => {
  const THREE = window.__app.THREE;
  const v = new THREE.Vector3(), lo = new THREE.Vector3(), hi = new THREE.Vector3();
  return window.__convo.named().filter(s => s.static).map(s => {
    const g = s.g;
    g.updateMatrixWorld(true);
    let head = null, hips = null;
    g.traverse(o => {
      if (!o.isBone) return;
      const k = (o.name || "").toLowerCase();
      if (!head && /head/.test(k) && !/top|end/.test(k)) head = o;
      if (!hips && /hip|pelvis/.test(k)) hips = o;
    });
    const bb = new THREE.Box3().setFromObject(g);
    bb.getSize(v); lo.copy(bb.min);
    const h = v.y;
    const headY = head ? head.getWorldPosition(hi).y - lo.y : null;
    const hipsY = hips ? hips.getWorldPosition(hi).y - lo.y : null;
    return { name: s.data?.name || "?", kind: s.kind || "stands", held: !!s.held,
             clip: g.userData.anim?.current || null,
             height: +h.toFixed(1),
             head: headY === null ? null : +(headY / h).toFixed(2),
             hips: hipsY === null ? null : +(hipsY / h).toFixed(2) };
  });
});

const bad = [];
console.log("name      kind      held   clip                head   hips");
for (const r of rows){
  console.log(r.name.padEnd(10) + r.kind.padEnd(10) + String(r.held).padEnd(7) +
              String(r.clip || "—").padEnd(20) +
              String(r.head ?? "?").padEnd(7) + String(r.hips ?? "?"));
  if (r.head === null || r.hips === null){
    bad.push(`${r.name}: no measurable skeleton`); continue;
  }
  if (r.kind === "laptop"){
    /* seated on purpose: the one place low hips are right */
    if (r.hips > 0.42) bad.push(`${r.name}: parked to SIT and standing (hips at ${r.hips})`);
  } else {
    /* parked standing: a bowed figure carries its head at hip height */
    if (r.head < 0.75) bad.push(`${r.name}: head at ${r.head} of height — folded over`);
    if (r.hips < 0.38) bad.push(`${r.name}: hips at ${r.hips} of height — sat down with no seat`);
  }
}

if (bad.length){
  console.error(`\n${bad.length} parked student(s) in a pose no person waits in:\n  ` +
                bad.join("\n  "));
} else if (rows.length >= 3){
  console.log(`\nall ${rows.length} parked students hold a pose a person actually holds`);
} else {
  console.error(`\ncheck-stance saw only ${rows.length} parked student(s) — ` +
                `not enough to vouch for the campus.`);
}
await browser.close(); server.close();
process.exit(bad.length || rows.length < 3 ? 1 : 0);
