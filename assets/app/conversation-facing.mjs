import { Vector3, Matrix4, Quaternion } from "../vendor/three/build/three.module.js";

const up = new Vector3(0, 1, 0);

// Use the upper arms' origins, not their rotations or the hands: gestures
// move the hands and a planted foot can point sideways during a chat.
export function conversationFacing(root, keyOf){
  const bones = new Map();
  root.traverse(o => { if (o.isBone && !bones.has(keyOf(o.name))) bones.set(keyOf(o.name), o); });
  const left = bones.get("leftarm") || bones.get("leftshoulder");
  const right = bones.get("rightarm") || bones.get("rightshoulder");
  if (!left || !right) return null;

  // Some exports reverse the Left/Right labels. Resolve that once from
  // the BIND pose, never from the outgoing walk or an animated foot.
  let sign = 1, calibrated = false, headNeutral = null;
  const head = bones.get("head");
  root.traverse(mesh => {
    if (calibrated || !mesh.isSkinnedMesh) return;
    const { bones: rig, boneInverses: inverses } = mesh.skeleton;
    const bind = bone => {
      const i = rig.indexOf(bone);
      return i < 0 ? null : new Vector3().setFromMatrixPosition(new Matrix4().copy(inverses[i]).invert());
    };
    const l = bind(left), r = bind(right);
    if (!l || !r) return;
    const across = l.sub(r), front = new Vector3(-across.z, 0, across.x).normalize();
    const feet = new Vector3();
    for (const side of ["left", "right"]){
      const foot = bones.get(side + "foot");
      let toe = bones.get(side + "toebase");
      if (!toe) foot?.traverse(o => {
        if (!toe && o !== foot && o.isBone && /toe|foot.?end/i.test(o.name)) toe = o;
      });
      const a = bind(foot), b = bind(toe);
      if (!a || !b) continue;
      b.sub(a); b.y = 0;
      if (b.lengthSq() > 1e-10) feet.add(b.normalize());
    }
    const agreement = front.dot(feet.normalize());
    if (Number.isFinite(agreement) && Math.abs(agreement) > 0.1){
      sign = Math.sign(agreement); calibrated = true;
      const h = rig.indexOf(head);
      if (h >= 0){
        const matrix = new Matrix4().copy(inverses[h]).invert();
        const rotation = new Quaternion();
        matrix.decompose(new Vector3(), rotation, new Vector3());
        const heading = Math.atan2(front.x * sign, front.z * sign);
        headNeutral = new Quaternion().setFromAxisAngle(up, -heading).multiply(rotation);
      }
    }
  });
  return { left, right, sign, calibrated, head, headNeutral };
}

const l = new Vector3(), r = new Vector3(), target = new Vector3();
// A head's neutral must follow the CHEST, not the holder: native talking
// clips can rotate the torso inside that holder by forty degrees.
export function conversationBodyQuaternion(facing, out){
  facing.left.getWorldPosition(l); facing.right.getWorldPosition(r);
  const x = l.x - r.x, z = l.z - r.z;
  if (Math.hypot(x, z) < 1e-6) return false;
  out.setFromAxisAngle(up, Math.atan2(-z * facing.sign, x * facing.sign));
  return true;
}

export function faceConversationCamera(root, facing, camera, dt = Infinity){
  if (!facing) return;
  root.updateWorldMatrix(true, true);
  facing.left.getWorldPosition(l); facing.right.getWorldPosition(r);
  camera.getWorldPosition(target).sub(l.clone().add(r).multiplyScalar(0.5));
  const acrossX = l.x - r.x, acrossZ = l.z - r.z;
  if (Math.hypot(acrossX, acrossZ) < 1e-6 || Math.hypot(target.x, target.z) < 1e-6) return;
  const heading = Math.atan2(-acrossZ * facing.sign, acrossX * facing.sign);
  const desired = Math.atan2(target.x, target.z);
  const delta = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
  if (!Number.isFinite(delta)) return;
  // The conversation scene is unrotated. Turn its holder around world Y;
  // leave every animated joint intact. Track gently after the opening cut.
  root.rotation.y += delta * (1 - Math.exp(-12 * Math.max(0, dt)));
  root.updateMatrixWorld(true);
}
