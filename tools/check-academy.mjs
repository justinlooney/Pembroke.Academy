#!/usr/bin/env node
/** Positive end-to-end learning journeys. No screenshots or repo writes. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { serve, launch, ROOT } from "./_harness.mjs";
import { INTRO_CS } from "../assets/app/intro-cs.mjs";
const server = await serve(), browser = await launch(["--disable-webgl"]);
const audit = async page => {
  await page.addScriptTag({ path: resolve(ROOT, "node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
  assert.deepEqual(violations, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], requests = [];
  page.on("pageerror", e => errors.push(e.message)); page.on("request", r => requests.push(r.url()));
  await page.goto(server.origin + "/study.html#catalog");
  await page.waitForSelector("[data-course-card]");
  assert.equal(await page.locator("[data-course-card]").count(), 3);
  assert.equal(await page.evaluate(() => localStorage.getItem("pembroke.learning.resume")), null, "browsing must not open a lesson");
  await audit(page);
  await page.locator(".skip").focus(); await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => location.hash), "#catalog");
  assert.equal(await page.evaluate(() => document.activeElement.id), "lesson");
  assert.equal(await page.locator("[data-course-card]").count(), 3, "skip navigation must not open a different course");
  await page.locator("#course-search").fill("cs 101");
  assert.equal(await page.locator("[data-course-card]").count(), 1);
  assert.equal(await page.locator("[data-course-card]").getAttribute("data-course-card"), "CS101");
  await page.locator("#course-search").fill("<img src=x onerror=alert(1)>");
  assert.equal(await page.locator("[data-course-card]").count(), 0);
  await page.locator("#clear-search").click(); assert.equal(await page.locator("[data-course-card]").count(), 12);
  await page.locator("#course-availability").selectOption("syllabus");
  assert.equal(await page.locator("[data-course-card]").count(), 9);
  await page.locator('[data-course-card="CS201"] .course-start').click();
  await page.waitForFunction(() => document.title.includes("Syllabus preview"));
  assert.match(await page.locator("#lesson").innerText(), /Syllabus only/);
  await page.goBack(); await page.waitForSelector("#catalog-cards");
  console.log("ok — catalog filters, empty-state recovery, syllabus honesty and browser history");

  for (const sec of INTRO_CS.units[0].sections){
    await page.goto(server.origin + "/study.html#course=CS101&lesson=" + sec.n);
    await page.waitForFunction(title => document.querySelector("h1")?.textContent === title, sec.t);
    await page.locator('[data-jump="explore-heading"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), "explore-heading");
    await page.locator("#model").focus(); await page.keyboard.press("End");
    assert.match(await page.locator("#readout").innerText(), /Output: (24 4|1|6|25)\./);
    await page.locator("#knowledge button").click(); assert.match(await page.locator("#check-status").innerText(), /Nothing has been graded/);
    for (let i = 0; i < sec.qs.length; i++) await page.locator(`input[name=kc${i}][value="${(sec.qs[i].a + 1) % sec.qs[i].opts.length}"]`).check();
    await page.locator("#knowledge button").click(); assert.doesNotMatch(await page.locator("#mastery").innerText(), /Lesson mastered/);
    for (let i = 0; i < sec.qs.length; i++) await page.locator(`input[name=kc${i}][value="${sec.qs[i].a}"]`).check();
    await page.locator("#knowledge button").click(); assert.match(await page.locator("#mastery").innerText(), /Lesson mastered/);
    await page.locator("#homework").click();
    const qs = sec.full.homework.gen.map(fn => fn());
    for (let i = 0; i < qs.length; i++) await page.locator(`[data-hw="${i}"] input`).fill(String(qs[i].ans));
    await page.locator("form button").click(); assert.match(await page.locator("#hw-status").innerText(), /2\/2 correct/);
    await page.locator("#back").click();
  }
  await page.reload(); await page.waitForSelector("#knowledge");
  await page.locator(".skip").focus(); await page.keyboard.press("Enter");
  assert.match(await page.evaluate(() => location.hash), /course=CS101/);
  assert.equal(await page.evaluate(() => document.activeElement.id), "lesson");
  assert.match(await page.locator("#course-progress").innerText(), /4 of 4/);
  assert.match(await page.locator("#mastery").innerText(), /Lesson mastered/);
  await audit(page);
  await page.getByRole("button", { name: "Progress & backup" }).click(); await audit(page);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  console.log("ok — all four programming labs, wrong/right checks, homework and restored mastery");
  await page.setViewportSize({ width: 390, height: 844 }); await audit(page);
  await page.goto(server.origin + "/study.html#catalog"); await page.waitForSelector("#catalog-cards"); await audit(page);
  assert.match(await page.locator('[data-course-card="CS101"]').innerText(), /4 \/ 4 available lessons mastered/);
  assert.equal(requests.some(url => /\.(glb|spz)(\?|$)|vendor\/three/.test(url)), false);
  assert.deepEqual(errors, []); await context.close();
  console.log("ok — desktop/mobile WCAG audits, narrow layouts and no 3D dependencies");

  const denied = await browser.newContext({ serviceWorkers: "block" }), deniedPage = await denied.newPage();
  await deniedPage.goto(server.origin + "/missing-test-fixture");
  await deniedPage.evaluate(async () => {
    document.body.innerHTML = '<section id="desk"></section>';
    Storage.prototype.getItem = () => { throw new DOMException("denied", "SecurityError"); };
    const { mountCampusDesk } = await import("./assets/app/campus-desk.mjs");
    mountCampusDesk(document.getElementById("desk"), { state: () => ({}), attend(){}, walk(){}, meet(){} });
    window.dispatchEvent(new CustomEvent("pembroke-save"));
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  assert.equal(await deniedPage.locator(".desk-course").count(), 3);
  await denied.close(); console.log("ok — denied storage cannot trap the campus desk in a render loop");

  const offline = await browser.newContext(), cached = await offline.newPage();
  await cached.goto(server.origin + "/study.html#catalog");
  await cached.evaluate(() => navigator.serviceWorker.ready); await cached.waitForFunction(() => !!navigator.serviceWorker.controller);
  server.close(); await offline.setOffline(true); await cached.reload();
  await cached.waitForSelector('[data-course-card="CS101"]');
  await cached.locator('[data-course-card="CS101"] .course-start').click();
  await cached.waitForSelector("#knowledge");
  await cached.locator("#model").focus(); await cached.keyboard.press("End");
  assert.match(await cached.locator("#readout").innerText(), /Output: 24 4/);
  await cached.reload(); await cached.waitForSelector("#knowledge");
  assert.match(await cached.locator("h1").innerText(), /Values, variables/);
  await offline.close(); console.log("ok — catalog and new programming modules work through a real offline reload");
} finally { await browser.close(); server.close(); }
