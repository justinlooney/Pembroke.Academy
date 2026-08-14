#!/usr/bin/env bash
# Rebuild assets/site.css — the compiled utilities plus the @font-face
# rules for the woff2 files in assets/fonts.
#
# The page used to pull Tailwind's CDN build (a COMPILER, shipped to the
# browser, which then read all 481KB of index.html and generated CSS on
# the main thread before anything rendered) and a Google Fonts
# stylesheet. Both were render-blocking, both were third-party, and both
# sat ahead of our own code. This builds the same result once, here.
#
# Run it whenever a new utility class appears in index.html. If a class
# is used but missing from site.css, it simply has no effect — which is
# quiet, so tools/check-css.mjs fails the build instead.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
npm install tailwindcss@3 --no-audit --no-fund --silent
cat > tw.config.js <<CFG
module.exports = {
  content: ["$ROOT/index.html"],
  theme: { extend: {} },
  corePlugins: { preflight: true },
};
CFG
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > in.css
npx tailwindcss -c tw.config.js -i in.css -o utilities.css --minify

# the @font-face block is kept in the repo rather than refetched: the
# woff2 files are committed, and Google's CSS changes its URLs over time
{ cat "$ROOT/tools/fonts.css"; echo; cat utilities.css; } > "$ROOT/assets/site.css"
echo "assets/site.css rebuilt: $(wc -c < "$ROOT/assets/site.css") bytes"
