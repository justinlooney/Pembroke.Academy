#!/usr/bin/env bash
#
# Pembroke Academy — asset slimming pass.
#
# Decimates each model in proportion to how close the visitor ever gets
# to it, then re-applies meshopt + WebP. Horizon scenery loses most of
# its triangles and nobody can tell through the fog; the cathedral you
# can walk inside is barely touched.
#
#   sudo snap install blender --classic     # or apt install blender
#   npm install -g @gltf-transform/cli
#   bash tools/optimize-assets.sh           # everything
#   bash tools/optimize-assets.sh msu       # just one, to try it
#
# Writes in place. Git is the backup: `git checkout -- assets/` reverts.
set -uo pipefail
cd "$(dirname "$0")/.."

BLENDER="${BLENDER:-blender}"
GLTF="${GLTF:-gltf-transform}"
command -v "$BLENDER" >/dev/null || { echo "blender not found — set BLENDER=/path/to/blender"; exit 1; }
command -v "$GLTF"    >/dev/null || { echo "gltf-transform not found — npm i -g @gltf-transform/cli"; exit 1; }

# Triangle budgets, set by how close a visitor ever gets. These are
# absolute targets, not ratios, so the result does not depend on how
# messy a given scan is.
#
# model            target-tris  weld     texture-px   why
TIERS="
msu                60000        0.0002   1024   far horizon, fog-hazed
cologne            60000        0.0002   1024   far horizon
gothic_cathedral   70000        0.0002   1024   west horizon
university         90000        0.0002   1024   east district, across the drive
gridiron           140000       0.0002   2048   stadium, seen down the boulevard
tennis             80000        0.0002   1024   southeast, never approached
ballpark           80000        0.0002   1024   southwest, never approached
reshall            140000       0.0001   2048   west lawn, walked past
portal             260000       0.0001   2048   the cathedral door, seen up close
cathedral2         500000       0        2048   ENTERABLE — light touch only
"

only="${1:-}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
total_before=0; total_after=0

printf '%-20s %8s %8s %8s\n' model before after saved
printf '%s\n' "---------------------------------------------------"

while read -r name target weld tex _rest; do
  [ -z "${name:-}" ] && continue
  [ -n "$only" ] && [ "$only" != "$name" ] && continue
  src="assets/$name.glb"
  [ -f "$src" ] || { echo "skip $name (missing)"; continue; }

  before=$(stat -c%s "$src")
  if ! "$BLENDER" --background --python tools/decimate.py -- \
        "$src" "$tmp/$name.dec.glb" "$target" "$weld" > "$tmp/$name.log" 2>&1; then
    echo "FAILED $name — see $tmp/$name.log"; tail -5 "$tmp/$name.log"; continue
  fi
  grep '^\[decimate\]' "$tmp/$name.log" | tail -1

  if ! "$GLTF" optimize "$tmp/$name.dec.glb" "$tmp/$name.opt.glb" \
        --compress meshopt --texture-compress webp --texture-size "$tex" \
        > "$tmp/$name.gltf.log" 2>&1; then
    echo "FAILED $name at compression — see $tmp/$name.gltf.log"; continue
  fi

  after=$(stat -c%s "$tmp/$name.opt.glb")
  if [ "$after" -ge "$before" ]; then
    echo "  $name got bigger — keeping the original"
    after=$before
  else
    mv "$tmp/$name.opt.glb" "$src"
  fi
  total_before=$((total_before + before)); total_after=$((total_after + after))
  printf '%-20s %7sM %7sM %7s%%\n' "$name" \
    "$(echo "$before" | awk '{printf "%.1f", $1/1e6}')" \
    "$(echo "$after"  | awk '{printf "%.1f", $1/1e6}')" \
    "$(echo "$before $after" | awk '{printf "%.0f", 100-100*$2/$1}')"
done <<< "$TIERS"

echo "---------------------------------------------------"
[ "$total_before" -gt 0 ] && echo "$total_before $total_after" | awk \
  '{printf "processed: %.1fMB -> %.1fMB  (%.0f%% saved)\n", $1/1e6, $2/1e6, 100-100*$2/$1}'
echo "whole assets folder now: $(du -sh assets | cut -f1)"
echo
echo "Check it before committing — open the site and look at the horizon,"
echo "the stadiums, and the inside of the cathedral. To undo: git checkout -- assets/"
