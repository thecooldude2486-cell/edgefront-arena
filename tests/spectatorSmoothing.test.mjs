import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import {
  NullEngine,
  Scene,
  UniversalCamera,
  Vector3,
  MeshBuilder,
} from '@babylonjs/core';
const { createSpectator } = await import('../game/createSpectator.ts');
const engine = new NullEngine(),
  scene = new Scene(engine);
const player = new UniversalCamera(
  'local camera',
  new Vector3(10, 1.7, -17),
  scene,
);
scene.activeCamera = player;
const own = {
  slot: 0,
  team: 0,
  name: 'You',
  health: 0,
  connected: true,
  weapon: 'assaultRifle',
  pose: () => ({ x: 10, y: 0.9, z: -17, yaw: 0, pitch: 0 }),
};
function follow(pose, other = null) {
  const ally = { ...own, slot: 1, name: 'Ally', health: 100, pose: () => pose };
  const actors = [
    own,
    ally,
    ...(other ? [{ ...ally, slot: 2, name: 'Other', pose: () => other }] : []),
  ];
  const camera = createSpectator(scene, () => {});
  camera.setRoster(actors, 0);
  camera.start();
  camera.update(0);
  return { camera, actors };
}
const start = () => ({ x: 0, y: 0.9, z: 0, yaw: 0, pitch: 0 });
const angle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
try {
  const finalPositions = [];
  for (const fps of [15, 30, 60, 144]) {
    const pose = start(),
      { camera } = follow(pose),
      before = camera.camera.position.clone();
    pose.x = 6;
    camera.update(1 / fps);
    assert.ok(
      camera.camera.position.x > before.x &&
        camera.camera.position.x < before.x + 3.2,
      'Movement eases instead of snapping to target',
    );
    for (let frame = 1; frame < fps; frame++) camera.update(1 / fps);
    finalPositions.push(camera.camera.position.clone());
    assert.ok(
      Math.abs(camera.camera.position.x - 7) < 0.05,
      'Follow keeps up without a long trailing delay',
    );
    const current = camera.camera.position.clone();
    pose.x = 9;
    camera.update(0);
    camera.update(-1);
    camera.update(NaN);
    assert.ok(
      camera.camera.position.equalsWithEpsilon(current, 1e-7),
      'Network roster updates and invalid time steps do not advance smoothing',
    );
    camera.dispose();
  }
  for (const position of finalPositions)
    assert.ok(
      position.equalsWithEpsilon(finalPositions[0], 1e-6),
      'Camera follow is consistent at 15, 30, 60 and 144 FPS',
    );
  {
    const pose = start(),
      { camera } = follow(pose);
    const yaw = camera.camera.rotation.y,
      pitch = camera.camera.rotation.x,
      y = camera.camera.position.y;
    pose.yaw = Math.PI / 2;
    pose.pitch = 0.6;
    pose.y += 3;
    camera.update(1 / 60);
    const turn = Math.abs(angle(camera.camera.rotation.y, yaw));
    assert.ok(
      turn > 0.01 && turn < 0.5,
      'Sharp player turns become a gradual camera turn',
    );
    assert.ok(
      camera.camera.rotation.x > pitch &&
        camera.camera.rotation.x - pitch < 0.3,
      'Vertical aim is eased',
    );
    assert.ok(
      camera.camera.position.y > y && camera.camera.position.y < y + 1,
      'Jump height is eased',
    );
    camera.dispose();
  }
  {
    const pose = { ...start(), yaw: Math.PI - 0.04 },
      { camera } = follow(pose),
      before = camera.camera.position.clone(),
      yaw = camera.camera.rotation.y;
    pose.yaw = -Math.PI + 0.04;
    camera.update(1 / 60);
    assert.ok(
      Vector3.Distance(before, camera.camera.position) < 0.1,
      'Crossing pi does not swing shoulder camera around player',
    );
    assert.ok(
      Math.abs(angle(camera.camera.rotation.y, yaw)) < 0.03,
      'Yaw uses the shortest turn',
    );
    camera.dispose();
  }
  {
    const pose = start(),
      { camera } = follow(pose),
      samples = [];
    for (let frame = 0; frame < 120; frame++) {
      pose.x = frame % 2 ? 0.2 : -0.2;
      camera.update(1 / 60);
      if (frame >= 60) samples.push(camera.camera.position.x);
    }
    assert.ok(
      Math.max(...samples) - Math.min(...samples) < 0.1,
      'Rapid bot/network position jitter is damped',
    );
    const wall = MeshBuilder.CreateBox(
      'cover',
      { width: 10, height: 8, depth: 0.2 },
      scene,
    );
    wall.position.set(0, 2, -1.8);
    wall.checkCollisions = true;
    wall.computeWorldMatrix(true);
    camera.update(0);
    assert.ok(
      camera.camera.position.z > -1.7,
      'Cover collision pulls camera inward even with zero elapsed time',
    );
    const near = camera.camera.position.z;
    wall.setEnabled(false);
    camera.update(1 / 60);
    assert.ok(
      camera.camera.position.z < near && camera.camera.position.z > -3.6,
      'Leaving cover eases camera outward rather than popping',
    );
    for (let frame = 0; frame < 60; frame++) camera.update(1 / 60);
    assert.ok(
      Math.abs(camera.camera.position.z + 3.6) < 0.01,
      'Camera recovers full shoulder distance',
    );
    wall.position.z = -0.9;
    wall.setEnabled(true);
    wall.computeWorldMatrix(true);
    camera.update(1 / 60);
    assert.ok(
      camera.camera.position.z > -0.8,
      'New nearby obstruction overrides easing immediately',
    );
    wall.dispose();
    camera.dispose();
  }
  {
    const pose = start(),
      other = { ...start(), x: 20 },
      { camera, actors } = follow(pose, other);
    camera.select(2);
    camera.update(0);
    assert.ok(
      Math.abs(camera.camera.position.x - 21) < 1e-6,
      'Player switching resets follow history instead of flying through the arena',
    );
    other.x = 60;
    camera.update(1 / 60);
    assert.ok(
      Math.abs(camera.camera.position.x - 61) < 1e-6,
      'Teleports cut immediately rather than leaving camera far behind',
    );
    camera.select(1);
    camera.update(0);
    camera.setRoster(
      actors.map((a) => (a.slot === 1 ? { ...a, health: 0 } : a)),
      0,
    );
    camera.update(0);
    assert.equal(camera.targetSlot, 2);
    assert.ok(
      Math.abs(camera.camera.position.x - 61) < 1e-6,
      'Automatic target changes also reset follow history',
    );
    camera.stop();
    assert.equal(scene.activeCamera, player);
    camera.dispose();
  }
  assert.deepEqual(player.position.asArray(), [10, 1.7, -17]);
  console.log(
    'PASS: frame-rate independent spectator easing, smooth movement/aim/jumps, shortest yaw, jitter damping, immediate cover safety, gentle outward recovery, target/teleport reset and no network-packet over-advancement.',
  );
} finally {
  scene.dispose();
  engine.dispose();
}
