#!/usr/bin/env node
/**
 * Pembroke Academy — smoke test.
 *
 * Serves the site and drives it in headless Chromium the way a visitor
 * would: ignite the engine, read the ledger, walk to the cathedral,
 * step inside, come back out, and run the clock from day to night.
 * Any console error, failed asset, or broken step fails the build.
 *
 * Runs on a software renderer in CI, so every wait is generous and the
 * outer world (horizon landmarks, stadiums) is deliberately NOT required
 * — it streams in lazily long after the campus is usable.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8099;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".glb": "model/gltf-binary", ".png": "image/png",
  ".svg": "image/svg+xml", ".md": "text/markdown",
};

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const path = join(ROOT, rel === "/" ? "index.html" : rel);
  if (!path.startsWith(ROOT) || !existsSync(path) || statSync(path).isDirectory()){
    res.writeHead(404); res.end("not found"); return;
  }
  res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
  res.end(await readFile(path));
});

/* screenshots are evidence, never a verdict — a software renderer can
   take longer to paint one than the build is willing to wait */
const shoot = async (path) => {
  try { await page.screenshot({ path, timeout: 90_000 }); }
  catch { console.log(`  ..   screenshot skipped (${path})`); }
};

const failures = [];
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures.push(name);
};

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

/* CI reaches the real CDNs, which is part of what we want to verify.
   Set SMOKE_OFFLINE=/path/to/node_modules to run behind a firewall. */
const offline = process.env.SMOKE_OFFLINE;
if (offline){
  await page.route("https://unpkg.com/**", route => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@[^/]+\//, "");
    const file = join(offline, "three", rel);
    if (existsSync(file)) route.fulfill({ path: file, contentType: "text/javascript" });
    else route.fulfill({ status: 404, body: "not vendored: " + rel });
  });
  await page.route("https://cdn.tailwindcss.com", route =>
    route.fulfill({ path: join(offline, "@tailwindcss/browser/dist/index.global.js"),
                    contentType: "text/javascript" }));
  await page.route("https://fonts.googleapis.com/**", route =>
    route.fulfill({ body: "", contentType: "text/css" }));
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
}

const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("requestfailed", r => {
  const u = r.url();
  if (u.includes("/assets/")) errors.push("asset request failed: " + u.split("/").pop());
});
page.on("response", r => {
  if (r.url().includes("/assets/") && r.status() >= 400)
    errors.push(`asset ${r.status()}: ` + r.url().split("/").pop());
});

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 90_000 });

  /* the engine publishes its hooks once ignition completes */
  await page.waitForFunction(() => window.__app && window.__walker, null, { timeout: 120_000 });
  step("engine ignites", true);

  /* the workspace renders the full catalogue and a live ledger */
  const shelf = await page.evaluate(() => ({
    courses: document.querySelectorAll("[data-course]").length,
    total: (document.getElementById("gp-count") || {}).textContent || "",
  }));
  step("all twelve courses render", shelf.courses === 12, shelf.courses + " cards");
  step("registrar ledger reports", /\d/.test(shelf.total), JSON.stringify(shelf.total));

  /* walk mode: stand at the cathedral doors and expect the prompt */
  await page.keyboard.press("f");
  await page.waitForFunction(() => window.__walker.on === true, null, { timeout: 15_000 });
  step("walk mode engages", true);

  await page.evaluate(() => { const w = window.__walker; w.x = 500; w.y = 132; w.h = 0; });
  const doored = await page
    .waitForFunction(() => window.__walker.door === "cathedral", null, { timeout: 150_000 })
    .then(() => true, () => false);
  step("cathedral door prompt appears", doored,
       doored ? "" : "walker.door never became 'cathedral' (model may not have loaded)");
  step("prompt is visible to the player",
       await page.evaluate(() => document.getElementById("doorprompt").classList.contains("show")));

  /* step inside the nave, then back out */
  await page.keyboard.press("e");
  const inside = await page
    .waitForFunction(() => !!document.querySelector(".interior-open"), null, { timeout: 60_000 })
    .then(() => true, () => false);
  step("cathedral interior opens", inside);
  await shoot("smoke-interior.png");

  await page.keyboard.press("Escape");
  step("interior closes",
       await page.waitForFunction(() => !document.querySelector(".interior-open"), null, { timeout: 20_000 })
         .then(() => true, () => false));

  /* the clock: day → golden → night, each a real visual state */
  const seen = [];
  for (const _ of [0, 1, 2]){
    await page.keyboard.press("n");
    await page.waitForTimeout(2500);
    seen.push(await page.evaluate(() => window.__visual));
  }
  step("day/night cycle reaches night", seen.includes("night"), seen.join(" → "));

  step("no console errors or failed assets", errors.length === 0,
       errors.slice(0, 5).join(" | "));

  await page.keyboard.press("f");
  await shoot("smoke-campus.png");
} catch (e) {
  step("smoke run completed", false, e.message.split("\n")[0]);
  await shoot("smoke-failure.png");
} finally {
  await browser.close();
  server.close();
}

if (failures.length){
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall checks passed.");
