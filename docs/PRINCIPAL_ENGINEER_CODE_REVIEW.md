# Principal Engineer Code Review

Review target: `main` at `a4ae6a0` (`pembroke-v136`)  
Review date: 2026-08-20

This is a read-only review of production code. No production behavior was changed.

## 1. Executive Summary

Pembroke Academy is an unusually capable static application: a roughly 994 KB HTML document contains the catalog, academic interactions, student journey, NPC simulation, Three.js campus, local persistence, and the client side of a governed AI system. A service worker provides offline behavior, and a Cloudflare Worker provides hosted model inference.

The central AI invariant is implemented correctly:

> AI proposes → policy/governor validates → deterministic Pembroke code performs.

`aiParse()` treats model output as data, `AI_POLICY` limits capabilities by character class, `aiGovern()` validates role, journey stage, and targets, and returned CTAs invoke deterministic UI functions. I found no path by which model output directly writes journey, registration, course, grade, relationship, or world state.

The repository is not production-ready, however. The highest-risk confirmed defect is outside the AI path: asset cache invalidation has two version authorities. The service worker caches models under `ASSETS_V`, while the guard and asset-writing workflows rotate `VERSION` (and, in only one workflow, `BUILD`) but never `ASSETS_V`. An in-place model correction can therefore deploy successfully and remain permanently stale for returning visitors.

The next largest risks are:

1. The advertised 48 MB character VRAM ceiling counts only currently visible bodies. It does not release textures or geometry as bodies rotate indoors or are retired, while all 14 bodies are eventually loaded and retained.
2. Persisted state has no schema/version boundary. Two malformed but validly stored values reproduced startup exceptions in critical UI paths.
3. A completed AI request can mutate the singleton conversation UI after its conversation was closed or after a different NPC conversation opened.
4. The primary 3D interaction has no keyboard or screen-reader equivalent, so NPC dialogue and the Campus Visit's normal “talk” step are inaccessible without skipping.
5. The smoke suite looks for an obsolete cache suffix, so its returning-visit checks can pass without examining the production depot.
6. Hosted stream failures can be converted into a successful empty response, and the Worker's 30-second timeout ends before the response stream is consumed.

No P0 was confirmed. There are several P1 defects that should block a production-readiness claim.

### Review evidence

- Current assets occupy approximately 87 MB; `drosdick_hall.glb` is 24 MB and `cathedral.glb` is 13 MB.
- The repository's packed Git history is approximately 1.14 GiB.
- The latest completed `main` smoke workflow succeeded, but its browser drive took about 22 minutes 48 seconds and the full workflow about 23 minutes 26 seconds ([run evidence](https://github.com/justinlooney/Pembroke.Academy/actions/runs/32328062907)).
- The same `main` run skipped `cache-version` because that job is restricted to pull requests.
- The smoke suite searches for cache keys ending in `-assets`; the production depot is `pembroke-assets-v3-depot`.
- A real browser reproduced:
  - invalid sector persistence: `TypeError` in `renderBanner()` at `index.html:12129`;
  - structurally invalid journey persistence: `TypeError` in `Journey.status()` at `index.html:15509`;
  - persisted application markup executing an `onerror` handler in `jLetter()`.
- A direct Worker transform test reproduced:
  - a normal terminated SSE frame emits a token and `{done:true}`;
  - an unterminated final SSE frame emits only `{done:true}`;
  - malformed provider JSON emits only `{done:true}`.

## 2. Architecture Overview

### Runtime map

```text
index.html
├── static catalog: SECTORS, COURSES, FACULTY, STUDY
├── persistence
│   ├── completed-course ledger: pembroke.registrar.completed
│   ├── study/grade data: pembroke.study
│   ├── journey: pembroke.registrar.journey
│   ├── NPC relationships/memories: pembroke.npc
│   └── AI and view preferences
├── Three.js world
│   ├── procedural campus and materials
│   ├── deferred landmark/flora/model loading
│   ├── character retargeting and animation
│   ├── NPC state machines and crowd governor
│   └── one setAnimationLoop() for simulation and rendering
├── DOM workspace
│   ├── course catalog and study player
│   ├── journey/application/advising/registration
│   ├── interiors and conversations
│   └── responsive/touch controls
└── AI client
    ├── hosted Worker, optional Ollama fallback
    ├── NDJSON stream reader and structured parser
    ├── AI_POLICY + aiGovern()
    └── deterministic CTAs

sw.js
├── network-first navigation shell
├── cache-first same-origin assets
└── separate shell and asset cache versions

worker/src/index.mjs
├── origin/schema/rate validation
├── server-owned character and model registry
├── prompt construction
├── Workers AI provider
└── SSE-to-NDJSON transform
```

### Critical execution paths

1. **Startup:** head service-worker registration → module import → WebGL renderer/world construction → core asset loads → render loop → journey/workspace ignition → deferred outer world.
2. **Academic:** course card/study modal → deterministic graders → `study` persistence → manual course seal in `done` → prerequisite and progress rendering.
3. **Student lifecycle:** `Journey` load → Campus Visit → application → immediate acceptance → advising → declaration → registration.
4. **Hosted AI:** conversation submit → `aiGenerate()` → provider chain → Worker validation/prompt/provider → NDJSON reader → `aiParse()` → `aiGovern()` → optional deterministic CTA.
5. **NPC lifecycle:** body loading/retargeting → cast construction → `stepStudents()` state machine → visibility/room governor → conversation reparenting and restoration.

### Authority map

| Concern | Effective authority |
|---|---|
| Journey/admissions/registration | `Journey` object persisted to localStorage |
| Course completion/prerequisites | separate `done` array |
| Lecture mastery/gradebook/signals | separate `study` object |
| NPC familiarity/memory | `NPCStore` |
| Model identity/model choice | Cloudflare Worker |
| Model intent capability | client `AI_POLICY` and `aiGovern()` |
| Model-triggered action | deterministic CTA callback only |
| Offline model freshness | service-worker cache key |

The split between `Journey`, `done`, and `study` is the most important non-AI authority problem. All three represent academic truth but have independent mutation and validation rules.

## 3. Critical Findings

### PE-01 — Asset fixes can remain stale indefinitely

- **Severity:** P1
- **Status:** Confirmed defect
- **File + function/component:** `sw.js:32-48`, `sw.js:64-65`, `sw.js:142-149`, `sw.js:174-185`; `tools/check-sw-version.sh:26-79`; `.github/workflows/materials.yml:81-100`; `.github/workflows/mixamo.yml:346-395`
- **What is wrong:** The model depot is named from `ASSETS_V`, but the cache guard and both asset-writing workflows bump `VERSION`, not `ASSETS_V`. `mixamo.yml` also bumps `BUILD`; `materials.yml` does not.
- **Why it matters:** Changing bytes at an existing asset URL leaves the old cache-first response in `pembroke-assets-v3-depot`. A returning visitor can receive the new HTML and service worker while continuing to receive the old model forever.
- **Reproduction or evidence:** `DEPOT = ASSETS_V + "-depot"` and activation preserves the current depot. `cacheFirst()` returns an existing match without revalidation. Repository-wide search shows no workflow or guard that updates `ASSETS_V`; the workflows explicitly edit `const VERSION`. A `materials.yml` push can additionally leave `BUILD` and `VERSION` inconsistent until a later guard catches it.
- **Root cause:** Cache versioning was split correctly by purpose, but release automation still targets the retired single-version design.
- **Recommended fix:** Make asset identity content-addressed, or have one release helper detect changed existing asset paths and atomically update `ASSETS_V`, `VERSION`, and `BUILD` as appropriate. Update comments and guard logic to describe the actual cache.
- **Regression test to add:** Install the old worker, cache a known asset, change that asset in place, run the release helper, activate the new worker, and assert the next request returns new bytes. Also assert a text-only release preserves the existing depot.

### PE-02 — The character “VRAM ceiling” does not bound retained GPU resources

- **Severity:** P1
- **Status:** Confirmed defect
- **File + function/component:** `index.html:6744-6826` (`CAST_MB`, `ON_SCREEN_MB`), `index.html:6860-6879` (`onScreenBodies`, `roomOnScreen`), `index.html:8564-8665` (character loading), `index.html:10124-10140` (`sweepRetired`), `index.html:4801-4816` (`disposeFigure`)
- **What is wrong:** The 48 MB limit counts visible body identities, not allocated resources. Every character model is eventually loaded into `castLib`; bodies that go indoors are hidden, and retired cloned figures are removed from the scene without disposal. `disposeFigure()` is never called.
- **Why it matters:** The late wave decodes and retains all 14 bodies even though only three may be visible. Once textures have been uploaded, hiding or removing a figure does not reclaim them. A session can approach the full roster footprint rather than the documented three-body ceiling, increasing mobile tab kills and WebGL context loss.
- **Reproduction or evidence:** `later.forEach()` loads every remaining body and `arrive()` retains it in `castLib`. `sweepRetired()` removes roots and mixers only. A repository search finds zero production calls to `disposeFigure()`; a test-only `__dropLoaded()` path does dispose probe loads. The source itself correctly notes at `index.html:4801-4804` that scene removal frees nothing.
- **Root cause:** Admission control is modeled as a visibility/headcount problem, while WebGL memory is a resource-lifetime and ownership problem. Clones also share source resources, so naive disposal is unsafe.
- **Recommended fix:** Introduce explicit resource ownership: a bounded body pool, reference counts for shared geometry/textures/materials, and eviction/disposal when an identity leaves the pool. Measure `renderer.info.memory` and decoded texture bytes rather than assuming visibility equals allocation.
- **Regression test to add:** Rotate through every body under a forced low budget, then assert texture/geometry counts and browser process GPU memory plateau near the configured ceiling and decline after eviction.

### PE-03 — Persisted state can crash startup because it has no schema boundary

- **Severity:** P1
- **Status:** Confirmed defect
- **File + function/component:** `index.html:3138` (sector load), `index.html:12100-12147` (`renderBanner`), `index.html:15485-15518` (`Journey`), `index.html:15921-16005` (`renderJourney`)
- **What is wrong:** `currentSector` accepts any stored string. `Journey` performs a shallow top-level merge and accepts null/wrongly shaped nested records. Downstream code dereferences both as trusted schema.
- **Why it matters:** One stale migration, partial write, manual browser restore, or previous-version shape can disable critical UI on every reload. The sector failure occurs after `window.__app` is published and breaks final workspace rendering; the malformed journey failure occurs earlier and prevents final ignition entirely. There is no recovery UI.
- **Reproduction or evidence:** In Chrome:
  - storing `pembroke.registrar.sector = "bogus"` then reloading throws in `renderBanner()` while reading `S.soft`;
  - storing `{"registration":null}` under `pembroke.registrar.journey` then reloading throws in `Journey.status()` while reading `completedAt`; `window.__app` is never published.
- **Root cause:** Parseability is treated as validity; nested defaults are not deep-merged or validated, and persistence has no schema version/migration.
- **Recommended fix:** Add versioned decoders for every persisted store. Validate enums, arrays, IDs, timestamps, and nested object shape; deep-fill defaults; quarantine invalid data; expose a non-destructive recovery/reset path.
- **Regression test to add:** A table-driven startup test over malformed JSON, null nested records, missing old-version fields, unknown IDs, duplicate IDs, and invalid sector/mode values. Every case must either migrate or fall back without a page error.

## 4. High-Priority Findings

### PE-04 — A stale AI turn can overwrite a later conversation

- **Severity:** P1
- **Status:** Confirmed race in code; timing-dependent reproduction
- **File + function/component:** `index.html:14285-14321` (`convoClose`), `index.html:14399-14461` (`aiWireConvo.submit`), `index.html:14868-14894` (`aiGenerate`)
- **What is wrong:** `submit()` captures an NPC but mutates singleton conversation DOM after `await aiGenerate()`. `convoClose()` aborts and clears `convoView`, but the awaiting continuation has no conversation generation token or current-view check.
- **Why it matters:** Close conversation A and immediately open B: A's completion or abort continuation can replace B's text, append a stale CTA/history, invoke speech, re-show the input row, and focus a control belonging to the wrong conversation. Even without B, it focuses an input inside an `aria-hidden` overlay.
- **Reproduction or evidence:** Delay or ignore abort in a mocked provider, submit to NPC A, close A, open NPC B, then settle A. Lines 14436-14458 unconditionally update shared elements and call `input.focus()`.
- **Root cause:** Cancellation stops transport but does not invalidate UI ownership.
- **Recommended fix:** Assign each opened conversation/turn an immutable generation ID. After every await and token callback, verify the ID and `convoView === s`; otherwise discard the result. Abort and detach token callbacks on close.
- **Regression test to add:** Delayed hosted response with close/reopen; assert no text, focus, CTA, history, relationship, or memory from A reaches B.

### PE-04A — Global shortcuts mutate the campus through an open modal

- **Severity:** P1
- **Status:** Confirmed defect
- **File + function/component:** `index.html:11347-11350`, `11627-11634`, `13727-13733`, `15617-15619` (independent global key handlers)
- **What is wrong:** Campus shortcuts have no common overlay/modal guard. Their focus checks exclude only `input,textarea`, not `select`, buttons, contenteditable elements, or the fact that `#jmodal` is open.
- **Why it matters:** While an application, advising, declaration, or registration modal is visible, `1`–`4` can change sector/open an interior behind it, `F` can enter walk mode, and `N` changes time of day. The visible form and hidden campus can diverge.
- **Reproduction or evidence:** Open the application, focus a `<select>`, and press `2`, `F`, or `N`. The global handlers run because the target does not match `input,textarea`.
- **Root cause:** Keyboard behavior is distributed across four listeners that know their local mode but not the global overlay stack.
- **Recommended fix:** Route global shortcuts through one mode-aware dispatcher. When a modal/conversation owns input, allow only its documented keys; include `select,[contenteditable]` in editable-target checks.
- **Regression test to add:** Open every journey modal and press sector, walk, day/night, and Escape shortcuts from each focusable control; assert no background state changes except the modal's own Escape close.

### PE-05 — Manual course seals bypass prerequisites and mastery

- **Severity:** P1
- **Status:** Confirmed behavior; product-policy defect unless seals are explicitly self-attestation
- **File + function/component:** `index.html:12156-12179` (`courseCard`), `index.html:13666-13696` (`toggleDone`), `index.html:15838-15914` (`jRegister`)
- **What is wrong:** Every course exposes an enabled “Mark Completed” button. `toggleDone()` changes the authoritative `done` ledger without checking prerequisites, study mastery, enrollment, or assessment state. Registration prerequisites and graduation both trust this ledger.
- **Why it matters:** A visitor can mark an advanced capstone complete first, use it to satisfy later checks, and trigger the degree toast without opening a lecture. The study engine's deterministic grading does not govern official completion.
- **Reproduction or evidence:** On a fresh browser, click the completion control on any course in reverse order. `toggleDone()` only adds/removes the ID and `done.length === COURSES.length` confers the degree.
- **Root cause:** `done` began as a checklist and became authoritative academic state after the study and journey systems were added.
- **Recommended fix:** Decide and encode one policy. If seals are self-reported external credit, label them that way and keep them separate from Pembroke mastery. Otherwise derive completion from deterministic course requirements and validate prerequisite transitions.
- **Regression test to add:** Attempt out-of-order completion and graduation with no mastery; assert rejection. Add a positive path that completes requirements deterministically.

### PE-06 — NPC interactions have no accessible equivalent

- **Severity:** P1
- **Status:** Confirmed accessibility defect
- **File + function/component:** `index.html:1217-1275` (campus markup), `index.html:11221-11296` (raycast picking), `index.html:15544-15569` (Campus Visit)
- **What is wrong:** Buildings and named NPCs exist only as WebGL/raycast targets. The canvas is not a keyboard interaction surface, NPCs have no semantic controls/list, and the normal Campus Visit checklist includes “Tap a student and say hello.”
- **Why it matters:** Keyboard-only and screen-reader users cannot perform the talk step or use general NPC dialogue. They can bypass the entire Campus Visit with “skip orientation,” and four other checklist steps have keyboard paths, but bypass is not an accessible equivalent to the primary interaction.
- **Reproduction or evidence:** Tab through a fresh page: focus reaches HTML controls but no NPC. `jOrient("talk")` is reached only through `convoOpen()`, and normal user entry to that function is pointer raycasting. Lines 15580-15596 provide the skip escape hatch, not an NPC interaction.
- **Root cause:** CSS2D name tags are visual labels with `pointer-events:none`; no accessible interaction model mirrors world entities.
- **Recommended fix:** Provide a semantic “People nearby / Places” companion surface backed by the same student/building objects. Buttons should invoke the same deterministic `convoOpen()`/`selectSector()` paths, with distance/availability conveyed in text.
- **Regression test to add:** Keyboard-only journey completion and an accessibility-tree assertion that every currently tappable named NPC and enterable building has one operable semantic control.

### PE-06A — The journey dialog does not enforce modal focus

- **Severity:** P2
- **Status:** Confirmed accessibility defect
- **File + function/component:** `index.html:1363-1372` (`#jmodal`), `index.html:15601-15619` (`jOpen`, `jClose`)
- **What is wrong:** The element declares `aria-modal="true"`, but opening it neither traps Tab focus nor makes the background inert. Each multi-step `jOpen()` also overwrites `jReturnFocus` with an element from the previous modal view, which is removed immediately.
- **Why it matters:** Keyboard and screen-reader users can move into controls behind the visible modal, and closing a multi-step application/advising flow often cannot restore the original trigger.
- **Reproduction or evidence:** Open the application, repeatedly press Tab, and observe focus leave the modal. Advance to Review, then close: `jReturnFocus` refers to a control that was removed when `jbody.innerHTML` changed.
- **Root cause:** Initial focus was implemented, but the complete dialog lifecycle—containment, background isolation, stable opener, and restoration—was not.
- **Recommended fix:** Preserve the opener only on the closed→open transition, make the rest of the page inert while open, cycle focus within the active dialog, and restore focus to the still-connected opener on close.
- **Regression test to add:** Keyboard-only open/Tab/Shift+Tab/multi-step/close sequence; assert focus never leaves the dialog and returns to the launch control.

### PE-07 — The full 3D loop runs while the campus is off-screen

- **Severity:** P1
- **Status:** Confirmed performance defect
- **File + function/component:** `index.html:11810-12034` (main loop), mobile document layout at `index.html:1215-1359`
- **What is wrong:** `renderer.setAnimationLoop()` continuously steps simulation, mixers, leaves, minimap, labels, and the post-processing composer. There is no `IntersectionObserver`, `visibilitychange`, or render suspension when a stacked-layout user scrolls into the long academic workspace.
- **Why it matters:** Below the `lg` breakpoint, the 560 px campus quickly leaves the viewport while the user may spend minutes reading a lecture. The hidden GPU workload continues, consuming battery, thermally throttling the device, and competing with scrolling and input. On desktop, the split layout keeps the campus visible, so this impact is primarily mobile/tablet.
- **Reproduction or evidence:** Search finds no off-screen/visibility lifecycle. Outside conversation/interior branches, `composer.render()` executes every frame irrespective of viewport intersection. Conversation skips most campus work and interior view skips final rendering, but ordinary off-screen coursework does neither.
- **Root cause:** The loop models scene mode but not document visibility.
- **Recommended fix:** Separate simulation and rendering clocks. Suspend rendering and high-frequency animation when the stage is not intersecting or the document is hidden; use a low-frequency catch-up tick for lifecycle state if needed.
- **Regression test to add:** Scroll the stage fully off-screen and background the page; assert render-call and mixer-update counters stop or fall to the documented idle cadence, then resume without a large `dt` jump.

## 5. Performance Findings

### PE-08 — Initial payload and source shape impose avoidable parse cost

- **Severity:** P2
- **Status:** Confirmed architectural cost
- **File + function/component:** `index.html` as a whole
- **What is wrong:** Approximately 994 KB of HTML contains all curriculum prose, question banks, application code, rendering code, and extensive implementation history comments. It is parsed before the module can run and is versioned/deployed as one unit.
- **Why it matters:** Every visitor downloads and parses academic content they may never open. Any edit invalidates the whole shell. It also makes targeted test/import boundaries impossible.
- **Reproduction or evidence:** File size measured at 994,113 bytes; the module runs from line 1386 through line 16111, with curriculum data beginning near line 1443.
- **Root cause:** Successive subsystems were appended to a single static document to avoid a build/runtime module boundary.
- **Recommended fix:** Preserve the static architecture but extract immutable curriculum data and cohesive ES modules. Lazy-load full lesson/question content when a course opens. This is justified modularization, not a framework migration.
- **Regression test to add:** Performance budget for compressed HTML, script parse/evaluation time, and bytes required before first usable campus.

### PE-09 — Per-frame work still allocates and redraws static data

- **Severity:** P2
- **Status:** Confirmed moderate performance issue
- **File + function/component:** `index.html:3873-3893` (`stepLampSpots`), `index.html:10016-10191` (`outHere`, `mayLeaveQuad`), `index.html:11774-11808` (`drawMinimap`)
- **What is wrong:** The loop allocates `[a,b]` every frame, repeatedly creates filtered student arrays in lifecycle checks, and redraws the entire minimap every frame even in aerial mode where no marker changes.
- **Why it matters:** Individually small allocations become steady garbage on the devices already closest to the frame and memory limits.
- **Reproduction or evidence:** These operations execute from the unconditional loop at lines 11979-12021. The minimap has no dynamic content in aerial mode except asynchronously changing colliders.
- **Root cause:** Update scheduling is frame-based rather than dirtiness/event-based.
- **Recommended fix:** Reuse fixed temporaries, count lifecycle roles in one pass, and redraw the minimap only when walker position/heading, mode, size, or colliders change.
- **Regression test to add:** Allocation profile over a five-minute idle aerial session and a render-count assertion for an unchanged minimap.

### PE-10 — Large landmarks are deferred but still have no delivery budget

- **Severity:** P2
- **Status:** Confirmed cost; failure risk inferred
- **File + function/component:** `index.html:5081-5267` (`OUTER`, `loadOuterWorld`), `assets/`
- **What is wrong:** The outer queue includes 13 MB and 24 MB GLBs, and current assets total 87 MB. Deferral and serialization protect startup, but there is no connection-aware opt-out, user intent gate, or maximum session download budget.
- **Why it matters:** Metered/mobile visitors eventually download scenery even if they remain in the academic workspace and never view it.
- **Reproduction or evidence:** `deferOuter()` starts the whole serial queue once the crowd is ready or after 60 seconds; it does not require stage visibility, a vista request, or a suitable connection.
- **Root cause:** “Not on the critical path” is treated as equivalent to “safe to fetch.”
- **Recommended fix:** Gate large scenery on stage visibility and user proximity/intent; honor data-saving signals where available; publish per-asset transfer and decoded-memory budgets.
- **Regression test to add:** Mobile/data-saver session that stays in coursework and asserts no outer-landmark request; positive test loads a requested vista.

## 6. Mobile Findings

### PE-11 — Touch controls are selected by primary hover capability, not actual input

- **Severity:** P2
- **Status:** Inferred risk from standards-defined media behavior
- **File + function/component:** `index.html:681-712`, especially `@media (hover:none)`
- **What is wrong:** The movement pad and mobile-specific instructions appear only when the primary pointing device cannot hover. Hybrid laptops/tablets can report `hover:hover` while the user is actively touching the screen.
- **Why it matters:** A touch user can enter full-screen walk mode without WASD and without visible movement controls.
- **Reproduction or evidence:** Emulate a device with both touch and a hover-capable primary pointer, enter walk mode, then use touch only.
- **Root cause:** Responsive behavior infers current input mode from one static media query.
- **Recommended fix:** Show touch controls after an observed touch/pointer interaction or when `any-hover:none`/`any-pointer:coarse` applies; do not remove keyboard controls.
- **Regression test to add:** Hybrid touch+mouse browser profile using touch to enter and navigate walk mode.

### PE-12 — Conversation content can clip on short mobile viewports

- **Severity:** P2
- **Status:** Inferred risk, not reproduced on the reviewed viewport
- **File + function/component:** `index.html:887-916` (`.convo-card`), `index.html:1278-1295`
- **What is wrong:** The card has `max-height:62%/66%` but no vertical overflow behavior. Academic AI can return up to six sentences, followed by gesture/CTA, input, and authored choices.
- **Why it matters:** Landscape phones and virtual keyboards can push actions beyond the visible card with no scroll path.
- **Reproduction or evidence:** Use a short landscape viewport, open Prof. Merion, return a maximum-length academic reply and CTA, then open the software keyboard.
- **Root cause:** The card was sized for visual composition but not bounded-content overflow.
- **Recommended fix:** Give the content region a scroll container with safe-area padding and keep the input/actions sticky within the dialog.
- **Regression test to add:** 320×568 and landscape mobile snapshots with maximum response, CTA, and open virtual-keyboard viewport.

## 7. AI/Security Findings

### PE-13 — Worker stream errors become successful empty replies

- **Severity:** P1
- **Status:** Confirmed defect
- **File + function/component:** `worker/src/index.mjs:146-173` (`provider.transform`), `index.html:14780-14813` (`aiReadStream`), `index.html:14868-14894` (`aiGenerate`)
- **What is wrong:** The Worker silently drops an unterminated final SSE event or any complete event whose JSON parse fails, then always appends `{done:true}`. The client treats the 200 stream as provider success and `aiParse("")` returns an empty dialogue, preventing provider fallback.
- **Why it matters:** Provider/protocol regressions present as a successful but blank “…” NPC response, with diagnostics marked ready.
- **Reproduction or evidence:** Direct transform test:
  - `data: {"response":"hello"}\n\n` → token + done;
  - the same frame without final blank line → done only;
  - `data: not-json\n\n` → done only.
- **Root cause:** `transform()` accumulates provider bytes correctly, but `flush()` never parses remaining `carry` and never communicates transformation errors; the client has no semantic minimum for success.
- **Recommended fix:** Implement a standards-complete SSE parser, process final carry in `flush`, propagate parse/provider errors, and require at least one valid token plus a terminal event before declaring success.
- **Regression test to add:** Chunk boundaries at every byte, CRLF, multiline `data`, missing final separator, malformed JSON, provider error event, empty completion, and Ollama fallback after hosted semantic failure.

### PE-13A — `open_practice` deterministically opens the wrong surface

- **Severity:** P2
- **Status:** Confirmed functional defect
- **File + function/component:** `index.html:14990-15004` (`aiGovern`)
- **What is wrong:** `open_practice` is grouped with `open_lecture` and `open_interactive`; all three CTAs call `jStudySection()`. The actual problem-set surface is `jPractice()`.
- **Why it matters:** Prof. Merion can correctly propose an allowed practice intent, the governor accepts it, and Pembroke deterministically performs the wrong action. This does not weaken authority, but it breaks the promised AI-to-UI capability.
- **Reproduction or evidence:** Govern `{type:"open_practice", target:"1.1"}` for a professor and invoke its CTA; it opens the lecture rather than Problem Set 1.1.
- **Root cause:** Capability authorization and capability dispatch share a branch even though their destinations differ.
- **Recommended fix:** Keep validation in `aiGovern()`, but dispatch `open_practice` to `jPractice("MATH201", target)` only when `psetOf()` confirms a set exists; otherwise return no CTA.
- **Regression test to add:** Table-test every professor intent and assert its CTA invokes the matching deterministic surface and rejects unavailable targets.

### PE-14 — The Worker timeout protects only provider startup

- **Severity:** P1
- **Status:** Confirmed implementation gap
- **File + function/component:** `worker/src/index.mjs:243-253` (`fetch`)
- **What is wrong:** The timeout is cleared in `finally` immediately after `env.AI.run()` returns a stream. It does not bound a stalled stream.
- **Why it matters:** A provider that starts successfully and then hangs can hold Worker/client resources indefinitely. The browser has its own timeout, but server resource protection should not depend on every client behaving correctly.
- **Reproduction or evidence:** The source comment explicitly says “the timeout only guards startup.” Return a stream that emits one event and never closes.
- **Root cause:** Response creation and stream consumption have different lifetimes, but the abort timer is scoped to the request handler stack.
- **Recommended fix:** Wrap the response stream with a deadline/idle-timeout transform and cancel the upstream reader on timeout or downstream cancellation. Use `ctx.waitUntil` only for bounded cleanup if needed.
- **Regression test to add:** Provider streams that never start, start then stall, and ignore cancellation; assert bounded termination and reader cancellation.

### PE-15 — Body-size enforcement happens after full buffering

- **Severity:** P2
- **Status:** Confirmed implementation; denial-of-service impact inferred
- **File + function/component:** `worker/src/index.mjs:221-235` (`fetch`)
- **What is wrong:** `await req.text()` buffers the entire request before checking `raw.length > CAPS.body`.
- **Why it matters:** The advertised 8 KB boundary does not bound bytes read or memory allocated. A rate-limited public client can still send a much larger body and consume isolate memory/CPU before receiving 413; burst control limits frequency but not per-request cost.
- **Reproduction or evidence:** The size comparison is after `req.text()`. Rate limiting reduces frequency but does not make each accepted request bounded.
- **Root cause:** Logical schema limits were mistaken for transport limits.
- **Recommended fix:** Reject an excessive `Content-Length` immediately and read the body through a byte-counting stream that cancels once the cap is exceeded.
- **Regression test to add:** Chunked and fixed-length oversized bodies; assert the reader is cancelled near 8 KB and the provider is never called.

### PE-16 — Client claims are labeled “Authorized” inside the server prompt

- **Severity:** P2
- **Status:** Inferred prompt-integrity risk; no governor bypass confirmed
- **File + function/component:** `worker/src/index.mjs:111-139` (`systemPrompt`), especially lines 125-136; `index.html:14712-14756` (`aiHostedContext`)
- **What is wrong:** The Worker correctly states that browser context is unverified, but then interpolates `record`, `teaching`, memories, and signals into privileged-looking prompt sections called “Authorized.”
- **Why it matters:** Any direct caller can submit adversarial context that changes dialogue or induces allowed intents. The client governor prevents direct state mutation, so this is not an authority bypass, but the server persona and advice are not trustworthy.
- **Reproduction or evidence:** POST directly with a known advisor character and a `context.record` containing conflicting instructions. Validation checks only type/length.
- **Root cause:** The Worker authenticates character identity but has no mechanism to authenticate campus state; presentation in the prompt overstates provenance.
- **Recommended fix:** Treat all client context as quoted untrusted data, use explicit delimiters/serialization, remove “Authorized,” and keep sensitive decisions in deterministic client code. Do not move state authority into the model.
- **Regression test to add:** Prompt-injection corpus in every context field; assert identity/system text remains structurally separate and returned intents still fail client stage/target validation.

### PE-17 — Persisted application data is inserted as executable HTML

- **Severity:** P2
- **Status:** Confirmed stored self-XSS
- **File + function/component:** `index.html:15634-15695` (`jApplication`, `jReview`), `index.html:15714-15740` (`jLetter`), `index.html:15753-15777` (`jAdvising`)
- **What is wrong:** Application fields are escaped only for some input `value` attributes. `jReview()` and later views concatenate raw names, school, hometown, statement, and interest into `innerHTML`.
- **Why it matters:** Entered markup executes under the application's origin and persists in localStorage. There is no remote sharing path in the current product, which limits severity, but the sink becomes a full stored XSS if import/sync/share is later added.
- **Reproduction or evidence:** Store `<img src=x onerror=window.__xss=1>` as the applicant's first name and open the acceptance letter; Chrome set `window.__xss` to `1`.
- **Root cause:** Static catalog strings and user-controlled application strings share the same template rendering path.
- **Recommended fix:** Render user data with `textContent`/DOM nodes or apply one context-correct escaping helper at every sink. Add a restrictive CSP; the current inline scripts/styles make that harder and should be accounted for in the module extraction.
- **Regression test to add:** HTML/attribute/script payload matrix for every application field across review, letter, advising, journey, print, and hosted-context views; assert text is displayed literally.

### Governor assessment

No direct mutation bypass was found. `aiGovern()`:

- checks role capabilities against `AI_POLICY`;
- validates location/major/lecture targets;
- resolves advisor requests through `deanDoor()` and current journey state;
- returns captions and user-activated deterministic CTAs;
- never accepts arbitrary function names, code, selectors, or state patches.

One maintainability risk remains: the Worker independently documents allowed intents in `INTENT_DOC` while the browser enforces `AI_POLICY`. They match today but are separate release units with no contract test.

## 8. State/Lifecycle Findings

### PE-18 — Registration can retain a now-invalid course that the UI cannot remove

- **Severity:** P2
- **Status:** Confirmed defect
- **File + function/component:** `index.html:13666-13696` (`toggleDone`), `index.html:15845-15914` (`jRegister`)
- **What is wrong:** Existing registered IDs initialize `picked` even if their prerequisites are no longer sealed. A locked row renders no add/remove button, so an invalid selected course is retained and cannot be removed before reconfirmation.
- **Why it matters:** Unsealing a prerequisite creates a contradictory schedule and traps the user in that contradiction.
- **Reproduction or evidence:** Seal MATH101, register a dependent course, unseal MATH101, reopen registration. The dependent course is both `on` and `lock`; line 15864 omits its removal control, and confirmation at lines 15886-15905 does not revalidate `addable()`.
- **Root cause:** Validation applies only to new UI actions, not to persisted selections or transitions in related state.
- **Recommended fix:** Revalidate the full schedule whenever prerequisite state changes and at confirmation. Allow removal of invalid selected courses; block only addition.
- **Regression test to add:** Invalidate a prerequisite after registration, reopen, remove the dependent course, and assert confirmation rejects it if retained.

### PE-19 — Gradebook “quizzes” score conflates knowledge checks with mastery

- **Severity:** P2
- **Status:** Confirmed academic logic defect
- **File + function/component:** `index.html:12834-12872` (`stGradeKC`), `index.html:13377-13468` (`psetCleared`, `jPractice`), `index.html:13528-13558` (`jGrades`)
- **What is wrong:** Passing a knowledge check sets `ext.kc = 1`, but the gradebook computes quiz percentage from `study[section] === 2`. For sections with problem sets, level 2 requires both the knowledge check and problem set.
- **Why it matters:** A student can pass every quiz and still see a 0% quiz component until unrelated problem sets are cleared. The gradebook note explicitly claims it is counting knowledge checks.
- **Reproduction or evidence:** Pass a section's knowledge check, leave its problem set uncleared, open Gradebook. `ext.kc` is true but the quiz numerator excludes the section.
- **Root cause:** One section-level state value represents “opened/mastered,” while component-specific evidence lives separately and the gradebook reads the aggregate.
- **Recommended fix:** Compute each grading component from its own evidence (`ext.kc`, lab, homework, problem set), and define mastery separately.
- **Regression test to add:** Matrix of KC pass/fail × problem-set cleared/uncleared; quiz percentage must depend only on KC while mastery requires both.

### PE-20 — `Journey.get()` exposes mutable authoritative state

- **Severity:** P2
- **Status:** Confirmed architectural risk
- **File + function/component:** `index.html:15486-15518` (`Journey`)
- **What is wrong:** `get()` returns the live state object, and subscribers receive it by reference. Any caller can mutate authority without `patch()`, persistence, or subscriber notification.
- **Why it matters:** The code currently uses `patch()` for mutations, but the public debug/API hook and growing monolith make silent state changes easy. Tests also directly manipulate internals, normalizing the unsafe pattern.
- **Reproduction or evidence:** `Journey.get().registration.completedAt = Date.now()` changes `Journey.status()` without saving or rendering.
- **Root cause:** The service is a convention around a mutable object, not an enforced state boundary.
- **Recommended fix:** Return immutable snapshots/read-only views and expose explicit validated commands for lifecycle transitions.
- **Regression test to add:** Mutating a returned snapshot must not change service state; each command must validate prior stage and emit/persist exactly once.

## 9. Rendering/3D Findings

PE-02 and PE-07 are the major rendering findings. Additional observations:

- The render loop generally reuses vectors/quaternions in hot paths, clamps `dt`, separates raw timing from simulation timing, and disables expensive quality features progressively. These are strong design choices.
- Landmark loads are serialized and texture uploads are staged. Failure of one landmark resolves to `null` rather than blocking the queue.
- Character loading degrades per body/donor rather than taking the cohort down. This is also a strength.

### PE-21 — Replaced and retired figures leak cloned render resources

- **Severity:** P2
- **Status:** Confirmed defect; overlaps PE-02 but has a distinct lifecycle
- **File + function/component:** `index.html:7366-7499` (`prepFigure`), `index.html:8827-8866` (`upgradeBody`), `index.html:10124-10140` (`sweepRetired`)
- **What is wrong:** Each figure is a skeleton clone with its own mixer and, for dressed roaming figures, cloned materials. Body upgrade and retirement remove old roots and mixer records but do not uncache mixer roots/actions or release clone-owned resources.
- **Why it matters:** Crowd turnover grows retained animation bindings and render resources over a long session even when the visible population remains constant.
- **Reproduction or evidence:** Let the late wave upgrade named stand-ins, then force repeated `makeRoomFor(..., urgent=true)` retirement/top-up cycles and compare mixer/resource/heap counts. Both paths perform array splices and `world.remove` without destruction.
- **Root cause:** Object lifecycle ends at scene membership rather than ownership cleanup.
- **Recommended fix:** Add a figure destruction API that uncaches mixer actions/root, distinguishes shared from clone-owned resources, removes CSS2D nodes, and releases reference-counted resources.
- **Regression test to add:** Thousands of retire/top-up cycles with heap snapshots and stable mixer, geometry, material, texture, and DOM node counts.

## 10. Reliability/Error Handling

### PE-22 — Offline navigation fallback handles only thrown network failures

- **Severity:** P2
- **Status:** Confirmed unbounded path; user-visible delay depends on network
- **File + function/component:** `sw.js:188-198` (`networkFirst`)
- **What is wrong:** Navigation awaits `fetch(req)` with no deadline and consults cache only after a network exception. Fast HTTP 5xx responses are returned directly instead of falling back.
- **Why it matters:** Captive portals, black-holed connections, and half-open mobile networks may not fail promptly. An already-cached campus can remain behind the browser's network timeout, or be replaced by a transient 502/504 error page.
- **Reproduction or evidence:** Route navigation to a connection that accepts but never responds; cached fallback is never reached while fetch is pending. Return HTTP 502; `fetch()` resolves, so lines 194-197 are not entered.
- **Root cause:** Network-first freshness has no latency budget.
- **Recommended fix:** Race navigation fetch against a short abort deadline, return cached shell on deadline, and update the cache in the background only if a bounded network response later remains useful.
- **Regression test to add:** Service-worker test with immediate success, HTTP error, thrown failure, and never-resolving fetch; cached navigation must return within the documented bound.

### PE-23 — Copy failure is an uncaught async rejection

- **Severity:** P3
- **Status:** Confirmed defect
- **File + function/component:** `index.html:13634-13640` (`wireCards`)
- **What is wrong:** `navigator.clipboard.writeText(...).then(...)` has no rejection handler.
- **Why it matters:** Clipboard permission/security-context failures provide no feedback and can produce an unhandled promise rejection.
- **Reproduction or evidence:** Deny clipboard permission and press copy.
- **Root cause:** Only the success branch was modeled.
- **Recommended fix:** Catch rejection and show a non-destructive fallback/instruction.
- **Regression test to add:** Mock resolved and rejected clipboard writes; assert correct button state and no unhandled rejection.

### PE-23A — The install manifest references a missing icon

- **Severity:** P2
- **Status:** Confirmed defect
- **File + function/component:** `manifest.webmanifest:11-15` (`icons`)
- **What is wrong:** The manifest declares `assets/icon-maskable.png`, but that file does not exist.
- **Why it matters:** PWA installation requests a missing asset and cannot provide the declared maskable icon, degrading installation and launcher presentation.
- **Reproduction or evidence:** Resolve every manifest icon path against `assets/`; the 192 px and 512 px icons exist, while `icon-maskable.png` does not.
- **Root cause:** Manifest and asset inventory have no integrity check.
- **Recommended fix:** Add a correctly padded maskable icon or remove the declaration until one exists.
- **Regression test to add:** Parse the manifest in CI and assert every declared icon exists and matches its advertised type/dimensions.

## 11. Test/CI Gaps

### PE-24 — The highest-risk cache behavior is tested against the wrong version

- **Severity:** P1
- **Status:** Confirmed test gap
- **File + function/component:** `tools/check-sw-version.sh`, `.github/workflows/smoke.yml:26-35`
- **What is wrong:** The guard claims to protect asset freshness but compares `VERSION`, not `ASSETS_V`. It also runs only for `pull_request`.
- **Why it matters:** The check is green while the production cache key remains unchanged, and it is skipped on direct pushes to `main`. The latest reviewed `main` run shows the job skipped. `materials.yml` can also push a changed `VERSION` without changing `BUILD`, breaking the debug version contract on the same unguarded path.
- **Reproduction or evidence:** Modify an existing GLB and only increment `VERSION`; the guard passes while `DEPOT` is unchanged.
- **Root cause:** Tests retained assumptions from before the shell/depot version split.
- **Recommended fix:** Replace textual version checks with a behavioral cache-upgrade test and run the lightweight guard on both PR and push.
- **Regression test to add:** The PE-01 two-worker install/activate/request scenario in CI.

### PE-24A — Returning-visit cache assertions select a cache that no longer exists

- **Severity:** P1
- **Status:** Confirmed false-green test
- **File + function/component:** `tools/smoke.mjs:645-715` (returning-visit cache checks), `sw.js:64-65` (`DEPOT`)
- **What is wrong:** Both smoke checks search `caches.keys()` for a name ending in `-assets`; the service worker now names the depot `pembroke-assets-v3-depot`.
- **Why it matters:** The “first visit finishes caching” wait times out, then `stillCached` becomes an empty array. The later assertion checks that none of zero recognized cached models were refetched and can pass vacuously, hiding a broken core service-worker contract.
- **Reproduction or evidence:** With cache keys `pembroke-v136-shell` and `pembroke-assets-v3-depot`, `find(k => k.endsWith("-assets"))` returns no key at lines 666 and 699.
- **Root cause:** The depot rename that separated release and asset versions did not update the browser harness.
- **Recommended fix:** Derive the depot name from one shared/generated source or, minimally, select the `-depot` cache and fail if no fetched model is observed in it.
- **Regression test to add:** Assert at least one first-visit GLB is in the selected depot, and assert a reload causes zero network fetches for every entry still present.

### PE-25 — Hosted AI and policy contracts have no hermetic CI suite

- **Severity:** P1
- **Status:** Confirmed test gap
- **File + function/component:** `worker/src/index.mjs`, `tools/check-gateway.mjs`, `.github/workflows/`
- **What is wrong:** There are no Worker unit tests, no mocked stream/provider tests, and no CI workflow invoking `check-gateway.mjs`. The existing script calls production and consumes real inference. The Worker already exports the core hooks needed for hermetic tests, but they are unused.
- **Why it matters:** Schema validation, rate fallback, prompt boundaries, streaming transforms, timeout behavior, and Worker/client intent compatibility can regress without the campus smoke test noticing.
- **Reproduction or evidence:** No test/spec files or package manifest exist; workflows contain no Worker/wrangler/check-gateway step.
- **Root cause:** Browser behavior has accumulated a strong bespoke harness, while the separately deployed server has remained manual.
- **Recommended fix:** Add hermetic Worker tests with a fake AI binding and streams. Add a contract fixture shared by browser and Worker tests; keep production smoke optional/manual to avoid cost and flakiness.
- **Regression test to add:** Validation table, provider failure matrix, stream chunk matrix, rate-limit behavior, and exact client/Worker character/intent contract.

### PE-26 — CI has no true mobile or accessibility gate

- **Severity:** P2
- **Status:** Confirmed test gap
- **File + function/component:** `tools/smoke.mjs:94-100`, `.github/workflows/smoke.yml`
- **What is wrong:** The main browser context is fixed at 1280×800. Touch behavior is partly synthesized later, but there is no mobile context, device scale factor, coarse-pointer media environment, orientation test, accessibility-tree assertion, or automated accessibility audit.
- **Why it matters:** The most constrained memory/layout/input platform and the inaccessible 3D path can remain green.
- **Reproduction or evidence:** The primary context is `browser.newContext({ viewport: { width: 1280, height: 800 } })`. The suite later resizes once and synthesizes touch NPC picking, but it never creates a real mobile/coarse-pointer profile or accessibility gate.
- **Root cause:** Tests grew from desktop rendering regressions and use a software rasterizer that is already very slow.
- **Recommended fix:** Add a small separate fast DOM/mobile/a11y job that blocks heavy model requests and exercises state/UI contracts. Keep the expensive visual/3D suite separate.
- **Regression test to add:** 390×844 coarse pointer, 844×390 landscape, 200% zoom, reduced motion, keyboard-only journey, and accessibility-tree checks.

### PE-27 — Asset-producing workflows are not reproducible

- **Severity:** P1
- **Status:** Confirmed build risk
- **File + function/component:** `.github/workflows/materials.yml:38-39`, `.github/workflows/mixamo.yml:52-67`
- **What is wrong:** Write-enabled workflows globally install the latest `@gltf-transform/cli`, Blender/Ubuntu packages, `gdown`, and related tooling without a repository lockfile, then commit generated binary assets.
- **Why it matters:** Re-running the same source inputs later can produce different GLBs and silently change performance/material behavior. A toolchain release can rewrite production assets directly from CI.
- **Reproduction or evidence:** Both workflows use unversioned global installs and the repository has no `package.json` or lockfile.
- **Root cause:** The repository pins the browser smoke version but not the more consequential asset compiler toolchain.
- **Recommended fix:** Add a locked tool manifest or container image and record Blender/Python/CLI versions in generated metadata. Continue taking security updates deliberately, with review.
- **Regression test to add:** Rebuild a fixed fixture twice in clean environments and compare normalized output/hash and scene metrics.

### PE-27A — The materials post-conversion validator cannot fail the workflow

- **Severity:** P2
- **Status:** Confirmed CI defect
- **File + function/component:** `.github/workflows/materials.yml:41-70`
- **What is wrong:** Both the expected pre-conversion diagnostic and the decisive post-conversion `check-materials.mjs` invocation end with `|| true`.
- **Why it matters:** The workflow can finish green even if deprecated specular-glossiness materials remain after conversion or a file is skipped, allowing white/untextured characters to be committed.
- **Reproduction or evidence:** Make the post-conversion checker exit 1; shell status is forced to success at line 70.
- **Root cause:** A diagnostic exception intended for the pre-conversion scan was copied to the verification step.
- **Recommended fix:** Keep the pre-check informational if desired, but let the post-check fail the job and prevent commit.
- **Regression test to add:** Workflow fixture with one deliberately unconverted material; assert the post-conversion step and job fail.

## 12. Maintainability Findings

### PE-28 — The monolith retains a divergent, currently unreachable grader

- **Severity:** P2
- **Status:** Confirmed latent maintainability risk
- **File + function/component:** `index.html:12640-12873` (`jLessonFull`, `stGradeKC`), `index.html:13566-13620` (`jStudySection`)
- **What is wrong:** Full and compact lesson views have separate knowledge-check markup and grading handlers. One calls `studyLog()` and uses strict booleans; the other does not. All 28 current MATH201 sections have `full`, so `jStudySection()` returns to the full view before the compact handler and the divergent branch is currently unreachable.
- **Why it matters:** This is dead domain logic waiting to reactivate when a non-full section is added. The code comments document that duplicated paths previously carried the same unanswered-question class of defect.
- **Reproduction or evidence:** Compare `stGradeKC()` with the inline submit handler at lines 13597-13617, then observe the `if (sec.full) return jLessonFull(...)` guard at line 13573 and the current STUDY manifest.
- **Root cause:** View and domain transitions are coupled inside rendering functions.
- **Recommended fix:** Extract one deterministic grading command that returns a result; both views render that result. Keep UI-specific DOM code separate.
- **Regression test to add:** Run identical answer vectors through both views and assert identical persistence, signals, mastery, and feedback.

### PE-29 — Browser and Worker AI contracts can drift independently

- **Severity:** P2
- **Status:** Confirmed architectural risk
- **File + function/component:** `index.html:14932-15008` (`AI_POLICY`, `aiGovern`), `worker/src/index.mjs:19-80` (`CHARACTERS`, `INTENT_DOC`)
- **What is wrong:** Character IDs/classes and intent documentation are duplicated across two deployables. The local Ollama prompt is generated from client `AI_POLICY`, but hosted prompts use the Worker's separate `INTENT_DOC`.
- **Why it matters:** A new character/intent can work locally but fail hosted, or be proposed by the Worker and discarded by the browser. Safety remains fail-closed, but functionality silently degrades.
- **Reproduction or evidence:** There is no shared generated artifact or compatibility test.
- **Root cause:** Static hosting and Worker deployment were developed independently.
- **Recommended fix:** Generate a small versioned contract JSON from one source and import/embed it into both builds; keep enforcement in `aiGovern()`.
- **Regression test to add:** Assert every Worker character maps to one client persona/class and every server-documented intent is recognized and no more permissive than the client governor.

### PE-30 — Error swallowing makes persistence failures invisible

- **Severity:** P2
- **Status:** Confirmed observability gap
- **File + function/component:** `index.html:3115`, `3124`, `13703`, `14543`, `14562`, `15499-15502`
- **What is wrong:** Most storage save failures and subscriber exceptions are silently ignored, while `saveDone()` and sector writes have no guard and can throw out of user event handlers.
- **Why it matters:** Private mode/quota/security failures can either make the UI claim progress “saves automatically” while losing it or break the current interaction, depending on which store was touched. Subscriber defects can stop one view updating with no diagnostic.
- **Reproduction or evidence:** Mock `localStorage.setItem` to throw. `saveStudy()`/`Journey.save()` continue silently with memory-only state; `saveDone()` and `selectSector()` propagate the exception.
- **Root cause:** Best-effort persistence has no user-visible durability state.
- **Recommended fix:** Centralize storage with success/failure status, report degraded persistence once, and log subscriber failures in development/tests.
- **Regression test to add:** Quota/security exception tests asserting an explicit “not saved” state without breaking the current session.

## 13. Top 10 Fixes

1. Fix asset-depot invalidation and replace the current version-text guard with a behavioral cache upgrade test.
2. Implement explicit Three.js resource ownership, pooling, and bounded eviction for character bodies.
3. Add versioned schema decoders/migrations for all localStorage stores and recover safely from invalid state.
4. Add conversation generation IDs so cancelled/stale AI work cannot mutate a later view.
5. Define one authoritative academic completion model; remove the unchecked bridge from manual seals to prerequisites/graduation.
6. Add a semantic keyboard/screen-reader surface for nearby people and places, correct modal/dialog focus management, and centralize global shortcuts.
7. Make Worker streaming fail explicitly, drain final SSE carry, and enforce whole-stream deadlines.
8. Suspend expensive rendering when the stage/document is not visible.
9. Add hermetic Worker/policy/stream tests and a small mobile/accessibility CI job.
10. Extract persistence, academic domain logic, AI contract/governor, and rendering into testable ES modules without changing frameworks.

## 14. Recommended Next PR

The next PR should be narrowly titled around **cache correctness for in-place assets**.

Scope:

1. Introduce one release helper that understands `VERSION`, `BUILD`, and `ASSETS_V`.
2. Update `materials.yml`, `mixamo.yml`, and `check-sw-version.sh` to use it.
3. Add a two-version service-worker behavioral test:
   - text-only release preserves the depot;
   - new asset filename fetches normally without a depot flush;
   - changed existing asset path rotates the depot and returns new bytes;
   - retired paths are removed.
4. Fix the smoke harness to select the real depot and require a non-empty cache assertion.
5. Run the guard on both PR and push.
6. Do not combine this with rendering, AI, or curriculum refactors.

This is the safest first change because the defect can make every later asset fix appear deployed while users continue running stale bytes.

## 15. Long-Term Risks

1. **Authority fragmentation:** `Journey`, `done`, and `study` will continue producing contradictory academic states until transitions are modeled in one domain layer.
2. **Resource growth:** adding characters increases disk, decoded memory, retarget cost, CI duration, and long-session GPU retention nonlinearly.
3. **Monolithic blast radius:** every subsystem shares one module evaluation and one global namespace; a late persistence/UI exception can prevent unrelated ignition.
4. **Test economics:** a 20+ minute browser drive discourages broad matrices and fast iteration. More behavior should be tested below the full rendered campus.
5. **Deployment drift:** the static site and Worker have separate contracts, release processes, and observability.
6. **Client-only authority:** localStorage is suitable for a self-guided simulation, not a trustworthy academic record. Any future account/sync feature must establish a server authority boundary without giving models mutation rights.
7. **Prompt provenance:** server-owned persona and model routing are good, but untrusted browser claims cannot become authoritative merely by being moved into a system prompt.
8. **Accessibility debt:** adding more world-only interactions increases the cost of eventually providing an equivalent semantic interaction model.
9. **Asset history growth:** current Git packs are approximately 1.14 GiB; continued binary replacement will make clones, CI checkout, and maintenance progressively more expensive. Consider Git LFS or an immutable artifact store based on operational constraints.
10. **Operational visibility:** diagnostics are excellent in-browser, but there is no production telemetry for Worker error classes, stream truncation, WebGL context loss, or persistence failures.

## Final Assessment

- **Overall code quality score:** **5.8/10**
- **Highest-risk defect:** Asset cache invalidation updates `VERSION` while model freshness is keyed by `ASSETS_V`.
- **Highest-value fix:** Make asset release/cache behavior single-authority and behaviorally tested.
- **Biggest architectural strength:** The AI capability boundary is explicit, fail-closed, and preserves “AI proposes → governor validates → deterministic code performs.”
- **Biggest architectural weakness:** Authoritative application/domain state and rendering resource ownership are conventions spread through one global monolith rather than enforced module boundaries.
- **Classification:** **Prototype** — sophisticated and well-observed, but not production-ready because multiple P1 correctness, memory, accessibility, persistence, and delivery defects remain.
