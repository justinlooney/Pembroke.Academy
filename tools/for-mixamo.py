"""
Pembroke Academy — make a character Mixamo will actually accept.

    blender --background --python tools/for-mixamo.py -- \\
        out.fbx  character.glb  [--tris 60000]

Mixamo's auto-rigger is the right tool for an unrigged humanoid and it
turns a lot of files away at the door. Three reasons, in the order they
bite:

  format     it takes FBX, OBJ or ZIP. A glTF export is refused before
             anything inside it is looked at, which is what happens to
             every Sketchfab download.
  meshes     it wants one. A scan exported as body/hair/clothes as
             separate objects is four.
  weight     a 400,000-triangle scan is slow to upload, slow to solve,
             and far too heavy for a browser afterwards anyway.

None of that says anything about the character. This fixes all three
and changes nothing else.

One thing it cannot fix, because it happens before this script is
reached: every model in assets/ is written with --compress meshopt,
and Blender 4.0's glTF importer refuses one outright —

    Extension EXT_meshopt_compression is not available on this
    addon version

Decompress it first. gltf-transform reads meshopt and, told nothing
about compression on the way out, writes plain:

    gltf-transform copy assets/stu_nadia.glb /tmp/nadia.glb

.github/workflows/prep.yml does this for you, which is the way to run
any of this without a Blender to hand.

Worth knowing before you reach for the alternative: Mixamo's rigger
handles an A-pose natively — you place markers on chin, wrists, elbows,
knees and groin, and it solves from there. Borrowing a T-posed skeleton
from another download does not: the donor's arm bones run horizontally,
an A-posed character's arms do not, and automatic weights then bind the
upper arms to the chest. Run tools/inspect-rig.py to see both numbers.
A span/length near 0.9 is a T-pose, near 0.5 is an A-pose, and it is
the DIFFERENCE between character and donor that tears shoulders.
"""
import bpy
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
budget = 60000
if "--tris" in argv:
    i = argv.index("--tris")
    budget = int(argv[i + 1])
    argv = argv[:i] + argv[i + 2:]
if len(argv) < 2:
    print(__doc__)
    sys.exit(1)
dst, src = argv[0], argv[1]
if not os.path.isfile(src):
    print("[mixamo-prep] not found:", src)
    sys.exit(1)

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=src)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True)
elif ext == ".obj":
    bpy.ops.wm.obj_import(filepath=src)
else:
    print("[mixamo-prep] no importer for", ext)
    sys.exit(1)


def meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def tris():
    return sum(sum(max(len(p.vertices) - 2, 0) for p in o.data.polygons) for o in meshes())


got = meshes()
if not got:
    print("[mixamo-prep] no mesh in", src)
    sys.exit(1)
print("[mixamo-prep] in:  %d mesh(es), %d triangles" % (len(got), tris()))

"""Armatures are dropped. Mixamo rigs what you give it, and an existing
skeleton in the upload is at best ignored and at worst a reason for it
to refuse the file."""
for o in list(bpy.context.scene.objects):
    if o.type not in ("MESH",):
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action="DESELECT")
for o in meshes():
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes()[0]
if len(meshes()) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = "character"

have = tris()
if have > budget:
    mod = mesh.modifiers.new("thin", "DECIMATE")
    mod.ratio = budget / have
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print("[mixamo-prep] decimated %d -> %d triangles" % (have, tris()))

"""Transforms applied. Mixamo reads the mesh as it arrives and a scale
of 0.01 on the object — which is what an FBX round trip through some
tools leaves behind — makes a character it thinks is a centimetre
tall."""
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

os.makedirs(os.path.dirname(os.path.abspath(dst)) or ".", exist_ok=True)
bpy.ops.export_scene.fbx(filepath=dst, use_selection=True,
                         path_mode="COPY", embed_textures=True,
                         add_leaf_bones=False, bake_anim=False)
print("[mixamo-prep] out: %s — 1 mesh, %d triangles, %.1fMB"
      % (dst, tris(), os.path.getsize(dst) / 1e6))
print("[mixamo-prep] upload that at mixamo.com — Upload Character. Place the")
print("[mixamo-prep] markers, then download a walk WITH SKIN and In Place.")
