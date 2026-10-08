import assert from 'node:assert/strict';
import { createTeamRooms } from './teamRooms.mjs';
import { mapsForTeams } from '../game/teams.ts';
const manager = createTeamRooms((peer, message) =>
  peer.messages.push(structuredClone(message)),
);
const peer = () => ({ messages: [] });
const latest = (p) => p.messages.filter((m) => m.type === 'teamState').at(-1);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  const end = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > end) throw Error('Vote did not finish');
    await wait(10);
  }
}
try {
  for (let size = 1; size <= 5; size++) {
    const players = Array.from({ length: size * 2 }, peer),
      outsider = peer(),
      pool = mapsForTeams(size);
    manager.handle(players[0], { type: 'teamCreate', size });
    const room = manager.rooms.get(players[0].teamCode);
    for (const p of players.slice(1))
      manager.handle(p, { type: 'teamJoin', code: room.code });
    assert.equal(room.phase, 'voting');
    assert.ok(room.deadline > Date.now());
    const invalid = mapsForTeams(size === 5 ? 1 : size + 1)[0];
    manager.handle(players[0], { type: 'teamVote', mapId: invalid });
    manager.handle(outsider, {
      type: 'teamVote',
      code: room.code,
      mapId: pool[4],
    });
    assert.deepEqual(
      room.votes,
      Array(size * 2).fill(null),
      'Invalid-mode and outsider votes rejected',
    );
    manager.handle(players[0], { type: 'teamVote', mapId: pool[0] });
    manager.handle(players[0], { type: 'teamVote', mapId: pool[4] });
    assert.equal(
      room.votes[0],
      pool[4],
      'Changing a vote replaces it; it never adds another vote',
    );
    assert.equal(
      latest(players.at(-1)).votes[0],
      pool[4],
      'Every participant sees the vote count',
    );
    room.pausedAt = Date.now();
    manager.handle(players[0], { type: 'teamVote', mapId: pool[1] });
    assert.equal(
      room.votes[0],
      pool[4],
      'Voting remains frozen during reconnect pause',
    );
    room.pausedAt = null;
    for (const p of players.slice(1))
      manager.handle(p, { type: 'teamVote', mapId: pool[4] });
    assert.equal(room.phase, 'loadout');
    assert.equal(room.mapId, pool[4]);
    assert.equal(room.deadline, null);
    for (const p of players)
      assert.equal(
        latest(p).mapId,
        pool[4],
        'All participants receive the same result',
      );
    manager.handle(players[0], { type: 'teamVote', mapId: pool[0] });
    assert.equal(
      room.mapId,
      pool[4],
      'Finished votes cannot change the selected map',
    );
    // Exercise server timer resolution for ties and abstentions without a ten-second test sleep.
    room.phase = 'voting';
    room.votes.fill(null);
    room.votes[0] = pool[1];
    room.deadline = Date.now() - 1;
    await until(() => room.phase === 'loadout');
    assert.equal(room.mapId, pool[1], 'A single vote beats abstentions');
    room.phase = 'voting';
    room.votes.fill(null);
    room.votes[0] = pool[0];
    room.votes[1] = pool[1];
    room.deadline = Date.now() - 1;
    await until(() => room.phase === 'loadout');
    assert.ok(
      [pool[0], pool[1]].includes(room.mapId),
      'Timed ties select a tied map',
    );
    room.phase = 'voting';
    room.votes.fill(null);
    room.deadline = Date.now() - 1;
    await until(() => room.phase === 'loadout');
    assert.ok(
      pool.includes(room.mapId),
      'Empty votes stay in the current mode',
    );
    room.phase = 'finished';
    room.combat.forEach((p) => (p.ready = false));
    for (const p of players) manager.handle(p, { type: 'teamRematch' });
    assert.equal(room.phase, 'voting');
    assert.deepEqual(
      room.votes,
      Array(size * 2).fill(null),
      'Rematch starts fresh voting',
    );
    players.forEach((p) => manager.handle(p, { type: 'teamLeave' }));
  }
  console.log(
    'PASS: online voting in 1v1–5v5, five options, live replacement/counts, mode/outsider validation, pause/timeout/majority/ties/no-votes and fresh rematch voting.',
  );
} finally {
  manager.close();
}
