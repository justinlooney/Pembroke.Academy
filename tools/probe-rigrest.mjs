/* Do donor and receiver rest in the same shape? Asked from inside
 * lendClip, under its own pairing — the only measurement in this bug
 * that has held up.
 *     node tools/probe-rigrest.mjs
 */
import { serve, launch } from "./_harness.mjs";
const { origin, close: closeSrv } = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
const seen = new Set();
page.on("console", m => {
  const t = m.text();
  if (!t.startsWith("rigrest")) { if (/labels its sides/.test(t)) console.log("  [page] " + t); return; }
  const head = t.split("\n")[0];
  if (seen.has(head)) return;                 /* one report per clip */
  seen.add(head);
  console.log("\n" + t);
});
await page.goto(`${origin}/index.html?crowd=12&rigrest=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app && window.__students, null, { timeout: 240_000 });
await page.waitForFunction(() => (window.__students || [])
  .some(s => Object.keys(s.g?.userData?.anim?.actions || {}).length >= 3) ? true : null,
  null, { timeout: 300_000 }).catch(() => {});
await page.waitForTimeout(6000);
console.log(`\n${seen.size} rest comparison(s) reported.`);
await browser.close(); await closeSrv();
