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
const { createRemotePlayer } = await import('../game/createRemotePlayer.ts');
const engine = new NullEngine(),
  scene = new Scene(engine);
const player = new UniversalCamera(
  'local player camera',
  new Vector3(10, 1.7, -17),
  scene,
);
player.rotation.set(0.3, 0.7, 0);
scene.activeCamera = player;
let latest,
  changes = 0;
const spectator = createSpectator(scene, (s) => {
  latest = s;
  changes++;
});
const poses = Array.from({ length: 10 }, (_, slot) => ({
  x: slot * 2,
  y: 0.9,
  z: 0,
  yaw: 0,
  pitch: 0,
}));
const roster = (size) =>
  Array.from({ length: size * 2 }, (_, slot) => ({
    slot,
    team: slot < size ? 0 : 1,
    name: slot === 0 ? 'You' : `Unit ${slot}`,
    health: slot === 0 ? 0 : 100,
    connected: true,
    weapon: 'assaultRifle',
    pose: () => poses[slot],
  }));
try {
  for (let size = 1; size <= 5; size++) {
    const actors = roster(size);
    spectator.setRoster(actors, 0);
    spectator.start();
    assert.equal(scene.activeCamera, spectator.camera);
    assert.equal(
      latest.options.length,
      size - 1,
      'Only surviving teammates can be watched during a round',
    );
    assert.equal(spectator.targetSlot, size === 1 ? null : 1);
    if (size >= 3) {
      spectator.cycle(-1);
      assert.equal(
        spectator.targetSlot,
        size - 1,
        'Previous wraps to last teammate',
      );
      spectator.cycle(1);
      assert.equal(spectator.targetSlot, 1);
      spectator.select(2);
      assert.equal(spectator.targetSlot, 2);
      spectator.select(size);
      assert.equal(
        spectator.targetSlot,
        2,
        'Cannot select an enemy during live play',
      );
      spectator.setRoster(
        actors.map((a) => (a.slot === 2 ? { ...a, health: 0 } : a)),
        0,
      );
      assert.equal(
        spectator.targetSlot,
        1,
        'Automatically switches when target is eliminated',
      );
      spectator.setRoster(
        actors.map((a) => (a.slot === 1 ? { ...a, connected: false } : a)),
        0,
      );
      assert.equal(
        spectator.targetSlot,
        2,
        'Disconnected targets cannot be spectated',
      );
    }
    spectator.setRoster(
      actors.map((a) => ({ ...a, health: a.team === 0 ? 0 : 100 })),
      0,
    );
    assert.equal(
      spectator.targetSlot,
      null,
      'No enemies revealed while team is eliminated but round resolution is pending',
    );
    spectator.update(1 / 60);
    spectator.setRoster(
      actors.map((a) => ({ ...a, health: a.team === 0 ? 0 : 100 })),
      0,
      true,
    );
    assert.equal(
      spectator.targetSlot,
      size,
      'Winning players can be watched after round resolution, including 1v1',
    );
    const before = changes;
    spectator.setRoster(
      actors.map((a) => ({ ...a, health: a.team === 0 ? 0 : 100 })),
      0,
      true,
    );
    assert.equal(
      changes,
      before,
      'Duplicate roster packets do not flood React HUD updates',
    );
    spectator.stop();
    assert.equal(
      scene.activeCamera,
      player,
      'Round/lobby reset restores local camera',
    );
    assert.equal(latest, null);
  }
  const remote = createRemotePlayer(scene);
  const start = { x: 0, y: 0.9, z: 0, yaw: 0, pitch: 0 };
  remote.show(start);
  const own = roster(2)[0],
    ally = { ...roster(2)[1], pose: () => remote.readPose() };
  spectator.setRoster([own, ally], 0);
  spectator.start();
  spectator.update(1 / 60);
  const oldEye = spectator.camera.position.clone();
  remote.receive({ ...start, x: 5, pitch: 0.4 });
  remote.update(1 / 60);
  spectator.update(1 / 60);
  assert.ok(
    spectator.camera.position.x > oldEye.x,
    'Follows actual interpolated online model rather than network teleport',
  );
  assert.ok(spectator.camera.position.x < oldEye.x + 5);
  assert.ok(spectator.camera.rotation.x > 0, 'Follows target aim');
  assert.deepEqual(
    player.position.asArray(),
    [10, 1.7, -17],
    'Spectating never moves eliminated player camera or changes network aim',
  );
  assert.deepEqual(player.rotation.asArray(), [0.3, 0.7, 0]);
  remote.show(start);
  const wall = MeshBuilder.CreateBox(
    'cover',
    { width: 10, height: 8, depth: 0.2 },
    scene,
  );
  wall.position.set(0, 2, -1.8);
  wall.checkCollisions = true;
  wall.computeWorldMatrix(true);
  spectator.update(1 / 60);
  assert.ok(
    spectator.camera.position.z > -1.7,
    'Shoulder camera stays in front of cover rather than clipping through it',
  );
  spectator.setRoster([own, { ...ally, pose: () => null }], 0);
  assert.equal(
    spectator.targetSlot,
    null,
    'Missing remote pose is not a valid spectator target',
  );
  spectator.stop();
  remote.dispose();
  wall.dispose();
  const cameraCount = scene.cameras.length;
  spectator.dispose();
  assert.equal(
    scene.cameras.length,
    cameraCount - 1,
    'Spectator camera is released',
  );
  console.log(
    'PASS: spectator selection in all team sizes, teammate-only live play, death/disconnect fallback, post-round 1v1, smooth online follow, collision-safe camera, aim isolation and cleanup.',
  );
} finally {
  scene.dispose();
  engine.dispose();
}
