import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

// Read the slat beneath the centre, not the origin or the top of the backrest.
export function benchSeat(bench){
  bench.updateWorldMatrix(true, true);
  const origin = bench.localToWorld(new THREE.Vector3(0, 100, 0));
  const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0))
    .intersectObject(bench, true)[0];
  if (!hit) return null;
  return { x: hit.point.x + 500, y: hit.point.z + 500,
    top: hit.point.y, face: bench.rotation.y, taken: null };
}

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => (x = clamp(x), x * x * (3 - 2 * x));
const rigs = new WeakMap();

function hipsOf(g, key){
  let hips;
  g.traverse(o => { if (o.isBone && key(o.name) === "hips") hips = o; });
  return hips;
}

// Calibrate once on a disposable skeleton. Sampling the live mixer would disturb
// the walk that is fading out, and a fixed pelvis height cannot fit every body.
function seatRig(g, cycle, key){
  if (rigs.has(g)) return rigs.get(g);
  const anim = g.userData.anim, hips = hipsOf(g, key);
  const name = anim?.roles.seat || cycle.down;
  const clip = anim?.actions[name]?.getClip();
  if (!hips || !clip) return null;
  const probe = new THREE.Group();
  probe.add(clone(g.children[0]));
  const ph = hipsOf(probe, key), mixer = new THREE.AnimationMixer(probe.children[0]);
  const action = mixer.clipAction(clip).play();
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
  action.time = anim.roles.seat ? clip.duration / 2 : cycle.downRev ? 0 : clip.duration;
  mixer.update(0); probe.updateMatrixWorld(true);
  const hp = ph.getWorldPosition(new THREE.Vector3());
  const height = g.userData.height || 42, bottom = [], v = new THREE.Vector3();
  probe.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const ids = o.geometry.attributes.skinIndex, weights = o.geometry.attributes.skinWeight;
    if (!ids || !weights) return;
    const pelvis = new Set(o.skeleton.bones.flatMap((b, i) =>
      /^(hips|leftupleg|rightupleg)$/.test(key(b.name)) ? [i] : []));
    o.skeleton.update();
    for (let i = 0; i < ids.count; i++){
      let weight = 0;
      for (let j = 0; j < 4; j++)
        if (pelvis.has(ids.getComponent(i, j))) weight += weights.getComponent(i, j);
      if (weight < 0.5) continue;
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld);
      // Only the support under the pelvis; knees, coat hems and hanging skirts
      // must not be mistaken for the point that rests on the slat.
      if (Math.abs(v.x - hp.x) < height * 0.13 &&
          Math.abs(v.z - hp.z) < height * 0.07 &&
          v.y < hp.y && v.y > hp.y - height * 0.18) bottom.push(v.y);
    }
  });
  bottom.sort((a, b) => a - b);
  const depth = bottom.length ? hp.y - bottom[Math.floor(bottom.length * 0.02)] : height * 0.085;
  const seatedY = {};
  for (const [n, reverse] of [[cycle.down, cycle.downRev], [cycle.up, !cycle.upRev],
                              [anim.roles.seat, false]]){
    if (!n || seatedY[n] !== undefined) continue;
    mixer.stopAllAction();
    const c = anim.actions[n].getClip(), a = mixer.clipAction(c).reset().play();
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    a.time = n === anim.roles.seat ? c.duration / 2 : reverse ? 0 : c.duration;
    mixer.update(0); probe.updateMatrixWorld(true);
    seatedY[n] = ph.getWorldPosition(v).y;
  }
  mixer.stopAllAction(); mixer.uncacheRoot(probe.children[0]);
  const rig = { hips, depth, seatedY, point: new THREE.Vector3() };
  rigs.set(g, rig);
  return rig;
}

export function beginBenchSit(s, cycle, key){
  const rig = cycle && seatRig(s.g, cycle, key);
  if (!rig || !s.seat) return;
  s.g.updateWorldMatrix(true, true);
  const start = rig.hips.getWorldPosition(new THREE.Vector3());
  s.benchBinding = { rig, cycle, start };
}

// Called AFTER the mixer and breathing. Native clips and lent clips have different
// hip origins; correcting the evaluated pose also corrects their crossfade.
export function alignBenchSit(s){
  const binding = s.benchBinding, seat = s.seat;
  if (!binding || !seat || !["sitdown", "seated", "standup"].includes(s.mode)) return;
  const g = s.g, anim = g.userData.anim, { rig, cycle, start } = binding;
  const act = anim.actions[anim.current];
  if (!act) return;
  const progress = clamp(act.time / act.getClip().duration);
  const amount = s.mode === "seated" ? 1 : s.mode === "sitdown"
    ? smooth(cycle.downRev ? 1 - progress : progress)
    : smooth(cycle.upRev ? progress : 1 - progress);
  // Rebuild from the simulation position every frame; never accumulate offsets.
  g.position.set(s.pos[0] - 500, 0, s.pos[1] - 500);
  g.rotation.y = seat.face;
  g.updateWorldMatrix(true, true);
  rig.hips.getWorldPosition(rig.point);
  const from = s.mode === "standup" ? rig.point : start;
  const x = THREE.MathUtils.lerp(from.x, seat.x - 500, amount);
  const z = THREE.MathUtils.lerp(from.z, seat.y - 500, amount);
  g.position.x += x - rig.point.x;
  g.position.z += z - rig.point.z;
  // Preserve the clip's descent/rise. Pulling the live hips toward chair height
  // before the knees have bent would push both feet through the lawn.
  let reference = 0, weight = 0;
  for (const [name, y] of Object.entries(rig.seatedY)){
    const a = anim.actions[name], w = a.enabled ? a.getEffectiveWeight() : 0;
    reference += y * w; weight += w;
  }
  const support = s.mode === "seated" ? rig.point.y : weight ? reference / weight : rig.point.y;
  g.position.y += (seat.top + rig.depth - support) * amount;
  g.updateWorldMatrix(true, true);
}

export function endBenchSit(s){
  s.benchBinding = null;
  s.g.position.set(s.pos[0] - 500, 0, s.pos[1] - 500);
}

// A conversation borrows this figure and replaces its action with Talking.
// Put the seat pose back on close, including a held or reversed transition.
export function saveBenchPose(s){
  if (!s.benchBinding) return null;
  const anim = s.g.userData.anim;
  return { current: anim.current, held: s.held, actions: Object.entries(anim.actions)
    .filter(([, a]) => a.enabled && a.getEffectiveWeight() > 0)
    .map(([name, a]) => ({ name, time: a.time, paused: a.paused,
      weight: a.getEffectiveWeight(), rate: a.timeScale, loop: a.loop,
      repetitions: a.repetitions, clamp: a.clampWhenFinished })) };
}

export function restoreBenchPose(s, pose){
  if (!pose || !s.benchBinding) return;
  const anim = s.g.userData.anim;
  anim.mixer.stopAllAction();
  for (const p of pose.actions){
    const a = anim.actions[p.name];
    a.reset().setLoop(p.loop, p.repetitions).setEffectiveWeight(p.weight).play();
    a.time = p.time; a.timeScale = p.rate; a.paused = p.paused; a.clampWhenFinished = p.clamp;
    // An outgoing crossfade must still finish after the conversation.
    if (p.name !== pose.current) a.fadeOut(0.2);
    else a.setEffectiveWeight(1);
  }
  anim.current = pose.current; s.anim0 = pose.current; s.held = pose.held;
  anim.mixer.update(0);
}
