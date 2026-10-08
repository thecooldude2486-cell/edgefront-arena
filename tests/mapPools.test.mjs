import assert from 'node:assert/strict';
import { ARENA_MAPS, MODE_MAPS } from '../game/maps.ts';
import { mapsForTeams, chooseVotedMap, mapScale } from '../game/teams.ts';
const all = [];
for (let size = 1; size <= 5; size++) {
  const pool = mapsForTeams(size);
  assert.equal(pool.length, 5, `${size}v${size} has exactly five maps`);
  assert.equal(new Set(pool).size, 5);
  assert.deepEqual(pool, MODE_MAPS[size]);
  assert.ok(pool.every((id) => ARENA_MAPS[id]));
  all.push(...pool);
  for (const map of pool)
    assert.equal(chooseVotedMap(size, [map, map, null]), map);
  const wrongMode = mapsForTeams(size === 5 ? 1 : size + 1)[0];
  assert.ok(
    pool.includes(chooseVotedMap(size, [wrongMode, wrongMode, null], 3)),
    'Out-of-mode votes cannot select a map',
  );
  const winners = new Set(
    Array.from({ length: 5 }, (_, seed) => chooseVotedMap(size, [], seed)),
  );
  assert.equal(winners.size, 5, 'No-vote ties can select any of the five maps');
  const copy = mapsForTeams(size);
  copy.pop();
  assert.equal(
    mapsForTeams(size).length,
    5,
    'Consumers cannot mutate the shared pool',
  );
}
assert.equal(new Set(all).size, 25, 'Every mode has its own maps');
assert.equal(Object.keys(ARENA_MAPS).length, 25);
assert.ok(mapsForTeams(4).every((id) => mapScale(id) >= 1.6));
assert.ok(mapsForTeams(5).every((id) => mapScale(id) >= 1.75));
console.log(
  'PASS: five unique maps per mode, 25 total, sized arenas, majority/ties, invalid votes and immutable mode pools.',
);
