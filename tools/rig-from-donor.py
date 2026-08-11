"""
Pembroke Academy — give an unrigged character a Mixamo skeleton, locally.

    blender --background --python tools/rig-from-donor.py -- \\
        out.glb  character.glb  donor_with_mixamo_rig.fbx \\
        [--tris 60000] [--clips Walking.fbx Idle.fbx ...]

The donor supplies the SKELETON. The clips supply the MOTION, and they
are not the same file: a Mixamo character download carries a one-frame
bind pose and no movement at all, which is worth knowing before you
wonder why your character is standing there. Grab the clips from
Mixamo's animation library — "without skin", so they are kilobytes
rather than tens of megabytes — and tick In Place.

WHY THIS EXISTS

Mixamo's auto-rigger is the easy path and it refuses a lot of files. It
takes FBX, OBJ or ZIP and nothing else — a glTF export is rejected
before it is ever looked at — and it wants one mesh, upright, arms out,
no props. A photogrammetry scan or a sculpt export usually fails at
least one of those.

The skeleton itself is not the hard part, though, and you probably
already have one. Any Mixamo download carries a 52-bone rig named
mixamorig:Hips, mixamorig:LeftUpLeg and so on. Borrow it. A character
parented to that armature IS a Mixamo character as far as every clip in
the world is concerned, because a clip addresses bones by name and does
not care where the skeleton came from. No retargeting, no bone mapping,
no name-translation step that silently addresses nothing.

WHAT THIS DOES

  1. imports the character (glb/gltf/fbx/obj) and joins its meshes
  2. decimates to a triangle budget — a 400k-triangle scan is both
     slower to weight and far too heavy for a browser
  3. imports the donor, throws away its mesh, keeps its armature
  4. scales and centres the armature to the character's bounding box
  5. parents with automatic weights
  6. exports a GLB with the skeleton in it

WHAT THIS CANNOT DO

Automatic weights need the mesh and the rest pose to roughly agree. If
your character stands with arms down and the donor armature is a
T-pose, the arm bones run through open air and the shoulders will tear.
Step 4 is a bounding-box fit — it gets height and centre right and
nothing else.

So: run it, open the .blend, and look. If the arms are wrong, move the
bones in Edit Mode to sit inside the limbs and re-parent. That is a
five-minute job by eye and there is no script that does it reliably —
anyone who tells you otherwise has not tried it on a scan.

Check the result with tools/inspect-rig.py, which will tell you how many
bones a clip would land on.
"""
import bpy
import os
import re
import sys
from mathutils import Vector

NS = re.compile(r"^(mixamorig\d*):")


def namespace_of(rig):
    """Whatever prefix this skeleton's bones carry. Mixamo hands out
    mixamorig:, mixamorig2:, mixamorig3: depending on the download, and
    a clip written for one will not bind to another."""
    for b in rig.data.bones:
        m = NS.match(b.name)
        if m:
            return m.group(1) + ":"
    return ""


def clip_name(path):
    """Mixamo names every action "mixamo.com", so they all collide. The
    file name is the only thing that says what the motion is."""
    stem = os.path.splitext(os.path.basename(path))[0]
    stem = re.sub(r"[_\-]+", " ", stem)
    stem = re.sub(r"\s*\(\d+\)$", "", stem)
    return re.sub(r"\s+", " ", stem).strip() or "clip"

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 3:
    print(__doc__)
    sys.exit(1)

clip_files = []
if "--clips" in argv:
    i = argv.index("--clips")
    clip_files = argv[i + 1:]
    argv = argv[:i]
budget = 60000
if "--tris" in argv:
    i = argv.index("--tris")
    budget = int(argv[i + 1])
    argv = argv[:i] + argv[i + 2:]
if len(argv) < 3:
    print(__doc__)
    sys.exit(1)
dst, char_file, donor_file = argv[0], argv[1], argv[2]
for f in (char_file, donor_file):
    if not os.path.isfile(f):
        print("[rig] not found:", f)
        sys.exit(1)

bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path, ignore_leaf_bones=True,
                                 automatic_bone_orientation=True)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise RuntimeError("no importer for " + ext)


def meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def rigs():
    return [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]


def tris_of(objs):
    n = 0
    for o in objs:
        n += sum(max(len(p.vertices) - 2, 0) for p in o.data.polygons)
    return n


# ── 1. the character ────────────────────────────────────────────────
load(char_file)
body = meshes()
if not body:
    print("[rig] no mesh in", char_file)
    sys.exit(1)
if rigs():
    print("[rig] NOTE:", char_file, "already has an armature. This script is for")
    print("[rig] characters that have none; the existing one is left in place and")
    print("[rig] you probably want tools/inspect-rig.py instead.")
    sys.exit(1)

print("[rig] character: %d mesh(es), %d triangles" % (len(body), tris_of(body)))
bpy.ops.object.select_all(action="DESELECT")
for o in body:
    o.select_set(True)
bpy.context.view_layer.objects.active = body[0]
if len(body) > 1:
    bpy.ops.object.join()
    print("[rig] joined into one mesh")
mesh = bpy.context.view_layer.objects.active

# ── 2. down to a budget ─────────────────────────────────────────────
have = tris_of([mesh])
if have > budget:
    mod = mesh.modifiers.new("thin", "DECIMATE")
    mod.ratio = budget / have
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print("[rig] decimated %d -> %d triangles" % (have, tris_of([mesh])))
else:
    print("[rig] %d triangles, under the %d budget — left alone" % (have, budget))

box = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
lo = Vector((min(v.x for v in box), min(v.y for v in box), min(v.z for v in box)))
hi = Vector((max(v.x for v in box), max(v.y for v in box), max(v.z for v in box)))
print("[rig] character stands %.3f tall, centred at (%.3f, %.3f)"
      % (hi.z - lo.z, (lo.x + hi.x) / 2, (lo.y + hi.y) / 2))

# ── 3. the donor's skeleton, without the donor ──────────────────────
before = set(bpy.context.scene.objects)
load(donor_file)
arrived = [o for o in bpy.context.scene.objects if o not in before]
donor_rigs = [o for o in arrived if o.type == "ARMATURE"]
if not donor_rigs:
    print("[rig] no armature in", donor_file, "— nothing to borrow")
    sys.exit(1)
rig = donor_rigs[0]
for o in arrived:
    if o is not rig:
        bpy.data.objects.remove(o, do_unlink=True)
rig.parent = None
names = [b.name for b in rig.data.bones]
print("[rig] borrowed '%s': %d bones, e.g. %s" % (rig.name, len(names), ", ".join(names[:4])))

# ── 4. fit it to the character ──────────────────────────────────────
rbox = [rig.matrix_world @ Vector(c) for c in rig.bound_box]
rlo = Vector((min(v.x for v in rbox), min(v.y for v in rbox), min(v.z for v in rbox)))
rhi = Vector((max(v.x for v in rbox), max(v.y for v in rbox), max(v.z for v in rbox)))
rh = max(1e-6, rhi.z - rlo.z)
k = (hi.z - lo.z) / rh
rig.scale = (k, k, k)
bpy.context.view_layer.update()
rbox = [rig.matrix_world @ Vector(c) for c in rig.bound_box]
rlo = Vector((min(v.x for v in rbox), min(v.y for v in rbox), min(v.z for v in rbox)))
rhi = Vector((max(v.x for v in rbox), max(v.y for v in rbox), max(v.z for v in rbox)))
rig.location = (rig.location.x + (lo.x + hi.x) / 2 - (rlo.x + rhi.x) / 2,
                rig.location.y + (lo.y + hi.y) / 2 - (rlo.y + rhi.y) / 2,
                rig.location.z + lo.z - rlo.z)
print("[rig] scaled the skeleton by %.3f and sat it on the character's feet" % k)
print("[rig] this is a bounding-box fit: height and centre only. LOOK AT IT.")

# ── 5. weights ──────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
print("[rig] parented with automatic weights")

# ── 6. the motion ───────────────────────────────────────────────────
ns = namespace_of(rig)
clips = []
if rig.animation_data and rig.animation_data.action:
    """The donor's own action, if it has one. Kept only when it moves:
    a Mixamo character download carries a one-frame bind pose, and
    exporting that as a clip gives you a person who insists they are
    animated and never moves a muscle."""
    a = rig.animation_data.action
    moving = any(len({round(kp.co[1], 5) for kp in fc.keyframe_points}) > 1
                 for fc in a.fcurves)
    if moving:
        a.name = clip_name(donor_file)
        a.use_fake_user = True
        clips.append(a)
    else:
        print("[rig] the donor's own action never moves — a bind pose, dropped")
        rig.animation_data.action = None

for path in clip_files:
    if not os.path.isfile(path):
        print("[rig] clip not found, skipped:", path)
        continue
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=path, ignore_leaf_bones=True,
                             automatic_bone_orientation=True)
    added = [o for o in bpy.context.scene.objects if o not in before]
    action = next((o.animation_data.action for o in added
                   if o.type == "ARMATURE" and o.animation_data and o.animation_data.action), None)
    if action is None:
        print("[rig]  ", os.path.basename(path), "has no animation in it, skipped")
        for o in added:
            bpy.data.objects.remove(o, do_unlink=True)
        continue
    action.name = clip_name(path)
    action.use_fake_user = True
    """Mixamo numbers its namespace per download — one file comes back as
    mixamorig:Hips and the next as mixamorig2:Hips. The skeletons are
    otherwise identical, so a clip from one will not bind to the other,
    and Blender bakes the rest pose instead: a full set of channels that
    never change. That exports cleanly and produces someone standing
    perfectly still while insisting they are walking."""
    moved = 0
    for fc in action.fcurves:
        m = re.match(r'(pose\.bones\[")([^"]+)("\].*)', fc.data_path)
        if not m:
            continue
        head, bone, tail = m.groups()
        want = ns + NS.sub("", bone)
        if want != bone:
            fc.data_path = head + want + tail
            moved += 1
    targets = {m.group(1) for fc in action.fcurves
               for m in [re.match(r'pose\.bones\["([^"]+)"\]', fc.data_path)] if m}
    unknown = targets - {b.name for b in rig.data.bones}
    if unknown:
        print("[rig]   %s: %d of %d bones are not on this skeleton — e.g. %s"
              % (action.name, len(unknown), len(targets), sorted(unknown)[:4]))
        print("[rig]   it would export as motionless channels, so it is dropped")
        for o in added:
            bpy.data.objects.remove(o, do_unlink=True)
        continue
    print("[rig]   %s: %d curves onto %s, %d bones" % (action.name, moved, ns or "(none)", len(targets)))
    clips.append(action)
    for o in added:
        bpy.data.objects.remove(o, do_unlink=True)

if clips:
    if not rig.animation_data:
        rig.animation_data_create()
    rig.animation_data.action = clips[0]
elif clip_files:
    print("[rig] no clip survived — the character is rigged but does not move")

# ── 7. out ──────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
rig.select_set(True)
os.makedirs(os.path.dirname(os.path.abspath(dst)) or ".", exist_ok=True)
export = dict(filepath=dst, export_format="GLB", use_selection=True,
              export_yup=True, export_animations=True,
              export_animation_mode="ACTIONS", export_skins=True,
              export_apply=False)   # never apply modifiers to a rigged mesh
try:
    bpy.ops.export_scene.gltf(**export)
except TypeError:
    for k in ("export_animation_mode", "export_apply"):
        export.pop(k, None)
    bpy.ops.export_scene.gltf(**export)
print("[rig] wrote %s — %d bones, %d clip(s), %.2fMB"
      % (dst, len(rig.data.bones), len(clips), os.path.getsize(dst) / 1e6))
blend = os.path.splitext(dst)[0] + ".blend"
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(blend))
print("[rig] and", blend, "— open this one to check the arms before you trust it")
