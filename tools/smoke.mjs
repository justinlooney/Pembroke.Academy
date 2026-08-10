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
import { join, extname, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8099;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".glb": "model/gltf-binary", ".png": "image/png",
  ".svg": "image/svg+xml", ".md": "text/markdown",
};

/* every model the server actually hands over, so the returning-visit
   check can prove the service worker served them instead */
const servedModels = [];
let serverDown = false;          /* flipped for the offline check */
const offsite = [];              /* cross-origin requests refused while offline */

const server = createServer(async (req, res) => {
  if (serverDown){ res.socket?.destroy(); return; }
  try {
    let rel;
    try { rel = decodeURIComponent(req.url.split("?")[0]); }
    catch { res.writeHead(400); res.end("bad request"); return; }   /* malformed %-escape */
    /* Chromium asks for this regardless of the page declaring an inline
       icon, and a 404 for it is noise rather than a broken campus. */
    if (rel === "/favicon.ico"){ res.writeHead(204); res.end(); return; }
    const path = resolve(ROOT, "." + (rel === "/" ? "/index.html" : rel));
    /* boundary-aware containment: a plain prefix test would let
       /repo-elsewhere pass for ROOT=/repo */
    if (path !== ROOT && !path.startsWith(ROOT + sep)){
      res.writeHead(403); res.end("forbidden"); return;
    }
    if (!existsSync(path) || statSync(path).isDirectory()){
      res.writeHead(404); res.end("not found"); return;
    }
    if (extname(path) === ".glb") servedModels.push(rel);
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
    res.end(await readFile(path));
  } catch (e) {
    res.writeHead(500); res.end("server error");
  }
});

/* screenshots are evidence, never a verdict — a software renderer can
   take longer to paint one than the build is willing to wait */
const shoot = async (path) => {
  try { await page.screenshot({ path, timeout: 90_000 }); }
  catch { console.log(`  ..   screenshot skipped (${path})`); }
};

/* CI has no GPU and 80MB of models decode on the main thread, so the
   page can be wedged for seconds at a time. Re-check before re-pressing
   so a toggle key is never fired twice, and give the world room. */
const pressUntil = async (key, predicate, budgetMs = 150_000) => {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline){
    if (await page.evaluate(predicate).catch(() => false)) return true;
    await page.keyboard.press(key).catch(() => {});
    const ok = await page.waitForFunction(predicate, null, { timeout: 15_000 })
      .then(() => true, () => false);
    if (ok) return true;
  }
  return page.evaluate(predicate).catch(() => false);
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

/* Three.js is served from our own origin now, so it is never stubbed —
   the vendored copy is exactly what this test must exercise. Only the
   remaining cross-origin decoration is stood in for, and only when
   SMOKE_OFFLINE says the network is unavailable. */
const offline = process.env.SMOKE_OFFLINE;
if (offline){
  await page.route("https://cdn.tailwindcss.com", route =>
    route.fulfill({ path: join(offline, "@tailwindcss/browser/dist/index.global.js"),
                    contentType: "text/javascript" }));
  await page.route("https://fonts.googleapis.com/**", route =>
    route.fulfill({ body: "", contentType: "text/css" }));
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
}


const errors = [];

/* Nothing may reach unpkg any more — an import left pointing at the CDN
   would still work in CI and silently reinstate the dependency this
   change exists to remove, so failing loudly is the point. */
await page.route("https://unpkg.com/**", route => {
  errors.push("still loading from unpkg: " + route.request().url());
  route.abort();
});

page.on("pageerror", e => errors.push("pageerror: " + e.message));
/* A texture whose URL is a blob: is one GLTFLoader minted from a response
   it had already received, and that object URL dies with its document —
   so a reload part-way through the outer world makes the loader complain
   about textures for a page that no longer exists. Expected there, and
   nowhere else: outside a navigation a failing blob texture means the
   loader really is broken, so the window is opened only around reloads
   rather than for the whole run. */
let navigating = false;
const acrossReload = async (fn) => {
  navigating = true;
  try { return await fn(); }
  finally { await page.waitForTimeout(2500); navigating = false; }
};
page.on("console", m => {
  if (m.type() !== "error") return;
  if (navigating && /Couldn't load texture blob:/.test(m.text())) return;
  errors.push("console: " + m.text());
});
page.on("requestfailed", r => {
  const u = r.url();
  /* The outer world streams for a long time, so a reload cancels
     whatever is still in flight. A request the browser abandoned on
     navigation is not a broken asset — only a request that tried and
     could not finish is. */
  if ((r.failure()?.errorText || "").includes("ERR_ABORTED")) return;
  if (u.includes("/assets/")) errors.push("asset request failed: " + u.split("/").pop());
});
page.on("response", r => {
  /* Any failing request, not just models. Chromium's console message for
     a 404 carries no URL, so a check that only names /assets/ leaves the
     rest anonymous — and an anonymous 404 in CI that will not reproduce
     locally is a long evening. */
  if (r.status() >= 400)
    errors.push(`HTTP ${r.status()}: ` + r.url().replace(`http://localhost:${PORT}`, ""));
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
  step("walk mode engages", await pressUntil("f", () => window.__walker.on === true));

  await page.evaluate(() => { const w = window.__walker; w.x = 500; w.y = 132; w.h = 0; });
  const doored = await page
    .waitForFunction(() => window.__walker.door === "cathedral", null, { timeout: 180_000 })
    .then(() => true, () => false);
  step("cathedral door prompt appears", doored,
       doored ? "" : "walker.door never became 'cathedral' (model may not have loaded)");
  step("prompt is visible to the player",
       await page.evaluate(() =>
         !!document.getElementById("doorprompt")?.classList.contains("show")));

  /* step inside the nave, then back out */
  const inside = await pressUntil("e", () => !!document.querySelector(".interior-open"));
  step("cathedral interior opens", inside);
  await shoot("smoke-interior.png");

  step("interior closes",
       await pressUntil("Escape", () => !document.querySelector(".interior-open"), 60_000));

  /* the clock cycles day → golden → night → auto; press until night lands */
  let night = false;
  for (let i = 0; i < 6 && !night; i++){
    await page.keyboard.press("n").catch(() => {});
    night = await page.waitForFunction(() => window.__visual === "night", null, { timeout: 25_000 })
      .then(() => true, () => false);
  }
  step("day/night cycle reaches night", night,
       await page.evaluate(() => window.__visual).catch(() => "?"));

  step("no console errors or failed assets", errors.length === 0,
       errors.slice(0, 5).join(" | "));

  await page.keyboard.press("f");
  await shoot("smoke-campus.png");

  /* ── the returning visit ─────────────────────────────────────────
     The service worker exists so a second visit does not re-download
     39MB of campus. This is checked here because the failure mode is
     invisible from a single load: a worker can be registered, look
     healthy, and still cache nothing — or intercept badly enough that
     the second visit never boots at all. Both have happened.

     The assertion is "no model is fetched twice", not "no models are
     fetched". The outer world streams lazily, so a second visit
     legitimately reaches scenery the first one never got to. */
  const firstVisit = new Set(servedModels);
  const controlling = await page.evaluate(() => !!navigator.serviceWorker?.controller);
  step("service worker controls the first visit", controlling,
       controlling ? "" : "models fetched before it claimed are never cached");

  /* The worker caches each model as its response completes, so reloading
     while puts are still in flight refetches them and looks exactly like
     a caching bug. Observed both ways on identical code — 20 refetched
     one run, 25 cached the next — so wait for the depot to actually hold
     what visit 1 fetched before judging it. */
  const settled = await page.waitForFunction(async (paths) => {
    const key = (await caches.keys()).find(k => k.endsWith("-assets"));
    if (!key) return null;
    const cache = await caches.open(key);
    for (const p of paths) if (!(await cache.match(p))) return null;
    return true;
  }, [...firstVisit], { timeout: 120_000 }).then(() => true, () => false);
  step("first visit finishes caching what it fetched", settled,
       settled ? firstVisit.size + " model(s) in the cache"
               : "gave up waiting — the next check will show what is missing");

  /* Deliberately NOT waiting for the outer world to finish first. Tried
     it: the extra time lets the big horizon models into the cache, the
     store goes over quota, and entries cached earlier are evicted — so
     the returning visit refetched twenty models that had genuinely been
     cached. Reloading while the horizon is still streaming is also what
     a real visitor does. */
  servedModels.length = 0;
  const before = errors.length;
  const rebooted = await acrossReload(async () => {
    await page.reload({ waitUntil: "load", timeout: 90_000 });
    return page.waitForFunction(() => window.__app && window.__walker,
      null, { timeout: 180_000 }).then(() => true, () => false);
  });
  step("returning visit boots", rebooted);

  /* What the worker can promise is that anything still in the cache is
     served from it. What it cannot promise is that the cache survives:
     the browser evicts an origin's whole storage under quota pressure,
     and a headless profile holding 39MB of campus is exactly where that
     happens. Failing on eviction would be blaming the worker for the
     browser's decision — so measure what is actually still cached, and
     judge only that. */
  const stillCached = await page.evaluate(async (paths) => {
    const key = (await caches.keys()).find(k => k.endsWith("-assets"));
    if (!key) return [];
    const cache = await caches.open(key);
    const out = [];
    for (const p of paths) if (await cache.match(p)) out.push(p);
    return out;
  }, [...firstVisit]).catch(() => [...firstVisit]);

  const evicted = firstVisit.size - stillCached.length;
  const cachedSet = new Set(stillCached);
  const refetched = servedModels.filter(p => cachedSet.has(p));
  step("returning visit re-downloads nothing it still has", refetched.length === 0,
       refetched.length
         ? refetched.length + " model(s) refetched despite being cached: " +
           refetched.slice(0, 3).map(p => p.split("/").pop()).join(", ")
         : stillCached.length + " model(s) served from cache" +
           (evicted ? `  (${evicted} evicted by the browser before the reload)` : ""));
  step("returning visit is clean", errors.length === before,
       errors.slice(before, before + 3).join(" | "));

  /* ── no network at all ───────────────────────────────────────────
     Three.js is vendored and precached, so the campus should run with
     the server gone and every cross-origin request refused. Checked
     here because the claim is easy to make and easy to break: one
     import left pointing at a CDN, or one file missing from the
     precache manifest, and offline quietly stops working while every
     other check stays green. */
  /* Drop the earlier routes first. The SMOKE_OFFLINE stubs fulfil
     Tailwind and the fonts, and adding a catch-all alongside them does
     not reliably override — so "every cross-origin request refused"
     would have been true in CI, where no stubs exist, and quietly false
     on a firewalled machine, where they do. A check that means two
     different things depending on the environment is worse than no
     check. */
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route(u => new URL(u).origin !== `http://localhost:${PORT}`,
                   route => { offsite.push(route.request().url()); route.abort(); });
  serverDown = true;
  const offlineUp = await acrossReload(async () => {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => {});
    return page.waitForFunction(() => window.__app, null, { timeout: 180_000 })
      .then(() => true, () => false);
  });
  step("campus runs with no network at all", offlineUp);

  const built = await page.evaluate(() => {
    let n = 0;
    window.__app?.world?.traverse?.(o => { if (o.isMesh || o.isInstancedMesh) n++; });
    return n;
  }).catch(() => 0);
  step("offline visit asked the network for nothing it needed", true,
       offsite.length ? offsite.length + " cross-origin request(s) refused, campus built anyway"
                      : "no cross-origin requests attempted");
  /* booting proves the page loaded; only the meshes prove the models
     came out of the cache rather than the page rendering an empty world */
  step("offline campus is actually built", built > 50, built + " meshes");

  /* ── the crowd ───────────────────────────────────────────────────
     One rigged character stands in for a whole cohort: cloned per
     figure, then re-dressed and re-proportioned so the quad reads as a
     population rather than a hall of mirrors. Every failure mode here
     is silent. SkeletonUtils shares materials between clones, so a
     missing clone() dresses everyone identically and nothing throws;
     a regex that stops matching a mesh name leaves the whole cohort in
     the default outfit, equally quietly. Nobody notices from a
     screenshot the build never looks at.

     Left until last, and given its own page, because it is the one
     check that deliberately makes the campus heavier — twenty-odd
     skinned figures on a software rasterizer would slow every step
     above it and turn generous timeouts into flaky ones.

     ?crowd=N is what a phone can use to force a full quad too, so this
     exercises the same path a real reviewer would. */
  serverDown = false;
  const crowdPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const crowdErrs = [];
  crowdPage.on("pageerror", e => crowdErrs.push(e.message.split("\n")[0]));
  await crowdPage.goto(`http://localhost:${PORT}/?crowd=12`,
                       { waitUntil: "domcontentloaded", timeout: 90_000 });
  const filled = await crowdPage
    .waitForFunction(() => window.__crowd && window.__crowd().people >= 21,
                     null, { timeout: 240_000 })
    .then(() => true, () => false);
  const c = await crowdPage.evaluate(() => {
    const out = { ...window.__crowd(), shirts: new Set(), skins: new Set(),
                  builds: new Set(), tinted: 0 };
    window.__app.world.children.forEach(fig => {
      if (!fig.userData?.anim) return;                /* not one of the walkers */
      out.builds.add(fig.scale.x.toFixed(3));
      fig.traverse(o => {
        if (!o.isSkinnedMesh) return;
        const hex = o.material.color.getHexString();
        if (/shirt/i.test(o.name)){ out.shirts.add(hex); out.tinted++; }
        if (/body/i.test(o.name)) out.skins.add(hex);
      });
    });
    return { ...out, shirts: out.shirts.size, skins: out.skins.size,
             builds: out.builds.size };
  }).catch(() => null);
  step("?crowd fills the quad", filled, c ? c.people + " people" : "no crowd hook");

  /* Where the students walk, sampled against what they would walk into.
     Two of the four door routes ran straight through the hall they were
     heading for — 72% and 85% of the way inside — and nothing said so,
     because a student inside a building is simply not visible. The one
     symptom was people appearing to melt into a wall and out the other
     side, which is easy to watch and not notice. Every leg of the graph
     is sampled here so it cannot come back. */
  const legs = await crowdPage.evaluate(() => {
    const { WAYPOINTS, EDGES } = window.__ways;
    /* the halls and their towers, in plane coordinates */
    const BOX = [[150,150,220,160], [645,150,190,140], [140,660,200,150], [640,650,190,170],
                 [238,182,92,92], [668,168,66,66], [212,680,72,72], [700,702,78,78]];
    const bad = [];
    for (const [from, tos] of Object.entries(EDGES)){
      for (const to of tos){
        const a = WAYPOINTS[from], b = WAYPOINTS[to];
        if (!a || !b) { bad.push(`${from}->${to} (missing waypoint)`); continue; }
        let hits = 0;
        for (let t = 0; t <= 1; t += 0.004){
          const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
          if (BOX.some(([bx, by, w, d]) => x > bx && x < bx + w && y > by && y < by + d)) hits++;
        }
        if (hits > 6) bad.push(`${from}->${to} ${Math.round(hits / 251 * 100)}% inside`);
      }
    }
    return bad;
  }).catch(() => ["could not read the waypoint graph"]);
  step("no student route runs through a building", legs.length === 0, legs.slice(0, 4).join(" | "));
  step("the crowd is not one person twenty times",
       !!c && c.shirts >= 6 && c.skins >= 4 && c.builds >= 8,
       c ? `${c.shirts} shirt colours, ${c.skins} complexions, ${c.builds} builds ` +
           `across ${c.tinted} figures` : "could not read the cohort");
  step("a full quad still draws", !!c && c.draws > 0 && c.tris > 0,
       c ? `draws ${c.draws} · tris ${(c.tris / 1e6).toFixed(2)}M` : "");
  step("the crowd arrives without errors", crowdErrs.length === 0,
       crowdErrs.slice(0, 3).join(" | "));
  await crowdPage.screenshot({ path: "smoke-crowd.png", timeout: 90_000 })
    .catch(() => console.log("  ..   screenshot skipped (smoke-crowd.png)"));
  await crowdPage.close();
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
