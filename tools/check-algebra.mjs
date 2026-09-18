#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {serve,launch,ROOT} from './_harness.mjs';
import {INTRO_MATH} from '../assets/app/intro-math.mjs';
const sections=INTRO_MATH.units.flatMap(u=>u.sections), server=await serve(), browser=await launch(['--disable-webgl']);
try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const open=async n=>{const sec=sections.find(s=>s.n===n);await page.goto(server.origin+'/study.html#course=MATH101&lesson='+n);await page.waitForFunction(title=>document.querySelector('h1')?.textContent===title,sec.t);return sec;};
  for(const sec of sections){
    await open(sec.n);
    const text=await page.locator('#lesson').innerText();
    for(const [,paragraph] of sec.full.lecture)assert.ok(text.includes(paragraph),sec.n+' must preserve the complete prose and inequality signs');
    assert.equal(await page.locator('.worked-example').count(),1+(sec.full.examples?.length||0));
    assert.equal(await page.locator('#figure').count(),Number(!!sec.full.viz));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,sec.n+' overflows mobile');
    if(sec.full.practice){await page.locator('#practice').click();assert.equal(await page.locator('[data-problem]').count(),sec.full.practice.length,sec.n);}
  }
  console.log('ok — all 74 pages and every required practice set render on a phone, preserving complete math text');
  await open('P.1');await page.locator('#lesson-search').fill('matrices');
  assert.equal(await page.locator('#lessons a:visible').count(),5);
  await page.locator('#lessons a').filter({hasText:'Inverse matrices'}).click();
  await page.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('Inverse matrices'));
  assert.match(await page.locator('h1').innerText(),/Inverse matrices/);
  assert.ok(await page.locator('#lesson').evaluate(el=>Math.abs(el.getBoundingClientRect().top)<=32),'new lesson starts at the top');
  await page.locator('#lesson-search').fill('no-such-topic-xyz');assert.match(await page.locator('#contents-status').innerText(),/^0 lessons/);
  await page.locator('#lesson-search').fill('');assert.equal(await page.locator('#lessons .chapter').count(),13);
  console.log('ok — searchable chapters, empty search, selected lesson, and collapsed contents');
  const sec=await open('1.8');
  await page.locator('[data-turn="0"] [data-solution]').click();assert.match(await page.locator('[data-turn="0"] .feedback').innerText(),/reverse/);
  for(const [i,q] of sec.qs.entries())await page.locator(`input[name=kc${i}][value="${q.a}"]`).check();
  await page.locator('#knowledge button').click();assert.match(await page.locator('#mastery').innerText(),/Complete required practice/);
  await page.locator('#practice').click();
  const first=page.locator('[data-problem="0"]');await first.locator('[data-hint]').click();await first.locator('[data-hint]').click();
  await first.locator('input').fill('-4');await first.locator('[data-check]').click();assert.match(await first.locator('.feedback').innerText(),/solution was shown/);
  const needed=Math.ceil(.75*sec.full.practice.length);
  for(let i=1;i<needed;i++){const host=page.locator(`[data-problem="${i}"]`);await host.locator('input').fill(String(sec.full.practice[i].ans));await host.locator('[data-check]').click();}
  assert.doesNotMatch(await page.locator('#practice-status').innerText(),/practice cleared/);
  const last=page.locator(`[data-problem="${needed}"]`);await last.locator('input').fill(String(sec.full.practice[needed].ans));await last.locator('[data-check]').click();
  assert.match(await page.locator('#practice-status').innerText(),/lesson mastered/);
  await page.locator('#back').click();await page.reload();await page.waitForSelector('#knowledge');assert.match(await page.locator('#mastery').innerText(),/Lesson mastered/);
  console.log('ok — revealed answers do not earn credit, 75% practice plus checks earns mastery, and reload preserves it');
  await open('PR.3');await page.locator('[data-turn="0"] input').fill('1/6');await page.locator('[data-turn="0"] button').first().click();assert.match(await page.locator('[data-turn="0"] .feedback').innerText(),/✓/);
  await page.locator('#homework').click();const qs=sections.find(s=>s.n==='PR.3').full.homework.gen.map(fn=>fn());
  for(const [i,q] of qs.entries())await page.locator(`[data-hw="${i}"] input`).fill(String(q.ans));
  await page.locator('form button').click();assert.match(await page.locator('#hw-status').innerText(),/4\/4 correct/);assert.match(await page.locator('[data-hw="3"] .feedback').innerText(),/3\/8/);
  await open('FINAL.1');assert.equal(await page.getByRole('link',{name:'Next lesson →',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'← Previous lesson',exact:true}).count(),1);
  console.log('ok — fraction input, explained homework, and final-course navigation');
  await open('1.10');await page.locator('#lesson-search').fill('variation');
  const variationLink=page.locator('#lessons a').filter({hasText:'Modeling variation:'});assert.equal(await variationLink.count(),1);
  await variationLink.click();await page.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('Modeling variation:'));
  assert.match(await page.locator('#lesson').innerText(),/Combining different types of variation/);
  assert.equal(await page.locator('.worked-example').count(),4);
  await page.locator('.worked-example details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  assert.match(await page.locator('#lesson').innerText(),/6\(2\/3\) = 4/);
  await page.locator('#practice').click();assert.equal(await page.locator('[data-problem]').count(),10);
  const scaling=page.locator('[data-problem="8"]');await scaling.locator('input').fill('1/2');await scaling.locator('[data-check]').click();assert.match(await scaling.locator('.feedback').innerText(),/✓/);
  await page.locator('#back').click();await page.locator('#homework').click();
  const variationHomework=sections.find(s=>s.n==='1.11').full.homework.gen.map(fn=>fn());
  for(const [i,q] of variationHomework.entries())await page.locator(`[data-hw="${i}"] input`).fill(String(q.ans));
  await page.locator('form button').click();assert.match(await page.locator('#hw-status').innerText(),/8\/8 correct/);
  console.log('ok — Chapter 1 variation is searchable, teaches all models, and grades fractions and homework');
  await open('CO.2');await page.locator('[data-jump="explore-heading"]').click();await page.locator('#model').fill('1000');assert.match(await page.locator('#readout').innerText(),/b=4.50/);
  await page.addScriptTag({path:resolve(ROOT,'node_modules/axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
  if(process.env.PEMBROKE_CAPTURE_DIR){const dir=process.env.PEMBROKE_CAPTURE_DIR;await mkdir(dir,{recursive:true});await page.screenshot({path:resolve(dir,'algebra-conic-mobile.png')});await open('1.11');await page.locator('h1').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(dir,'chapter-one-variation-mobile.png')});await page.locator('.worked-example').last().scrollIntoViewIfNeeded();await page.locator('.worked-example').last().locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));await page.screenshot({path:resolve(dir,'chapter-one-example-mobile.png')});await page.setViewportSize({width:1440,height:960});await open('1.5');await page.locator('h1').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(dir,'chapter-one-quadratics-desktop.png')});}
  console.log('ok — interactive conic diagram and mobile accessibility audit');
  await context.close();
  const offline=await browser.newContext(),cached=await offline.newPage();await cached.goto(server.origin+'/study.html#course=MATH101&lesson=P.1');
  await cached.evaluate(()=>navigator.serviceWorker.ready);await cached.waitForFunction(()=>!!navigator.serviceWorker.controller);
  server.close();await offline.setOffline(true);await cached.goto(server.origin+'/study.html#course=MATH101&lesson=MX.4');await cached.reload();await cached.waitForSelector('#knowledge');
  assert.match(await cached.locator('h1').innerText(),/Inverse matrices/);await cached.locator('#practice').click();assert.equal(await cached.locator('[data-problem]').count(),6);
  await cached.goto(server.origin+'/study.html#course=MATH101&lesson=1.11');await cached.reload();await cached.waitForSelector('#knowledge');
  assert.match(await cached.locator('#lesson').innerText(),/Combining different types of variation/);await cached.locator('#practice').click();assert.equal(await cached.locator('[data-problem]').count(),10);
  await offline.close();console.log('ok — an advanced algebra chapter and its practice work after a real host outage');
}finally{await browser.close();server.close();}
