import assert from 'node:assert/strict';
const { createDeathRecap, readDeathRecap } =
  await import('../game/deathRecap.ts');
const { WEAPON_DEFINITIONS } = await import('../game/weaponDefinitions.ts');
const { RARITIES } = await import('../game/rarity.ts');
const { rewardAt } = await import('../game/progression.ts');
const { CHARACTER_ITEMS, STORE_COSMETICS } =
  await import('../game/storeCatalog.ts');
for (const weapon of Object.values(WEAPON_DEFINITIONS))
  assert.ok(RARITIES[weapon.rarity]);
for (const item of [...CHARACTER_ITEMS, ...STORE_COSMETICS])
  assert.ok(RARITIES[item.rarity]);
for (let level = 2; level <= 1000; level++)
  assert.ok(RARITIES[rewardAt(level).rarity]);
assert.equal(rewardAt(25).rarity, 'epic');
assert.equal(rewardAt(100).rarity, 'legendary');
assert.equal(rewardAt(500).rarity, 'mythic');
assert.equal(rewardAt(1000000).rarity, 'mythic');
const log = createDeathRecap();
log.record('assaultRifle', 'body', 100, 88, 12);
log.record('assaultRifle', 'head', 88, 73, 12);
log.record('sniper', 'head', 73, 0, 28);
const recap = log.read('Rook', 66, 34);
assert.ok(readDeathRecap(recap));
assert.equal(recap.totalDamage, 100, 'Overkill is capped to actual HP lost');
assert.equal(recap.hits[0].count, 2);
assert.equal(recap.hits[0].headshots, 1);
assert.equal(recap.hits[1].damage, 73);
assert.deepEqual(recap.finalHit, {
  weapon: 'sniper',
  zone: 'head',
  distance: 28,
});
assert.equal(recap.killerHealth, 66);
assert.equal(recap.damageDealt, 34);
log.reset();
assert.equal(log.read('Rook', 100, 0).totalDamage, 0);
assert.equal(recap.totalDamage, 100, 'Saved recap survives respawn/reset');
log.record('rocketLauncher', 'direct', 100, 33, 7);
log.record('grenade', 'splash', 33, 0, 8);
assert.equal(log.read('Player2', 52, 48).finalHit.zone, 'splash');
assert.equal(readDeathRecap({ ...recap, totalDamage: 500 }), null);
assert.equal(
  readDeathRecap({
    ...recap,
    hits: [{ weapon: 'bad', damage: 100, count: 1, headshots: 0 }],
  }),
  null,
);
assert.equal(
  readDeathRecap({ ...recap, finalHit: { ...recap.finalHit, distance: NaN } }),
  null,
);
console.log(
  'PASS: every weapon/character/store/career item has a stable rarity; uncapped milestone tiers; multi-weapon recap, headshots, actual damage, distance, killer HP, reset retention and invalid recap rejection.',
);
