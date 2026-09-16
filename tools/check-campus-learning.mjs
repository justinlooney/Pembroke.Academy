#!/usr/bin/env node
import assert from "node:assert/strict";
import { serve, launch, open } from "./_harness.mjs";
const server = await serve(), browser = await launch();
try {
  const visit = await open(browser, server.origin, { ready: () => window.__app && window.__ai && window.__study, serviceWorkers: "block" });
  assert.equal(visit.up, true, "campus must boot");
  const { page } = visit;
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
  await page.evaluate(() => __study.openSection("MATH101", "1.1"));
  assert.match(await page.locator("#jmodal-body").innerText(), /Expressions and substitution/);
  assert.equal(await page.locator("#jmodal-body canvas").count(), 1);
  console.log("ok — new introductory lessons and extracted figures work in the campus");
  await page.locator("#jmodal-close").click().catch(() => page.keyboard.press("Escape"));
  await page.screenshot({ path: ".shots/campus-review.png" });
} finally { await browser.close(); server.close(); }
