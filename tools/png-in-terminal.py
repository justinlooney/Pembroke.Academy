"""
Pembroke Academy — look at a PNG over SSH, without leaving the terminal.

    blender --background --python tools/png-in-terminal.py -- shot.png [cols]

Every render in this repo happens on a machine you are not sitting at:
a GitHub runner, or a box at the end of an ssh session. The usual
answers are scp, a file host, or forwarding a port, and all three are
more setup than the question deserves when the question is "are her
arms out".

So: half-block characters and 24-bit colour. Two rows of pixels per
line of text, which is enough resolution to read a silhouette, a pose,
and whether a model came in lying down. It is not enough to judge a
texture, and it is not meant to be.

Blender does the decoding because Blender is already installed —
Python's standard library has no PNG reader, and asking for Pillow
means asking about pip on a distro that has opinions about pip.
"""
import bpy
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if not argv:
    print(__doc__)
    sys.exit(1)

path = argv[0]
cols = int(argv[1]) if len(argv) > 1 else 72
if not os.path.isfile(path):
    print("[png] not found:", path)
    sys.exit(1)

img = bpy.data.images.load(os.path.abspath(path))
w, h = img.size
if not w or not h:
    print("[png] could not read", path)
    sys.exit(1)
px = list(img.pixels)          # RGBA floats, row 0 at the BOTTOM

# Terminal cells are about twice as tall as they are wide, and a half
# block gives back the vertical resolution that costs.
rows = max(1, int(cols * h / w / 2))


def sample(cx, cy):
    """Nearest pixel, flipped: image row 0 is the bottom, text row 0 is
    the top, and getting that backwards silently prints upside down —
    which on a pose check is a person standing on their head."""
    x = min(w - 1, int(cx * w / cols))
    y = min(h - 1, int((1 - cy / (rows * 2)) * h))
    i = (y * w + x) * 4
    return px[i], px[i + 1], px[i + 2]


def srgb(c):
    """Blender keeps pixels linear; a terminal expects sRGB. Skipping
    this prints a correct image that looks like it was shot at night."""
    c = max(0.0, min(1.0, c))
    c = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return int(c * 255 + 0.5)


print(f"[png] {os.path.basename(path)} — {w}x{h}, drawn at {cols}x{rows}")
out = []
for r in range(rows):
    line = []
    for c in range(cols):
        tr, tg, tb = (srgb(v) for v in sample(c, r * 2))
        br, bg, bb = (srgb(v) for v in sample(c, r * 2 + 1))
        line.append(f"\033[38;2;{tr};{tg};{tb}m\033[48;2;{br};{bg};{bb}m▀")
    out.append("".join(line) + "\033[0m")
print("\n".join(out))
