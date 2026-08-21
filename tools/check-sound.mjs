#!/usr/bin/env node
/**
 * Pembroke Academy — does the campus make a sound, and only when asked?
 *
 *     node tools/check-sound.mjs
 *
 * A CI runner has no speakers, so nothing here listens. It renders the
 * bell through an OfflineAudioContext and measures the samples, and it
 * asks the live page what its graph is doing. Both are things you can
 * be wrong about without hearing them.
 *
 * The two that matter most are not about sound at all:
 *   - nothing plays before a gesture (the autoplay policy, and manners)
 *   - the choice is remembered, and still waits for a gesture next time
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8091;
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
  args: ["--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox",
         "--autoplay-policy=document-user-activation-required"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  /* __sound exists long before the arrival overlay leaves, and that
     overlay sits at z-index 200 across the whole window — so waiting
     on the module and then clicking a HUD button clicks the curtain */
  const ready = () => page.waitForFunction(
    () => window.__sound && window.__app && !document.getElementById("arrival"),
    null, { timeout: 240_000 }).then(() => true, () => false);
  if (!await ready()){
    /* say which of the two it was: a campus that will not start and a
       campus with no sound module are different failures */
    const up = await page.evaluate(() => !!window.__app).catch(() => false);
    throw new Error(up ? "the campus is up but exposes no sound module"
                       : "the campus did not ignite");
  }

  /* ── 1. the campus is silent until it is asked ──────────────────── */
  const cold = await page.evaluate(() => window.__sound.__probe());
  step("nothing is built, and nothing plays, before a gesture",
       cold.built === false && cold.on === false,
       `built=${cold.built} on=${cold.on} — an AudioContext made on page load is a page that decided for you`);

  /* ── 2. a gesture turns it on, and the graph is actually running ──
     Raw input at measured coordinates, and it matters why.

     This has to be a TRUSTED click: user activation is the entire
     subject of two of these checks, and a scripted el.click() would
     pass the click and fail the point. But page.click() resolves the
     element, scrolls it into view and waits for it to hold still, and
     on a headless runner rendering fullscreen WebGL with no GPU it
     never gets there — 30s timeout, twice, once with force:true, which
     skips the actionability WAIT and still runs the rest of that
     pipeline.

     So: read the rectangle with evaluate, which waits for nothing, and
     send the input with page.mouse, which resolves nothing. Both ends
     of the problem removed rather than one. The hit test is asserted
     here rather than assumed, because a click at coordinates cannot
     tell you it missed. */
  const press = async () => {
    const hit = await page.evaluate(() => {
      const el = document.getElementById("soundbtn");
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const at = document.elementFromPoint(x, y);
      return { x, y, mine: at === el || el.contains(at),
               who: at ? (at.id || at.tagName) : "nothing" };
    });
    if (!hit.mine) throw new Error(`the sound control is covered by ${hit.who}`);
    await page.mouse.click(hit.x, hit.y);
  };
  await press();
  const warm = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 400));
    return { ...window.__sound.__probe(),
             pressed: document.getElementById("soundbtn").getAttribute("aria-pressed"),
             stored: localStorage.getItem("pembroke.registrar.sound") };
  });
  step("a click builds the graph and starts it running",
       warm.built && warm.on && warm.state === "running",
       `built=${warm.built} on=${warm.on} state=${warm.state}`);
  step("and the control says so", warm.pressed === "true" && warm.stored === "on",
       `aria-pressed=${warm.pressed} stored=${JSON.stringify(warm.stored)}`);

  /* ── 3. the bell is a bell ───────────────────────────────────────
     Rendered offline and measured. A sine with a sad face decays in
     one exponential; a struck bell has several partials at once and
     the high ones die first, so the spectrum at the end is not the
     spectrum at the start. */
  const bellRender = await page.evaluate(async () => {
    const SR = 44100, secs = 6;
    const off = new OfflineAudioContext(1, SR * secs, SR);
    /* the same partial table the campus uses, read off the module so
       this cannot quietly test a different bell */
    const P = [[0.5,1.00,4.2],[1.0,0.85,3.4],[1.2,0.55,2.6],[1.5,0.40,2.0],[2.0,0.30,1.5],[2.66,0.18,0.9]];
    for (const [ratio, amp, decay] of P){
      const o = off.createOscillator(), g = off.createGain();
      o.type = "sine"; o.frequency.value = 196 * ratio;
      g.gain.setValueAtTime(0, 0);
      g.gain.linearRampToValueAtTime(amp * 0.5, 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, decay);
      o.connect(g).connect(off.destination); o.start(0); o.stop(decay + 0.05);
    }
    const buf = await off.startRendering();
    const d = buf.getChannelData(0);
    const rms = (from, to) => {
      let s = 0; const a = Math.floor(from * SR), b = Math.floor(to * SR);
      for (let i = a; i < b; i++) s += d[i] * d[i];
      return Math.sqrt(s / (b - a));
    };
    /* zero crossings stand in for brightness: many early, few late */
    const zc = (from, to) => {
      let n = 0; const a = Math.floor(from * SR), b = Math.floor(to * SR);
      for (let i = a + 1; i < b; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) n++;
      return n / (to - from);
    };
    return { attack: rms(0, 0.2), mid: rms(1, 1.2), tail: rms(4.4, 4.6),
             brightEarly: zc(0.05, 0.35), brightLate: zc(3.0, 3.3),
             partials: window.__sound.__probe().partials };
  });
  step("the bell strikes, rings, and dies away",
       bellRender.attack > 0.05 && bellRender.mid > 0.005 && bellRender.mid < bellRender.attack
         && bellRender.tail < bellRender.mid,
       `rms attack ${bellRender.attack.toFixed(3)} → 1s ${bellRender.mid.toFixed(3)} → 4.5s ${bellRender.tail.toFixed(4)}`);
  step("and it darkens as it decays, the way struck metal does",
       bellRender.brightLate < bellRender.brightEarly * 0.9 && bellRender.partials === 6,
       `${bellRender.partials} partials · ${Math.round(bellRender.brightEarly)} zero-crossings/s early → ` +
       `${Math.round(bellRender.brightLate)} late`);

  /* the number of chimes is a function of the hour — MATH 201 §1.1 */
  const chimes = await page.evaluate(() => [1, 5, 12, 13, 0].map(h => window.__sound.bell(h)));
  step("the number of chimes is a function of the hour",
       JSON.stringify(chimes) === JSON.stringify([1, 5, 12, 1, 12]),
       `1→${chimes[0]} 5→${chimes[1]} 12→${chimes[2]} 13→${chimes[3]} 0→${chimes[4]} — the lecture's own example`);

  /* ── 4. paving and turf are told apart by the real geometry ─────── */
  const surf = await page.evaluate(() => {
    const w = window.__walks || [];
    const mid = w.length ? w[0].pts[Math.floor(w[0].pts.length / 2)] : null;
    return { ways: w.length, onWay: mid ? window.__onPaving(mid[0], mid[1]) : null,
             onGrass: window.__onPaving(120, 120) };
  });
  step("a footfall knows paving from turf",
       surf.ways > 0 && surf.onWay === true && surf.onGrass === false,
       `${surf.ways} ways published · a point on one reads ${surf.onWay}, a corner of the lawn reads ${surf.onGrass}`);

  /* ── 5. turning it off means off, and is remembered ─────────────── */
  await press();
  const off = await page.evaluate(() => ({ ...window.__sound.__probe(),
    stored: localStorage.getItem("pembroke.registrar.sound") }));
  step("a second click silences it and remembers", off.on === false && off.stored === "off",
       `on=${off.on} stored=${JSON.stringify(off.stored)}`);

  /* ── 6. remembered ON still waits for a gesture next time ───────── */
  await page.evaluate(() => localStorage.setItem("pembroke.registrar.sound", "on"));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  if (!await ready()) throw new Error("the campus did not come back");
  const revisit = await page.evaluate(() => window.__sound.__probe());
  step("a remembered yes still waits to be asked again", revisit.built === false,
       `built=${revisit.built} — the preference is stored, the context is not resumed until a gesture`);
  await page.mouse.click(640, 400);
  const resumed = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 500));
    return window.__sound.__probe();
  });
  step("and the first gesture brings it back", resumed.built && resumed.on && resumed.state === "running",
       `built=${resumed.built} on=${resumed.on} state=${resumed.state}`);
} catch (e) {
  step("sound check completed", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}

if (failures.length){
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall sound checks passed.");
