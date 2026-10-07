import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server = createRoomServer({ port: 0 });
await once(server.http, 'listening');
const clients = [],
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  send = (s, m) => s.send(JSON.stringify(m)),
  latest = (s, t) => s.messages.filter((m) => m.type === t).at(-1);
async function until(check, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (check()) return;
    await wait(10);
  }
  throw Error('Timed out');
}
async function connect(token) {
  const s = new WebSocket('ws://127.0.0.1:' + server.http.address().port, {
    origin: 'http://localhost:3000',
  });
  clients.push(s);
  s.messages = [];
  s.on('message', (data) => {
    const message = JSON.parse(data);
    s.messages.push(message);
    if (message.type === 'netProbe')
      send(s, { type: 'netAck', id: message.id });
  });
  await once(s, 'open');
  send(s, token ? { type: 'resume', token } : { type: 'enableResume' });
  await until(() => latest(s, 'session'));
  return s;
}
const fire = (s, seq) =>
  send(s, {
    type: 'effect',
    action: 'fire',
    weapon: 'sniper',
    sequence: seq,
    origin: { x: 0, y: 1.52, z: -16 },
    direction: { x: 0, y: 0, z: 1 },
  });
function ready(a, b) {
  for (const [index, s] of [a, b].entries()) {
    send(s, {
      type: 'combatReady',
      loadout: ['sniper', 'uzi', 'sword', 'grenade'],
    });
    send(s, { type: 'equip', weapon: 'sniper' });
    send(s, {
      type: 'move',
      pose: {
        x: 0,
        y: 0.9,
        z: index ? -12 : -16,
        yaw: index ? Math.PI : 0,
        pitch: 0,
      },
    });
  }
}
try {
  const a = await connect();
  let b = await connect();
  send(a, { type: 'create' });
  await until(() => latest(a, 'room'));
  const code = latest(a, 'room').code;
  send(b, { type: 'join', code });
  await until(() => latest(b, 'room')?.ready);
  const originalId = latest(a, 'room').matchId,
    token = latest(b, 'session').token;
  send(a, { type: 'rematch' });
  await wait(30);
  assert.equal(
    latest(a, 'rematchStart'),
    undefined,
    'Cannot reset a playing match',
  );
  for (let round = 1; round <= 5; round++) {
    if (round > 1) await until(() => latest(a, 'score').round === round);
    ready(a, b);
    await wait(40);
    fire(a, round);
    await until(() => latest(a, 'score').scores[0] === round);
  }
  assert.equal(latest(a, 'score').phase, 'finished');
  send(a, { type: 'rematch' });
  await until(() => latest(b, 'room')?.rematchReady?.[0]);
  assert.deepEqual(
    latest(a, 'score').scores,
    [5, 0],
    'One vote cannot reset match',
  );
  send(a, { type: 'rematch' });
  send(b, { type: 'rematch' });
  await until(() => latest(a, 'rematchStart') && latest(b, 'rematchStart'));
  assert.deepEqual(latest(a, 'score').scores, [0, 0]);
  assert.equal(latest(a, 'room').code, code);
  assert.ok(latest(a, 'room').matchId > originalId);
  ready(a, b);
  fire(a, 6);
  await wait(80);
  assert.deepEqual(
    latest(a, 'health').players.map((p) => p.health),
    [100, 100],
    'Countdown blocks damage',
  );
  b.terminate();
  await until(() => latest(a, 'room')?.paused);
  await wait(350);
  b = await connect(token);
  await until(() => latest(b, 'sync'));
  assert.equal(latest(b, 'sync').rematching, true);
  assert.ok(
    latest(b, 'sync').remainingMs > 2000,
    'Disconnect pauses rematch countdown',
  );
  await until(() => latest(a, 'matchStart') && latest(b, 'matchStart'));
  ready(a, b);
  await wait(50);
  fire(a, 5);
  await wait(30);
  assert.equal(
    latest(b, 'health').players[1].health,
    100,
    'Old shot sequences stay rejected across rematches',
  );
  fire(a, 6);
  await until(() => latest(a, 'score').scores[0] === 1);
  assert.deepEqual(latest(a, 'score').scores, [1, 0]);
  assert.equal(latest(a, 'score').round, 1);
  console.log(
    'PASS: two-player consent, same-room fresh rematch, health/ammo reset, old-sequence rejection, paused countdown reconnect and live post-rematch damage.',
  );
} finally {
  clients.forEach((s) => s.terminate());
  await server.close();
}
