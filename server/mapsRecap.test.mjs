import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
import { createHitWorld } from './combat.mjs';
import { readDeathRecap } from '../game/deathRecap.ts';
import { ARENA_MAPS } from '../game/maps.ts';
const server = process.env.TEST_SERVER_URL
  ? null
  : createRoomServer({ port: 0 });
if (server) await once(server.http, 'listening');
const url =
  process.env.TEST_SERVER_URL ?? 'ws://127.0.0.1:' + server.http.address().port;
const sockets = [],
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  latest = (s, t) => s.messages.filter((m) => m.type === t).at(-1),
  send = (s, m) => s.send(JSON.stringify(m));
async function until(check) {
  for (let i = 0; i < 400; i++) {
    if (check()) return;
    await wait(10);
  }
  throw Error('Timed out');
}
async function peer() {
  const s = new WebSocket(url, { origin: 'http://localhost:3000' });
  sockets.push(s);
  s.messages = [];
  s.on('message', (data) => s.messages.push(JSON.parse(data)));
  await once(s, 'open');
  return s;
}
try {
  const a = await peer(),
    b = await peer();
  send(a, { type: 'create', mapId: 'fake' });
  await until(() => latest(a, 'error'));
  assert.match(latest(a, 'error').message, /map/);
  for (const mapId of Object.keys(ARENA_MAPS)) {
    a.messages = [];
    b.messages = [];
    await wait(170);
    send(a, { type: 'create', mapId, visibility: 'public' });
    await until(() => latest(a, 'room'));
    const code = latest(a, 'room').code;
    send(b, { type: 'join', code, mapId: 'fake' });
    await until(() => latest(b, 'room')?.ready);
    assert.equal(latest(a, 'room').mapId, mapId);
    assert.equal(
      latest(b, 'room').mapId,
      mapId,
      'Joining uses host map, not a client-supplied map',
    );
    for (const [i, s] of [a, b].entries()) {
      send(s, { type: 'combatReady' });
      send(s, { type: 'equip', weapon: 'sniper' });
      send(s, {
        type: 'move',
        pose: {
          x: 0,
          y: 0.9,
          z: i ? -12 : -16,
          yaw: i ? Math.PI : 0,
          pitch: 0,
        },
      });
    }
    await until(() => latest(a, 'move') && latest(b, 'move'));
    send(a, {
      type: 'effect',
      weapon: 'sniper',
      action: 'fire',
      sequence: 1,
      origin: { x: 0, y: 1.52, z: -16 },
      direction: { x: 0, y: 0, z: 1 },
    });
    await until(() => latest(b, 'score')?.phase === 'roundOver');
    assert.deepEqual(
      latest(a, 'score').recaps,
      latest(b, 'score').recaps,
      'Both players agree on the server recap',
    );
    const recap = readDeathRecap(latest(b, 'score').recaps[1]);
    assert.ok(recap);
    assert.equal(recap.killer, 'Player1');
    assert.equal(recap.totalDamage, 100);
    assert.equal(recap.finalHit.weapon, 'sniper');
    assert.equal(recap.finalHit.zone, 'head');
    assert.equal(recap.killerHealth, 100);
    assert.equal(recap.hits[0].count, 1);
    send(b, { type: 'leave' });
    await until(() => latest(b, 'left'));
    send(a, { type: 'leave' });
    await until(() => latest(a, 'left'));
  }
  for (const id of ['switchyard', 'crossfire', 'skyline']) {
    const world = createHitWorld(id);
    try {
      const hit = world.hit(
        { x: 8, y: 1.52, z: -10 },
        { x: 0, y: 0, z: 1 },
        { x: 8, y: 0.9, z: -2, yaw: 0, pitch: 0 },
        20,
      );
      assert.equal(
        hit,
        id === 'switchyard' ? null : 'head',
        'Server queries actual selected map cover',
      );
    } finally {
      world.dispose();
    }
  }
  console.log(
    'PASS: four maps through two real WebSocket clients, host-authoritative selection, invalid maps rejected, map-specific server occlusion, shared death recaps, actual HP damage and headshot finish.',
  );
} finally {
  sockets.forEach((s) => s.terminate());
  if (server) await server.close();
}
