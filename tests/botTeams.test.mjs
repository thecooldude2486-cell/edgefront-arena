import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import {
  NullEngine,
  Scene,
  UniversalCamera,
  Vector3,
  Ray,
} from '@babylonjs/core';
const { createBot } = await import('../game/createBot.ts');
import { teamSpawn, mapsForTeams, mapScale } from '../game/teams.ts';
const { createArena } = await import('../game/createArena.ts');
const engine = new NullEngine(),
  scene = new Scene(engine),
  camera = new UniversalCamera('main', new Vector3(0, 1.7, 0), scene);
const oldRandom = Math.random;
Math.random = () => 0.5;
globalThis.window = new EventTarget();
window.setTimeout = () => 0;
try {
  let hits = 0;
  const enemy = createBot(
    scene,
    camera,
    {
      onHealthChange() {},
      onEliminated() {},
      isPlayerAlive: () => true,
      onPlayerHit() {},
    },
    () => 'normal',
  );
  const ally = createBot(
    scene,
    camera,
    {
      onHealthChange() {},
      onEliminated() {},
      isPlayerAlive: () => true,
      onPlayerHit(id, zone) {
        hits++;
        enemy.takeDamage(id, zone);
      },
    },
    () => 'normal',
  );
  enemy.setAutoRespawn(false);
  ally.setAutoRespawn(false);
  enemy.setSpawn(new Vector3(0, 1, 4));
  ally.setSpawn(new Vector3(0, 1, -4));
  ally.setTeam(0);
  const start = performance.now() + 1000;
  for (let i = 0; i < 20; i++) {
    ally.setTarget(
      enemy.root.position.add(new Vector3(0, 0.8, 0)),
      enemy.alive,
    );
    ally.update(0, start + i * 1000);
  }
  assert.ok(hits >= 7);
  assert.equal(
    enemy.alive,
    false,
    'An allied bot can eliminate an opposing bot',
  );
  assert.equal(enemy.health, 0);
  enemy.reset();
  assert.equal(enemy.health, 100);
  assert.equal(
    enemy.root.position.z,
    4,
    'Round reset retains assigned team spawn',
  );
  assert.equal(
    ally.ownsMesh(enemy.root.getChildMeshes()[0]),
    false,
    'Bot hit ownership is specific to a unit',
  );
  enemy.dispose();
  ally.dispose();
  for (let size = 1; size <= 5; size++) {
    const map = mapsForTeams(size)[0],
      arena = createArena(scene, map);
    assert.ok(arena.meshes.length > 100);
    const spawns = Array.from({ length: size * 2 }, (_, slot) =>
      teamSpawn(slot, size, map),
    );
    assert.equal(new Set(spawns.map((p) => p.x + ',' + p.z)).size, size * 2);
    assert.ok(mapScale(map) >= 1);
    scene.meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
    for (const pose of spawns) {
      const floor = scene.pickWithRay(
        new Ray(new Vector3(pose.x, pose.y, pose.z), Vector3.Down(), 2),
        (mesh) => mesh.checkCollisions,
      );
      assert.ok(
        floor.hit,
        `Team spawn has ground: ${size}v${size} ${pose.x},${pose.z}`,
      );
      const clearance = scene.pickWithRay(
        new Ray(new Vector3(pose.x, 0.1, pose.z), Vector3.Up(), 1.8),
        (mesh) => mesh.checkCollisions,
      );
      assert.equal(
        clearance.hit,
        false,
        `Team spawn fits standing player: ${size}v${size}`,
      );
    }
    arena.dispose();
  }
  console.log(
    'PASS: ally AI attacks enemy AI, per-unit hit ownership, assigned spawns, no individual auto-respawn and arenas/spawns for every team size.',
  );
} finally {
  Math.random = oldRandom;
  scene.dispose();
  engine.dispose();
}
