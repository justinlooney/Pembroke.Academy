/* Do the donors and the receivers REST in the same shape?
 *
 * Delta retargeting transfers "change from rest". If the two rests are
 * different POSES rather than merely different bases, that difference
 * is added to every frame of every lent clip. This measures the one
 * number that decides it: the world-space direction of each arm at
 * rest, on every donor and every body.
 *
 * It also prints the bone names it matched on. The first version of
 * this waited four minutes on `window.THREE`, which the page does not
 * expose — so the hook is asserted here in seconds, with the names
 * printed beside the reading, rather than guessed at and waited on. */
import { serve, launch } from "./_harness.mjs";
const { origin, close } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });

/* The hook, asserted fast and named when it is missing. */
try {
  await page.waitForFunction(() => window.__app && window.__app.THREE, null, { timeout: 90_000 });
} catch {
  const hooks = await page.evaluate(() => Object.keys(window).filter(k => /^__/.test(k)).sort());
  console.log("window.__app.THREE never appeared. Hooks present: " + hooks.join(", "));
  await browser.close(); await close(); process.exit(1);
}

const out = await page.evaluate(async () => {
  const THREE = window.__app.THREE;
  const { GLTFLoader } =
    await import("./assets/vendor/three/examples/jsm/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  const load = (u) => new Promise((res, rej) => loader.load(u, res, undefined, rej));

  const key = (s) => { s = (s || "").split("|").pop().split(":").pop();
    s = s.replace(/^mixamorig\d*/i, "").replace(/[._]\d+$/, "");
    return s.replace(/[^a-z0-9]/gi, "").toLowerCase(); };

  /* Tolerant on naming: the donors are Mixamo (LeftArm / LeftForeArm)
     and the production rig may not be. Upper arm is whatever names the
     side and an arm without saying fore/lower; the next link is the
     one that does. */
  const findArm = (root, side) => {
    let up = null, fore = null;
    root.traverse(o => {
      if (!o.isBone) return;
      const k = key(o.name);
      if (!k.startsWith(side)) return;
      const rest = k.slice(side.length);
      if (!up && /^(arm|upperarm|upper|shoulderarm)$/.test(rest)) up = o;
      if (!fore && /^(forearm|lowerarm|elbow|arm2|forearmtwist)$/.test(rest)) fore = o;
    });
    return [up, fore];
  };

  /* Bone DIRECTION, not quaternion: direction is basis-independent —
     it is where the limb points, which is what "the same shape" means
     across two rigs that disagree about their axes. */
  const armOf = (root, side) => {
    root.updateMatrixWorld(true);
    const [up, fore] = findArm(root, side);
    if (!up || !fore) return null;
    const a = up.getWorldPosition(new THREE.Vector3());
    const b = fore.getWorldPosition(new THREE.Vector3());
    const v = b.sub(a).normalize();
    return { droopDeg: +(Math.asin(-Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI).toFixed(1),
             bones: up.name + " -> " + fore.name };
  };

  const rows = [];
  const donors = ["assets/clip_talkstand.glb", "assets/clip_walkf_1.glb",
                  "assets/clip_sitidle.glb", "assets/clip_standup.glb",
                  "assets/clip_jog.glb", "assets/clip_sit.glb"];
  const bodies = ["assets/stu_char17.glb", "assets/stu_char2.glb",
                  "assets/stu_char15.glb", "assets/stu_char18.glb"];
  for (const u of [...donors, ...bodies]){
    try {
      const g = await load(u);
      const bones = [];
      g.scene.traverse(o => { if (o.isBone) bones.push(o.name); });
      rows.push({ file: u.split("/").pop(), kind: u.includes("clip_") ? "donor" : "body",
                  clips: g.animations.length, boneCount: bones.length,
                  bones: bones.slice(0, 40),
                  left: armOf(g.scene, "left"), right: armOf(g.scene, "right") });
    } catch (e){ rows.push({ file: u, error: String(e).slice(0, 90) }); }
  }
  return rows;
});

console.log("\narm droop at REST — 0 deg = straight out (T-pose), 90 deg = hanging down\n");
let unmatched = null;
for (const r of out){
  if (r.error){ console.log(`  ${r.file}  ERROR ${r.error}`); continue; }
  const f = (a) => a ? `${a.droopDeg}`.padStart(6) + " deg" : "   no arm bones";
  console.log(`  ${r.kind.padEnd(5)} ${r.file.padEnd(22)} clips ${String(r.clips).padStart(2)}` +
              `  bones ${String(r.boneCount).padStart(3)}   left ${f(r.left)}   right ${f(r.right)}`);
  if (r.left) console.log(`        matched on  ${r.left.bones}`);
  if (!r.left && !unmatched) unmatched = r;
}
if (unmatched){
  console.log(`\n  no arm bones matched on ${unmatched.file} — its bones are:`);
  console.log("    " + unmatched.bones.join(", "));
}
const donors = out.filter(r => r.kind === "donor" && r.left);
const bodies = out.filter(r => r.kind === "body" && r.left);
if (donors.length && bodies.length){
  const avg = (a) => a.reduce((t, r) => t + r.left.droopDeg, 0) / a.length;
  const d = avg(donors), b = avg(bodies);
  console.log(`\n  donors rest at ${d.toFixed(1)} deg of droop, bodies at ${b.toFixed(1)} deg`);
  console.log(`  the rests differ by ${Math.abs(d - b).toFixed(1)} deg at the shoulder.`);
  console.log(`  Delta retargeting adds that to EVERY frame of EVERY lent clip.`);
}
await browser.close(); await close();
