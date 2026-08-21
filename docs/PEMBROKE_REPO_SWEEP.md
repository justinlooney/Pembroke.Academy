# Pembroke Academy — repository sweep

**Dead code, stale references, latent breakage, and naming.**
Measured on `main` at v149. Every number below came from a script over
the tracked files, not from reading; the method is given for each so it
can be re-run and disagreed with.

Findings are marked **MEASURED** (a script counted it), **CONFIRMED**
(measured and then verified by hand), or **JUDGEMENT** (a call about
what should happen, which is yours to make).

---

## 1. What is already clean

Negative results are worth as much as the findings, and three of these
surprised me.

| check | result |
|---|---|
| assets referenced by nothing | **0 of 70** — MEASURED |
| `getElementById("x")` where no `id="x"` exists | **0 of 73** — MEASURED |
| `sw.js` naming files absent from the repo | **5, and all five are in `RETIRED`** — CONFIRMED |

That last one was my own false positive: a script flagged five missing
files, and all five are listed in `RETIRED`, which is precisely the
list for assets that have been deleted and must be evicted from the
depot. The mechanism works. Excluded.

There are **239 top-level functions** in `index.html` and exactly one
is never called (§3).

---

## 2. Latent breakage

### 2.1 Three test ports are claimed twice — CONFIRMED

```
8311   check-onscreen.mjs     check-rig-names.mjs
8321   check-dialogue.mjs     compare-lod.mjs
8361   check-roles.mjs        check-sitting.mjs
```

Each of these probes stands up its own static server on a fixed port.
The pairs above cannot run at the same time — the second gets
`EADDRINUSE` and dies before it checks anything.

It has not bitten because in each pair at most one is wired into CI,
and the CI jobs are separate runners. **It bites the day anybody adds
the other one to a job that already runs its partner**, and it will
present as a broken checkout rather than as a port clash.

`check-rig-names.mjs` and `check-roles.mjs` are both in CI today. Their
partners are not. That is luck, not design.

### 2.2 Twenty-two probes each carry their own web server — MEASURED

Twenty-two files under `tools/` contain a `createServer` block, a MIME
table, and a `chromium.launch` with the same three flags. The typical
preamble is 26–50 lines; six of those files were written in the last
day, by me, each one a copy of the last.

The ports were hand-picked per file, which is why §2.1 exists.

**JUDGEMENT:** this is the strongest argument in the sweep for a shared
`tools/_harness.mjs` — one server that takes a port from a counter or
from `0` (let the OS assign), one launch, one `boot(page)` helper.
It would delete the port collision class outright rather than fixing
three instances of it.

---

## 3. Dead weight

### 3.1 The pre-WebGL campus — CONFIRMED

`#scene` does not exist. Not in the markup, not created in any script.
Every rule that hung under it — buildings as transformed divs (`.b3d`,
`.wall`, `.roof`, `.spire-n`), students as stacked boxes (`.torso`,
`.legs`, `.rig`), trees as sprites — has been unreachable since three.js
started drawing this place.

Six `#scene` rules were deleted in v149. **51 selector tokens remain**,
listed in the `LEGACY` set in `tools/check-css.mjs` so that anything
*new* fails the build while the debt stays visible and named.

Orphaned by that deletion and still present:

- `@keyframes campus-breathe` and `@keyframes warp` — MEASURED, 2 of 12
  keyframes are now unreferenced
- `--tiltX` and `--tiltZ` — MEASURED, 2 of 25 custom properties are now
  unread

Both sets were live only through `#scene`'s transform.

### 3.2 `mkPerson` — MEASURED

One function of 239 is defined and never referenced again.

### 3.3 Two scratch scripts wearing a shared-module prefix — CONFIRMED

`tools/_look.mjs` and `tools/_site.mjs` carry the `_` prefix that in
this repo means "shared helper". Neither exports anything. Both
hard-code `/home/user/Pembroke.Academy` as an absolute path and a
single port. Both are one-off debugging scripts from earlier work —
`_site.mjs` waits for a residence hall, `_look.mjs` frames a camera.

They are the most misleading files in the tree, because they look
exactly like the thing §2.2 says is missing.

### 3.4 Tools nothing references and CI never runs — MEASURED

```
check-animations.mjs   check-dialogue.mjs   check-onscreen.mjs
compare-lod.mjs        weigh.mjs            png-in-terminal.py
clips/Standing_Idle.fbx
```

**JUDGEMENT:** some of these are plausibly useful by hand
(`compare-lod`, `weigh`). Deleting them loses knowledge; keeping them
unmarked means the next person cannot tell an abandoned script from a
working one. A `tools/README.md` naming which are CI-enforced, which
are manual, and which are kept for reference would settle it — the full
table is in §6.

### 3.5 Seventeen debug hooks nothing reads — MEASURED

`index.html` publishes **61** `window.__*` hooks. Of those:

| | |
|---|---|
| read by a tool or workflow | **37** |
| used only inside `index.html` | **7** |
| **read by nothing, anywhere** | **17** |

The seventeen: `__aiHealth`, `__arrival`, `__doorGlows`, `__doorTrip`,
`__drosdickHallIn`, `__focusVista`, `__hallTags`, `__ink`, `__interior`,
`__nearby`, `__opening`, `__preset`, `__refreshQuest`, `__signals`,
`__sitCheck`, `__trace`, `__traceSay`.

Three of those (`__ink`, `__opening`, `__nearby`) are mine, added in the
last day "so a probe can reach this" — and then I wrote the probe a
different way and never removed the hook. That is the mechanism by
which the other fourteen got here.

**JUDGEMENT:** a hook with no reader is a maintenance cost and a
slightly larger attack surface, but several of these are cheap
insurance for the next probe. Worth a decision, not an automatic
deletion.

---

## 4. Naming

### 4.1 One real inconsistency — CONFIRMED

```
LS_DONE     pembroke.registrar.completed
LS_JOURNEY  pembroke.registrar.journey
LS_MODE     pembroke.registrar.mode
LS_QUEST    pembroke.registrar.quest
LS_SECTOR   pembroke.registrar.sector
LS_SOUND    pembroke.registrar.sound
LS_STUDY    pembroke.study              ← the odd one out
```

Six of seven agree. `LS_STUDY` is the one holding lecture mastery — the
most valuable data the product stores.

**JUDGEMENT:** renaming it strands every existing visitor's progress
unless a migration reads the old key once and writes the new. That is
a real cost for a cosmetic gain, and the honest options are (a) migrate
properly, or (b) leave it and write down why. What is not defensible is
leaving it undocumented, which is the current state.

Every storage key goes through an `LS_` constant — **no bare
`localStorage` strings anywhere.** That part is clean.

### 4.2 Two conventions that are working — MEASURED

These are strengths and should not be "unified" into something worse.

**Function families.** 17 `j*` (journey), 13 `ai*`, 5 each of `study*`,
`render*`, `engine*`, `convo*`. A reader can tell which subsystem a
function belongs to from its name alone.

**CSS families.** `st-` (28, the lecture surface), `int-` (19,
interiors), `convo-` (11), `arr-` (6, arrival), `nb-` (6, nearby),
`jl-`/`jmodal-`/`jc-`/`jtt-` (the journey's four distinct surfaces),
`q-` (quest), `tok-` (syntax tokens).

The `j` family has four sub-prefixes, which looks fragmented until you
notice each names a different surface — the letter, the modal, a course
card, the timetable. That is a convention, not a mess.

### 4.3 Tool naming — MEASURED

Two families, both consistent: **`check-*`** for the sixteen verifiers,
and bare verbs for the ten that *do* something (`weigh`, `decimate`,
`thin-character`, `flatten-scenes`, `vendor-three`, `make-assets`,
`optimize-assets`, `mixamo-plan`).

Two blur the line: `character-sheet.mjs` and `inspect-rig.py` are
inspectors named as nouns. Minor.

---

## 5. What I would do, in order

| | what | why | cost |
|---|---|---|---|
| 1 | Delete `_look.mjs`, `_site.mjs` | They advertise the shared harness that does not exist | minutes |
| 2 | Delete the two orphaned keyframes and two custom properties | Already dead, orphaned by v149 | minutes |
| 3 | `tools/_harness.mjs`, ports from the OS | Removes the port-collision class outright, not three instances | hours |
| 4 | `tools/README.md` with the §6 table | Tells the next person which scripts are load-bearing | an hour |
| 5 | Decide on the 17 hooks and the 51 legacy tokens | Both are named and visible now; neither is urgent | judgement |
| 6 | Decide `LS_STUDY` | Migrate or document; do not leave it silent | judgement |

`mkPerson` is one line to remove and belongs with (2).

---

## 6. The tool inventory

**CI-enforced (16).** `check-a11y` · `check-breath` · `check-css` ·
`check-gateway` · `check-ledger` · `check-materials` · `check-opening` ·
`check-owner` · `check-rig-names` · `check-roles` · `check-sound` ·
`check-stance` · `check-sw-version` · `check-worker` · `flatten-scenes` ·
`smoke` · `thin-character` · plus the `mixamo-*` and `inspect-rig`
authoring chain.

**Documented but manual (6).** `check-character` · `check-donor` ·
`check-frame` · `check-sitting` · `decimate.py` · `optimize-assets.sh` ·
`make-assets` · `build-css.sh` · `vendor-three`.

**Referenced by nothing (7).** `_look` · `_site` · `check-animations` ·
`check-dialogue` · `check-onscreen` · `compare-lod` · `weigh` ·
`png-in-terminal.py` · `clips/Standing_Idle.fbx`.

---

## 7. Method

Every finding above is reproducible from the tracked files:

- **assets** — every file under `assets/`, searched for by basename,
  stem and path across all text files
- **ids** — `id="…"` and `.id = "…"` versus every `getElementById("…")`
- **functions** — `function name(` versus the count of `\bname\b` in the
  file; a count of one means the definition is the only mention
- **hooks** — `window.__x =` versus mentions in `index.html` and,
  separately, in `tools/` and `.github/`
- **keyframes and custom properties** — declaration versus use inside
  the `<style>` block and `var(--x)` across the file
- **ports** — the first integer in each probe's `PORT =` or `listen(`
- **tools** — basename mentions across the repo, excluding the file
  itself, split by whether `.github/` mentions it

The one thing this sweep does **not** examine is whether a live rule is
overridden by a later one, or whether a called function does anything
useful. Both are beyond a static pass; the first is why
`.moon{right:24%}` sat above the breakpoint that owned it for an hour
without complaint.
