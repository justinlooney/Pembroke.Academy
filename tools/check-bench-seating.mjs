#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve, launch, ROOT } from './_harness.mjs';

const server = await serve(), browser = await launch();
try {
  const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 384, height: 690 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const html = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  await page.route('**/index.html*', r => r.fulfill({ contentType: 'text/html', body:
    html.replace('window.__convo = {', 'window.__benchTest = { prepFigure, makeRoamer, canonBone, stepStudents, castMixers, alignBenchSit, leaveSeat }; window.__convo = {') }));
  await page.goto(server.origin + '/index.html?crowd=0', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 240_000 });
  await page.evaluate(() => __app.renderer.setAnimationLoop(null));
  await page.waitForFunction(() => __roaming.every(k => __rolesOf(k)?.gaits.length) && __seats.length === 10,
    null, { timeout: 300_000 });
  const rows = await page.evaluate(() => {
    const T = __app.THREE, test = __benchTest, rows = [];
    const saved = __students.splice(0), savedSeats = __seats.map(s => s.taken);
    const v = new T.Vector3();
    try {
      for (const [index, k] of __roaming.entries()) {
        const g = test.prepFigure(k, [40, 42, 44][index % 3], false);
        __app.world.add(g);
        const s = test.makeRoamer(g, 'w0', {}), a = g.userData.anim;
        const seat = __seats[index % __seats.length];
        seat.taken = s; s.seat = seat; s.pos = [seat.x, seat.y]; s.mode = 'toseat';
        g.position.set(seat.x - 500, 0, seat.y - 500); g.rotation.y = seat.face;
        a.mixer.update(0.5);
        s.data = saved.find(x => x.data && !x.static)?.data;
        let hips;
        g.traverse(o => { if (o.isBone && test.canonBone(o.name) === 'hips') hips = o; });
        const row = { k, transitions: [], samples: 0, maxError: 0, maxStep: 0, rotations: 0 };
        let now = performance.now(), prior = null, priorMode = '', seatedFrame = 0;
        // Actual production state machine, including a wall clock ten times faster
        // than the clamped mixer. A sit must still finish before the seat is released.
        for (let frame = 0; frame < 3000; frame++) {
          now += frame % 2 ? 1000 / 30 : 1000 / 3;
          test.stepStudents(1 / 30, now);
          a.mixer.update(1 / 30);
          test.alignBenchSit(s);
          hips.getWorldPosition(v);
          if (prior && v.distanceTo(prior) > row.maxStep) { row.maxStep = v.distanceTo(prior); row.jump = {frame, from:priorMode, to:s.mode, before:prior.toArray(), after:v.toArray(), clip:a.current, time:a.actions[a.current].time}; }
          prior = v.clone();
          if (s.mode !== priorMode) { row.transitions.push(s.mode); priorMode = s.mode; }
          if (s.mode === 'seated') {
            // Exact expected centre comes from the rendered bench placement.
            row.maxError = Math.max(row.maxError, Math.hypot(v.x - (seat.x - 500), v.z - (seat.y - 500)));
            row.samples++; seatedFrame++;
            // Exercise every placed orientation with the same evaluated pose.
            if (seatedFrame === 15) {
              // Read the rendered skin over the centre slat, in bench space.
              // This catches a vertically misplaced pelvis even when X/Z is right.
              const skin = [], point = new T.Vector3(), hipY = v.y;
              g.updateMatrixWorld(true);
              g.traverse(o => {
                if (!o.isSkinnedMesh) return;
                o.skeleton.update();
                for (let i = 0; i < o.geometry.attributes.position.count; i++) {
                  o.getVertexPosition(i, point).applyMatrix4(o.matrixWorld);
                  const dx = point.x - seat.x + 500, dz = point.z - seat.y + 500;
                  const x = Math.cos(seat.face) * dx - Math.sin(seat.face) * dz;
                  const z = Math.sin(seat.face) * dx + Math.cos(seat.face) * dz;
                  if (Math.abs(x) < 4.5 && Math.abs(z) < 2.5 && point.y < hipY && point.y > hipY - 8)
                    skin.push(point.y);
                }
              });
              skin.sort((a, b) => a - b);
              row.contactGap = skin.length ? skin[Math.floor(skin.length * 0.02)] - 9.8 : null;
              const savedClip = a.current, savedTime = a.actions[a.current].time;
              const render = __app.renderer.render;
              __app.renderer.render = () => {};
              __convo.open(s); __convo.close();
              __app.renderer.render = render;
              row.conversation = a.current === savedClip && Math.abs(a.actions[savedClip].time - savedTime) < 0.001;
              test.alignBenchSit(s);
              const at = s.seat, pos = s.pos;
              for (const bench of __seats) {
                s.seat = bench; s.pos = [bench.x, bench.y]; test.alignBenchSit(s);
                hips.getWorldPosition(v);
                row.maxError = Math.max(row.maxError, Math.hypot(v.x - bench.x + 500, v.z - bench.y + 500));
                row.rotations++;
              }
              s.seat = at; s.pos = pos; test.alignBenchSit(s);
              prior = hips.getWorldPosition(new T.Vector3());
            }
          }
          if (s.mode === 'walk') {
            row.released = s.seat === null && seat.taken === null && !s.benchBinding;
            row.ground = g.position.y;
            break;
          }
        }
        // Forced removal must also release the reservation and discard calibration state.
        s.seat = seat; seat.taken = s; s.benchBinding = {};
        test.leaveSeat(s);
        row.cancelled = !s.seat && !seat.taken && !s.benchBinding && g.position.y === 0;
        __students.splice(0); g.removeFromParent();
        for (let i = test.castMixers.length - 1; i >= 0; i--)
          if (test.castMixers[i].g === g) test.castMixers.splice(i, 1);
        rows.push(row);
      }
    } finally {
      __students.splice(0, __students.length, ...saved);
      __seats.forEach((s, i) => { s.taken = savedSeats[i]; });
    }
    return rows;
  });
  console.log(JSON.stringify(rows, null, 2));
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(rows.length, 14, 'the complete installed roaming cast must be checked');
  for (const r of rows) {
    assert.deepEqual(r.transitions, ['sitdown', 'seated', 'standup', 'walk'], r.k);
    assert.ok(r.samples >= 15 && r.rotations === 10, `${r.k}: incomplete seating coverage`);
    assert.ok(r.maxError < 0.01, `${r.k}: hips missed the bench by ${r.maxError}`);
    assert.ok(r.maxStep < 3, `${r.k}: pose jumped ${r.maxStep} units in one frame`);
    assert.ok(r.contactGap !== null && Math.abs(r.contactGap) < 2, `${r.k}: skin missed the seat by ${r.contactGap}`);
    assert.ok(r.conversation, `${r.k}: conversation did not restore the seat animation`);
    assert.ok(r.released && r.cancelled && r.ground === 0, `${r.k}: seat or transform was not released`);
  }
  console.log(`All ${rows.length} bodies passed sit, idle, stand and release across all 10 bench orientations.`);
} finally { await browser.close(); server.close(); }
