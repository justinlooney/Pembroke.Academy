#!/usr/bin/env node
/**
 * Pembroke Academy — the first twenty seconds.
 *
 *     node tools/check-opening.mjs
 *
 * A juror gives a site one to three minutes, and every other probe in
 * this repository is blind to what happens in the first of them —
 * because Playwright sets navigator.webdriver, the arrival reads that
 * as "no theatrics", and the opening never runs. So this one lies
 * about webdriver on purpose. It is the only way to test a cinematic
 * that only first-time visitors ever see.
 *
 * What it asserts is ORDER and POSE, never wall-clock. On a machine
 * with no GPU the descent runs at one to three frames a second and
 * every duration stretches; the sequence does not.
 */
import { chromium, devices } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8092;
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

/* The timeline is recorded INSIDE the page, so nothing here depends on
   how long a screenshot or a round trip takes on a software rasterizer. */
const RECORD = () => {
  window.__tl = [];
  const t0 = performance.now();
  const iv = setInterval(() => {
    const q = document.getElementById("quest");
    window.__tl.push({
      t: Math.round(performance.now() - t0),
      arrival: !!document.getElementById("arrival"),
      opening: document.body.classList.contains("opening"),
      walk: document.body.classList.contains("walkmode"),
      day: document.body.classList.contains("day"),
      chrome: q ? +getComputedStyle(q).opacity : null,
      camY: window.__app ? Math.round(window.__app.camera.position.y) : null,
      camZ: window.__app ? Math.round(window.__app.camera.position.z) : null,
      yaw:  window.__app ? +window.__app.camera.rotation.y.toFixed(3) : null,
    });
  }, 200);
  setTimeout(() => clearInterval(iv), 120_000);
};

const visit = async (opts = {}) => {
  const ctx = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await ctx.newPage();
  /* the arrival treats webdriver as "somebody is measuring, skip the
     theatrics", which is right — and makes the theatrics untestable */
  await page.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
  if (opts.before) await page.addInitScript(opts.before);
  await page.addInitScript(RECORD);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  return { ctx, page };
};
/* Wait on the PAGE's own recording, not on a duration. The budget is
   generous because a software rasterizer runs the descent at one to
   three frames a second; PEMBROKE_WAIT_MS shortens it so a run that is
   MEANT to fail — checking this probe against a build without the
   opening — fails in a minute instead of holding every wait in turn. */
const WAIT = +(process.env.PEMBROKE_WAIT_MS || 180_000);
const until = (page, pred, ms = WAIT) =>
  page.waitForFunction(pred, null, { timeout: ms }).then(() => true, () => false);

try {
  /* ── 1. a first visit ends standing on the quad ─────────────────── */
  const first = await visit();
  const landed = await until(first.page, () => document.body.classList.contains("walkmode"));
  step("a first visit ends on the quad, not above it", landed,
       landed ? "body.walkmode" : "never entered walk mode — the arrival still lands in the aerial");

  const settled = await until(first.page, () =>
    !document.body.classList.contains("opening") && window.__app?.camera.position.y < 60);
  const tl = await first.page.evaluate(() => window.__tl);
  const at = (pred) => tl.findIndex(pred);
  const iOpen = at(r => r.opening), iDark = at(r => r.chrome === 0),
        iWalk = at(r => r.walk),   iBack = at(r => r.opening === false && r.walk);

  step("the chrome is gone before the campus is",
       iOpen >= 0 && iDark >= 0 && iDark < iWalk,
       iOpen < 0 ? "body.opening never applied"
         : `opening at ${tl[iOpen].t}ms · chrome dark at ${tl[iDark]?.t}ms · standing at ${tl[iWalk]?.t}ms`);

  /* An absent opening makes this slice empty and .every vacuously
     true, so the reason has to be reported separately from the verdict
     — the first draft printed "daylight held" while failing. */
  const golden = iOpen >= 0 && iWalk > iOpen && tl.slice(iOpen, iWalk + 1).every(r => r.day);
  const dark = iOpen >= 0 ? tl.slice(iOpen, iWalk + 1).filter(r => !r.day).length : null;
  step("and the light is golden for the whole descent", golden,
       iOpen < 0 ? "there was no descent to light — body.opening never applied"
       : iWalk <= iOpen ? "it never reached the ground"
       : dark ? `${dark} frame(s) went dark mid-descent — the opening is showing their clock, not the postcard`
       : "daylight held from the first frame of the flight to the ground");

  const pose = settled ? tl[tl.length - 1] : null;
  step("it lands at eye height with the cathedral on axis",
       !!pose && pose.camY < 60 && Math.abs(pose.yaw) < 0.05,
       pose ? `camera y=${pose.camY} z=${pose.camZ} yaw=${pose.yaw} — yaw 0 looks down −Z, which is the cathedral`
            : "the camera never settled");

  step("and the chrome comes back afterwards", iBack > iWalk,
       iBack > iWalk ? `revealed at ${tl[iBack].t}ms` : "the interface never returned");

  const sky = await first.page.evaluate(() => ({
    mode: localStorage.getItem("pembroke.registrar.mode"),
    day: document.body.classList.contains("day"),
  }));
  step("the sky handed back is the visitor's, not the postcard's",
       sky.mode === null,
       `stored mode ${JSON.stringify(sky.mode)} — the opening must not write a preference the visitor never chose`);
  await first.ctx.close();

  /* ── 2. nobody is trapped in it ─────────────────────────────────── */
  const eager = await visit();
  await until(eager.page, () => document.body.classList.contains("opening"));
  await eager.page.keyboard.press("Space");
  const tookOver = await until(eager.page, () =>
    document.body.classList.contains("walkmode") && !document.body.classList.contains("opening"));
  step("one keypress during the flight takes the controls immediately", tookOver,
       tookOver ? "landed and revealed without waiting out the beat"
                : "the flight held on through a keypress — that is a trapped cinematic");
  await eager.ctx.close();

  /* ── 3. a returning visitor is not shown the front door twice ──── */
  const back = await visit({ before: () => {
    localStorage.setItem("pembroke.registrar.journey", JSON.stringify({
      onboarding: { campusVisit: { status: "done", steps: {}, completedAt: 1, hidden: false } } }));
  } });
  const ready = await until(back.page, () => window.__app && !document.getElementById("arrival"));
  const returning = await back.page.evaluate(() => ({
    opening: document.body.classList.contains("opening"),
    walk: document.body.classList.contains("walkmode"),
  }));
  step("a returning visitor gets the campus they left, not the opening",
       ready && !returning.opening && !returning.walk,
       `opening=${returning.opening} walk=${returning.walk}`);
  await back.ctx.close();
} catch (e) {
  step("opening check completed", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}

if (failures.length){
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall opening checks passed.");
