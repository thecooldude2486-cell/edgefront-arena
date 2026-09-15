import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
import { NullEngine, Scene, Ray, Vector3 } from '@babylonjs/core';
const { createLobby, LOBBY_SPAWN } = await import('../game/createLobby.ts');
import { nearbyLobbyStation, LOBBY_STATIONS, LOBBY_INTERACT_RADIUS } from '../game/lobbyStations.ts';

// Text signs need a canvas, but collision tests do not need a GPU or real fonts.
globalThis.OffscreenCanvas = class {
  constructor(width, height) { this.width = width; this.height = height; }
  getContext() { return { fillRect() {}, fillText() {}, measureText: () => ({ width: 500 }) }; }
};
const engine = new NullEngine();
const scene = new Scene(engine);
const lobby = createLobby(scene);
scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
const solid = mesh => mesh.checkCollisions;
assert.ok(scene.pickWithRay(new Ray(LOBBY_SPAWN, Vector3.Down(), 3), solid)?.hit, 'Spawn has a solid floor');
for (const direction of [Vector3.Forward(), Vector3.Backward(), Vector3.Left(), Vector3.Right()]) {
  assert.ok(scene.pickWithRay(new Ray(LOBBY_SPAWN, direction, 65), solid)?.hit, 'Lobby perimeter is enclosed');
}
assert.equal(scene.pickWithRay(new Ray(LOBBY_SPAWN, Vector3.Forward(), 12), solid)?.hit, false, 'Spawn has a clear path to the central concourse');
assert.equal(nearbyLobbyStation(LOBBY_SPAWN), null, 'Menus cannot open remotely from spawn');
for (const station of LOBBY_STATIONS) {
  assert.equal(nearbyLobbyStation(station)?.id, station.id);
  assert.equal(nearbyLobbyStation({ ...station, z: station.z - 3 })?.id, station.id, 'Console is reachable from in front');
  assert.equal(nearbyLobbyStation({ ...station, x: station.x + LOBBY_INTERACT_RADIUS + .1 }), null);
  assert.equal(nearbyLobbyStation({ ...station, y: 8 }), null, 'Cannot interact through upper structure');
  const approach = new Vector3(station.x, 1.72, station.z - 3);
  assert.ok(scene.pickWithRay(new Ray(approach, Vector3.Down(), 3), solid)?.hit);
  assert.equal(scene.pickWithRay(new Ray(approach, Vector3.Backward(), 4), solid)?.hit, false, 'Terminal approach is unobstructed');
}
lobby.update(1000);
assert.notEqual(scene.getMeshByName('lobby suspended Orb').position.y, 3.4);
assert.ok(scene.meshes.some(mesh => mesh.name === 'lobby bench seat'));
assert.ok(scene.meshes.some(mesh => mesh.name === 'lobby sign ARMORY'));
assert.ok(scene.meshes.some(mesh => mesh.name === 'lobby sign DUEL DECK'));
scene.dispose(); engine.dispose();
console.log('PASS: lobby floor, perimeter collisions, clear spawn route, seating and destination signs.');
