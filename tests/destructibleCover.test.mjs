import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@babylonjs/core/') && !specifier.endsWith('.js')) return next(`${specifier}.js`, context);
  return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const { NullEngine, Scene, MeshBuilder, Ray, Vector3 } = await import('@babylonjs/core');
const { createArena } = await import('../game/createArena.ts');
const engine = new NullEngine(); const scene = new Scene(engine);
const arena = createArena(scene);
scene.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
const target = scene.getMeshByName('centre north barrier');
const originalColor = target.material.diffuseColor.clone();
const ray = new Ray(new Vector3(0, .8, 5), Vector3.Forward(), 4);
assert.equal(scene.pickWithRay(ray, m => m.checkCollisions)?.pickedMesh, target);
for (const weapon of ['assaultRifle', 'pistol', 'sniper', 'rocketLauncher', 'grenade', 'sword', 'orbiter']) {
  for (let i = 0; i < 20; i++) assert.equal(arena.cover.hit(target, weapon, target.position), false);
}
for (let i = 0; i < 9; i++) arena.cover.hit(target, 'laserCannon', target.position);
assert.ok(target.isEnabled()); assert.ok(target.checkCollisions);
assert.notDeepEqual(target.material.diffuseColor, originalColor, 'Heating has a visible indication');
arena.cover.hit(target, 'laserCannon', target.position);
assert.equal(target.isEnabled(), false); assert.equal(target.checkCollisions, false); assert.equal(target.isPickable, false);
assert.equal(scene.pickWithRay(ray, m => m.checkCollisions)?.hit, false, 'Movement/AI line-of-sight obstruction removed');
assert.equal(scene.pickWithRay(ray, m => m.isPickable)?.hit, false, 'Weapon obstruction removed');
assert.equal(arena.cover.hit(target, 'laserCannon', target.position), false, 'Broken cover cannot trigger repeated breaks');
assert.ok(scene.getMeshByName('cover break pulse'));
arena.cover.update(.4); assert.equal(scene.getMeshByName('cover break pulse'), null);
arena.cover.reset();
assert.ok(target.isEnabled() && target.checkCollisions && target.isPickable);
assert.deepEqual(target.material.diffuseColor, originalColor);
for (let i = 0; i < 9; i++) arena.cover.hit(target, 'laserCannon', target.position);
assert.ok(target.isEnabled(), 'Reset restores full cover health');
arena.cover.reset();
const lobbyWall = MeshBuilder.CreateBox('lobby wall test', {}, scene); lobbyWall.checkCollisions = true;
for (const mesh of [lobbyWall, ...['arena foundation', 'north wall', 'south wall', 'east wall', 'west wall', '1 side platform', '1 north ramp'].map(name => scene.getMeshByName(name))]) {
  assert.ok(mesh);
  for (let i = 0; i < 30; i++) assert.equal(arena.cover.hit(mesh, 'laserCannon', mesh.position), false);
  assert.ok(mesh.isEnabled() && mesh.checkCollisions, `${mesh.name} remains protected`);
}
const names = ['centre cover 0', 'centre cover 1', 'centre cover 2', 'centre cover 3', '-1 side cover', '1 side cover', 'centre north barrier', 'centre south barrier'];
for (const name of names) {
  const mesh = scene.getMeshByName(name);
  for (let i = 0; i < 10; i++) arena.cover.hit(mesh, 'laserCannon', mesh.position);
  assert.equal(mesh.isEnabled(), false, `${name} is breakable`);
}
arena.cover.reset();
for (const name of names) assert.ok(scene.getMeshByName(name).isEnabled());
assert.equal(scene.meshes.filter(m => m.name === 'cover break pulse').length, 0);
arena.cover.dispose(); scene.dispose(); engine.dispose();
console.log('PASS: eight laser-only covers, heating, destruction, ray/collision removal, protected structures, reset health and effect cleanup.');
