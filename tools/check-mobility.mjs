#!/usr/bin/env node
// Jun must actually travel, not merely own a clip named "Walk".
import assert from "node:assert/strict";
import { serve, launch } from "./_harness.mjs";

const server = await serve(), browser = await launch();
try {
  const page = await browser.newPage({ serviceWorkers: "block",
    viewport: { width: 384, height: 690 }, isMobile: true, hasTouch: true });
  await page.goto(server.origin + "/?crowd=0", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.__convo && window.__sim &&
    window.__convo.named().some(s => s.data.name === "Jun"), null, { timeout: 300000 });
  const result = await page.evaluate(() => {
    const s = __convo.named().find(s => s.data.name === "Jun");
    if (s.static) return { static: true };
    const start = [...s.pos];
    let distance = 0, previous = [...s.pos], gaitFrames = 0, frozenGaitFrames = 0;
    const position = s.g.position, original = position.set;
    position.set = function(...args){
      const travelled = Math.hypot(s.pos[0] - previous[0], s.pos[1] - previous[1]);
      // Ignore an indoor respawn: count ordinary walking steps only.
      if (travelled > 0 && travelled < 10 && !s.inside){
        distance += travelled;
        const a = s.g.userData.anim, action = a?.actions[a.current];
        if (s.roles.gaits.includes(a?.current)){
          gaitFrames++;
          if (!action || action.paused || !action.enabled || !action.isRunning()) frozenGaitFrames++;
        }
      }
      previous = [...s.pos];
      return original.apply(this, args);
    };
    try { __sim(7200, 1 / 30); } finally { position.set = original; }
    return { static: false, distance, gaitFrames, frozenGaitFrames, start, end: s.pos };
  });
  assert.equal(result.static, false, "Jun must enter the roaming state machine");
  assert.ok(result.distance > 30, `Jun must walk more than 30 route units: ${JSON.stringify(result)}`);
  assert.ok(result.gaitFrames > 30, "movement must use an actual gait, not an idle pose");
  assert.equal(result.frozenGaitFrames, 0, "a travelling Jun must not have a paused gait");
  console.log("ok — Jun walks with a running gait: " + JSON.stringify(result));
} finally { await browser.close(); server.close(); }
