import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@babylonjs/core/') && !specifier.endsWith('.js')) return next(`${specifier}.js`, context);
  return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const { createLaserEnergy } = await import('../game/createLaserEnergy.ts');
const { applyWeaponDamage } = await import('../game/weaponDefinitions.ts');
const energy = createLaserEnergy();
energy.fire(); assert.equal(energy.state.magazine, 97);
energy.update(1.5, false); assert.equal(energy.state.magazine, 97);
energy.update(.1, false); assert.ok(Math.abs(energy.state.magazine - 98.2) < .001);
energy.fire(); energy.update(1, false); assert.ok(energy.state.magazine < 96);
energy.update(30, false); assert.equal(energy.state.magazine, 100);
while (energy.fire()) {}
const depleted = energy.state.magazine;
energy.update(30, true); assert.equal(energy.state.magazine, depleted);
assert.equal(energy.reload(), false); assert.equal(energy.state.magazine, depleted);
energy.reset(); assert.equal(energy.state.magazine, 100);
assert.equal(applyWeaponDamage(100, 'laserCannon', 'body'), 94);
assert.equal(applyWeaponDamage(100, 'laserCannon', 'head'), 92);

const { NullEngine, Scene, UniversalCamera, Vector3, MeshBuilder } = await import('@babylonjs/core');
const { createWeapon } = await import('../game/createWeapon.ts');
let now = 1000;
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
const canvas = new EventTarget();
globalThis.window = new EventTarget(); window.setTimeout = setTimeout;
globalThis.document = new EventTarget(); document.pointerLockElement = canvas;
const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
globalThis.AudioContext = class {
  state = 'running'; currentTime = 0; destination = {};
  createOscillator() { return { frequency: parameter, connect() { return this; }, start() {}, stop() {} }; }
  createGain() { return { gain: parameter, connect() { return this; } }; }
  close() { return Promise.resolve(); }
};
const engine = new NullEngine(); const scene = new Scene(engine);
const camera = new UniversalCamera('camera', Vector3.Zero(), scene);
const target = MeshBuilder.CreateBox('target', { size: 2 }, scene); target.position.z = 10;
const wall = MeshBuilder.CreateBox('cover', { size: 2 }, scene); wall.position.z = 5;
scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
let unlocked = false, primary = 'laserCannon', hud, damageTicks = 0;
const weapon = createWeapon(scene, camera, canvas, {
  canUseWeapon: id => id !== 'laserCannon' || unlocked,
  getPrimaryWeapon: () => primary,
  onAmmoChange: (ammo, reserve, charging, id) => { hud = { ammo, reserve, charging, id }; },
  onImpact: mesh => { if (mesh === target) { damageTicks++; return 'body'; } return 'none'; },
  onHitMarker() {},
});
const press = () => { const e = new Event('mousedown'); e.button = 0; canvas.dispatchEvent(e); };
const release = () => { const e = new Event('mouseup'); e.button = 0; window.dispatchEvent(e); };
function advance(ms) { for (let i = 0; i < ms; i += 50) { now += 50; weapon.update(now, false); } }
weapon.selectWeapon('laserCannon'); assert.equal(weapon.id, 'assaultRifle', 'Locked until five parts');
unlocked = true; weapon.selectWeapon('laserCannon');
assert.equal(hud.ammo, 100); assert.ok(scene.getTransformNodeByName('helion laser root').isEnabled());
press(); assert.equal(hud.ammo, 97); assert.equal(damageTicks, 0, 'Cover blocks damage');
assert.ok(scene.getMeshByName('helion beam').scaling.z < 5, 'Beam stops at cover');
release(); assert.equal(scene.getMeshByName('helion beam').isEnabled(), false);
press(); assert.equal(hud.ammo, 97, 'Fast tapping cannot bypass fire rate'); release();
wall.setEnabled(false); advance(100); press();
assert.equal(damageTicks, 1); assert.equal(hud.ammo, 94);
advance(300); assert.equal(damageTicks, 4, 'Held beam damages at bounded ticks, not every visual frame');
release(); const afterFire = hud.ammo;
advance(1400); assert.equal(hud.ammo, afterFire, 'No premature recharge');
advance(600); assert.ok(hud.ammo > afterFire);
const beforeSwitch = hud.ammo; weapon.selectWeapon('pistol'); weapon.selectWeapon('laserCannon');
assert.equal(hud.ammo, beforeSwitch, 'Switching does not refill');
press(); advance(100); document.pointerLockElement = null; document.dispatchEvent(new Event('pointerlockchange'));
assert.equal(scene.getMeshByName('helion beam').isEnabled(), false);
const pausedEnergy = hud.ammo; advance(2000); assert.equal(hud.ammo, pausedEnergy, 'Paused energy does not recharge');
document.pointerLockElement = canvas;
weapon.reset(); assert.equal(hud.ammo, 100);
press(); advance(5000); assert.ok(hud.ammo < 3); const emptyTicks = damageTicks;
advance(3000); assert.equal(damageTicks, emptyTicks, 'Holding depleted cannon cannot deal free damage');
release(); advance(2500); assert.ok(hud.ammo >= 12);
press(); weapon.setActive(false); assert.equal(scene.getMeshByName('helion beam').isEnabled(), false);
weapon.dispose(); scene.dispose(); engine.dispose();
console.log('PASS: energy timing, tap/hold costs, ownership, shared damage, cover, beam cleanup, depleted trigger, pause, switch and respawn.');
