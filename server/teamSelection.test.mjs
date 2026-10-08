import assert from 'node:assert/strict';
import { createTeamRooms } from './teamRooms.mjs';
import {
  selectTeamSlot,
  teamOf,
  teamSpawn,
  mapsForTeams,
} from '../game/teams.ts';
const peer = () => ({ messages: [] });
const latest = (p, type = 'teamState') =>
  p.messages.filter((m) => m.type === type).at(-1);
const manager = createTeamRooms((p, m) => p.messages.push(structuredClone(m)));
function create(size, team = 'auto') {
  const p = peer();
  manager.handle(p, { type: 'teamCreate', size, team });
  return [p, manager.rooms.get(p.teamCode)];
}
function join(r, team = 'auto') {
  const p = peer();
  manager.handle(p, { type: 'teamJoin', code: r.code, team });
  return p;
}
try {
  for (let size = 2; size <= 5; size++) {
    const [cyanHost, cyanRoom] = create(size, 0);
    assert.equal(latest(cyanHost).slot, 0, 'Host chooses Cyan before creating');
    assert.equal(teamOf(latest(cyanHost).slot, size), 0);
    manager.handle(cyanHost, { type: 'teamChoose', team: 1 });
    assert.equal(
      latest(cyanHost).slot,
      size,
      'Host can switch to Coral in the waiting lobby',
    );
    manager.handle(cyanHost, { type: 'teamChoose', team: 0 });
    assert.equal(latest(cyanHost).slot, 0, 'Host can switch back to Cyan');
    manager.handle(cyanHost, { type: 'teamLeave' });
    assert.equal(manager.rooms.has(cyanRoom.code), false);
    assert.equal(selectTeamSlot(Array(size * 2).fill(null), size, 1), size);
    assert.equal(
      selectTeamSlot(
        [...Array(size).fill('reserved'), ...Array(size).fill(null)],
        size,
        0,
      ),
      size,
    );
    assert.equal(selectTeamSlot(Array(size * 2).fill('taken'), size, 1), -1);
    const [creator, r] = create(size, 1);
    assert.equal(latest(creator).slot, size, 'Creator chooses Coral');
    const players = [creator];
    for (let i = 1; i < size; i++) players.push(join(r, 1));
    assert.equal(r.tokens.slice(size).filter(Boolean).length, size);
    const fallback = join(r, 1);
    players.push(fallback);
    assert.equal(
      teamOf(latest(fallback).slot, size),
      0,
      'Full preferred team automatically assigns other team',
    );
    assert.match(latest(fallback, 'teamNotice').message, /Coral is full.*Cyan/);
    assert.equal(r.phase, 'waiting');
    for (let i = 1; i < size; i++) players.push(join(r, 1));
    assert.equal(
      r.phase,
      'voting',
      'Map voting starts only when both teams reach capacity',
    );
    assert.deepEqual(
      [
        r.tokens.slice(0, size).filter(Boolean).length,
        r.tokens.slice(size).filter(Boolean).length,
      ],
      [size, size],
    );
    assert.equal(new Set(players.map((p) => latest(p).slot)).size, size * 2);
    const overflow = join(r, 0);
    assert.ok(latest(overflow, 'teamError'), 'Full rooms reject overflow');
    for (const phase of [
      'voting',
      'loadout',
      'countdown',
      'playing',
      'intermission',
      'finished',
    ]) {
      r.phase = phase;
      const original = latest(creator).slot;
      manager.handle(creator, { type: 'teamChoose', team: 0 });
      assert.equal(
        r.peers.indexOf(creator),
        original,
        'Team changes are locked after voting begins',
      );
    }
    r.phase = 'waiting';
    players.forEach((p) => manager.handle(p, { type: 'teamLeave' }));
  }
  const [a, r] = create(3, 0);
  const b = join(r, 0);
  manager.handle(a, { type: 'teamName', name: 'Acepilot' });
  manager.handle(a, {
    type: 'teamProfile',
    profile: { level: 12, cosmetics: { skin: null, wrap: null, charm: null } },
  });
  const oldSlot = r.peers.indexOf(a),
    oldToken = latest(a).token,
    oldCombat = r.combat[oldSlot];
  r.kills[oldSlot] = 3;
  r.deaths[oldSlot] = 1;
  manager.handle(a, { type: 'teamChoose', team: 1 });
  const moved = latest(a).slot;
  assert.equal(moved, 3);
  assert.equal(r.tokens[oldSlot], null, 'Old team seat is freed');
  assert.equal(r.peers[oldSlot], null);
  assert.equal(latest(a).token, oldToken, 'Switch preserves session identity');
  assert.equal(
    r.combat[moved],
    oldCombat,
    'Switch preserves combat/loadout state',
  );
  assert.equal(latest(a).players[moved].name, 'Acepilot');
  assert.equal(latest(a).players[moved].profile.level, 12);
  assert.equal(latest(a).players[moved].kills, 3);
  assert.equal(latest(a).players[moved].deaths, 1);
  assert.equal(
    latest(b).players[moved].name,
    'Acepilot',
    'All other clients receive updated team roster',
  );
  manager.disconnect(a);
  assert.equal(
    latest(b).players[moved].occupied,
    true,
    'Disconnected seat stays reserved',
  );
  const c = join(r, 1),
    d = join(r, 1),
    e = join(r, 1);
  assert.equal(latest(c).slot, 4);
  assert.equal(latest(d).slot, 5);
  assert.equal(
    teamOf(latest(e).slot, 3),
    0,
    'Held reconnect seat cannot be stolen even with preferred team',
  );
  const resumed = peer();
  manager.handle(resumed, { type: 'teamResume', token: oldToken });
  assert.equal(
    latest(resumed).slot,
    moved,
    'Resume token follows switched team',
  );
  assert.equal(latest(resumed).players[moved].name, 'Acepilot');
  assert.equal(r.peers[moved], resumed);
  manager.handle(resumed, { type: 'teamChoose', team: 0 });
  assert.equal(
    r.peers.indexOf(resumed),
    moved,
    'Switch blocked during reconnect pause',
  );
  r.pausedAt = null;
  r.phase = 'waiting';
  [b, c, d, e, resumed].forEach((p) =>
    manager.handle(p, { type: 'teamLeave' }),
  );
  const [f, fullTeamRoom] = create(2, 0);
  const g = join(fullTeamRoom, 1),
    h = join(fullTeamRoom, 1);
  manager.handle(f, { type: 'teamChoose', team: 1 });
  assert.equal(
    fullTeamRoom.peers.indexOf(f),
    0,
    'Choosing full team keeps you on the other team',
  );
  assert.match(latest(f, 'teamNotice').message, /Coral is full.*Cyan/);
  manager.handle(f, { type: 'teamChoose', team: 99 });
  assert.equal(
    fullTeamRoom.peers.indexOf(f),
    0,
    'Invalid team choice has no effect',
  );
  // Repeated join messages cannot duplicate an already seated player.
  manager.handle(f, { type: 'teamJoin', code: fullTeamRoom.code, team: 1 });
  assert.equal(fullTeamRoom.tokens.filter(Boolean).length, 3);
  [f, g, h].forEach((p) => manager.handle(p, { type: 'teamLeave' }));
  const [solo, duel] = create(1, 1);
  assert.equal(
    latest(solo).slot,
    0,
    '1v1 still assigns opposing sides automatically',
  );
  manager.handle(solo, { type: 'teamChoose', team: 1 });
  assert.equal(duel.peers.indexOf(solo), 0);
  const opponent = join(duel, 0);
  assert.equal(latest(opponent).slot, 1);
  [solo, opponent].forEach((p) => manager.handle(p, { type: 'teamLeave' }));
  const [coralHost, matchRoom] = create(2, 1);
  const matchPlayers = [
    coralHost,
    join(matchRoom, 0),
    join(matchRoom, 1),
    join(matchRoom, 1),
  ];
  const map = mapsForTeams(2)[0];
  for (const p of matchPlayers)
    manager.handle(p, { type: 'teamVote', mapId: map });
  assert.equal(matchRoom.phase, 'loadout');
  for (const p of matchPlayers)
    manager.handle(p, {
      type: 'teamReady',
      loadout: ['sniper', 'pistol', 'sword', 'grenade'],
    });
  assert.equal(matchRoom.phase, 'countdown');
  matchRoom.deadline = Date.now() - 1;
  const end = Date.now() + 4000;
  while (matchRoom.phase !== 'playing' && Date.now() < end)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(matchRoom.phase, 'playing');
  assert.equal(latest(coralHost).slot, 2);
  for (const p of matchPlayers) {
    const state = latest(p),
      own = state.players[state.slot];
    assert.deepEqual(
      own.pose,
      teamSpawn(state.slot, 2, map),
      'Chosen team determines the actual match spawn',
    );
    assert.equal(own.health, 100);
    assert.deepEqual(matchRoom.combat[state.slot].loadout, [
      'sniper',
      'pistol',
      'sword',
      'grenade',
    ]);
  }
  matchPlayers.forEach((p) => manager.handle(p, { type: 'teamLeave' }));
  console.log(
    'PASS: online team preferences 2v2–5v5, creator/joiner choice, full-team fallback, capacity, waiting-lobby switches, identity/profile/stats/resume preservation, reserved seats, phase locks, duplicate joins and unchanged 1v1.',
  );
} finally {
  manager.close();
}
