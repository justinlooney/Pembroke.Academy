/* Which bones does a lent clip actually write?
 *
 *     node tools/probe-clip-tracks.mjs [figure]
 *
 * canonBone has an explicit branch for this rig — Pelvis/Chest/
 * Clavicle/UpperArm/Thigh/Shin/Toe onto hips/chest/shoulder/arm/upleg/
 * leg/toebase — so on READING, every bone pairs with its Mixamo
 * counterpart. Reading is what has been wrong four times in this bug,
 * so this asks the file instead.
 *
 * A clip's tracks name their targets. Listing them shows exactly which
 * of the receiver's bones are driven and which are left holding their
 * rest angle while their parents move, which is a fault that produces
 * poses that are anatomically possible and still wrong. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv[2] || "char17";
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__castLib, null, { timeout: 240_000 });
await page.waitForFunction((w) => (window.__castLib || {})[w] ? true : null,
                           WANT, { timeout: 300_000 }).catch(() => {});
/* the lend happens when a body is dealt to somebody, so wait for one */
await page.waitForFunction((w) => {
  const s = (window.__students || []).find(x => x.g?.userData?.figure === w);
  return s && s.g?.userData?.anim?.actions &&
         Object.keys(s.g.userData.anim.actions).length ? true : null;
}, WANT, { timeout: 300_000 }).catch(() => {});

const out = await page.evaluate((want) => {
  const s = (window.__students || []).find(x => x.g?.userData?.figure === want);
  if (!s) return { error: `${want} is not out today` };
  const anim = s.g.userData.anim;
  if (!anim || !anim.actions) return { error: `${want} has no actions` };
  const bones = [];
  s.g.traverse(o => { if (o.isBone) bones.push(o.name); });
  const clips = {};
  for (const [name, act] of Object.entries(anim.actions)){
    const clip = act.getClip();
    const targets = clip.tracks.map(t => ({
      bone: t.name.split(".")[0], prop: t.name.split(".").pop() }));
    const written = new Set(targets.filter(t => t.prop === "quaternion").map(t => t.bone));
    clips[name] = { tracks: clip.tracks.length, duration: +clip.duration.toFixed(2),
                    rotated: [...written],
                    untouched: bones.filter(b => !written.has(b)) };
  }
  return { bones, clips, current: anim.current, roles: s.roles || null };
}, WANT);

if (out.error){ console.log("  " + out.error); }
else {
  console.log(`\n${WANT}: ${out.bones.length} bones, current clip "${out.current}"`);
  for (const [name, c] of Object.entries(out.clips)){
    console.log(`\n  clip "${name}"  ${c.tracks} tracks  ${c.duration}s`);
    console.log(`    rotates ${c.rotated.length} of ${out.bones.length} bones`);
    if (c.untouched.length)
      console.log(`    NEVER ROTATED (${c.untouched.length}): ${c.untouched.join(", ")}`);
    else
      console.log(`    every bone is driven`);
  }
  const worst = Object.entries(out.clips)
    .map(([n, c]) => ({ n, miss: c.untouched.length }))
    .sort((a, b) => b.miss - a.miss)[0];
  console.log(worst && worst.miss
    ? `\n  Bones with no rotation track hold their REST angle while their parents`
      + `\n  move. On a T-pose rig that means arms held out sideways through the`
      + `\n  whole clip. Worst here: "${worst.n}" leaves ${worst.miss} bones behind.`
    : `\n  Every clip drives every bone — an unpaired bone is NOT the fault.`);
}
await browser.close(); await closeSrv();
