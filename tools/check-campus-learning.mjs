#!/usr/bin/env node
import assert from "node:assert/strict";
import { serve, launch, open } from "./_harness.mjs";
const server = await serve(), browser = await launch();
try {
  const visit = await open(browser, server.origin, { ready: () => window.__app && window.__ai && window.__study, serviceWorkers: "block" });
  assert.equal(visit.up, true, "campus must boot");
  const { page } = visit;
  page.setDefaultTimeout(120_000);
  await page.locator("#arrival").waitFor({ state: "hidden", timeout: 180_000 });
  const practice = await page.evaluate(() => {
    const actor = { data: { ai: { cls: "professor" } } }, action = __ai.aiGovern({ type: "open_practice", target: "1.1" }, actor);
    action.cta.run();
    return { label: action.cta.label, problems: document.querySelectorAll("#jmodal-body [data-ps]").length,
      invalid: __ai.aiGovern({ type: "open_practice", target: "5.7" }, actor) };
  });
  assert.match(practice.label, /Practice/); assert.ok(practice.problems > 0); assert.equal(practice.invalid, null);
  console.log("ok — professor practice action opens the problem set and rejects an absent set");
  const brief = await page.evaluate(() => {
    const sec = __study.STUDY.MATH201.units[0].sections[0], full = sec.full;
    try {
      delete sec.full; __study.state().MATH201 = {};
      __study.openSection("MATH201", sec.n);
      sec.qs.forEach((q, i) => document.querySelector(`#jmodal-body input[name=q${i}][value="${q.a}"]`).checked = true);
      document.querySelector("#st-quiz").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return structuredClone(__study.state().MATH201);
    } finally { sec.full = full; }
  });
  assert.equal(brief["1.1"], 1); assert.equal(brief.x["1.1"].kc, 1); assert.ok(brief.log.every(e => e.k === "kc" && e.ok === 1));
  console.log("ok — brief lessons record checks and still require the problem set for mastery");
  await page.evaluate(() => __study.openSection("MATH101", "0.1"));
  assert.match(await page.locator("#jmodal-body").innerText(), /Expressions and substitution/);
  assert.equal(await page.locator("#jmodal-body canvas").count(), 1);
  console.log("ok — new introductory lessons and extracted figures work in the campus");
  await page.evaluate(() => __study.openSection("MATH101", "6.3"));
  assert.match(await page.locator("#jmodal-body").innerText(), /Inverse matrices/);
  assert.equal(await page.locator("#jmodal-body canvas").count(), 0);
  assert.match(await page.locator("#jmodal-body").innerText(), /Worked example 2/i);
  await page.locator("#jmodal-body [data-pset]").click();
  assert.equal(await page.locator("#jmodal-body [data-ps]").count(), 6);
  await page.evaluate(() => __study.openSection("MATH101", "CO.2"));
  assert.equal(await page.locator("#jmodal-body canvas").count(), 1);
  assert.match(await page.locator("#jmodal-body .st-read").innerText(), /Foci/);
  console.log("ok — complete algebra supports reading-only lessons, extra examples, required practice, and conic diagrams in the campus");
  await page.evaluate(() => __study.openSection("MATH101", "1.11"));
  assert.match(await page.locator("#jmodal-body").innerText(), /Combining different types of variation/);
  assert.match(await page.locator("#jmodal-body").innerText(), /Worked example 4/i);
  await page.locator("#jmodal-body [data-pset]").click();
  assert.equal(await page.locator("#jmodal-body [data-ps]").count(), 10);
  console.log("ok — Chapter 1 variation, its worked examples, and all ten exercises are available on campus");
  await page.locator(".jmodal-x").click();
  await page.locator('#academy-desk [data-attend="CS101"]').click();
  await page.waitForFunction(() => document.getElementById("jmodal-body").textContent.includes("Values, variables and a changing state"));
  const program = await page.evaluate(() => {
    const slider = document.querySelector("#jmodal-body .st-slide"); slider.value = "1000"; slider.dispatchEvent(new Event("input", { bubbles: true }));
    const sec = __study.STUDY.CS101.units[0].sections[0];
    sec.qs.forEach((q, i) => document.querySelector(`#jmodal-body input[name=q${i}][value="${q.a}"]`).checked = true);
    document.querySelector("#st-quiz").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return { state: structuredClone(__study.state().CS101), readout: document.querySelector("#jmodal-body .st-read").textContent,
      resume: JSON.parse(localStorage.getItem("pembroke.learning.resume")) };
  });
  assert.match(program.readout, /Output: 24 4/);
  assert.equal(program.state["1.1"], 2); assert.equal(program.state.x["1.1"].lab, 1);
  assert.deepEqual(program.resume, { courseId: "CS101", n: "1.1" });
  await page.locator(".jmodal-x").click();
  assert.match(await page.locator(".desk-resume").innerText(), /CS 101/);
  assert.equal(await page.evaluate(() => document.activeElement.matches('.desk-course[data-attend="CS101"]')), true, "saving must retain the dialog opener and restore keyboard focus to it");
  assert.equal(await page.locator('.desk-course[data-attend="CS101"]').getAttribute("data-lesson"), "1.2");
  console.log("ok — the campus learning desk opens a real programming lesson and advances earned progress");
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator("#reset-ledger").evaluate(button => button.click());
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("pembroke.learning.resume"))), program.resume, "canceling reset must retain the saved lesson");
  assert.equal(await page.evaluate(() => __study.state().CS101["1.1"]), 2);
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#reset-ledger").evaluate(button => button.click());
  assert.deepEqual(await page.evaluate(() => __study.state()), {});
  assert.equal(await page.evaluate(() => localStorage.getItem("pembroke.study")), null);
  assert.equal(await page.evaluate(() => localStorage.getItem("pembroke.learning.resume")), null);
  assert.match(await page.locator(".desk-resume").innerText(), /Your first seminar/i);
  // A restored bookmark without a study record must also be resettable.
  await page.evaluate(async () => {
    const { storage, KEYS } = await import("./assets/app/progress.mjs");
    storage.setItem(KEYS.resume, JSON.stringify({ courseId: "CS101", n: "1.4" }));
  });
  assert.match(await page.locator(".desk-resume").innerText(), /CS 101/);
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#reset-ledger").evaluate(button => button.click());
  assert.equal(await page.evaluate(() => localStorage.getItem("pembroke.learning.resume")), null);
  assert.equal(await page.locator(".desk-resume button").getAttribute("data-attend"), "MATH101");
  assert.equal(await page.locator(".desk-resume button").getAttribute("data-lesson"), "0.1");
  await page.locator(".desk-resume button").click();
  assert.match(await page.locator("#jmodal-body").innerText(), /Expressions and substitution/);
  assert.equal(await page.evaluate(() => __study.state().MATH101["0.1"]), 1, "a fresh lesson must still save after reset");
  assert.equal(await page.evaluate(() => __study.state().CS101), undefined);
  await page.locator(".jmodal-x").click();
  console.log("ok — reset clears progress and resume together, cancel preserves mastery, and fresh learning saves");
  await page.locator("#academy-desk [data-meet]").click();
  assert.equal(await page.locator("#nearbybtn").getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Escape");
  await page.locator("#academy-desk [data-walk]").click();
  assert.equal(await page.evaluate(() => __walker.on), true);
  console.log("ok — the desk connects to real campus conversation and walking controls");
} finally { await browser.close(); server.close(); }
