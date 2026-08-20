# Pembroke Academy — Full Site Audit

**Build audited:** `pembroke-v129` (commit `9be8a8d`)
**Date:** 19 August 2026
**Method:** full repository read + headless Chromium runtime testing (Playwright, software GL), instrumented for console errors, transferred bytes, draw calls, triangle counts, heap, long tasks, and adversarial AI probing against a local mock gateway.
**Scope:** audit only. No production code was modified.

**Evidence tags used throughout:**
`CONFIRMED` reproduced at runtime · `MEASURED` instrumented number · `OBSERVED` directly experienced/screenshotted · `INFERRED` supported by code evidence, not executed · `RECOMMENDED` proposal.

> **Testing caveat, stated once.** The sandbox has no GPU; all rendering ran on SwiftShader, and the production AI gateway (`pembroke-ai.pembroke-academy.workers.dev`) was unreachable through the sandbox proxy (`CONNECT tunnel failed, 403`). Frame rates are therefore **not** measured, and the hosted model's *prose quality* is **not** assessed. Everything else — geometry cost, byte weight, memory, the full AI client path, streaming, cancellation, failure modes, and the governor — was tested against a local mock gateway speaking the production NDJSON dialect. Where a claim depends on real hardware I have marked it `INFERRED`.

---

## 1. Executive Summary

Pembroke Academy is **not** a template, not a prototype dressed as a product, and not an AI-generated pastiche. It is a genuinely unusual piece of work with two subsystems that are, in my assessment, at or near industry-leading quality:

1. **The character-AI governor.** The invariant *AI proposes → Governor validates → Pembroke performs* is real, enforced by a single authoritative policy table, and it **held under every attack I could construct** (§8). This is the best thing in the codebase and I would not change it.
2. **The MATH 201 course.** All 28 lectures are fully built — professor framing, objectives, 12–14 lecture beats, an interactive visualization, a worked example with progressive reveal, practice with hinting, a knowledge check, a problem set, and a parameterized homework generator. The writing is genuinely good pedagogy (§9).

Against that, Pembroke has one structural product decision and one platform failure that together are why it is not award-caliber today:

- **The world is boxed.** The 3D campus is permanently confined to a `52%` column beside a conventional scrolling web page. The single most impressive thing Pembroke does — ground-level walk mode, which is genuinely beautiful (§6, shot `52-desktop-walk`) — is rendered in a ~750×810 letterbox next to a course catalogue. Conversation mode already knows how to go fullscreen and lock scroll; walk mode does not.
- **Mobile is broken, not merely compromised.** On a Pixel 5 profile the five hall nameplates and three character names collapse into one illegible overlapping pile across the middle of the frame, the bottom legend overprints the control hints into mush, and the campus occupies the lower third of its own window (`CONFIRMED`, shot `40-mobile-arrival`). The document is **13,351 px tall** with a 560 px 3D window at the top (`MEASURED`).

There is also a **content cliff**: 12 courses are advertised and 1 is teachable.

**The honest one-line verdict:** Pembroke is a production-quality experience containing one industry-leading subsystem and one award-caliber moment, currently prevented from being an award contender by its mobile presentation, its split-screen framing, and the gap between what its curriculum promises and what it teaches.

---

## 2. Current Product — what actually exists

| Layer | Reality |
|---|---|
| Delivery | Single static `index.html`, **16,176 lines / 995 KB**, no build step, no framework, no package.json. Vendored Three.js, Spark (gaussian splats), three-mesh-bvh. |
| Rendering | Three.js + `EffectComposer` (SSAO, UnrealBloom, SMAA), CSS2D label overlay, PMREM environment, `Reflector` plaza mirror. |
| World | 4 teaching halls + chapel + cathedral + residence hall + stadium + outer world, procedurally-textured stone walls (SVG→canvas), instanced piers/cars/flora, waypoint graph with 2 ring roads. |
| Assets | **121 MB** on disk, 41 GLB/SPZ files. Heaviest: `drosdick_atrium.spz` 27 MB, `drosdick_hall.glb` 23.7 MB, `cathedral.glb` 12.5 MB, 14 character bodies at 2.4–3.4 MB each. |
| Characters | 10 authored personas (8 students, Dean Aldergate, Prof. Merion) + a roaming crowd drawn from 14 rigged bodies. |
| AI | Three-tier: hosted Cloudflare Worker (default) → optional local Ollama → canned dossier dialogue. Streaming NDJSON, per-role model routing, 3-level memory. |
| Lifecycle | 6 stages: Campus Visit → Application → Accepted → Advising → Declare Major → Register. One storage key, one renderer. |
| Academics | 12 courses catalogued; **MATH 201 alone** has a course of study (28 lectures). |
| Offline | Service worker, network-first shell / cache-first depot, versioned separately so text releases don't flush the model cache. |
| Testing | 20 `tools/check-*.mjs` probes + a substantial `tools/smoke.mjs`; 4 GitHub Actions workflows. |

---

## 3. Strengths — what must not be touched

These are the differentiators. Changing them would make Pembroke worse.

1. **The governor and `AI_POLICY`** (`index.html:15196–15265`). One table declares what each role may *propose*; the prompt's intent documentation is **generated from that same table**, so what a character is told it may ask for and what the system will accept cannot drift. `CONFIRMED` — see §8.
2. **Intents produce captions and CTAs, never mutations.** Every governor return is `{caption}` or `{caption, cta:{label, run}}` where `run` is a *local deterministic function*. No model output path can write state. `CONFIRMED`.
3. **`deanDoor()` outranks the request.** Whatever lifecycle intent a model proposes, the resolver re-derives the correct next stage from journey state and opens *that* door — and the same resolver serves the no-AI canned path, so the two can never disagree (`index.html:15210`).
4. **MATH 201's teaching quality.** "A vending machine that sometimes gives you crisps and sometimes gives you soup for the same button is broken" is a better opening to functions than most textbooks manage. The four-representations framing, the cedar-planter optimization foreshadowing Chapter 4, `f(1+h)` flagged as "in three weeks it is the beating heart of the derivative" — this is real curriculum design.
5. **Ground-level walk mode.** `OBSERVED` (shot `52-desktop-walk`): gothic facades at eye height, lamp posts, benches, the fountain on axis with the cathedral, a student standing by the water in warm dusk light. This is the product.
6. **The adaptive quality ladder and arrival preset** (`index.html:3479–3600`). The campus deliberately "arrives cheap and dresses afterwards" because a GLB parse is a main-thread stall the frame counter misreads as a slow GPU. The code comments document a real field report (an Adreno phone flashing black for 2m20s at 7.13 M triangles) and the fix. This is unusually honest, unusually correct engineering.
7. **The service worker's version split.** `VERSION` (shell) vs `ASSETS_V` (depot), so a text-only release doesn't make a returning phone re-download 39 MB. A reviewer caught the original bug; the fix is documented in the file.
8. **All model output reaches the DOM via `textContent`** (`index.html:14607, 14695`) — the conversation path has no injection surface. `CONFIRMED`. ⚠️ **This does not extend to storage:** see the correction under §5.
9. **Writing voice throughout.** "The registrar needs this one." / "A real address, so the letter can find you." / "Progress is inscribed to your browser's localStorage ledger." The institution has a voice and keeps it.

---

## 4. Critical Problems

### P0-1 · Mobile first impression is illegible
`CONFIRMED` · `OBSERVED` · shot `40-mobile-arrival.png`

On a Pixel 5 profile, five world-anchored hall nameplates plus three character nameplates collapse into a single overlapping stack occupying the vertical middle of the campus window. "The Pembroke Great Library" overprints "Drosdick Hall"; "THE UNIVERSITY CHAPEL" is buried beneath the Library plate; "Aldergate Administration Hall" crosses both. Simultaneously the bottom-left sector legend overprints the bottom-right control hints ("Administration · AI Robotics & Flight" over "DRAG TO ORBIT · SCROLL TO ZOOM") into unreadable mush, and the 🎯 quest chip lands on top of the legend's first row.

**Root cause:** CSS2D labels are anchored at fixed world positions with no screen-space declutter, collision resolution, or priority/LOD system. The narrow mobile frustum compresses widely-separated world anchors into a narrow screen band. The legend and hints are separately positioned `bottom-5` at `left`/`right` with no reflow rule below ~640 px.

**User impact:** the first three seconds on a phone — the only three seconds most visitors give a site — present the campus as broken.

### P0-2 · Only 1 of 12 advertised courses is teachable, and the campus's one objective points at an empty one
`CONFIRMED`

`STUDY` contains exactly one key: `MATH201`. The other eleven courses have catalogue entries, outcomes, textbook citations and code snippets, but **no lessons**. `data-sty` links (the "course of study" affordance) render for `["MATH201"]` only.

Worse, the Current Objective is computed as `COURSES.find(c => !done.includes(c.id))` (`index.html:12029`) with no check for teachability. Tested as a **fully registered, enrolled student** with `MATH101, MATH120, MATH201` on the schedule, the objective still reads:

> `Attend MATH 101 · College Algebra — walk to The Pembroke Great Library`

Walking there yields no course of study. The single always-visible instruction in the entire product is a dead end, at every stage of the journey.

**Also affected:** `index.html:15474` gates the interior "Continue the course" button on `COURSES.find(c => c.sector === key && STUDY[c.id])` — true only for `lib`, so three of four teaching halls have no study path inside them.

### P0-3 · Walk mode does not take the screen or lock scroll
`CONFIRMED` (CSS + runtime)

`body.convo-open` sets `overflow:hidden` and promotes `#stage` to `position:fixed; inset:0` (`index.html:848–849`) — conversation correctly goes fullscreen. **`.walkmode` has no equivalent rule.** First-person walk therefore runs inside the 560 px campus section of a 13,351 px scrolling document on mobile (`MEASURED`).

Consequences:
- The most immersive mode in the product is presented in the smallest frame.
- Single-finger vertical drag on the canvas steers the camera via `pointermove` **without** `preventDefault` (only the two-finger pinch path is `{passive:false}`, `index.html:11884–11896`), so a look-up gesture can both turn the camera and scroll the page. `INFERRED` from the handler registration; the empirical touch-drag confirmation timed out on SwiftShader.
- With walk mode active and the page scrolled, the world is entirely off-screen while the walker keeps walking (`OBSERVED`, shot `42-mobile-walk` — walker `on:true`, touchpad laid out `200×56`, viewport showing the Student Journey card).

### P0-4 · Accidentally submitting the knowledge check destroys the assessment and corrupts the mastery record
`CONFIRMED` · `index.html:13114–13126`

```js
const pick = jbody.querySelector(`input[name="q${qi}"]:checked`);
const good = pick && +pick.value === q.a;   // null when nothing is selected
studyLog(courseId, n, "kc", good);          // …logged as a MISS
why.textContent = (good ? "✓ " : "✗ ") + q.why;   // …and the answer is revealed
```

There is no "you haven't answered yet" guard. Submitting the quiz form with nothing selected marks **both** questions wrong, **permanently reveals both correct answers**, and writes two `kc ok:0` entries to the study log.

Verified end-to-end:
```
log: [{"n":"1.1","k":"kc","ok":0,...},{"n":"1.1","k":"kc","ok":0,...}]
q0 revealed: "✗ 16 − 12 = 4."
q1 revealed: "✗ One input, one output — the vertical line test."
```

**The downstream consequence is the serious part.** `studySignals()` (`index.html:12713`) groups `!e.ok` entries into "stumbles", which are injected into Prof. Merion's prompt as *"Recent stumbles from their actual attempt history — react to the PATTERN"*. So one accidental submit causes the professor to teach the student as though they were struggling with material they never attempted. **This is a UI defect that corrupts the academic record that drives the AI's pedagogy.**

The same class of defect exists in practice questions (`index.html:13095`): pressing *check* with an empty field parses `NaN`, logs `turn ok:0`, and burns the first-miss hint. `CONFIRMED`.

### P0-5 · Acceptance is instantaneous and universal
`CONFIRMED`

```
"applicationSubmittedAt": 1787150253029,
"acceptedAt":             1787150253029
```

Identical millisecond. Status went `visitor → accepted` on one click. The Journey ladder displays "Application — AFTER YOUR VISIT" and "Accepted — LOCKED" and thereby *promises a process*, but there is no review, no wait, no decision, and no possibility of anything but acceptance. This discards the highest-emotion beat a university simulation owns: applying, waiting, and being let in.

---

## 5. Confirmed Bugs

Each entry: severity · location · repro · root cause · impact · fix · regression test.

---

**BUG-1 — `point_to_location` with a prototype key renders "(points toward undefined)"**
`CONFIRMED` · **Severity: P2** (immersion; not a security hole)

- **Location:** `index.html:15235–15236`
- **Repro:** `window.__ai.aiGovern({type:"point_to_location", target:"__proto__"}, {data:{ai:{cls:"social"}}})` → `{caption: "(points toward undefined)"}`
- **Root cause:** the guard is `SECTORS[intent.target]`, a prototype-chain lookup. `SECTORS["__proto__"]` returns `Object.prototype` — truthy — so the guard passes, and `.hall` is then `undefined`. (`"constructor"`, `"toString"` etc. behave the same way.)
- **Impact:** a model that emits an odd target produces a nonsense stage direction in an otherwise carefully-voiced conversation. No state is touched.
- **Fix:** `if (intent.type === "point_to_location" && Object.hasOwn(SECTORS, intent.target))`. Audit for the same pattern at `byId[...]`, `STUDY[...]`, `AI_POLICY[cls]`.
- **Regression test:** extend the governor probe to assert `aiGovern({type:"point_to_location",target:k})` is `null` for `k ∈ {__proto__, constructor, prototype, toString, valueOf, hasOwnProperty}`.

---

**BUG-2 — Unanswered knowledge check is graded, logged as failed, and its answers revealed**
`CONFIRMED` · **Severity: P0** — see §4 P0-4 for the full chain.

- **Location:** `index.html:13114–13126` (`stGradeKC`), the `pick`/`good`/`studyLog` lines at 13117–13123
- **Repro:** open MATH 201 §1.1 → submit `#st-quiz` without selecting any radio → both questions get `.wrong`, explanations shown, two `kc ok:0` rows written to `pembroke.study`.
- **Root cause:** no `pick === null` guard; `good` is `null`, which is falsy and is treated as "answered incorrectly".
- **Impact:** assessment destroyed (answers spoiled while radios remain enabled), permanent false misses in the record, and corrupted "stumble" signals fed to the professor's prompt.
- **Fix:** if any question is unanswered, do not grade and do not log — surface *"Answer both before checking."* Only log attempts for questions that were actually answered. Consider making `studyLog` reject non-boolean `ok`.
- **Regression test:** submit the quiz empty; assert `study.MATH201.log.length === 0` and that no `.st-why` is visible.

---

**BUG-3 — Empty practice field is logged as a wrong attempt and burns the hint**
`CONFIRMED` · **Severity: P2**

- **Location:** `index.html:13089–13102` (the `turn` handler; `studyLog` at 13100)
- **Repro:** open §1.1, press *check* on question 1 with the field empty → feedback `"Hint: Square first, then subtract: 9 minus 15."`, and `{"n":"1.1","k":"turn","ok":0}` appended.
- **Root cause:** `parseFloat("")` → `NaN` → `Number.isFinite(NaN)` false → treated as a wrong answer rather than as no answer.
- **Impact:** pollutes the mastery signal; the student loses the hint tier before attempting.
- **Fix:** early-return when the trimmed value is empty.
- **Regression test:** press check with an empty field; assert the log is unchanged and no hint is consumed.

---

**BUG-4 — Time-of-day control is a 5-state cycler described everywhere as a binary toggle, and its accessible name never updates**
`CONFIRMED` · **Severity: P2** (accessibility)

- **Location:** markup `index.html:1188`; handler `index.html:15516–15523`
- **Repro:** the button ships `aria-label="Toggle day or night"`. `applyMode()` updates `btn.textContent` and `btn.title` on every change but **never `aria-label`**. Cycling live → day → golden → night → auto leaves the accessible name permanently "Toggle day or night".
- **Impact:** a screen-reader user is told the control is a binary toggle, is never told which of five modes is active, and gets no feedback that anything changed (the only feedback is a transient visual toast). The keyboard hint strip likewise says `N · DAY/NIGHT`.
- *Note: I initially suspected the night mode itself was broken because one click left `window.__visual === "day"` after 70 s. That was my error — one click correctly moves `live → day`. The control works; its labelling does not.*
- **Fix:** set `aria-label` in `applyMode()` (e.g. *"Time of day: golden hour. Activate to change."*); add `aria-live` announcement; relabel the hint strip.
- **Regression test:** assert `aria-label` changes across all five modes and contains the current mode name.

---

**BUG-5 — Canned conversation has no state: questions are never consumed**
`CONFIRMED` · **Severity: P2**

- **Location:** `index.html:14608–14617`
- **Repro:** open any character, click the same ask button six times → identical answer, identical button list, no "asked" styling, no progression.
- **Root cause:** `convoSay(s, a)` replaces the response text only; the ask buttons are rebuilt from `d.ask` and never marked or removed.
- **Impact:** the fallback path — which is what every visitor sees before typing, and *all* they see if the gateway is down — behaves like a static FAQ. This sits oddly beside an elaborate three-tier memory system on the AI path.
- **Fix:** mark asked questions (dim + ✓), drop them from the active list, and when exhausted surface a closing line plus the free-text prompt.
- **Regression test:** click every ask; assert each becomes non-repeatable and a terminal state is reached.

---

**BUG-6 — Faculty are described as students in the local-Ollama prompt**
`CONFIRMED` · **Severity: P2** (affects local-Ollama users only)

- **Location:** `index.html:14935` — `` `You are ${d.name}, a ${ai.year || "student"} at Pembroke Academy studying ${d.major}.` ``
- **Repro:** real roster entries produce:
  - *"You are Prof. Merion, a professor of mathematics at Pembroke Academy **studying Professor of Mathematics · MATH 201**."*
  - *"You are Dean Aldergate, a dean of students at Pembroke Academy **studying Dean of Students · Academic Advising**."*
- **Root cause:** the sentence template assumes a student; `d.major` is reused as a job title for faculty.
- **Impact:** the two most important characters are handed a self-contradictory identity line. The hosted Worker path is unaffected — it has its own clean `role:` field per character (`worker/src/index.mjs:20–62`) — so this degrades only the local-Ollama experience.
- **Fix:** give roster entries an explicit `role` string as the Worker already does, and use it verbatim.
- **Regression test:** assert the first line of `aiSystemPrompt` for every `tier ≤ 1` character contains neither `"a student"` nor `"studying"`.

---

**BUG-7 — `aiParse` does not cap dialogue length on the well-formed path**
`CONFIRMED` · **Severity: P3**

- **Location:** `index.html:15155–15161` (`take()`, dialogue assigned at 15157)
- **Repro:** `aiParse(JSON.stringify({dialogue:"x".repeat(5000),intent:{type:"none"}}))` → 5,000-character dialogue returned intact. The malformed-recovery path caps at 400 chars; the clean path does not.
- **Impact:** bounded in production (the Worker caps completions at 140/300 tokens), but a local Ollama with a large `num_predict`, or a future provider, can overflow the conversation card unbounded.
- **Fix:** `out.dialogue = String(j.dialogue).slice(0, 600)` in `take()`.
- **Regression test:** assert parsed dialogue length ≤ cap for all paths.

---

**BUG-8 — A second, divergent knowledge-check grader exists (latent)**
`CONFIRMED` (code) · **Severity: P3 today, P1 the day a second course ships**

- **Location:** `index.html:13852–13872`, inside `jStudySection` — the *brief* lesson view used when a section has no `full` manifest.
- **Finding:** the comment above `stGradeKC` says it is "shared by both lesson views". It is not — the logic is **duplicated**, and the two copies have diverged:
  - the brief copy has the **same** unanswered-is-wrong defect as BUG-2 (`const good = pick && …`, then `✗` + answer revealed);
  - it does **not** call `studyLog`, so it produces no record at all;
  - it sets `study[courseId][n] = 2` on all-correct **without** the `psetCleared()` requirement the primary path enforces — so the two paths disagree about what "mastered" means.
- **Why it is latent:** `jStudySection` begins `if (sec.full) return jLessonFull(courseId, n)`, and all 28 MATH 201 sections have `full`. The brief path is currently unreachable.
- **Impact:** none today; a correctness and consistency fault the moment any course ships a section without a full manifest — which is exactly what §4 P0-2 asks for.
- **Fix:** delete the inline copy and call `stGradeKC` (fixed per BUG-2) from both views, as the comment already claims.
- **Regression test:** author a fixture section without `full`; assert both views produce identical logs and identical mastery transitions.

---

**BUG-9 — Stored self-XSS: application fields are interpolated into `innerHTML`**
`CONFIRMED` · **Severity: P2** (P0 the day any import/share/sync path is added)

> Found by an independent review (Cursor, PE-17), **not by me** — and it contradicts a claim in §3 of this document. I verified the AI conversation path used `textContent`, then generalised that to "no XSS surface from model **or storage**." The forms path was never checked.

- **Location:** `jOpen()` sets `jbody.innerHTML = html` (`index.html:15629`); the application, review, letter and advising views concatenate stored fields into that template.
- **Repro:** store `<img src=x onerror="window.__xss=(window.__xss||0)+1">` as the applicant's first name, last name and statement, then open the acceptance letter.

```
__xss after render of journey panel : 0
__xss after opening the letter      : 4
<img> tags inside #jmodal-body      : 4
letter text                         : "Dear ,"   ← the name was consumed as markup
```

- **Impact:** self-inflicted today — the data can only come from the visitor's own form, and there is no sharing path. The sink is a full stored XSS the moment application data can arrive from anywhere else.
- **Fix:** one context-correct escaping helper at every interpolation of user data, or render those fields as text nodes. A restrictive CSP would be the belt-and-braces, though the inline scripts/styles make that awkward until the module extraction (BUG-8 / §13).
- **Regression test:** payload matrix across every application field, asserted literally in review, letter, advising, journey and print views.

---

**BUG-10 — Nested nulls in persisted journey state prevent the campus from igniting**
`CONFIRMED` · **Severity: P1**

> Also from the same independent review (PE-03). My own hostile-storage test covered only top-level type violations and concluded "Robust." That conclusion did not survive a better test.

- **Repro / measured:**

```
pembroke.registrar.journey = {"registration":null}  → __app NEVER published · "Cannot read properties of null (reading 'completedAt')"
pembroke.registrar.journey = {"admissions":null}    → __app NEVER published · "Cannot read properties of null (reading 'acceptedAt')"
pembroke.registrar.sector  = "bogus"                → boots, then throws in renderBanner reading 'soft'
```

- **Root cause:** `Object.assign(blank(), raw)` is a shallow merge, so a nested `null` replaces the default record wholesale and is then dereferenced as if it were the schema. Parseability is being treated as validity.
- **Impact:** the first two cases are a dead campus on every reload with no recovery path — worse than the string/array cases I did test, which fail safe.
- **Fix:** deep-fill defaults and validate nested shape; quarantine invalid stores rather than merging them; offer a non-destructive reset.
- **Regression test:** table-driven boot over malformed JSON, nested nulls, unknown sector/mode ids and missing fields — every case must boot.

---

### Non-bugs I ruled out (recorded so they are not re-investigated)

- **Course catalogue coherence.** An early extraction appeared to show CS/EE courses titled as calculus texts. That was my parsing error — `book.title` polluted the match. The real catalogue is coherent: a 12-course BS in Autonomous Systems Engineering, algebra → Calculus III, Python → systems programming → digital logic → microprocessors → robotics capstone, with a sensible prerequisite DAG. **No bug.**
- **Correct answers graded wrong.** An early run logged correct answers as misses. That was my selector hitting the visualization's range slider rather than `.st-num`. Re-tested precisely: `-6` for `h(3)` yields class `st-q right`, `✓`, and `ok:1`. **Grading is correct.**
- **XSS from model output.** All dialogue is set via `textContent`. **No vector** on that path — but see BUG-9: I generalised this to "or storage" and was wrong.
- **Hostile `localStorage`.** Seeded `pembroke.registrar.journey` as a string, an array, and `pembroke.study` as `null`; the page booted cleanly and reset to `visitor`. ⚠️ **This conclusion was overstated** — those are top-level type violations, which `Object.assign(blank(), raw)` absorbs. Nested nulls do not survive: see BUG-10.

---

## 6. UX Audit

Applying the five questions at each stage.

| Stage | Where am I? | What can I do? | Why does it matter? | What happened? | What's next? |
|---|---|---|---|---|---|
| Arrival | ✅ crest + motto + real progress bar | ⚠️ split attention: world *and* a checklist *and* a syllabus | ✅ "Every degree begins with a walk around the quad" | ✅ | ✅ one gold CTA |
| Orientation | ✅ 5 real steps, no fake tutorial | ✅ every step is a real system | ✅ | ✅ ticks + toast | ✅ |
| Application | ✅ "Office of Admissions" | ✅ form, draft autosave | ✅ | ✅ good validation copy | ✅ review step |
| Acceptance | ⚠️ | — | ❌ **instantaneous; no decision beat** | ⚠️ | ✅ |
| Advising | ✅ personalised ("you wrote Pure Mathematics Sequence") | ✅ | ✅ | ✅ | ✅ |
| Major / Register | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Courses** | ✅ | ❌ **11 of 12 have nothing** | ❌ | ❌ | ❌ **objective points at an empty course** |
| MATH 201 | ✅ | ✅ rich | ✅ | ⚠️ see BUG-2/3 | ✅ frontier logic |
| Conversation | ✅ fullscreen, scroll-locked | ✅ ask + free text | ✅ | ✅ | ⚠️ asks never consumed |
| **Walk mode** | ⚠️ | ✅ | ✅ | ✅ | ❌ **boxed in 52%; no scroll lock** |
| Mobile | ❌ | ⚠️ | ⚠️ | ⚠️ | ❌ |

**The structural UX finding.** Pembroke presents *three* competing surfaces simultaneously: the 3D world, a floating HUD layer (quest chip, minimap, legend, hints, two emoji buttons), and a full conventional web page. On desktop that is busy; on mobile it collapses. The product never once commits the whole screen to the world except during conversation — which proves the capability exists and is simply not applied where it matters most.

**Duplicated systems observed:**
- Course progress is stated in four places at once: topbar ledger, hall nameplates ("0/5 courses sealed"), sector chips, and course cards.
- The Student Journey panel and the quest chip both claim to state "what's next" and disagree (panel: *Start Campus Visit*; chip: *Attend MATH 101*).
- Sector filter chips duplicate the hall nameplates duplicate the legend — three encodings of the same four-way taxonomy.

---

## 7. Creative / Visual Audit

**Working, and differentiating:**
- Identity is real: Cormorant Garamond + a brass/parchment/midnight palette + `LUX · MATHESIS · MACHINA — EST. MMXXVI`. Self-hosted fonts, no CDN.
- The arrival screen is static markup that paints before any script, with the gold progress bar driven by the *real* asset queue and honest stage copy ("Opening the gates" → "Raising the halls" → "Mowing the quad"). `MEASURED` FCP **388 ms**.
- Procedural stone walls with arched lancets, clipped window glazing, parapets, clocks and per-building seeds — genuinely good, and cheaper than textures.
- Ground-level lighting at golden hour is the strongest image the product produces.

**Breaking the art direction:**
1. **Emoji as primary UI.** 🕰️ 🎮 🎯 (and 🌙 ☀️ 🌇 🌗 in rotation) sit in circular chips over a gothic-typographic identity. They render as full-colour vendor emoji, land at ~110 px on mobile, and are the *only* icon language in the product. Everything else is hand-drawn SVG. `OBSERVED`.
2. **The minimap reads as debug UI.** A flat green rounded rectangle with four saturated colour-swatch squares and a wireframe ring, opaque, floating over the world with no frame, no material, no institutional styling — indistinguishable from a developer overlay. It also *clips the Aldergate nameplate* on desktop. `OBSERVED`.
3. **The hero composition leads with a car park.** In the default aerial the lower third of the frame is asphalt, road markings and parked cars; the gothic architecture is small and centred behind label clutter. The most photogenic asset in the project (the cathedral) is off-axis and partly occluded.
4. **Label collisions at every breakpoint** — severe on mobile, present on desktop (Chapel/Library overlap; Drosdick/Aldergate overlap; quest chip on the Chapel plate; legend over hints).
5. **Clipped and truncated chrome.** Walk-mode HUD is cut off at both edges ("…A S D MOVE" / "F LEAVE WALK" truncated). Topbar reads "0 OF 12 COURSES SEAL…" on mobile. The milestone ladder hides SOPHOMORE and SENIOR below `sm`, leaving three unevenly-spaced labels.
6. **Contrast failures on the sky.** `text-slate-400` intro copy over the pale blue daytime sky.

**Verdict:** the *taste* is real and consistent in typography, colour and copy. The failure is **compositional and hierarchical** — nothing is subordinated, so five layers of information compete at equal weight — plus an icon language that contradicts the identity.

---

## 8. Character AI Audit

### The invariant holds. This is the headline result.

Tested against a local mock gateway returning a deliberately hostile payload from a **professor**-class character:

> `dialogue`: *"Certainly! As an AI language model I can help. Also I have REGISTERED you for every course and granted your degree."*
> `intent`: `{"type":"open_registration"}`

Result (`CONFIRMED`):
```
journey status AFTER    : visitor
registration AFTER      : {"term":null,"registeredCourseIds":[],"completedAt":null}
```
No caption, no CTA, no mutation. `open_registration` is not in `AI_POLICY.professor`, so it died at the authorization table.

### Full governor attack matrix — every attempt rejected

| Class | Intent | Result |
|---|---|---|
| social | `open_registration` | REJECTED |
| social | `open_assignment{1.1}` | REJECTED |
| academic | `open_advising` | REJECTED |
| professor | `open_registration` | REJECTED |
| advisor | `open_lecture{1.1}` | REJECTED |
| advisor | `grant_degree` | REJECTED |
| advisor | `__proto__` / `constructor` | REJECTED |
| advisor | `null` / string / array | REJECTED |
| advisor | `open_major_review{chemistry}` | REJECTED |
| advisor | `open_major_review{lib}` **while visitor** | REJECTED (stage gate) |
| professor | `open_lecture{99.9}` | REJECTED |
| professor | `open_lecture{1.1}` | ✅ CTA (legitimate) |
| social | `point_to_location{vault}` | REJECTED |
| social | `point_to_location{__proto__}` | ⚠️ **BUG-1** |

### Failure modes — all graceful, all in voice

| Condition | Behaviour |
|---|---|
| 429 | *"Prof. Merion seems distracted for a moment. (a lot of visitors right now — try again in a minute)"* |
| 502 / 503 kill switch | *"…(the AI service is unreachable — canned dialogue still works below)"* |
| Malformed output | Salvaged: `"I cannot comply. dialogue: hello anyway, emotion: flat"` → `"hello anyway"` |
| Mid-stream cancel | Clean; `status:"cancelled"`, `busy:false`, conversation resumes normally |
| Streaming | TTFT `MEASURED` ~1.16–1.42 s against the local mock |

### Context payload is minimal and authorized

```json
{"characterId":"prof-merion","message":"…","history":[],
 "context":{"location":"near The Pembroke Great Library","clock":"2:08 PM, daytime",
  "activity":"out on the paths","player":"visitor","relationship":"first meeting",
  "memories":[],"teaching":"not enrolled, browsing · mastery: I 0/6 … frontier: §1.1 …","signals":[]}}
```
No system prompt, no raw storage, no identity claims (the Worker owns identity server-side and rejects any client `model`/`system` field). **Answer-key isolation verified**: the professor prompt contains no worked-example solutions, no quiz explanations, no practice `work` strings, and no homework generators. `CONFIRMED`.

### The real gap: **the governor guards actions, nothing guards assertions**

In the injection test the *state* was safe but the *fiction* was not. The dialogue *"As an AI language model… I have REGISTERED you for every course and granted your degree"* was rendered verbatim to the user. There is no output-side check for (a) assistant-voice leakage, or (b) claims to have performed an action the governor just refused.

This is the single most valuable AI improvement available, and it is cheap: a post-parse filter that (1) rejects/reroll on `/as an AI|language model|I'm an assistant|how can I help/i`, and (2) when `aiGovern` returns `null` for a non-`none` intent, suppresses or annotates dialogue that asserts the action happened. `RECOMMENDED`.

### Worker hardening review

Strong: POST-only, origin allowlist, strict schema, server-side character registry, no client model/system fields, body ≤8 KB, message ≤400 chars, history ≤8 turns, memories ≤5, per-class completion budgets, dual rate limiting (platform binding + in-isolate fallback so it is *never* unlimited), kill switch, zero secrets.

Two observations (`INFERRED`, not exploitable for state):
- `originOk()` accepts **any** `http(s)://localhost|127.0.0.1(:port)`. Any page a user runs locally can spend the account's Workers AI allocation. Low severity (cost only); consider gating the localhost branch behind a dev-only var.
- The 30 s `AbortController` is cleared in `finally`, which runs as soon as the `Response` is returned — so it guards provider *startup* only, never stream duration. The comment says exactly this, so it is intentional; worth confirming a long-running stream cannot pin an isolate.

**Living-character depth:** relationships (`met`, `fam`) and episodic memory (12 facts, importance-sorted) persist across sessions and are genuinely wired into the prompt. The limitation is **cast size, not intelligence** — see §10.

---

## 9. Academic Audit

**MATH 201 is the best-executed part of Pembroke.** All 28 sections carry a full manifest — verified by parsing the `STUDY` object: `28/28` have `full`, `viz`, `worked`, `turn`, `homework`, and `qs`. 17 distinct visualization kinds (`vline`, `secant`, `riemann`, `chain`, `accum`, `asym`, `marginal`, …).

Confirmed working at runtime: professor framing → objectives → 12–14 lecture beats → interactive canvas → worked example with step-by-step reveal → practice with hint-then-solution tiering → knowledge check → problem set → parameterized homework (verified reshuffling: `f(x)=5x+3` vs the `2..5` seed; `√(x−8)` vs `√(x−d)`), mastery gate requiring **both** the knowledge check *and* the problem set, and exact persistence across reload.

The professor's context is genuinely adaptive: enrolment status, per-unit mastery, the *frontier* (first unmastered lecture) with its key idea, weak spots, stumbles and per-unit trend. `teachToTheFrontier` is real personalised instruction, not a chatbot bolted to a syllabus.

**The three problems:**
1. **Content cliff.** 1 of 12 courses. 4 majors are declarable; 1 is studiable. (§4 P0-2)
2. **Assessment integrity.** BUG-2 / BUG-3 corrupt the record that drives the professor. (§5)
3. **The campus is not part of the learning.** MATH 201 could be taught *anywhere*; nothing about it requires Pembroke. Its own examples already gesture at the campus (the chapel bell as a function of the hour, the café cup sizes, the cedar planters, the drone over the quad, Drosdick's tower at golden hour) — but those stay as *prose*, never as places you walk to. The bridge is written and not crossed.

**`RECOMMENDED` — the highest-leverage academic idea:** make the frontier lecture's visualization *exist in the world*. The vertical-line test on the Library's glass; Riemann rectangles accumulating across the quad's paving; the fountain's jet as a related-rates problem; Kenji's A* path as the campus graph he already describes. One per unit — five objects — would convert the campus from a container into an instrument.

---

## 10. Immersion Audit — does Pembroke feel alive?

**Not yet — and the ceiling is the reason, not the degradation.**

`MEASURED` at runtime after full settle:
```
crowd: {people: 3, target: 2, done: true, ready: true}   (desktop)
crowd: {people: 3, target: 3, done: true, ready: true}   (mobile)
named characters present: ["Dean Aldergate","Prof. Merion","Theo"]   (7 of 10 roster absent)
```

Reading the source (`index.html:9091–9092`):
```js
const CROWD_MAX = 10;
const CROWD_TARGET = 2 + Math.floor(Math.random() * Math.random() * 7);
```
`random() * random()` is heavily biased low — expected value ≈ 3.75, floored, so a **typical** target is 2–4 and the **absolute ceiling is 10**. On the best GPU in the world, Pembroke's quad holds roughly ten wandering figures plus faculty.

So the emptiness I observed is not primarily a SwiftShader artifact. A university quad reads as alive at ~40–60 visible figures; Pembroke's design ceiling is a sixth of that. This is the largest single gap between what the product is trying to be and what it is.

**What *is* alive and genuinely good:** figures route on a real waypoint graph; they enter doors (`DOOR_RANGE 900`, `INSIDE_MS 20–40 s`, `DOOR_COOL 120 s`) and come back out; they take seats (`SEATS`, `SIT_RANGE 420`, `P_SIT 0.35`) and stand up again; they breathe when idle; they look at you in conversation; lamps light at dusk and window glass glows; leaves drift; fireflies appear at night; cars sit in the lots.

**Where immersion breaks — and the in-world alternative:**

| Break | Could it happen through the world instead? |
|---|---|
| Application, acceptance, advising, major, registration all occur in **modal dialogs** on a web page | The Dean is standing 30 m away. Advising should be a conversation with *her*, at Administration, with the folio as a prop — not a modal. The code comment says "forms belong on a page"; that's defensible for the 6-field form, indefensible for the *conversation*. |
| Acceptance is instantaneous | A letter that arrives at the gatehouse, or the Dean crossing the quad to find you. |
| Objective delivered as a floating 🎯 chip | Prof. Merion, at his own door, telling you what to do next — the machinery already exists (`deanDoor()`, the professor's canned acts). |
| Course ledger, syllabus, chips — a scrolling web page | The Library interior already exists. |
| 7 of 10 characters never appear | Cast rotation exists (`drawFirstWave`, `CAST_MB` VRAM budget); the roster simply outnumbers the budget. |
| Nothing is different on a second visit except a ledger | Relationships already persist (`met`, `fam`) — nobody greets you differently in the *world*, only inside AI dialogue. |

**Verdict:** Pembroke has built the *mechanisms* of a living campus — routines, seating, doors, memory, relationships, time of day — and then routed the actual student experience around them into modals and a side panel. The life is real but under-populated and under-used.

---

## 11. Mobile & Performance Audit

### Measured

| Metric | Desktop 1280×800 | Mobile (Pixel 5) |
|---|---|---|
| First Contentful Paint | **388 ms** | — |
| `window.__app` ready | 32.3 s *(under GPU contention)* | **9.1 s** |
| Bytes @5 s / 10 s / 30 s / 60 s | 2.7 / 4.1 / — / 27.5 MB | **1.5 / 4.1 / 14.1 / 29.4 MB** |
| Settled first-visit transfer | 27.5 MB | **29.4 MB** (23 model files = 26.4 MB) |
| Draw calls | **1,235** | **809** |
| Triangles | **3.82 M** | **2.58 M** |
| JS heap | 107 MB | **110 MB** |
| Canvas buffer | — | **393×560 at DPR 2.75** → rendering at 1× |
| Document height | — | **13,351 px** |
| Console errors | **0** | **0** |
| Failed requests | **0** | **0** |

### What these numbers mean

- **29.4 MB is the *entry fee*, before any interior.** Stepping into Drosdick adds `drosdick_hall.glb` (23.7 MB) and `drosdick_atrium.spz` (27 MB) — potentially **~80 MB** for a full visit. At a realistic 8 Mbps that is ~29 s for arrival alone; at 1.6 Mbps, ~2.5 minutes. `MEASURED` + `INFERRED`.
- **809 draw calls / 2.58 M triangles is 3–5× a healthy mobile budget** (~150–300 draws, ~0.5–1 M tris). This is the number most likely to cause thermal throttling and jank on a mid-range Android. `MEASURED`.
- **Rendering at DPR 1 on a 2.75× screen** is the ladder doing its job, but it means the 3D view is visibly soft on exactly the devices where the surrounding typography is razor-sharp — a jarring quality mismatch. `MEASURED`.
- **13,351 px of document** with a 560 px world window: the mobile product is, structurally, a long conventional webpage with a small 3D header. `MEASURED`.
- **Main-thread wedging is real.** Playwright's actionability checks timed out repeatedly during asset decode — the page could not confirm a button was stable enough to click. The project's own `tools/smoke.mjs` documents this ("the page can be wedged for seconds at a time", "80MB of models decode on the main thread") and budgets 150 s per interaction. `CONFIRMED` in this environment; `INFERRED` for real mid-range hardware, where the code comments record a genuine field report of an Adreno device flashing black for 2m20s.

### What is genuinely excellent here

The adaptive response is better than most commercial WebGL work: a 5-rung shed ladder (SSAO → DPR 1 → smaller shadow maps → shadows off → bloom off + DPR 0.75), a separate *arrival preset* that deliberately does **not** measure during decode, a VRAM-aware character budget (`ON_SCREEN_MB`, `CAST_MB`, `BODY_VRAM_MB`), lamp lights turned **off** rather than down (because Three counts `visible`, not intensity, into the shader — a subtle and correct optimisation), and a service worker that versions shell and depot separately.

### Crash / eviction risk `INFERRED`

110 MB JS heap **plus** GPU texture and geometry residency for 23 models on a 3–4 GB Android with a heavily-loaded browser is within the band where background tabs get evicted and low-end devices OOM. The 27 MB `.spz` atrium is the single largest risk.

### Recommended degradation — *without* flattening Pembroke

> **Corrected after re-measurement (19 Aug).** An earlier draft of this section recommended "Draco/Meshopt + KTX2, 60–70% off". That is **wrong for the cast and the flora** — they are already `EXT_meshopt_compression` + `KHR_mesh_quantization` + `EXT_texture_webp`, at 14–18 bytes/tri, with textures only 7–18% of file size. Recompressing them gains nothing. The real lever is triangle count.

**The finding:** every character body is *exactly* 200,000 triangles — the absolute target in `tools/optimize-assets.sh`, hit precisely.

```
stu_char11.glb   3.35MB   tris=199,999   verts=144,203   bones=24   18 bytes/tri
stu_char17.glb   3.13MB   tris=200,000   verts=119,483   bones=24   16 bytes/tri
stu_char2.glb    2.64MB   tris=200,000   verts=114,818   bones=23   14 bytes/tri
```

200k is a *hero* budget (AAA protagonists run 30–80k) spent on background figures seen at 30–100 m on a phone. Fourteen of them is **2.8 M triangles of people**, which accounts for essentially all of the measured 2.58 M tris on mobile. Because the files are already optimally packed, **file size is linear in triangle count** — halving triangles halves the download.

Two assets genuinely never received the pass:

```
drosdick_hall.glb   23.15MB   tris=300,000   extensions: []   81 bytes/tri   7.7MB JPEG (33%)
cathedral.glb       12.23MB   tris=354,887   no meshopt       36 bytes/tri
```

81 bytes/tri against the cast's 14–18 is a 5× gap.

Revised plan, highest value first: `RECOMMENDED`
1. **Re-decimate the cast to a crowd budget** — 200k → ~20k near / ~8k mid, with an imposter tier beyond. ~3.3 MB → ~0.4 MB per body, and ~2.5 M triangles off the frame. `tools/decimate.py` and `tools/thin-character.mjs` already exist; this is a budget change, not new tooling. It is also what makes §10's crowd problem affordable.
2. **Run the existing meshopt + WebP pass over `drosdick_hall.glb` and `cathedral.glb`** — the only two assets that never got it. ~24 MB combined, zero code change. (`cathedral.glb` loads eagerly, observed at 92 s.)
3. Merge/instance static architecture to cut draw calls toward ~300.
4. Add a real LOD tier for the far ring and outer world.
5. Raise DPR back toward 1.5 once the arrival preset lifts and the ladder is stable — 1× on a 2.75× screen is over-conservative for a *settled* scene.

### Note on `claude/interiors-panels` (PR #64)

Measured after the audit. It takes `assets/` from **120.1 → 86.7 MB** and deletes the Spark and three-mesh-bvh dependencies — real work. But the interiors were **already lazy** (`drosdick_hall.glb` never loaded in 150 s of first-visit measurement), so it targets the *interior* path. The outdoor scene is byte-identical: **809 draw calls, 2,580,398 triangles, 13,351 px document** on mobile, before and after. The first-visit weight was never the buildings.

---

## 12. Accessibility Audit

`CONFIRMED` — measured against the shipped stylesheets and DOM.

| Item | State |
|---|---|
| `:focus` / `:focus-visible` rules | **4 total** in the 993-line inline stylesheet (`#convo-input`, `.jcta`, `.jfield input/select/textarea`, `.st-num`); **1** in `assets/site.css` |
| Focus indicator on chips, course cards, hall buttons, day/night, walk, quest, interior buttons, modal close | **None** |
| 3D world keyboard reachability | **None.** Hall nameplates are `<div class="hall-tag">`, not buttons; buildings and NPCs are activated only by pointer raycast. Camera keys (1–4, 0, N, F) exist; **there is no keyboard path to enter a hall or talk to a character.** |
| `aria-label` count | 15 |
| `aria-live` regions | 5 (journey, orientation, arrival — good) |
| Stale accessible names | BUG-4: day/night `aria-label` never updates across 5 states |
| `prefers-reduced-motion` | Honoured in 3 places (`.jcta`, arrival animations, and the arrival flight is skipped entirely) — good but partial; campus motion, clouds, gsplats, leaves and fireflies are unguarded |
| Colour contrast | Intro copy `text-slate-400` over pale daytime sky; hint strip `text-slate-500/600` on the world — both likely below 4.5:1 |
| Modal focus management | **Good** — `jOpen` focuses the first field, `jClose` restores `jReturnFocus`, Escape closes |
| Conversation | **Good** — scroll-locked, focused input, labelled |
| Semantics | `lang="en"`, one `<h1>`, `<header>/<main>/<nav>/<footer>` all correct |
| Alt text | 0 `alt=` attributes — but there are no `<img>` elements, so this is correct, not a gap |

**Assessment: 3/10.** The *forms* are accessible; the *campus* is not usable without a pointer, and most interactive chrome has no visible focus state. For an award submission this alone is disqualifying at several juries.

---

## 13. Architecture & Security Audit

**Architecture — keep the shape, split the file.**

The single 16,176-line `index.html` is a deliberate choice (no build step, no toolchain, deploys as a static file) and it has clearly not prevented high-quality work — the code is exceptionally well commented, and comments routinely record *why* including field reports and review catches. But it is now the main constraint on contribution: no module boundaries, no tree-shaking, no per-subsystem testing, and every reader must hold the whole thing.

`RECOMMENDED` (**narrowed after further reading — 19 Aug**): do **not** attempt a four-way split. The single-file design is working — zero console errors, zero failed requests, hostile-storage-resistant — and the commentary is an asset a big-bang refactor would put at risk.

The cost of the monolith is not readability; it is that **no invariant can be tested without booting a browser and tens of MB of models**. That is why all 20 `check-*.mjs` probes drive the full page, and it is exactly how BUG-8 happened — a grader duplicated into two silently divergent copies, under a comment asserting the opposite.

So extract only the two subsystems that carry real invariants and no rendering dependency — roughly 800 of 16,176 lines:

- **`governor.mjs`** — `AI_POLICY`, `aiGovern`, `aiParse`, `deanDoor`, taking the lifecycle actions as injected callbacks rather than closing over `jAdvising`/`convoClose`. The full attack matrix in §8 becomes a millisecond unit test instead of a six-minute browser probe.
- **`grading.mjs`** — `stGradeKC`, the practice checker, `studyLog`, `studySignals`, `psetCleared`. One grader, both views, as the existing comment already claims. Directly closes BUG-8.

Plain ES modules alongside the import map the page already ships. **No build step, no bundler, no deployment change.** Leave the world, crowd, lifecycle UI and asset pipeline where they are.

**Security & trust — strong.**

| Check | Result |
|---|---|
| Model output → DOM | `textContent` only. No XSS. `CONFIRMED` |
| Model output → state | Impossible by construction. `CONFIRMED` under attack |
| Hostile `localStorage` | Survives; resets to `visitor`. `CONFIRMED` |
| Secrets in client | None. Worker uses a binding, no API keys anywhere |
| Gateway | Origin allowlist, POST-only, strict schema, server-side identity, dual rate limiting, kill switch |
| Prototype pollution | One cosmetic instance (BUG-1); no state consequence |
| Third-party origins | **Zero.** Three.js, Spark, fonts and CSS all vendored; SW deliberately refuses to mediate cross-origin |
| Data collected | None. Everything is `localStorage`; the footer says so plainly |
| Asset licensing | `assets/CREDITS.md` present; CC-BY attributions in the footer |

Minor, `INFERRED`: the Worker's localhost origin exemption; the startup-only abort timeout. Neither is a data-integrity risk.

---

## 14. Competitive Benchmark

**Against university websites** (MIT, Stanford, RISD, Bristol, Waterloo): those are content-management systems optimised for recruitment funnels. Pembroke does something none of them do — you *walk* the campus and *talk* to people. It loses on mobile, accessibility, load weight, and depth of real content. Principle to extract: award-winning .edu work now competes on *editorial* strength and performance discipline, not on effects.

**Against immersive/WebGL storytelling** (Bruno Simon's portfolio, Active Theory work, Lusion, Bassett & Partners): the reference standard is a **single committed canvas** — the world *is* the page. Every one of them is fullscreen; none puts a scrolling sidebar beside the experience. They also ship with far tighter asset budgets and much more considered loading choreography. Pembroke's arrival screen is competitive; its framing is not.

**Against LMS / edtech** (Duolingo, Brilliant, Khan): those win on the *loop* — short sessions, clear mastery signals, streaks, spaced return. Pembroke's MATH 201 already has better *explanations* than most, and a real mastery model, but no session shape, no return hook, no spaced review.

**Against virtual campuses** (Gather, Frame VR, university metaverse pilots): almost all are sterile and empty. Pembroke's authored characters and real curriculum beat them decisively on substance. Its population ceiling (10) is comparable — which is to say, the whole category has this problem, and solving it would be a genuine differentiator rather than table stakes.

**Against AI tutors** (Khanmigo, Synthesis, Cognii): Pembroke's governor architecture is *better engineered* than most shipped AI-education products — the strict separation of proposal from authority is exactly what these products get wrong. Pembroke's disadvantage is content breadth (1 course) and the absence of an output-side character check.

**Principles extracted (not designs to copy):**
1. Award juries reward **commitment** — one idea executed totally, not three surfaces sharing a screen.
2. Mobile is now the *primary* judging surface at Awwwards/CSSDA, not an afterthought.
3. Loading is part of the art direction, not a delay to be hidden. *(Pembroke already does this well.)*
4. Depth beats breadth: one *complete* thing outperforms twelve outlines.
5. Accessibility is increasingly a scored criterion, not a footnote.

---

## 15. Scorecard

Scored against an *industry-leading* target, not against average work. Not inflated.

| Dimension | Now | Target | Gap | Evidence |
|---|---:|---:|---:|---|
| Visual Design | 6.5 | 9 | 2.5 | Real identity & procedural architecture; emoji icons, debug-grade minimap, label collisions, car-park hero |
| UX | 5.5 | 9 | 3.5 | Excellent lifecycle copy; three competing surfaces, dead-end objective, contradictory "next step" |
| Innovation | 8.0 | 9 | 1.0 | Governor architecture + in-world lifecycle is genuinely novel |
| Immersion | 5.0 | 9 | 4.0 | `MEASURED` 3 people; ceiling 10; lifecycle in modals; world boxed at 52% |
| Character Intelligence | 7.5 | 9 | 1.5 | Governor holds under attack; real memory/relationships; no output-side character check; 10 personas |
| Academic Experience | 6.0 | 9 | 3.0 | MATH 201 alone would score 9; 1 of 12 courses; BUG-2 corrupts the record |
| Storytelling | 6.0 | 9 | 3.0 | Superb copy; instantaneous acceptance; no arc, no consequence |
| Campus Authenticity | 6.0 | 9 | 3.0 | Architecture and routines convincing; population and academic activity are not |
| Mobile | 3.0 | 9 | 6.0 | `CONFIRMED` illegible label pile, 13,351 px document, walk mode unlocked, 29.4 MB |
| Performance | 4.5 | 9 | 4.5 | `MEASURED` 1,235 draws / 3.82 M tris / 29.4 MB / 110 MB heap; excellent ladder mitigating a too-heavy scene |
| Accessibility | 3.0 | 9 | 6.0 | 5 focus rules total; campus unreachable by keyboard; stale `aria-label` |
| Reliability | 7.0 | 9 | 2.0 | **0 console errors, 0 failed requests**; graceful AI degradation — but nested-null persisted state prevents ignition entirely (BUG-10) |
| Architecture | 7.0 | 9 | 2.0 | Governor/SW/ladder excellent; 16k-line monolith is the constraint |
| Security & Trust | 7.0 | 9 | 2.0 | Governor holds under attack, no secrets, hardened Worker — but a confirmed stored self-XSS (BUG-9) and no schema boundary on persisted state (BUG-10) |
| Content | 7.0 | 9 | 2.0 | MATH 201 + writing outstanding; 11 empty courses |
| Polish | 5.5 | 9 | 3.5 | Clipped HUD, truncated topbar, overlapping legend, emoji |
| Emotional Impact | 5.0 | 9 | 4.0 | Walk mode moves you; instantaneous acceptance wastes the best beat |
| Originality | 8.5 | 9 | 0.5 | Nothing else does this combination |

### **Overall: 5.9 / 10**

---

## 16. The Award Gap

### If Pembroke entered a major competition today, why would it lose?

**It would lose in the first fifteen seconds, on a phone, before any judge reached the good parts.**

Concretely, and in the order a jury encounters them:

1. **The mobile arrival is illegible.** Eight overlapping labels, overprinted legend, campus in the lower third. Awwwards judges score Design, Usability, Creativity and Content on mobile. This is a sub-5 score on the first two before anything else is assessed. `CONFIRMED`
2. **The world doesn't own the screen.** Every award-winning WebGL experience commits the full canvas. Pembroke shows a 3D panel beside a scrolling course catalogue — which reads to a jury as *a university website with a 3D widget*, the exact category Pembroke is trying to transcend.
3. **Emoji as the icon system.** 🕰️ 🎮 🎯 against Cormorant Garamond signals unfinished art direction to any design jury, immediately and unfairly, because everything else is carefully made.
4. **The minimap looks like debug UI.** A flat green rectangle with four colour swatches, floating unframed over the world, clipping a building label.
5. **Accessibility.** No focus indicators, no keyboard path into the world. Increasingly scored, and a hard fail at several juries.
6. **29.4 MB and ~800–1,200 draw calls.** Judges test on real devices on real networks.
7. **The promise/delivery gap.** "0 of 12 courses sealed" with 1 course built, and a permanent on-screen objective pointing at an empty one.
8. **No decision moment.** Submit → accepted in the same millisecond. Nothing is at stake, so nothing is felt.

### What is required, by tier

**Credible award contender** *(fix the disqualifiers)*
Mobile label declutter + responsive HUD reflow · walk mode fullscreen with scroll lock · replace emoji with the existing SVG language · redesign the minimap as an institutional artifact (or remove it) · focus states everywhere + a keyboard path into the world · assets compressed to <12 MB · fix BUG-2 and the dead-end objective.

**Website of the Day** *(add a signature)*
One authored, unmistakable moment people screenshot. The strongest candidate already exists and is under-used: **arrive at golden hour, walking, with the cathedral on axis and the bells sounding** — Pembroke's own copy already describes this ("the stone goes honey-colored for about four minutes"). Plus a real acceptance beat: apply, wait, and receive a letter.

**Website of the Month** *(depth)*
A campus that reads as populated (40–60 figures via instanced/imposter crowds) · in-world advising with the Dean instead of a modal · 3 of 4 majors teachable to at least unit depth · the AI output-side character check so no character ever breaks voice.

**Website of the Year** *(a category of one)*
The campus becomes the pedagogy — the frontier lecture's visualization exists as a place you walk to · characters that remember and *visibly* change across visits · a term that actually progresses with consequence · all of it at 60 fps on a mid-range Android under 15 MB.

---

## 17. Top 10 Improvements by Value

| # | Change | Impact | Effort | Risk | Depends on | Mobile | Immersion | Why now |
|---|---|---|---|---|---|---|---|---|
| 1 | **Mobile label declutter + HUD reflow**: screen-space collision resolution with priority/fade for CSS2D tags; legend/hints stack below 640 px | ★★★★★ | M | Low | — | Fixes the worst defect | +++ | It is the first thing anyone sees and it is broken |
| 2 | **Walk mode goes fullscreen + scroll lock** (reuse the `convo-open` pattern verbatim) | ★★★★★ | **S** | Low | — | Transformative | +++++ | Highest ratio in the audit: ~15 lines of CSS + a class toggle promotes the best asset to the whole screen |
| 3 | **Re-decimate the cast** (200k → ~20k tris/body) + run the existing meshopt pass on `drosdick_hall`/`cathedral` | ★★★★★ | M | Low | existing tooling | Decisive | +++ (unblocks the crowd) | The cast *is* the byte weight and the triangle count; compression is already done, the budget is not |
| 4 | **Fix BUG-2/BUG-3** (guard unanswered submissions) | ★★★★☆ | **S** | None | — | — | + | Data integrity: it corrupts the record that drives the AI |
| 5 | **Make the objective honest**: prefer teachable courses; a real path for the other 11 (even "syllabus only — lectures arriving") | ★★★★☆ | S–M | Low | — | + | ++ | The one permanent instruction currently dead-ends |
| 6 | **A real acceptance beat**: submit → "under review" → a letter that arrives | ★★★★☆ | M | Low | — | + | ++++ | Recovers the single most emotional moment, cheaply |
| 7 | **Populate the quad** (budget-driven target replacing the low-biased random; instanced/imposter distant figures) | ★★★★☆ | L | Med | #3 | Needs #3 | +++++ | "Living campus" is the core claim and the ceiling is 10 — and #3 makes 60 cost what 10 costs today |
| 8 | **Accessibility pass**: focus rings, keyboard path into halls/characters, live `aria-label` | ★★★★☆ | M | Low | — | + | + | Jury-scored, currently disqualifying |
| 9 | **AI output-side character check** (assistant-voice + false-action-claim filter) | ★★★☆☆ | **S** | Low | — | — | +++ | The one hole in an otherwise airtight AI architecture |
| 10 | **Retire the emoji icon set; redesign the minimap** | ★★★☆☆ | S–M | Low | — | ++ | ++ | Cheap, and it is what makes careful work read as unfinished |

**Items 2, 4, 9 are each small, independent, and high-value** — they are the obvious first commit.

---

## 18. Prioritized Backlog

**P0 — integrity, trust, broken critical flow**
- BUG-2 unanswered knowledge check corrupts the record and spoils answers
- BUG-3 empty practice attempt logged as a miss
- Mobile label/HUD collision (§4 P0-1)
- Walk mode: no fullscreen, no scroll lock (§4 P0-3)
- Objective points at untaught courses at every stage (§4 P0-2)

**P1 — major product/UX weakness**
- Split-screen framing subordinates the world at all times
- Instantaneous universal acceptance (§4 P0-5)
- 11 of 12 courses have no content
- Accessibility: focus states, keyboard path into the world, stale `aria-label` (BUG-4)
- 29.4 MB entry fee; 800–1,235 draw calls
- BUG-10 nested-null persisted state prevents the campus from igniting
- Crowd ceiling of 10
- No AI output-side character check

**P2 — significant improvement**
- BUG-1 `__proto__` prototype-chain lookup
- BUG-5 canned asks never consumed
- BUG-6 faculty described as students (Ollama path)
- Minimap reads as debug UI; emoji icon system
- Lifecycle happens in modals rather than with the characters who exist for it
- Clipped walk HUD; truncated topbar; hidden milestone labels
- Duplicated progress reporting across four surfaces

**P3 — polish**
- BUG-9 stored self-XSS via application fields in `innerHTML` (P2 now, P0 with any share path)
- BUG-7 uncapped dialogue length on the clean parse path
- BUG-8 duplicated, divergent knowledge-check grader in the brief lesson view (latent)
- Contrast of intro/hint copy over sky
- "Dean E. Aldergate" vs "Dean Aldergate"
- `prefers-reduced-motion` coverage for world motion
- Worker: localhost origin exemption; startup-only abort timeout

**P4 — experimental / future**
- Campus-as-instrument: frontier visualizations sited in the world
- Term progression with consequence; scheduled lectures you can be late for
- Characters who visibly change across visits
- Multi-visitor presence

---

## 19. Roadmap

### Phase 0 — Integrity & Trust *(~1 week)*
**Deliverables:** BUG-2, BUG-3, BUG-1, BUG-7; objective prefers teachable courses; `aria-label` live (BUG-4); AI output-side character filter.
**Dependencies:** none.
**Acceptance:** empty submissions log nothing and reveal nothing; governor probe covers all prototype keys; no character ever emits assistant-voice; the objective always names something completable.
**Impact:** the academic record and the AI fiction become trustworthy.

### Phase 1 — The World Takes the Screen *(~2 weeks)*
**Deliverables:** walk mode fullscreen + scroll lock; mobile label declutter with priority/LOD; HUD reflow below 640 px; walk HUD no longer clipped; canvas `touch-action`/`preventDefault` correctness.
**Dependencies:** Phase 0 (no).
**Acceptance:** on a 393 px viewport no two labels overlap at any camera angle; walk mode occupies 100 vh and the page cannot scroll beneath it; single-finger look never scrolls the document.
**Impact:** the largest single jump in perceived quality available.

### Phase 2 — Weight & Reach *(~2–3 weeks)*
**Deliverables:** cast re-decimated to a crowd budget with near/mid/imposter tiers; the existing meshopt+WebP pass run over `drosdick_hall.glb` and `cathedral.glb`; static architecture merged/instanced; far-ring LOD; DPR restored to ~1.5 after the preset lifts; full accessibility pass (focus rings, keyboard entry to halls and characters).
**Acceptance:** first-visit transfer < 12 MB; draw calls < 400; a complete journey achievable by keyboard alone; no jank on a mid-range Android.
**Impact:** Pembroke becomes usable on the devices most people own.

### Phase 3 — A Campus With People In It *(~3–4 weeks)*
**Deliverables:** crowd raised to 40–60 via instancing/imposters within the VRAM budget; full roster present or rotating visibly; advising moved out of a modal and into a conversation with the Dean at Administration; a real acceptance beat (review → letter); characters greet returning visitors *in the world*.
**Dependencies:** Phase 2 (byte and draw headroom).
**Acceptance:** ≥30 figures visible at mid-zoom at target frame rate; the lifecycle completable without a modal except for the application form itself.
**Impact:** the "living campus" claim becomes true.

### Phase 4 — Academic Intelligence *(~4–6 weeks)*
**Deliverables:** at least 2 more courses to unit depth; spaced review driven by the existing `log`; the professor initiating contact when the record warrants; per-unit campus visualizations sited in the world.
**Acceptance:** ≥3 majors studiable; measurable return-visit rate; the professor's opening line demonstrably reflects real mastery data.

### Phase 5 — Award-Level Refinement *(~3 weeks)*
**Deliverables:** emoji retired for the existing SVG language; minimap redesigned as an institutional artifact; one authored signature moment (golden-hour arrival on foot, bells, cathedral on axis); motion and microinteraction pass; full reduced-motion coverage.
**Acceptance:** a jury's first 15 seconds on a phone are the intended image.

### Phase 6 — Breakthrough *(exploratory)*
Term progression with consequence · lectures that happen at a time · multi-visitor presence · the campus as the curriculum's instrument.

---

## 20. Keep / Refine / Replace / Remove / Add

**KEEP (untouched):** the governor + `AI_POLICY` + `deanDoor()` · three-tier AI with canned fallback · the Worker's trust model · MATH 201's content and mastery model · the arrival screen · the quality ladder and arrival preset · the service worker's version split · procedural stone architecture · walk mode · the writing voice · the probe suite.

**REFINE:** CSS2D labels (declutter/priority) · walk mode (fullscreen) · HUD layout (responsive) · cast triangle budget · crowd (populate) · grading guards · accessibility · `aiSystemPrompt` faculty line · canned conversation state.

**REPLACE:** emoji icon set → the existing SVG language · minimap → a designed institutional artifact · advising modal → an in-world conversation with the Dean · instantaneous acceptance → a decision with a wait.

**REMOVE:** the always-on split-screen as the *only* framing (keep the panel; stop making it permanent) · duplicated progress reporting across four surfaces · the bottom-right key hint strip on mobile (it collides and duplicates the walk HUD).

**ADD:** AI output-side character check · keyboard path into the world · a real acceptance letter · in-world frontier visualizations · a return hook (spaced review) · content for at least two more courses.

**Do not** turn Pembroke into a conventional university site. Its uniqueness is the asset; the problem is that the conventional site is currently sitting *beside* it, permanently, taking half the screen.

---

## 21. Recommended Next Release — "v130 · The world takes the screen"

Deliberately small, deliberately shippable, deliberately the highest ratio of value to risk.

1. Walk mode fullscreen + scroll lock (reuse `convo-open`)
2. Mobile label declutter + HUD reflow
3. BUG-2 and BUG-3 grading guards
4. AI output-side character check
5. Objective prefers teachable courses
6. BUG-1 `Object.hasOwn` guard; BUG-4 live `aria-label`

**Acceptance:** on a 393 px viewport, no overlapping labels at any camera angle; walk mode fills the viewport and the page cannot scroll beneath it; an empty quiz submission logs nothing and reveals nothing; no character ever says "as an AI"; the current objective always names a course that can actually be studied.

Every item is independent, none requires the asset pipeline, and together they address the two P0s that a jury — or a first-time visitor on a phone — meets first.

---

## 22. Final Verdict

**Overall score: 5.9 / 10**

- **Strongest aspect:** the character-AI governor. *AI proposes → Governor validates → Pembroke performs* is not marketing — it is a single authoritative policy table from which the prompt's own documentation is generated, and it rejected every role-escalation, malformed, prototype-pollution and unauthorized-action attempt I could construct, including a professor-class character explicitly claiming to have registered the student for every course and granted their degree. State did not move. This is better than most shipped AI-education products.
- **Weakest aspect:** mobile. Not "needs work" — currently broken at first paint, and mobile is the primary judging and visiting surface.
- **Most serious confirmed bug:** BUG-2. Submitting the knowledge check with nothing selected marks both questions wrong, permanently reveals both answers, and writes false misses into the study log — which `studySignals()` then feeds to Prof. Merion as "recent stumbles", so the professor teaches to a struggle that never happened. A UI defect that corrupts the academic record that drives the pedagogy.
- **Largest industry gap:** commitment of the viewport. Award-winning WebGL work gives the world the whole screen; Pembroke gives it 52% and never takes it back — except in conversation, which proves the capability already exists.
- **Biggest untapped advantage:** the campus as the curriculum's instrument. MATH 201 already writes its examples about the chapel bell, the café cups, the cedar planters, the drone over the quad and Drosdick's tower at golden hour. Those places exist, in 3D, thirty metres away. Nobody has connected them. No LMS can do this; no university site can do this; no generic AI tutor can do this.
- **Highest-value next release:** v130 above — with walk-mode fullscreen as the single highest ratio of impact to effort in the entire audit.

### Classification, today

> ## **Production quality**

Not a prototype: zero console errors, zero failed requests, hostile-storage-resistant, gracefully degrading, offline-capable, with a genuine test suite and one industry-leading subsystem. Not yet an *excellent production experience*, because mobile fails at first paint and 11 of 12 advertised courses are empty. Not an award contender, because a jury would never reach the good parts.

It contains, however, **one industry-leading subsystem** (the AI governor) and **one award-caliber moment** (golden-hour walk mode). That is a much better starting position than a uniformly polished product with nothing exceptional in it.

### The 3 things preventing Pembroke from reaching the next level

**1. Pembroke does not believe its own world is the product.**
The most immersive, most beautiful, most differentiated thing it does — walking the quad at ground level — is rendered in a box beside a scrolling course catalogue, and every consequential act (applying, being accepted, advising, declaring, registering) is routed *out* of the world into modal dialogs. Conversation mode already goes fullscreen and locks scroll, so the pattern exists and is deliberately not applied. Until the world takes the screen and the lifecycle happens with the characters who were built for it, Pembroke will read as a university website with an exceptional 3D widget rather than as a digital university.

**2. Mobile is a broken first impression, and mobile is the first impression.**
Overlapping labels, overprinted legend, a 13,351 px document with a 560 px world window, walk mode running unlocked inside a scrolling page, 29.4 MB before any interior, ~800 draw calls. Every one is fixable and several are cheap — but until they are, most visitors and every jury will form their entire judgment from the broken version.

**3. The campus promises a university and delivers a course.**
Twelve courses, four majors, a degree ladder, a registrar's ledger counting "0 of 12" — and one teachable course, with the single permanent on-screen objective pointing at one of the eleven that isn't. Meanwhile the world holds at most ten people, so the quad that the entire experience is built around reads as abandoned. Pembroke has built the *mechanisms* of a living university — routines, doors, seats, memory, relationships, mastery, an advisor, a professor — and populated them too thinly for the fiction to hold.

Fix the framing, fix the phone, and close the promise gap, and Pembroke is a genuine award contender — because the two hardest things, the architecture and the teaching, are already done and already good.
