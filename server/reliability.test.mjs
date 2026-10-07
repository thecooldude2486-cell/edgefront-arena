import assert from 'node:assert/strict';
import {
  createHitWorld,
  newCombatPlayer,
  checkCombatEffect,
  equipCombatWeapon,
} from './combat.mjs';
import {
  recordPose,
  historicalPose,
  compensatedPose,
  MAX_REWIND_MS,
  pauseCombat,
  resumeCombat,
  combatSnapshot,
} from './reliability.mjs';
const { readCombatSnapshot } = await import('../game/onlineSnapshot.ts');
const { createMatchXpTracker } = await import('../game/progression.ts');
const world = createHitWorld();
try {
  const target = newCombatPlayer();
  target.ready = true;
  for (let at = 1000; at <= 1400; at += 20)
    recordPose(
      target,
      {
        x: at <= 1250 ? 0 : (4 * (at - 1250)) / 150,
        y: 0.9,
        z: -12,
        yaw: Math.PI,
        pitch: 0,
      },
      at,
    );
  assert.equal(historicalPose(target, 999), null);
  assert.ok(historicalPose(target, 1300).x > 0);
  const socket = { rttMs: 160, lastNetAck: 1400 },
    past = compensatedPose(target, socket, 1400);
  assert.deepEqual(
    past,
    historicalPose(target, 1400 - 160 - 70),
    'Rewind includes outbound view and inbound shot travel plus smoothing',
  );
  assert.ok(past.x < 0.2);
  assert.equal(
    compensatedPose(target, { rttMs: 99999, lastNetAck: 1400 }, 1400).x,
    historicalPose(target, 1400 - MAX_REWIND_MS).x,
  );
  assert.equal(
    compensatedPose(target, { rttMs: 160, lastNetAck: 0 }, 12000),
    target.pose,
    'Stale ping does not rewind',
  );
  const effect = {
    action: 'fire',
    weapon: 'sniper',
    origin: { x: 0, y: 1.52, z: -16 },
    direction: { x: 0, y: 0, z: 1 },
  };
  function shooter() {
    const p = newCombatPlayer();
    p.ready = true;
    p.pose = { x: 0, y: 0.9, z: -16, yaw: 0, pitch: 0 };
    equipCombatWeapon(p, 'sniper', 1400);
    return p;
  }
  assert.equal(
    checkCombatEffect(shooter(), target, effect, 1, 1400, world),
    true,
  );
  assert.equal(target.health, 100, 'Latest pose misses the moving target');
  let marker;
  assert.equal(
    checkCombatEffect(
      shooter(),
      target,
      effect,
      1,
      1400,
      world,
      (kind) => (marker = kind),
      past,
    ),
    true,
  );
  assert.equal(target.health, 0);
  assert.equal(marker, 'head', 'Rewound sniper shot hits the visible head');
  target.health = 100;
  const melee = shooter();
  equipCombatWeapon(melee, 'sword', 1400);
  assert.equal(
    checkCombatEffect(
      melee,
      target,
      { ...effect, weapon: 'sword' },
      1,
      1400,
      world,
      () => {},
      past,
    ),
    true,
  );
  assert.equal(target.health, 100, 'Melee cannot borrow historic reach');
  // Arena cover is still authoritative in historical queries.
  assert.equal(
    world.hit(
      { x: 0, y: 1.52, z: -16 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0.9, z: 17, yaw: 0, pitch: 0 },
      200,
    ),
    null,
  );
  const p = shooter();
  p.performance.reset(1000);
  p.lastShot = 1390;
  p.ammo = 3;
  p.reloadAt = 2500;
  p.projectiles = [{}];
  p.fires = [{}];
  pauseCombat(p);
  assert.equal(p.reloadAt, 0);
  assert.equal(p.projectiles.length, 0);
  resumeCombat(p, 3000, 4400);
  const snapshot = combatSnapshot(p, 4400);
  assert.equal(snapshot.inventory.sniper.ammo, 3);
  assert.ok(snapshot.inventory.sniper.cooldownMs > 0);
  assert.ok(readCombatSnapshot(snapshot));
  assert.equal(
    p.performance.read(100, 4400).seconds,
    0.4,
    'Paused time excluded from quick-kill XP',
  );
  const tracker = createMatchXpTracker();
  tracker.begin([3, 1]);
  assert.equal(
    tracker.update([3, 1], 'none', 'online'),
    0,
    'Restored score grants no past XP',
  );
  assert.ok(tracker.update([4, 1], 'none', 'online') > 0);
  for (let at = 1401; at < 3000; at++)
    recordPose(p, { x: 0, y: 0.9, z: 0, yaw: 0, pitch: 0 }, at);
  assert.ok(p.history.length <= 64);
  console.log(
    'PASS: bounded server latency rewind, moving headshot, current-pose melee/cover, history bounds, pause cleanup, ammo/cooldown sync, no pause XP or replayed score XP.',
  );
} finally {
  world.dispose();
}
