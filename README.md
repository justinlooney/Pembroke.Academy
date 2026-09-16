# Pembroke Academy

A browser-based campus and learning project. The campus uses Three.js; `study.html` opens the same lessons and progress without WebGL. There is no frontend build step.

## Run locally

Use Node.js 22 or newer and Python 3:

```sh
npm ci
python3 -m http.server 8099
```

Open `http://localhost:8099/` for the campus or `http://localhost:8099/study.html` to learn directly. Serve over HTTP rather than opening files from disk; native ES modules and service workers need a web origin. GitHub Pages hosts the static site. The optional character-AI gateway is a separate Cloudflare Worker.

## Check a change

```sh
npm test
npx playwright install --with-deps chromium
npm run test:learning
npm run test:ledger
node tools/check-campus-learning.mjs
node tools/check-a11y.mjs
bash tools/check-sw-version.sh origin/main
```

`npm test` runs storage/grading/cache/deadline regressions, fake-provider gateway checks, CSS checks and material checks. It makes no AI calls. `test:learning` checks lesson completion, reload, practice, backup import/export, accessibility, mobile overflow and save failures with WebGL disabled. Campus browser checks use software rendering and take longer. The existing smoke suite and other focused checks remain under `tools/` and in `.github/workflows/smoke.yml`.

## Course availability and progress

- MATH 101 has **Unit I only**: three introductory lessons, worked examples, practice, feedback and homework. Later units are not yet offered.
- MATH 201 has 28 lessons. Sections with a problem set require passed knowledge checks and 75% of graded answers earned before full solutions are revealed. Other sections require all knowledge checks to pass.
- The other ten catalog courses currently contain syllabi only. Registration shows availability before enrollment.
- Course seals are self-reported. They remain separate from lesson mastery and are still used by the registrar's prerequisite workflow.

Both views use the existing `pembroke.*` browser-storage keys. Typed restoration repairs invalid fields individually. A failed write stays in memory, displays a warning and remains available for export; it is not durable until saving succeeds. **Progress & backup** offers retry, versioned JSON export, and a validated preview before replacement. Exports include study, seals, journey, character memories and the last lesson; they can include application details and conversation memories. They exclude AI connection settings. A persistent undo journal recovers an interrupted import before progress loaders run. Keep a backup before clearing browser data or moving devices. Use one tab for editing progress at a time.

## Code boundaries

- `index.html`: campus rendering, simulation, registrar and campus lesson UI.
- `assets/app/courses.mjs`, `course-study.mjs`, `intro-math.mjs`, `problem-sets.mjs`: authored catalog and learning content.
- `assets/app/grading.mjs`, `progress.mjs`: grading rules, typed progress, storage status and backup transactions.
- `assets/app/figures.mjs`: shared canvas mathematics, with no Three.js dependency.
- `assets/app/ai-policy.mjs`, `ai-stream.mjs`: output normalization, role capabilities and stream reading. Parsed dialogue is capped at 1,200 characters on every path.
- `assets/app/study-page.mjs`, `progress-ui.mjs`: lightweight study and shared backup controls.
- `worker/src/index.mjs`: hosted AI request validation, persona registry, limits and streaming gateway.

Course text is trusted authored content and may contain HTML. Imported progress is data, never lesson markup or executable code. If you add a persisted field, update its normalizer and round-trip tests.

## Offline and asset changes

Keep `BUILD` in `index.html` and `VERSION` in `sw.js` equal and increment them for a release. The service worker keeps only caches matching Pembroke's known names eligible for cleanup; it preserves unrelated caches. Navigations and application modules prefer the network, with cached fallback on network failure, a five-second deadline, or 500/502/503/504. A saved navigation displays a notice; a 404 remains a 404.

The lightweight page and application modules are precached in the versioned shell. Add new application modules to `SHELL_FILES`. Models are cached on demand in the separately versioned depot. For an existing model changed in place, add its URL to `REFRESHED`; for a deletion, add it to `RETIRED`. Only broad asset changes warrant changing `ASSETS_V`. The Three.js engine and main stylesheet are refreshed during installation. A first online visit must complete service-worker installation before offline support is available.

## Hosted AI development

The campus has canned dialogue when inference is unavailable. Fake-provider tests are the default; do not use production inference as a unit test.

```sh
cd worker
npx wrangler dev --var ALLOW_LOCALHOST:1
# Deploy only after reviewing the target Cloudflare account and settings:
npx wrangler deploy
```

Wrangler is an operator CLI, separate from the pinned frontend test dependencies. Configure its credentials and the Workers AI binding for your account. `ALLOWED_ORIGIN` restricts browser origins; it is not authentication. Localhost access requires `ALLOW_LOCALHOST=1` and is disabled in the production configuration. `AI_ENABLED=0` disables inference. `AI_STARTUP_MS` (30 seconds), `AI_IDLE_MS` (15 seconds), and `AI_TOTAL_MS` (120 seconds) control provider deadlines. Startup is bounded even if a provider ignores abort; late streams are cancelled. Production AI deployment is separate from merging static-site changes.
