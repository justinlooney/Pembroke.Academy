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

/* FOLLOW him for a few seconds rather than placing the camera once.
 *
 * The first version set camera.position and lookAt in a single
 * evaluate, disabled OrbitControls, and photographed the aerial view
 * of the quad it started on -- the campus writes the camera back every
 * frame (controls.update at the bottom of the loop, plus the sector
 * flight lerp), so a one-shot placement lasts exactly until the next
 * rAF. Disabling controls does not help, because the flight sets
 * camera.position directly.
 *
 * ?bench would hand the camera over, but it also freezes every student
 * where they stand, which is the opposite of what a picture of a body
 * in motion needs.
 *
 * So this pins the camera from a rAF of its own, ahead of nothing and
 * behind everything: whatever the campus did to the camera this frame
 * is overwritten before it is drawn. The target is the figure's own
 * moving centre, so it is a follow camera, not a fixed one -- he walks,
 * and a camera parked where he was is a picture of a lawn.
 *
 * Getting close also un-freezes him: detailPass switches a figure's
 * mixer off past k/ANIMATE_PX from the camera, which is why the
 * one-shot version reported "NOTHING playing" -- it read the animation
 * state of a figure that was still a hundred units away. */
await page.evaluate((w) => {
  const THREE = window.__app.THREE, cam = window.__app.camera;
  const ctl = window.__app.controls;
  const mid = new THREE.Vector3(), fwd = new THREE.Vector3(),
        up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(),
        corner = new THREE.Vector3();
  const box = new THREE.Box3();
  const place = () => {
    const s = (window.__students || []).find(s => s.g?.userData?.figure === w);
    if (!s?.g) return;
    box.setFromObject(s.g);
    box.getCenter(mid);
    const tall = box.max.y - box.min.y;
    fwd.set(0, 0, 1).applyQuaternion(s.g.getWorldQuaternion(q));
    /* FIT the figure, do not assume a standoff fits it.
     *
     * A fixed tall * 1.05 framed two bodies and cut a third in half at
     * the left edge of the canvas. lookAt(mid) puts the box CENTRE at
     * the middle of the frame, which says nothing about whether the
     * rest of the body is inside it: the campus canvas is a fraction of
     * the window, its aspect is nothing like square, and a walking
     * figure is wider than a standing one. Guessing a larger constant
     * would have framed this one and cut the next.
     *
     * So project all eight corners of her own bounding box, and step
     * back until every one is inside the frame with a margin. The
     * numbers are reported, so a picture that could not be framed says
     * so rather than looking like a body that walked out of shot. */
    fwd.applyAxisAngle(up, window.__viewTurn || 0);
    /* FIT the figure, do not assume a standoff fits it.
     *
     * A fixed tall * 1.05 framed two bodies and cut a third in half at
     * the left edge of the canvas. lookAt(mid) puts the box CENTRE at
     * the middle of the frame, which says nothing about whether the
     * rest of the body is inside it: the campus canvas is a fraction of
     * the window, its aspect is nothing like square, and a walking
     * figure is wider than a standing one. Guessing a larger constant
     * would have framed this one and cut the next. So project all eight
     * corners of her own bounding box and step back until every one is
     * inside the frame with a margin. */
    let far = tall * 1.05, worst = 0;
    for (let attempt = 0; attempt < 12; attempt++){
      cam.position.copy(mid).addScaledVector(fwd, far).addScaledVector(up, tall * 0.15);
      cam.lookAt(mid);
      cam.updateMatrixWorld(true);
      worst = 0;
      for (let i = 0; i < 8; i++){
        corner.set(i & 1 ? box.max.x : box.min.x,
                   i & 2 ? box.max.y : box.min.y,
                   i & 4 ? box.max.z : box.min.z).project(cam);
        worst = Math.max(worst, Math.abs(corner.x), Math.abs(corner.y));
      }
      if (worst <= 0.82) break;
      far *= worst / 0.75;
    }
    if (ctl) ctl.target.copy(mid);
    window.__follow = { tall: +tall.toFixed(2),
                        dist: +cam.position.distanceTo(mid).toFixed(1),
                        fill: +worst.toFixed(2), turn: window.__viewTurn || 0 };
  };
  /* Run LAST, by going through the same function the campus does.
   *
   * A rAF of its own is not last: the loop's own rAF was registered
   * first, so each frame is [campus updates and draws][probe moves the
   * camera], and the move is undone before it is ever drawn. Setting
   * the camera from outside the loop has the same fate.
   *
   * Nor is moving the camera alone enough even inside the loop.
   * OrbitControls.update() does not read camera.position, it WRITES
   * it -- from a spherical offset it keeps around its own target. So a
   * probe that sets position and target got the direction it asked for
   * and the campus's zoom: an aerial shot of the quad, correctly
   * centred on a student too far away to make out.
   *
   * Wrapping update() puts the placement after the controls have had
   * their say and before the renderer draws, which is the one moment
   * in the frame where the camera is ours. */
  if (ctl){ const orig = ctl.update.bind(ctl); ctl.update = (...a) => { const r = orig(...a); place(); return r; }; }

  /* IN FRAME IS NOT IN SIGHT.
   *
   * The fit check above passed on a photograph of a tree trunk. Every
   * corner of the body's box was inside the frustum and the body was
   * behind a trunk the whole time — projection cannot see occluders, so
   * a tool that stops at "it fits" will keep producing pictures of
   * scenery and calling them verified.
   *
   * So cast one ray from the camera to the figure and ask what it hits
   * FIRST. If the answer is not the figure, turn a third of the way
   * round the quad and ask again. Eight of those cover the circle; the
   * standoff refits at each because a trunk in the way is often a wall
   * a step later. */
  /* setFromCamera, not set(origin, dir): Sprite.raycast reads
   * raycaster.camera and throws without it, and only setFromCamera
   * fills it in. Filtering sprites out of the RESULTS is too late — the
   * throw happens during the traversal. Casting through NDC (0,0) is
   * the same ray anyway, because lookAt(mid) put the figure's centre at
   * the middle of the picture. */
  const ray = new THREE.Raycaster();
  const centre = new THREE.Vector2(0, 0);
  window.__clearView = () => {
    const s = (window.__students || []).find(s => s.g?.userData?.figure === w);
    if (!s?.g) return null;
    const isMine = (o) => { for (let n = o; n; n = n.parent) if (n === s.g) return true; return false; };
    for (let step = 0; step < 8; step++){
      window.__viewTurn = step * Math.PI / 4;
      place();
      box.setFromObject(s.g); box.getCenter(mid);
      cam.updateMatrixWorld(true);
      ray.setFromCamera(centre, cam);
      ray.far = cam.position.distanceTo(mid) * 1.4;
      const hit = ray.intersectObject(window.__app.world, true)
                     .find(h => h.object.visible && h.object.type !== "Sprite");
      if (!hit || isMine(hit.object))
        return { turn: step, blockedBy: null, ...window.__follow };
      var last = hit.object.name || hit.object.type;
    }
    window.__viewTurn = 0; place();
    return { turn: -1, blockedBy: last || "something", ...window.__follow };
  };
  place();
}, WANT);

/* NOW wait for a clip, with the camera already on him.
 *
 * The order matters and both other orders are wrong. Waiting for a clip
 * BEFORE moving the camera is the gate that cost six blank visits:
 * detailPass holds the mixer of any figure past k/ANIMATE_PX, so a
 * student who is plainly on the quad reads as having nothing running
 * until something looks at him. Not waiting at all is the other
 * failure: the body exists some seconds before the campus has lent it
 * anything, and a shot taken then is a bind pose with every role null,
 * which is exactly the picture this tool exists to not take.
 *
 * With the camera already on him, detailPass hands his mixer back and
 * the wait is short. */
const running = await page.waitForFunction((w) => {
  const s = (window.__students || []).find(s => s.g?.userData?.figure === w);
  return s?.g?.userData?.anim?.current ? true : null;
}, WANT, { timeout: 90_000, polling: 1000 }).then(() => true).catch(() => false);
await page.waitForTimeout(2500);   /* and past the clip's first frames */

const who = await page.evaluate((w) => {
  const s = (window.__students || []).find(s => s.g?.userData?.figure === w);
  const a = s?.g?.userData?.anim;
  /* anim.current is the clip's NAME, a string -- not an AnimationAction.
   * Reading it as an action and asking for getClip() returned undefined
   * for every body, so the first version of this reported "NOTHING
   * playing, this is a bind pose" over a photograph of a student
   * plainly mid-stride. */
  return { body: w, clip: a?.current ?? null,
           animate: !!s?.g?.userData?.animate,
           roles: { talk: a?.roles?.talk ?? null, idle: a?.roles?.idle ?? null,
                    gaits: a?.roles?.gaits ?? [] } };
}, WANT);

console.log(`\n  on the quad: ${who.body}`);
console.log(`  playing:     ${who.clip ?? "NOTHING — this is a bind pose, not a retargeted one"}`
            + `${who.clip && !who.animate ? "  (but detailPass has his mixer held)" : ""}`);
if (!running) console.log(`  NO CLIP EVER STARTED with the camera on him — the picture below`
                          + `\n  says nothing about the retarget.`);
console.log(`  roles:       talk=${who.roles.talk}  idle=${who.roles.idle}  gaits=[${who.roles.gaits.join(", ")}]`);
const fit = await page.evaluate(() => window.__clearView());
if (fit) console.log(`  framing:     ${fit.fill <= 0.82 ? "fits the frame" : "DOES NOT FIT — the figure is cut off"}`
                     + `, ${fit.turn >= 0 ? (fit.turn ? `clear from ${fit.turn * 45}° round` : "clear head-on")
                        : `STILL BLOCKED by ${fit.blockedBy} from all 8 angles`}`
                     + `  (worst corner ${fit.fill}, standoff ${fit.dist})`);
await page.waitForTimeout(600);   /* let the moved camera settle before capture */
await mkdir(OUT, { recursive: true });
/* 120s, not the 30s default: the campus never goes idle, and a
 * screenshot that races the render loop times out on the first try. */
await page.screenshot({ path: resolve(OUT, `${NAME}.png`), timeout: 120_000 });
console.log(`  -> .shots/${NAME}.png  (found on visit ${visits})`);
await browser.close(); await closeSrv();
