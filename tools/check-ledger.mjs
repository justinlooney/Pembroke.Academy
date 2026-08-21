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
import { serve, launch, open, reporter } from "./_harness.mjs";

const { origin, close: closeServer } = await serve();
const browser = await launch([]);
const { step, note, done } = reporter();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

/* Generous, like the drive's waits and for the same reason: a boot is
   ~22s idle here and this runs on a machine with no GPU at all. */
const booted = () => page.waitForFunction(() => window.__app && window.__journey,
                                          null, { timeout: 240_000 }).then(() => true, () => false);

try {
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
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
  /* ── 4. stored fields are read as words, never as markup ─────────
     jOpen() writes innerHTML, and the admissions views build that
     string out of what the visitor typed. Storing a tag as a first
     name used to fire four handlers and greet the reader "Dear ," —
     the name consumed as markup rather than printed. Self-inflicted
     while the only source is the local keyboard, and a stored XSS the
     day it is not, so it is checked at the boundary rather than
     argued about. */
  const PAYLOAD = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`;
  await page.evaluate(v => localStorage.setItem("pembroke.registrar.journey", v),
    JSON.stringify({
      admissions: {
        application: { first: PAYLOAD, last: PAYLOAD, pref: "", email: "a@b.co",
                       interest: PAYLOAD, statement: PAYLOAD },
        applicationSubmittedAt: 1, acceptedAt: 1, term: PAYLOAD,
      },
      registration: { term: PAYLOAD },
    }));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  if (!await booted()) throw new Error("the page did not come back after storing an application");

  const stored = await page.evaluate(async () => {
    document.getElementById("jletter-open")?.click();
    await new Promise(r => setTimeout(r, 200));
    const body = document.getElementById("jmodal-body");
    return {
      fired: window.__xss || 0,
      imgs: document.querySelectorAll("#jmodal-body img, #journey img").length,
      opened: !!body && body.children.length > 0,
      /* the name must SURVIVE as words — "Dear ," is the bug, and an
         empty letter would satisfy a check that only counted tags */
      greets: (body?.textContent || "").includes("onerror"),
      greeting: ((body?.textContent || "").match(/Dear[^,]*,/) || ["(no greeting)"])[0],
    };
  });
  step("a stored tag never becomes a tag", stored.fired === 0 && stored.imgs === 0,
       `${stored.fired} handler(s) fired, ${stored.imgs} element(s) built from stored text`);
  /* Report what was actually observed, not what a pass would have
     meant: this printed "greeting carries the stored text verbatim"
     while failing, which is the same kind of lie the cache check used
     to tell about eviction. */
  step("and the name still reaches the page as words", stored.opened && stored.greets,
       !stored.opened ? "the letter did not open — the check above proved nothing"
       : stored.greets ? "letter rendered, greeting carries the stored text verbatim"
       : `letter rendered but the greeting lost it — reads "${stored.greeting}"`);
} catch (e) {
  step("ledger check completed", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  closeServer();
}

done("ledger");
