"""
Pembroke Academy — rig an unrigged character and make it walk, offline.

    blender --background --python tools/rig-and-walk.py -- \\
        out.glb  character.gltf  donor_with_rig_and_clips.glb \\
        [--tris 60000] [--clips "Standard Walk,Idle"]

Mixamo's auto-rigger is the easy path and it needs a browser, a login,
and a drag-and-drop marker step that is miserable on a phone. This does
the same job with no account and no network: a skeleton and its motion
both come out of a file the campus already ships.

THE PROBLEM THIS ACTUALLY SOLVES

A clip is curves addressed by bone name, so any Mixamo skeleton will
take any Mixamo clip. Binding that skeleton to a NEW body is where it
goes wrong, and the reason is the rest pose.

Mixamo skeletons stand in a T: arms straight out along X. Scanned and
sculpted characters usually do not — this one stands with her arms down
beside her, which measures 0.46 wide-over-tall against the skeleton's
0.96. Bind them as they are and the upper-arm bones run horizontally
through open air while the arms hang sixty degrees below, so automatic
weights give the arms to the chest and the shoulders tear on the first
frame.

Rotating the skeleton's arms down to meet her fixes the binding and
breaks the animation instead: pose values are relative to the rest
pose, so a clip authored for a T-rest played on an A-rest drives the
arms down twice.

So both, separately:

    DST   arms rotated down, rest matches the body, mesh bound to it
    SRC   an untouched copy in its original T, carrying the clips

and every DST bone copies SRC's WORLD rotation each frame, then bakes.
World space is the whole trick — it ignores both rest poses instead of
trying to do arithmetic between them, which is the kind of correction
that looks right and ships a person whose elbows point backwards.

WHAT IT STILL CANNOT DO

Automatic weights on arms held close to the body will bleed between the
arm and the ribs, and between the thighs where they touch. It is fine
at the distance a student is seen across a quad and it is not fine in
close-up. Renders are the way to judge that, not this docstring.

And it cannot fix shoes. A figure modelled in heels has a near-vertical
foot; every Mixamo clip assumes a flat one, so the ankle rotates about
the wrong place and the toe drives through the ground on each step.
"""
import bpy
import math
import os
import re
import sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
budget = 60000
want_clips = None
if "--tris" in argv:
    i = argv.index("--tris")
    budget = int(argv[i + 1])
    argv = argv[:i] + argv[i + 2:]
if "--clips" in argv:
    i = argv.index("--clips")
    want_clips = [c.strip() for c in argv[i + 1].split(",") if c.strip()]
    argv = argv[:i] + argv[i + 2:]
if len(argv) < 3:
    print(__doc__)
    sys.exit(1)
dst_path, char_file, donor_file = argv[0], argv[1], argv[2]
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


def new_objects(before):
    return [o for o in bpy.context.scene.objects if o not in before]


def tris(objs):
    return sum(sum(max(len(p.vertices) - 2, 0) for p in o.data.polygons) for o in objs)


def bbox(objs):
    lo = Vector((1e30, 1e30, 1e30))
    hi = -lo
    for o in objs:
        for c in o.bound_box:
            v = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, v))
            hi = Vector(map(max, hi, v))
    return lo, hi


def only(objs, kind):
    return [o for o in objs if o.type == kind]


# ── the body ─────────────────────────────────────────────────────────
before = set(bpy.context.scene.objects)
load(char_file)
arrived = new_objects(before)
body = only(arrived, "MESH")
if not body:
    print("[rig] no mesh in", char_file)
    sys.exit(1)
for o in arrived:
    if o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action="DESELECT")
for o in body:
    o.select_set(True)
bpy.context.view_layer.objects.active = body[0]
if len(body) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = "character"
have = tris([mesh])
if have > budget:
    m = mesh.modifiers.new("thin", "DECIMATE")
    m.ratio = budget / have
    bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
clo, chi = bbox([mesh])
csize = chi - clo
c_tall = csize.z
c_wide = max(csize.x, csize.y)
print("[rig] body: %d triangles, %.3f tall, %.3f wide, span/length %.2f"
      % (tris([mesh]), c_tall, c_wide, c_wide / max(c_tall, 1e-9)))

# ── the skeleton and its motion ──────────────────────────────────────
before = set(bpy.context.scene.objects)
load(donor_file)
arrived = new_objects(before)
rigs = only(arrived, "ARMATURE")
if not rigs:
    print("[rig] no armature in", donor_file)
    sys.exit(1)
dst = rigs[0]
for o in arrived:
    if o is not dst:
        bpy.data.objects.remove(o, do_unlink=True)
dst.parent = None
dst.name = "DST"

clips = [a for a in bpy.data.actions]
print("[rig] actions in the donor: %s" % (", ".join(a.name for a in clips) or "none"))
if want_clips:
    """Matched loosely on purpose. Blender renames actions on import —
    a clip stored as "Standard Walk" can arrive as
    "Armature|Standard Walk" or "Object_1Action" — and an exact-name
    filter silently selected nothing, which the script then reported as
    "no clips in the donor" and cheerfully rigged a statue."""
    low = [c.lower() for c in want_clips]
    clips = [a for a in clips if any(c in a.name.lower() for c in low)]
    if not clips:
        print("[rig] --clips matched nothing; taking every action instead")
        clips = [a for a in bpy.data.actions]
if not clips:
    print("[rig] no clips in", donor_file, "— rigging only")
print("[rig] skeleton: %d bones, %d clip(s): %s"
      % (len(dst.data.bones), len(clips), ", ".join(a.name for a in clips) or "none"))

# ── fit the skeleton to the body ─────────────────────────────────────
rlo, rhi = None, None
dst.rotation_mode = "QUATERNION"
bpy.context.view_layer.update()


def rig_bbox(rig):
    lo = Vector((1e30, 1e30, 1e30))
    hi = -lo
    for b in rig.data.bones:
        for p in (b.head_local, b.tail_local):
            w = rig.matrix_world @ p
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


rlo, rhi = rig_bbox(dst)
k = c_tall / max(1e-9, (rhi.z - rlo.z))
dst.scale = (k, k, k)
bpy.context.view_layer.update()
rlo, rhi = rig_bbox(dst)
dst.location = (dst.location.x + (clo.x + chi.x) / 2 - (rlo.x + rhi.x) / 2,
                dst.location.y + (clo.y + chi.y) / 2 - (rlo.y + rhi.y) / 2,
                dst.location.z + clo.z - rlo.z)
bpy.context.view_layer.update()
print("[rig] skeleton scaled %.3f and stood on the body's feet" % k)

# ── an untouched twin, still in its T, to carry the clips ────────────
bpy.ops.object.select_all(action="DESELECT")
dst.select_set(True)
bpy.context.view_layer.objects.active = dst
bpy.ops.object.duplicate()
src = bpy.context.view_layer.objects.active
src.name = "SRC"
src.animation_data_clear()
print("[rig] kept a T-posed twin to read world rotations from")

# ── rotate DST's arms down to meet the body ──────────────────────────
ARM = re.compile(r"(mixamorig\d*:)?(Left|Right)Arm$", re.I)


def chain(edit_bones, root):
    out = [root]
    i = 0
    while i < len(out):
        out.extend(c for c in out[i].children)
        i += 1
    return out


bpy.context.view_layer.objects.active = dst
bpy.ops.object.mode_set(mode="EDIT")
eb = dst.data.edit_bones
arms = [b for b in eb if ARM.match(b.name)]
if len(arms) != 2:
    print("[rig] expected two upper-arm bones, found %d — arms left as they are"
          % len(arms))
    theta = 0.0
else:
    """Measured off the arm chains themselves, not off the skeleton's
    bounding box. The bbox was wrong by two orders of magnitude — it
    reported a 187-unit span for a 1.9-metre body, because one stray
    bone anywhere in the rig drags the box with it — and the angle that
    came out of it was 90 degrees, which put the arm bones straight down
    through the legs, lost bone-heat weighting, and crashed the
    exporter. A reach is a distance from a shoulder to a fingertip, so
    measure exactly that."""
    def reach_of(root):
        far = 0.0
        for b in chain(eb, root):
            for p in (b.head, b.tail):
                far = max(far, abs(p.x - root.head.x))
        return far

    shoulder_l = abs(arms[0].head.x - arms[1].head.x)
    reach_l = max(1e-9, (reach_of(arms[0]) + reach_of(arms[1])) / 2)
    """The body's width converted into the skeleton's own units, rather
    than the skeleton's converted into the body's — k is the scale the
    object carries, and the edit bones do not know about it."""
    target_l = c_wide / max(k, 1e-9)
    want = max(-1.0, min(1.0, (target_l - shoulder_l) / (2 * reach_l)))
    theta = math.acos(want)
    print("[rig] arms: reach %.3f, shoulders %.3f, body wants %.3f "
          "(all in skeleton units) → rotating down %.1f degrees"
          % (reach_l, shoulder_l, target_l, math.degrees(theta)))
    for root in arms:
        sign = 1.0 if root.head.x > 0 else -1.0
        pivot = root.head.copy()
        rot = Matrix.Rotation(sign * theta, 4, "Y")
        for b in chain(eb, root):
            b.head = pivot + rot @ (b.head - pivot)
            b.tail = pivot + rot @ (b.tail - pivot)
bpy.ops.object.mode_set(mode="OBJECT")

# ── weights ──────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
dst.select_set(True)
bpy.context.view_layer.objects.active = dst
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
print("[rig] bound with automatic weights")

"""Bone-heat weighting leaves vertices unweighted when it cannot find a
solution — inside a closed armpit, between thighs that touch — and says
so in a warning nobody reads. Two things then happen: those vertices
stay behind while the rest of the body walks off, and Blender's glTF
exporter walks into

    add_neutral_bones → n.node.skin.joints.append
    AttributeError: 'NoneType' object has no attribute 'joints'

and takes the whole export with it. Give the orphans to the root bone.
A vertex rigidly attached to the hips is wrong in a way you have to
look for; a vertex attached to nothing is a hole in a person."""
root_bone = next((b.name for b in dst.data.bones if not b.parent), None)
if root_bone:
    grp = mesh.vertex_groups.get(root_bone) or mesh.vertex_groups.new(name=root_bone)
    known = {g.name for g in mesh.vertex_groups}
    orphans = []
    for v in mesh.data.vertices:
        if not any(g.weight > 0 and mesh.vertex_groups[g.group].name in known
                   for g in v.groups):
            orphans.append(v.index)
    if orphans:
        grp.add(orphans, 1.0, "REPLACE")
        print("[rig] %d vertex/vertices had no weight at all — given to %s"
              % (len(orphans), root_bone))
    else:
        print("[rig] every vertex is weighted")

# ── the motion, in world space ───────────────────────────────────────
if not src.animation_data:
    src.animation_data_create()
if not dst.animation_data:
    dst.animation_data_create()

bpy.context.view_layer.objects.active = dst
bpy.ops.object.mode_set(mode="POSE")
for pb in dst.pose.bones:
    if pb.name not in src.pose.bones:
        continue
    """Rotation in world space for every bone, and location too for the
    root — the hips carry the whole figure's travel and a rotation-only
    copy leaves it walking on the spot inside a stationary pelvis."""
    c = pb.constraints.new("COPY_ROTATION")
    c.target = src
    c.subtarget = pb.name
    c.target_space = c.owner_space = "WORLD"
    if not pb.parent:
        c = pb.constraints.new("COPY_LOCATION")
        c.target = src
        c.subtarget = pb.name
        c.target_space = c.owner_space = "WORLD"
bpy.ops.object.mode_set(mode="OBJECT")

baked = []
for act in clips:
    src.animation_data.action = act
    lo_f, hi_f = (int(round(v)) for v in act.frame_range)
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = lo_f, hi_f
    bpy.context.view_layer.objects.active = dst
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    """visual_keying reads the constrained result rather than the
    (empty) local channels; clear_constraints stays FALSE so the next
    clip can bake through the same rig."""
    bpy.ops.nla.bake(frame_start=lo_f, frame_end=hi_f, only_selected=False,
                     visual_keying=True, clear_constraints=False,
                     clear_parents=False, use_current_action=False,
                     bake_types={"POSE"})
    made = dst.animation_data.action
    made.name = act.name
    made.use_fake_user = True
    moving = sum(1 for fc in made.fcurves
                 if len({round(kp.co[1], 5) for kp in fc.keyframe_points}) > 1)
    print("[rig]   %-16s frames %d-%d, %d curves, %d move"
          % (made.name, lo_f, hi_f, len(made.fcurves), moving))
    if moving == 0:
        print("[rig]   ^ nothing in that clip moves — dropped")
        bpy.data.actions.remove(made)
    else:
        baked.append(made)
    dst.animation_data.action = None
bpy.ops.object.mode_set(mode="OBJECT")

# constraints have served their purpose; leave them and the export
# would re-evaluate against a twin that is about to be deleted
bpy.context.view_layer.objects.active = dst
bpy.ops.object.mode_set(mode="POSE")
for pb in dst.pose.bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.data.objects.remove(src, do_unlink=True)

if baked:
    dst.animation_data.action = baked[0]

# ── out ──────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
dst.select_set(True)
os.makedirs(os.path.dirname(os.path.abspath(dst_path)) or ".", exist_ok=True)
export = dict(filepath=dst_path, export_format="GLB", use_selection=True,
              export_yup=True, export_animations=True,
              export_animation_mode="ACTIONS", export_skins=True,
              export_apply=False)
try:
    bpy.ops.export_scene.gltf(**export)
except TypeError:
    for key in ("export_animation_mode", "export_apply"):
        export.pop(key, None)
    bpy.ops.export_scene.gltf(**export)
print("[rig] wrote %s — %d triangles, %d bones, %d clip(s), %.2fMB"
      % (dst_path, tris([mesh]), len(dst.data.bones), len(baked),
         os.path.getsize(dst_path) / 1e6))
blend = os.path.splitext(dst_path)[0] + ".blend"
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(blend))
print("[rig] and", blend)
