import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s,c,next) {
  if (s.startsWith('@babylonjs/core/') && !s.endsWith('.js')) return next(s+'.js',c);
  if (s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(s+'.ts',c);
  return next(s,c);
}});
const { readOnlineEffect } = await import('../game/onlineEffects.ts');
const { WEAPON_DEFINITIONS } = await import('../game/weaponDefinitions.ts');
const { NullEngine,Scene,Vector3,MeshBuilder } = await import('@babylonjs/core');
const { createOnlineTracers } = await import('../game/createOnlineTracers.ts');
const origin={x:0,y:1,z:0},direction={x:0,y:0,z:1};
for(const weapon of Object.keys(WEAPON_DEFINITIONS)) {
  assert.deepEqual(readOnlineEffect({action:'fire',weapon,origin,direction,damage:100,ammo:9}),
    {action:'fire',weapon,origin,direction});
}
for(const data of [
  {action:'fire',weapon:'fake',origin,direction},
  {action:'fire',weapon:'pistol',origin:{x:1000,y:0,z:0},direction},
  {action:'fire',weapon:'pistol',origin,direction:{x:0,y:0,z:0}},
  {action:'reload',weapon:'grenade'},{action:'reload',weapon:'orbiter'}
]) assert.equal(readOnlineEffect(data),null);
assert.deepEqual(readOnlineEffect({action:'reload',weapon:'pistol',ammo:100}),{action:'reload',weapon:'pistol'});
const engine=new NullEngine(),scene=new Scene(engine);
const wall=MeshBuilder.CreateBox('cover',{width:4,height:4,depth:1},scene);
wall.position.set(0,1,5);wall.checkCollisions=true;wall.computeWorldMatrix(true);
const traces=createOnlineTracers(scene);
traces.fire('assaultRifle',new Vector3(0,1,0),Vector3.Forward());
const tracer=scene.getMeshByName('online bullet tracer');
assert.ok(tracer);assert.equal(tracer.isPickable,false);
assert.ok(tracer.position.z<2.5,'trace stops at cover');
traces.update(.1);assert.equal(scene.getMeshByName('online bullet tracer'),null);
for(const id of ['sword','orbiter','grenade','molotov','rocketLauncher','laserCannon']) traces.fire(id,Vector3.Zero(),Vector3.Forward());
assert.equal(scene.getMeshByName('online bullet tracer'),null,'no bullet tracers for melee/projectiles/beam');
traces.dispose();scene.dispose();engine.dispose();
console.log('PASS: all weapon effect payloads, invalid data rejected, no damage/ammo fields, tracers stop at cover, expiry and melee exclusions.');
