import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) {
  if (s.startsWith('@babylonjs/core/') && !s.endsWith('.js')) return next(s + '.js', c);
  if (s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(s + '.ts', c);
  return next(s, c);
}});
const { createOrbWallet, WALLET_STORAGE_KEY, UZI_PRICE } = await import('../game/createOrbWallet.ts');
const { WEAPON_DEFINITIONS, applyWeaponDamage } = await import('../game/weaponDefinitions.ts');
const { createWeapon } = await import('../game/createWeapon.ts');
const { NullEngine, Scene, UniversalCamera, Vector3 } = await import('@babylonjs/core');
const values = new Map([[WALLET_STORAGE_KEY, JSON.stringify({ orbs: 299, sniperOwned: true, rocketOwned: true, molotovOwned: true, orbClicks: 20 })]]);
const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
const wallet = createOrbWallet(storage);
assert.equal(UZI_PRICE, 300); assert.equal(wallet.state.uziOwned, false);
assert.equal(wallet.buyUzi(), 'insufficient'); wallet.award(1);
assert.equal(wallet.buyUzi(), 'purchased'); assert.equal(wallet.state.orbs, 0);
assert.equal(wallet.buyUzi(), 'owned'); assert.equal(createOrbWallet(storage).state.uziOwned, true);
assert.ok(wallet.state.sniperOwned && wallet.state.rocketOwned && wallet.state.molotovOwned && wallet.state.orbiterOwned);
const failed = createOrbWallet({ getItem: () => JSON.stringify({ orbs: 300 }), setItem() { throw Error(); } });
assert.equal(failed.buyUzi(), 'unavailable'); assert.equal(failed.state.orbs, 300); assert.equal(failed.state.uziOwned, false);
const stats = WEAPON_DEFINITIONS.uzi, pistol = WEAPON_DEFINITIONS.pistol;
assert.deepEqual(stats, { rarity: 'uncommon', name: 'Flux Uzi', magazineSize: 24, reserveAmmo: 96, bodyDamage: 9, headDamage: 12, reloadMs: 1800, fireDelayMs: 80, fireMode: 'Auto', range: 90 });
assert.ok(stats.bodyDamage / stats.fireDelayMs > pistol.bodyDamage / pistol.fireDelayMs);
assert.equal(applyWeaponDamage(100, 'uzi', 'body'), 91);
assert.equal(applyWeaponDamage(100, 'uzi', 'head'), 88);
const canvas = new EventTarget(); globalThis.window = new EventTarget(); globalThis.document = new EventTarget();
document.pointerLockElement = canvas; window.setTimeout = setTimeout;
const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
globalThis.AudioContext = class {
  currentTime = 0; state = 'running'; destination = {};
  createOscillator() { return { frequency: parameter, connect() { return this; }, start() {}, stop() {} }; }
  createGain() { return { gain: parameter, connect() { return this; } }; }
  close() { return Promise.resolve(); }
};
const engine = new NullEngine(), scene = new Scene(engine);
const camera = new UniversalCamera('test camera', Vector3.Zero(), scene);
let secondary = 'uzi', owned = false, hud, hits = 0;
scene.pickWithRay = () => ({ hit: true, pickedPoint: new Vector3(0, 0, 2), pickedMesh: { name: 'target' } });
const weapon = createWeapon(scene, camera, canvas, {
  getSecondaryWeapon: () => secondary, canUseWeapon: id => id !== 'uzi' || owned,
  onAmmoChange: (ammo, reserve, reloading, id) => { hud = { ammo, reserve, reloading, id }; },
  onImpact: (mesh, id) => { assert.equal(id, 'uzi'); hits++; return 'body'; }, onHitMarker() {},
});
function key(code) { const e = new Event('keydown'); Object.assign(e, { code, repeat: false }); window.dispatchEvent(e); }
function mouse(type) { const e = new Event(type); Object.assign(e, { button: 0 }); (type === 'mousedown' ? canvas : window).dispatchEvent(e); }
key('Digit2'); assert.notEqual(hud.id, 'uzi');
owned = true; key('Digit2');
assert.deepEqual(hud, { ammo: 24, reserve: 96, reloading: false, id: 'uzi' });
assert.equal(scene.getTransformNodeByName('uzi secondary root').isEnabled(), true);
weapon.selectWeapon('pistol'); assert.equal(hud.id, 'uzi', 'only chosen secondary accessible');
let time = performance.now();
mouse('mousedown'); weapon.update(time, false); assert.equal(hits, 1);
weapon.update(time + 79, false); assert.equal(hits, 1, 'rate limited');
weapon.update(time + 80, false); assert.equal(hits, 1, 'short click grace period');
weapon.update(time + 219, false); assert.equal(hits, 1);
weapon.update(time + 220, false); assert.equal(hits, 2, 'holding starts automatic repeat');
weapon.update(time + 299, false); assert.equal(hits, 2);
weapon.update(time + 300, false); assert.equal(hits, 3, 'normal 80ms fire rate after hold threshold');
mouse('mouseup'); time += 400; weapon.update(time, false); assert.equal(hits, 3);
key('Digit1'); key('Digit2'); assert.equal(hud.ammo, 21);
key('KeyR'); assert.equal(hud.reloading, true);
await new Promise(resolve => setTimeout(resolve, stats.reloadMs + 30));
assert.equal(hud.ammo, 24); assert.equal(hud.reserve, 93);
key('KeyR'); assert.equal(hud.reloading, false, 'full magazine cannot reload');
secondary = 'pistol'; weapon.update(time, false); assert.equal(hud.id, 'pistol');
secondary = 'uzi'; key('Digit2'); assert.equal(hud.reserve, 93, 'loadout switching preserves reserve');
key('KeyQ'); for (let i = 0; i < 30; i++) weapon.update(time, false);
assert.ok(Math.abs(scene.getTransformNodeByName('uzi secondary root').position.x) < .01, 'aim centres Uzi');
weapon.reset(); key('Digit2'); assert.equal(hud.ammo, 24); assert.equal(hud.reserve, 96);
weapon.setActive(false); mouse('mousedown'); weapon.update(time + 1000, false); assert.equal(hits, 3);
weapon.dispose(); scene.dispose(); engine.dispose();
console.log('PASS: Uzi purchase/save compatibility, stats, damage, fire rate, hold/release, finite reload, loadout, aim and respawn.');
