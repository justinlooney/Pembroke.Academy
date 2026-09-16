#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { serve, launch } from "./_harness.mjs";
import { STUDY } from "../assets/app/course-study.mjs";
import { MATH201_PSET } from "../assets/app/problem-sets.mjs";
const server = await serve(), browser = await launch(["--disable-webgl"]);
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], requests = [];
  page.on("pageerror", e => errors.push(e.message)); page.on("request", r => requests.push(r.url()));
  await page.goto(server.origin + "/study.html");
  await page.waitForSelector("#knowledge");
  assert.match(await page.locator("h1").innerText(), /Expressions and substitution/);
  await page.locator("#knowledge button").click();
  assert.match(await page.locator("#check-status").innerText(), /Nothing has been graded/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pembroke.study")).MATH101.log?.length || 0), 0);
  const first = STUDY.MATH101.units[0].sections[0];
  for (let i = 0; i < first.qs.length; i++) await page.locator(`input[name=kc${i}][value="${first.qs[i].a}"]`).check();
  await page.locator("#knowledge button").click();
  assert.match(await page.locator("#mastery").innerText(), /mastered/);
  await page.reload(); await page.waitForSelector("#knowledge");
  assert.match(await page.locator("#mastery").innerText(), /mastered/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pembroke.study")).MATH101.x["1.1"].kc), 1);
  console.log("ok — complete and resume an introductory lesson without WebGL");
  await page.locator("#course").selectOption("CS101"); await page.waitForFunction(() => location.hash.includes("CS101"));
  await page.waitForFunction(() => document.getElementById("lesson").textContent.includes("Syllabus only"));
  await page.goto(server.origin + "/study.html#course=MATH201&lesson=1.1"); await page.waitForSelector("#knowledge");
  const calculus = STUDY.MATH201.units[0].sections[0];
  for (let i = 0; i < calculus.qs.length; i++) await page.locator(`input[name=kc${i}][value="${calculus.qs[i].a}"]`).check();
  await page.locator("#knowledge button").click();
  assert.match(await page.locator("#mastery").innerText(), /Complete required practice/);
  await page.locator("#practice").click();
  for (const [i, item] of MATH201_PSET["1.1"].entries()){
    if (item.w) continue;
    for (const [key, q] of item.parts ? item.parts.map((q, j) => [`${i}.${j}`, q]) : [[String(i), item]]){
      const host = page.locator(`[data-problem="${key}"]`);
      if (q.type === "mc") await host.locator(`input[value="${q.a}"]`).check();
      else await host.locator('input[type="text"]').fill(String(q.ans));
      await host.locator("[data-check]").click();
    }
  }
  assert.match(await page.locator("#practice-status").innerText(), /lesson mastered/);
  console.log("ok — Calculus mastery requires knowledge checks plus the actual problem set");
  await page.getByRole("button", { name: "Progress & backup" }).click();
  const downloadEvent = page.waitForEvent("download"); await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadEvent; assert.match(download.suggestedFilename(), /pembroke-progress/);
  const backupPath = await download.path();
  await page.locator("#progress-file").setInputFiles(backupPath);
  await page.waitForFunction(() => !document.querySelector("[data-import]").hidden);
  assert.match(await page.locator("[data-preview]").innerText(), /2 mastered lessons/);
  await Promise.all([page.waitForNavigation(), page.locator("[data-import]").click()]);
  await page.waitForSelector("#knowledge"); assert.match(await page.locator("#mastery").innerText(), /mastered/);
  console.log("ok — backup download, validated preview, replacement and reload preserve mastery");
  await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
  assert.deepEqual(violations, []);
  await mkdir(".shots", { recursive: true }); await page.screenshot({ path: ".shots/study-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: ".shots/study-mobile.png", fullPage: true });
  assert.equal(requests.some(url => /\.(glb|spz)(\?|$)|vendor\/three/.test(url)), false);
  assert.deepEqual(errors, []);
  console.log("ok — accessible desktop/mobile layout, no campus model or Three.js requests");
  // Storage can throw even when localStorage exists. The page must remain usable.
  const blocked = await browser.newContext({ serviceWorkers: "block" });
  await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
  const blockedPage = await blocked.newPage(); await blockedPage.goto(server.origin + "/study.html");
  await blockedPage.waitForSelector("#knowledge");
  assert.match(await blockedPage.locator("[data-save-status]").innerText(), /not saved/);
  await blocked.close(); await context.close();
  console.log("ok — save failure is visible while lessons remain usable");
  const offline = await browser.newContext();
  const cached = await offline.newPage();
  await cached.goto(server.origin + "/missing-seed-page");
  await cached.evaluate(async () => { await caches.open("other-app-cache"); await caches.open("pembroke-v150-shell"); });
  await cached.goto(server.origin + "/study.html");
  await cached.evaluate(() => navigator.serviceWorker.ready);
  await cached.waitForFunction(() => !!navigator.serviceWorker.controller);
  const names = await cached.evaluate(() => caches.keys());
  assert.ok(names.includes("other-app-cache")); assert.equal(names.includes("pembroke-v150-shell"), false);
  server.close(); // A real host outage also affects service-worker fetches.
  await offline.setOffline(true); await cached.reload(); await cached.waitForSelector("#knowledge");
  assert.match(await cached.locator("body").innerText(), /Viewing a saved copy/);
  assert.match(await cached.locator("h1").innerText(), /Expressions and substitution/);
  await offline.close();
  console.log("ok — real service-worker installation preserves foreign caches and supports offline lessons");

} finally { await browser.close(); server.close(); }
