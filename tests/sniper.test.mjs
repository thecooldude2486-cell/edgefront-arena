import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Let Node run the project's TypeScript modules without another test dependency.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@babylonjs/core/') && !specifier.endsWith('.js')) return nextResolve(`${specifier}.js`, context);
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });
const { createOrbWallet, WALLET_STORAGE_KEY } = await import('../game/createOrbWallet.ts');
const { ORBS_STORAGE_KEY } = await import('../game/createOrbRewards.ts');
const { WEAPON_DEFINITIONS, applyWeaponDamage } = await import('../game/weaponDefinitions.ts');
const { createWeaponAmmo } = await import('../game/createWeaponAmmo.ts');
function storage(balance) {
  const values = new Map([[ORBS_STORAGE_KEY, String(balance)]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const poor = createOrbWallet(storage(299));
assert.equal(poor.buySniper(), 'insufficient');
assert.equal(poor.state.orbs, 299);
const save = storage(300);
const wallet = createOrbWallet(save);
assert.equal(wallet.buySniper(), 'purchased');
assert.deepEqual(wallet.state, { orbs: 0, sniperOwned: true, orbClicks: 0, orbiterOwned: false, saved: true });
assert.equal(wallet.buySniper(), 'owned');
wallet.award(10);
assert.equal(wallet.state.orbs, 10);
assert.deepEqual(createOrbWallet(save).state, wallet.state);
assert.equal(JSON.parse(save.getItem(WALLET_STORAGE_KEY)).sniperOwned, true);
const failed = createOrbWallet({ getItem: (key) => key === ORBS_STORAGE_KEY ? '400' : null, setItem() { throw Error('Storage blocked'); } });
assert.equal(failed.buySniper(), 'unavailable');
assert.equal(failed.state.orbs, 400);
assert.equal(failed.state.sniperOwned, false);
assert.equal(createOrbWallet(storage('bad')).state.orbs, 0);
assert.equal(createOrbWallet().buySniper(), 'insufficient');
const spare = createOrbWallet(storage(350));
assert.equal(spare.buySniper(), 'purchased');
assert.equal(spare.state.orbs, 50);

const sniper = WEAPON_DEFINITIONS.sniper;
assert.equal(applyWeaponDamage(100, 'sniper', 'body'), 30);
assert.equal(applyWeaponDamage(100, 'sniper', 'head'), 0);
const ammo = createWeaponAmmo(sniper.magazineSize, sniper.reserveAmmo);
assert.deepEqual(ammo.state, { magazine: 5, reserve: 15 });
ammo.fire(); ammo.fire(); ammo.reload();
assert.deepEqual(ammo.state, { magazine: 5, reserve: 13 });
ammo.reset();
assert.deepEqual(ammo.state, { magazine: 5, reserve: 15 });
assert.deepEqual(WEAPON_DEFINITIONS.assaultRifle, { name: 'Kestrel AR', magazineSize: 20, reserveAmmo: 100, bodyDamage: 12, headDamage: 15, reloadMs: 1650, fireDelayMs: 125, fireMode: 'Auto', range: 160 });
assert.deepEqual(WEAPON_DEFINITIONS.pistol, { name: 'Vesper Pistol', magazineSize: 8, reserveAmmo: 32, bodyDamage: 10, headDamage: 14, reloadMs: 1500, fireDelayMs: 400, fireMode: 'Semi', range: 130 });

// Exercise the real weapon input/model system without needing a browser GPU.
const { NullEngine, Scene, UniversalCamera, Vector3 } = await import('@babylonjs/core');
const { createWeapon } = await import('../game/createWeapon.ts');
const canvas = new EventTarget();
globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
document.pointerLockElement = canvas;
const soundParameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
globalThis.AudioContext = class {
  currentTime = 0; state = 'running'; destination = {};
  createOscillator() { return { frequency: soundParameter, connect() { return this; }, start() {}, stop() {} }; }
  createGain() { return { gain: soundParameter, connect() { return this; } }; }
  close() { return Promise.resolve(); }
};
const engine = new NullEngine();
const scene = new Scene(engine);
const realPick = scene.pickWithRay.bind(scene);
const camera = new UniversalCamera('test camera', Vector3.Zero(), scene);
let owned = false;
let orbiterOwned = false;
let primary = 'assaultRifle';
let hud;
let scope = false;
let rayCount = 0;
let meleeHealth = 100;
scene.pickWithRay = () => { rayCount++; return null; };
const weapon = createWeapon(scene, camera, canvas, {
  canUseWeapon: (id) => id === 'orbiter' ? orbiterOwned : id !== 'sniper' || owned,
  getPrimaryWeapon: () => primary,
  onAmmoChange: (ammo, reserve, reloading, id) => { hud = { ammo, reserve, reloading, id }; },
  onImpact: (mesh, id) => {
    if (mesh.name !== 'melee target') return 'none';
    meleeHealth = applyWeaponDamage(meleeHealth, id, 'body');
    return 'body';
  }, onHitMarker() {}, onScopeChange: (value) => { scope = value; },
});
weapon.selectWeapon('sniper');
assert.equal(hud.id, 'assaultRifle');
owned = true;
weapon.selectWeapon('sniper');
assert.equal(hud.id, 'assaultRifle', 'owning both primaries does not equip both');
primary = 'sniper';
function key(code) { const event = new Event('keydown'); Object.assign(event, { code, repeat: false }); window.dispatchEvent(event); }
key('Digit3');
assert.equal(hud.id, 'assaultRifle', 'slot 3 no longer selects the sniper');
key('Digit1');
assert.deepEqual(hud, { ammo: 5, reserve: 15, reloading: false, id: 'sniper' });
const press = new Event('pointerdown'); Object.assign(press, { button: 0 });
canvas.dispatchEvent(press);
assert.equal(hud.ammo, 4);
weapon.update(performance.now() + 2000, false);
assert.equal(hud.ammo, 4, 'holding semi-auto does not fire again');
canvas.dispatchEvent(press);
assert.equal(hud.ammo, 4, 'fire-rate limit blocks an immediate second click');
assert.equal(rayCount, 1, 'one bullet casts one hit ray');
key('KeyQ'); weapon.update(performance.now(), false);
assert.equal(scope, true);
const sniperModel = scene.getTransformNodeByName('meridian sniper root');
for (let frame = 0; frame < 40; frame++) weapon.update(performance.now(), false);
key('KeyR');
assert.equal(scope, false, 'reload immediately removes the sniper scope overlay');
assert.ok(sniperModel.position.x > .3, 'reload lowers the solid scope away from the centre immediately');
key('KeyQ');
const rightPress = new Event('pointerdown'); Object.assign(rightPress, { button: 2 });
canvas.dispatchEvent(rightPress);
for (let frame = 0; frame < 40; frame++) weapon.update(performance.now(), false);
assert.equal(scope, false, 'aim inputs during reload cannot bring the scope back');
assert.ok(sniperModel.position.x > .3, 'rifle remains at the hip while reloading');
assert.ok(camera.fov > 1, 'reload restores an unobstructed normal view');
await new Promise((resolve) => setTimeout(resolve, sniper.reloadMs + 30));
weapon.update(performance.now(), false);
assert.equal(scope, false, 'reload completion does not restore stale aiming input');
assert.equal(hud.ammo, 5);
assert.equal(hud.reserve, 14);
key('KeyQ'); weapon.update(performance.now(), false);
assert.equal(scope, true, 'the player can scope normally again after reloading');
assert.equal(sniperModel.isEnabled(), false, 'solid rifle stays hidden while scoped');
weapon.selectWeapon('pistol');
assert.equal(scope, false);
weapon.selectWeapon('assaultRifle');
assert.equal(hud.id, 'pistol', 'unequipped AR cannot be selected');
weapon.selectWeapon('sniper');
assert.equal(hud.ammo, 5, 'switching preserves ammunition');
assert.equal(hud.reserve, 14, 'switching preserves reserve ammunition');
weapon.reset(); weapon.selectWeapon('sniper');
assert.equal(hud.ammo, 5, 'respawn refills sniper');
assert.equal(hud.id, 'sniper', 'respawn retains the chosen primary');
primary = 'assaultRifle';
weapon.update(performance.now(), false);
assert.equal(hud.id, 'assaultRifle', 'changing primary removes the old equipped rifle');
key('Digit2');
assert.equal(hud.id, 'pistol', 'Vesper always remains secondary');
key('Digit1');
assert.equal(hud.id, 'assaultRifle');
primary = 'sniper'; key('Digit1');
weapon.setActive(false); canvas.dispatchEvent(press);
assert.equal(hud.ammo, 5, 'inactive player cannot shoot');
weapon.setActive(true);
orbiterOwned = true;
key('Digit3');
assert.equal(hud.id, 'orbiter');
const raysBeforeMelee = rayCount;
let reach = 0;
scene.pickWithRay = (ray) => { rayCount++; reach = ray.length; return null; };
canvas.dispatchEvent(press);
assert.equal(reach, 3, 'melee cannot hit beyond three metres');
assert.equal(hud.ammo, 0, 'melee needs no ammo');
canvas.dispatchEvent(press);
weapon.update(performance.now() + 2000, false);
assert.equal(rayCount, raysBeforeMelee + 1, 'one swing per click, respecting cooldown');
key('KeyR'); assert.equal(hud.reloading, false);
key('KeyQ'); weapon.update(performance.now(), false); assert.equal(scope, false);
assert.equal(applyWeaponDamage(100, 'orbiter', 'body'), 65);
assert.equal(applyWeaponDamage(100, 'orbiter', 'head'), 65);
weapon.reset(); key('Digit3'); assert.equal(hud.id, 'orbiter', 'melee remains available after respawn');
const { MeshBuilder } = await import('@babylonjs/core');
window.setTimeout = setTimeout;
scene.pickWithRay = realPick;
camera.rotation.set(0, 0, 0);
const target = MeshBuilder.CreateBox('melee target', { size: 1 }, scene);
target.position.z = 2; target.computeWorldMatrix(true);
await new Promise((resolve) => setTimeout(resolve, 680));
canvas.dispatchEvent(press);
assert.equal(meleeHealth, 65, 'actual nearby mesh receives exactly one melee hit');
target.position.z = 5; target.computeWorldMatrix(true);
await new Promise((resolve) => setTimeout(resolve, 680));
canvas.dispatchEvent(press);
assert.equal(meleeHealth, 65, 'distant target cannot receive melee damage');
target.position.z = 2; target.computeWorldMatrix(true);
const cover = MeshBuilder.CreateBox('cover', { width: 2, height: 2, depth: .2 }, scene);
cover.position.z = 1; cover.computeWorldMatrix(true);
await new Promise((resolve) => setTimeout(resolve, 680));
canvas.dispatchEvent(press);
assert.equal(meleeHealth, 65, 'cover blocks melee hits');
weapon.dispose(); scene.dispose(); engine.dispose();

const clickSave = storage(450);
let clickWallet = createOrbWallet(clickSave);
for (let i = 0; i < 19; i++) assert.equal(clickWallet.clickOrb(), 'progress');
assert.equal(clickWallet.state.orbiterOwned, false);
clickWallet = createOrbWallet(clickSave);
assert.equal(clickWallet.state.orbClicks, 19, 'click progress survives refresh');
assert.equal(clickWallet.clickOrb(), 'unlocked');
assert.equal(clickWallet.clickOrb(), 'owned', 'repeated clicks cannot replay unlock');
assert.equal(clickWallet.state.orbs, 450, 'click unlock never spends currency');
clickWallet.buySniper();
assert.equal(createOrbWallet(clickSave).state.orbiterOwned, true, 'sniper purchase preserves Orbiter');
assert.equal(failed.clickOrb(), 'unavailable');
assert.equal(failed.state.orbClicks, 0);
console.log('PASS: purchases, 20-click unlock, persistence, melee damage/range/cover, ammo, scope, loadout and respawn checks.');
