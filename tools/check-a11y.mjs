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
import { serve, launch, open, reporter, ROOT } from "./_harness.mjs";
import { devices } from "playwright";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const { origin, close: closeServer } = await serve();
const browser = await launch();
const { step, note, done } = reporter();

/* axe-core over one surface. WCAG 2.0/2.1 A and AA, violations only —
   "incomplete" results are things axe cannot decide without a human
   and would make this gate advisory rather than a gate. */
const AXE = resolve(ROOT, "node_modules/axe-core/axe.min.js");
const audit = async (page, label) => {
  if (!existsSync(AXE)){
    step(`axe finds nothing to fix — ${label}`, false,
         "axe-core is not installed — npm install --no-save playwright axe-core (both in one call, or the second prunes the first)");
    return;
  }
  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => {
    const r = await axe.run(document, { resultTypes: ["violations"],
      runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa"] } });
    return r.violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length }));
  });
  step(`axe finds nothing to fix — ${label}`, v.length === 0,
       v.length ? v.map(x => `${x.id} ×${x.n} (${x.impact})`).join(", ")
                : "wcag2a + wcag2aa + wcag21a + wcag21aa, violations only");
};

/* the same generous boot the ledger probe uses, for the same reason:
   no GPU, a software rasterizer, and forty megabytes of campus */
/* One campus at a time. Three live contexts is three WebGL campuses and
   forty megabytes of models each; holding all three ran the machine out
   of memory and then failed the third boot on a timeout, which reads as
   a page that will not start rather than a harness that will not let
   go. Each context is closed the moment its questions are answered. */
const visit = async (opts) => {
  const v = await open(browser, origin, { ready: () => window.__app && window.__journey, ...opts });
  if (!v.up) throw new Error("the campus did not ignite");
  return v;
};

try {
  /* ── 1. a keyboard can see where it is ──────────────────────────── */
  const first = await visit({});
  const { page } = first;
  await audit(page, "the campus");

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

  await audit(page, "the journey dialog");

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

  /* ── nothing on the rail sits on anything else ──────────────────
     Three separate times this repository has put two controls at the
     same coordinates and shipped it, because CSS fails silently: a
     rule at one breakpoint and a rule at another disagree, the later
     one paints over the earlier, and everything still "works" — the
     covered control is simply unreachable. The worst of them put the
     sound button exactly on top of the walk button on a phone, where
     there is no F key, so the one way into walk mode could not be
     tapped at all.

     No assertion about a single element would have caught any of
     them. This asks the only question that would: do any two of these
     overlap? */
  const RAIL = () => {
    const ids = ["daynight", "soundbtn", "nearbybtn", "walkbtn", "minimap", "quest"];
    const seen = ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return null;
      const r = el.getBoundingClientRect();
      return r.width && r.height ? { id, x: r.left, y: r.top, r: r.right, b: r.bottom } : null;
    }).filter(Boolean);
    const clashes = [];
    for (let i = 0; i < seen.length; i++)
      for (let j = i + 1; j < seen.length; j++){
        const a = seen[i], b = seen[j];
        if (a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b)
          clashes.push(`${a.id} over ${b.id}`);
      }
    return { count: seen.length, clashes };
  };
  const railStep = (where, r) =>
    step(`no two controls on the rail are in the same place — ${where}`,
         r.count >= 4 && r.clashes.length === 0,
         r.count < 4 ? `only ${r.count} control(s) visible to compare`
           : r.clashes.length ? r.clashes.join(", ")
           : `${r.count} controls, none overlapping`);
  railStep("desktop", await page.evaluate(RAIL));

  /* and a phone, which reports the coarse pointer outright, is covered
     by the media query rather than by the class */
  const phone = await visit(devices["Pixel 5"]);

  /* Asked FIRST, before the touchpad check puts the page into walk
     mode, because the rail a visitor arrives to is the one that has to
     be usable — and asked here at all because on the desktop alone it
     passed against a build where the sound button sat exactly on top
     of the walk button. The rail is only redefined below 1023px, so
     the fault lived entirely inside a block the desktop never reads.
     A check at one viewport says nothing about the others. */
  railStep("Pixel 5", await phone.page.evaluate(RAIL));

  const padPhone = await phone.page.evaluate(() => {
    document.body.classList.add("walkmode");
    return { coarse: matchMedia("(any-pointer: coarse)").matches,
             shown: getComputedStyle(document.getElementById("touchpad")).display };
  });
  await audit(phone.page, "the campus on a Pixel 5");
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
  /* ── 5. the world can be reached without a pointer ──────────────
     Buildings always could be: 1-4 run selectSector(key, true), which
     opens the interior. A person could not — convoOpen() had one user
     entry and it was a ray cast from a pointer, so a step of the
     Campus Visit had no keyboard equivalent. These press real keys and
     click real controls; nothing here calls convoOpen directly, which
     is the only way to know the surface is wired to the same path. */
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.body.focus?.());
  await page.keyboard.press("p");
  const panel = await page.evaluate(() => {
    const el = document.getElementById("nearby");
    return { up: !el.hidden,
             expanded: document.getElementById("nearbybtn").getAttribute("aria-expanded"),
             people: el.querySelectorAll("#nb-people .nb-row").length,
             reachable: el.querySelectorAll("#nb-people .nb-row:not([aria-disabled])").length,
             places: el.querySelectorAll("#nb-places .nb-row").length,
             focusInside: el.contains(document.activeElement) };
  });
  step("one key opens a list of who and what is out there",
       panel.up && panel.expanded === "true" && panel.people > 0 && panel.places >= 5,
       `${panel.people} people (${panel.reachable} on the quad), ${panel.places} places`);
  step("and the keyboard lands in it", panel.focusInside);

  /* every named person the ray could reach must have a control here */
  const covered = await page.evaluate(() => {
    const named = window.__students.filter(s => s.data?.name && s.g?.visible).map(s => s.data.name);
    const listed = [...document.querySelectorAll("#nb-people .nb-row:not([aria-disabled]) .nb-name")]
      .map(e => e.textContent);
    return { missing: named.filter(n => !listed.includes(n)), named: named.length };
  });
  step("everyone the pointer could reach has a control too",
       covered.named > 0 && covered.missing.length === 0,
       covered.named === 0 ? "nobody was out on the quad — this proved nothing"
         : `${covered.named} on the quad` +
           (covered.missing.length ? ` · no control for ${covered.missing.join(", ")}` : ""));

  /* Review caught what these checks did not: the list refreshes on an
     interval because people walk, and rewriting it used to destroy the
     row the keyboard was resting on. Every check above clicked
     immediately, so none of them ever waited long enough to be thrown
     out. This one waits through two refreshes on purpose. */
  const kept = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll("#nb-people .nb-row:not([aria-disabled])")];
    const target = rows[rows.length - 1] || rows[0];
    if (!target) return { ok: false, why: "no reachable row to stand on" };
    target.focus();
    const was = target.dataset.talk;
    await new Promise(r => setTimeout(r, 3400));       /* two refreshes */
    const now = document.activeElement;
    return { ok: !!now && now.dataset?.talk === was && document.getElementById("nearby").contains(now),
             was, now: now?.dataset?.talk ?? now?.tagName?.toLowerCase() ?? "nothing" };
  });
  step("the list refreshing does not throw the keyboard out of it", kept.ok,
       kept.why || `stood on ${JSON.stringify(kept.was)}, ended on ${JSON.stringify(kept.now)}`);

  /* …and the same question asked so it cannot pass by luck.
     The check above waits two refreshes and hopes somebody walks
     indoors during them. That is the ONLY condition under which the
     bug it guards fires, so on a quiet quad it passes without ever
     testing anything — which is how the defect reached CI, and how a
     lucky green would then have hidden it again. Here the person the
     keyboard is standing on is walked indoors ON PURPOSE.

     "Gone dim" is read from aria-disabled OR the disabled attribute,
     deliberately: this asks whether the KEYBOARD SURVIVES somebody
     stepping inside, not how the row was marked. Either marking may
     answer it. And if the row never goes dim at all, that is a
     FAILURE rather than a pass — the scenario did not happen and the
     check learned nothing. */
  const dimmed = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll(
      "#nb-people .nb-row:not([aria-disabled]):not([disabled])")];
    if (rows.length < 2) return { exercised: false, why: `only ${rows.length} reachable row(s) to work with` };
    const target = rows[rows.length - 1];
    target.focus();
    const was = target.dataset.talk, first = rows[0].dataset.talk;
    const s = window.__students?.find(x => x.data?.name === was);
    if (!s) return { exercised: false, why: `no student behind the row for ${was}` };
    s.g.visible = false;                       /* they step inside */
    window.__nearby.render();
    const row = document.querySelector(`[data-talk="${CSS.escape(was)}"]`);
    const dim = !!row && (row.getAttribute("aria-disabled") === "true" || row.hasAttribute("disabled"));
    const now = document.activeElement;
    s.g.visible = true;                        /* put them back */
    return { exercised: dim, why: dim ? null : "the row never went dim — the scenario did not happen",
             was, first, now: now?.dataset?.talk ?? now?.tagName?.toLowerCase() ?? "nothing",
             inPanel: document.getElementById("nearby").contains(now) };
  });
  step("and somebody walking indoors does not take the keyboard with them",
       dimmed.exercised && dimmed.now === dimmed.was && dimmed.inPanel,
       dimmed.why || `stood on ${JSON.stringify(dimmed.was)}, they stepped inside, keyboard ended on ` +
                     `${JSON.stringify(dimmed.now)}` +
                     (dimmed.now === dimmed.was ? " — stayed, dimmed and still reachable"
                      : dimmed.now === dimmed.first ? " — the FIRST row: focus fell through to a different person"
                      : " — focus left the row it was on"));

  const talked = await page.evaluate(async () => {
    document.querySelector("#nb-people .nb-row:not([aria-disabled])").click();
    await new Promise(r => setTimeout(r, 600));
    const on = document.body.classList.contains("convo-open");
    if (on) document.getElementById("convo-cancel")?.click();
    return on;
  });
  step("choosing a person opens the same conversation the pointer opens", talked,
       talked ? "body.convo-open" : "the row fired but no conversation began");

  await page.keyboard.press("Escape");
  const entered = await page.evaluate(async () => {
    document.getElementById("nearbybtn").click();
    await new Promise(r => setTimeout(r, 200));
    document.querySelector("#nb-places .nb-row").click();
    await new Promise(r => setTimeout(r, 900));
    return !!document.querySelector(".interior-open");
  });
  step("and choosing a place steps inside it", entered,
       entered ? "the wing opened" : "the row fired but no interior opened");

  const busy = await page.evaluate(census);
  await first.ctx.close();          /* see the note on open() */
  const calm = await visit({ reducedMotion: "reduce" });
  const quiet = await calm.page.evaluate(census);
  await calm.ctx.close();
  step("nothing on the campus keeps moving when asked to stop", quiet === 0 && busy > 0,
       busy === 0 ? "nothing was animating on the desktop either — this check proved nothing"
                  : `${busy} element(s) animating normally, ${quiet} still animating under reduce`);
} catch (e) {
  step("accessibility check completed", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  closeServer();
}

done("accessibility");
