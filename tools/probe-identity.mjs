/* Does a name mean the same person twice?
 *
 *     node tools/probe-identity.mjs [visits]
 *
 * Reported from a phone: "elowen is now named for multiple characters
 * like Sofia and Priya", and then "characters should keep their name".
 * The names never moved — the BODY under them did. CAST_PLAN carried
 * k: "any" for every student, so each visit dealt them a stranger's
 * face.
 *
 * This loads the campus several times and records which body each name
 * is wearing. A name that wears two different bodies across visits is
 * the fault; the same body every time is the fix. */
import { serve, launch } from "./_harness.mjs";
const VISITS = +(process.argv[2] || 3);
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));

const seen = new Map();          /* name -> Set of bodies */
for (let v = 1; v <= VISITS; v++){
  await page.goto(`${origin}/index.html?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 240_000 });
  await page.waitForFunction(() => (window.__convo.named() || []).length > 0,
                             null, { timeout: 240_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const cast = await page.evaluate(() => window.__convo.named()
    .map(s => ({ name: s.data?.name, body: s.g?.userData?.figure })));
  console.log(`  visit ${v}: ` + cast.map(c => `${c.name}=${c.body}`).join("  "));
  for (const c of cast){
    if (!c.name || !c.body) continue;
    if (!seen.has(c.name)) seen.set(c.name, new Set());
    seen.get(c.name).add(c.body);
  }
}

console.log(`\n  name              bodies worn across ${VISITS} visits`);
let drift = 0;
for (const [name, bodies] of [...seen].sort()){
  const list = [...bodies];
  if (list.length > 1) drift++;
  console.log(`  ${name.padEnd(17)} ${list.join(", ")}${list.length > 1 ? "   <<< changed" : ""}`);
}
console.log(drift
  ? `\n  ${drift} name(s) wore more than one body. A name that is redrawn every`
    + `\n  visit is not a character.`
  : `\n  every name wore the same body every visit.`);
/* A name seen only once proves nothing, and saying so is the point. */
const thin = [...seen].filter(([, b]) => b.size === 1).length;
console.log(`  (${thin} name(s) stable so far; names not dealt in a visit simply do not appear`
          + `\n  in it, so a short run can miss drift rather than disprove it.)`);
await browser.close(); await closeSrv();
