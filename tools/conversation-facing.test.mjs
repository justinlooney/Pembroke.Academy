import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as T from "../assets/vendor/three/build/three.module.js";
import { conversationFacing, conversationBodyQuaternion, faceConversationCamera } from "../assets/app/conversation-facing.mjs";

function rig(mirrored = false){
  const root = new T.Group(), torso = new T.Bone(), bones = [torso];
  root.add(torso);
  const head = new T.Bone(); head.name = "head";
  head.position.y = 3; torso.add(head); bones.push(head);
  for (const [side, x] of [["left", 1], ["right", -1]]){
    const arm = new T.Bone(); arm.name = side + "arm";
    arm.position.set(x * (mirrored ? -1 : 1), 2, 0); torso.add(arm); bones.push(arm);
    const foot = new T.Bone(); foot.name = side + "foot";
    foot.position.set(x * (mirrored ? -1 : 1), 0, 0); root.add(foot); bones.push(foot);
    const toe = new T.Bone(); toe.name = side + "toebase";
    toe.position.z = 1; foot.add(toe); bones.push(toe);
  }
  root.updateMatrixWorld(true);
  const mesh = new T.SkinnedMesh(); mesh.bind(new T.Skeleton(bones)); root.add(mesh);
  return { root, torso, head, bones };
}
function error(root, torso, camera){
  // Ground-truth forward is local +Z in this synthetic anatomy, independent
  // of the labels and the landmarks used by the implementation.
  root.updateMatrixWorld(true);
  const front = new T.Vector3(0, 0, 1).applyQuaternion(torso.getWorldQuaternion(new T.Quaternion()));
  const target = camera.position.clone().sub(torso.getWorldPosition(new T.Vector3()));
  front.y = target.y = 0;
  return front.angleTo(target);
}

for (const mirrored of [false, true]) test(`faces the lens with ${mirrored ? "reversed" : "normal"} bone labels`, () => {
  const { root, torso, bones } = rig(mirrored);
  // Both animated feet point sideways: they cannot supply the heading.
  for (const bone of bones) if (/foot$/.test(bone.name)) bone.rotation.y = Math.PI / 2;
  torso.rotation.y = -1.1; root.rotation.y = 2.8;
  const camera = new T.PerspectiveCamera(); camera.position.set(3, 2, 70);
  const facing = conversationFacing(root, s => s);
  assert.equal(facing.calibrated, true);
  const before = bones.map(b => b.quaternion.clone());
  faceConversationCamera(root, facing, camera);
  assert.ok(error(root, torso, camera) < 1e-6);
  bones.forEach((b, i) => assert.ok(b.quaternion.angleTo(before[i]) < 1e-7, "never twist a joint to turn the body"));
});

test("tracks an animated torso and moving camera at different frame rates", () => {
  for (const fps of [10, 30, 60]){
    const { root, torso } = rig(), camera = new T.PerspectiveCamera();
    camera.position.set(0, 2, 70);
    const facing = conversationFacing(root, s => s);
    for (let i = 0; i < fps * 12; i++){
      const t = i / fps;
      torso.rotation.y = Math.sin(t) * .4;
      camera.position.x = Math.sin(t * .42) * .35;
      faceConversationCamera(root, facing, camera, 1 / fps);
      assert.ok(error(root, torso, camera) < .04, `${fps}fps at ${t}s`);
    }
  }
});

test("takes the short turn across the angle boundary", () => {
  const { root } = rig(), camera = new T.PerspectiveCamera();
  root.rotation.y = Math.PI - .02; camera.position.set(-.2, 2, -10);
  const before = root.rotation.y;
  faceConversationCamera(root, conversationFacing(root, s => s), camera, 1 / 60);
  assert.ok(root.rotation.y > before && root.rotation.y - before < .01);
});

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("const LOOK_FREE_YAW ="), end = html.indexOf("function convoOpen(s){", start);
assert.ok(start > 0 && end > start, "locate the production gaze correction");
test("a sideways talking clip uses bind gaze relative to the chest, with natural head drift", () => {
  for (const mirrored of [false, true]){
    const { root, torso, head } = rig(mirrored);
    const facing = conversationFacing(root, s => s);
    assert.ok(facing.headNeutral);
    const gaze = new Function("THREE", "boneKey", "convoFacing", "conversationBodyQuaternion",
      html.slice(start, end) + "return {headNeutral, lookAtViewer};")(T, s => s, facing, conversationBodyQuaternion);
    // The body has already turned in a native clip; the head has a further
    // persistent sideways look. A median of that clip would preserve it.
    torso.rotation.y = -.8; head.rotation.set(.1, .9, .06);
    const look = gaze.headNeutral(root), camera = new T.PerspectiveCamera(); camera.position.set(0, 2, 70);
    gaze.lookAtViewer(root, look);
    faceConversationCamera(root, facing, camera);
    const forward = new T.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new T.Quaternion()));
    const yaw = Math.abs(Math.atan2(forward.x, forward.z));
    assert.ok(yaw < .24, `head yaw is ${(yaw * 180 / Math.PI).toFixed(2)}°`);
    assert.ok(yaw > .03, "retain a small head movement instead of pinning the gaze");
    assert.equal(torso.rotation.y, -.8, "gaze correction leaves the torso animation intact");
  }
});

test("missing or degenerate landmarks leave a finite pose alone", () => {
  const empty = new T.Group(), camera = new T.PerspectiveCamera(); camera.position.z = 10;
  assert.equal(conversationFacing(empty, s => s), null);
  faceConversationCamera(empty, null, camera);
  const { root } = rig(), facing = conversationFacing(root, s => s);
  facing.left.position.copy(facing.right.position);
  root.rotation.y = .7;
  faceConversationCamera(root, facing, camera);
  assert.equal(root.rotation.y, .7);
});
