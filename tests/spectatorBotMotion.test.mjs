import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import { NullEngine, Scene, UniversalCamera, Vector3, MeshBuilder } from '@babylonjs/core';
const { createBot } = await import('../game/createBot.ts');
const { botSimulationPhase } = await import('../game/botSimulation.ts');
const { createSpectator } = await import('../game/createSpectator.ts');
const engine = new NullEngine(), scene = new Scene(engine);
const player = new UniversalCamera('player', new Vector3(0, 1.7, 4), scene);
scene.activeCamera = player;
globalThis.window = new EventTarget();
window.setTimeout = () => 0;
const floor = MeshBuilder.CreateBox('floor', { width: 60, height: 1, depth: 60 }, scene);
floor.position.y = -0.5; floor.checkCollisions = true;
let hits = 0, shots = 0;
const bot = createBot(scene, player, {
  onHealthChange() {}, onEliminated() {}, isPlayerAlive: () => true,
  onPlayerHit() { hits++; }, onShot() { shots++; },
}, () => 'normal');
bot.setAutoRespawn(false);
bot.setSpawn(new Vector3(0, 1, 0));
bot.setPatrolRoute([[8, 0], [8, 8], [0, 8], [0, 0]]);
const spectator = createSpectator(scene, () => {});
const pose = () => ({ x: bot.root.position.x, y: bot.root.position.y,
  z: bot.root.position.z, yaw: bot.root.rotation.y + Math.PI, pitch: 0 });
try {
  for (const size of [1, 2, 3, 4, 5]) {
    assert.equal(botSimulationPhase(false, true, false, size, false), size === 1 ? 'patrol' : 'combat');
    assert.equal(botSimulationPhase(false, true, false, size, true), 'patrol');
    assert.equal(botSimulationPhase(false, false, true, size, false), 'paused');
    assert.equal(botSimulationPhase(true, false, true, size, false), 'combat');
    assert.equal(botSimulationPhase(true, false, true, size, true), 'patrol');
  }
  spectator.setRoster([
    { slot: 0, team: 0, name: 'You', health: 0, connected: true, weapon: 'assaultRifle', pose: () => null },
    { slot: 1, team: 1, name: 'Rook', health: 100, connected: true, weapon: 'assaultRifle', pose },
  ], 0, true);
  spectator.start();
  spectator.update(0);
  const start = bot.root.position.clone(), eye = spectator.camera.position.clone();
  for (let frame = 0; frame < 120; frame++) {
    // Round is resolved: the local player may still be alive, but no more damage is allowed.
    bot.update(1 / 60, 10000 + frame * 1000 / 60, false);
    scene.render();
    spectator.update(1 / 60);
  }
  assert.ok(Vector3.Distance(start, bot.root.position) > 1, 'Surviving bot moves during spectating');
  assert.ok(Vector3.Distance(eye, spectator.camera.position) > 1, 'Spectator follows moving bot');
  assert.equal(hits, 0, 'Intermission patrol cannot damage another player');
  assert.equal(shots, 0, 'Intermission patrol cannot fire');
  for (let frame = 0; frame < 20; frame++) bot.update(0, 20000 + frame * 1000);
  assert.ok(shots > 0, 'Combat resumes normally when enabled');
  console.log('PASS: surviving bot and spectator keep moving during round breaks without firing or damage; combat resumes next round.');
} finally {
  spectator.dispose(); bot.dispose(); scene.dispose(); engine.dispose();
}
