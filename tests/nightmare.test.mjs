import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import {NullEngine,Scene,UniversalCamera,Vector3} from '@babylonjs/core';
const {createBot} = await import('../game/createBot.ts');
import {DIFFICULTIES,NIGHTMARE_TACTICS as tactics} from '../game/difficulty.ts';
const oldRandom=Math.random;Math.random=()=>.5;globalThis.window=new EventTarget();window.setTimeout=()=>0;
const engine=new NullEngine(),scene=new Scene(engine),camera=new UniversalCamera('camera',new Vector3(0,1.7,0),scene);
let hits=0;
const bot=createBot(scene,camera,{onEliminated(){},onHealthChange(){},isPlayerAlive:()=>true,onPlayerHit(){hits++;}},()=> 'nightmare');
try {
  const settings=DIFFICULTIES.nightmare;let now=100000;
  bot.update(0,now);now+=settings.reactionMs;
  for(let i=0;i<tactics.burstShots;i++){bot.update(0,now);now+=settings.shotMs+settings.jitterMs*.5;}
  assert.equal(hits,tactics.burstShots,'Standing exposed is punished by accurate rapid bursts');
  bot.update(0,now);assert.equal(hits,tactics.burstShots,'Burst recovery offers a brief punish window');
  now+=tactics.recoveryMs;bot.update(0,now);assert.equal(hits,tactics.burstShots+1);
  while(hits<tactics.magazine){now+=tactics.recoveryMs;bot.update(0,now);}
  bot.update(0,now+tactics.reloadMs-1);assert.equal(hits,tactics.magazine,'Reload cannot fire early');
  bot.update(0,now+tactics.reloadMs);assert.equal(hits,tactics.magazine+1);
  bot.reset();hits=0;now+=10000;camera.position.set(0,1.7,0);bot.update(0,now);
  camera.position.x=1.5;bot.update(0,now+settings.reactionMs);
  assert.equal(hits,0,'A sharp direction change beats delayed tracking');
  bot.update(0,now+settings.reactionMs+tactics.recoveryMs);assert.equal(hits,1,'Standing still again lets Rook recover accuracy');
  assert.equal(bot.health,100,'Nightmare has normal health');
  // Perfect headshot timing can win even against Rook's most accurate burst.
  bot.reset();hits=0;now+=10000;camera.position.set(0,1.7,0);bot.update(0,now);
  let playerHealth=100,nextBullet=now;
  for(let t=now;t<=now+1000 && bot.alive && playerHealth>0;t+=5) {
    const prior=hits;bot.update(0,t);playerHealth-=15*(hits-prior);
    if(t>=nextBullet){bot.takeDamage('assaultRifle','head');nextBullet=t+125;}
  }
  assert.equal(bot.alive,false,'Accurate sustained headshots can eliminate Nightmare');assert.ok(playerHealth>0,'The skilled player survives');
  console.log('PASS: lethal pressure, exploitable burst/reload windows, movement counterplay, recovered tracking and unchanged health.');
}finally{bot.dispose();scene.dispose();engine.dispose();Math.random=oldRandom;}
