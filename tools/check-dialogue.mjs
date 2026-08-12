/* Any character, in dialogue mode.
 *
 * The conversation view is where a body gets its only close-up: key,
 * fill and rim light, culling off, full-detail geometry, filling the
 * screen. Every fault this cast has had was invisible on a lawn and
 * obvious at this distance — so this opens it on a walker-bodied
 * student, holds it, and takes the picture.
 *
 * Also checks the four things that went wrong when it was built: a
 * figure culled to nothing, a T-pose, a figure facing away, and a
 * dialogue card floating loose. Three of those are only visible in the
 * screenshot; the first one is only visible in the counters. */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

import { mkdir } from "node:fs/promises";
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUT = resolve(ROOT, ".shots");
const PORT = 8321;
const BODY = process.argv[2] || "walker";
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".glb":"model/gltf-binary", ".png":"image/png", ".jpg":"image/jpeg",
  ".svg":"image/svg+xml", ".json":"application/json", ".webp":"image/webp" };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const p = resolve(ROOT, "." + (rel === "/" ? "/index.html" : rel));
  if (p !== ROOT && !p.startsWith(ROOT + sep)){ res.writeHead(403); res.end(); return; }
  if (!existsSync(p) || statSync(p).isDirectory()){ res.writeHead(404); res.end("nope"); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(await readFile(p));
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--disable-dev-shm-usage", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
/* Bodies are dealt to the named cast at random each visit, and only a
   named student can be spoken to — so the body you want may simply not
   be out today. Reload until it is, rather than reporting nothing and
   leaving the reader to guess whether that was a fault. */
let who = [];
for (let attempt = 1; attempt <= 8; attempt++){
  await page.goto(`http://127.0.0.1:${PORT}/?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__convo, null, { timeout: 300_000 });
  await page.waitForFunction(() => (window.__convo.named() || []).length > 0,
                             null, { timeout: 300_000 });
  who = await page.evaluate(() => window.__convo.named()
    .map(s => ({ name: s.data?.name, body: s.g?.userData?.figure })));
  if (who.some(w => w.body === BODY)) break;
  console.log(`visit ${attempt}: no ${BODY} among the named cast, dealing again`);
}

/* the campus, before, so the 99% cut has something to be 99% of */
const before = await page.evaluate(() => {
  const c = window.__crowd();
  return { draws: c.draws, tris: c.tris, people: c.people };
});
console.log(`campus behind it: ${before.draws} draws, ${(before.tris/1e6).toFixed(2)}M tris, ${before.people} people`);

console.log("named students: " + who.map(w => `${w.name}(${w.body})`).join(", "));

const target = who.find(w => w.body === BODY);
if (!target){
  console.log(`${BODY} was not dealt to a named student in eight visits.`);
  console.log("Either it is not in ROAMING, or the deal is very unlucky.");
}
else {
  await mkdir(OUT, { recursive: true });
  console.log(`\nopening dialogue with ${target.name}, on the ${BODY} body`);
  await page.evaluate((nm) => {
    const s = window.__convo.named().find(x => x.data?.name === nm);
    window.__convo.open(s);
  }, target.name);
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const c = window.__crowd();          /* the counters, via the hook that exists */
    const card = document.querySelector("#convo");
    const box = card ? card.getBoundingClientRect() : null;
    /* the figure in the view is the one reparented under the camera rig;
       find it by asking which named student is currently on screen */
    const g = (window.__convo.named().find(s => s.g && s.g.parent &&
               s.g.parent !== window.__app.world) || {}).g;
    let lo = Infinity, hi = -Infinity, nan = 0;
    if (g){
      g.updateMatrixWorld(true);
      g.traverse(o => { if (!o.isBone) return;
        const y = o.matrixWorld.elements[13];
        if (!Number.isFinite(y)) { nan++; return; }
        lo = Math.min(lo, y); hi = Math.max(hi, y); });
    }
    return { on: window.__convo.on(), draws: c.draws, tris: c.tris,
             cardStyle: card ? getComputedStyle(card).position : "(no #convo)",
             cardTop: box ? Math.round(box.top) : null,
             cardLeft: box ? Math.round(box.left) : null,
             bodySpan: Number.isFinite(hi - lo) ? +(hi - lo).toFixed(1) : null,
             nanBones: nan,
             /* Whether the look-at can work at all, and no angle.
                An angle was reported here and it was worse than
                nothing: it read local +Z as forward for both head and
                body, which is the very assumption lookAtViewer avoids
                making, so it called nathan 85 degrees off while the
                render showed him staring straight down the lens. The
                correction works in body space against a measured
                neutral; there is no meaningful scalar to print from
                outside it. The picture judges the direction. */
             look: (() => {
               if (!g) return null;
               const key = (s) => { s=(s||"").split("|").pop().split(":").pop();
                 s=s.replace(/^mixamorig\d*/i,"").replace(/[._]\d+$/,"");
                 return s.replace(/[^a-z0-9]/gi,"").toLowerCase(); };
               let head = null;
               g.traverse(o => { if (!head && o.isBone && /head$/.test(key(o.name))) head = o; });
               return head ? "head bone found — look-at active"
                           : "NO head bone — look-at skipped, he will not turn to you";
             })(),
             text: (document.querySelector("#convo")?.innerText || "").slice(0, 220) };
  });

  console.log(`\nin dialogue:  ${state.draws} draws, ${(state.tris/1e6).toFixed(3)}M tris` +
              `   (campus was ${before.draws} / ${(before.tris/1e6).toFixed(2)}M)`);
  console.log(`cut:          ${(100 - state.draws / before.draws * 100).toFixed(1)}% of draw calls`);
  console.log(`convo open:   ${state.on}`);
  console.log(`figure:       bone span ${state.bodySpan}, ${state.nanBones} NaN bones`);
  console.log(`head:         ${JSON.stringify(state.look)}`);
  console.log(`panel:        position ${state.cardStyle}, at ${state.cardLeft},${state.cardTop}`);
  console.log(`\ndialogue text:\n  ` + state.text.replace(/\n+/g, "\n  ").trim());

  /* Is the idle actually PLAYING, or is this a held frame? A still
     cannot tell them apart, and two runs landing on different poses
     only proves the clip starts somewhere different. So sample the
     same bones twice, seconds apart, inside the open view. */
  const sample = () => page.evaluate(() => {
    const g = (window.__convo.named().find(s => s.g && s.g.parent &&
               s.g.parent !== window.__app.world) || {}).g;
    if (!g) return null;
    g.updateMatrixWorld(true);
    const out = [];
    g.traverse(o => { if (o.isBone) out.push(
      o.matrixWorld.elements[12], o.matrixWorld.elements[13], o.matrixWorld.elements[14]); });
    const a = g.userData.anim, act = a && a.actions[a.current];
    return { pts: out, clip: a?.current, time: act ? +act.time.toFixed(2) : null,
             paused: act ? act.paused : null, dur: act ? +act.getClip().duration.toFixed(2) : null };
  });
  const s1 = await sample();
  await page.waitForTimeout(3000);
  const s2 = await sample();
  let moved = 0, worst = 0;
  for (let i = 0; i < s1.pts.length; i += 3){
    const d = Math.hypot(s1.pts[i]-s2.pts[i], s1.pts[i+1]-s2.pts[i+1], s1.pts[i+2]-s2.pts[i+2]);
    if (d > 0.05) moved++;
    worst = Math.max(worst, d);
  }
  console.log(`\nclip:         "${s1.clip}"  ${s1.dur}s  paused=${s1.paused}`);
  console.log(`clock:        ${s1.time}s -> ${s2.time}s over 3s of wall time`);
  console.log(`bones moving: ${moved} of ${s1.pts.length/3}, furthest travelled ${worst.toFixed(2)} units`);

  await page.screenshot({ path: `${OUT}/dialogue-${BODY}.png`, timeout: 120_000 });
  console.log(`wrote .shots/dialogue-${BODY}.png`);

  /* and the way out — a view that will not close is worse than one that
     will not open, because the campus is still there behind it */
  await page.evaluate(() => window.__convo.close());
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    on: window.__convo.on(), draws: window.__crowd().draws }));
  console.log(`after close:  open=${after.on}, ${after.draws} draws (campus back)`);
}
await browser.close(); server.close();
