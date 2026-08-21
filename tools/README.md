# tools/

Every file here is a script you can run by hand. Nothing is a build
step you have to know about before editing the site, and nothing
imports anything else except `_harness.mjs`.

Each script carries its own header explaining what it is for and what
it found the day it was written. This file answers only the question a
header cannot: **which of these are load-bearing, and which are notes
somebody left behind.** A tree of thirty-eight scripts where four are
abandoned is worse than a tree of thirty-four, because you cannot tell
which four without reading all thirty-eight.

---

## The harness

`_harness.mjs` is the only shared module. It holds the static server,
the Chromium launch, the boot wait and the reporter that twenty-two
probes each used to carry a copy of:

```js
import { serve, launch, open, reporter } from "./_harness.mjs";

const { origin, close } = await serve();
const browser = await launch();
const { page, up, close: shut } = await open(browser, origin);
const { step, done } = reporter();

step("the campus ignites", up);
await shut(); await browser.close(); close();
done("example");
```

`serve()` binds port **0** and lets the operating system hand out one
nobody holds. That is not a style preference — three pairs of probes in
this tree had picked the same port by hand (8311, 8321, 8361), and the
second of each pair would have died with `EADDRINUSE` before checking
anything, reading like a broken checkout rather than a port clash. A
port asked for is a port that can collide; a port assigned cannot.

`open()` waits up to **240s** for the page to ignite. A boot is ~22s
idle on a software rasterizer with no GPU, and a probe that gives up at
120s reports a page that will not start when what it found was a
machine under load. Pass `ready` to wait for something more specific
than `window.__app`.

Write a new probe against this, not against a copy of the last one.

---

## Enforced by CI — a failure here blocks the merge

`.github/workflows/smoke.yml`, on every push and pull request:

| job | script | what it refuses to let through |
|---|---|---|
| `cache-version` | `check-sw-version.sh` | an asset changed in place without an `ASSETS_V` bump — visitors keep the old file forever |
| `gateway` | `check-worker.mjs` | the Worker's request contract, without spending a token of inference |
| `smoke` | `check-rig-names.mjs` | a character whose bone or clip names do not line up |
| | `check-css.mjs` | a utility class with no rule, or a selector naming a class nobody creates |
| | `smoke.mjs` | the visit itself — ignite, read the ledger, walk, enter, leave, run the clock to night |
| `figures` | `check-breath.mjs` | a standing figure that drifts off its mark |
| | `check-roles.mjs` | a lent clip that landed on the wrong role |
| | `check-stance.mjs` | somebody parked in a pose a person does not hold |
| `ledger` | `check-ledger.mjs` | the ledger's own arithmetic |
| `a11y` | `check-a11y.mjs` | the campus becoming unusable without a mouse |
| `owner` | `check-owner.mjs` | two things claiming the keyboard, or an async continuation acting out of turn |
| `opening` | `check-opening.mjs` | the first twenty seconds regressing |
| `sound` | `check-sound.mjs` | the campus making a sound nobody asked for — or none when asked |

Three more workflows are path-triggered rather than universal, and are
authoring pipelines rather than gates:

| workflow | fires on | scripts |
|---|---|---|
| `materials.yml` | `check-materials.mjs` changes | `check-materials.mjs` |
| `mixamo.yml` | `tools/mixamo-inbox.txt` changes | `mixamo-plan.py` · `mixamo-to-glb.py` · `flatten-scenes.mjs` · `thin-character.mjs` |
| `inspect.yml` | `tools/inspect-inbox.txt` changes | `inspect-rig.py` |

---

## Run by hand, and worth running

Nothing calls these. They answer a question you have to think to ask,
which is why they are not gates.

| script | the question |
|---|---|
| `check-character.mjs` | will this character work on the campus? |
| `check-donor.mjs` | can this clip be lent to somebody else's skeleton? |
| `check-frame.mjs` | where does a frame actually go? (not a frame rate) |
| `check-sitting.mjs` | is this clip sitting, standing up, or sitting down? |
| `check-gateway.mjs` | does the **deployed** Worker still hold? (talks to production, spends real inference — that is why it is not in CI) |
| `character-sheet.mjs` | look at one character properly |
| `weigh.mjs` | what does a visit actually cost over the wire? |
| `compare-lod.mjs` | does the cheaper version of a model still read at distance? |
| `check-animations.mjs` | do the clips work, and does anyone play them? |
| `check-onscreen.mjs` | does the `ON_SCREEN_MB` ceiling actually hold? |
| `check-dialogue.mjs` | how does a body look in its only close-up? |
| `png-in-terminal.py` | look at a render over ssh without leaving the terminal |

## Authoring — they change files

| script | what it makes |
|---|---|
| `make-assets.mjs` | the prop library (`tree.glb`, `car.glb`, `lamp.glb`, …) |
| `vendor-three.mjs` | Three.js into `assets/vendor/`, so a CDN is not a single point of failure |
| `build-css.sh` | `assets/site.css` — compiled utilities plus the `@font-face` rules |
| `optimize-assets.sh` | decimate + meshopt + WebP, in proportion to how close the visitor gets |
| `decimate.py` | the Blender half of that (welds scan seams first) |
| `flatten-scenes.mjs` | folds a multi-scene GLB into one scene |
| `thin-character.mjs` | drops the tongue, the teeth, the eyelashes nobody can see |
| `mixamo-plan.py` · `mixamo-to-glb.py` | Mixamo FBX downloads → one web-ready character |
| `inspect-rig.py` | says what is actually inside a character file |

`clips/Standing_Idle.fbx` is a Mixamo download kept as the reference
input for that chain.

---

## Naming

Two families, and the split is meaningful:

- **`check-*`** — asks a question and exits non-zero if the answer is
  wrong. Changes nothing. Safe to run at any time.
- **a bare verb** (`weigh`, `decimate`, `flatten-scenes`, `vendor-three`,
  `make-assets`, `optimize-assets`, `thin-character`, `mixamo-plan`,
  `build-css`) — does something. Assume it writes.

`character-sheet.mjs` and `inspect-rig.py` are inspectors named as
nouns, which breaks both rules. They are read-only; the names are the
inconsistency, not the behaviour.

An underscore prefix (`_harness.mjs`) means a shared module, not a
script. There is exactly one. Two files used to wear that prefix
without exporting anything — `_look.mjs` and `_site.mjs`, both one-off
debugging scripts with a hard-coded absolute path — and they were the
most misleading files in the tree, because they looked exactly like the
harness that did not yet exist. Deleted in v150. If you write a
scratch script, do not give it the underscore.
