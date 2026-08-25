/* What finish does a body actually END UP with on the campus?
 *
 *     node tools/probe-finish.mjs [figure ...]
 *
 * deshine() corrects the numbers that make cloth look wet — metalness to
 * 0, roughness floored, specular and ior damped — but it only touches a
 * mesh whose NAME or material name matches a list: body, skin, head,
 * hair, shirt, jean, shoe and so on. A body whose material is called
 * something else is skipped in silence and keeps whatever the exporter
 * wrote, which for a metalness of 1 is a person made of metal.
 *
 * Nothing reports that today. check-character prints the RAW file values
 * and says the campus correction is applied; character-sheet applies the
 * correction unconditionally, without the name gate, so its pictures look
 * right whether or not the campus would agree. The two together can make
 * a body look fine everywhere except the actual game.
 *
 * So this reads the numbers off the live material after the campus has
 * had its way with them, and says whether the gate let it through. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv.slice(2).filter(a => !a.startsWith("-"));
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
/* roamers arrive over minutes; wait for the bodies asked for */
if (WANT.length)
  await page.waitForFunction((w) => w.every(k => (window.__students || [])
    .some(s => s.g?.userData?.figure === k)) ? true : null,
    WANT, { timeout: 240_000, polling: 3000 }).catch(() => {});
else await page.waitForTimeout(90_000);

const rows = await page.evaluate((want) => {
  const seen = new Map();
  for (const s of (window.__students || [])){
    const k = s.g?.userData?.figure;
    if (!k || (want.length && !want.includes(k)) || seen.has(k)) continue;
    const mats = [];
    s.g.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      mats.push({ mesh: o.name || "(unnamed)", mat: m.name || "(unnamed)",
                  metal: typeof m.metalness === "number" ? +m.metalness.toFixed(2) : null,
                  rough: typeof m.roughness === "number" ? +m.roughness.toFixed(2) : null,
                  spec: typeof m.specularIntensity === "number" ? +m.specularIntensity.toFixed(2) : null,
                  ior: typeof m.ior === "number" ? +m.ior.toFixed(2) : null });
    });
    seen.set(k, mats);
  }
  return [...seen.entries()];
}, WANT);

if (!rows.length){ console.log("  none of those bodies turned up"); }
console.log(`\n  body     mesh / material                   metal  rough  spec   ior`);
for (const [k, mats] of rows)
  for (const m of mats)
    console.log(`  ${k.padEnd(8)} ${(m.mesh + " / " + m.mat).slice(0, 32).padEnd(33)}` +
      `${String(m.metal).padStart(5)}  ${String(m.rough).padStart(5)}  ` +
      `${String(m.spec).padStart(5)}  ${String(m.ior).padStart(4)}`);
console.log(`\n  deshine() sets metalness to 0 on every body it is allowed to touch.`);
console.log(`  A row still reading metal 1 was SKIPPED by the name gate and is`);
console.log(`  rendering as metal — a blown-out face and dark, glassy cloth.`);
await browser.close(); await closeSrv();
