#!/usr/bin/env bash
#
# Pembroke Academy — guard against shipping stale models.
#
# The service worker caches everything under assets/ cache-first, in a
# depot keyed by ASSETS_V — NOT by VERSION. This guard used to demand a
# VERSION bump for any asset change, which was right when VERSION
# prefixed the depot too and has been wrong since it stopped: the
# release workflows dutifully bump VERSION, the guard passes, the depot
# name never moves, and cacheFirst keeps handing back the old bytes.
#
# Three things can happen to an asset and only one of them is a
# problem:
#
#   added    a URL the depot has never held — cacheFirst fetches it
#            once. Nothing to do.
#   deleted  cacheFirst simply stops asking, so the bytes sit on the
#            visitor's disk forever. sw.js RETIRED names them.
#   changed  the depot holds that URL already and will never ask again.
#            sw.js REFRESHED names them, or ASSETS_V moves.
#
# The last one has no symptom whatsoever: your own browser fetched the
# new file, so the site looks correct to you and is stale for everybody
# who was here before. That is what this guard is for.
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

# --diff-filter=M: modified in place. Added (A) files are safe by
# construction and deleted (D) ones are RETIRED's business, so neither
# belongs in the check that follows.
modified="$(git diff --name-only --diff-filter=M "$base"...HEAD -- assets/ | grep -viE '\.md$' || true)"
if [ -z "$modified" ]; then
  echo "no asset changed in place — the depot still describes what it holds"
  exit 0
fi

old_av="$(git show "$base:sw.js" 2>/dev/null | sed -n 's/^const ASSETS_V = "\(.*\)";$/\1/p')"
new_av="$(sed -n 's/^const ASSETS_V = "\(.*\)";$/\1/p' sw.js)"
if [ -z "$new_av" ]; then
  echo "could not read ASSETS_V from sw.js — the guard cannot vouch for this change"
  exit 1
fi

# A moved ASSETS_V renames the whole depot, so every stale entry goes
# with it. Blunt, but it is a legitimate answer for a mass change.
if [ -n "$old_av" ] && [ "$old_av" != "$new_av" ]; then
  echo "assets changed in place and ASSETS_V moved $old_av -> $new_av (whole depot re-keyed)"
  exit 0
fi

# Otherwise each modified file must be named in REFRESHED. Read the
# list as the literal block it is, so a path mentioned in a comment
# somewhere else in sw.js cannot vouch for a file.
refreshed="$(sed -n '/^const REFRESHED = \[/,/^\];/p' sw.js)"
unnamed=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  case "$refreshed" in
    *"\"./$f\""*) ;;
    *) unnamed="$unnamed$f
" ;;
  esac
done <<< "$modified"

if [ -n "$unnamed" ]; then
  echo
  echo "these assets changed in place but are named in neither REFRESHED nor a new ASSETS_V:"
  echo
  printf '%s' "$unnamed" | sed 's/^/    /'
  echo
  echo "The depot already holds those URLs and cacheFirst never asks again,"
  echo "so every returning visitor keeps the old bytes indefinitely — and it"
  echo "looks correct on your machine, because your browser fetched the new"
  echo "ones. Add them to REFRESHED in sw.js (activate drops exactly those"
  echo "entries and the next fetch re-fills them), or bump ASSETS_V if the"
  echo "change is broad enough to be worth re-keying the whole depot."
  exit 1
fi

echo "assets changed in place and every one is named in REFRESHED"
exit 0
