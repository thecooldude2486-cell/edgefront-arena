import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
import {
  mapsForTeams,
  teamSpawn,
  chooseVotedMap,
  winningTeam,
  INTERMISSION_MS,
} from '../game/teams.ts';
import { readDeathRecap } from '../game/deathRecap.ts';
const server = createRoomServer({ port: 0 });
await once(server.http, 'listening');
const url = 'ws://127.0.0.1:' + server.http.address().port;
const peers = [],
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  send = (s, m) => s.send(JSON.stringify(m)),
  latest = (s, t = 'teamState') =>
    s.messages.filter((m) => m.type === t).at(-1);
async function until(fn, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (fn()) return;
    await wait(10);
  }
  throw Error('Timed out');
}
async function peer() {
  const s = new WebSocket(url, { origin: 'http://localhost:3000' });
  peers.push(s);
  s.messages = [];
  s.on('message', (data) => {
    const m = JSON.parse(data);
    s.messages.push(m);
    if (m.type === 'netProbe') send(s, { type: 'netAck', id: m.id });
  });
  await once(s, 'open');
  return s;
}
async function create(size) {
  const a = await peer();
  send(a, { type: 'teamCreate', size });
  await until(() => latest(a));
  const all = [a];
  for (let i = 1; i < size * 2; i++) {
    const b = await peer();
    send(b, { type: 'teamJoin', code: latest(a).code });
    await until(() => latest(b));
    all.push(b);
  }
  await until(() => latest(a).phase === 'voting');
  return all;
}
async function start(all, size, map) {
  for (const s of all) send(s, { type: 'teamVote', mapId: map });
  await until(() => latest(all[0]).phase === 'loadout');
  for (const s of all)
    send(s, {
      type: 'teamReady',
      loadout: ['sniper', 'pistol', 'sword', 'grenade'],
    });
  await until(() => latest(all[0]).phase === 'playing');
  assert.equal(latest(all[0]).players.length, size * 2);
}
try {
  assert.equal(INTERMISSION_MS, 3000);
  assert.notDeepEqual(mapsForTeams(1), mapsForTeams(3));
  assert.notDeepEqual(mapsForTeams(3), mapsForTeams(5));
  assert.equal(chooseVotedMap(5, ['harbor', 'citadel', 'citadel']), 'citadel');
  assert.equal(winningTeam([100, 0, 0, 0], 2), 0);
  const all = await create(5),
    a = all[0];
  const overflow = await peer();
  send(overflow, { type: 'teamJoin', code: latest(a).code });
  await until(() => latest(overflow, 'teamError'));
  send(a, { type: 'teamVote', mapId: 'stadium' });
  await wait(60);
  assert.equal(latest(a).votes[0], null, 'Small maps rejected for 5v5');
  await start(all, 5, 'harbor');
  assert.equal(latest(a).mapId, 'harbor');
  assert.equal(
    new Set(latest(a).players.map((p) => JSON.stringify(p.pose))).size,
    10,
    'All ten spawns are distinct',
  );
  // Three aligned people: friendly player is ignored, nearest enemy wins the ray.
  for (const [i, s] of all.entries())
    send(s, {
      type: 'move',
      pose: {
        x: i === 0 || i === 1 || i === 5 || i === 6 ? 0 : 30,
        y: 0.9,
        z:
          i === 0
            ? -28
            : i === 1
              ? -27
              : i === 5
                ? -24
                : i === 6
                  ? -20
                  : 10 + i,
        yaw: i < 5 ? 0 : Math.PI,
        pitch: 0,
      },
    });
  send(a, { type: 'equip', weapon: 'sniper' });
  await wait(150);
  send(a, {
    type: 'effect',
    weapon: 'sniper',
    action: 'fire',
    sequence: 1,
    origin: { x: 0, y: 1.52, z: -28 },
    direction: { x: 0, y: 0, z: 1 },
  });
  await until(() => latest(a).players[5].health === 0);
  assert.equal(latest(a).players[1].health, 100, 'No friendly damage');
  assert.equal(
    latest(a).players[6].health,
    100,
    'Shot cannot pass through the nearest enemy',
  );
  assert.equal(
    latest(a).phase,
    'playing',
    'One elimination does not win a team round',
  );
  const recap = readDeathRecap(latest(all[5]).recap);
  assert.ok(recap);
  assert.equal(recap.killer, 'Player 1');
  assert.equal(recap.finalHit.zone, 'head');
  assert.ok(recap.replay.frames.some((f) => f.shot));
  const paused = all[2],
    token = latest(paused).token;
  paused.terminate();
  await until(() => latest(a).paused);
  const before = latest(a).environment.seconds;
  await wait(200);
  assert.equal(
    latest(a).environment.seconds,
    before,
    'Platforms freeze with the paused room',
  );
  const resumed = await peer();
  send(resumed, { type: 'teamResume', token });
  await until(() => latest(resumed) && !latest(resumed).paused);
  all[2] = resumed;
  assert.equal(latest(resumed).slot, 2);
  assert.equal(
    latest(resumed).players[5].health,
    0,
    'Reconnect retains deaths',
  );
  const time = Date.now();
  for (let i = 6; i < 10; i++)
    send(all[i], {
      type: 'move',
      pose: { x: 30, y: -9, z: 15, yaw: Math.PI, pitch: 0 },
    });
  await until(() => latest(a).phase === 'intermission');
  assert.deepEqual(latest(a).scores, [1, 0]);
  assert.ok(latest(a).deadline - Date.now() <= 3000);
  await wait(2100);
  assert.equal(
    latest(a).phase,
    'intermission',
    'Intermission does not end at 2 seconds',
  );
  await until(() => latest(a).round === 2 && latest(a).phase === 'playing');
  assert.ok(Date.now() - time >= 2900);
  assert.ok(latest(a).players.every((p) => p.health === 100));
  assert.ok(latest(a).environment.barrelHealth.every((h) => h === 45));
  // Direct rockets hit one body for 67 and also splash other enemies for 34, never allies.
  for (const [i, s] of all.entries())
    send(s, {
      type: 'move',
      pose: {
        x: i === 0 || i === 5 ? 0 : i === 1 || i === 6 ? 1 : 30,
        y: 0.9,
        z: i === 0 ? -28 : i === 1 ? -25 : i === 5 || i === 6 ? -24 : 10 + i,
        yaw: i < 5 ? 0 : Math.PI,
        pitch: 0,
      },
    });
  send(a, { type: 'equip', weapon: 'rocketLauncher' });
  await wait(100);
  send(a, {
    type: 'effect',
    action: 'fire',
    weapon: 'rocketLauncher',
    sequence: 2,
    origin: { x: 0, y: 1.05, z: -28 },
    direction: { x: 0, y: 0, z: 1 },
  });
  await until(() => latest(a).players[5].health === 33);
  assert.equal(
    latest(a).players[6].health,
    66,
    'Other enemy takes splash beside a direct rocket hit',
  );
  assert.equal(
    latest(a).players[1].health,
    100,
    'Rocket splash does not damage allies',
  );
  assert.equal(
    latest(a, 'hit').kind,
    'direct',
    'Direct red marker takes precedence over splash markers',
  );
  send(all[1], { type: 'teamLeave' });
  for (let i = 5; i < 10; i++)
    send(all[i], {
      type: 'move',
      pose: { x: 30, y: -9, z: 15, yaw: Math.PI, pitch: 0 },
    });
  await until(() => latest(a).phase === 'intermission');
  await until(() => latest(a).round === 3 && latest(a).phase === 'playing');
  assert.equal(
    latest(a).players[1].health,
    0,
    'Departed seats never become invisible living players on a new round',
  );
  for (let i = 5; i < 10; i++) send(all[i], { type: 'teamLeave' });
  await until(() => latest(a).phase === 'finished');
  assert.equal(latest(a).winner, 0, 'A fully departed team forfeits');
  assert.equal(latest(a).scores[0], 5);
  for (const s of all) send(s, { type: 'teamLeave' });
  for (const size of [1, 2, 3, 4]) {
    const group = await create(size);
    await start(group, size, mapsForTeams(size)[0]);
    assert.equal(latest(group[0]).size, size);
    for (const s of group) send(s, { type: 'teamLeave' });
  }
  console.log(
    'PASS: all 1v1–5v5 capacities, size-specific voting, ten distinct spawns, nearest enemy headshots, direct and area rocket damage, friendly-fire exclusion, team wipe scoring, 3-second intermission, resets, killer replay/stats paused reconnect, departed-seat resets and forfeits.',
  );
} finally {
  peers.forEach((s) => s.terminate());
  await server.close();
}
