#!/usr/bin/env node
/**
 * Pembroke Academy — do the animations work, and does anyone use them?
 *
 *     node tools/check-animations.mjs [walker]
 *
 * Two different questions, and a clip can fail either one on its own.
 *
 * DOES IT PLAY. An action can be selected and frozen: a paused action
 * still writes its pose every frame, so a frozen student looks exactly
 * like a student standing still, and the only tell is whether the
 * action's clock advances. Nothing was reading that clock, and two of
 * the eight named students turned out to have been stuck at frame zero
 * of an idle they owned and never played.
 *
 * DOES ANYTHING SELECT IT. A body can carry seven clips and reach
 * three. rolesOf decides what a body may do; CAST_PLAN reaches past it
 * by name for a couple of specials. A clip nobody ever asks for is
 * weight in the download and nothing on the screen — worth knowing
 * about, and not necessarily worth fixing.
 *
 * So: exercise every clip directly, then watch the campus for a while
 * and see which ones it actually chooses.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PORT = 8351;
const WATCH = (+process.argv.find(a => /^\d+$/.test(a)) || 60) * 1000;
const BODY = process.argv.slice(2).find(a => !/^\d+$/.test(a)) || "walker";
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
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on("pageerror", e => console.log("  [pageerror] " + e.message.split("\n")[0]));
/* Bodies are dealt at random each visit, so the one asked for may
   simply not be out. Reload until it is, rather than reporting "no
   ariel on campus" and leaving the reader to wonder whether that is a
   fault in the roster or a coin toss. */
let present = false;
for (let attempt = 1; attempt <= 8 && !present; attempt++){
  await page.goto(`http://127.0.0.1:${PORT}/?crowd=12`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__convo && window.__convo.named().length,
                             null, { timeout: 300_000 });
  present = await page.evaluate((body) => (window.__students || [])
    .some(x => x.g?.userData?.figure === body && x.g.userData.anim), BODY);
  if (!present) console.log(`visit ${attempt}: no ${BODY} dealt, trying again`);
}

const roles = await page.evaluate((body) => {
  const s = (window.__students || []).find(x => x.g?.userData?.figure === body);
  if (!s) return null;
  const a = s.g.userData.anim;
  return { clips: Object.keys(a.actions),
           roles: a.roles,
           nominal: a.nominal };
}, BODY);
if (!roles){ console.log(`no ${BODY} on campus this visit`); await browser.close(); server.close(); process.exit(0); }

console.log(`${BODY}: ${roles.clips.length} clips`);
console.log(`  gaits : ${roles.roles.gaits.join(", ") || "(none)"}`);
console.log(`  idle  : ${roles.roles.idle || "(none)"}`);
console.log(`  start : ${roles.roles.start || "(none)"}`);
const reachable = new Set([...roles.roles.gaits,
                           roles.roles.idle, roles.roles.start].filter(Boolean));
const orphan = roles.clips.filter(c => !reachable.has(c));
console.log(`  reachable through roles: ${[...reachable].join(", ")}`);
console.log(`  NOT in roles           : ${orphan.join(", ") || "(none)"}` +
            (orphan.length ? "   <- only CAST_PLAN can ask for these by name" : ""));

/* ── does each clip actually play? ───────────────────────────────────
   Driven inside the conversation view, because that is the one place
   the render loop does NOT run stepStudents — so a clip set here is not
   overwritten by the state machine a frame later. */
console.log("\n── every clip, played on purpose ──");
await page.evaluate((body) => {
  const s = (window.__convo.named() || []).find(x => x.g?.userData?.figure === body)
         || (window.__students || []).find(x => x.g?.userData?.figure === body && x.data);
  window.__testTarget = s;
  if (s) window.__convo.open(s);
}, BODY);
await page.waitForTimeout(1500);

const opened = await page.evaluate(() => window.__convo.on());
if (!opened) console.log("  (could not open the conversation view — skipping)");
else {
  for (const name of roles.clips){
    const r = await page.evaluate(async (clip) => {
      const s = window.__testTarget;
      const a = s.g.userData.anim, act = a.actions[clip];
      if (!act) return { err: "no action" };
      Object.values(a.actions).forEach(x => x.stop());
      act.reset().setEffectiveWeight(1).play();
      act.paused = false;
      a.current = clip;
      const pose = () => { s.g.updateMatrixWorld(true);
        const p = []; s.g.traverse(o => { if (o.isBone)
          p.push(o.matrixWorld.elements[12], o.matrixWorld.elements[13], o.matrixWorld.elements[14]); });
        return p; };
      const t0 = act.time, p0 = pose();
      await new Promise(res => setTimeout(res, 900));
      const t1 = act.time, p1 = pose();
      let moved = 0;
      for (let i = 0; i < p0.length; i += 3)
        if (Math.hypot(p0[i]-p1[i], p0[i+1]-p1[i+1], p0[i+2]-p1[i+2]) > 0.05) moved++;
      return { t0: +t0.toFixed(2), t1: +t1.toFixed(2), moved, bones: p0.length / 3,
               dur: +act.getClip().duration.toFixed(2), scale: +act.timeScale.toFixed(2) };
    }, name);
    if (r.err){ console.log(`  ${name.padEnd(18)} ${r.err}`); continue; }
    const advanced = r.t1 > r.t0 || r.t1 < r.t0;   /* wraps on a short loop */
    console.log(`  ${name.padEnd(18)}${String(r.dur).padStart(6)}s   ` +
                `clock ${String(r.t0).padStart(5)} -> ${String(r.t1).padStart(5)}   ` +
                `${String(r.moved).padStart(3)}/${r.bones} bones moved   ` +
                (advanced && r.moved > 4 ? "ok" : "DEAD — plays nothing"));
  }
  await page.evaluate(() => window.__convo.close());
}

/* ── if this body has no idle, its standing pose IS one frame ──────
   Eight of eleven bodies here arrived with a walk and nothing else, and
   for those the campus holds the walk at the frame where the feet pass
   and the hands hang nearest the centre line. That single frame is the
   whole of how they look standing at a door, on the plaza, and in
   conversation — so it is worth knowing whether the search found a good
   one or merely the least bad of a poor set. The score below is
   passingTime's own: feet apart, plus how far the hands sit out from
   the spine. Lower is a stiller stance. */
if (!roles.roles.idle){
  const held = await page.evaluate((body) => {
    const s = (window.__students || []).find(x => x.g?.userData?.figure === body);
    const a = s.g.userData.anim, act = a.actions[s.gait2 || a.current];
    if (!act) return null;
    const key = (n) => { n=(n||"").split("|").pop().split(":").pop();
      n=n.replace(/^mixamorig\d*/i,"").replace(/[._]\d+$/,"");
      return n.replace(/[^a-z0-9]/gi,"").toLowerCase(); };
    const feet = [], hands = []; let hip = null;
    s.g.traverse(o => { if (!o.isBone) return;
      if (/foot$/.test(key(o.name))) feet.push(o);
      if (/(hand|wrist)$/.test(key(o.name))) hands.push(o);
      if (!hip && /hip|pelvis/.test(key(o.name))) hip = o; });
    if (feet.length < 2) return { err: "fewer than two feet found" };
    const wp = (o) => ({ x:o.matrixWorld.elements[12], z:o.matrixWorld.elements[14] });
    const was = act.time, wasPaused = act.paused;
    const dur = act.getClip().duration, scores = [];
    for (let i = 0; i < 24; i++){
      act.time = (i / 24) * dur; act.paused = false;
      a.mixer.update(0); s.g.updateMatrixWorld(true);
      const p = wp(feet[0]), q = wp(feet[1]);
      let d = Math.hypot(p.x - q.x, p.z - q.z);
      /* across the body, per frame — the same reading passingTime makes */
      const c = wp(hip || s.g);
      for (const h of hands){ const w = wp(h);
        d += Math.hypot(w.x - c.x, w.z - c.z) * 0.6; }
      scores.push(+d.toFixed(2));
    }
    act.time = was; act.paused = wasPaused; a.mixer.update(0);
    const best = scores.indexOf(Math.min(...scores));
    return { scores, best, bestT: +((best / 24) * dur).toFixed(2),
             holdAt: s.holdAt == null ? null : +s.holdAt.toFixed(2),
             lo: Math.min(...scores), hi: Math.max(...scores), dur: +dur.toFixed(2) };
  }, BODY);
  console.log(`\n── no idle: the held frame is the whole standing pose ──`);
  if (!held || held.err) console.log("  " + (held?.err || "could not read it"));
  else {
    console.log(`  clip is ${held.dur}s; stillness score ranges ${held.lo} (best) to ${held.hi} (worst)`);
    console.log(`  best frame at ${held.bestT}s;  campus is holding ${held.holdAt === null ? "(not yet held)" : held.holdAt + "s"}`);
    const spread = held.hi - held.lo;
    console.log(`  the search has ${spread < 1 ? "little to choose between frames — any is as still as any other"
                                              : "a real best: " + (100 * (held.hi - held.lo) / held.hi).toFixed(0) + "% stiller than the worst frame"}`);
  }
}

/* ── which ones does the campus ever choose? ───────────────────────
   Read this half as evidence, never as a verdict. The render loop
   clamps dt to 0.05s, so on a software rasterizer at a few frames a
   second the campus experiences roughly an eighth of the wall clock
   that passes here — a minute of watching is seconds of campus time,
   and a clip that only plays during a transition can easily not come
   round. "Never selected" here means "not seen", and only the
   play-on-purpose half above can say a clip is dead. */
console.log(`\n── what the campus selects, watched for ${WATCH / 1000}s ──`);
console.log(`   (dt is clamped, so this is roughly ${Math.round(WATCH / 8000)}s of campus time —` +
            ` a clip missed here is not a clip that cannot play)`);
const seen = new Map();
const t0 = Date.now();
while (Date.now() - t0 < WATCH){
  const rows = await page.evaluate((body) => (window.__students || [])
    .filter(x => x.g?.userData?.figure === body && x.g.userData.anim)
    .map(x => {
      const a = x.g.userData.anim, act = a.actions[a.current];
      return { clip: a.current, held: !!x.held,
               scale: act ? +act.timeScale.toFixed(2) : null,
               t: act ? +act.time.toFixed(3) : null };
    }), BODY);
  for (const r of rows){
    if (!r.clip) continue;
    const e = seen.get(r.clip) || { n: 0, moved: 0, scales: [], last: new Map() };
    e.n++;
    if (r.scale != null) e.scales.push(r.scale);
    seen.set(r.clip, e);
  }
  await page.waitForTimeout(700);
}
for (const c of roles.clips){
  const e = seen.get(c);
  if (!e){ console.log(`  ${c.padEnd(18)} never selected`); continue; }
  const lo = Math.min(...e.scales), hi = Math.max(...e.scales);
  const pinned = lo <= 0.56 || hi >= 1.89;
  console.log(`  ${c.padEnd(18)} chosen ${String(e.n).padStart(4)} times   ` +
              `timeScale ${lo.toFixed(2)}-${hi.toFixed(2)}` +
              (pinned ? "   <- at the clamp: the clip and the walking speed disagree" : ""));
}
await browser.close(); server.close();
