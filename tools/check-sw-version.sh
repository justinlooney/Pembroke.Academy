#!/usr/bin/env bash
#
# Pembroke Academy — guard against shipping stale models.
#
# The service worker caches everything under assets/ cache-first, keyed
# by VERSION in sw.js. Change a model without bumping VERSION and every
# returning visitor keeps the old one indefinitely, with no symptom you
# would ever notice locally: your own browser holds the new files, so
# the site looks correct to you and is broken for everybody else.
#
# That is a silent, sticky, user-facing failure, so it is worth a check.
#
#   bash tools/check-sw-version.sh <base-ref>
#
set -uo pipefail
cd "$(dirname "$0")/.."

base="${1:-}"
[ -n "$base" ] || { echo "usage: check-sw-version.sh <base-ref>"; exit 1; }

if ! git rev-parse --verify --quiet "$base" >/dev/null; then
  echo "base ref '$base' not found — skipping (nothing to compare against)"
  exit 0
fi

# The ?debug panel prints BUILD from index.html and compares it against
# the version the worker reports, to tell a stale cache apart from an
# unfixed bug. That only works while the two agree, and nothing about
# editing one makes you edit the other — so check it every run, whether
# or not any asset moved.
build="$(sed -n 's/^const BUILD = "\(.*\)";$/\1/p' index.html)"
version="$(sed -n 's/^const VERSION = "\(.*\)";$/\1/p' sw.js)"
if [ -z "$build" ] || [ -z "$version" ]; then
  echo "could not read BUILD from index.html ('$build') or VERSION from sw.js ('$version')"
  exit 1
fi
if [ "$build" != "$version" ]; then
  echo
  echo "index.html BUILD is '$build' but sw.js VERSION is '$version'."
  echo
  echo "The debug panel reads BUILD and compares it to what the worker"
  echo "reports, so a drift here makes every page claim to be stale —"
  echo "or worse, makes a genuinely stale page look current."
  exit 1
fi
echo "BUILD and VERSION agree at $build"

changed_assets="$(git diff --name-only "$base"...HEAD -- assets/ | grep -viE '\.md$' || true)"
if [ -z "$changed_assets" ]; then
  echo "no asset changes — VERSION bump not required"
  exit 0
fi

old="$(git show "$base:sw.js" 2>/dev/null | sed -n 's/^const VERSION = "\(.*\)";$/\1/p')"
new="$(sed -n 's/^const VERSION = "\(.*\)";$/\1/p' sw.js)"

if [ -z "$new" ]; then
  echo "could not read VERSION from sw.js — the guard cannot vouch for this change"
  exit 1
fi

# sw.js is new on this branch: nothing cached under an older key, so fine.
if [ -z "$old" ]; then
  echo "sw.js is new here — no previous cache to invalidate"
  exit 0
fi

if [ "$old" = "$new" ]; then
  echo
  echo "assets changed but sw.js VERSION is still '$new'."
  echo
  echo "$changed_assets" | sed 's/^/    /'
  echo
  echo "Returning visitors would keep the old files forever. Bump VERSION"
  echo "in sw.js (e.g. pembroke-v2) so the worker drops its old caches."
  exit 1
fi

echo "assets changed and VERSION moved $old -> $new"
