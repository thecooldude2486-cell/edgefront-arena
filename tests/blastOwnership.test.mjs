import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import { NullEngine, Scene, MeshBuilder, Vector3 } from '@babylonjs/core';
const { createGrenades, GRENADE } = await import('../game/createGrenade.ts');
const { createRockets } = await import('../game/createRockets.ts');
const { getBlastImpulse } = await import('../game/blastJump.ts');
const engine = new NullEngine(),
  scene = new Scene(engine);
const wall = MeshBuilder.CreateBox(
  'arena floor',
  { width: 20, height: 0.2, depth: 20 },
  scene,
);
wall.position.y = -0.1;
wall.checkCollisions = true;
wall.computeWorldMatrix(true);
const feet = new Vector3(0, 0.9, 0);
let owners = [],
  impulses = [];
const launched = (position, self) => {
  owners.push(self);
  if (self && grenades.canDamage(position, feet))
    impulses.push(getBlastImpulse(position, feet, 0));
};
const grenades = createGrenades(scene, launched),
  rockets = createRockets(scene, (position, _, self) =>
    launched(position, self),
  );
// Both bot and online local projectiles use the default self=true. Remote effects explicitly opt out.
for (const self of [true, false]) {
  rockets.fire(new Vector3(0, 1, 0), Vector3.Down(), [], self);
  rockets.update(0.1);
}
assert.deepEqual(owners, [true, false]);
assert.equal(impulses.length, 1);
assert.ok(impulses[0]?.y > 8, 'Own floor rocket supplies upward jump momentum');
owners = [];
impulses = [];
for (const self of [true, false]) {
  grenades.throw(new Vector3(0, 0.25, 0), Vector3.Down(), undefined, self);
  for (let frame = 0; frame < 101; frame++) grenades.update(0.02);
}
assert.deepEqual(owners, [true, false]);
assert.equal(impulses.length, 1);
assert.ok(
  impulses[0]?.y > 8,
  'Own grenade supplies jump momentum at fuse expiry',
);
rockets.dispose();
grenades.dispose();
scene.dispose();
engine.dispose();
console.log(
  'PASS: real rocket floor collision and grenade fuse preserve owner identity, both local launch paths supply momentum, remote blasts cannot launch the player.',
);
