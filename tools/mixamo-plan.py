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
for raw in open(src, encoding="utf-8"):
    line = raw.rstrip("\n")
    out = re.match(r"^\s*#\s*out:\s*(\S+)", line)
    if out:
        cur = {"out": out.group(1), "files": []}
        blocks.append(cur)
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
        cur = {"out": "assets/stu_walker.glb", "files": []}
        blocks.append(cur)
    fid = re.search(r"/d/([^/]+)", url) or re.search(r"[?&]id=([^&]+)", url)
    if not fid:
        print(f"[inbox] {name}: no Drive file id in {url}")
        sys.exit(1)
    cur["files"].append((name, fid.group(1)))

live = [b for b in blocks if b["files"]]
os.makedirs(outdir, exist_ok=True)
for f in os.listdir(outdir):
    os.remove(os.path.join(outdir, f))

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
