import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import {NullEngine,Vector3,Matrix,Viewport} from '@babylonjs/core';
const {createShopPreview}=await import('../game/createShopPreview.ts');
globalThis.ResizeObserver=class {observe(){}disconnect(){}};
const canvas=new EventTarget();canvas.setPointerCapture=()=>{};
let frame,engine,focus=false,cosmetics={skin:5,wrap:null,charm:15};
const dispose=createShopPreview(canvas,'assaultRifle',()=>cosmetics,()=>focus,()=>{
 engine=new NullEngine({renderWidth:900,renderHeight:500});engine.runRenderLoop=callback=>{frame=callback;};return engine;
});
const scene=engine.scenes[0];frame();
const whole=scene.activeCamera.position.clone();focus=true;
for(let i=0;i<8;i++){
 cosmetics={skin:5+i*15,wrap:i%2 ? 10 : null,charm:15+i*15};frame();
 const miniature=scene.getTransformNodeByName('career miniature '+i);
 assert.ok(miniature);assert.ok(scene.activeCamera.minZ<.1,'Close-up near plane allows objects less than one metre away');
 for(const mesh of miniature.getChildMeshes())for(const point of mesh.getBoundingInfo().boundingBox.vectorsWorld){
  const screen=Vector3.Project(point,Matrix.Identity(),scene.getTransformMatrix(),new Viewport(0,0,900,500));
  assert.ok(screen.z>0 && screen.z<1,'Close-up charm is not clipped out of the view');
  assert.ok(screen.x>0 && screen.x<900 && screen.y>0 && screen.y<500,'Whole miniature fits the close-up');
 }
}
focus=false;frame();assert.ok(Vector3.Distance(whole,scene.activeCamera.position)<1e-6,'Whole-weapon button restores camera');
focus=true;frame();cosmetics={skin:5,wrap:null,charm:null};frame();assert.ok(Vector3.Distance(whole,scene.activeCamera.position)<1e-6,'Resetting charm exits close-up safely');
dispose();console.log('PASS: actual preview render loop frames all eight close-ups, survives skin/wrap changes, restores whole weapon and handles charm reset.');
