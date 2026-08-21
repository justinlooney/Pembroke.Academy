# Pembroke Academy — repository integrity audit

**Forensic pass over the whole repository: broken, stale, silently
failing, contract-drifted, and materially suboptimal code.**

Measured on `claude/pembroke-academy-audit-9y245r` at `pembroke-v150`,
Three.js **r170** (vendored, `assets/vendor/three/build/three.module.js:6`).

Every claim below is either **MEASURED** (a probe observed it in a
running browser), **CONFIRMED** (measured, then the mechanism verified
in source), or **PROBABLE** (mechanism proven in source, effect not
directly observed). Nothing is asserted from reading alone. Where an
experiment failed, the failure is reported rather than the number it
produced — §9.4 is one of those.

> **On the line numbers.** Every `index.html:NNNN` below was exact
> against `pembroke-v150`, the tree this was measured on. They are a
> **snapshot, not an address**: any commit that adds a line above a
> citation moves it, and several already have — the accessibility fix
> that landed alongside this audit shifted the CSS citations by 4 and
> the script ones by 19. Each finding quotes the code it is about, so
> **search for the quoted line, and read the number as a hint.** Fixing
> this properly would mean citing by anchor rather than offset; that is
> a change to how this document is written, not a correction to what it
> found.

No production code was modified.

---

## 1. Executive summary

I went looking for a repository hiding breakage behind fallbacks. That
is not what the evidence shows, and saying so plainly is more useful
than a long list.

**Nine whole-system checks came back clean.** Zero dead
`getElementById`. Zero JS selectors that can only return null. Zero
classes JS adds that no CSS rule styles. Zero deprecated Three.js APIs
against r170. Zero `new THREE.*` allocations inside any of the fifteen
per-frame functions. Zero 404s, page errors, or unhandled rejections
across a thirteen-state end-to-end trace. Zero materials carrying
`transparent` and `alphaTest` together. Zero images decoded into more
than one texture. The AI intent contract agrees in **both** directions.

**Seven defects are real**, and one of them is the kind this audit was
commissioned to find: a typographic token that does not exist, whose
absence is invisible because it is read through a `var()` fallback.
The registrar panel's headings render in **Georgia** while Cormorant
Garamond sits loaded and available in the same document. Measured, not
inferred.

**One structural performance finding** is larger than all the defects
combined: the settled scene submits **~1,239 draw calls**, frustum
culling removes **7 of 527** visible meshes from the default viewpoint,
and the five-rung quality ladder — which is otherwise well built —
contains **no lever that reduces draw calls**. A device that is
draw-call-bound gets no relief from it at any rung.

| | count |
|---|---|
| confirmed defects | **5** |
| probable defects | **2** |
| structural performance findings | **1** |
| naming-contract failures | **1** (and it corrects my own earlier sweep) |
| verified-clean whole-system checks | **9** |

### The question asked

> **Is Pembroke currently hiding broken or stale behaviour behind
> fallbacks, compatibility code, or successful-looking UI?**

**Yes — in exactly one place, and it is small.** §7.1 proves it: two
CSS custom properties are read that were never declared, and the
`var(--x, fallback)` idiom converts "this token does not exist" into
"this looks deliberate". The page renders, nothing errors, no probe
fails, and the wrong font ships.

**Everywhere else the answer is no**, and the evidence is the nine
clean checks above rather than an absence of looking. Three of the
mechanisms I went in expecting to find — zero-intensity lights stuck in
the shader, per-frame vector allocation, a shadow pass running every
frame — are not merely absent but **explicitly handled, with the
reasoning written down at the call site**. §4.5 is an example: I had
the defect half-written before the code's own comment told me why it
was wrong.

---

## 2. Architecture and contract map

The campus is a single 17,428-line `index.html` carrying the whole
client, plus a Cloudflare Worker (`worker/src/index.mjs`, 349 lines), a
service worker (`sw.js`, 246 lines), and 38 GLB assets.

| contract | from | to | enforced by | state |
|---|---|---|---|---|
| JS ↔ DOM | 73 `getElementById`, 49 `querySelector` literals | markup + template literals | `check-a11y`, this audit §5.1 | **clean** |
| JS ↔ CSS | 24 `classList` tokens | `<style>` rules | `check-css` | **clean** |
| CSS ↔ DOM | 267 selector tokens | live classes | `check-css` (51 known-dead fenced) | **clean + fenced** |
| CSS ↔ CSS | 37 `var(--x)` reads | 25 declarations | *nothing* | **2 broken** — §7.1 |
| events ↔ handlers | 79 `addEventListener` | 0 custom events; all native | this audit §10.2 | **clean** |
| state ↔ persistence | 9 localStorage keys | 3 constant families | *nothing* | **drifted** — §6.1 |
| asset path ↔ loader | 70 assets | GLTFLoader + `sw.js` DEPOT | `check-sw-version` | **clean** |
| GLTF node ↔ code | bone/clip names | `boneKey`, `CAST_FILES` | `check-rig-names`, `check-roles` | **clean** |
| character ID ↔ AI | `CHARACTERS` (10) | roster + `AI_POLICY` | `check-worker` | **clean** |
| course ID ↔ academics | `COURSES` | `STUDY`, prerequisites | `check-ledger` | **clean** |
| client ↔ Worker | request schema | `validate()` | `check-worker` | **clean** |
| AI intent ↔ governor | `INTENT_DOC` (12) | `AI_POLICY` | `check-worker`, and §6.2 checks the reverse | **clean both ways** |
| UI action ↔ mutation | `deanDoor()` | `Journey.patch()` | `check-ledger`, `check-owner` | **clean** |

The single `index.html` is not itself a defect. Every contract above
that has an owner is holding; the two that drifted (`var()` tokens,
storage keys) are precisely the two with **no enforcement at all**.
That correlation is the most useful structural fact in this report.

---

## 3. P0 / P1 defects

**No P0.** Nothing found renders the product unusable, loses visitor
data, or exposes anything.

### P1 — the draw-call budget has no floor the quality ladder can lower

See §9.1 for the full measurement. Summarised here because it is the
only P1 and it is structural rather than a bug.

---

## 4. Three.js (r170)

### 4.1 CONFIRMED · P2 · the environment blur is clipped, and says so twice per boot

**File** `index.html:3802`

```js
world.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
```

**Evidence** — every boot, twice, in the console:

```
sigmaRadians, 0.06, is too large and will clip,
as it requested 30 samples when the maximum is set to 20
```

**Root cause** — `three.module.js:16951-16959`, `PMREMGenerator._halfBlur`:

```js
const sigmaPixels = sigmaRadians / radiansPerPixel;
const samples = 1 + Math.floor( STANDARD_DEVIATIONS * sigmaPixels );
if ( samples > MAX_SAMPLES ) console.warn( … );   // MAX_SAMPLES = 20
```

The blur is **clamped to 20 samples and rendered anyway**. The
environment map is therefore sharper than the value in the source asks
for — not by an amount anyone would notice on the quad, but the number
in the code does not describe what the GPU produced, and a reader
tuning it would be tuning a value the library ignores.

**Impact** — cosmetic and diagnostic. Two console warnings per boot in
production is noise that trains people to ignore the console, which is
how the *next* warning gets missed.

**Smallest safe fix** — lower sigma until `1 + floor(3 × sigma/radiansPerPixel) ≤ 20`,
or pass `Infinity` for the library's own default. Do not silence the warning.

**Regression test** — `check-opening` already boots a page; assert the
console carries no `sigmaRadians` warning.

### 4.2 CONFIRMED · P3 · `PMREMGenerator` is never disposed

**File** `index.html:3801-3802`

`new THREE.PMREMGenerator(renderer)` allocates internal render targets,
`_lodPlanes` geometry, and the blur/cubemap/equirect materials. The
repository calls `.dispose()` **8 times total** (`grep -c '\.dispose()'`)
and none of them is this one. Three.js's own documented usage disposes
the generator once the environment texture has been produced.

**Impact** — a one-time GPU allocation held for the whole session.
Small, permanent, and free to fix.

**Smallest safe fix** — `pmrem.dispose()` on the line after `fromScene`.
The returned `.texture` stays valid.

### 4.3 CONFIRMED · P2 · `resize()` never re-reads `devicePixelRatio`

**File** `index.html:4362-4386` (`resize`), set once at `3782`

**Evidence** — measured directly. Override DPR, dispatch `resize`, read back:

```json
{ "devicePixelRatioNow": 3,
  "pixelRatioBefore": 1, "pixelRatioAfter": 1,
  "bufferBefore": [666,721], "bufferAfter": [666,721] }
```

`resize()` calls `setSize`, `composer.setSize`, `labelRenderer.setSize`,
updates `camera.aspect`, fog and plate layout — and never touches
`setPixelRatio`. The only writers are line 3782 (once, at boot) and the
quality ladder (4021, 4027, 4102, 4111).

**Root cause** — pixel ratio was treated as a boot-time constant. It
is not: **browser zoom changes `devicePixelRatio` in Chrome and fires
`resize`**, as does moving a window between displays of different
density.

**Impact** — after zooming, the canvas keeps the old density while the
CSS size changes. At 200% zoom the campus renders at roughly half the
device pixels it should and looks soft; the HUD text beside it stays
crisp, which is what makes it read as a rendering fault.

**Smallest safe fix is NOT a one-liner, and that is why this is still here.**
Naively re-reading DPR in `resize()` would **stomp the quality ladder**:
a phone dropped to `0.75` for performance would jump back to `2` on
every orientation change, undoing rungs that never climb back by
design. The fix has to re-derive the *ceiling* from `devicePixelRatio`
and re-apply the ladder's current rung on top of it — one variable
(`dprCeiling`) and one shared `applyPixelRatio()` that both `resize`
and the ladder call.

**Regression test** — the probe above, verbatim: override DPR, dispatch
`resize`, assert `getPixelRatio()` tracked it while the ladder rung held.

### 4.4 The render loop — clean

`renderer.setAnimationLoop` at `index.html:12614` is the only loop; the
file's single `requestAnimationFrame` (5277) is a texture-upload yield.
Fifteen per-frame functions analysed by brace-matched body extraction:

| | |
|---|---|
| `new THREE.Vector3/Quaternion/Matrix4/Euler/Box3/Color/Raycaster` per frame | **0** |
| per-frame `.traverse()` | **0** (`breathe` traverses once per figure and caches in `userData.__breath`) |
| per-frame raycasts | **0** |
| per-frame `localStorage` or `JSON.parse` | **0** |

`breathe` uses module-scope `_brV`/`_brQ`/`_brE` scratch objects — the
correct pattern. `renderer.info.autoReset = false` with one
`reset()` per frame is deliberate and documented at `3787-3791`.

Two per-frame DOM reads survive in `walkUpdate` (`index.html:12182-12184`):
`getElementById("doorprompt")` every walking frame, and
`getElementById("doorprompt-name").textContent = …` re-written every
frame while standing at a door. Both are cheap id lookups; the
`textContent` write dirties a text node ~60×/s for an unchanged string.
**P3, optimization not bug** — hoist both and guard the write on change.

### 4.5 VERIFIED CLEAN — the lamp lights, and a defect I nearly filed

I expected to find 13 `PointLight`s with `intensity: 0` sitting in the
shader all day. In r170 that would be real: `projectObject`
(`three.module.js:30190`) pushes a light whenever `object.visible`, and
the fragment loop runs `getPointLightInfo` — normalize, length, `pow`
attenuation — before discarding the result via
`light.visible = (color != 0)`. Intensity zero costs full price.

**It is already handled.** `index.html:6624-6630`:

```js
/* … a light that is `visible` is in the shader whatever its
   intensity, which is the whole reason this flag matters. */
pl.visible = isNight;
```

**Measured**, day, settled: **17 lights in the scene, 2 in the shader**
(one Hemisphere, one Directional), `zeroIntensityButVisible: 0`.

Recording this as a finding because a reader of this audit deserves to
know the check was run and what it returned — and because the near-miss
is the argument for §12's recommendation.

### 4.6 VERIFIED CLEAN — deprecated APIs, materials, textures

| check | result |
|---|---|
| `outputEncoding`, `sRGBEncoding`, `LinearEncoding`, `physicallyCorrectLights`, `useLegacyLights`, `.vertices`, `.faces`, `THREE.Geometry`, `JSONLoader`, `THREE.Math`, `RGBFormat`, `.encoding`, `WebGL1Renderer` | **0 hits** |
| `THREE.Math` (removed r147) | 1 hit — it is `THREE.MathUtils`, current |
| `Geometry(` | 40 hits — all `BoxGeometry`/`PlaneGeometry`/… constructors, current |
| materials with `transparent` **and** `alphaTest` | **0** |
| images decoded into more than one texture | **0** |
| `shadowMap.autoUpdate` | **false** — the shadow pass is off the per-frame path by design |

---

## 5. CSS and DOM

### 5.1 VERIFIED CLEAN — the JS↔DOM contract

Every selector literal in the source was extracted (49 `querySelector`,
73 `getElementById`, 24 `classList` tokens) and evaluated against the
**live DOM in thirteen states** driven end-to-end: arrival, journey
open, application, accepted, advising, declare-major, registration,
registered, interior, lecture, outdoors, conversation, walk.

| check | result |
|---|---|
| `getElementById("x")` where no `id="x"` is ever created | **0 of 73** |
| JS selector naming a class/attribute never created | **0 of 49** |
| classes JS adds with no CSS rule | **0 of 24** |
| invalid selectors | **0** |
| page errors across all thirteen states | **0** |

> **A methodological warning for anyone re-running this.** A first pass
> reported 63 selectors "matching in no state" and 8 `[data-*]` attributes
> "never created". Both were artefacts. The 63 were states the probe had
> not painted (a quiz's `.right`/`.wrong`, a validation `.bad`, the
> transient `.fading`); the 8 were a bug in my own extraction regex — all
> eight exist, confirmed by direct grep. **Neither list is a finding.**
> A selector census is only evidence when every state is actually reached
> and the extractor is checked against the file it claims to read.

### 5.2 CONFIRMED · P3 · two write-only DOM attributes

**`index.html:14918`** — `out.dataset.state = h.state;`

Writes `data-state` on the AI health readout. Nothing reads it: no CSS
rule matches `[data-state]`, no JS queries it (`grep -n 'data-state'`
returns this one line). The shape of the code — writing a state token
onto an element whose text is set separately — says it was meant to
drive a `[data-state="ready"]` / `[data-state="error"]` colour rule
that was never written. The readout is legible either way; the
differentiation never arrives.

**`index.html:14106`** — `<div data-psworked="${i}">`

A wrapper's index marker. Never queried, never styled.

**Impact** — none functionally. Both are misleading: they look like
live hooks.

**Smallest safe fix** — write the `[data-state]` rule, or delete the
write. Delete `data-psworked`.

### 5.3 The `<style>` block, measured

| | |
|---|---|
| custom properties declared | 25 |
| read via `var()` | 37 |
| **read but never declared** | **10** — 8 have inline-set fallbacks by design; **2 do not** (§7.1) |
| keyframes defined | 10, **all referenced** |
| `!important` | 17 declarations |
| z-index values | 18 distinct, `-2 … 210` — a ladder, not a war |
| media queries | 11, no contradictory pairs |

`.b3d .face`, `.tree .sprite`, `body.day .b3d .shadow` appear twice
each — all are pre-WebGL `LEGACY` tokens already fenced by
`check-css`. Not new debt.

---

## 6. Naming drift

### 6.1 CONFIRMED · P3 · nine storage keys, three conventions — and my earlier sweep undercounted

| key | constant | family |
|---|---|---|
| `pembroke.registrar.completed` | `LS_DONE` | ✅ |
| `pembroke.registrar.journey` | `LS_JOURNEY` | ✅ |
| `pembroke.registrar.mode` | `LS_MODE` | ✅ |
| `pembroke.registrar.quest` | `LS_QUEST` | ✅ |
| `pembroke.registrar.sector` | `LS_SECTOR` | ✅ |
| `pembroke.registrar.sound` | `LS_SOUND` | ✅ |
| `pembroke.study` | `LS_STUDY` | ❌ key |
| `pembroke.ai` | **`AI_LS`** | ❌ key **and** constant |
| `pembroke.npc` | **`NPC_LS`** | ❌ key **and** constant |

**`docs/PEMBROKE_REPO_SWEEP.md` §4.1 reports "six of seven agree".**
That is wrong: it is **six of nine**, because the sweep grepped only
for constants matching `LS_`, which is exactly the pattern the two
worst offenders break. A naming audit that searches by the convention
it is auditing cannot see the drift. Corrected here.

**Impact** — no runtime effect. All nine keys are written and read
consistently; nothing is lost. The cost is that "what does this site
store about me" has no single answer, and a future clear-my-data
control would need all three families or would silently miss two.

**Smallest safe fix** — this is a judgement call, not a bug fix, and
renaming strands visitor progress unless a migration reads the old key
first. Recommended: one `pembroke.registrar.*` migration pass covering
all three, run once at boot, or an explicit written decision to keep
them. What is not defensible is the current state — undocumented.

### 6.2 VERIFIED CLEAN — the AI intent contract, both directions

`check-worker` enforces Worker→governor (12 intents, all in
`AI_POLICY`). I checked the reverse, which nothing enforces: is every
intent `AI_POLICY` permits also **described to the model** in
`INTENT_DOC`? If not, the policy would allow a branch the model can
never reach.

`advisor` — 6 permitted, 6 documented. `professor` — 8 permitted, 8
documented. `social`/`academic` — 2 and 2. **No unreachable branch.**

### 6.3 VERIFIED CLEAN — dataset, events, function families

`data-foo-bar` ↔ `dataset.fooBar` kebab/camel conversion: 36 declared,
23 read, **0 mismatches** once JS-side `el.dataset.x =` writes and
`userData = { … }` object literals are counted (both tripped my first
pass; both were false positives).

**Zero custom events.** No `CustomEvent`, no `dispatchEvent` — the app
is direct function calls throughout, so the entire class of
"listened-for but never fired" is structurally absent.

Function families (`j*` 17, `ai*` 13, `study*`/`render*`/`engine*`/`convo*` 5 each)
and CSS families (`st-`, `int-`, `convo-`, `arr-`, `nb-`, `j*-`, `q-`, `tok-`)
are consistent. **Do not "unify" these** — the four `j` sub-prefixes name
four distinct surfaces.

---

## 7. Silent failures

### 7.1 CONFIRMED · P2 · **the worst silent failure in the repository**

**Two CSS custom properties are read that were never declared, and the
`var()` fallback makes it look intentional.**

**File** `index.html:1189` and `index.html:1253`

```css
.jpanel h3        { font-family: var(--font-serif, Georgia, serif); }
.jcourse .jc-code { font-family: var(--font-mono, monospace); }
```

**Evidence — measured in the live journey modal:**

```json
{ ".jpanel h3": { "declared": "Georgia, serif", "text": "Student Journey" },
  "CormorantLoaded": true, "JetBrainsLoaded": true, "InterLoaded": true,
  "varFontSerif": "(empty)", "varFontMono": "(empty)",
  "fontsReady": "loaded" }
```

Twelve `.woff2` files fetched, all `200`. **Cormorant Garamond is
loaded, available, and passes `document.fonts.check` — and the heading
next to it renders in Georgia.**

**Root cause** — `--font-serif` and `--font-mono` are declared
**nowhere**: not in `:root`, not in `assets/site.css`, not via
`setProperty`, not in any inline `style=`. The site's type tokens exist
as *utility classes* instead (`.font-serif-d`, `.font-mono-d`, line
167-168), and these two rules were authored against a custom-property
system that was never built. Every other serif rule in the file names
the family directly (`'Cormorant Garamond', Georgia, serif` × 8).

**Why nothing caught it** — this is the whole point. `var(--x, fallback)`
is *valid CSS* with a *sensible fallback*. It does not warn, does not
error, does not fail `check-css` (which audits selectors, not custom
properties), and produces a page that looks finished. The visitor sees
a serif heading. It is simply the wrong serif, on the registrar panel —
the most typographically deliberate surface in the product, and the one
being redesigned right now under issue #89's illuminated-manuscript
direction.

**Impact** — the journey panel's headings and course codes are in system
fonts on a site that ships a display serif and a mono face specifically
to avoid that. On the award track this is a **Design-category defect**
on the surface a juror reads most closely.

**Smallest safe fix** — declare both in the `:root` block at line 143,
beside the colour tokens:

```css
--font-serif:'Cormorant Garamond',Georgia,serif;
--font-mono:'JetBrains Mono',ui-monospace,monospace;
```

Two lines. No selector changes, no risk: the rules already read them.

**Regression test** — extend `tools/check-css.mjs` with the check that
would have caught it: **every `var(--x)` must resolve to a declaration**,
unless `--x` is set inline (a small allowlist: `--c`, `--bb`, `--dx`,
`--dy`, `--fc`, `--s`, `--t`). That check is ~15 lines and closes the
one contract in §2 with no owner.

### 7.2 PROBABLE · P3 · `aiHealth()` reads the body before checking the status

**File** `index.html:14844-14845`

```js
const r = await fetch(base + "/api/tags", { signal: ctrl.signal });
const j = await r.json();          // no r.ok check
```

Its sibling `aiHostedHealth` (14826-14829) checks `r.status === 429`
and `!r.ok` before parsing. This one does not.

**Failure scenario** — Ollama is running and answers `500`. `r.json()`
either throws (→ the catch reports **"✗ unreachable — is Ollama
running?"**, the opposite of the truth) or parses an error object where
`j.models` is `undefined` → `names = []` → reports **"pull … "** naming
models the user already has.

**Impact** — developer-facing diagnostic only, in the local-AI settings
panel. Marked PROBABLE because I did not stand up a failing Ollama; the
asymmetry with the sibling function is CONFIRMED by reading both.

**Smallest safe fix** — `if (!r.ok) return { state: "provider-unavailable", detail: "Ollama answered " + r.status };`

**Regression test** — `check-worker` already fakes gateway responses;
add a 500 from `/api/tags` and assert the state is not `unreachable`.

### 7.3 The 32 swallowing catches, classified

| pattern | n | verdict |
|---|---|---|
| `catch(_){}` around `localStorage.setItem` | 5 | **intentional** — Safari private mode throws on write; the campus must not die for it |
| `catch(_){}` around `JSON.parse` of stored state | 4 | **intentional** — a corrupt ledger costs a field, not the university (`check-ledger` proves it) |
| `catch(_){}` around `renderer.initTexture` / `compileAsync` | 2 | **intentional** — warm-up is best-effort |
| `catch(_){}` in `Journey.emit` subscriber loop | 1 | **intentional** — one bad subscriber must not stop the rest |
| remainder | 20 | **intentional**, each with a stated reason at the site |

One deserves a note rather than a fix: `saveStudy()` (`index.html:3439`)
swallows quota-exceeded silently, and study mastery is the most
valuable thing the product stores. On a full quota, progress stops
persisting and nothing tells the visitor. **NEEDS VERIFICATION** — I did
not reproduce a full quota. Filed as a question, not a defect.

### 7.4 VERIFIED CLEAN — listeners and lifecycle

79 `addEventListener` vs 2 `removeEventListener` looks alarming and is
not. 36 sit inside named functions; **35 attach to elements the same
function just created**, so listener and node die together. The one
that attaches to `window` — `jLetter()` at `index.html:16995-16997` —
removes itself correctly with the same function reference:

```js
const off = () => { …; window.removeEventListener("afterprint", off); };
window.addEventListener("afterprint", off);
```

`jLetter()` is reachable three ways (16886, 16959, 17256) and is
duplicate-safe. No leak.

---

## 8. Dead and stale code

`docs/PEMBROKE_REPO_SWEEP.md` covers this ground; v150 acted on items
1–4. What this audit adds:

| item | file | classification |
|---|---|---|
| `out.dataset.state` write | `index.html:14918` | **LIKELY STALE** — a style hook whose rule was never written |
| `data-psworked` | `index.html:14106` | **SAFE TO REMOVE** — never queried, never styled |
| 51 pre-WebGL CSS tokens | `<style>` | **STILL REQUIRED to leave alone** — fenced by `check-css`'s `LEGACY` set; removal is a separate reviewed change |
| 17 unread `window.__` hooks | throughout | **NEEDS VERIFICATION** — cheap insurance for the next probe; three of them are mine from last week |
| `pmrem` generator | `index.html:3801` | **STILL REQUIRED**, but must be disposed (§4.2) |

**Nothing new is safe to delete beyond `data-psworked`.** The
repository has already been swept; this pass found no second layer.

---

## 9. Performance

### 9.1 P1 · RETRACTED AS A MEASUREMENT · ~1,239 draw calls, and no rung of the ladder lowers it

> **RETRACTION — the numbers in this section are not valid comparative
> measurements.**
>
> Previous draw-call values and the reported 22.9% delta were generated
> from measurements taken at non-equivalent points in a continuously
> changing scene. They are retained as historical observations but are
> not valid comparative performance measurements.
>
> The method waited for two sampling windows to agree and treated that
> as "settled". This campus never settles: the crowd churns by design,
> bodies walking into buildings and out again for the whole session.
> Measured, the same check read **1243** where the finished campus reads
> **1609**, and `arrivalState` already reported "not arriving" at 1243.
> Every figure below — 711, 723, 765, 1239, 1491 — is one arbitrary
> moment in a moving scene, and so is the 1609.
>
> **What survives this retraction** is the structural claim, which does
> not depend on the number: frustum culling removes almost nothing from
> the default viewpoint, and **no rung of the five-rung quality ladder
> removes a draw call** — every rung trades fill rate. That is read from
> the ladder's own definition, not from a sample.
>
> The replacement is `tools/check-perf.mjs`, which specifies a workload
> instead of waiting for the scene to hold still. The ceiling that used
> to live in `check-frame` has been withdrawn rather than left in place:
> a gate with no stable meaning turns a broken instrument into policy,
> and a green build would have claimed the campus stayed inside an
> envelope nobody had defined.


**Measured**, desktop 1280×800, day, after proving the scene settled
(median draw calls stable across two 15-second windows):

```
settling… median calls 793
settling… median calls 1239 (was 793)
settling… median calls 1239 (was 1239)     ← settled

visible meshes      527
inside frustum      520     ← culling removes 7
shadow casters      379
unique materials    132  (81 used by exactly one mesh, 51 shared)
shared geometries     5
textures            113 · ~39 MB
```

**The five-rung quality ladder** (`index.html:4019-4028`):

| rung | what it gives up | draw calls saved |
|---|---|---|
| 1 | SSAO pass | 0 |
| 2 | pixel ratio → 1 | 0 |
| 3 | shadow map 3072 → 1536 | 0 |
| 4 | shadows off entirely | 0 |
| 5 | bloom off, pixel ratio → 0.75 | 0 |

Every rung trades **fill rate and post-processing**. None trades
geometry. A device that is fill-bound gets real relief; a device that is
**draw-call- or CPU-submit-bound gets none, at any rung**, and rungs
never climb back.

**Corroboration from the repository's own field data** —
`index.html:4034-4037` quotes a real phone report during the arrival
flicker investigation:

> *"ssao, bloom, smaa, pixel ratio 2, shadow maps at 3072, **1289 draws**,
> 7.13M triangles"* — on an Adreno.

**1,289 observed on a real handset; 1,239 measured here.** The number is
stable and device-independent, exactly as a draw-call count should be.

**Why frustum culling cannot help** — 520 of 527 visible meshes are
inside the frustum from the default viewpoint. The campus is designed
to be seen whole, from the air on arrival and across the quad on foot.
There is no spatial headroom to reclaim; culling is already working and
has nothing to cull.

**Impact** — on mid-range mobile, ~1,200 submits per frame is the floor
regardless of how far the ladder is descended. This is the single
largest performance constraint in the product and the ladder cannot see
it.

**Smallest safe fix — none is small.** Honest options, in order of
ratio:

1. **Merge static scenery by material.** 81 materials are used by
   exactly one mesh and only 5 geometries are shared — the scene is
   authored as individual objects. `BufferGeometryUtils.mergeGeometries`
   over the static, non-shadow-casting props (benches, racks, lamps,
   banners) grouped by material could plausibly remove several hundred
   submits. **Must be measured, not assumed** — merging costs frustum
   granularity, which §9.1 shows is already worth almost nothing here.
2. **A sixth ladder rung that hides distant small props.** This is the
   first rung that would actually reduce draw calls, and it fits the
   existing `detailPass` machinery.
3. Instancing beyond the 24 `InstancedMesh` groups already present.

**Regression test** — `tools/check-frame.mjs` already asks "where does
a frame go". Add a settled-scene draw-call ceiling to it and fail the
build above it. Until that exists, this number will drift upward
unobserved, which is how it reached 1,239.

### 9.2 P3 · a full-resolution `getImageData` on the main thread

**File** `index.html:5306`, `buildWallMaps`

**Evidence** — four `GPU stall due to ReadPixels` driver warnings per
boot, then Chromium stops repeating them.

`sx.getImageData(0, 0, w, h)` reads back a GPU-backed 2D canvas at full
texture resolution, then a nested JS loop derives normal and
roughness maps. The function is already careful about *memory* (the
derived maps are half-resolution, with the reasoning written at
5314-5322) but the **readback and the loop are full-resolution and
synchronous on the main thread**.

**Impact** — a measurable main-thread stall per wall texture during
load, in the same window as the arrival flicker the ladder is
deliberately switched off for. Not a bug; a candidate for
`createImageBitmap` + a worker, or for deriving the maps offline in
`tools/make-assets.mjs` and shipping them.

### 9.3 P3 · two per-frame DOM operations in `walkUpdate`

Covered in §4.4. Hoist the two `getElementById` calls; guard the
`textContent` write on change.

### 9.4 A failed experiment, reported rather than its number

My first draw-call attribution switched the sun's shadow off and
compared before/after. It reported draw calls **rising** from 765 to
834 and triangles from 750k to 2,283k — switching work *off* made the
numbers go *up*.

That is not a result, it is the experiment announcing that it measured
**elapsed time**: the campus streams in progressively (`detailPass`, the
crowd ramp, the late asset wave), so any before/after taken during the
first minute measures loading, not the intervention.

Redone as **A/B/A on a proven-settled scene** (§9.1), the shadow toggle
moved the count by **2 draws out of 1,239** — because
`shadowMap.autoUpdate` is already `false` and the shadow pass is not on
the per-frame path at all. **The correct answer was "no cost", and the
first experiment would have reported a large negative one.**

The three earlier figures in this audit's working notes — 711, 723,
765 — are all pre-settled samples and none of them is the draw-call
count. The number is **1,239**.

---

## 10. Async and web platform

### 10.1 The AI path — clean, and unusually careful

`aiReadStream` (`index.html:15896-15948`) reads NDJSON with
`getReader()` + `TextDecoder({stream:true})`, carries a partial line
across chunk boundaries, tolerates both Ollama and gateway dialects,
counts unreadable frames, and **throws rather than returning on a
200 that carried no tokens** — with the reasoning written down:

> *"A finished stream that carried no content is not a character with
> nothing to say — it is a provider that failed AFTER the headers went
> out… Returning it ends the fallback chain on an empty bubble."*

`check-worker` proves both branches. Cancellation is a single
`AIQueue.ctrl` aborted at 15375 and 15516, wired to `signal` at 15961
and 15981. `AbortError` is rethrown deliberately so a visitor cancel
does not look like a provider failure — also tested.

### 10.2 Platform API inventory

| API | use | verdict |
|---|---|---|
| Fetch + Streams | NDJSON reader | **clean** |
| AbortController | 3 controllers, all with `clearTimeout` in `finally` | **clean** |
| `AbortSignal.timeout(4000)` | Ollama origin probe | **clean**, modern |
| `setAnimationLoop` | the render loop | **clean** — pauses with the tab, unlike bare rAF |
| localStorage | 9 keys, all guarded | **clean** (naming aside, §6.1) |
| Service Worker | `networkFirst` shell + `cacheFirst` depot, `ASSETS_V` separate from `VERSION`, named `RETIRED` eviction | **clean and well-reasoned** |
| `matchMedia` | pointer/hover/reduced-motion | **clean**, proven by `check-a11y` |
| ResizeObserver / IntersectionObserver | not used | fine — `resize` is sufficient here |
| Visibility API | not used | `setAnimationLoop` already yields when hidden |

**No race conditions, uncaught rejections, duplicate listeners, or
timers surviving lifecycle changes were found.** The thirteen-state
trace produced **0 unhandled rejections**.

---

## 11. Cross-system contract failures

**One**, and it is the `var()` token gap in §7.1 — a CSS↔CSS contract
rather than a cross-service one.

Every contract that crosses a *system* boundary — client↔Worker,
client↔service worker, JS↔GLTF, roster↔policy, course↔ledger — is
holding, and each has a CI gate standing behind it. §2's table shows
the pattern without ambiguity: **the two contracts that drifted are the
two with no enforcement.**

---

## 12. Test gaps

The nine-job suite is strong. What it cannot currently see:

| gap | the defect it would have caught |
|---|---|
| **`var(--x)` resolves to a declaration** | §7.1 — the worst finding here, invisible to every existing probe |
| **settled draw-call ceiling** | §9.1 — 1,239 reached unobserved |
| **console is clean after boot** | §4.1 — two warnings every boot, in CI, unread |
| **DPR tracks `devicePixelRatio` across resize** | §4.3 |
| **`r.ok` before `r.json()`** — a lint, not a probe | §7.2 |

The first three are each ~15 lines against machinery that already
exists (`check-css`, `check-frame`, `check-opening`).

**A note on the standard.** §4.5 and §5.1 are both cases where a
plausible defect survived reading and died on measurement. A passing
test does not prove correctness — but neither does a confident reading
of source. Both of my false starts here (`.dataset` drift, the 63
"dead" selectors) came from static analysis unchecked against a running
page.

---

## 13. Safe removal candidates

| item | file | class |
|---|---|---|
| `data-psworked="${i}"` | `index.html:14106` | **SAFE TO REMOVE** |
| `out.dataset.state = h.state` | `index.html:14918` | **LIKELY STALE** — or write the rule it wants |
| 51 pre-WebGL CSS tokens | `<style>` | **NEEDS VERIFICATION** — fenced; own PR |
| 17 unread `window.__` hooks | throughout | **NEEDS VERIFICATION** — judgement, not automatic |

Nothing else. **Do not remove** anything in §7.3's catch inventory,
`LEGACY`'s fence, or the `AI_LS`/`NPC_LS` keys without a migration.

---

## 14. Top ten repairs

| # | repair | sev | effort | proof it is needed |
|---|---|---|---|---|
| 1 | Declare `--font-serif` / `--font-mono` in `:root` | P2 | **2 lines** | §7.1 — measured Georgia on `.jpanel h3` |
| 2 | `check-css`: every `var(--x)` must resolve | P2 | ~15 lines | closes the contract with no owner |
| 3 | `dprCeiling` + shared `applyPixelRatio()` | P2 | ~10 lines | §4.3 — measured DPR 3, ratio stayed 1 |
| 4 | Lower PMREM sigma; assert a clean console | P2 | 1 line + test | §4.1 — two warnings every boot |
| 5 | `pmrem.dispose()` | P3 | **1 line** | §4.2 |
| 6 | Draw-call ceiling in `check-frame` | P1 | ~15 lines | §9.1 — stops the drift that reached 1,239 |
| 7 | `r.ok` guard in `aiHealth` | P3 | 1 line | §7.2 — asymmetric with its sibling |
| 8 | Hoist `walkUpdate`'s two DOM reads | P3 | ~4 lines | §4.4 |
| 9 | Delete `data-psworked`; decide `data-state` | P3 | 2 lines | §5.2 |
| 10 | Merge static scenery by material — **measure first** | P1 | days | §9.1 — 81 single-use materials, 5 shared geometries |

Repairs 1–5, 7, 8, 9 total **under 40 lines** and carry the four
confirmed user-visible defects.

---

## 15. Recommended repair PR sequence

**PR A — "the tokens that were never declared" (P2, ~20 lines).**
Repairs 1 + 2 together, and only together: the fix and the gate that
proves it stays fixed. The gate is what makes this worth a PR — the
two-line fix without it is one grep away from regressing.

**PR B — "the renderer's boot-time assumptions" (P2/P3, ~15 lines).**
Repairs 3 + 4 + 5. All three are `renderer` lifecycle. Ship the DPR fix
with the ladder interaction spelled out in the description, because
that interaction is why it was not fixed earlier.

**PR C — "small write-only truths" (P3, ~10 lines).**
Repairs 7 + 8 + 9. Independent, boring, safe.

**PR D — "put a ceiling on the draw calls" (P1, ~15 lines).**
Repair 6 alone. It changes no behaviour and adds a gate. Land it
**before** PR E so PR E has a scale to move.

**PR E — "merge the static scenery" (P1, days).**
Repair 10, gated by PR D's number. If the merge does not move 1,239
meaningfully, **abandon it** — the ratio is the whole justification and
§9.4 is the standing reminder that an unmeasured performance change can
point the wrong way with total confidence.

**Not sequenced:** §6.1's storage-key decision and §8's 17 hooks. Both
are judgement calls for the owner, not repairs.

---

## Final verdict

| | |
|---|---|
| **confirmed defects** | 5 — §4.1, §4.2, §4.3, §5.2 (×2 sites) |
| **probable defects** | 2 — §7.2, and `saveStudy` quota (§7.3, needs verification) |
| **stale/dead candidates** | 2 safe, 2 needing verification (§13) |
| **naming-contract failures** | 1 — nine keys, three conventions (§6.1) |
| **most serious Three.js defect** | §4.3 — `resize()` never re-reads `devicePixelRatio`; measured DPR 3 with the renderer still at 1 |
| **most serious CSS/DOM defect** | §7.1 — `--font-serif` declared nowhere; `.jpanel h3` measured rendering in Georgia beside a loaded Cormorant Garamond |
| **worst silent failure** | §7.1, the same one. `var(--x, fallback)` turns a missing token into a design decision |
| **largest performance waste** | §9.1 — no ladder rung can lower a draw call, so the submit count is a floor on what the campus costs. **The figures are retracted as measurements** (see §9.1): they were taken at non-equivalent points in a scene that never settles. The structural claim stands; the numbers await `tools/check-perf.mjs` |
| **highest-value cleanup** | §12's `var()` gate — 15 lines that close the only unowned contract in §2 |

**Top five repairs:** declare the two font tokens · gate `var()`
resolution in `check-css` · re-read DPR on resize without stomping the
ladder · put a draw-call ceiling in `check-frame` · dispose the PMREM
generator.

### Is Pembroke hiding broken or stale behaviour behind fallbacks?

**In one place, provably: yes.** §7.1. Two CSS custom properties that
do not exist, read through fallbacks that render a plausible page. The
mechanism is exactly the one this audit was asked to hunt — valid
syntax, sensible default, no error, wrong output — and it landed on the
registrar panel, the surface most closely read.

**Systemically: no, and the evidence is positive rather than absent.**
Thirteen states driven end-to-end produced zero page errors, zero
unhandled rejections, zero 404s. Zero dead selectors of 146 checked
against a live DOM. Zero deprecated Three.js APIs against r170. Zero
per-frame allocations across fifteen per-frame functions. Zero
duplicate texture decodes. The intent contract agrees in both
directions. Every swallowed exception carries its reason at the site.

Three times in this audit I had a defect written before the code told
me why it was wrong — the zero-intensity lights (§4.5), the
window-level listener (§7.4), the dataset drift (§6.3). That is not the
signature of a repository coasting on fallbacks. It is the signature of
one where the hard parts were done deliberately and **the gaps are
exactly where nobody wrote a gate** — which is §2's table, and which is
why four of the five top repairs are gates rather than fixes.
