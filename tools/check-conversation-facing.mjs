#!/usr/bin/env node
// Exercise the real conversation open/frame/close path on every campus body.
// Measure upper-body direction independently of the production tracker; never
// count a missing landmark as a pass. No screenshots or repository writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { serve, launch, ROOT } from './_harness.mjs';
const html = await readFile(ROOT + '/index.html', 'utf8');
const seam = 'window.__convo = {';
assert.ok(html.includes(seam), 'locate the conversation test seam');
const server = await serve(), browser = await launch();
try {
  const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 384, height: 690 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.text().startsWith('facing:')) console.log(m.text()); });
  await page.route('**/index.html*', route => route.fulfill({ contentType: 'text/html', body: html.replace(seam,
    'window.conversationTest = { prepFigure, makeRoamer, setClipOn, holdStance, canonBone, convoFrame, castMixers }; ' + seam) }));
  await page.goto(server.origin + '/index.html?crowd=0', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 240000 });
  // The animation clock is under test, not software-rasterizer throughput.
  // Stop automatic frames; retain the real DOM handlers and animation path.
  await page.evaluate(() => __app.renderer.setAnimationLoop(null));
  await page.waitForFunction(() => __roaming.every(k => __rolesOf(k)?.gaits.length), null, { timeout: 300000 });
  for (const viewport of [{ width: 384, height: 690 }, { width: 1100, height: 800 }]){
    await page.setViewportSize(viewport);
    const rows = await page.evaluate(() => {
      const T = __app.THREE, test = conversationTest, rows = [];
      const render = __app.renderer.render;
      __app.renderer.render = () => {};
      const persona = __convo.named()[0].data;
      for (const key of __roaming){
        const g = test.prepFigure(key, 42, true);
        if (!g) throw new Error('Missing figure ' + key);
        __app.world.add(g);
        const s = test.makeRoamer(g, 'w0', { data: persona });
        const a = g.userData.anim, bones = new Map();
        g.traverse(o => { if (o.isBone) bones.set(test.canonBone(o.name), o); });
        const left = bones.get('leftarm'), right = bones.get('rightarm');
        if (!left || !right) throw new Error('Missing chest measurement ' + key);
        const head = bones.get('head');
        let headForward = null;
        g.traverse(mesh => {
          if (!mesh.isSkinnedMesh || headForward) return;
          const index = mesh.skeleton.bones.indexOf(head);
          if (index < 0) return;
          const q = new T.Quaternion();
          new T.Matrix4().copy(mesh.skeleton.boneInverses[index]).invert()
            .decompose(new T.Vector3(), q, new T.Vector3());
          headForward = new T.Vector3(0, 0, 1).applyQuaternion(q.invert());
        });
        if (!head || !headForward) throw new Error('Missing head measurement ' + key);
        const measureHead = () => {
          const direction = headForward.clone().applyQuaternion(head.getWorldQuaternion(new T.Quaternion()));
          const target = __convo.cam().position.clone().sub(head.getWorldPosition(new T.Vector3()));
          direction.y = target.y = 0;
          return direction.angleTo(target) * 180 / Math.PI;
        };
        // Current cast labels are anatomically consistent. This independent
        // normal must point at the lens; abs(dot) would also pass a BACK view.
        const measure = () => {
          g.updateMatrixWorld(true);
          const l = left.getWorldPosition(new T.Vector3()), r = right.getWorldPosition(new T.Vector3());
          const across = l.clone().sub(r);
          const forward = new T.Vector3(-across.z, 0, across.x);
          const camera = __convo.cam();
          if (!camera?.isPerspectiveCamera) throw new Error('Missing conversation camera');
          const target = camera.getWorldPosition(new T.Vector3()).sub(l.add(r).multiplyScalar(.5));
          target.y = 0;
          if (!forward.lengthSq() || !target.lengthSq()) throw new Error('Degenerate chest measurement');
          return forward.angleTo(target) * 180 / Math.PI;
        };
        try {
          for (const entry of ['walk', 'standing', 'seated']){
            const clip = entry === 'walk' ? s.roles.gaits[0] : entry === 'seated' ? s.roles.seat : s.roles.talk;
            if (!clip) continue;
            a.mixer.stopAllAction(); a.current = null;
            test.setClipOn(g, clip, 0); a.mixer.update(.7);
            s.static = entry === 'standing'; s.held = s.static;
            if (s.static) test.holdStance(g);
            g.position.set(70, 0, -35); g.rotation.y = 2.7;
            g.userData.animate = false;
            const parent = g.parent, home = g.position.clone(), yaw = g.rotation.y;
            const culling = g.userData.meshes.map(m => m.frustumCulled);
            __convo.open(s);
            const startError = measure(), startTime = a.mixer.time;
            let worst = startError, worstHead = 0, samples = 1;
            const duration = Math.max(12, a.actions[a.current].getClip().duration * 2);
            // Skip draws while advancing the real frame function: no fake
            // mixer or copy of the orientation code is involved.
            for (let i = 0; i < Math.ceil(duration * 30); i++){
              test.convoFrame(1 / 30);
              const angle = measure();
              if (!Number.isFinite(angle)) throw new Error('Invalid angle ' + key);
              worst = Math.max(worst, angle); worstHead = Math.max(worstHead, measureHead()); samples++;
            }
            const moving = a.mixer.time > startTime + duration - .1 && !a.actions[a.current].paused;
            // Settle the final pose, then leave via the user-facing button.
            test.convoFrame(0);
            [...document.querySelectorAll('#convo button')].find(b => /Leave/.test(b.textContent))?.click();
            const restored = !__convo.on() && g.parent === parent && g.position.equals(home) &&
              g.rotation.y === yaw && g.userData.animate === false &&
              g.userData.meshes.every((m, i) => m.frustumCulled === culling[i]);
            rows.push({ key, entry, startError, worst, worstHead, samples, moving, restored });
            if (__convo.on()) __convo.close();
          }
        } finally {
          if (__convo.on()) __convo.close();
          g.removeFromParent();
          __students.splice(__students.indexOf(s), 1);
          for (let i = test.castMixers.length - 1; i >= 0; i--)
            if (test.castMixers[i].g === g) test.castMixers.splice(i, 1);
        }
        console.log('facing: ' + key + ' checked');
      }
      __app.renderer.render = render;
      return { rows, expected: __roaming.length };
    });
    assert.equal(new Set(rows.rows.map(r => r.key)).size, rows.expected);
    assert.ok(rows.expected >= 14, 'exercise the entire current cast');
    for (const r of rows.rows){
      assert.ok(r.startError < 3, 'opening pose: ' + JSON.stringify(r));
      assert.ok(r.worst < 12, 'throughout both animation loops: ' + JSON.stringify(r));
      assert.ok(r.worstHead < 22, 'head must also face the viewer: ' + JSON.stringify(r));
      assert.ok(r.moving, 'talking animation must advance: ' + JSON.stringify(r));
      assert.ok(r.restored, 'Leave must restore the campus figure: ' + JSON.stringify(r));
    }
    console.log(`ok — ${viewport.width}×${viewport.height}: ${rows.expected} models, ${rows.rows.length} conversations, ${rows.rows.reduce((n, r) => n + r.samples, 0)} samples; worst torso ${Math.max(...rows.rows.map(r => r.worst)).toFixed(2)}°, head ${Math.max(...rows.rows.map(r => r.worstHead)).toFixed(2)}°`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); server.close(); }
