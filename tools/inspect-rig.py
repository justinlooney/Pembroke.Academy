"""
Pembroke Academy — say what is actually inside a character file.

    blender --background --python tools/inspect-rig.py -- model.fbx [more...]

The question this exists to answer is "can this person be given that
movement", and the answer is never in the file name. It is in the bone
names: a clip is a set of curves addressed by bone, so it lands on any
skeleton that has those bones and lands nowhere at all on one that does
not. Mixamo rigs name the left thigh mixamorig:LeftUpLeg; a Character
Creator export calls it CC_Base_L_Thigh; a Daz figure calls it lThigh.
Same anatomy, three vocabularies, and a clip written in one of them
applied to another produces a valid file containing a person standing
perfectly still — which is exactly the failure this project has already
shipped once and had to diagnose in a browser.

So: print the skeleton, the clips, and what the clips address. Cheap to
run, and it turns a guess into a fact before any pipeline is written
around it.
"""
import bpy
import os
import re
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if not argv:
    print(__doc__)
    sys.exit(1)

BONE_ALIASES = [
    ("mixamo",  re.compile(r"^mixamorig\d*:", re.I)),
    ("cc",      re.compile(r"^CC_Base_", re.I)),
    ("daz",     re.compile(r"^(lThigh|rThigh|abdomen|hip)$", re.I)),
    ("rigify",  re.compile(r"^(DEF-|ORG-|MCH-)", re.I)),
    ("vrm",     re.compile(r"^(J_Bip_|Bip01)", re.I)),
]


def flavour(names):
    """Which naming convention this skeleton is written in — the thing
    that decides whether a clip from elsewhere can address it."""
    for label, rx in BONE_ALIASES:
        if sum(1 for n in names if rx.match(n)) >= 3:
            return label
    return "unknown"


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
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


for path in argv:
    print("\n" + "=" * 68)
    print(path, "%.1fMB" % (os.path.getsize(path) / 1e6))
    print("=" * 68)
    try:
        load(path)
    except Exception as e:                                  # noqa: BLE001
        print("  IMPORT FAILED:", e)
        continue

    rigs = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    tris = 0
    for m in meshes:
        try:
            tris += sum(max(len(p.vertices) - 2, 0) for p in m.data.polygons)
        except Exception:                                   # noqa: BLE001
            pass
    mats = sorted({ms.material.name for m in meshes for ms in m.material_slots
                   if ms.material})
    print("  meshes   %d  (%d triangles)" % (len(meshes), tris))
    print("  materials %d: %s" % (len(mats), ", ".join(mats[:24])))
    print("  images   %d: %s" % (len(bpy.data.images),
                                 ", ".join(sorted(i.name for i in bpy.data.images)[:12])))

    if not rigs:
        print("  NO ARMATURE — this is scenery, not a character. Nothing to")
        print("  animate and nothing an animation could be applied to.")
    for rig in rigs:
        names = [b.name for b in rig.data.bones]
        print("  armature '%s': %d bones, naming = %s"
              % (rig.name, len(names), flavour(names)))
        print("    first 12:", ", ".join(names[:12]))
        legs = [n for n in names if re.search(r"thigh|upleg|upperleg", n, re.I)]
        print("    thigh-ish:", ", ".join(legs[:6]) or "(none found)")

    print("  actions  %d" % len(bpy.data.actions))
    for a in bpy.data.actions:
        addressed = set()
        for fc in a.fcurves:
            m = re.match(r'pose\.bones\["([^"]+)"\]', fc.data_path)
            if m:
                addressed.add(m.group(1))
        span = a.frame_range
        moving = 0
        for fc in a.fcurves:
            vals = [kp.co[1] for kp in fc.keyframe_points]
            if vals and (max(vals) - min(vals)) > 1e-4:
                moving += 1
        print("    '%s'  frames %d-%d  %d curves (%d actually move)  %d bones  naming = %s"
              % (a.name, span[0], span[1], len(a.fcurves), moving,
                 len(addressed), flavour(sorted(addressed))))
        if rigs:
            have = {b.name for b in rigs[0].data.bones}
            hit = len(addressed & have)
            print("      lands on this file's own skeleton: %d/%d bones"
                  % (hit, len(addressed)))
print("\ndone")
