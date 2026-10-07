import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s,c,next) {
  if (s.startsWith('@babylonjs/core/') && !s.endsWith('.js')) return next(s+'.js',c);
  if (s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(s+'.ts',c);
  return next(s,c);
}});
const { NullEngine, Scene, UniversalCamera, Vector3, TransformNode } = await import('@babylonjs/core');
const { createWeapon } = await import('../game/createWeapon.ts');
const { createRemoteWeapon } = await import('../game/createRemoteWeapon.ts');
const { WEAPON_DEFINITIONS } = await import('../game/weaponDefinitions.ts');
globalThis.window = new EventTarget(); globalThis.document = new EventTarget();
const canvas = new EventTarget(); document.pointerLockElement = canvas;
const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
globalThis.AudioContext = class {
  currentTime=0; state='running'; destination={};
  createOscillator() {return {frequency:parameter,connect(){return this;},start(){},stop(){}};}
  createGain(){return {gain:parameter,connect(){return this;}};}
  close(){return Promise.resolve();}
};
const engine = new NullEngine(), scene = new Scene(engine);
const camera = new UniversalCamera('camera', Vector3.Zero(), scene);
let hud, rays=0, impacts=0, visualShots=0, throws=0, time=performance.now();
let cosmetics={skin:5,wrap:10,charm:15};
let primary='assaultRifle',utility='grenade',melee='orbiter',molotovThrows=0;
scene.pickWithRay = () => {rays++;return null;};
const weapon = createWeapon(scene,camera,canvas,{
  getCosmetics:()=>cosmetics,
  onVisualShot:()=>visualShots++,
  onThrowGrenade:()=>throws++,
  onThrowMolotov:()=>molotovThrows++,
  getPrimaryWeapon:()=>primary,getUtilityWeapon:()=>utility,getMeleeWeapon:()=>melee,
  getSecondaryWeapon:()=> 'pistol', canUseWeapon:()=>true,
  onAmmoChange:(ammo,reserve,reloading,id)=>{hud={ammo,reserve,reloading,id};},
  onImpact:()=>{impacts++;return 'body';},onHitMarker(){},
});
function assertAppearance(root, expected) {
  const meshes=root.getChildMeshes();
  assert.equal(meshes.some(mesh=>mesh.name==='career wrap band'),expected.wrap!==null,'Fitted wrap follows equipped loadout');
  assert.equal(meshes.some(mesh=>mesh.name==='career charm chain'),expected.charm!==null,'Charm follows equipped loadout');
  assert.equal(meshes.some(mesh=>mesh.material?.name.includes('career finish')),expected.skin!==null,'Finish follows equipped loadout');
  if (expected.wrap!==null) {
    const charm=root.getDescendants().find(node=>node.name==='career swinging charm');
    for(const mesh of meshes.filter(mesh=>mesh.isEnabled() && !/muzzle flash|helion beam|shot tracer/i.test(mesh.name))) {
      if(charm && mesh.isDescendantOf(charm)) assert.equal(mesh.material.diffuseTexture,null,'Local and remote charms remain unwrapped');
      else assert.ok(mesh.material.diffuseTexture?.name.startsWith('career patterned wrap'),'Full local/remote wrap coverage: '+mesh.name);
    }
  }
}
const localRoot=scene.getTransformNodeByName('kestrel rifle root');
assertAppearance(localRoot,cosmetics);
cosmetics={skin:null,wrap:null,charm:null};weapon.update(time,false);assertAppearance(localRoot,cosmetics);
cosmetics={skin:20,wrap:25,charm:30};weapon.update(time,false);assertAppearance(localRoot,cosmetics);
weapon.reset();assertAppearance(localRoot,cosmetics);
function mouse(type){const e=new Event(type);Object.assign(e,{button:0});(type==='mousedown'?canvas:window).dispatchEvent(e);}
function key(code){const e=new Event('keydown');Object.assign(e,{code,repeat:false});window.dispatchEvent(e);}
function shots(n){mouse('mousedown');for(let i=0;i<n;i++){time+=i===1?230:130;weapon.update(time,false);}mouse('mouseup');}
for(let i=0;i<2;i++){shots(20);key('KeyR');await new Promise(resolve=>setTimeout(resolve,1680));}
shots(12);
assert.deepEqual(hud,{ammo:8,reserve:60,reloading:false,id:'assaultRifle'});
weapon.setCombatEnabled(false);
const before=rays;
key('Digit2');assertAppearance(scene.getTransformNodeByName('vesper pistol root'),cosmetics);assert.equal(hud.id,'pistol');assert.equal(hud.ammo,8);assert.equal(hud.reserve,32);
mouse('mousedown');weapon.update(time+1000,false);mouse('mouseup');key('KeyR');
assert.equal(hud.ammo,8);assert.equal(hud.reserve,32);assert.equal(rays,before);assert.equal(impacts,0);
key('Digit1');assert.deepEqual(hud,{ammo:8,reserve:60,reloading:false,id:'assaultRifle'});
key('KeyR');assert.equal(hud.reloading,false);
mouse('mousedown');weapon.update(time+2000,false);mouse('mouseup');
assert.equal(hud.ammo,8);assert.equal(rays,before);
const parent=new TransformNode('remote',scene), remote=createRemoteWeapon(scene,parent);
remote.setCosmetics(cosmetics);
for(const id of Object.keys(WEAPON_DEFINITIONS)){
  remote.equip(id);
  assertAppearance(scene.getTransformNodeByName('remote held '+id),cosmetics);
  assert.equal(scene.getTransformNodeByName('remote held '+id).isEnabled(),true);
  for(const other of Object.keys(WEAPON_DEFINITIONS)){
    if(other!==id) assert.notEqual(scene.getTransformNodeByName('remote held '+other)?.isEnabled(),true);
  }
}
remote.equip('pistol');remote.equip('assaultRifle');
assert.equal(scene.getTransformNodeByName('remote held pistol').isEnabled(),false);
assert.ok(parent.getChildMeshes().every(mesh=>!mesh.isPickable&&!mesh.checkCollisions));
assert.deepEqual(hud,{ammo:8,reserve:60,reloading:false,id:'assaultRifle'},'remote changes do not touch local ammo');
remote.clear();assert.equal(scene.getTransformNodeByName('remote held assaultRifle').isEnabled(),false);
remote.equip('assaultRifle');assertAppearance(scene.getTransformNodeByName('remote held assaultRifle'),cosmetics);
remote.setCosmetics({skin:null,wrap:null,charm:null});assertAppearance(scene.getTransformNodeByName('remote held assaultRifle'),{skin:null,wrap:null,charm:null});
remote.setCosmetics(cosmetics);assertAppearance(scene.getTransformNodeByName('remote held assaultRifle'),cosmetics);
assertAppearance(localRoot,cosmetics);
weapon.setVisualOnly(true); weapon.setCombatEnabled(true);
const rayCount=rays, shotCount=visualShots;
shots(1);assert.equal(hud.ammo,7);assert.equal(visualShots,shotCount+1);
mouse('mousedown');weapon.update(time+20,false);mouse('mouseup');
assert.equal(hud.ammo,7,'AR fire delay unchanged');
assert.equal(rays,rayCount,'visual shots cannot raycast for damage');assert.equal(impacts,0);
key('KeyR');await new Promise(resolve=>setTimeout(resolve,1680));
assert.equal(hud.ammo,20);assert.equal(hud.reserve,47,'online reload uses local reserve');
remote.fire('assaultRifle');assert.equal(scene.getMeshByName('remote muzzle flash').isEnabled(),true);
assert.equal(scene.getMeshByName('remote muzzle flash').material.diffuseTexture,null,'Wrap never textures transient firing effects');
assert.equal(scene.getTransformNodeByName('remote held assaultRifle').position.z,-.07);
remote.update(.1);assert.ok(scene.getTransformNodeByName('remote held assaultRifle').position.z>-.07);
await new Promise(resolve=>setTimeout(resolve,60));assert.equal(scene.getMeshByName('remote muzzle flash').isEnabled(),false);
assert.equal(hud.ammo,20,'remote shots never consume local ammo');
remote.fire('pistol');remote.clear();assert.equal(scene.getMeshByName('remote muzzle flash').isEnabled(),false);
remote.reload('assaultRifle',true);remote.update(.5);
assert.notEqual(scene.getTransformNodeByName('remote held assaultRifle').rotation.x,0);
assert.equal(hud.ammo,20,'remote reload never changes local ammo');
remote.reload('assaultRifle',false);
assert.equal(scene.getTransformNodeByName('remote held assaultRifle').rotation.x,0);
remote.fire('sword');remote.update(.1);
assert.notEqual(scene.getTransformNodeByName('remote held sword').rotation.z,0);
remote.equip('pistol');
assert.equal(scene.getTransformNodeByName('remote held sword').rotation.z,0,'switch cancels swing');
remote.fire('molotov');remote.update(.1);
assert.notEqual(scene.getTransformNodeByName('remote held molotov').rotation.x,0);
remote.clear();
weapon.setVisualOnly(false);assertAppearance(localRoot,cosmetics);shots(1);assert.equal(hud.ammo,19,'bot-mode combat re-enabled normally');
assert.equal(rays,rayCount+1);
weapon.setVisualOnly(true);key('Digit4');
assert.equal(hud.ammo,1);
mouse('mousedown');mouse('mouseup');
assert.equal(throws,1,'online grenade uses existing throw callback');
assert.equal(hud.ammo,0,'throw consumes the local grenade');
mouse('mousedown');weapon.update(time+3000,false);mouse('mouseup');
assert.equal(throws,1,'no unlimited grenades');assert.equal(impacts,0);
utility='molotov';key('Digit4');mouse('mousedown');mouse('mouseup');
assert.equal(molotovThrows,1);assert.equal(hud.ammo,0);
for(const id of ['sniper','rocketLauncher','laserCannon']) {
  primary=id;key('Digit1');
  const beforeShots=visualShots,beforeAmmo=hud.ammo;
  mouse('mousedown');mouse('mouseup');
  assert.equal(visualShots,beforeShots+1,id+' emits visual fire');
  assert.ok(hud.ammo<beforeAmmo,id+' spends only its local ammo/energy');
}
for(const id of ['sword','orbiter']) {
  melee=id;key('Digit3');
  const beforeShots=visualShots;mouse('mousedown');mouse('mouseup');
  assert.equal(visualShots,beforeShots+1,id+' emits visual swing');
}
assert.equal(impacts,0,'no online weapon called damage');
primary='assaultRifle';key('Digit1');time+=5000;
const tapAmmo=hud.ammo;
mouse('mousedown');weapon.update(time,false);
assert.equal(hud.ammo,tapAmmo-1,'first shot remains responsive');
weapon.update(time+180,false);
assert.equal(hud.ammo,tapAmmo-1,'180ms click does not accidentally double fire');
mouse('mouseup');weapon.update(time+500,false);
assert.equal(hud.ammo,tapAmmo-1,'release cancels automatic repeat');
mouse('mousedown');weapon.update(time+700,false);
assert.equal(hud.ammo,tapAmmo-2,'next deliberate click still fires');
weapon.update(time+920,false);assert.equal(hud.ammo,tapAmmo-3,'holding starts repeat');
weapon.update(time+1044,false);assert.equal(hud.ammo,tapAmmo-3);
weapon.update(time+1045,false);assert.equal(hud.ammo,tapAmmo-4,'AR retains 125ms sustained rate');
mouse('mouseup');
remote.dispose();weapon.dispose();scene.dispose();engine.dispose();
console.log('PASS: AR 8/60 preserved, local online firing/reload/fire-rate, zero damage callbacks, remote flash/recoil/cleanup, independent ammo and bot-mode restoration.');
