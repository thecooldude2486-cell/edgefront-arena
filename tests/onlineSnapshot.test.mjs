import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import { NullEngine, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
const { createWeapon } = await import('../game/createWeapon.ts');
const { WEAPON_DEFINITIONS } = await import('../game/weaponDefinitions.ts');
const { readCombatSnapshot, readOnlineLoadout } =
  await import('../game/onlineSnapshot.ts');
const inventory = Object.fromEntries(
  Object.entries(WEAPON_DEFINITIONS).map(([id, stats]) => [
    id,
    { ammo: stats.magazineSize, reserve: stats.reserveAmmo, cooldownMs: 0 },
  ]),
);
inventory.sniper = { ammo: 2, reserve: 9, cooldownMs: 200 };
inventory.laserCannon.ammo = 96.25;
const snapshot = {
  health: 66,
  weapon: 'sniper',
  ready: true,
  sequence: 14,
  pose: { x: 1, y: 0.9, z: 2, yaw: 0, pitch: 0 },
  loadout: ['sniper', 'uzi', 'sword', 'grenade'],
  inventory,
};
assert.ok(readCombatSnapshot(snapshot));
assert.equal(
  readCombatSnapshot({
    ...snapshot,
    inventory: { ...inventory, sniper: { ammo: 6, reserve: 9, cooldownMs: 0 } },
  }),
  null,
);
assert.equal(readCombatSnapshot({ ...snapshot, sequence: -2 }), null);
assert.equal(readOnlineLoadout(['sword', 'uzi', 'sword', 'grenade']), null);
let now = 1000;
Object.defineProperty(globalThis, 'performance', {
  value: { now: () => now },
  configurable: true,
});
const canvas = new EventTarget();
globalThis.window = new EventTarget();
window.setTimeout = setTimeout;
globalThis.document = new EventTarget();
document.pointerLockElement = canvas;
const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
globalThis.AudioContext = class {
  currentTime = 0;
  state = 'running';
  destination = {};
  createOscillator() {
    return {
      frequency: param,
      connect() {
        return this;
      },
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      gain: param,
      connect() {
        return this;
      },
    };
  }
  close() {
    return Promise.resolve();
  }
};
const engine = new NullEngine(),
  scene = new Scene(engine),
  camera = new UniversalCamera('test', Vector3.Zero(), scene);
let primary = 'sniper',
  hud,
  shots = 0;
const weapon = createWeapon(scene, camera, canvas, {
  getPrimaryWeapon: () => primary,
  canUseWeapon: () => true,
  onAmmoChange: (ammo, reserve, _, id) => (hud = { ammo, reserve, id }),
  onVisualShot: () => shots++,
  onImpact: () => 'none',
  onHitMarker() {},
});
weapon.setActive(false);
weapon.restoreOnlineInventory(snapshot.inventory, snapshot.weapon);
assert.deepEqual(hud, { ammo: 2, reserve: 9, id: 'sniper' });
weapon.setActive(true);
const click = new Event('mousedown');
Object.assign(click, { button: 0 });
canvas.dispatchEvent(click);
assert.equal(shots, 0, 'Restored cooldown prevents an early shot');
now += 201;
canvas.dispatchEvent(click);
assert.equal(shots, 1);
assert.equal(hud.ammo, 1, 'Restored magazine, not a fresh full magazine');
primary = 'laserCannon';
weapon.selectWeapon('laserCannon');
assert.equal(
  hud.ammo,
  96,
  'Fractional energy is restored and displayed rounded down',
);
weapon.dispose();
scene.dispose();
engine.dispose();
console.log(
  'PASS: validated authoritative inventory/loadout, held weapon, magazine/reserve/energy and cooldown restoration without a free refill.',
);
