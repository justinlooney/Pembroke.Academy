/* Do the donors and the receivers REST in the same shape?
 *
 * Delta retargeting transfers "change from rest". If the two rests are
 * different POSES rather than merely different bases, that difference
 * is added to every frame of every lent clip. This measures the one
 * number that decides it: the world-space direction of each arm at
 * rest, on every donor and every body. */
import { serve, launch } from "./_harness.mjs";
const { origin, close } = await serve();
const browser = await launch();
const page = await browser.newPage();
await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.THREE, null, { timeout: 240000 });

const out = await page.evaluate(async () => {
  const THREE = window.THREE;
  const { GLTFLoader } = await import("./assets/vendor/three/examples/jsm/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  const load = (u) => new Promise((res, rej) => loader.load(u, res, undefined, rej));

  const key = (s) => { s=(s||"").split("|").pop().split(":").pop();
    s=s.replace(/^mixamorig\d*/i,"").replace(/[._]\d+$/,"");
    return s.replace(/[^a-z0-9]/gi,"").toLowerCase(); };

  /* Bone DIRECTION is basis-independent: it is where the limb points in
     the world, which is what "the same shape" means. */
  const armOf = (root, side) => {
    root.updateMatrixWorld(true);
    let up = null, fore = null;
    root.traverse(o => {
      if (!o.isBone) return;
      const k = key(o.name);
      if (k === side + "arm" && !up) up = o;
      if (k === side + "forearm" && !fore) fore = o;
    });
    if (!up || !fore) return null;
    const a = up.getWorldPosition(new THREE.Vector3());
    const b = fore.getWorldPosition(new THREE.Vector3());
    const v = b.sub(a).normalize();
    /* angle below horizontal: 0 = straight out (T), 90 = straight down */
    return { droopDeg: +(Math.asin(-v.y) * 180 / Math.PI).toFixed(1),
             dir: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] };
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
      rows.push({ file: u.split("/").pop(), kind: u.includes("clip_") ? "donor" : "body",
                  clips: g.animations.length,
                  left: armOf(g.scene, "left"), right: armOf(g.scene, "right") });
    } catch (e){ rows.push({ file: u, error: String(e).slice(0, 80) }); }
  }
  return rows;
});

console.log("arm droop at REST — 0° = straight out (T-pose), 90° = hanging down\n");
for (const r of out){
  if (r.error){ console.log(`  ${r.file}  ERROR ${r.error}`); continue; }
  const l = r.left ? `${r.left.droopDeg}°` : "no arm bones";
  const rt = r.right ? `${r.right.droopDeg}°` : "no arm bones";
  console.log(`  ${r.kind.padEnd(5)} ${r.file.padEnd(22)} clips ${String(r.clips).padStart(2)}   left ${l.padStart(7)}   right ${rt.padStart(7)}`);
}
await browser.close(); await close();
