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
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const LIVE  = argv.includes("--live");
const RUNS  = Math.max(1, +(argv[argv.indexOf("--runs") + 1] || 1) || 1);
const OUT   = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : null;

/* BENCH_VERSION changes whenever anything about the workload changes —
   the pose, the frame counts, what ?bench freezes. Numbers from
   different versions are not comparable, and recording it is what makes
   that checkable rather than remembered. */
const BENCH_VERSION = 1;

/* Two profiles, because the full one is not free. Measured on a
   software rasterizer with a full crowd, 120 warm + 300 sampled frames
   ran past FORTY MINUTES — trivial on a GPU, punishing headless. So the
   full profile is for nightly and release validation, and a shorter one
   exists for per-PR use.
   THE SHORT PROFILE IS NOT YET VALIDATED: nobody has shown its p95
   tracks the full profile's. Until somebody does, it reports and does
   not gate, the same as the ceiling it would feed. */
const PROFILES = {
  full: { warmup: 120, sample: 300, validated: true  },
  ci:   { warmup:  30, sample:  90, validated: false },
};
const PROFILE = argv.includes("--profile") ? argv[argv.indexOf("--profile") + 1] : "full";
if (!PROFILES[PROFILE]){ console.log(`unknown profile "${PROFILE}" — try full or ci`); process.exit(1); }
const { warmup: WARMUP, sample: SAMPLE } = PROFILES[PROFILE];

/* The pose. It lives HERE, in the tool, because the camera position is
   part of the workload specification and not part of the campus. The
   quad from the north-west, high enough to hold the whole academic
   range — the view a visitor actually arrives on. */
const POSE = { v: 1, pos: [-420, 300, 420], look: [0, 0, 0] };

/* THE CEILING IS DELIBERATELY NOT SET. The old one was 1320, derived
   from a single premature reading, and re-deriving it from one run of a
   new method would repeat exactly that mistake. Run --runs 5 on an
   unchanged main, several times, then put the number here with a note
   saying what it was measured on. Until then this reports and does not
   gate. */
const P95_CEILING = null;

/* FIRST BASELINE UNDER THE CONTRACT — recorded as data, not as a
   ceiling. One launch, profile `ci`, commit a70dfe8, build pembroke-v150:
 *
 *     min 1482 · p50 1482 · p90 1483 · p95 1483 · max 1483
 *     mean 1482.4 · stddev 0.5 · 90 frames
 *     dpr 1 · ladder rung 0 (held) · preset off · crowd 9 · people 5
 *
 * STDDEV 0.5. Draw calls moved by one across the whole sample. The same
 * campus measured by the method this replaces produced 711, 723, 765,
 * 803, 1239, 1243, 1491 and 1609 — a nine-hundred-call swing, every
 * reading correct at the moment it was taken and none of them
 * comparable to another. That difference is the entire point of the
 * workload contract, and it is why a future "15% improvement" now has
 * to survive an equivalent workload rather than benefit from crowd
 * timing.
 *
 * RUNTIME, and it decides where this can run. 120 frames took 18.7
 * minutes here — about 9.4 seconds a frame on a software rasterizer
 * with no GPU. The full profile's 420 frames would be roughly 66
 * minutes, which matches a full-profile attempt that ran past 51
 * without reaching its first result. On a runner holding 60fps the same
 * two profiles are about 2 and 7 seconds.
 *
 *   So: this belongs on a GPU runner, or on a schedule. It is not a
 *   per-PR gate on a software rasterizer at any profile, and pretending
 *   otherwise would trade one badly-specified instrument for a
 *   well-specified one nobody can afford to run.
 *
 * STILL MISSING before a ceiling can be set: several independent
 * launches, on the machine that will actually enforce it, and evidence
 * that the `ci` profile's p95 tracks `full`'s. One launch establishes
 * that the workload is stable; it does not establish where the line
 * goes. */

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

  const t0 = Date.now();
  const frames = await page.evaluate(([warm, n]) => new Promise((done) => {
    const r = window.__app.renderer, out = [];
    let seen = 0;
    const tick = () => {
      if (seen++ >= warm) out.push(r.info.render.calls);
      if (out.length < n) requestAnimationFrame(tick); else done(out);
    };
    requestAnimationFrame(tick);
  }), [WARMUP, SAMPLE]);

  const elapsedMs = Date.now() - t0;
  const env = await page.evaluate(() => {
    const p = window.__preset();
    return { dpr: p.dpr, rung: p.rung, rungWhy: p.rungWhy, presetOn: p.on,
             crowd: window.__crowd().n, people: window.__students.length,
             build: (document.documentElement.innerHTML.match(/const BUILD = "([^"]+)"/) || [,"?"])[1] };
  });
  await shut();
  return { ...stats(frames), sampled: frames.length, elapsedMs, ...fixed, ...env };
}

const { origin, close } = await serve();
const browser = await launch();
const { step, note, done } = reporter();

let commit = "?";
try { commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch {}
const started = Date.now();
console.log(`workload: ${LIVE ? "LIVE campus (diagnostic only)" : "deterministic"} · ` +
            `profile ${PROFILE}${PROFILES[PROFILE].validated ? "" : " (UNVALIDATED — reports, does not gate)"} · ` +
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

/* THE RECORD. A number is comparable if you can put it beside another
   one; it is REPRODUCIBLE only if everything that could have changed it
   is written down next to it. This block is that, and it is emitted as
   JSON so a run can be diffed against a run rather than remembered. */
const record = {
  benchVersion: BENCH_VERSION,
  profile: PROFILE,
  profileValidated: PROFILES[PROFILE].validated,
  workload: LIVE ? "live" : "deterministic",
  gates: !LIVE && PROFILES[PROFILE].validated && P95_CEILING != null,
  commit,
  build: all[0]?.build ?? "?",
  viewport: "1280x800",
  dpr: all[0]?.dpr ?? null,
  ladderRung: all[0]?.rung ?? null,
  ladderWhy: all[0]?.rungWhy ?? null,
  arrivalPresetOn: all[0]?.presetOn ?? null,
  crowdCount: all[0]?.crowd ?? null,
  people: all[0]?.people ?? null,
  cameraPose: POSE,
  warmupFrames: WARMUP,
  sampleFrames: SAMPLE,
  launches: RUNS,
  runs: all.map(r => ({ min: r.min, p50: r.p50, p90: r.p90, p95: r.p95, max: r.max,
                        mean: r.mean, stddev: r.sd, sampled: r.sampled,
                        elapsedMs: r.elapsedMs })),
  p95Spread: spread,
  p95Ceiling: P95_CEILING,
  totalElapsedMs: Date.now() - started,
};
console.log("\n--- run record (JSON) ---");
console.log(JSON.stringify(record, null, 1));
if (OUT){ mkdirSync(OUT.replace(/\/[^/]*$/, "") || ".", { recursive: true });
          writeFileSync(OUT, JSON.stringify(record, null, 1));
          note(`record written to ${OUT}`); }

if (LIVE){
  note("live workload — diagnostic only, never gates");
} else if (!PROFILES[PROFILE].validated){
  note(`profile "${PROFILE}" has not been shown to track the full profile — reporting only`);
} else if (P95_CEILING == null){
  note("no ceiling set: re-baseline with --runs 5 on an unchanged main, more than once,");
  note("then set P95_CEILING above the highest p95 seen and say what it was measured on");
} else {
  step(`p95 draw calls within the ceiling`, Math.max(...p95s) <= P95_CEILING,
       `${Math.max(...p95s)} against ${P95_CEILING}`);
}
await browser.close(); close();
done("performance");
