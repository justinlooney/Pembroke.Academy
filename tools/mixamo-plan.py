#!/usr/bin/env python3
"""
Pembroke Academy — read tools/mixamo-inbox.txt into a build plan.

Mixamo can be left in two shapes and both are reasonable, so neither is
made wrong here:

  one character, several clips   the download WITH SKIN, then a pile of
                                 animation-only files. One GLB, one mesh,
                                 every motion — the light option.

  several characters, each with  each file carries its own mesh, rig and
  its motion baked in            one clip. Heavier on the wire, but it is
                                 what you get by just hitting Download on
                                 a few different characters.

A file is a series of blocks. Each starts with an "# out:" line naming
what to build, and lists the downloads that go into it:

    # out: assets/stu_walker.glb
    character       https://drive.google.com/file/d/AAA/view
    Walking         https://drive.google.com/file/d/BBB/view
    Standing_Idle   https://drive.google.com/file/d/CCC/view

    # out: assets/stu_runner.glb
    runner          https://drive.google.com/file/d/DDD/view

The first entry in a block is always the one carrying the mesh. A block
of one is the second shape above and is perfectly valid.

    python3 tools/mixamo-plan.py tools/mixamo-inbox.txt /tmp/plan
"""
import os
import re
import sys

src = sys.argv[1] if len(sys.argv) > 1 else "tools/mixamo-inbox.txt"
outdir = sys.argv[2] if len(sys.argv) > 2 else "/tmp/plan"

if not os.path.isfile(src):
    print(f"[inbox] {src} not found")
    sys.exit(1)

blocks, cur = [], None
# A block owns its "# out:" line, its links, and the run of comment and
# blank lines ABOVE it — because that is where the notes about a block
# are written. Attributing that run downwards instead (each block
# reaching to the line before the next "# out:") is what --since used to
# do, and it silently sent an edit to the wrong block: the note above
# "# out: assets/clip_idle.glb" counted as part of stu_isla.glb, so a
# push that armed four clip donors rebuilt the walking woman to the
# identical bytes and reported success having built nothing.
#
# The consequence at the top of the file is that the header comment
# belongs to the first block. That is bounded and one block wide, where
# the old behaviour was wrong for every block in the file.
gap = 1
for lineno, raw in enumerate(open(src, encoding="utf-8"), 1):
    line = raw.rstrip("\n")
    out = re.match(r"^\s*#\s*out:\s*(\S+)", line)
    if out:
        cur = {"out": out.group(1), "files": [], "from": gap, "to": lineno}
        blocks.append(cur)
        gap = lineno + 1
        continue
    if re.match(r"^\s*(#|$)", line):
        continue
    parts = line.split()
    if len(parts) < 2:
        print(f"[inbox] skipping malformed line (needs 'name url'): {line.strip()!r}")
        continue
    name, url = parts[0], parts[1]
    if cur is None:
        # links before any "# out:" still deserve somewhere to go
        cur = {"out": "assets/stu_walker.glb", "files": [], "from": gap, "to": lineno}
        blocks.append(cur)
    fid = re.search(r"/d/([^/]+)", url) or re.search(r"[?&]id=([^&]+)", url)
    if not fid:
        print(f"[inbox] {name}: no Drive file id in {url}")
        sys.exit(1)
    cur["files"].append((name, fid.group(1)))
    cur["to"] = lineno
    gap = lineno + 1

live = [b for b in blocks if b["files"]]

# ── build only what changed ──────────────────────────────────────────
# Every block in this file used to be rebuilt on every run, because a
# push to the inbox was taken to mean "build the inbox". It does not: it
# means "build the thing I just edited". Rebuilding the rest re-downloads
# each character from Drive and overwrites whatever has happened to it
# since — the metalrough conversion that recovered colour on two bodies,
# the idle clips landed by the other courier, any thinning. This
# repository has already had a workflow quietly undo its own work twice,
# and both times the log looked fine.
#
# So: with --since REF, keep only the blocks whose lines this commit
# touched. If the diff cannot be taken the fallback is to build
# everything, which is the old behaviour and is announced rather than
# assumed, because silently building nine characters when one was asked
# for is the failure this exists to prevent.
since = None
if "--since" in sys.argv:
    since = sys.argv[sys.argv.index("--since") + 1]
if since:
    import subprocess
    try:
        diff = subprocess.run(["git", "diff", "-U0", since, "--", src],
                              capture_output=True, text=True, check=True).stdout
        touched = set()
        for h in re.finditer(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@", diff, re.M):
            start = int(h.group(1))
            count = int(h.group(2) or 1)
            touched.update(range(start, start + count))
        if not touched:
            print(f"[inbox] nothing in {src} changed since {since} — nothing to build.")
            live = []
        else:
            picked = [b for b in live if any(b["from"] <= n <= b["to"] for n in touched)]
            skipped = [b["out"] for b in live if b not in picked]
            for out in skipped:
                print(f"[inbox] unchanged, leaving alone: {out}")
            live = picked
    except Exception as e:
        print(f"[inbox] could not diff against {since} ({e}).")
        print("[inbox] BUILDING EVERY BLOCK — this overwrites every character in the file.")
os.makedirs(outdir, exist_ok=True)
# Only the plan files this script wrote. The caller names the directory,
# so emptying it wholesale means deleting whatever else was in it — and
# a stale block- file from a previous run would be built as if it were
# in the inbox, so leaving them is not an option either.
for f in os.listdir(outdir):
    p = os.path.join(outdir, f)
    if f.startswith("block-") and os.path.isfile(p):
        os.remove(p)

if not live:
    print("[inbox] no links yet — nothing to build. This is not a failure.")
    sys.exit(0)

seen = set()
for i, b in enumerate(live):
    if b["out"] in seen:
        print(f"[inbox] two blocks both build {b['out']} — give them different names")
        sys.exit(1)
    seen.add(b["out"])
    with open(os.path.join(outdir, f"block-{i}"), "w", encoding="utf-8") as fh:
        fh.write(b["out"] + "\n")
        for name, fid in b["files"]:
            fh.write(f"{name}\t{fid}\n")
    kind = "character with its own clip" if len(b["files"]) == 1 \
        else f"character + {len(b['files']) - 1} clip(s)"
    print(f"[inbox] {b['out']}: {kind}")
    for name, fid in b["files"]:
        print(f"[inbox]     {name:<18} {fid}")

print(f"[inbox] {len(live)} character(s) to build")
