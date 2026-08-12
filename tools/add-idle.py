"""
Pembroke Academy — add a clip to a character that already exists.

    blender --background --python tools/add-idle.py -- \\
        out.glb  body.glb  clip.fbx  [ClipName]

The cohort arrived as finished models: eleven bodies, most of them
carrying a single walk cycle and nothing to do when they stop. This
lands a standing idle on the ones whose skeletons can take it.

WHICH ONES CAN

A clip is curves addressed by bone NAME. A Mixamo idle names
mixamorig:Spine; a Character Creator body calls the same bone
CC_Base_Spine01. Five of the eleven are Mixamo-named and will take it;
three are Character Creator and one is neither, and on those the clip
would address nothing whatsoever — exporting cleanly, reporting
success, and producing a person standing perfectly still while
insisting they are breathing.

So this REFUSES rather than shipping that. If the bones do not line up
it says which ones and exits non-zero. The bodies it turns away fall
back to the held-frame idle in index.html, which needs no clip and no
matching names at all.

Namespaces are rewritten first: Mixamo hands out mixamorig:, mixamorig2:
and mixamorig3: depending on the download, and the skeletons are
otherwise identical — so a clip from one will not bind to another
without this, and Blender bakes the rest pose instead.

Note the body must be MESHOPT-DECODED first. Every model in assets/ is
compressed that way and Blender's glTF importer cannot read it:

    gltf-transform copy assets/stu_gent.glb /tmp/gent.glb
"""
import bpy
import os
import re
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 3:
    print(__doc__)
    sys.exit(1)
dst, body_file, clip_file = argv[0], argv[1], argv[2]
clip_name = argv[3] if len(argv) > 3 else "Idle"
for f in (body_file, clip_file):
    if not os.path.isfile(f):
        print("[idle] not found:", f)
        sys.exit(1)

NS = re.compile(r"^(mixamorig\d*):")
bpy.ops.wm.read_factory_settings(use_empty=True)


def namespace_of(rig):
    for b in rig.data.bones:
        m = NS.match(b.name)
        if m:
            return m.group(1) + ":"
    return ""


# ── the body ─────────────────────────────────────────────────────────
bpy.ops.import_scene.gltf(filepath=body_file)
rigs = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
if not rigs:
    print("[idle] no armature in", body_file)
    sys.exit(1)
rig = rigs[0]
have = {b.name for b in rig.data.bones}
ns = namespace_of(rig)
kept = list(bpy.data.actions)
print("[idle] %s: %d bones, namespace %s, %d existing clip(s)"
      % (os.path.basename(body_file), len(have), ns or "(none)", len(kept)))

# Landing the same clip twice is not harmless. Blender does not refuse a
# duplicate name, it renames it — so a second run produces Idle.001, a
# third Idle.002, and the body carries three copies of one animation.
# That is exactly what happened here: three runs took stu_gent from
# 432KB to 584KB, roughly fifty kilobytes of the same standing loop each
# time, and the campus then picks whichever copy sorts first.
#
# The workflow fires on any push that touches this file or the workflow,
# so re-runs are normal and must be free. Landed already means done.
already = re.compile(re.escape(clip_name) + r"(\.\d+)?$")
if any(already.match(a.name) for a in kept):
    print("[idle] %s already carries '%s' — nothing to do"
          % (os.path.basename(body_file), clip_name))
    sys.exit(2)

# ── the clip ─────────────────────────────────────────────────────────
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.fbx(filepath=clip_file, ignore_leaf_bones=True,
                         automatic_bone_orientation=True)
added = [o for o in bpy.context.scene.objects if o not in before]
action = next((o.animation_data.action for o in added
               if o.type == "ARMATURE" and o.animation_data and o.animation_data.action), None)
if action is None:
    print("[idle]", os.path.basename(clip_file), "carries no animation")
    sys.exit(1)

"""Matched by SUFFIX, not by rebuilding a namespace.

The first version assumed the body carried a mixamorig*: prefix and
rewrote the clip's prefix to match. When the body's bones are named
plainly — which is what a glTF round trip through the courier leaves —
`ns` comes back empty, the rewrite strips the clip down to bare Hips
and LeftArm, and then nothing matches anything. Every body was refused,
including the five that should have taken the clip.

So read the naming that is actually there instead of assuming one.
Strip whatever prefix each side happens to carry and match on the bone
itself, which is the only part both conventions agree on. It handles
mixamorig:, mixamorig2:, no prefix at all, and an Armature| pathname,
and it still refuses CC_Base_L_Upperarm — because that genuinely is a
different bone name, not a different way of writing the same one."""
def stem(n):
    """Reduce a bone name to the part every convention agrees on.

    The names in these models are not what anyone wrote. A Mixamo FBX
    says "mixamorig2:LeftFoot"; after a trip through Blender and glTF
    the same bone in assets/ is called "mixamorigLeftFoot_064" — the
    colon dropped by name sanitising, and a numeric suffix added to keep
    it unique. Splitting on ":" alone matches neither, which is why a
    first attempt at suffix matching still refused every body on the
    campus.

    So: drop any pathname, drop a namespace with or without its colon,
    drop a trailing uniquifier. What is left is LeftFoot, from either
    side, and CC_Base_L_Foot stays itself — which is correct, because
    that really is a different bone name."""
    n = n.split("|")[-1].split(":")[-1]
    n = re.sub(r"^mixamorig\d*", "", n, flags=re.I)
    n = re.sub(r"[._]\d+$", "", n)
    return n.lower()


lookup = {}
for b in rig.data.bones:
    lookup.setdefault(stem(b.name), b.name)

moved = 0
for fc in action.fcurves:
    m = re.match(r'(pose\.bones\[")([^"]+)("\].*)', fc.data_path)
    if not m:
        continue
    head, bone, tail = m.groups()
    want = lookup.get(stem(bone))
    if want and want != bone:
        fc.data_path = head + want + tail
        moved += 1

targets = {m.group(1) for fc in action.fcurves
           for m in [re.match(r'pose\.bones\["([^"]+)"\]', fc.data_path)] if m}
unknown = targets - have
moving = sum(1 for fc in action.fcurves
             if len({round(kp.co[1], 5) for kp in fc.keyframe_points}) > 1)
print("[idle] clip: %d curves (%d move), %d bones, %d retargeted onto %s"
      % (len(action.fcurves), moving, len(targets), moved, ns or "(none)"))

if unknown:
    print("[idle] REFUSED: %d of %d bones do not exist on this body — e.g. %s"
          % (len(unknown), len(targets), sorted(unknown)[:4]))
    print("[idle] it would export as motionless channels and look like it worked.")
    print("[idle] this body keeps the held-frame idle instead.")
    sys.exit(3)
if moving == 0:
    print("[idle] REFUSED: nothing in this clip actually moves — it is a bind pose")
    sys.exit(3)

action.name = clip_name
action.use_fake_user = True
for o in added:
    bpy.data.objects.remove(o, do_unlink=True)

if not rig.animation_data:
    rig.animation_data_create()
rig.animation_data.action = action
for a in kept:
    a.use_fake_user = True

# ── out ──────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="SELECT")
os.makedirs(os.path.dirname(os.path.abspath(dst)) or ".", exist_ok=True)
export = dict(filepath=dst, export_format="GLB", export_yup=True,
              export_animations=True, export_animation_mode="ACTIONS",
              export_skins=True, export_apply=False)
try:
    bpy.ops.export_scene.gltf(**export)
except TypeError:
    for k in ("export_animation_mode", "export_apply"):
        export.pop(k, None)
    bpy.ops.export_scene.gltf(**export)
print("[idle] wrote %s — %d clip(s), %.2fMB"
      % (dst, len(kept) + 1, os.path.getsize(dst) / 1e6))
