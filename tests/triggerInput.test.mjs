import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s,c,next) {
  if(s.startsWith('@babylonjs/core/')&&!s.endsWith('.js'))return next(s+'.js',c);
  if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(s+'.ts',c);
  return next(s,c);
}});
const { NullEngine, Scene, UniversalCamera, Vector3 } = await import('@babylonjs/core');
const { createWeapon } = await import('../game/createWeapon.ts');
globalThis.window=new EventTarget();globalThis.document=new EventTarget();
const canvas=new EventTarget();document.pointerLockElement=canvas;
const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
globalThis.AudioContext=class { currentTime=0;state='running';destination={};
  createOscillator(){return {frequency:param,connect(){return this;},start(){},stop(){}};}
  createGain(){return {gain:param,connect(){return this;}};}
  close(){return Promise.resolve();}
};
const engine=new NullEngine(),scene=new Scene(engine),camera=new UniversalCamera('test',Vector3.Zero(),scene);
let ammo=0,shots=0,time=performance.now();
const weapon=createWeapon(scene,camera,canvas,{onAmmoChange:n=>ammo=n,onImpact:()=> 'none',onHitMarker(){},onVisualShot:()=>shots++});
weapon.setVisualOnly(true);
function event(target,type,button,buttons){const e=new Event(type);Object.assign(e,{button,buttons,pointerType:'mouse'});target.dispatchEvent(e);}
try {
  // Browser mouse chording: pointerup does NOT fire when left is released
  // while right remains held. Only mouseup and pointermove are delivered.
  event(canvas,'pointerdown',0,1);event(canvas,'mousedown',0,1);
  weapon.update(time+=20,false);assert.equal(shots,1);
  event(canvas,'pointermove',2,3);event(canvas,'mousedown',2,3);
  event(window,'pointermove',0,2);event(window,'mouseup',0,2);
  weapon.update(time+=500,false);
  assert.equal(shots,1,'releasing fire while holding aim must stop firing');
  assert.equal(ammo,19);
  event(window,'pointerup',2,0);event(window,'mouseup',2,0);

  // Aim first, then press fire: there is no second pointerdown either.
  event(canvas,'pointerdown',2,2);event(canvas,'mousedown',2,2);
  event(canvas,'pointermove',0,3);event(canvas,'mousedown',0,3);
  weapon.update(time+=500,false);assert.equal(shots,2,'fire works while already aiming');
  event(window,'mouseup',0,2);weapon.update(time+=500,false);assert.equal(shots,2);
  event(window,'mouseup',2,0);

  event(canvas,'mousedown',0,1);weapon.update(time+=500,false);assert.equal(shots,3);
  window.dispatchEvent(new Event('blur'));weapon.update(time+=500,false);assert.equal(shots,3,'blur stops a lost release');
  event(canvas,'mousedown',0,1);weapon.update(time+=500,false);assert.equal(shots,4);
  window.dispatchEvent(new Event('pointercancel'));weapon.update(time+=500,false);assert.equal(shots,4,'cancel stops a lost release');
  console.log('PASS: real mouse button chording, left release while aiming, aim-first shooting, ammo, blur and pointer cancellation.');
} finally {weapon.dispose();scene.dispose();engine.dispose();}
