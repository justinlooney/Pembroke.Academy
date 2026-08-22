/* The close-up, on whoever is dealt — fast.
 *
 * check-dialogue.mjs spends most of its wall time on two things this
 * does not need: a cold warm-up visit that waits for every stu_ body to
 * decode, and up to eight reloads hunting for ONE named body in a
 * random deal. The question here is not "how does char17 look" but
 * "does a lent clip still put the arms in the wrong place", and any
 * named student answers that.
 *
 *     node tools/probe-convo-shot.mjs [outname]
 *
 * Writes .shots/<outname>.png and prints which body it caught, which
 * clip is playing, and the arm droop it renders at — 0 deg is straight
 * out sideways, which is the T-pose the bodies rest in and the shape
 * the bug leaves them stuck near. */
import { serve, launch } from "./_harness.mjs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const OUT = resolve(new URL("..", import.meta.url).pathname, ".shots");
const NAME = process.argv[2] || "convo-shot";
await mkdir(OUT, { recursive: true });

const { origin, close } = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
/* console.info carries lendClip's own report of the rest difference */
page.on("console", m => { const t = m.text();
  if (/rests differ|labels its sides|could not lend/.test(t)) console.log("  [page] " + t); });

await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 240_000 });
await page.waitForFunction(() => (window.__convo.named() || []).length > 0,
                           null, { timeout: 240_000 });

const who = await page.evaluate(() => {
  const s = window.__convo.named()[0];
  window.__convo.open(s);
  return { name: s.data?.name, body: s.g?.userData?.figure };
});
console.log(`\nclose-up on ${who.name}  (body ${who.body})`);
await page.waitForTimeout(3000);

const read = await page.evaluate(() => {
  const THREE = window.__app.THREE;
  const g = (window.__convo.named().find(s => s.g && s.g.parent &&
             s.g.parent !== window.__app.world) || {}).g;
  if (!g) return { error: "nobody is in the view" };
  g.updateMatrixWorld(true);
  const key = (s) => { s = (s || "").split("|").pop().split(":").pop();
    s = s.replace(/^mixamorig\d*/i, "").replace(/[._]\d+$/, "");
    return s.replace(/[^a-z0-9]/gi, "").toLowerCase(); };
  /* Where the upper arm POINTS, in the world. The rest pose of every
     body on this campus is a T — arms level, droop 0 — so a lent clip
     that leaves them near 0 is a clip still being played against the
     wrong reference. A person standing and talking carries their upper
     arms well down from level. */
  const droop = (side) => {
    let up = null, fore = null;
    g.traverse(o => {
      if (!o.isBone) return;
      const k = key(o.name); if (!k.startsWith(side)) return;
      const r = k.slice(side.length);
      if (!up && /^(arm|upperarm|upper)$/.test(r)) up = o;
      if (!fore && /^(forearm|lowerarm|arm2)$/.test(r)) fore = o;
    });
    if (!up || !fore) return null;
    const a = up.getWorldPosition(new THREE.Vector3());
    const b = fore.getWorldPosition(new THREE.Vector3());
    const v = b.sub(a).normalize();
    return { deg: +(Math.asin(-Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI).toFixed(1),
             bones: up.name + " -> " + fore.name };
  };
  const a = g.userData.anim, act = a && a.actions[a.current];
  return { clip: a?.current || null, paused: act ? act.paused : null,
           bones: (() => { let n = 0; g.traverse(o => { if (o.isBone) n++; }); return n; })(),
           left: droop("left"), right: droop("right") };
});

if (read.error) console.log("  " + read.error);
else {
  console.log(`clip playing:  ${read.clip}   paused=${read.paused}   ${read.bones} bones`);
  const f = (x) => x ? `${x.deg} deg  (${x.bones})` : "no arm bones matched";
  console.log(`left  arm droop below level:  ${f(read.left)}`);
  console.log(`right arm droop below level:  ${f(read.right)}`);
  console.log(`\n  0 deg is the T-pose these bodies rest in. Arms near level while a`);
  console.log(`  standing-talk clip plays is the rest-difference fault; a person`);
  console.log(`  talking carries the upper arms well down from level.`);
}
await page.screenshot({ path: `${OUT}/${NAME}.png`, timeout: 120_000 });
console.log(`\nwrote .shots/${NAME}.png`);
await browser.close(); await close();
