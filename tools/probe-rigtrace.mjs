/* The six numbers from inside lendClip, for one bone at one frame.
 *
 *     node tools/probe-rigtrace.mjs [canonBone] [frame]
 *
 * Every reading in this bug so far was taken from outside the function,
 * on its output, and six of them meant something other than their
 * label. This one is printed by the code that does the work, holding
 * the values it actually uses. */
import { serve, launch } from "./_harness.mjs";
const BONE = process.argv[2] || "leftarm";
const FRAME = process.argv[3] || "8";
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
let seen = 0;
page.on("console", m => {
  const t = m.text();
  if (t.startsWith("rigtrace")){ seen++; console.log("\n" + t); }
  else if (/could not lend|labels its sides/.test(t)) console.log("  [page] " + t);
});
await page.goto(`${origin}/index.html?crowd=12&rigtrace=${BONE}&rigframe=${FRAME}`,
                { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
/* lends happen as bodies are dealt; give the campus time to deal several */
await page.waitForFunction(() => (window.__students || [])
  .some(s => s.g?.userData?.anim?.actions &&
             Object.keys(s.g.userData.anim.actions).length >= 3) ? true : null,
  null, { timeout: 300_000 }).catch(() => {});
await page.waitForTimeout(8000);
console.log(`\n${seen} trace(s) printed for "${BONE}" at frame ${FRAME}.`);
if (!seen) console.log("  none — either no clip was lent, or no bone canonicalises to that name.");
await browser.close(); await closeSrv();
