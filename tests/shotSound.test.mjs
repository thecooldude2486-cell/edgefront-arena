import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s,c,next) {
  if(s.startsWith('@babylonjs/core/')&&!s.endsWith('.js'))return next(s+'.js',c);
  if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(s+'.ts',c);
  return next(s,c);
}});
const { createShotSound } = await import('../game/createWeapon.ts');
let focused=true,played=0;
globalThis.document={hidden:false,hasFocus:()=>focused};
const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
globalThis.AudioContext=class {
  currentTime=0;state='running';destination={};
  createOscillator(){return {frequency:param,connect(){return this;},start(){played++;},stop(){}};}
  createGain(){return {gain:param,connect(){return this;}};}
  close(){return Promise.resolve();}
};
const local=createShotSound(),remote=createShotSound();
try {
  local.playShot();assert.equal(played,1,'one local shot produces one sound');
  focused=false;remote.playShot();
  assert.equal(played,1,'unfocused opponent tab must not echo the local shot');
  focused=true;document.hidden=true;remote.playShot();
  assert.equal(played,1,'hidden tabs are silent even if focus state is stale');
  document.hidden=false;remote.playShot();
  assert.equal(played,2,'opponent shots remain audible in the active game tab');
  assert.equal(played,2,'suppressed sounds are not queued for later');
  console.log('PASS: one local sound, no duplicate from inactive/hidden tabs, active opponent sound preserved.');
} finally {local.dispose();remote.dispose();}
