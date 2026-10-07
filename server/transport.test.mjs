import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const { createRoomConnection } =
  await import('../game/createRoomConnection.ts');
const server = process.env.TEST_SERVER_URL
  ? null
  : createRoomServer({ port: 0, reconnectGraceMs: 4000 });
if (server) await once(server.http, 'listening');
const serverUrl =
  process.env.TEST_SERVER_URL ?? 'ws://127.0.0.1:' + server.http.address().port;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  latest = (p, t) => p.messages.filter((m) => m.type === t).at(-1);
async function until(check) {
  for (let i = 0; i < 500; i++) {
    if (check()) return;
    await wait(10);
  }
  throw Error('Timed out');
}
function peer() {
  const p = { sockets: [], messages: [], status: null },
    values = new Map();
  p.connection = createRoomConnection({
    url: serverUrl,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    retryDelayMs: 50,
    onStatus: (status) => (p.status = status),
    onMessage: (message) => p.messages.push(message),
    makeSocket: (url) => {
      const ws = new WebSocket(url, { origin: 'http://localhost:3000' });
      p.sockets.push(ws);
      return ws;
    },
  });
  return p;
}
const a = peer(),
  b = peer();
try {
  await until(() => latest(a, 'session') && latest(b, 'session'));
  a.connection.send({ type: 'create' });
  await until(() => latest(a, 'room'));
  const code = latest(a, 'room').code;
  b.connection.send({ type: 'join', code });
  await until(() => latest(b, 'room')?.ready);
  for (const [i, p] of [a, b].entries()) {
    p.connection.send({ type: 'combatReady' });
    p.connection.send({
      type: 'move',
      pose: { x: 0, y: 0.9, z: i ? -12 : -16, yaw: i ? Math.PI : 0, pitch: 0 },
    });
  }
  await until(() => latest(a, 'move') && latest(b, 'move'));
  a.connection.send({
    type: 'effect',
    action: 'fire',
    weapon: 'assaultRifle',
    sequence: 1,
    origin: { x: 0, y: 1.05, z: -16 },
    direction: { x: 0, y: 0, z: 1 },
  });
  await until(() => latest(b, 'health')?.players[1].health === 88);
  a.sockets[0].terminate();
  assert.equal(a.connection.send({ type: 'effect', sequence: 2 }), false);
  await until(() => latest(a, 'sync'));
  assert.equal(a.sockets.length, 2);
  assert.equal(latest(a, 'room').code, code);
  assert.equal(latest(a, 'sync').players[0].inventory.assaultRifle.ammo, 19);
  assert.equal(latest(a, 'sync').players[1].health, 88);
  assert.equal(a.status.reconnecting, false);
  await wait(100);
  assert.equal(
    latest(b, 'health').players[1].health,
    88,
    'Offline shot was never replayed',
  );
  await until(() => a.status.rttMs !== null);
  assert.ok(a.status.rttMs >= 0);
  a.connection.dispose();
  await until(() => latest(b, 'closed'));
  assert.equal(
    latest(b, 'closed').type,
    'closed',
    'Intentional exit closes immediately',
  );
  console.log(
    'PASS: real browser transport automatically reconnects with session/identity/ammo preserved, measures ping, drops offline attacks and leaves immediately.',
  );
} finally {
  a.connection.dispose();
  b.connection.dispose();
  if (server) await server.close();
}
