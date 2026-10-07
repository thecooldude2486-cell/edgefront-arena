import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import { NullEngine, Scene, TransformNode, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
const { createWeaponCosmetics } = await import('../game/createWeaponCosmetics.ts');
const engine = new NullEngine(), scene = new Scene(engine);
const root = new TransformNode('weapon',scene), opponent = new TransformNode('opponent',scene);
const original = new StandardMaterial('pearl shell',scene);original.diffuseColor=Color3.White();
const mesh=MeshBuilder.CreateBox('receiver',{},scene);mesh.parent=root;mesh.material=original;
const other=MeshBuilder.CreateBox('other receiver',{},scene);other.parent=opponent;other.material=original;
const optic=MeshBuilder.CreateBox('optic',{},scene);optic.parent=root;
const energy=new StandardMaterial('energy rail',scene);energy.emissiveColor=Color3.White();optic.material=energy;
const before=scene.materials.length, finish=createWeaponCosmetics(root);
finish.apply({skin:5,wrap:10,charm:15});
assert.notEqual(mesh.material,original);assert.equal(other.material,original);assert.notEqual(optic.material,energy);
assert.equal(optic.material.diffuseTexture,mesh.material.diffuseTexture,'Wrap covers optics and receiver');
assert.equal(root.getChildMeshes().find(m=>m.name==='career charm chain').material.diffuseTexture,null,'Charm stays unwrapped');
assert.ok(root.getChildMeshes().some(m=>m.name==='career wrap band'));
assert.ok(root.getChildMeshes().some(m=>m.name==='career charm chain'));
assert.ok(root.getChildMeshes().every(m=>!m.name.startsWith('career')||!m.isPickable));
assert.ok(root.getChildMeshes().find(m=>m.name==='career wrap band').material.diffuseTexture, 'Actual sleeve uses patterned artwork');
assert.deepEqual({...root.getChildMeshes().find(m=>m.name==='career wrap band').material.diffuseTexture.getSize()},{width:256,height:256});
const count=scene.materials.length;finish.apply({skin:5,wrap:10,charm:15});assert.equal(scene.materials.length,count);
finish.update(1);
finish.apply({skin:20,wrap:25,charm:30});assert.equal(scene.materials.length,count);
finish.apply({skin:null,wrap:null,charm:null});assert.equal(mesh.material,original);assert.equal(optic.material,energy);assert.equal(root.getChildMeshes().length,2);assert.equal(scene.materials.length,before);assert.equal(scene.textures.length,0,'Wrap texture released on reset');
finish.dispose();scene.dispose();engine.dispose();
console.log('PASS: full wrap coverage, unwrapped charms, isolated materials, restored optics, no collisions, repeat/replace/reset and cleanup.');

const { populateWeaponModels } = await import('../game/createWeapon.ts');
const { populateSwordModel } = await import('../game/createSwordModel.ts');
const { populateOrbiterModel } = await import('../game/createOrbiterModel.ts');
const engine2=new NullEngine(), scene2=new Scene(engine2);
const rifle=new TransformNode('test rifle',scene2), pistol=new TransformNode('test pistol',scene2);
populateWeaponModels(scene2,rifle,pistol);
const sword=new TransformNode('test sword',scene2), orbiter=new TransformNode('test orbiter',scene2);
populateSwordModel(scene2,sword);populateOrbiterModel(scene2,orbiter);
for(const weapon of [rifle,pistol,sword,orbiter]) {
  const custom=createWeaponCosmetics(weapon), baseline=scene2.meshes.length;
  const silhouettes=new Set();
  for(let variant=0;variant<8;variant++) {
    custom.apply({skin:5,wrap:10,charm:15*(variant+1)});
    const mount=weapon.getChildren().find(node=>node.name==='career accessories');
    silhouettes.add(mount.getChildMeshes().map(mesh=>mesh.name).join('|'));
    const grip=weapon.getChildMeshes().find(mesh=>mesh.isEnabled() && /grip|sceptre/.test(mesh.name));
    assert.ok(grip.getChildren().some(node=>node.name==='career fitted wrap'),'Wrap mounted on grip, not weapon origin');
    assert.ok(mount.getChildMeshes().every(mesh=>!mesh.isPickable&&!mesh.checkCollisions));
  }
  assert.equal(silhouettes.size,8);
  custom.dispose();assert.equal(scene2.meshes.length,baseline,'All fitted attachments removed');
}
scene2.dispose();engine2.dispose();
console.log('PASS: eight distinct Edgefront charms, grip fitting on AR/pistol/sword/orbiter, preserved geometry and replacement cleanup.');

const engine3=new NullEngine(),scene3=new Scene(engine3),firstRifle=new TransformNode('first rewards rifle',scene3),firstPistol=new TransformNode('first rewards pistol',scene3);
populateWeaponModels(scene3,firstRifle,firstPistol);
const firstFinish=createWeaponCosmetics(firstRifle);firstFinish.apply({skin:2,wrap:3,charm:4});
const receiver=firstRifle.getChildMeshes().find(mesh=>mesh.name==='career skin bullpup receiver');
assert.ok(receiver.isEnabled());assert.match(receiver.material.diffuseTexture.name,/patterned wrap/,'Equipped wrap covers the receiver too');
const stock=firstRifle.getChildMeshes().find(mesh=>mesh.name==='career skin sculpted stock');
assert.match(stock.material.diffuseTexture.name,/patterned wrap/,'Wrap reaches the redesigned stock');
assert.equal(firstRifle.getChildMeshes().find(mesh=>mesh.name==='kestrel pearl receiver').isEnabled(),false,'Default casing hidden while a skin is equipped');
const charmMount=firstRifle.getChildren().find(node=>node.name==='career accessories').getChildren().find(node=>node.name==='career swinging charm');
assert.ok(charmMount.position.x < -.2,'Charm clears the casing on the visible first-person side');
firstFinish.dispose();assert.equal(scene3.textures.length,0);scene3.dispose();engine3.dispose();
console.log('PASS: first three rewards visibly change armour panels, patterned wraps cover the entire gun and charm sits outside the casing.');
