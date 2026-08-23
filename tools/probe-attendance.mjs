/* Who actually turns up, over several visits?
 *
 *     node tools/probe-attendance.mjs [visits]
 *
 * char5 came back "not out today" on every attempt for a whole
 * investigation, so Marcus went unmeasured while conclusions were drawn
 * from char17 alone. Before building a retry loop around a body, it is
 * worth knowing whether that body is merely unlucky or never dealt at
 * all — those need different fixes, and guessing between them wastes
 * another hour.
 *
 * Reports, per visit, which figures exist and which of those have a clip
 * running, then tallies how often each was seen. */
import { serve, launch } from "./_harness.mjs";
const VISITS = +(process.argv[2] || 6);
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));

const seen = new Map(), animated = new Map();
for (let v = 1; v <= VISITS; v++){
  await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
  /* Sample repeatedly through the visit, not once. The first version read
   * the cast the moment the first clip was lent and saw three bodies every
   * time — but roamers arrive over the following minutes, so that was a
   * measurement of who had arrived EARLY, dressed up as who attends. */
  await page.waitForFunction(() => (window.__students || [])
    .some(s => s.g?.userData?.anim?.current) ? true : null, null,
    { timeout: 120_000 }).catch(() => {});
  const byKey = new Map();
  for (const mark of [0, 30, 60, 120, 180]){
    if (mark) await page.waitForTimeout(mark * 1000 - (byKey.__at || 0));
    byKey.__at = mark * 1000;
    const now = await page.evaluate(() => {
      const out = [];
      for (const s of (window.__students || [])){
        const k = s.g?.userData?.figure;
        if (!k) continue;
        out.push({ k, playing: !!s.g.userData.anim?.current });
      }
      return out;
    });
    for (const r of now){
      const prev = byKey.get(r.k) || { k: r.k, playing: false };
      prev.playing = prev.playing || r.playing;
      byKey.set(r.k, prev);
    }
  }
  const row = [...byKey.values()].filter(r => r && r.k);
  for (const r of row){
    seen.set(r.k, (seen.get(r.k) || 0) + 1);
    if (r.playing) animated.set(r.k, (animated.get(r.k) || 0) + 1);
  }
  console.log(`  visit ${v} (union over 3 min): ${row.map(r => r.k + (r.playing ? "" : "(still)")).join(", ") || "nobody"}`);
}

console.log(`\n  body      seen   with a clip running   (of ${VISITS} visits)`);
const keys = [...seen.keys()].sort();
for (const k of keys)
  console.log(`  ${k.padEnd(9)} ${String(seen.get(k)).padStart(4)}   ${String(animated.get(k) || 0).padStart(8)}`);
console.log(`\n  A body with 0 clips running can never be measured by a probe that`);
console.log(`  waits for one, however many times it revisits.`);
await browser.close(); await closeSrv();
