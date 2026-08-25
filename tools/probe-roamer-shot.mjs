#!/usr/bin/env node
/* Photograph a ROAMER on the quad.
 *
 *     node tools/probe-roamer-shot.mjs char16 [outname]
 *
 * probe-convo-shot is the close-up, and it can only reach the NAMED
 * cast: it picks out of window.__convo.named(), opens the conversation
 * view, and photographs a face. That is the right instrument for a
 * faculty body or a student you can talk to, and the wrong one for
 * anybody else -- asked for char16 it spent twelve minutes reporting
 * "never dealt in 4 visits", having looked in a list he is not eligible
 * for. Four visits saw char4, char6, char7, char8, char17 and char18
 * and nobody else, which is the named cast, not the crowd.
 *
 * A swapped body still has to be LOOKED at before it is believed --
 * every character fault in this project was found in a picture and
 * missed first by a measurement. So this finds the body among all the
 * students on the quad, walks the campus camera up to it, and takes the
 * picture there, in the campus's own light, with whatever clip the
 * campus chose to give it running.
 *
 * Prints who was caught and what is driving them. A figure photographed
 * with anim.current === null is a bind pose and says nothing about the
 * retarget, so that is reported rather than quietly photographed. */
import { serve, launch } from "./_harness.mjs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const OUT = resolve(new URL("..", import.meta.url).pathname, ".shots");
const WANT = process.argv[2];
const NAME = process.argv[3] || `roamer-${WANT || "any"}`;
if (!WANT){ console.log("usage: probe-roamer-shot.mjs charN [outname]"); process.exit(1); }

const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));

/* The crowd ramps for minutes AND the body may not be dealt at all, so
 * wait long inside a visit and then try another one. Measured: faculty
 * are on the quad at 40s, char16 not until 150s. */
let found = false, visits = 0;
const VISITS = +(process.env.VISITS || 6);
for (let v = 1; v <= VISITS && !found; v++){
  visits = v;
  await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
  /* Wait for the BODY, not for a clip to be running on it. Gating the
   * wait on anim.current cost six visits of four minutes and produced
   * nothing: detailPass freezes figures far from the camera, so a
   * student who is plainly on the quad can sit with no current action
   * for as long as nobody looks at him. Whether a clip is running is
   * reported below, where a reader can weigh it, instead of silently
   * deciding the body was never there. */
  found = await page.waitForFunction((w) => (window.__students || [])
    .some(s => s.g?.userData?.figure === w) ? true : null,
    WANT, { timeout: 240_000, polling: 3000 }).then(() => true).catch(() => false);
  if (!found){
    const cast = await page.evaluate(() => [...new Set((window.__students || [])
      .map(s => s.g?.userData?.figure))]);
    console.log(`  visit ${v}: no ${WANT} after 4 min — saw [${cast.join(", ")}]`);
  }
}
if (!found){
  console.log(`\n  NO PICTURE — ${WANT} never dealt in ${visits} visits.`);
  await browser.close(); await closeSrv(); process.exit(1);
}

const who = await page.evaluate((w) => {
  const THREE = window.__app.THREE, cam = window.__app.camera;
  const s = (window.__students || []).find(s => s.g?.userData?.figure === w);
  const box = new THREE.Box3().setFromObject(s.g);
  const mid = box.getCenter(new THREE.Vector3());
  const tall = box.max.y - box.min.y;
  /* Stand off in front of the figure at its own scale, a little above
   * the waist, so the framing is the same whatever size the campus
   * scaled this body to. */
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.g.getWorldQuaternion(new THREE.Quaternion()));
  cam.position.copy(mid).addScaledVector(fwd, tall * 1.15).add(new THREE.Vector3(0, tall * 0.18, 0));
  cam.lookAt(mid);
  if (window.__app.controls) window.__app.controls.enabled = false;
  const a = s.g.userData.anim;
  return { body: w, clip: a?.current?.getClip?.().name ?? null,
           roles: { talk: a?.roles?.talk ?? null, idle: a?.roles?.idle ?? null,
                    gaits: a?.roles?.gaits ?? [] } };
}, WANT);

console.log(`\n  on the quad: ${who.body}`);
console.log(`  playing:     ${who.clip ?? "NOTHING — this is a bind pose, not a retargeted one"}`);
console.log(`  roles:       talk=${who.roles.talk}  idle=${who.roles.idle}  gaits=[${who.roles.gaits.join(", ")}]`);
await page.waitForTimeout(1500);
await mkdir(OUT, { recursive: true });
/* 120s, not the 30s default: the campus never goes idle, and a
 * screenshot that races the render loop times out on the first try. */
await page.screenshot({ path: resolve(OUT, `${NAME}.png`), timeout: 120_000 });
console.log(`  -> .shots/${NAME}.png  (found on visit ${visits})`);
await browser.close(); await closeSrv();
