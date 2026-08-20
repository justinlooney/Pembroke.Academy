#!/usr/bin/env node
/**
 * Pembroke Academy — can this campus be used without a mouse?
 *
 *     node tools/check-a11y.mjs
 *
 * The drive runs at one desktop viewport with a pointer, so the two
 * classes of defect that have hurt this repository most — the
 * mobile-only ones and the accessibility-only ones — are precisely
 * the two it cannot see. Every check here is one the drive would pass
 * blind.
 *
 * Three browsers rather than one, because the interesting cases are
 * media queries: a plain desktop, a hybrid laptop that reports BOTH a
 * fine pointer and a touchscreen, and a visitor who has asked the
 * operating system to stop moving things.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8097;
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

/* the same generous boot the ledger probe uses, for the same reason:
   no GPU, a software rasterizer, and forty megabytes of campus */
/* One campus at a time. Three live contexts is three WebGL campuses and
   forty megabytes of models each; holding all three ran the machine out
   of memory and then failed the third boot on a timeout, which reads as
   a page that will not start rather than a harness that will not let
   go. Each context is closed the moment its questions are answered. */
const open = async (opts) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const up = await page.waitForFunction(() => window.__app && window.__journey,
                                        null, { timeout: 240_000 }).then(() => true, () => false);
  if (!up) throw new Error("the campus did not ignite");
  return { ctx, page };
};

try {
  /* ── 1. a keyboard can see where it is ──────────────────────────── */
  const first = await open({});
  const { page } = first;

  /* Two passes, because "does it have an outline" is the wrong
     question. Half this HUD wears a box-shadow as decoration, and the
     first draft of this check counted those as focus indicators and
     reported 12 of 20 lit on a page where the true answer was four
     rules in a thousand lines. What matters is whether the control
     LOOKS DIFFERENT when the keyboard is on it, so both states get
     measured and compared — which also credits the two inputs that
     signal with a border colour instead of an outline.

     :focus-visible only matches real keyboard focus, so pass one has
     to be an actual Tab rather than el.focus(). That is the whole
     reason the rule is written that way. */
  const look = `(el) => { const s = getComputedStyle(el); return [s.outlineStyle, s.outlineWidth,
      s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.color].join("|"); }`;
  /* Chromium renders its own ring for :focus-visible and reports it as
     outline-style "auto"; an authored one is "solid". The distinction
     is the whole point. The audit counted :focus RULES and concluded
     there were no focus indicators — but the browser had been drawing
     one all along, so "a keyboard cannot see where it is" was an
     inference from the stylesheet rather than an observation of the
     page. What was actually missing is a ring designed for THIS page:
     the default is a thin light line, and this HUD floats over a
     daytime sky and sunlit grass, which is where it disappears and
     where the campus's own brass ring with its dark halo does not.
     So the check asks for an authored ring, not merely a different
     one — a bar the previous page fails and this one meets. */
  /* Keyed by ELEMENT, not by keypress. Twenty tabs on a page with
     eleven focusable controls visits several of them twice, and the
     first version of this stamped each visit with the press number —
     so the earlier stamp was overwritten, its lookup came back
     undefined, and the comparison quietly skipped it. It then reported
     "20/20" while having compared four. Counting the presses instead
     of the controls is how a check ends up describing its own blind
     spot; the ratio below is over unique controls. */
  const ring = new Map();
  for (let i = 0; i < 24; i++){
    await page.keyboard.press("Tab");
    const seen = await page.evaluate((fn) => {
      const look = eval(fn);
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      if (!el.dataset.a11yProbe)
        el.dataset.a11yProbe = "p" + document.querySelectorAll("[data-a11y-probe]").length;
      return { key: el.dataset.a11yProbe, tag: el.tagName.toLowerCase(),
               id: el.id || String(el.className).trim().split(/\s+/)[0] || "",
               on: look(el) };
    }, look);
    if (seen && !ring.has(seen.key)) ring.set(seen.key, seen);
  }
  const off = await page.evaluate((fn) => {
    const look = eval(fn);
    document.activeElement?.blur();
    const out = {};
    for (const el of document.querySelectorAll("[data-a11y-probe]")){
      out[el.dataset.a11yProbe] = look(el);
      delete el.dataset.a11yProbe;
    }
    return out;
  }, look);
  const seenAll = [...ring.values()];
  const dark = seenAll.filter(r => off[r.key] === r.on);
  const borrowed = seenAll.filter(r => !/^solid\|/.test(r.on));
  step("every control a Tab reaches looks different when it has the keyboard",
       seenAll.length > 0 && dark.length === 0,
       seenAll.length === 0 ? "nothing was reachable by Tab at all"
         : `${seenAll.length - dark.length}/${seenAll.length} controls change appearance` +
           (dark.length ? ` · unchanged: ${dark.slice(0, 6).map(d => d.tag + "#" + d.id).join(", ")}` : ""));
  step("and wears the campus's own ring rather than the browser's",
       seenAll.length > 0 && borrowed.length === 0,
       `${seenAll.length - borrowed.length}/${seenAll.length} authored` +
         (borrowed.length ? ` · still on the browser default: ${borrowed.slice(0, 6).map(d => d.tag + "#" + d.id).join(", ")}` : ""));

  /* ── 2. the dialog is as modal as it claims ─────────────────────── */
  /* The panel offers ONE call to action — whichever stage is current —
     so a fresh visitor is offered "Start Campus Visit", which opens no
     dialog at all. Seed an accepted application and the letter control
     is there unconditionally, with an id, which is what a return-focus
     check needs. */
  await page.evaluate(() => localStorage.setItem("pembroke.registrar.journey", JSON.stringify({
    admissions: { application: { first: "Ada", last: "Pembroke", email: "a@b.co",
                                 interest: "Undecided", statement: "" },
                  applicationSubmittedAt: 1, acceptedAt: 1, term: "Michaelmas" },
  })));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  if (!await page.waitForFunction(() => window.__app && window.__journey, null, { timeout: 240_000 })
        .then(() => true, () => false)) throw new Error("no ignition after seeding the ledger");

  const opened = await page.evaluate(async () => {
    const btn = document.getElementById("jletter-open");
    if (!btn) return { ok: false, why: "no letter control in the journey panel" };
    btn.focus(); btn.click();
    await new Promise(r => setTimeout(r, 250));
    const jm = document.getElementById("jmodal");
    return {
      ok: jm.classList.contains("open"),
      inertBackground: [...document.body.children]
        .filter(el => el.id !== "jmodal").every(el => el.hasAttribute("inert")),
      openerId: btn.id,
    };
  });
  step("the application opens and the campus behind it goes inert",
       opened.ok && opened.inertBackground,
       opened.ok ? `background inert: ${opened.inertBackground}` : opened.why);

  let escaped = 0;
  for (let i = 0; i < 30; i++){
    await page.keyboard.press("Tab");
    if (!await page.evaluate(() => document.getElementById("jmodal").contains(document.activeElement)))
      escaped++;
  }
  step("thirty tabs never leave the dialog", escaped === 0,
       `${escaped} of 30 landed outside #jmodal`);

  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+Tab");
  const backwards = await page.evaluate(() =>
    document.getElementById("jmodal").contains(document.activeElement));
  step("and neither does going backwards", backwards);

  await page.keyboard.press("Escape");
  const returned = await page.evaluate(() => {
    const el = document.activeElement;
    return { inPanel: !!el && !!el.closest("#journey"),
             closed: !document.getElementById("jmodal").classList.contains("open"),
             free: [...document.body.children].filter(x => x.id !== "jmodal")
                     .every(x => !x.hasAttribute("inert")),
             landed: el ? el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") : "nothing" };
  });
  step("closing hands the keyboard back to where it came from",
       returned.closed && returned.free && returned.inPanel,
       `closed ${returned.closed} · background released ${returned.free} · focus landed on ${returned.landed}`);

  /* ── 3. a hybrid laptop is a touch device while it is being touched ─
     Chromium's hasTouch flips the WHOLE pointer profile — it reports
     hover:none too — so it emulates a phone, not the machine at issue.
     The machine at issue reports a fine hovering primary pointer and
     has a touchscreen anyway, and there is no flag for that here. So
     test the mechanism written for it: a touch-type pointerdown on an
     otherwise ordinary desktop must bring the pad out WITHOUT taking
     the keyboard legend away. That second half is the whole reason
     this is a separate condition from (hover:none) and not the same
     one spelled differently. */
  const touch = await page.evaluate(async () => {
    const before = getComputedStyle(document.getElementById("touchpad")).display;
    document.body.classList.add("walkmode");
    dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    /* read BEFORE putting walk mode back, which the first draft of this
       did the other way round and blamed the page for */
    const seen = {
      hoverNone: matchMedia("(hover: none)").matches,
      marked: document.body.classList.contains("touched"),
      before,
      after: getComputedStyle(document.getElementById("touchpad")).display,
      keys: getComputedStyle(document.getElementById("hint-keys")).display,
    };
    document.body.classList.remove("walkmode");
    return seen;
  });
  step("a hovering pointer that is also a finger still gets a movement pad",
       !touch.hoverNone && touch.marked && touch.after !== "none",
       `hover:none ${touch.hoverNone} · body.touched ${touch.marked} · #touchpad ${touch.before} → ${touch.after}`);
  step("without taking its keyboard legend away", touch.keys !== "none",
       `#hint-keys display ${touch.keys} — a device with both needs both`);

  /* and a phone, which reports the coarse pointer outright, is covered
     by the media query rather than by the class */
  const phone = await open({ hasTouch: true, viewport: { width: 412, height: 915 } });
  const padPhone = await phone.page.evaluate(() => {
    document.body.classList.add("walkmode");
    return { coarse: matchMedia("(any-pointer: coarse)").matches,
             shown: getComputedStyle(document.getElementById("touchpad")).display };
  });
  await phone.ctx.close();
  step("a phone gets one from the media query, before any touch happens",
       padPhone.coarse && padPhone.shown !== "none",
       `any-pointer:coarse ${padPhone.coarse} · #touchpad display ${padPhone.shown}`);

  /* ── 4. asking for stillness gets stillness ─────────────────────── */
  /* Count what is running rather than name it. A list of selectors
     goes stale the first time somebody adds an animation, and would
     pass by finding nothing — which is how the depot check came to be
     testing an empty set. The same census runs in both browsers, so
     the desktop number is the proof that the quiet number means
     something. */
  /* The census runs on the desktop campus BEFORE it is closed, because
     the number it produces is the only thing that makes the quiet
     number mean anything. */
  const census = () => [...document.querySelectorAll("*")]
    .map(el => getComputedStyle(el))
    .filter(cs => cs.animationName !== "none" && (parseFloat(cs.animationDuration) || 0) > 0.01)
    .length;
  const busy = await page.evaluate(census);
  await first.ctx.close();          /* see the note on open() */
  const calm = await open({ reducedMotion: "reduce" });
  const quiet = await calm.page.evaluate(census);
  await calm.ctx.close();
  step("nothing on the campus keeps moving when asked to stop", quiet === 0 && busy > 0,
       busy === 0 ? "nothing was animating on the desktop either — this check proved nothing"
                  : `${busy} element(s) animating normally, ${quiet} still animating under reduce`);
} catch (e) {
  step("accessibility check completed", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}

if (failures.length){
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall accessibility checks passed.");
