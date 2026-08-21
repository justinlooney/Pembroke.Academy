#!/usr/bin/env node
/**
 * Pembroke Academy — a draw-call measurement with a defined workload.
 *
 *     node tools/check-perf.mjs                 deterministic, gated
 *     node tools/check-perf.mjs --live          live campus, diagnostic
 *     node tools/check-perf.mjs --runs 5        repeat, for baselining
 *
 * WHY THIS EXISTS, AND WHAT IT REPLACES.
 *
 * check-frame used to assert a ceiling on "the settled draw count". It
 * settled by waiting for two twelve-second windows to agree within 2,
 * and that was believed to mean the campus had finished arriving.
 *
 * It does not. Measured:
 *
 *     two agreeing windows      1243 draws   (arrivalState: not arriving)
 *     kept waiting              1609 draws
 *
 * +366, and `arriving` was ALREADY false at 1243 — arrivalState tracks
 * the asset log, while the crowd goes on churning by design, bodies
 * walking into buildings and out again for the whole session. THIS
 * SCENE NEVER STOPS CHANGING. "Wait until it settles" is not a workload
 * specification, and a ceiling derived from one arbitrary moment in a
 * continuously moving scene has no stable meaning. It gated merges for
 * a day on an envelope nobody had defined.
 *
 * A performance gate needs to say what it is measuring. This does:
 *
 *     fixed build            whatever is checked out
 *     fixed viewport + DPR   1280x800 at pixelRatio 1
 *     fixed graphics preset  ?bench holds the quality ladder
 *     fixed camera           set here, and ?bench stops anything moving it
 *     fixed crowd            __crowdFill(), then ?bench freezes their motion
 *     wait for              assets only — not for the scene to hold still
 *     warm                  WARMUP frames, discarded
 *     sample                SAMPLE frames
 *     report                min, p50, p90, p95, max, mean, stddev
 *
 * THE GATE IS p95, not a one-time median: a single reading of a moving
 * scene is the thing that got us here.
 *
 * TWO MEASUREMENTS, and only one of them gates.
 *
 *   deterministic (default)  camera fixed, crowd frozen. Comparable run
 *                            to run, which is the only property a
 *                            regression gate needs. THIS ONE GATES.
 *   --live                   normal churn. Answers a different question
 *                            — what the distribution looks like during
 *                            one stochastic simulation — and carries
 *                            seed, population and timing variance. Good
 *                            as a soak diagnostic, poor as a gate, so it
 *                            never fails the build.
 *
 * BASELINING. Do not set the ceiling from one run. `--runs 5` launches
 * five independent browsers and prints the spread across them; the
 * ceiling belongs above the highest p95 seen across several such
 * launches, with the reason written down.
 */
import { serve, launch, reporter } from "./_harness.mjs";

const argv = process.argv.slice(2);
const LIVE  = argv.includes("--live");
const RUNS  = Math.max(1, +(argv[argv.indexOf("--runs") + 1] || 1) || 1);
const WARMUP = 120;
const SAMPLE = 300;

/* The pose. It lives HERE, in the tool, because the camera position is
   part of the workload specification and not part of the campus. The
   quad from the north-west, high enough to hold the whole academic
   range — the view a visitor actually arrives on. */
const POSE = { pos: [-420, 300, 420], look: [0, 0, 0] };

/* THE CEILING IS DELIBERATELY NOT SET. The old one was 1320, derived
   from a single premature reading, and re-deriving it from one run of a
   new method would repeat exactly that mistake. Run --runs 5 on an
   unchanged main, several times, then put the number here with a note
   saying what it was measured on. Until then this reports and does not
   gate. */
const P95_CEILING = null;

const stats = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  const mean = s.reduce((x, y) => x + y, 0) / s.length;
  const sd = Math.sqrt(s.reduce((t, v) => t + (v - mean) ** 2, 0) / s.length);
  return { min: s[0], p50: q(.5), p90: q(.9), p95: q(.95), max: s[s.length - 1],
           mean: +mean.toFixed(1), sd: +sd.toFixed(1) };
};

async function measure(origin, browser, i){
  /* Not the harness's open(): it navigates to "/", and this workload
     needs its own query string. Booting the campus twice to get there
     would cost minutes per run for nothing. */
  const qs = LIVE ? "?crowd" : "?crowd&bench";
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const shut = () => ctx.close();
  await page.goto(origin + "/" + qs, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const up = await page.waitForFunction(() => window.__app && window.__crowd, null,
      { timeout: 240_000 }).then(() => true, () => false);
  if (!up) throw new Error("the campus did not ignite");
  await page.waitForFunction(() => !document.body.classList.contains("opening"),
      null, { timeout: 120_000 }).catch(() => {});

  /* WAIT FOR ASSETS ONLY. Not for the scene to hold still — it never
     does, and that belief is the defect this file exists to retire. */
  await page.waitForFunction(() => window.__crowd().pending === 0, null,
      { timeout: 600_000, polling: 2000 }).catch(() => {});
  await page.waitForFunction(() => window.__preset && window.__preset().on === false,
      null, { timeout: 600_000, polling: 2000 }).catch(() => {});

  const fixed = await page.evaluate(async (P) => {
    window.__crowdFill();
    const { camera, controls } = window.__app;
    camera.position.set(...P.pos);
    camera.lookAt(...P.look);
    camera.updateMatrixWorld(true);
    if (controls){ controls.target.set(...P.look); controls.update(); }
    await new Promise(r => setTimeout(r, 1500));
    return { people: window.__students.length, dpr: window.__app.renderer.getPixelRatio(),
             preset: window.__preset().on, bench: new URL(location.href).searchParams.has("bench") };
  }, POSE);

  const frames = await page.evaluate(([warm, n]) => new Promise((done) => {
    const r = window.__app.renderer, out = [];
    let seen = 0;
    const tick = () => {
      if (seen++ >= warm) out.push(r.info.render.calls);
      if (out.length < n) requestAnimationFrame(tick); else done(out);
    };
    requestAnimationFrame(tick);
  }), [WARMUP, SAMPLE]);

  await shut();
  return { ...stats(frames), n: frames.length, ...fixed };
}

const { origin, close } = await serve();
const browser = await launch();
const { step, note, done } = reporter();

console.log(`workload: ${LIVE ? "LIVE campus (diagnostic only)" : "deterministic"} · ` +
            `1280x800 · warm ${WARMUP} · sample ${SAMPLE} · ${RUNS} launch(es)`);
const all = [];
for (let i = 0; i < RUNS; i++){
  const r = await measure(origin, browser, i);
  all.push(r);
  console.log(`  run ${i + 1}: min ${r.min}  p50 ${r.p50}  p90 ${r.p90}  p95 ${r.p95}  ` +
              `max ${r.max}  mean ${r.mean}  sd ${r.sd}   (${r.people} people, dpr ${r.dpr}, ` +
              `bench=${r.bench}, preset=${r.preset})`);
}
const p95s = all.map(r => r.p95);
const spread = Math.max(...p95s) - Math.min(...p95s);
note(`p95 across ${RUNS} launch(es): ${p95s.join(", ")}  ·  spread ${spread}`);

if (LIVE){
  note("live workload — diagnostic only, never gates");
} else if (P95_CEILING == null){
  note("no ceiling set: re-baseline with --runs 5 on an unchanged main, more than once,");
  note("then set P95_CEILING above the highest p95 seen and say what it was measured on");
} else {
  step(`p95 draw calls within the ceiling`, Math.max(...p95s) <= P95_CEILING,
       `${Math.max(...p95s)} against ${P95_CEILING}`);
}
await browser.close(); close();
done("performance");
