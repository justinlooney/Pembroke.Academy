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
import math
import os
import re
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if not argv:
    print(__doc__)
    sys.exit(1)

# --render DIR also writes a front and side view of each file. Statistics
# answer "is it rigged"; only a picture answers "can it BE rigged", because
# automatic weights need the mesh and the skeleton's rest pose to roughly
# agree — and whether a character stands in a T-pose with its arms out or
# slouches with its hands in its pockets is not in any of the numbers.
RENDER = None
if "--render" in argv:
    i = argv.index("--render")
    RENDER = argv[i + 1]
    argv = argv[:i] + argv[i + 2:]
    os.makedirs(RENDER, exist_ok=True)

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
    if meshes:
        """Whether a figure stands with its arms out is the fact that
        decides whether automatic weights will hold, and it has a
        signature you can measure: a T-pose is nearly as wide as it is
        tall, arms at the sides is about a third. Worth printing,
        because the render needs someone to look at it and this does
        not — and because a scan exported Z-up arrives lying down,
        where a bounding-box fit would scale a skeleton to the figure's
        LENGTH and put it inside a horizontal person."""
        import mathutils
        lo = mathutils.Vector((1e30, 1e30, 1e30))
        hi = -lo
        for m in meshes:
            for c in m.bound_box:
                v = m.matrix_world @ mathutils.Vector(c)
                lo = mathutils.Vector(map(min, lo, v))
                hi = mathutils.Vector(map(max, hi, v))
        d = hi - lo
        tall = max(d.x, d.y, d.z)
        axis = "XYZ"[[d.x, d.y, d.z].index(tall)]
        wide = max(v for i, v in enumerate([d.x, d.y, d.z]) if "XYZ"[i] != axis)
        ratio = wide / max(tall, 1e-9)
        print("  extent   %.3f x %.3f x %.3f — longest along %s, span/length %.2f"
              % (d.x, d.y, d.z, axis, ratio))
        """The verdict is about THIS file alone. What actually decides
        whether automatic weights hold is the difference between the
        character's ratio and the donor skeleton's — a 0.46 character
        under a 0.96 donor has arm bones running horizontally through
        open air while the arms hang sixty degrees down, and the upper
        arms then bind to the chest. Two files that both say "A-pose"
        are a match; a 0.46 and a 0.96 are not, however reassuring
        either line reads on its own."""
        """Calibrated against real figures, not guessed. A Mixamo
        character measures 0.96. A scanned woman standing with her arms
        down beside her, hands at hip height, measures 0.46 — so 0.46
        is NOT the middle of the range, it is the bottom of it, and an
        earlier version of this that called 0.45 "an A-pose, usually
        fine" was wrong about the one file it was written for. Shoulder
        width and hair put a floor under the number well above zero."""
        print("  pose     " + (
            "a T-pose, arms straight out" if ratio > 0.80 else
            "an A-pose, arms roughly 45 degrees out" if ratio > 0.55 else
            "arms at the sides, hands near the hips" if ratio > 0.38 else
            "arms tight to the body, or not a humanoid"))
        print("  match    pair this only with a donor whose span/length is near %.2f. "
              "The gap between the two is what tears shoulders, not either number."
              % ratio)
        if axis != "Z":
            print("  NOTE     longest axis is %s, not Z. If this figure is lying down, a "
                  "bounding-box fit scales the skeleton to its LENGTH. Stand it up first."
                  % axis)
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

    if RENDER and meshes:
        """Cycles on the CPU, deliberately. EEVEE wants a GL context and a
        headless runner has none, so it either falls over or renders
        nothing — which would read as "the file is empty" rather than
        "the renderer is". Sixteen samples is plenty: this is a pose
        check, not a portrait."""
        import mathutils
        scn = bpy.context.scene
        scn.render.engine = "CYCLES"
        scn.cycles.samples = 16
        """Denoising off. Ubuntu's Blender is built without
        OpenImageDenoise, and Cycles turns denoising on by default, so
        every render dies with "Build without OpenImageDenoiser" — an
        error about the packager's build options that reads like an
        error about your model. Sixteen samples of a solid figure is
        grainy and perfectly good enough to see whether the arms are
        out, which is the only question being asked."""
        for attr, val in (("use_denoising", False),
                          ("use_preview_denoising", False)):
            try:
                setattr(scn.cycles, attr, val)
            except Exception:                               # noqa: BLE001
                pass
        try:
            scn.view_layers[0].cycles.denoising_store_passes = False
        except Exception:                                   # noqa: BLE001
            pass
        scn.render.resolution_x = scn.render.resolution_y = 640
        scn.render.film_transparent = False
        world = bpy.data.worlds.new("w")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[1].default_value = 1.5
        scn.world = world

        lo = mathutils.Vector((1e9, 1e9, 1e9)); hi = -lo
        for m in meshes:
            for c in m.bound_box:
                v = m.matrix_world @ mathutils.Vector(c)
                lo = mathutils.Vector(map(min, lo, v)); hi = mathutils.Vector(map(max, hi, v))
        ctr = (lo + hi) / 2
        span = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) or 1.0

        cam_d = bpy.data.cameras.new("c")
        cam = bpy.data.objects.new("c", cam_d)
        scn.collection.objects.link(cam)
        scn.camera = cam
        stem = os.path.splitext(os.path.basename(path))[0]
        for label, ang in (("front", 0.0), ("side", 1.5708)):
            r = span * 2.1
            cam.location = (ctr.x + r * math.sin(ang), ctr.y - r * math.cos(ang), ctr.z)
            direction = ctr - cam.location
            cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
            scn.render.filepath = os.path.join(RENDER, f"{stem}-{label}.png")
            try:
                bpy.ops.render.render(write_still=True)
                print("    rendered", scn.render.filepath)
            except Exception as e:                          # noqa: BLE001
                print("    render failed:", e)
print("\ndone")
