#!/usr/bin/env node
/**
 * Pembroke Academy — the ledger's own rules.
 *
 *     node tools/check-ledger.mjs
 *
 * Two things the drive cannot see, because neither one looks like a
 * fault from outside: a campus that never ignites reads as a campus
 * that is merely slow, and a degree taken in reverse reads as a degree.
 *
 *   1. A stored ledger is JSON somebody else wrote — a stale migration,
 *      a partial write, a hand edit, a shape from three releases ago.
 *      A nested null used to replace a whole record and take the boot
 *      down with it: no error screen, no recovery, every reload, and
 *      the reset that would fix it behind a page that never rendered.
 *
 *   2. A seal is a claim the visitor makes, but registration
 *      prerequisites and the degree both READ that claim. Sealing in
 *      reverse used to confer the degree without opening a lecture.
 *
 * It lives beside the drive rather than inside it. The drive already
 * takes twenty-five minutes on a software rasterizer, and this needs
 * four page loads of its own; folded in, it took a 37-minute suite and
 * timed out two checks that pass in twenty-four seconds on a quiet
 * machine — a false red accusing a fix that works. The workflow has
 * learned this lesson twice already and wrote it down both times.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8098;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript",
  ".css":"text/css", ".glb":"model/gltf-binary", ".png":"image/png", ".woff2":"font/woff2",
  ".jpg":"image/jpeg", ".webp":"image/webp", ".svg":"image/svg+xml",
  ".webmanifest":"application/manifest+json" };

const server = createServer(async (req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split("?")[0]); }
  catch { res.writeHead(400); return res.end(); }
  if (rel === "/favicon.ico"){ res.writeHead(204); return res.end(); }
  const path = resolve(ROOT, "." + (rel === "/" ? "/index.html" : rel));
  if (path !== ROOT && !path.startsWith(ROOT + sep)){ res.writeHead(403); return res.end(); }
  if (!existsSync(path) || statSync(path).isDirectory()){ res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
  res.end(await readFile(path));
});

const failures = [];
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures.push(name);
};

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

/* Generous, like the drive's waits and for the same reason: a boot is
   ~22s idle here and this runs on a machine with no GPU at all. */
const booted = () => page.waitForFunction(() => window.__app && window.__journey,
                                          null, { timeout: 240_000 }).then(() => true, () => false);

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  step("a clean ledger boots", await booted());

  /* ── 1. a malformed ledger costs a field, not the university ──────
     Three shapes, not every shape: a nested null (the fault), a
     wrong-typed array (the same fault reached through .map rather than
     a read through null), and a "__proto__" key, which JSON.parse
     hands back as a genuine own property that plain assignment would
     give to the prototype setter. The rest are these two code paths
     wearing different field names. */
  const MALFORMED = [
    ['{"registration":null}',                                           "nested null"],
    ['{"registration":{"registeredCourseIds":"nope","completedAt":1}}', "wrong type"],
    ['{"__proto__":{"polluted":"yes"},"advising":{"completedAt":7}}',   "__proto__ key"],
  ];
  const wontBoot = [];
  for (const [raw, label] of MALFORMED){
    await page.evaluate(v => localStorage.setItem("pembroke.registrar.journey", v), raw);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => {});
    const up = await booted();
    const clean = await page.evaluate(() => ({}).polluted === undefined).catch(() => false);
    if (!up || !clean) wontBoot.push(label + (up ? " (prototype polluted)" : " (no ignition)"));
  }
  step("a malformed ledger costs a field, not the campus", wontBoot.length === 0,
       wontBoot.length ? wontBoot.join(", ")
                       : `${MALFORMED.length} shapes booted, Object.prototype clean`);

  /* ── 2. the order of a seal is not the visitor's to claim ───────── */
  await page.evaluate(() => localStorage.removeItem("pembroke.registrar.journey"));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  if (!await booted()) throw new Error("the page did not come back after clearing the ledger");

  const seals = await page.evaluate(async () => {
    const click = async id => { document.querySelector(`[data-mark="${id}"]`)?.click();
                                await new Promise(r => setTimeout(r, 120)); };
    const read = () => JSON.parse(localStorage.getItem("pembroke.registrar.completed") || "[]");
    localStorage.setItem("pembroke.registrar.completed", "[]");
    await click("AI450");   const reverse  = read().length;   /* the capstone, first */
    await click("MATH120"); const midChain = read().length;   /* prerequisite unsealed */
    const order = ["MATH101","MATH120","MATH201","MATH202","MATH301",
                   "CS101","CS201","CS301","EE210","EE310","AI401","AI450"];
    for (const id of order) await click(id);
    const legal = read().length;
    await click("MATH101");                                   /* pull the foundation out */
    return { reverse, midChain, legal, survivors: read() };
  });

  step("a seal cannot be taken out of order", seals.reverse === 0 && seals.midChain === 0,
       `capstone-first sealed ${seals.reverse}, mid-chain sealed ${seals.midChain} — both must be 0`);
  /* the half worth guarding: refusing everything would pass the check above */
  step("every course is still sealable in a legal order", seals.legal === 12,
       `${seals.legal} of 12 sealed walking the prerequisite order`);
  /* CS 101 is the whole expected survivor set, and the catalogue says
     why: it is the only course besides MATH 101 that assumes nothing,
     and every other course reaches MATH 101 through its prerequisites.
     Named rather than recomputed — nothing publishes COURSES to the
     page, and a check that quietly recomputes from an empty list
     passes for the wrong reason. If the catalogue's shape changes this
     should fail and be re-reasoned; that is what a fixture is for. */
  step("unsealing a foundation takes down what stood on it",
       seals.survivors.length === 1 && seals.survivors[0] === "CS101",
       `ledger holds [${seals.survivors.join(", ")}] — expected [CS101]`);

  /* ── 3. authority moves through patch() or not at all ───────────── */
  const isolated = await page.evaluate(() => {
    window.__journey.reset();
    const before = window.__journey.status();
    const snap = window.__journey.get();
    snap.registration.completedAt = Date.now();
    snap.academics.declaredMajorId = "lib";
    return { before, after: window.__journey.status() };
  });
  step("the journey cannot be moved except through patch()",
       isolated.before === isolated.after,
       `status went ${isolated.before} → ${isolated.after} by assigning to get()`);
} catch (e) {
  step("ledger check completed", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}

if (failures.length){
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall ledger checks passed.");
