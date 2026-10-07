import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server = createRoomServer({ port: 0, reconnectGraceMs: 1000 });
await once(server.http, 'listening');
const clients = [],
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  send = (s, m) => s.send(JSON.stringify(m));
const latest = (s, type) => s.messages.filter((m) => m.type === type).at(-1);
async function until(check, timeout = 4000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (check()) return;
    await wait(10);
  }
  throw Error('Timed out');
}
async function connect(resume) {
  const s = new WebSocket('ws://127.0.0.1:' + server.http.address().port, {
    origin: 'http://localhost:3000',
  });
  clients.push(s);
  s.messages = [];
  s.on('message', (data) => {
    const m = JSON.parse(data);
    s.messages.push(m);
    if (m.type === 'netProbe') send(s, { type: 'netAck', id: m.id });
  });
  await once(s, 'open');
  if (resume !== false) {
    send(
      s,
      resume ? { type: 'resume', token: resume } : { type: 'enableResume' },
    );
    await until(() => latest(s, 'session') || latest(s, 'resumeRejected'));
  }
  return s;
}
try {
  let a = await connect(),
    b = await connect();
  send(a, { type: 'create', visibility: 'public' });
  await until(() => latest(a, 'room'));
  const code = latest(a, 'room').code,
    tokenA = latest(a, 'session').token,
    tokenB = latest(b, 'session').token;
  send(b, { type: 'join', code });
  await until(() => latest(b, 'room')?.ready);
  const outsider = await connect(false);
  send(outsider, { type: 'resume', token: tokenA });
  await until(() => latest(outsider, 'resumeRejected'));
  assert.equal(
    latest(outsider, 'room'),
    undefined,
    'Active player cannot be replaced',
  );
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
  await until(() => latest(a, 'move') && latest(b, 'move'));
  send(a, {
    type: 'effect',
    action: 'fire',
    weapon: 'sniper',
    sequence: 1,
    origin: { x: 0, y: 1.05, z: -16 },
    direction: { x: 0, y: 0, z: 1 },
  });
  await until(() => latest(b, 'health')?.players[1].health === 66);
  a.terminate();
  await until(() => latest(b, 'room')?.paused);
  assert.equal(latest(b, 'room').ready, true, 'Reserved seat keeps match open');
  assert.deepEqual(latest(b, 'room').players, [false, true]);
  send(outsider, { type: 'join', code });
  await until(() => latest(outsider, 'error'));
  assert.match(latest(outsider, 'error').message, /full/);
  send(b, {
    type: 'effect',
    action: 'fire',
    weapon: 'sniper',
    sequence: 2,
    origin: { x: 0, y: 1.52, z: -12 },
    direction: { x: 0, y: 0, z: -1 },
  });
  await wait(80);
  assert.equal(
    latest(b, 'health').players[0].health,
    100,
    'Paused opponent cannot be damaged',
  );
  a = await connect(tokenA);
  await until(() => latest(a, 'sync'));
  assert.equal(latest(a, 'session').resumed, true);
  assert.equal(latest(a, 'room').player, 1);
  assert.equal(latest(a, 'room').code, code);
  assert.equal(latest(a, 'room').paused, false);
  assert.equal(latest(a, 'sync').players[0].inventory.sniper.ammo, 4);
  assert.equal(latest(a, 'sync').players[1].health, 66);
  assert.deepEqual(latest(a, 'sync').players[0].loadout, [
    'sniper',
    'uzi',
    'sword',
    'grenade',
  ]);
  assert.equal(latest(a, 'sync').players[0].sequence, 1);
  // Recover either slot, and preserve identity even when both disconnect.
  a.terminate();
  b.terminate();
  await wait(60);
  a = await connect(tokenA);
  assert.equal(latest(a, 'room').paused, true);
  b = await connect(tokenB);
  await until(() => latest(a, 'room')?.paused === false);
  assert.equal(latest(b, 'room').player, 2);
  await until(() => latest(a, 'netStats'), 3000);
  assert.ok(
    latest(a, 'netStats').rttMs >= 0,
    'Server measures round-trip ping',
  );
  b.terminate();
  await until(() => latest(a, 'room')?.paused);
  await until(
    () => latest(a, 'room')?.players[1] === false && !latest(a, 'room')?.ready,
    2500,
  );
  const expired = await connect(tokenB);
  assert.ok(
    latest(expired, 'resumeRejected'),
    'Expired token cannot rejoin old seat',
  );
  const replacement = await connect();
  send(replacement, { type: 'join', code });
  await until(() => latest(replacement, 'room')?.ready);
  assert.equal(
    latest(replacement, 'room').paused,
    false,
    'A replacement guest starts a fresh unpaused match',
  );
  assert.equal(
    latest(replacement, 'room').rematching,
    false,
    'Replacement does not inherit a rematch countdown',
  );
  send(replacement, { type: 'leave' });
  await until(() => latest(replacement, 'left'));
  a.terminate();
  await wait(60);
  a = await connect(tokenA);
  assert.equal(
    latest(a, 'room').ready,
    false,
    'A waiting host restores the same room',
  );
  await wait(160);
  send(replacement, { type: 'join', code });
  await until(() => latest(replacement, 'room')?.ready);
  assert.equal(
    latest(replacement, 'room').paused,
    false,
    'Joining a reconnected waiting host clears the pause',
  );
  // Explicit Leave is immediate, with no reconnect reservation.
  send(a, { type: 'leave' });
  await until(() => latest(a, 'left'));
  const fresh = await connect(false);
  send(fresh, { type: 'join', code });
  await until(() => latest(fresh, 'error'));
  assert.match(latest(fresh, 'error').message, /not found/);
  console.log(
    'PASS: host/guest/both reconnect, same room/player/loadout/health/ammo/sequence, paused damage, reserved public seat, active-token rejection, measured ping, expiry and immediate explicit leave.',
  );
} finally {
  clients.forEach((s) => s.terminate());
  await server.close();
}
