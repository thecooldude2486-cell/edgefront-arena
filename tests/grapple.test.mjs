import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const { NullEngine, Scene, UniversalCamera, Vector3, MeshBuilder } = await import('@babylonjs/core');
const { createGrapple } = await import('../game/createGrapple.ts');
globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
const canvas = new EventTarget(); document.pointerLockElement = canvas;
const engine = new NullEngine(); const scene = new Scene(engine); scene.collisionsEnabled = true;
const player = MeshBuilder.CreateBox('player', { width: .84, height: 1.8, depth: .84 }, scene);
player.position.set(0, 1, 0); player.ellipsoid.set(.42, .9, .42); player.isPickable = false;
const camera = new UniversalCamera('camera', new Vector3(0, 1.65, 0), scene);
const wall = MeshBuilder.CreateBox('wall', { width: 10, height: 8, depth: 1 }, scene);
wall.position.set(0, 4, 10); wall.checkCollisions = true; wall.computeWorldMatrix(true);
let allowed = true;
const grapple = createGrapple(scene, camera, canvas, player, 1.15, () => allowed,
  (mesh) => mesh.checkCollisions && mesh !== player && mesh.metadata?.owner !== 'bot', () => {});
function key(type, repeat = false) { const e = new Event(type); Object.assign(e, { code: 'KeyE', repeat }); window.dispatchEvent(e); }
function right(type) { const e = new Event(type); Object.assign(e, { button: 2 }); (type === 'pointerdown' ? canvas : window).dispatchEvent(e); }
function step() {
  const motion = grapple.update(1 / 60);
  if (motion) player.moveWithCollisions(motion.scale(1 / 60));
  player.computeWorldMatrix(true);
  camera.position.copyFrom(player.position).addInPlace(new Vector3(0, .65, 0));
  grapple.draw();
  return motion;
}
key('keydown'); assert.equal(grapple.state, 'throwing');
for (let i = 0; i < 120; i++) step();
assert.equal(grapple.state, 'clinging');
assert.ok(player.position.z > 8 && player.position.z < 9, 'stops outside the wall with collision clearance');
const clingPosition = player.position.clone();
for (let i = 0; i < 60; i++) step();
assert.ok(Vector3.Distance(player.position, clingPosition) < .001, 'holding maintains the cling');
camera.rotation.y = .5; step(); assert.equal(grapple.state, 'clinging', 'looking around does not move the anchor');
right('pointerdown'); key('keyup'); assert.equal(grapple.active, true, 'either held input can maintain attachment');
right('pointerup'); assert.equal(grapple.active, false); assert.equal(step(), null, 'release restores normal gravity-driven movement');

function reset() { grapple.cancel(); player.position.set(0, 1, 0); camera.position.set(0, 1.65, 0); camera.rotation.setAll(0); camera.getViewMatrix(true); }
reset(); right('pointerdown'); assert.equal(grapple.state, 'throwing'); right('pointerup'); assert.equal(grapple.active, false, 'release during flight cancels');
reset(); key('keydown'); allowed = false; step(); assert.equal(grapple.active, false, 'switch/death state cancels'); allowed = true;
reset(); key('keydown'); document.pointerLockElement = null; document.dispatchEvent(new Event('pointerlockchange')); assert.equal(grapple.active, false); document.pointerLockElement = canvas;
reset(); key('keydown'); window.dispatchEvent(new Event('blur')); assert.equal(grapple.active, false);
reset(); wall.position.z = 45; wall.computeWorldMatrix(true); key('keydown'); assert.equal(grapple.state, 'miss');
wall.position.z = 10; wall.computeWorldMatrix(true); key('keydown', true); assert.equal(grapple.active, false, 'held key does not retrigger after a miss'); key('keyup');
reset(); wall.metadata = { owner: 'bot' }; key('keydown'); assert.equal(grapple.state, 'miss', 'bots cannot be grapple anchors'); wall.metadata = null;
reset(); key('keydown');
const obstacle = MeshBuilder.CreateBox('new obstruction', { size: 3 }, scene); obstacle.position.set(0, 1.65, 3); obstacle.checkCollisions = true; obstacle.computeWorldMatrix(true);
step(); assert.equal(grapple.state, 'blocked', 'intervening geometry breaks the tether'); obstacle.dispose();
reset(); key('keydown');
// Simulate a collider wedged against geometry: never tunnel through it.
for (let i = 0; i < 90; i++) grapple.update(1 / 60);
assert.equal(grapple.state, 'blocked');
grapple.dispose(); key('keydown'); assert.equal(grapple.active, false, 'dispose removes input handlers');
scene.dispose(); engine.dispose();
console.log('PASS: E/right-click, throw, collision-safe pull, cling, release, range, blocked paths, pause/switch/death and cleanup.');
