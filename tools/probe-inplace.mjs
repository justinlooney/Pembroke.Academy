/* Do a body's clips still travel once the campus has loaded them?
 *
 *     node tools/probe-inplace.mjs [figure ...]
 *
 * check-character and check-sitting both read the GLB off disk, so they
 * report what the FILE carries. Two of the dean's clips carry about half
 * a body-length of root travel there and both tools warn that her feet
 * will skate.
 *
 * They may well not. prepareClips measures each clip's gait count and
 * then calls inPlaceClip on it, which flattens the x and z of every
 * position track to their first frame -- so a clip that travels on disk
 * can be pinned by the time it is played. Whether that happened is a
 * question about the live clip, and neither tool is looking there.
 *
 * So this reads the position tracks off the clips the campus is actually
 * holding, and reports the largest x/z excursion in each. A clip that
 * has been pinned reads zero. */
import { serve, launch } from "./_harness.mjs";
const WANT = process.argv.slice(2).filter(a => !a.startsWith("-"));
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
if (WANT.length)
  await page.waitForFunction((w) => w.every(k => (window.__students || [])
    .some(s => s.g?.userData?.figure === k)) ? true : null,
    WANT, { timeout: 240_000, polling: 3000 }).catch(() => {});
else await page.waitForTimeout(90_000);

const rows = await page.evaluate((want) => {
  const out = [], seen = new Set();
  for (const s of (window.__students || [])){
    const k = s.g?.userData?.figure;
    if (!k || (want.length && !want.includes(k)) || seen.has(k)) continue;
    seen.add(k);
    const a = s.g.userData.anim;
    if (!a?.actions) continue;
    for (const name of Object.keys(a.actions)){
      const clip = a.actions[name].getClip();
      let travel = 0;
      for (const t of clip.tracks){
        if (!t.name.endsWith(".position")) continue;
        const v = t.values;
        let lo0 = v[0], hi0 = v[0], lo2 = v[2], hi2 = v[2];
        for (let i = 0; i < v.length; i += 3){
          if (v[i] < lo0) lo0 = v[i]; if (v[i] > hi0) hi0 = v[i];
          if (v[i + 2] < lo2) lo2 = v[i + 2]; if (v[i + 2] > hi2) hi2 = v[i + 2];
        }
        travel = Math.max(travel, hi0 - lo0, hi2 - lo2);
      }
      out.push({ k, name, travel: +travel.toFixed(4),
                 role: a.roles?.sit === name ? "sit"
                     : a.roles?.rise === name ? "rise"
                     : a.roles?.seat === name ? "seat"
                     : a.roles?.talk === name ? "talk"
                     : (a.roles?.gaits || []).includes(name) ? "gait"
                     : a.roles?.idle === name ? "idle" : "" });
    }
  }
  return out;
}, WANT);

if (!rows.length) console.log("  no bodies with clips turned up");
console.log(`\n  body     role   clip                              x/z travel in the LIVE clip`);
for (const r of rows)
  console.log(`  ${r.k.padEnd(8)} ${r.role.padEnd(6)} ${r.name.slice(0, 32).padEnd(33)} ${String(r.travel).padStart(8)}`);
const moving = rows.filter(r => r.travel > 1e-4);
console.log(moving.length
  ? `\n  ${moving.length} clip(s) still travel after loading — those feet will skate.`
  : `\n  Every live clip reads zero: inPlaceClip pinned them all at load, so`
    + `\n  the travel the file carries never reaches the campus.`);
await browser.close(); await closeSrv();
