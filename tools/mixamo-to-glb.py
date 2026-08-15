"""
Pembroke Academy — turn Mixamo downloads into one web-ready character.

Mixamo hands out FBX; the campus needs glTF. It also hands out one file
per animation, and the web wants the opposite: a single GLB carrying the
character once and every clip alongside it, so the browser downloads one
mesh and one skeleton no matter how many ways the person can move.

    blender --background --python tools/mixamo-to-glb.py -- \\
        assets/stu_walker.glb  character.fbx  Walking.fbx Idle.fbx Jogging.fbx

The FIRST fbx is the one you downloaded WITH SKIN — it brings the mesh,
the skeleton and its own clip. Every fbx after it is animation-only
("without skin"): its motion is lifted onto the character and its file
name becomes the clip name, so call the downloads what you want the
clips to be called.

Clips may come from different Mixamo characters. They share one skeleton
but not one namespace — Mixamo hands out mixamorig:, mixamorig2:,
mixamorig3: depending on the download — so every clip is retargeted onto
the character's own namespace before export. Without that, Blender bakes
the rest pose and the result is a full set of channels that never change:
a build that succeeds and a student who stands perfectly still.

Tick "In Place" on Mixamo where it is offered. The campus pins root
travel itself and drives playback from how fast a student is actually
walking, so a clip that also carries travel fights it.
"""
import bpy
import os
import re
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    print(__doc__)
    sys.exit(1)

dst, src_files = argv[0], argv[1:]
missing = [f for f in src_files if not os.path.isfile(f)]
if missing:
    print("[mixamo] not found:\n  " + "\n  ".join(missing))
    sys.exit(1)

bpy.ops.wm.read_factory_settings(use_empty=True)


def clip_name(path):
    """Mixamo names every action "mixamo.com", so they would all collide.
    The file name is the only thing that says what the motion is."""
    stem = os.path.splitext(os.path.basename(path))[0]
    stem = re.sub(r"[_\-]+", " ", stem)
    stem = re.sub(r"\s*\(\d+\)$", "", stem)          # "Walking (1)" from a re-download
    return re.sub(r"\s+", " ", stem).strip() or "clip"


def armatures():
    return [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]


NS = re.compile(r"^(mixamorig\d*):")

def namespace_of(rig):
    """Whatever prefix this character's bones carry — usually mixamorig:
    but Mixamo hands out mixamorig2:, mixamorig3: and so on."""
    for b in rig.data.bones:
        m = NS.match(b.name)
        if m:
            return m.group(1) + ":"
    return ""


def retarget_action(action, ns):
    """Point every curve at the character's namespace instead of the one
    the donor happened to be exported with."""
    moved = 0
    for fc in action.fcurves:
        m = re.match(r'(pose\.bones\[")([^"]+)("\].*)', fc.data_path)
        if not m:
            continue
        head, bone, tail = m.groups()
        base = NS.sub("", bone)
        want = ns + base
        if want != bone:
            fc.data_path = head + want + tail
            moved += 1
    if moved:
        print(f"[mixamo]   {action.name}: retargeted {moved} curves onto {ns}")
    return moved


def import_fbx(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(
        filepath=path,
        # Mixamo's bone roll is arbitrary; letting Blender derive it keeps
        # limbs bending the way the mocap intended.
        automatic_bone_orientation=True,
        ignore_leaf_bones=True)
    return [o for o in bpy.context.scene.objects if o not in before]


# ── the character ────────────────────────────────────────────────────
char_objs = import_fbx(src_files[0])
rigs = [o for o in char_objs if o.type == "ARMATURE"]
if not rigs:
    print(f"[mixamo] {os.path.basename(src_files[0])} has no armature — that is the "
          f"'without skin' download. Pass the WITH SKIN one first.")
    sys.exit(1)
rig = rigs[0]
meshes = [o for o in char_objs if o.type == "MESH"]
# An out named clip_* is an ANIMATION DONOR: the workflow deletes every
# mesh, material and texture from it seconds after this script writes
# it. Demanding a mesh in order to throw it away is backwards, and it
# cost a courier run — the four clips that free walker from being the
# only body with an idle are animation-only downloads by nature, and
# this guard rejected all four with "re-download it with skin". For a
# character the guard stays: a person without a mesh is not a person.
CLIP_ONLY = os.path.basename(dst).startswith("clip_")
if not meshes and not CLIP_ONLY:
    print(f"[mixamo] {os.path.basename(src_files[0])} has a skeleton but no mesh. "
          f"Re-download it with skin.")
    sys.exit(1)
if CLIP_ONLY and not meshes:
    print("[mixamo] clip donor: skeleton and motion only, which is what a donor is")

bones = len(rig.data.bones)
char_ns = namespace_of(rig)
print(f"[mixamo] character rig: {bones} bones, namespace {char_ns or '(none)'}")
clips = []

# the character's own download usually carries a clip too — keep it
if rig.animation_data and rig.animation_data.action:
    a = rig.animation_data.action
    a.name = clip_name(src_files[0])
    a.use_fake_user = True                 # or Blender drops it before export
    clips.append(a)

# ── every other file contributes its motion and nothing else ─────────
for path in src_files[1:]:
    added = import_fbx(path)
    src_rigs = [o for o in added if o.type == "ARMATURE"]
    action = None
    for o in src_rigs:
        if o.animation_data and o.animation_data.action:
            action = o.animation_data.action
            break
    if action is None:
        print(f"[mixamo]   {os.path.basename(path)}: no animation in this file, skipped")
        for o in added:
            bpy.data.objects.remove(o, do_unlink=True)
        continue

    action.name = clip_name(path)
    action.use_fake_user = True
    clips.append(action)

    # Mixamo numbers its bone namespace per download: one character comes
    # back as "mixamorig:Hips" and the next as "mixamorig2:Hips". The
    # skeletons are otherwise identical, so a clip from one will not bind
    # to the other — Blender bakes the rest pose instead and exports a
    # full set of channels that never change. That looks like a
    # successful build and produces a student standing perfectly still
    # while insisting they are walking. Put the clip on this character's
    # namespace before anything else touches it.
    retarget_action(action, char_ns)

    # Then insist, because a clip that cannot bind is worse than a failed
    # build: nothing downstream can tell a stiff animation from no
    # animation, and it ships looking fine.
    targets = set()
    for fc in action.fcurves:
        m = re.match(r'pose\.bones\["([^"]+)"\]', fc.data_path)
        if m:
            targets.add(m.group(1))
    unknown = targets - {b.name for b in rig.data.bones}
    if unknown:
        print(f"[mixamo] {action.name}: {len(unknown)} of {len(targets)} bones are still "
              f"not on the character after retargeting — e.g. {sorted(unknown)[:4]}")
        print("[mixamo] it would export as a full set of motionless channels, so stopping")
        sys.exit(3)

    # drop the donor skeleton and mesh; the action survives on its own
    for o in added:
        bpy.data.objects.remove(o, do_unlink=True)

if not clips:
    print("[mixamo] nothing to export — no animation found in any file")
    sys.exit(1)

# leave the character on its first clip so the GLB has a sensible pose
if not rig.animation_data:
    rig.animation_data_create()
rig.animation_data.action = clips[0]

os.makedirs(os.path.dirname(os.path.abspath(dst)) or ".", exist_ok=True)
export = dict(filepath=dst, export_format="GLB", export_yup=True,
              export_animations=True, export_animation_mode="ACTIONS",
              export_skins=True, export_morph=False,
              export_apply=False)         # never apply modifiers to a rigged mesh
try:
    bpy.ops.export_scene.gltf(**export)
except TypeError:
    # older exporters take a smaller set of keywords
    for k in ("export_animation_mode", "export_morph", "export_apply"):
        export.pop(k, None)
    bpy.ops.export_scene.gltf(**export)

print(f"[mixamo] {os.path.basename(dst)}: {len(meshes)} mesh(es), {bones} bones, "
      f"{len(clips)} clip(s), {os.path.getsize(dst) / 1e6:.1f}MB")
for a in clips:
    lo, hi = a.frame_range
    print(f"[mixamo]   {a.name:<24} {(hi - lo) / 24.0:.2f}s")
print("[mixamo] textures are embedded raw — shrink it before committing:")
print(f"[mixamo]   gltf-transform optimize {dst} {dst} "
      f"--compress meshopt --texture-compress webp --texture-size 1024")
print("[mixamo] then bump VERSION in sw.js, since assets/ changed.")
