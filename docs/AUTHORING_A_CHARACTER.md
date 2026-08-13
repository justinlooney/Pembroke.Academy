# Authoring a character for this campus

You said you are going to make more `.glb` characters like the
PhotoHero, and that you would rather be told what to fix than repeat a
mistake. This is that list. It is written from what the campus actually
does with a body at load time, and every claim in it was measured on
the eleven characters already here — six that work, and several that
took a render and a second look to find out why they didn't.

Before you read any of it, the one-line version:

    node tools/check-character.mjs assets/your_file.glb

That prints everything below as a verdict on your file, in about four
seconds, and it is the same code the campus uses to decide what a body
can do. Run it before you send anything. What follows is why each line
of that output matters.

---

## 1. Sides. Left goes on +X.

**This is the one that bit the PhotoHero.**

Face the character down +Z. Their left hand should be at **positive X**.
In the delivered file, `LeftFoot` sits at x = −0.124 — the bone called
Left is on the character's right. Every bone is mirror-labelled.

Why it matters more than it sounds: animation is borrowed here, not
authored per character. A sit-down clip made for one skeleton is
retargeted onto all of them, and the transfer works **spatially** — the
donor's left arm drives whatever the receiver calls its left arm. Get
the label backwards and the donor's left arm drives the right one. The
first attempt at seating your hero produced a figure sitting down
correctly from the waist down **with both arms straight over its head**.

The campus now detects this from the geometry and compensates, so your
file works as delivered and I have not modified it. But fix it in the
Blender master anyway: Mixamo, Unity, Unreal, Blender's own Rigify and
every mirror-modifier workflow will all assume the convention, and each
of them will be wrong about your character in a different way.

In Blender: select the armature in Edit Mode, and if the names are
simply swapped, `Armature ▸ Names ▸ Flip Names` on the mirrored half is
usually the whole fix. Verify by clicking the bone named `LeftHand` and
reading its X in the N-panel — positive, with the character facing +Z.

## 2. Rest pose must equal bind pose. Yours does. Keep doing it.

Your rig rests at **0.0° from bind on all 14 clip-driven bones**. That
is the single best thing about this file and it is why the retarget
worked at all.

For contrast, from bodies already on the campus:

| body   | rest vs bind, median |
|--------|----------------------|
| hero   | **0°** |
| sophia | 25° |
| walker | 90° on every one of fourteen bones |

The walker sits down beautifully and **cannot lend his idle to anyone**
— every attempt renders the receiver hunched or bent backwards, because
his rest is not a neutral pose and the difference travels with the
motion. A character whose rest ≠ bind is a character other characters
can't learn from.

Practically: pose the armature in a plain T- or A-pose, `Pose ▸ Apply ▸
Apply Pose as Rest Pose`, re-bind, and export from that. Don't leave a
posed layer live at export time.

## 3. Separate materials, or the wardrobe can't dress them.

Current report for your hero:

    wardrobe can tint: NOTHING
    1 mesh(es) · 1 material

The campus tints a student's shirt, shorts, sneakers, hair and skin at
runtime — that is how eleven bodies fill a quad of twenty-something
students without anyone looking like a clone. With one mesh and one
material there is nothing to tint independently, so a second copy of
your hero is **literally the same student twice**, which is exactly the
twinning you told me you don't want. It is the reason she can be a
named character but can't join the repeat crowd.

The fix is naming, not geometry. Split into separate materials (or at
minimum separate primitives) and name them so the classifier finds them.
It matches on the mesh name **and** the material name, case-insensitive:

| slot     | any of these words in the name |
|----------|--------------------------------|
| hair     | hair, beard, moustache, scalp, brow, eyelash |
| shirt    | shirt, top, jacket, suit, hoodie, sweater |
| shorts   | short, pant, trouser, jean, bottom, denim |
| sneakers | shoe, sneaker, boot, footwear, canvas |
| skin     | body, skin, head |

So a material called `shirt_cotton` works; one called `Material.001`
does not. Five slots found is full marks — check the `wardrobe can
tint:` line.

## 4. Weight. Aim under 2MB.

    hero    5.4MB · 300,000 triangles   ← heaviest body on campus
    nadia   4.2MB
    cheapest 0.24MB

The whole download budget for the campus is 15–25MB, and that has to
cover twelve courses, the buildings, the trees and everybody. One
5.4MB body is a fifth of it. She is worth it as a unique named
character; she could not be one of eight roamers.

Two things to know before you optimise:

- **I have not run `gltf-transform optimize` on her**, per your
  instruction, and won't without you asking. You reported a previous
  pass taking 300k triangles to ~221k.
- **Do not ship the KTX2 build to this campus.** The vendored three.js
  has no KTX2Loader or basis transcoder (25 vendored files, none
  match), and `KHR_texture_basisu` is in `extensionsRequired`, so the
  file refuses to load outright rather than falling back. The 5.4MB
  JPEG/PNG build is the one that works. If GPU memory ever becomes the
  binding constraint rather than download size, the answer is to vendor
  the transcoder, not to swap the file.

Most of the 5.4MB is texture, not mesh. Halving the texture resolution
is usually invisible at campus distance and costs nothing structurally.

## 5. Export the skeleton the campus can read.

Your rig speaks a dialect of its own — `Pelvis`, `Thigh`, `Shin`,
`Clavicle`, `UpperArm`, `Toe`, `Chest` — and I have taught `canonBone`
to read it, so you do not need to rename anything. It now understands
five dialects: Mixamo, Mixamo-with-suffix, stripped, Character Creator,
and yours.

What actually has to be present is these fourteen, under any of those
names:

    hips · spine · neck · head
    left/right upleg · leg · foot
    left/right arm · forearm

24 bones is fine. Fingers, eyes and end bones are not needed — 22 of a
Mixamo donor's 69 tracks bind to your rig and the 47 that don't are all
fingers and eyes. That is the right trade for this budget.

If you invent a **sixth** dialect on the next character, the risk is not
that it fails loudly — it's that a word collides with an existing one
and a bone silently binds to the wrong thing. Reusing your own
`StudentProductionRig` names is free and safe. Do that.

## 6. Ship a walk with her, or she can't roam.

    no animation at all

A body with no gait can be a named character standing in one place, but
it can't join `ROAMING` — a roamer with no walk cycle glides across the
quad like a statue on rails. It's why your hero isn't cast yet.

The campus lends clips, so you don't have to author them: one Mixamo
download retargets onto every skeleton here. What it needs from you is
just that the rig can receive them, which it can — verified end to end,
sit-down donor onto `StudentProductionRigV4`, 22 tracks bound, arms and
elbows natural, feet planted, hips 1.00 → 0.32 of standing height.

If you do bring your own clips, one rule: **In Place**. The campus
drives position itself and paces playback from how fast the student is
really walking, so a clip that also carries forward travel double-counts
it and the figure moonwalks.

## 7. Smaller things worth knowing

- **Hair is rigid to the head bone.** No hair chain, so it moves as a
  solid mass in fast head turns. Acceptable at campus distance;
  mentioned so you know it's seen and not a bug.
- **Scales of 1 throughout, orientation on node rotations** — yours is
  clean here. Non-uniform bone scale is the classic way to make a
  retarget look almost right.
- **Units.** Your hips rest at 0.946 (metres); the Mixamo donor's at
  ~209 (cm). Handled — the pelvis drop is read as a fraction of the
  donor's own standing hip height — so you don't have to match anyone.
  Just be internally consistent.

---

## The checklist

Run `node tools/check-character.mjs assets/your_file.glb` and want to
see:

- [ ] `sides:` with **no** `← MIRRORED`
- [ ] `rest vs bind pose: median 0°`
- [ ] `wardrobe can tint: hair, shirt, shorts, sneakers, skin` (5/5)
- [ ] under 2MB
- [ ] all 14 core bones present, no missing list
- [ ] at least a walk and an idle, both In Place
- [ ] **not** the KTX2 build

Hit all seven and the body drops straight into `CAST_FILES` and
`ROAMING` and joins the crowd. Your hero currently hits two of them,
which is a good deal better than most of what has arrived here.
