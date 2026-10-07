import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
const { createOrbWallet, WALLET_STORAGE_KEY } =
  await import('../game/createOrbWallet.ts');
const { ORBS_STORAGE_KEY } = await import('../game/createOrbRewards.ts');
const { createProgression, readPlayerProfile, rewardAt } =
  await import('../game/progression.ts');
const { DEFAULT_CHARACTER } = await import('../game/storeCatalog.ts');
const storage = (orbs = 1000) => {
  const data = new Map([[ORBS_STORAGE_KEY, String(orbs)]]);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
};
let date = new Date(2026, 9, 7, 12);
const clock = () => date;
const save = storage(),
  wallet = createOrbWallet(save, false, clock);
assert.equal(wallet.state.orbs, 1000, 'Legacy Orbs survive');
assert.equal(
  wallet.equipCharacter('solar'),
  false,
  'Paid gear cannot be equipped while locked',
);
assert.equal(wallet.buyCharacter('solar'), 'purchased');
assert.equal(wallet.state.orbs, 800);
assert.equal(wallet.buyCharacter('solar'), 'owned');
assert.equal(wallet.equipCharacter('solar'), true);
assert.deepEqual(createOrbWallet(save).state.character, {
  ...DEFAULT_CHARACTER,
  suit: 'solar',
});
assert.equal(wallet.buyCosmetic(-6), 'purchased');
assert.equal(wallet.state.orbs, 620);
const career = createProgression(save, () => wallet.state.cosmeticOwned);
assert.equal(
  career.equip('wrap', -6),
  true,
  'Owned shop wraps work at career level 1',
);
assert.equal(
  career.equip('skin', -4),
  false,
  'Unowned store skin stays locked',
);
assert.equal(
  career.equip('wrap', 3),
  false,
  'Career unlock requirements still apply',
);
assert.equal(
  createProgression(save, () => wallet.state.cosmeticOwned).state.cosmetics
    .wrap,
  -6,
);
assert.ok(rewardAt(-6).name.includes('Prism'));
assert.equal(
  createProgression(save).state.cosmetics.wrap,
  null,
  'Shop cosmetics require ownership when loading',
);
assert.equal(wallet.claimDaily().result, 'claimed');
assert.equal(wallet.state.orbs, 670);
assert.equal(wallet.claimDaily().result, 'already');
assert.equal(wallet.state.dailyClaims, 1);
date = new Date(2026, 9, 10, 12);
assert.equal(
  wallet.dailyStatus().day,
  2,
  'Missed days preserve the reward sequence',
);
assert.equal(wallet.claimDaily('wrap').result, 'claimed');
assert.ok(wallet.state.cosmeticOwned.includes(-2));
for (let day = 3; day <= 7; day++) {
  date = new Date(2026, 9, day + 8, 12);
  assert.equal(wallet.dailyStatus().day, day);
  assert.equal(wallet.claimDaily().result, 'claimed');
}
assert.equal(wallet.state.dailyClaims, 7);
assert.equal(wallet.state.orbs, 1120);
assert.ok(
  ['ice', 'signal', 'aurora'].every((id) =>
    wallet.state.characterOwned.includes(id),
  ),
);
assert.equal(wallet.dailyStatus().available, false);
date = new Date(2026, 9, 16, 12);
assert.equal(wallet.dailyStatus().day, 8);
assert.equal(wallet.dailyStatus().recurring, true);
assert.equal(wallet.dailyStatus().available, true);
wallet.claimDaily();
date = new Date(2026, 9, 17, 12);
wallet.claimDaily('wrap');
assert.equal(
  wallet.state.orbs,
  1320,
  'After starter rewards, each new day gives one 100-Orb supply',
);
date = new Date(2026, 9, 15, 12);
assert.equal(
  wallet.claimDaily().result,
  'already',
  'Rolling clock backwards cannot claim again',
);
for (const [choice, id] of [
  ['weapon', null],
  ['skin', -1],
  ['wrap', -2],
  ['charm', -3],
]) {
  const local = storage(0),
    w = createOrbWallet(local, false, clock);
  date = new Date(2026, 9, 20, 23, 59);
  w.claimDaily();
  date = new Date(2026, 9, 21, 0, 0);
  assert.equal(w.claimDaily(choice).result, 'claimed');
  assert.equal(
    id === null ? w.state.uziOwned : w.state.cosmeticOwned.includes(id),
    true,
    choice + ' unlock saved',
  );
  assert.equal(createOrbWallet(local).state.dailyClaims, 2);
}
const shared = storage(),
  first = createOrbWallet(shared, false, clock),
  second = createOrbWallet(shared, false, clock);
first.claimDaily();
assert.equal(
  second.claimDaily().result,
  'already',
  'Two open instances cannot claim the same day',
);
first.buyCharacter('prism');
second.buyCharacter('halo');
const merged = createOrbWallet(shared).state;
assert.ok(
  merged.characterOwned.includes('prism') &&
    merged.characterOwned.includes('halo'),
);
assert.equal(merged.orbs, 550, 'Purchases refresh before spending');
const broken = storage();
const bad = createOrbWallet(
  {
    ...broken,
    setItem() {
      throw Error('blocked');
    },
  },
  false,
  clock,
);
assert.equal(bad.buyCharacter('solar'), 'unavailable');
assert.equal(bad.buyCosmetic(-6), 'unavailable');
assert.equal(bad.claimDaily().result, 'unavailable');
assert.equal(bad.state.orbs, 1000);
assert.equal(bad.state.dailyClaims, 0);
assert.deepEqual(bad.state.characterOwned, []);
const corrupted = storage();
corrupted.setItem(
  WALLET_STORAGE_KEY,
  JSON.stringify({
    orbs: 200,
    sniperOwned: true,
    characterOwned: ['wrong'],
    character: { suit: 'solar', visor: 'wrong', gear: 'halo' },
    cosmeticOwned: [2, -1000],
    dailyClaims: -1,
    lastClaim: 'junk',
  }),
);
const cleaned = createOrbWallet(corrupted).state;
assert.equal(cleaned.sniperOwned, true);
assert.deepEqual(cleaned.character, DEFAULT_CHARACTER);
assert.deepEqual(cleaned.cosmeticOwned, []);
assert.equal(cleaned.dailyClaims, 0);
const profile = readPlayerProfile({
  level: 1,
  cosmetics: { skin: -1, wrap: -6, charm: -3 },
  character: { suit: 'prism', visor: 'violet', gear: 'halo' },
});
assert.deepEqual(profile.character, {
  suit: 'prism',
  visor: 'violet',
  gear: 'halo',
});
assert.deepEqual(profile.cosmetics, { skin: -1, wrap: -6, charm: -3 });
assert.deepEqual(
  readPlayerProfile({
    level: 1,
    character: { suit: 'bad', visor: 'bad', gear: 'bad' },
  }).character,
  DEFAULT_CHARACTER,
);
console.log(
  'PASS: saved shop purchases/equipment, legacy balance, cosmetic ownership, all day 2 choices, one-time seven-day track and ongoing supply, midnight/missed-day/clock rollback, duplicate rewards, stale tabs and atomic save failure.',
);
