import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import {NullEngine,Scene,TransformNode,UniversalCamera,Vector3,Matrix,Viewport} from '@babylonjs/core';
const {populateWeaponModels}=await import('../game/createWeapon.ts');
const {populateSniperModel}=await import('../game/createSniperModel.ts');
const {populateUziModel}=await import('../game/createUziModel.ts');
const {populateLaserModel}=await import('../game/createLaserModel.ts');
const {populateLauncherModel}=await import('../game/createRockets.ts');
const {createWeaponCosmetics}=await import('../game/createWeaponCosmetics.ts');
const engine=new NullEngine({renderWidth:1280,renderHeight:720}),scene=new Scene(engine);
const camera=new UniversalCamera('camera',Vector3.Zero(),scene);camera.fov=1.05;
const rifle=new TransformNode('rifle',scene),pistol=new TransformNode('pistol',scene);
populateWeaponModels(scene,rifle,pistol);
const roots=[rifle,pistol];
for(const [name,populate] of [['sniper',populateSniperModel],['smg',populateUziModel],['laser',populateLaserModel],['launcher',populateLauncherModel]]){
 const root=new TransformNode(name,scene);populate(scene,root);roots.push(root);
}
for(const root of roots){
  root.parent=camera;root.position.set(.46,-.38,.88);
  const originals=root.getChildMeshes(),baseline={meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length};
  const finish=createWeaponCosmetics(root),shapes=new Set();
  for(let pattern=0;pattern<8;pattern++){
    finish.apply({skin:5+pattern*15,wrap:3,charm:4});
    const model=root.getChildren().find(node=>node.name.startsWith('career skin model /'));
    assert.ok(model,'Every gun has a full replacement model');
    assert.ok(originals.every(mesh=>!mesh.isEnabled()),'Entire default gun hidden');
    const meshes=model.getChildMeshes();
    shapes.add(JSON.stringify(meshes.map(mesh=>[mesh.name,mesh.position.asArray(),mesh.getTotalVertices()])));
    assert.ok(meshes.every(mesh=>!mesh.isPickable&&!mesh.checkCollisions));
    assert.ok(meshes.every(mesh=>mesh.material.diffuseTexture?.name.startsWith('career patterned wrap')),'Wrap covers every replacement surface, including barrel, frame and optic');
    const miniature=root.getDescendants().find(node=>node.name.startsWith('career miniature '));
    const charmMeshes=miniature.getChildMeshes();
    assert.ok(charmMeshes.every(mesh=>mesh.material.diffuseTexture===null),'Charms keep their own design');
    scene.render();
    for(const mesh of charmMeshes){
      const screen=Vector3.Project(mesh.getAbsolutePosition(),Matrix.Identity(),scene.getTransformMatrix(),new Viewport(0,0,1280,720));
      assert.ok(screen.x>0 && screen.x<1280 && screen.y>0 && screen.y<720 && screen.z>0 && screen.z<1,root.name+' charm inside first-person view');
    }
    // A real mesh hit test confirms the charm is outside, not buried behind the casing.
    const front=camera.position.clone(),point=charmMeshes[0].getAbsolutePosition();
    const {Ray}=await import('@babylonjs/core');
    const delta=point.subtract(front),distance=delta.length();const pick=scene.pickWithRay(new Ray(front,delta.normalize(),distance+.1),mesh=>mesh.isEnabled() && (mesh.isDescendantOf(model) || mesh.isDescendantOf(miniature)));
    assert.ok(pick?.pickedMesh?.isDescendantOf(miniature),root.name+' charm is unobstructed from the player camera');
  }
  assert.equal(shapes.size,8,'Eight structurally different gun designs');
  finish.apply({skin:null,wrap:3,charm:4});
  assert.ok(originals.every(mesh=>mesh.material.diffuseTexture?.name.startsWith('career patterned wrap')),'Wrap also covers the complete standard issue gun');
  finish.apply({skin:5,wrap:null,charm:null});
  const plainModel=root.getChildren().find(node=>node.name.startsWith('career skin model /'));assert.ok(plainModel.getChildMeshes().every(mesh=>mesh.material.diffuseTexture===null),'Full skin with no wrap has no surface pattern');assert.equal(scene.textures.length,baseline.textures);
  finish.apply({skin:null,wrap:null,charm:null});
  assert.ok(originals.every(mesh=>mesh.isEnabled()),'Reset restores original gun');
  assert.deepEqual({meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length},baseline,'No geometry/material/texture leaks across skin replacements');
  finish.dispose();root.setEnabled(false);
}
rifle.setEnabled(true);
const charms=createWeaponCosmetics(rifle);
for(const position of [new Vector3(.46,-.38,.88),new Vector3(0,-.22,.56)]) {
  rifle.position.copyFrom(position);
  for(let pattern=0;pattern<8;pattern++) {
    charms.apply({skin:null,wrap:null,charm:15+pattern*15});scene.render();
    const miniature=rifle.getDescendants().find(node=>node.name.startsWith('career miniature '));
    for(const mesh of miniature.getChildMeshes()) {
      for(const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
        const screen=Vector3.Project(corner,Matrix.Identity(),scene.getTransformMatrix(),new Viewport(0,0,1280,720));
        assert.ok(screen.x>0 && screen.x<1280 && screen.y>0 && screen.y<720,'Entire charm stays visible in hip fire and aiming, with no skin equipped');
      }
    }
  }
}
charms.dispose();scene.dispose();engine.dispose();
console.log('PASS: 48 full gun models, eight distinct silhouettes per gun, wraps on replacements, visible unobstructed charms, all eight charms framed during hip fire/aiming and complete reset/cleanup.');
