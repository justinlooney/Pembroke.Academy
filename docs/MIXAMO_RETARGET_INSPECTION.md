# Mixamo Retarget Inspection — StudentProductionRigV4 (PhotoHero)

Inspected before anything was changed, per the pipeline brief. Every
number below was measured on the delivered files, and the load-bearing
claims were verified by rendering the result and looking at it —
because this repository has now three times had a retarget pass every
measurement and fail the eye.

Files inspected:

    student_photohero_web.glb        5.40MB · 300,000 tris · 183,934 verts
    student_photohero_web_ktx2.glb  16.52MB · same geometry · KTX2/UASTC

The Blender master and the uncompressed exports live on the author's
machine and were not touched. Everything here operates on a derivative
copy: `assets/stu_hero.glb`.

## CHARACTER SKELETON

24 joints under an armature node named `StudentProductionRigV4`, one
skinned mesh primitive, one PBR material, JOINTS_0/WEIGHTS_0 present,
inverse bind matrices present.

    Root (ground level)
      Pelvis
        Spine → Spine1 → Spine2 → Chest
          Neck → Head
          L/R Clavicle → UpperArm → ForeArm → Hand
        L/R Thigh → Shin → Foot → Toe

Bones extend along local +Y with orientation carried on node rotations
(a Blender-style rig). Scales are 1 throughout. `Root` sits at the
ground and carries no skinning weight of consequence; `Pelvis` is the
hips.

**Rest pose = bind pose: 0.0° on all 14 clip-driven bones.** This is
the property that makes everything else work, and the one most of the
found cast lacks (walker: 90° on every bone; sophia: median 25°).
Whatever exported this did it right. Keep doing it.

## MIXAMO SKELETON (donor side)

Standard `mixamorig:` hierarchy, 69 joints including fingers, eyes and
end bones. The proven donor in this repo (`assets/clip_sit.glb`) is a
skinless 54KB GLB: skeleton + rest + motion only.

## NAME MAPPING

Deterministic, via the campus's canonical bone vocabulary
(`canonBone` in index.html — now four dialects plus this rig):

    Mixamo              StudentProductionRigV4
    Hips                Pelvis
    Spine/1/2           Spine/Spine1/Spine2      (Chest: unmapped, holds rest)
    Neck / Head         Neck / Head
    L/R Shoulder        L/R Clavicle
    L/R Arm             L/R UpperArm
    L/R ForeArm         L/R ForeArm
    L/R Hand            L/R Hand
    L/R UpLeg           L/R Thigh
    L/R Leg             L/R Shin
    L/R Foot            L/R Foot
    L/R ToeBase         L/R Toe

22 of the donor's 69 tracks bind; the 47 unbound are fingers, eyes and
end bones — this rig has none, which is correct for its budget, and a
sit/walk/idle does not need them. Measured, not assumed.

## THE ONE REAL DEFECT FOUND: mirrored side labels

In the delivered GLBs the bone named **LeftFoot sits at x = −0.125**
with toes pointing +Z. Every other rig on this campus (and the glTF /
Mixamo convention) puts the character's Left at **+X** when facing +Z.
The names are anatomically mirrored.

Consequence, rendered: motion transfers spatially, so the donor's +X
arm drove the bone at −X, and the first retarget attempt produced a
figure sitting correctly from the waist down **with both arms
overhead** — the same failure signature as nadia. Swapping the sides
fixed it completely.

Resolution: the campus copy (`assets/stu_hero.glb`) has Left↔Right
node names swapped — 16 nodes, JSON chunk only, geometry and skin
untouched, master untouched. **Recommended upstream fix:** correct the
side naming in the Blender master so future exports match convention;
until then, re-run the same swap on any fresh export.

## REST-POSE DIFFERENCES

Character rests in a T-pose; the donor rests in its Mixamo bind pose.
Irrelevant by construction: the retarget carries each bone's *change
from its own rest, in world space*, re-applied to the receiver's rest
— so agreeing rest poses are not required, only that each file's rest
equals its own bind pose. Both do (0°).

## AXIS DIFFERENCES

Local bone axes differ per limb (the rig carries orientation in node
rotations). Also irrelevant by construction: deltas are composed in
world space and converted back to each receiver bone's local frame.
No Euler values are ever copied.

## SCALE DIFFERENCES

Donor hips rest at local y≈209 (cm-ish); hero at 0.946 (metres).
Handled: the pelvis drop is read as a fraction of the donor's own
standing hip height and applied to the receiver's, along whatever the
receiver's hips call "down".

## ROOT MOTION

All campus motion is in-place by policy: the campus drives position and
paces playback from actual travel speed, so donors must be exported
with Mixamo's **In Place** ticked. The hero rig's `Root` bone stays at
rest; the retarget writes only the `Pelvis` position (vertical, scaled)
plus rotations. If a separate project needs root motion later, `Root`
is the natural carrier — the campus does not use it.

## RETARGET STRATEGY

**Runtime lending, not offline Blender baking.** The campus already
ships `lendClip`: world-space delta retarget, sampled at 30fps into
QuaternionKeyframeTracks per body, validated by a structural check and
by renders. Verified on this rig end to end:

    sit-down donor → StudentProductionRigV4
    22 tracks bound · arms/elbows natural · feet planted
    hips 1.00 → 0.32 of standing height, seated

This replaces the proposed `retarget_mixamo.py` Blender pipeline for
campus purposes: animation-only donor GLBs are ~50KB each, are shared
by the whole cast (all four dialects), and no 5.4MB of geometry is
ever duplicated per animation — which is the brief's preferred
architecture B.

The Blender that exists in this project runs on CI, not locally. The
FBX→donor conversion is therefore a courier job: a
`# out: assets/clip_<name>.glb` block in `tools/mixamo-inbox.txt`
builds the FBX in CI and strips meshes/materials/textures, leaving
skeleton + motion.

## RISKS

- **KTX2 variant is unusable on this campus today.** The vendored
  three.js has no KTX2Loader/basis transcoder (25 files, none match).
  `KHR_texture_basisu` is in `extensionsRequired`, so the file refuses
  to load rather than degrading. Use the 5.4MB JPEG/PNG build; vendor
  KTX2 support later if GPU memory becomes the constraint.
- **Weight.** 5.4MB makes this the heaviest body on campus (next:
  nadia 4.2MB, cheapest 0.24MB). Fine as a unique named character;
  must not enter the crowd-repeat pool — and structurally cannot,
  since it is not dressable.
- **Not dressable.** One mesh, one material: the wardrobe cannot tint
  garments independently, so a second copy is the same student twice.
  For future characters: separate materials (or at least separate
  primitives) named shirt/shorts/sneakers/hair/body make the whole
  wardrobe work.
- **No clips of its own.** Until at least a walk donor lands, the body
  must not join ROAMING — a roamer with no gait glides like a statue.
- **Hair is rigid to the head bone** (no hair chain). Visible as a
  solid mass in fast head motion; acceptable at campus distance.

## IMPLEMENTATION PLAN (state: mostly done, verified)

1. ~~Side-label swap on the campus copy~~ — done, 16 nodes.
2. ~~`canonBone` vocabulary for the rig~~ — done, in index.html and
   `tools/check-character.mjs` (collision-checked against isla's bare
   Mixamo-style names: this rig's words are unique to it).
3. ~~Prove the retarget with the sit donor, by render~~ — done, above.
4. Courier `clip_` mode — done: any `# out: assets/clip_*.glb` block
   in `tools/mixamo-inbox.txt` becomes a skinless animation donor.
5. **Waiting on Mixamo downloads** (with skin, In Place, FBX): at
   minimum Idle, Walking; ideally Running, a talk gesture. One block
   per clip.
6. When a walk donor exists: add `hero` to `CAST_FILES`/`ROAMING` with
   a `looks: "f"` entry, lend gait+idle+sit at load like everyone
   else, bump the service-worker version, and judge her on the quad —
   fps first, at 300k triangles.

## VALIDATION LEDGER

| check                                   | result |
|-----------------------------------------|--------|
| 300,000 triangles preserved             | yes — JSON-chunk rename only, BIN untouched |
| 183,934 vertices, 1 primitive, 1 material | yes |
| 24 bones, hierarchy unchanged            | yes — names re-sided on 16, no reparenting |
| skin/IBM intact                          | yes — joints reference by index, not name |
| rest = bind, all 14 clip-driven bones    | 0.0° |
| sit-down retarget                        | bound 22/69; hips 1.00→0.32; feet planted; arms natural (rendered) |
| KTX2 build loads here                    | **no** — loader not vendored |
| campus load (`check-character`)          | loads and draws · can be lent clips |
