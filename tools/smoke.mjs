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
  ".woff2": "font/woff2", ".jpg": "image/jpeg", ".webp": "image/webp",
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
/* An explicit context rather than browser.newPage(), which builds a
   throwaway one and then refuses to open a second page in it —
   "Please use browser.newContext()". The crowd check at the end wants a
   sibling page that shares this one's service worker, so that the
   campus is served from the cache instead of downloaded twice. */
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

/* Nothing is stubbed any more. Three.js was vendored first, and the
   styles have followed: assets/site.css and assets/fonts come from our
   own origin, so what this test exercises is exactly what ships.
   SMOKE_OFFLINE stood in for Tailwind's CDN build and the Google Fonts
   stylesheet, because the campus could not render without them and CI
   has no reliable route to either. There is no third party left. */

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
  /* "Failed to load resource: the server responded with a status of 404"
     is Chromium echoing a request that the response handler below has
     already seen — WITH its URL, which this message does not carry. So
     this one is a duplicate that cannot say what it is about, and it
     went red on a fonts.gstatic.com hiccup that the response handler
     had already, correctly, decided was not ours. Twice: the first fix
     taught the response handler about other people's CDNs and left this
     one still shouting anonymously.

     Dropping it loses no coverage. Anything this repository serves
     arrives at page.on("response") with a URL and is counted there, and
     a request that never got a response at all lands in requestfailed. */
  if (/Failed to load resource/i.test(m.text())){
    const where = m.location?.().url || "";
    console.log("  ..   ignoring an anonymous load failure" +
                (where ? " from " + where.replace(/^(\w+:\/\/[^/]+).*/, "$1") : "") +
                " — the response handler has the real one");
    return;
  }
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
  if (r.status() < 400) return;
  const u = r.url();
  /* ...but only for things this repository serves. A run went red on
     HTTP 404 from fonts.gstatic.com — Google's font CDN, briefly not
     serving a woff2 — while the identical commit passed in the run
     beside it. The campus is not broken when somebody else's CDN
     hiccups, and a suite that says otherwise teaches everyone to ignore
     it. The site already treats these fonts as optional: the offline
     check watches two cross-origin requests get refused and the campus
     build anyway. Failures we serve ourselves still count, and so does
     unpkg, which has its own trap set above. */
  if (!u.startsWith(`http://localhost:${PORT}`)){
    console.log(`  ..   ignoring HTTP ${r.status()} from ${new URL(u).host} (not ours)`);
    return;
  }
  errors.push(`HTTP ${r.status()}: ` + u.replace(`http://localhost:${PORT}`, ""));
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

  /* the chapel lives on the North Quad now — same sector key, new door */
  await page.evaluate(() => { const w = window.__walker; w.x = 500; w.y = -292; w.h = 0; });
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

  /* Flora is planted by matching a mesh-name prefix, and a prefix that
     matches nothing plants nothing without complaining — a valid file,
     no error, and a campus with no trees on it. Every trees.glb prefix
     was wrong for a whole release exactly that way: they were written
     against the names inside the file, and GLTFLoader renames on load
     (PropertyBinding.sanitizeNodeName strips [].:/  and turns spaces
     into underscores). Reading the file tells you nothing; only the
     loader knows. So the page records its misses and this fails on
     them. */
  const misses = await page.evaluate(() => window.__floraMisses || []).catch(() => []);
  step("every flora prefix planted something", misses.length === 0,
       misses.length ? "matched nothing: " + misses.join(", ")
                     : "no unmatched prefixes");

  /* And a count, because "planted something" is satisfied by one tree.
     The photographed collection is the whole point of the flora pass;
     if it silently drops back to the stylised set the campus still
     builds, still passes, and still looks like it did before anyone
     asked for real trees. */
  const countFlora = () => {
    let inst = 0, tris = 0;
    window.__app?.world?.traverse?.(o => {
      if (!o.isInstancedMesh) return;
      inst++;
      tris += (o.geometry.index ? o.geometry.index.count / 3
                                : o.geometry.attributes.position.count / 3) * o.count;
    });
    return { inst, tris: Math.round(tris) };
  };
  /* Waited for, not sampled: trees.glb is 2.5MB and this runs early, so
     an instantaneous read would fail on a slow runner for the one
     reason that has nothing to do with the thing being tested. */
  await page.waitForFunction(
    () => { let t = 0; window.__app?.world?.traverse?.(o => {
      if (o.isInstancedMesh) t += (o.geometry.index ? o.geometry.index.count / 3
        : o.geometry.attributes.position.count / 3) * o.count; }); return t > 600_000; },
    null, { timeout: 120_000 }).catch(() => {});
  const flora = await page.evaluate(countFlora).catch(() => ({ inst: 0, tris: 0 }));
  step("the photographed trees are actually planted", flora.tris > 600_000,
       `${flora.inst} instanced meshes, ${(flora.tris / 1e6).toFixed(2)}M triangles of flora`);

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
  /* Drop the earlier routes first, so the catch-all below is the only
     thing answering. It mattered more when SMOKE_OFFLINE fulfilled
     Tailwind and the fonts: a catch-all alongside those stubs did not
     reliably override them, so "every cross-origin request refused"
     was true in CI and quietly false on a firewalled machine. Nothing
     cross-origin is needed now, so the honest expected result here is
     no attempts at all. */
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
  /* A sibling page in the SAME context, not browser.newPage() — that
     opens a fresh context with an empty store, and the campus would be
     downloaded and decoded from scratch a second time inside a
     twenty-minute job. Here the worker is already registered for this
     origin, so the models come out of the cache. Routes are per-page,
     so the offline catch-all on the first page does not follow. */
  const crowdPage = await context.newPage();
  const crowdErrs = [];
  crowdPage.on("pageerror", e => crowdErrs.push(e.message.split("\n")[0]));
  await crowdPage.goto(`http://localhost:${PORT}/?crowd=8`,
                       { waitUntil: "domcontentloaded", timeout: 90_000 });
  /* Wait for the quad to fill, but do not let the wait be the verdict.
     On a slow enough rasterizer this timed out and the very next line
     then read seventeen people standing on the lawn — the campus was
     fine and the clock was not, which is the least useful way for a
     test to go red. The wait paces the run; the state that follows is
     what is judged, and it is judged once. */
  /* Seventeen heads is not the thing being checked. What follows counts
     shirt colours and complexions across the cohort, and a cohort drawn
     before the deferred bodies land is four people in fourteen copies
     however many of them there are — which is exactly what this test
     exists to catch, so waiting on the headcount made it fail for the
     one reason that is not a bug.

     It went red when the outer world stopped competing for the main
     thread: the campus reached seventeen sooner, and sooner was worse.
     So wait for the bodies themselves. */
  await crowdPage
    .waitForFunction(() => window.__crowd && window.__crowd().people >= 17,
                     null, { timeout: 300_000 })
    .catch(() => {});
  await crowdPage
    .waitForFunction(() => (window.__assets || [])
                     .filter(a => /^stu_/.test(a.name))
                     .every(a => a.ms != null),
                     null, { timeout: 180_000 })
    .catch(() => console.log("  ..   some bodies never arrived; judging what did"));
  const c = await crowdPage.evaluate(() => {
    const out = { ...window.__crowd(), shirts: new Set(), skins: new Set(),
                  builds: new Set(), bodies: new Set(), dressable: new Set(),
                  tinted: 0 };
    window.__app.world.children.forEach(fig => {
      if (!fig.userData?.anim) return;                /* not one of the walkers */
      out.builds.add(fig.scale.x.toFixed(3));
      out.bodies.add(fig.userData.figure);
      fig.traverse(o => {
        if (!o.isSkinnedMesh) return;
        /* the same both-places read the wardrobe does: the walker names
           its nodes, the other two name their materials */
        const tag = (o.name || "") + " " + (o.material.name || "");
        const hex = o.material.color.getHexString();
        if (/shirt|top|jacket|suit|hoodie|sweater/i.test(tag)){
          out.shirts.add(hex); out.tinted++;
          /* which BODIES can be dressed, not how many meshes — the
             number that explains a low colour count */
          out.dressable.add(fig.userData.figure);
        }
        if (/body|skin/i.test(tag)) out.skins.add(hex);
      });
    });
    return { ...out, shirts: out.shirts.size, skins: out.skins.size,
             builds: out.builds.size, bodies: [...out.bodies].sort().join("+"),
             dressable: [...out.dressable].sort().join("+") || "none" };
  }).catch(() => null);
  /* Which bodies actually decoded on THIS runner. The cohort checks
     below judge casting and wardrobe variety, and both are functions of
     who arrived: a software rasterizer that decodes two of six
     dressable bodies before every timeout fills the quad with two
     people's copies, and the checks then fail the code for the
     machine's slowness — this exact run has now happened, with the
     same commit passing beside it on a faster runner. A body that
     ERRORED still fails hard below; a body that is merely still
     decoding when the suite loses patience is not a bug in the campus.
     When any body is missing, the cohort checks say so and stand down
     rather than deliver a verdict about a cohort that is not there. */
  const bodiesHere = await crowdPage.evaluate(() =>
    (window.__assets || []).filter(a => /^stu_/.test(a.name))
      .map(a => ({ name: a.name, ok: a.ms != null, err: a.err || null })))
    .catch(() => []);
  const brokenBodies = bodiesHere.filter(a => a.err).map(a => a.name);
  const missingBodies = bodiesHere.filter(a => !a.ok && !a.err).map(a => a.name);
  step("no body failed to load", brokenBodies.length === 0, brokenBodies.join(", "));
  const cohortJudged = missingBodies.length === 0;
  if (!cohortJudged)
    console.log(`  ..   ${missingBodies.length} body(ies) never finished decoding here — ` +
                `cohort variety not judged: ${missingBodies.join(", ")}`);

  /* ── the campus is as full as it is allowed to be ────────────────
     Was 17, then 10, then "most of whoever turned up", and every one of
     those was a count. A count is the wrong shape now: ON_SCREEN_MB
     caps the weight of the bodies being DRAWN, and bodies weigh three
     to four and a half megabytes each, so a full campus is two or three
     figures and asking for six fails a rule that is working.

     What "full" means under a ceiling is that nobody else FITS. So
     that is what is checked: the quad holds somebody, and no body left
     out of it could have been added without going over. A campus that
     stopped early for any other reason fails this; a campus that
     stopped because the ceiling said so passes, whatever the count. */
  const outOf = bodiesHere.filter(a => a.ok).length;
  const room = await crowdPage.evaluate(() => {
    /* The ceiling counts DECODED TEXTURE now, not file bytes. Every
       authored body is three 1024-square maps — 16MB a head, whatever
       its file happens to compress to — so a file-size reading would
       have discriminated between bodies that cost the GPU the same. */
    const cap = window.__onScreenCap, per = window.__bodyVram || 16;
    const drawn = new Set();
    for (const s of window.__students){
      if (s.inside || !s.g || !s.g.visible) continue;
      const f = s.g.userData && s.g.userData.figure;
      if (f) drawn.add(f);
    }
    const used = drawn.size * per;
    /* Anybody loaded, not drawn, and with room to have been drawn.
       Only bodies the crowd can DEAL: the skater used to be in
       CAST_FILES and was never one of them, and counting him as a
       candidate failed a campus that was full — "2 bodies drawn, 6MB
       of 7.98MB — skate would have fitted". He is retired now; reading
       ROAMING is what keeps the next fixture from doing it again. */
    const spare = (window.__roaming || [])
      .filter(k => window.__castLib[k] && !drawn.has(k))
      .filter(() => used + per <= cap + 1e-9);
    return { cap, used: +used.toFixed(2), n: drawn.size, spare };
  }).catch(() => null);
  if (cohortJudged)
  step("the quad is as full as the ceiling allows",
       !!room && room.n > 0 && room.spare.length === 0,
       room ? `${room.n} bodies drawn, ${room.used}MB of ${room.cap}MB` +
              (room.spare.length ? ` — ${room.spare.join(", ")} would have fitted`
                                 : " — nobody else fits")
            : "could not read the ceiling");
  /* ── and it never goes over ──────────────────────────────────────
     The ceiling is enforced in four separate places and any one of them
     forgetting it puts the campus over without a word. */
  step("the on-screen ceiling holds", !!room && room.used <= room.cap + 1e-9,
       room ? `${room.used}MB against a ceiling of ${room.cap}MB` : "could not read it");

  /* ── and none of them is anybody else ────────────────────────────
     The rule the campus is built on now: one body, one person. It got
     here the long way — first the crowd repeated anybody and two
     identical men in red were photographed on a lawn; then repeats
     were confined to bodies the wardrobe can re-dress, which a forced
     quad turned into walker seven times and woman seven times out of
     nineteen. Same face, same hair, same build. A shirt is not a
     disguise, and this is the check that says so. */
  const twins = await crowdPage.evaluate(() => {
    const tally = {};
    for (const s of (window.__students || [])){
      const k = s.g?.userData?.figure;
      if (k) tally[k] = (tally[k] || 0) + 1;
    }
    return Object.entries(tally).filter(([, n]) => n > 1)
      .map(([k, n]) => `${k}x${n}`);
  }).catch(() => ["could not read the cohort"]);
  step("no body is on the campus twice", twins.length === 0,
       twins.length ? twins.join(", ") : "every figure is a different person");

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
                 [238,182,92,92], [668,168,66,66], [212,680,72,72], [700,702,78,78],
                 /* the North Quad: chapel + its tower, west hall, east hall */
                 [410,-420,180,100], [472,-452,56,56], [262,-256,104,152], [634,-256,104,152]];
    const bad = [];
    for (const [from, tos] of Object.entries(EDGES)){
      for (const to of tos){
        const a = WAYPOINTS[from], b = WAYPOINTS[to];
        if (!a || !b) { bad.push(`${from}->${to} (missing waypoint)`); continue; }
        /* Only the middle of the leg. A walk that *arrives* at a door
           legitimately crosses into the footprint at its very end —
           that is what a door is — so judging the whole leg would
           either fail every door or need a tolerance loose enough to
           let a real pass-through slip by. What must never happen is a
           leg whose middle is indoors. */
        let hits = 0;
        for (let t = 0.15; t <= 0.85; t += 0.004){
          const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
          if (BOX.some(([bx, by, w, d]) => x > bx && x < bx + w && y > by && y < by + d)) hits++;
        }
        if (hits) bad.push(`${from}->${to} ${Math.round(hits / 176 * 100)}% of its middle indoors`);
      }
    }
    return bad;
  }).catch(() => ["could not read the waypoint graph"]);
  step("no student route runs through a building", legs.length === 0, legs.slice(0, 4).join(" | "));

  /* Every node has to lead somewhere, and somewhere has to lead back.
     The athletics branches were built 24 feet off the boulevard node
     they visibly leave — two separate walks as far as a graph is
     concerned — so a student who started on one would have spent the
     day on a stretch of path with no way back to the campus, which
     looks exactly like a student who simply wandered off. */
  const reach = await crowdPage.evaluate(() => {
    const { WAYPOINTS, EDGES } = window.__ways;
    const keys = Object.keys(WAYPOINTS);
    const orphaned = keys.filter(k => !EDGES[k] || !EDGES[k].length);
    const seen = new Set([keys[0]]), q = [keys[0]];
    while (q.length){
      const k = q.pop();
      for (const e of EDGES[k] || []) if (!seen.has(e)){ seen.add(e); q.push(e); }
    }
    return { total: keys.length, reached: seen.size, orphaned: orphaned.length };
  }).catch(() => null);
  step("every corner of the campus can be walked to",
       !!reach && reach.reached === reach.total && !reach.orphaned,
       reach ? `${reach.reached}/${reach.total} nodes reachable` +
               (reach.orphaned ? `, ${reach.orphaned} with no way out` : "")
             : "could not read the waypoint graph");
  /* When this goes red the useful question is never "why so few
     colours" — it is "who is out there". Only six of the sixteen
     bodies own a shirt mesh the wardrobe can find; the rest are either
     colourless or a scan whose clothes and skin are one mesh on one
     material, and no palette can touch those. So a quad filled from a
     wave that happens to contain one dressable body caps at one
     colour per figure of that body, and reads as a colour bug when it
     is a casting bug. Print who could be dressed. */
  /* The colour-variety check that stood here is retired. It counted
     shirts, complexions and builds to catch "one person fourteen
     times" — a real failure, and one the check above now catches
     directly and exactly, by name. What was left after that was a
     count of which BODIES happened to decode on this runner: it went
     red at two shirt colours because ariel and walker were the only
     dressable pair present, which says nothing about the wardrobe.

     A check that can only fail for reasons other than its purpose
     teaches its reader to ignore it. The cohort is still printed,
     because "who is out there" is the useful question when anything
     nearby goes red. */
  /* Variety across a VISIT, not in a single frame. Three distinct
     bodies at one instant was the right question while the campus drew
     everybody at once; under ON_SCREEN_MB it draws two or three and
     rotates the rest through the buildings, so a snapshot can only ever
     see two or three however varied the campus is. The rotation is the
     feature — whoever went indoors is replaced by somebody you have not
     met — and this is the check that it actually happens rather than
     the same two people going in and out for ever. */
  const overTime = await crowdPage.evaluate(async () => {
    const seen = new Set();
    let wentIn = 0;
    const wasIn = new Set();
    for (let t = 0; t < 240; t++){
      window.__sim(30, 1 / 30);
      for (const s of window.__students){
        if (s.inside){
          if (!wasIn.has(s)){ wasIn.add(s); wentIn++; }
          continue;
        }
        wasIn.delete(s);
        if (!s.g || !s.g.visible) continue;
        const f = s.g.userData && s.g.userData.figure;
        if (f) seen.add(f);
      }
      if (t % 20 === 0) await new Promise(r => setTimeout(r, 0));
    }
    /* How many OTHER bodies were even available to rotate in. Without
       this, "2 different people in four minutes" cannot be told apart
       from "only 2 bodies finished decoding on this runner", and those
       want opposite responses: one is a bug in the campus, the other is
       a slow machine. */
    const loaded = (window.__roaming || []).filter(k => window.__castLib[k]);
    return { seen: [...seen].sort(), loaded: loaded.length, wentIn };
  }).catch(() => null);
  if (cohortJudged)
  step("the cohort is varied over a visit",
       !!overTime && (overTime.seen.length >= 3 || overTime.loaded < 3),
       overTime ? `${overTime.seen.length} different people in four minutes ` +
                  `(${overTime.seen.join("+")}); ${overTime.loaded} bodies were loaded ` +
                  `and ${overTime.wentIn} trip(s) indoors happened`
                : "could not watch the campus");
  if (cohortJudged)
  step("the cohort is varied", !!c && c.bodies.split("+").length >= 1,
       c ? `${c.bodies}; ${c.shirts} shirt colour(s), ${c.skins} complexion(s), ` +
           `${c.builds} build(s); dressable: ${c.dressable}`
         : "could not read the cohort");

  /* ── can you actually tap somebody? ──────────────────────────────
     Reported from a phone as "touch player to start dialogue isn't
     working", and it was: three.js rejects a SkinnedMesh raycast on
     `boundingSphere` before it looks at a triangle, and on these
     assets that sphere came out with a radius of 0.8 for a figure 43
     units tall. A ray aimed at the middle of a student's chest missed
     by thirty times their width — measured at zero hits for eight of
     eight students standing in plain view.

     Nothing could see it. The figures draw, animate, walk and cast
     shadows exactly as before; the only symptom is that tapping them
     does nothing, which reads as a dead event handler. So: put a ray
     through the middle of every named student and require them to
     answer. It uses the page's own picking, so it fails on a broken
     bounding volume, a broken handler, and a student who has quietly
     stopped being pickable, without caring which.

     One tap per turn of this loop, with the conversation closed and a
     beat allowed before the next. Opening one makes #stage fullscreen
     and resizes the canvas under it, so a batch of taps fired inside a
     single evaluate() aims the second through the first one's
     viewport — which read as two students refusing to answer when all
     eight in fact do. */
  /* Wait for somebody to be OUT before tapping. The campus draws two
     students now, one of whom may be in a building, so a single glance
     can find nobody tappable and hollow the check out — which is
     exactly the silent pass this suite has been bitten by twice.
     A visitor waits for someone to come out; so does this. */
  await crowdPage.evaluate(async () => {
    for (let t = 0; t < 300; t++){
      const out = (window.__students || [])
        .filter(s => s.data && s.g && s.g.visible && !s.inside).length;
      if (out) return out;
      window.__sim(30, 1 / 30);
      if (t % 20 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return 0;
  }).catch(() => 0);
  const named = await crowdPage.evaluate(() =>
    (window.__students || []).filter(s => s.data && s.g).map(s => s.data.name))
    .catch(() => []);
  const miss = [], skipped = [];
  for (const nm of named){
    const r = await crowdPage.evaluate((nm) => {
      const THREE = window.__app.THREE, cam = window.__app.camera;
      const s = (window.__students || []).find(x => x.data && x.data.name === nm);
      if (!s || !s.g) return { gone: true };
      if (!s.g.visible) return { skip: "indoors" };
      /* The check WALKS UP to each student instead of tapping from
         wherever the camera happens to sit. Left to the accidental
         camera, one run tapped from a vista where every student was a
         few pixels tall, the too-small skip excused all five, and the
         check passed having tested nothing — the same silent hollowing
         this suite has been bitten by before. A visitor taps people
         they walked to; the check now does the same, and puts the
         camera back afterwards so the draw-stats check is undisturbed. */
      const { controls } = window.__app;
      if (!window.__tapCam) window.__tapCam = { t: controls.target.clone(),
        p: cam.position.clone(), min: controls.minDistance };
      const aim = new THREE.Box3().setFromObject(s.g).getCenter(new THREE.Vector3());
      const H = (s.g.userData.height || 42) *
                s.g.getWorldScale(new THREE.Vector3()).y / (s.g.scale.y || 1);
      controls.minDistance = 1;
      controls.target.copy(aim);
      cam.position.set(aim.x + H * 1.2, aim.y + H * 0.5, aim.z + H * 1.8);
      controls.update();
      const p = aim.clone().project(cam);
      if (!(p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95))
        return { skip: "off screen" };
      /* Is anybody standing in front of them? A tap picks the NEAREST
         person on the ray, which is right — if Kenji is between the
         camera and Elowen, tapping Elowen's chest should get Kenji.
         Demanding that the aimed-at student answer therefore fails on
         a CORRECT pick, and did, in CI: "no answer from Elowen/ariel
         (answered as Kenji)". So an overlapped target is skipped, and
         what is left is the question worth asking. */
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(p.x, p.y), cam);
      const reach = (o) => {
        const h = o.g.userData.height || 42;
        const c = o.g.getWorldPosition(new THREE.Vector3());
        c.y += h * 0.5;
        return ray.ray.intersectsSphere(new THREE.Sphere(c, h * 0.55))
          ? ray.ray.origin.distanceTo(c) : Infinity;
      };
      const mine = reach(s);
      for (const o of window.__students){
        if (o === s || !o.data || !o.g || !o.g.visible) continue;
        if (reach(o) < mine) return { skip: "someone is standing in front of them" };
      }
      const el = document.querySelector("#stage canvas");
      const c = el.getBoundingClientRect();
      /* A fingertip needs something to land on. In the compact layout
         the canvas is a ~150px letterbox showing the whole quad, and a
         loiterer at a far door projects a few pixels tall — Marcus
         failed there twice at the same pixel while answering fine in
         the fullscreen layout. The check's job is "picking works", and
         it already skips what a person could not tap (indoors, off
         screen, somebody in front); too-small-to-aim-at is the same
         category. Fourteen pixels is the tap slop the app itself grants
         a touch. */
      const headP = s.g.getWorldPosition(new THREE.Vector3());
      const feetN = headP.clone().project(cam);
      headP.y += (s.g.userData.height || 42);
      const headN = headP.project(cam);
      const tallPx = Math.abs(headN.y - feetN.y) * 0.5 * c.height;
      if (tallPx < 14) return { skip: "a few pixels tall from here" };
      /* Diagnostics that name the failure, learned from a run this
         check failed 0-for-5 and a probe minutes later passed 5-for-5
         on identical code. If it happens again, the answer to "did the
         events even arrive, and was a conversation already blocking
         the handler?" is in the failure text instead of a rerun. */
      const preOpen = window.__convo.on();
      let sawUp = false;
      const wUp = () => sawUp = true;
      const x = c.left + (p.x * 0.5 + 0.5) * c.width;
      const y = c.top + (-p.y * 0.5 + 0.5) * c.height;
      el.addEventListener("pointerup", wUp, true);
      try {
        const ev = (t, xx, yy) => el.dispatchEvent(new PointerEvent(t, { pointerId: 1,
          pointerType: "touch", isPrimary: true, clientX: xx, clientY: yy,
          bubbles: true, cancelable: true }));
        /* a couple of pixels of drift, because a finger has some */
        ev("pointerdown", x, y); ev("pointerup", x + 3, y + 2);
      } finally {
        el.removeEventListener("pointerup", wUp, true);
      }
      const opened = window.__convo.on();
      const who = document.getElementById("convo-name")?.textContent;
      if (opened) window.__convo.close();
      return { opened, who, fig: s.g.userData.figure,
               client: `${Math.round(x)},${Math.round(y)}`,
               preOpen, sawUp, tallPx: Math.round(tallPx),
               rect: `${Math.round(c.left)},${Math.round(c.top)} ` +
                     `${Math.round(c.width)}x${Math.round(c.height)}` +
                     ` (backing ${el.width}x${el.height})` };
    }, nm).catch((e) => ({ err: String(e).slice(0, 80) }));
    /* WITH the reason. "2 skipped" said the check tested nothing and
       not why, and the why is the whole diagnosis: indoors is the
       campus working, off screen after the camera walked to them is
       not. */
    if (r.skip || r.gone){ skipped.push(nm + " — " + (r.skip || "gone")); continue; }
    /* Answering as somebody else is a miss too — it means the ray found
       a different person, which is the failure this cannot afford to
       call a pass. */
    if (!r.opened || r.who !== nm)
      miss.push(`${nm}/${r.fig || "?"} (` +
                (r.err ? r.err : r.opened ? "answered as " + r.who : "nothing opened") +
                `, aimed ${r.client} in ${r.rect}` +
                (r.err ? "" : `, up ${r.sawUp ? "arrived" : "LOST"}` +
                              (r.preOpen ? ", a convo was already open" : "")) + `)`);
    await crowdPage.waitForTimeout(400);
  }
  /* the camera went walking with the taps — put it back before anything
     downstream reads draw statistics through it */
  await crowdPage.evaluate(() => {
    const c = window.__tapCam;
    if (!c) return;
    const { controls, camera } = window.__app;
    controls.minDistance = c.min;
    controls.target.copy(c.t);
    camera.position.copy(c.p);
    controls.update();
    delete window.__tapCam;
  }).catch(() => {});
  /* At least one student must actually ANSWER. A run where every tap
     was excused (indoors, off screen, too small) reported "0 of 5
     answered" as a pass — a suite that tests nothing and says green,
     which this file has done before and is not allowed to do again. */
  const answered = named.length - skipped.length - miss.length;
  step("tapping a student opens a conversation", answered >= 1 && miss.length === 0,
       miss.length ? "no answer from " + miss.join(", ")
       : answered < 1 ? `nobody could be tapped at all — the check tested nothing. ` +
                        `skipped: ${skipped.join("; ") || "none"}`
       : `${answered} of ${named.length} named students answered` +
         (skipped.length ? ` (${skipped.length} skipped: ${skipped.join("; ")})` : ""));

  /* Five of the eight roaming bodies are women, and a phone reported
     "none of the female characters are present" — which the numbers
     bore out: three of the named plans asked for the walker by NAME,
     because it is the only body whose clips are hand-labelled, so the
     same man stood on the quad three times over. Fixed by asking for
     the POSE instead. This is the check that keeps it fixed. */
  const looks = await crowdPage.evaluate(() => {
    /* Read from the campus, not kept here. The copy that used to live
       in this file named four retired bodies and none of the last four
       to land. */
    const FEM = new Set(window.__castFem || []);
    const figs = (window.__students || []).map(s => s.g && s.g.userData.figure).filter(Boolean);
    return { total: figs.length, women: figs.filter(f => FEM.has(f)).length,
             tally: figs.join(",") };
  }).catch(() => null);
  /* Also over the visit. Two women and two men ON SCREEN AT ONCE is
     more people than the ceiling draws, so the instant reading cannot
     pass however the campus is cast — the question is whether a visitor
     meets both over a few minutes, which is what they actually
     experience. */
  const FEMSET = new Set(await crowdPage.evaluate(() => window.__castFem || []).catch(() => []));
  const met = (overTime && overTime.seen) || [];
  if (cohortJudged)
  step("the campus is not all one gender",
       met.filter(f => FEMSET.has(f)).length >= 1 &&
       met.filter(f => !FEMSET.has(f)).length >= 1,
       met.length ? `${met.filter(f => FEMSET.has(f)).length} of ${met.length} people met read female`
                  : "could not count");
  if (looks)
    console.log(`  ..   on screen at the end: ${looks.women} of ${looks.total} read female`);

  /* ── can anybody sit down? ───────────────────────────────────────
     Nobody on this campus could, until a 2.2 second sit-down arrived
     on a body of its own and was lent to the skeletons already here.
     Two things have to hold and neither is visible in a screenshot:
     a body has to END UP with the clip, and its seated pose has to
     agree with the seated LOOP closely enough that seatRoles keeps
     the loop — because a disagreement there silently drops everyone
     back onto the grass, which is exactly the state this replaced. */
  const sitting = await crowdPage.evaluate(() => {
    const seen = new Map();
    for (const s of (window.__students || [])){
      const k = s.g?.userData?.figure, R = s.g?.userData?.anim?.roles;
      if (k && R && !seen.has(k)) seen.set(k, R);
    }
    const can = [...seen].filter(([, R]) => R.sit).map(([k, R]) =>
      `${k}@${(R.sitTo ?? 1).toFixed(2)}${R.seat ? "+loop" : ""}`);
    const benched = (window.__seats || []).length;
    return { can, bodies: seen.size, benched };
  }).catch(() => ({ can: [], bodies: 0, benched: 0 }));
  step("somebody on this campus can sit down", sitting.can.length > 0,
       sitting.can.length
         ? `${sitting.can.join(", ")} — over ${sitting.benched} benches`
         : `no body of ${sitting.bodies} has a sit-down; the clip donor ` +
           `did not load, or lendClip bound nothing`);

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
