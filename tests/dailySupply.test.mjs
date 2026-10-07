import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
const { createOrbWallet, WALLET_STORAGE_KEY } =
  await import('../game/createOrbWallet.ts');
const { DAILY_SUPPLIES } = await import('../game/storeCatalog.ts');
let now = new Date(2026, 9, 20, 12),
  random = 0;
const clock = () => now,
  roll = () => random;
function storage(overrides = {}) {
  const values = new Map([
    [
      WALLET_STORAGE_KEY,
      JSON.stringify({
        orbs: 1000,
        dailyClaims: 7,
        lastClaim: '2026-10-19',
        sniperOwned: true,
        ...overrides,
      }),
    ],
  ]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
const save = storage(),
  wallet = createOrbWallet(save, false, clock, roll);
assert.equal(wallet.dailyStatus().recurring, true);
assert.equal(wallet.dailyStatus().reward.name, '100 Orbs');
assert.equal(wallet.rerollDaily().result, 'changed');
assert.equal(wallet.state.orbs, 975);
assert.equal(wallet.dailyStatus().offer.id, 'amber');
assert.deepEqual(
  wallet.state.characterOwned,
  [],
  'Reroll reveals a reward without granting it',
);
assert.equal(wallet.dailyStatus().rerollCost, 25);
assert.equal(wallet.dailyStatus().upgradeCost, 75);
const reloaded = createOrbWallet(save, false, clock, roll);
assert.equal(
  reloaded.dailyStatus().offer.id,
  'amber',
  'Paid selection persists through refresh',
);
assert.equal(reloaded.upgradeDaily().result, 'changed');
assert.equal(reloaded.state.orbs, 900);
assert.equal(reloaded.dailyStatus().tier, 'Enhanced');
assert.equal(reloaded.dailyStatus().offer.id, 'orbs200');
random = 0.99;
assert.equal(reloaded.rerollDaily().result, 'changed');
assert.equal(reloaded.state.orbs, 860);
assert.equal(reloaded.dailyStatus().offer.id, 'optic');
assert.equal(reloaded.upgradeDaily().result, 'changed');
assert.equal(reloaded.state.orbs, 735);
assert.equal(reloaded.dailyStatus().tier, 'Elite');
assert.equal(reloaded.dailyStatus().offer.id, 'uzi');
assert.equal(reloaded.upgradeDaily().result, 'maximum');
assert.equal(reloaded.state.orbs, 735);
assert.equal(reloaded.claimDaily('skin').result, 'claimed');
assert.equal(reloaded.state.uziOwned, true);
assert.equal(reloaded.state.dailyClaims, 8);
assert.equal(
  reloaded.dailyStatus().offer.id,
  'uzi',
  'Claimed reward stays visible for today',
);
assert.equal(reloaded.claimDaily().result, 'already');
assert.equal(reloaded.rerollDaily().result, 'already');
assert.equal(reloaded.upgradeDaily().result, 'already');
assert.equal(reloaded.state.orbs, 735);
assert.equal(
  wallet.claimDaily().result,
  'already',
  'A stale second instance cannot claim a paid supply twice',
);
now = new Date(2026, 9, 21, 0, 0);
assert.equal(
  reloaded.dailyStatus().offer.id,
  'orbs100',
  'Tomorrow starts with the single free reward',
);
assert.equal(reloaded.dailyStatus().tier, 'Standard');
assert.equal(reloaded.claimDaily().result, 'claimed');
assert.equal(reloaded.state.orbs, 835);
assert.equal(reloaded.state.dailyClaims, 9);
assert.equal(reloaded.dailyStatus().day, 8, 'Starter days never restart');
const old = storage({ dailyClaims: 14 });
const migrated = createOrbWallet(old, false, clock, roll);
assert.equal(migrated.dailyStatus().recurring, true);
assert.equal(migrated.dailyStatus().offer.id, 'orbs100');
assert.equal(migrated.state.sniperOwned, true);
migrated.claimDaily();
assert.equal(migrated.state.dailyClaims, 15);
assert.equal(
  migrated.state.orbs,
  1100,
  'Older looping saves continue as ongoing supplies',
);
const starter = createOrbWallet(
  storage({ dailyClaims: 6 }),
  false,
  clock,
  roll,
);
assert.equal(starter.rerollDaily().result, 'unavailable');
assert.equal(starter.upgradeDaily().result, 'unavailable');
assert.equal(starter.state.orbs, 1000);
const poor = createOrbWallet(storage({ orbs: 24 }), false, clock, roll);
assert.equal(poor.rerollDaily().result, 'insufficient');
assert.equal(poor.upgradeDaily().result, 'insufficient');
assert.equal(poor.state.dailyOffer, null);
assert.equal(poor.state.orbs, 24);
const brokenSave = storage(),
  broken = createOrbWallet(
    {
      ...brokenSave,
      setItem() {
        throw Error('blocked');
      },
    },
    false,
    clock,
    roll,
  );
for (const method of ['rerollDaily', 'upgradeDaily', 'claimDaily'])
  assert.equal(broken[method]().result, 'unavailable');
assert.equal(broken.state.orbs, 1000);
assert.equal(broken.state.dailyClaims, 7);
assert.equal(broken.state.dailyOffer, null);
for (const reward of DAILY_SUPPLIES) {
  const owned = storage({
    characterOwned: ['amber', 'prism', 'halo'],
    cosmeticOwned: [-1, -2, -3, -5, -8],
    uziOwned: true,
    dailyOffer: { date: '2026-10-21', rewardId: reward.id },
  });
  const w = createOrbWallet(owned, false, clock, roll),
    before = w.state.orbs;
  assert.equal(w.claimDaily().result, 'claimed');
  assert.equal(
    w.state.orbs - before,
    [0, 100, 200, 350][reward.tier],
    reward.name + ' grants currency or duplicate compensation',
  );
  const rerollWallet = createOrbWallet(
    storage({ dailyOffer: { date: '2026-10-21', rewardId: reward.id } }),
    false,
    clock,
    roll,
  );
  assert.equal(rerollWallet.rerollDaily().result, 'changed');
  assert.equal(rerollWallet.dailyStatus().offer.tier, reward.tier);
  assert.notEqual(
    rerollWallet.dailyStatus().offer.id,
    reward.id,
    'Reroll always reveals a different reward',
  );
}
for (const reward of DAILY_SUPPLIES.filter(
  (reward) => reward.character || reward.cosmetic,
)) {
  const w = createOrbWallet(
    storage({ dailyOffer: { date: '2026-10-21', rewardId: reward.id } }),
    false,
    clock,
    roll,
  );
  w.claimDaily();
  assert.equal(
    reward.character
      ? w.state.characterOwned.includes(reward.character)
      : w.state.cosmeticOwned.includes(reward.cosmetic),
    true,
    reward.name + ' unlocks permanently',
  );
  assert.equal(w.state.orbs, 1000);
}
const damaged = createOrbWallet(
  storage({ dailyOffer: { date: '2026-10-21', rewardId: 'fake' } }),
  false,
  clock,
  roll,
);
assert.equal(damaged.dailyStatus().offer.id, 'orbs100');
now = new Date(2026, 9, 20, 12);
assert.equal(reloaded.claimDaily().result, 'already');
assert.equal(
  reloaded.rerollDaily().result,
  'already',
  'Clock rollback cannot open a new paid offer',
);
console.log(
  'PASS: one-time starter track/migration, daily supply persistence/reset, paid rerolls/upgrades, no repeated roll, all gear/duplicate payouts, max tier, stale claims, insufficient funds, clock rollback and atomic failures.',
);
