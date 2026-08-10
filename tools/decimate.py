"""
Pembroke Academy — headless mesh decimation.

The campus is 79% geometry by weight: photogrammetry scans carrying
millions of triangles for buildings the visitor only ever sees from
across a lawn. Blender collapses those meshes far better than a
generic optimiser, because it can weld seams first and keep UVs and
vertex colours intact while it does.

    blender --background --python tools/decimate.py -- in.glb out.glb 0.2

The ratio is the fraction of triangles to KEEP. Prints before/after so
the caller can see what each pass actually bought.
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 3:
    print("usage: decimate.py -- <in.glb> <out.glb> <keep-ratio> [weld-distance]")
    sys.exit(1)

src, dst, ratio = argv[0], argv[1], float(argv[2])
weld = float(argv[3]) if len(argv) > 3 else 0.0

# start from an empty file — Blender's default scene has a cube in it
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

def tris():
    n = 0
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n

before = tris()
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
print(f"[decimate] {os.path.basename(src)}: {len(meshes)} meshes, {before:,} tris -> keep {ratio}")

for o in meshes:
    bpy.context.view_layer.objects.active = o

    # Scans are full of duplicated vertices along chart seams; welding
    # first gives the collapser edges it can actually contract.
    if weld > 0:
        w = o.modifiers.new(name="weld", type="WELD")
        w.merge_threshold = weld
        try:
            bpy.ops.object.modifier_apply(modifier=w.name)
        except RuntimeError as e:
            print(f"[decimate]   weld skipped on {o.name}: {e}")
            o.modifiers.remove(w)

    if ratio < 1.0:
        m = o.modifiers.new(name="decimate", type="DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = ratio
        m.use_collapse_triangulate = True
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except RuntimeError as e:
            print(f"[decimate]   decimate skipped on {o.name}: {e}")
            o.modifiers.remove(m)

after = tris()

# Export uncompressed: gltf-transform applies meshopt + WebP afterwards,
# which is what the site's loader already expects. Draco would need a
# different decoder in the page.
export = dict(
    filepath=dst,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
)
try:
    bpy.ops.export_scene.gltf(**export)
except TypeError:
    export.pop("export_apply", None)          # older/newer arg sets
    bpy.ops.export_scene.gltf(**export)

src_mb = os.path.getsize(src) / 1e6
dst_mb = os.path.getsize(dst) / 1e6
print(f"[decimate] {os.path.basename(src)}: {before:,} -> {after:,} tris "
      f"({100.0 * after / max(before, 1):.0f}%), {src_mb:.1f}MB -> {dst_mb:.1f}MB (pre-compression)")
