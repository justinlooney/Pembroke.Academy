"""
Pembroke Academy — headless mesh decimation.

The campus is 79% geometry by weight: photogrammetry scans carrying
millions of triangles for buildings the visitor only sees from across a
lawn. Blender collapses those meshes better than a generic optimiser
because it can weld scan seams first and keep UVs and vertex colours
through the process.

    blender --background --python tools/decimate.py -- in.glb out.glb 60000

The third argument is a TARGET TRIANGLE COUNT, not a ratio. Ratios are
treacherous here: welding already removes triangles, so a ratio applied
afterwards compounds with it and the result depends on how messy the
scan happened to be. A target is predictable — ask for 60k, get 60k.

Weld distance is likewise relative to the model's own bounding box,
because one scan arrives in metres and the next in whatever units its
scanner felt like.
"""
import bpy
import sys
import os
import math
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 3:
    print("usage: decimate.py -- <in.glb> <out.glb> <target-tris> [weld-fraction]")
    sys.exit(1)

src, dst = argv[0], argv[1]
target = int(float(argv[2]))
weld_frac = float(argv[3]) if len(argv) > 3 else 0.0     # of the bbox diagonal; off by default

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

def meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]

def tris():
    n = 0
    for o in meshes():
        o.data.calc_loop_triangles()
        n += len(o.data.loop_triangles)
    return n

def apply(o, mod):
    bpy.context.view_layer.objects.active = o
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
        return True
    except RuntimeError as e:
        print(f"[decimate]   {mod.type.lower()} skipped on {o.name}: {e}")
        o.modifiers.remove(mod)
        return False

failures = 0
ms = meshes()
before = tris()

# model-relative weld distance
mn = [1e30] * 3
mx = [-1e30] * 3
for o in ms:
    for corner in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(corner)
        for i in range(3):
            mn[i] = min(mn[i], w[i])
            mx[i] = max(mx[i], w[i])
diag = math.dist(mn, mx) if before else 0.0
weld_dist = weld_frac * diag

print(f"[decimate] {os.path.basename(src)}: {len(ms)} meshes, {before:,} tris, "
      f"bbox diagonal {diag:.2f}, weld {weld_dist:.5f}, target {target:,}")

if weld_dist > 0:
    for o in ms:
        w = o.modifiers.new(name="weld", type="WELD")
        w.merge_threshold = weld_dist
        apply(o, w)
    welded = tris()
    if welded != before:
        print(f"[decimate]   weld: {before:,} -> {welded:,} tris")
    if welded < target:
        # A weld distance too large for the model's detail scale melts it
        # away, and the ratio below then clamps to 1.0 and hides the
        # damage. Start over without welding rather than ship a lump.
        print(f"[decimate]   weld overshot the {target:,} budget — reimporting without it")
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=src)
        ms = meshes()
        welded = tris()
else:
    welded = before

# one ratio for every mesh, derived from what is actually left
ratio = min(1.0, target / max(welded, 1))
if ratio < 1.0:
    for o in ms:
        m = o.modifiers.new(name="decimate", type="DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = ratio
        m.use_collapse_triangulate = True
        if not apply(o, m):
            failures += 1

after = tris()

export = dict(filepath=dst, export_format="GLB", export_apply=True, export_yup=True)
try:
    bpy.ops.export_scene.gltf(**export)
except TypeError:
    export.pop("export_apply", None)
    bpy.ops.export_scene.gltf(**export)

flag = "" if after >= target * 0.8 or target >= before else "   ** UNDER BUDGET **"
if failures:
    # Exporting here would hand back a model that quietly missed its
    # budget; the caller must not mistake that for a saving.
    print(f"[decimate] ABORT: decimation failed on {failures} mesh(es) of {os.path.basename(src)}")
    sys.exit(2)
print(f"[decimate] {os.path.basename(src)}: {before:,} -> {after:,} tris "
      f"({100.0 * after / max(before, 1):.1f}% kept){flag}, "
      f"{os.path.getsize(src)/1e6:.1f}MB -> {os.path.getsize(dst)/1e6:.1f}MB (pre-compression)")
