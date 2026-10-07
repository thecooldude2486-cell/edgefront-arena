import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
import {
  createHitWorld,
  newCombatPlayer,
  checkCombatEffect,
} from './combat.mjs';
import {
  newEnvironment,
  ferryPosition,
  barrelDamage,
} from '../game/arenaEnvironment.ts';
import { readDeathRecap } from '../game/deathRecap.ts';
const server = createRoomServer({ port: 0 });
await once(server.http, 'listening');
const url = 'ws://127.0.0.1:' + server.http.address().port,
  sockets = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const latest = (s, t) => s.messages.filter((m) => m.type === t).at(-1),
  send = (s, m) => s.send(JSON.stringify(m));
async function until(fn) {
  for (let i = 0; i < 500; i++) {
    if (fn()) return;
    await delay(10);
  }
  throw Error('Timed out');
}
async function peer() {
  const s = new WebSocket(url, { origin: 'http://localhost:3000' });
  s.messages = [];
  sockets.push(s);
  s.on('message', (d) => s.messages.push(JSON.parse(d)));
  await once(s, 'open');
  return s;
}
async function room(a, b) {
  await delay(160);
  send(a, { type: 'create' });
  await until(() => latest(a, 'room'));
  send(b, { type: 'join', code: latest(a, 'room').code });
  await until(() => latest(b, 'room')?.ready);
  for (const s of [a, b]) send(s, { type: 'combatReady' });
  await until(() => latest(a, 'environment')?.running);
}
function pose(x, z, y = 0.9, yaw = 0) {
  return { x, y, z, yaw, pitch: 0 };
}
try {
  assert.equal(barrelDamage(0.8), 100);
  assert.equal(barrelDamage(7), 0);
  assert.ok(barrelDamage(4) < 100);
  const world = createHitWorld();
  try {
    const state = newEnvironment('stadium');
    world.setEnvironment(state);
    const start = ferryPosition(1, 0),
      end = ferryPosition(1, 5);
    assert.ok(end.z - start.z > 6 && end.y > start.y);
    world.setEnvironment({ ...state, seconds: 5 });
    const platform = world.sweep(
      { x: 14, y: 4, z: end.z },
      { x: 0, y: -1, z: 0 },
      5,
    );
    assert.equal(
      platform.mesh.name,
      'moving void ferry',
      'Server queries the ferry at its current position',
    );
    assert.equal(
      world.sweep({ x: 14, y: 3, z: 29 }, { x: 0, y: -1, z: 0 }, 12),
      null,
      'The gap has no invisible floor',
    );
    const dock = world.sweep(
      { x: 15.2, y: 3, z: 23.4 },
      { x: 0, y: -1, z: 0 },
      5,
    );
    assert.equal(dock.point.y, 0);
    const high = world.sweep({ x: 20, y: 10, z: 34 }, { x: 0, y: -1, z: 0 }, 8);
    assert.ok(Math.abs(high.point.y - 4.8) < 0.001);
    assert.ok(
      high.point.y - 1.6 > 8.4 ** 2 / (2 * 23),
      'Normal jump cannot reach the high perch',
    );
    let explosions = 0;
    world.setEnvironment(state, () => explosions++);
    const a = { ...newCombatPlayer(), ready: true, pose: pose(11, -3) },
      b = { ...newCombatPlayer(), ready: true, pose: pose(11, 3.1) };
    for (let i = 0; i < 4; i++)
      assert.equal(
        checkCombatEffect(
          a,
          b,
          {
            action: 'fire',
            weapon: 'assaultRifle',
            origin: { x: 11, y: 1.05, z: -3 },
            direction: { x: 0, y: 0, z: 1 },
          },
          i,
          1000 + i * 125,
          world,
        ),
        true,
      );
    assert.equal(explosions, 1);
    assert.equal(
      b.health,
      100,
      'A bullet consumed by the barrel cannot also hit the player behind it',
    );
    assert.equal(world.environment.state.barrelHealth[1], 0);
    world.setEnvironment(newEnvironment('stadium'));
    assert.equal(
      world.environment.state.barrelHealth[1],
      45,
      'Other room state restores its barrel',
    );
  } finally {
    world.dispose();
  }
  const a = await peer(),
    b = await peer();
  await room(a, b);
  send(a, { type: 'move', pose: pose(14, 30) });
  send(b, { type: 'move', pose: pose(0, 17) });
  await delay(200);
  send(a, { type: 'move', pose: pose(14, 30, -9) });
  await until(() => latest(a, 'score')?.phase === 'roundOver');
  let recap = readDeathRecap(latest(a, 'score').recaps[0]);
  assert.ok(recap);
  assert.equal(recap.finalHit.weapon, 'fall');
  assert.deepEqual(latest(a, 'score').scores, [0, 1]);
  assert.ok(recap.replay.frames.length >= 2);
  await until(() => latest(a, 'score')?.round === 2);
  for (const s of [a, b]) send(s, { type: 'combatReady' });
  send(a, { type: 'move', pose: pose(11, -3) });
  send(b, { type: 'move', pose: pose(11, 3.1) });
  send(a, { type: 'equip', weapon: 'sniper' });
  await delay(150);
  send(a, {
    type: 'effect',
    action: 'fire',
    weapon: 'sniper',
    sequence: 1,
    origin: { x: 11, y: 1.05, z: -3 },
    direction: { x: 0, y: 0, z: 1 },
  });
  await until(() => latest(a, 'environment')?.state.barrelHealth[1] === 11);
  await delay(1250);
  send(a, {
    type: 'effect',
    action: 'fire',
    weapon: 'sniper',
    sequence: 2,
    origin: { x: 11, y: 1.05, z: -3 },
    direction: { x: 0, y: 0, z: 1 },
  });
  await until(() => latest(a, 'environment')?.state.barrelHealth[1] === 0);
  await until(() => latest(b, 'score')?.phase === 'roundOver');
  recap = readDeathRecap(latest(b, 'score').recaps[1]);
  assert.ok(recap);
  assert.equal(recap.finalHit.weapon, 'oilBarrel');
  assert.equal(recap.totalDamage, 100);
  assert.ok(
    latest(a, 'health').players[0].health < 100,
    'Oil barrels also hurt their shooter',
  );
  assert.ok(recap.replay.frames.some((f) => f.shot));
  assert.equal(recap.killerStats.shots, 2);
  assert.deepEqual(
    latest(a, 'environment').state,
    latest(b, 'environment').state,
    'Both clients agree on destroyed barrels',
  );
  await until(() => latest(a, 'score')?.round === 3);
  assert.equal(
    latest(a, 'environment').state.barrelHealth[1],
    45,
    'New rounds rebuild barrels',
  );
  console.log(
    'PASS: server ferry collisions, real void gap, item-only perch, barrel absorption, room isolation, fall elimination, oil damage including self, resets, recorded movement/shots and killer stats.',
  );
} finally {
  sockets.forEach((s) => s.terminate());
  await server.close();
}
