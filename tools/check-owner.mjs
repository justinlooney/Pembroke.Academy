#!/usr/bin/env node
/**
 * Pembroke Academy — who owns the keyboard, and whose turn is it?
 *
 *     node tools/check-owner.mjs
 *
 * One question asked twice. Input and async continuations both act on
 * the campus, and neither used to check who currently holds it.
 *
 *   1. Four global key listeners each knew its own mode and none knew
 *      the overlay stack. With the application dialog open and focus on
 *      a <select>, pressing 2, f, n changed the sector and entered
 *      first-person walk mode behind a dialog that stayed open.
 *
 *   2. A finished AI turn wrote its line, gesture, call to action,
 *      history, speech and focus to the conversation surface without
 *      asking whether that surface was still the one it started in. It
 *      never misbehaved, because convoClose() aborts and the abort beat
 *      the continuation every time — safety resting on an ordering
 *      nothing enforced. So this installs a provider that IGNORES
 *      abort, which is the case the ordering does not cover.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8095;
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

/* what the campus looks like from outside, in the terms the bug is in */
const campus = () => page.evaluate(() => ({
  /* the real key, checked against LS_SECTOR rather than guessed —
     the first draft read "pembroke.sector", which is nothing, so that
     dimension answered null every time and compared equal to itself */
  sector: localStorage.getItem("pembroke.registrar.sector"),
  walk:   document.body.classList.contains("walkmode"),
  night: !document.body.classList.contains("day"),
  modal:  document.getElementById("jmodal").classList.contains("open"),
  convo:  document.body.classList.contains("convo-open"),
}));

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  if (!await page.waitForFunction(() => window.__app && window.__journey, null, { timeout: 240_000 })
        .then(() => true, () => false)) throw new Error("the campus did not ignite");

  /* ── 1. a dialog owns the keyboard while it is open ──────────────
     Every focusable control in the dialog, not just the first: the
     original bug needed focus on a <select>, because <select> is the
     one an "input,textarea" test does not name. */
  /* Campus Visit done and nothing submitted, so the panel's one call to
     action is "Apply to Pembroke" — the only dialog with <select> in
     it, and <select> is the control the bug needed. */
  await page.evaluate(() => localStorage.setItem("pembroke.registrar.journey", JSON.stringify({
    onboarding: { campusVisit: { status: "done", steps: {}, completedAt: 1, hidden: false } },
  })));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  if (!await page.waitForFunction(() => window.__app && window.__journey, null, { timeout: 240_000 })
        .then(() => true, () => false)) throw new Error("no ignition after seeding the ledger");

  const opened = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll("#journey button")]
      .find(b => /apply to pembroke/i.test(b.textContent || ""));
    if (!btn) return { ok: false, why: "no Apply control — the ledger seed did not take" };
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    return { ok: document.getElementById("jmodal").classList.contains("open"),
             selects: document.querySelectorAll("#jmodal-body select").length };
  });
  step("the application is open, selects and all", opened.ok && opened.selects >= 2,
       opened.why || `${opened.selects} <select> in the dialog — the control an "input,textarea" test does not name`);

  const before = await campus();
  const controls = await page.evaluate(() =>
    document.querySelectorAll("#jmodal-body a[href],#jmodal-body button,#jmodal-body input,#jmodal-body select,#jmodal-body textarea").length);
  const leaked = [];
  for (let i = 0; i < controls; i++){
    await page.evaluate((n) => {
      const els = [...document.querySelectorAll("#jmodal-body a[href],#jmodal-body button,#jmodal-body input,#jmodal-body select,#jmodal-body textarea")];
      els[n]?.focus();
    }, i);
    for (const k of ["2", "f", "n", "p", "0"]) await page.keyboard.press(k);
    const now = await campus();
    for (const key of ["sector", "walk", "night"])
      if (now[key] !== before[key] && !leaked.includes(key)) leaked.push(key);
    if (!now.modal) { leaked.push("the dialog closed"); break; }
  }
  step("campus shortcuts do nothing while a dialog holds the keyboard",
       controls > 0 && leaked.length === 0,
       controls === 0 ? "no controls in the dialog to press keys from"
         : `${controls} control(s) tried × 5 keys` +
           (leaked.length ? ` · moved: ${leaked.join(", ")}` : ""));

  /* and the dialog's own key still works */
  await page.keyboard.press("Escape");
  const shut = await page.evaluate(() =>
    !document.getElementById("jmodal").classList.contains("open"));
  step("but the dialog's own Escape still closes it", shut);

  /* ── 2. a turn that is no longer the turn writes nothing ─────────
     A provider that ignores abort and takes its time, so the
     continuation lands well after the conversation has changed hands.
     Nothing else about the page is stubbed: the real submit handler,
     the real governor, the real DOM. */
  /* The cohort arrives progressively, so ask rather than assume — a
     race between two students needs two students. */
  const arrived = await page.waitForFunction(
    () => window.__students.filter(x => x.data?.name && x.g?.visible).length >= 2,
    null, { timeout: 180_000 }).then(() => true, () => false);
  step("two people are out on the quad to talk to", arrived);

  const race = await page.evaluate(async () => {
    const { AIProviders, AI } = window.__ai;
    AI.cfg.mode = "hosted"; AI.cfg.gateway = "http://example.invalid";
    AIProviders.hosted = async (s, userText, history, onToken) => {
      await new Promise(r => setTimeout(r, 2500));   /* the signal is ignored on purpose */
      onToken?.("A LINE FROM THE FIRST CONVERSATION");
      return { dialogue: "A LINE FROM THE FIRST CONVERSATION",
               emotion: "neutral", intent: { type: "none" } };
    };
    const named = window.__students.filter(x => x.data?.name && x.g?.visible);
    if (named.length < 2) return { ok: false, why: `only ${named.length} student(s) on the quad` };
    const [a, b] = named;

    const talk = async (who) => {
      window.__talkTo(who.data.name);
      await new Promise(r => setTimeout(r, 300));
      const input = document.getElementById("convo-input");
      if (!input || document.getElementById("convo-say-row").hidden)
        return "the conversation has no input row — no live provider";
      input.value = "hello there";
      document.getElementById("convo-send").click();
      return null;
    };
    const why = await talk(a);
    if (why) return { ok: false, why };

    await new Promise(r => setTimeout(r, 400));      /* the turn is in flight */

    /* Escape is how a visitor leaves, and it runs the real convoClose —
       including the abort this provider ignores. The first draft of
       this clicked #convo-cancel, which only aborts; the conversation
       stayed open, convoOpen refused to replace it (it returns early
       while convoView is set), and the check then blamed the page for
       A's reply landing in A's own conversation. Verify B actually has
       the surface before believing anything that follows. */
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    if (document.body.classList.contains("convo-open"))
      return { ok: false, why: "Escape did not close the first conversation" };
    window.__talkTo(b.data.name);                     /* B takes the surface */
    await new Promise(r => setTimeout(r, 300));
    const holder = window.__ai.gen;
    const bOpener = document.getElementById("convo-said").textContent;
    if (!document.body.classList.contains("convo-open"))
      return { ok: false, why: `${b.data.name}'s conversation never opened` };
    await new Promise(r => setTimeout(r, 3000));      /* A's continuation lands here */

    return { ok: true, a: a.data.name, b: b.data.name, bOpener, gen: holder(),
             said: document.getElementById("convo-said").textContent,
             /* Every DOM sink at once — the line, the gesture caption,
                the call-to-action label, the spoken bubble over the
                figure. Naming them one at a time would miss whichever
                one gets added next. */
             anywhere: document.body.innerText.includes("A LINE FROM THE FIRST CONVERSATION"),
             aHist: (a.aiHist || []).length, bHist: (b.aiHist || []).length,
             stillOpen: document.body.classList.contains("convo-open") };
  });

  if (!race.ok){
    step("a finished turn cannot write into the next conversation", false, race.why);
  } else {
    const bled = race.said.includes("A LINE FROM THE FIRST CONVERSATION");
    step("a finished turn cannot write into the next conversation", !bled && race.stillOpen,
         !race.stillOpen ? `${race.b}'s conversation did not survive the wait — nothing was proved`
         : bled ? `${race.a}'s reply landed in ${race.b}'s conversation`
                : `${race.b}'s surface still reads its own opener: ${JSON.stringify(race.bOpener.slice(0, 48))}`);
    /* Not a history check: aiHist hangs off each student record, so
       one student's turns cannot land in another's whatever happens,
       and a check asserting that can only ever pass. The reachable
       question is whether the words appear ANYWHERE — the gesture, the
       call to action and the spoken bubble are separate writes to
       separate places, and all of them are downstream of the same
       guard. bHist is reported because it is worth seeing, not
       asserted because it cannot move. */
    step("nor anywhere else on the campus", !race.anywhere,
         race.anywhere ? `${race.a}'s words are somewhere in the document`
           : `nothing of ${race.a}'s turn reached the page · ${race.a} kept ${race.aHist}, ${race.b} holds ${race.bHist}`);
  }
} catch (e) {
  step("ownership check completed", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}

if (failures.length){
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall ownership checks passed.");
