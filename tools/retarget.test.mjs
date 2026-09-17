import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "../assets/vendor/three/build/three.module.js";

// Execute the campus's actual retargeter without booting or rendering the campus.
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("const RP_BONE = {");
const end = html.indexOf("/* ── what can this body do?", start);
assert.ok(start > 0 && end > start, "locate the production retargeter");
const { lendClip, canonBone } = new Function("THREE", `
  const RIGREST = false, RIGTRACE = "", RIGTRACE_FRAME = 0;
  ${html.slice(start, end)}
  return { lendClip, canonBone };
`)(THREE);

function rig({ receiver = false, mirrored = false, reverseSpine = false, armsDown = false } = {}){
  const root = new THREE.Group(), bones = {};
  const add = (key, name, parent, position) => {
    const bone = new THREE.Bone(); bone.name = name;
    bone.position.fromArray(position); parent.add(bone); bones[key] = bone;
    return bone;
  };
  const hips = add("hips", receiver ? "Pelvis" : "Hips", root, [0, 1, 0]);
  let spine = hips;
  for (const [key, name] of reverseSpine ? [["spine2", "Spine2"], ["spine1", "Spine1"], ["spine", "Spine"]]
    : [["spine", "Spine"], ["spine1", "Spine1"], ["spine2", "Spine2"]]){
    spine = add(key, name, spine, [0, .12, 0]);
  }
  const chest = receiver ? add("chest", "Chest", spine, [0, .15, 0]) : spine;
  if (receiver) chest.rotation.set(.1, -.08, .05);
  for (const side of ["Left", "Right"]){
    const key = side.toLowerCase(), sign = (side === "Left" ? 1 : -1) * (mirrored ? -1 : 1);
    add(key + "foot", side + "Foot", hips, [sign * .15, -.95, 0]);
    const shoulder = add(key + "shoulder", side + (receiver ? "Clavicle" : "Shoulder"), chest, [sign * .12, .1, 0]);
    if (receiver) shoulder.rotation.set(.07, sign * .13, sign * -.09);
    const arm = add(key + "arm", side + (receiver ? "UpperArm" : "Arm"), shoulder, [sign * .15, 0, 0]);
    if (armsDown) arm.rotation.z = -sign * Math.PI / 2;
    const forearm = add(key + "forearm", side + "ForeArm", arm, [sign * .3, 0, 0]);
    add(key + "hand", side + "Hand", forearm, [sign * .25, 0, 0]);
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}

function motion(bones){
  const rotations = { spine: [.15, .25, -.08], spine1: [-.1, .12, .05], spine2: [.08, -.15, .1], leftshoulder: [.3, -.15, .65],
    rightshoulder: [-.2, .1, -.55], leftarm: [.1, .3, -1.1], rightarm: [-.1, -.25, 1],
    leftforearm: [0, .45, -.1], rightforearm: [0, -.5, .15] };
  const tracks = Object.entries(rotations).map(([key, angles]) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles));
    return new THREE.QuaternionKeyframeTrack(bones[key].name + ".quaternion", [0, .5, 1],
      [...bones[key].quaternion.toArray(), ...q.toArray(), ...bones[key].quaternion.toArray()]);
  });
  return new THREE.AnimationClip("gesture", 1, tracks);
}

for (const mirrored of [false, true]) for (const reverseSpine of [false, true]) for (const armsDown of [false, true]){
  test(`arms follow the motion (mirrored=${mirrored}, reverseSpine=${reverseSpine}, armsDown=${armsDown})`, () => {
    const donor = rig(), target = rig({ receiver: true, mirrored, reverseSpine, armsDown });
    const clip = motion(donor.bones);
    const shoulders = ["leftshoulder", "rightshoulder"].map(key => [target.bones[key], target.bones[key].quaternion.clone()]);
    const hands = ["lefthand", "righthand"].map(key => [target.bones[key], target.bones[key].quaternion.clone()]);
    const lent = lendClip(clip, target.root, donor.root, "gesture", 30, false);
    assert.ok(lent);
    assert.equal(lent.tracks.some(track => /shoulder$/.test(canonBone(track.name.split(".")[0]))), false);
    const sourceMixer = new THREE.AnimationMixer(donor.root), targetMixer = new THREE.AnimationMixer(target.root);
    sourceMixer.clipAction(clip).play(); targetMixer.clipAction(lent).play();
    for (const t of [.1, .3, .5, .7, .9]){
      sourceMixer.setTime(t); targetMixer.setTime(t);
      donor.root.updateMatrixWorld(true); target.root.updateMatrixWorld(true);
      for (const [bone, rest] of shoulders) assert.ok(bone.quaternion.angleTo(rest) < 1e-7, "clavicle keeps its local rest");
      for (const [bone, rest] of hands) assert.ok(bone.quaternion.angleTo(rest) < 1e-5, "an unanimated wrist keeps its rest angle");
      for (const key of ["leftarm", "rightarm", "leftforearm", "rightforearm"]){
        const sourceKey = !mirrored ? key : key.startsWith("left") ? "right" + key.slice(4) : "left" + key.slice(5);
        const direction = (bones, key) => {
          const child = key.includes("forearm") ? key.replace("forearm", "hand") : key.replace("arm", "forearm");
          return bones[child].getWorldPosition(new THREE.Vector3()).sub(bones[key].getWorldPosition(new THREE.Vector3())).normalize();
        };
        const error = direction(donor.bones, sourceKey).angleTo(direction(target.bones, key));
        assert.ok(error < 1e-5, `${key} at ${t}s: ${(error * 180 / Math.PI).toFixed(2)}° from intended world pose`);
      }
    }
    sourceMixer.stopAllAction(); targetMixer.stopAllAction();
  });
}

test("lending preserves the donor's rest and produces repeatable clips", () => {
  const donor = rig(), target = rig({ receiver: true }), clip = motion(donor.bones);
  const before = Object.values(donor.bones).map(b => [...b.position.toArray(), ...b.quaternion.toArray()]);
  const first = lendClip(clip, target.root, donor.root, "first", 30, false);
  const second = lendClip(clip, target.root, donor.root, "second", 30, false);
  assert.deepEqual(Object.values(donor.bones).map(b => [...b.position.toArray(), ...b.quaternion.toArray()]), before);
  assert.deepEqual(second.tracks.map(t => [...t.values]), first.tracks.map(t => [...t.values]));
});

test("a rig missing an elbow and wrist keeps its own animations", () => {
  const donor = rig(), target = rig({ receiver: true, armsDown: true });
  target.bones.rightarm.remove(target.bones.rightforearm);
  assert.equal(lendClip(motion(donor.bones), target.root, donor.root, "unsupported"), null);
});
