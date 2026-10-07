import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from 'ws';
import {createRoomServer} from './index.mjs';
import {WEAPON_DEFINITIONS} from '../game/weaponDefinitions.ts';
const server=process.env.TEST_SERVER_URL?null:createRoomServer({port:0});
if(server)await once(server.http,'listening');
const url=process.env.TEST_SERVER_URL || 'ws://127.0.0.1:'+server.http.address().port;
const clients=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const send=(ws,message)=>ws.send(JSON.stringify(message));
const latest=(ws,type)=>ws.messages.filter(message=>message.type===type).at(-1);
async function until(check,timeout=4000){const end=Date.now()+timeout;while(Date.now()<end){if(check())return;await wait(10);}throw Error('Timed out');}
async function connect(){const ws=new WebSocket(url,{origin:'http://localhost:3000'});ws.messages=[];ws.on('message',data=>ws.messages.push(JSON.parse(data)));clients.push(ws);await once(ws,'open');return ws;}
async function room(weapon){
 const a=await connect(),b=await connect();send(a,{type:'create'});await until(()=>latest(a,'room'));
 send(b,{type:'join',code:latest(a,'room').code});await until(()=>latest(b,'room')?.ready);
 const z=WEAPON_DEFINITIONS[weapon].fireMode==='Melee'?-14:['molotov','grenade'].includes(weapon)?-9:-12;
 for(const [index,ws] of [a,b].entries()){
  send(ws,{type:'combatReady'});send(ws,{type:'equip',weapon});
  send(ws,{type:'move',pose:{x:0,y:.9,z:index===0?-16:z,yaw:index===0?0:Math.PI,pitch:0}});
 }
 await until(()=>latest(a,'move')&&latest(b,'move')&&latest(a,'health')&&latest(b,'health'));
 return [a,b];
}
const fire=(a,weapon,sequence,y=1.05)=>send(a,{type:'effect',action:'fire',weapon,sequence,
 origin:{x:0,y,z:-16},direction:{x:0,y:0,z:1},damage:999,ammo:999,health:0,player:2});
try{
 for(const weapon of Object.keys(WEAPON_DEFINITIONS)){
  const [a,b]=await room(weapon),stats=WEAPON_DEFINITIONS[weapon];
  fire(a,weapon,1);
  const damage=weapon==='rocketLauncher'?67:stats.bodyDamage;
  await until(()=>latest(b,'health').players[1].health===100-damage);
  assert.deepEqual(latest(a,'health'),latest(b,'health'),weapon+' health agrees on both clients');
  assert.equal(latest(a,'hit').kind,weapon==='rocketLauncher'?'direct':'body');assert.equal(latest(b,'hit'),undefined,'Only shooter receives hit marker');
  assert.equal(latest(b,'effect').weapon,weapon);
  assert.equal(latest(b,'effect').player,1,'Identity comes from room');
  assert.equal(Object.hasOwn(latest(b,'effect'),'damage'),false);
  fire(a,weapon,1);await wait(20);
  if(weapon==='molotov'){
   await until(()=>latest(b,'health').players[1].health===50,6000);
   await wait(600);assert.equal(latest(b,'health').players[1].health,50,'Fire expires after ten ticks');
  }else if(stats.fireMode==='Melee'){
   send(b,{type:'move',pose:{x:0,y:.9,z:-12,yaw:Math.PI,pitch:0}});await wait(stats.fireDelayMs);
   fire(a,weapon,2);await wait(100);assert.equal(latest(b,'health').players[1].health,100-damage,'Melee misses outside range');
  }else if(!['rocketLauncher','grenade'].includes(weapon)){
   await wait(stats.fireDelayMs);fire(a,weapon,2,1.52);
   await until(()=>latest(b,'health').players[1].health===Math.max(0,100-damage-stats.headDamage));
   assert.equal(latest(a,'hit').kind,'head');assert.deepEqual(latest(a,'health'),latest(b,'health'));
  }
  console.log('PASS network:',weapon);
  a.terminate();b.terminate();
 }
 // Delayed damage must finish a round, freeze old projectiles, then reset ammo.
 for(const weapon of ['rocketLauncher','grenade','molotov']){
  const [a,b]=await room(weapon);
  send(a,{type:'equip',weapon:'sniper'});await until(()=>latest(b,'equip')?.weapon==='sniper');
  fire(a,'sniper',1);await until(()=>latest(b,'health').players[1].health===66);
  send(a,{type:'equip',weapon:'assaultRifle'});await until(()=>latest(b,'equip')?.weapon==='assaultRifle');
  for(let i=0;i<3;i++){
   fire(a,'assaultRifle',2+i);
   await until(()=>latest(b,'health').players[1].health===66-(i+1)*WEAPON_DEFINITIONS.assaultRifle.bodyDamage);
   await wait(WEAPON_DEFINITIONS.assaultRifle.fireDelayMs+30);
  }
  await until(()=>latest(b,'health').players[1].health===30);
  send(a,{type:'equip',weapon});await until(()=>latest(b,'equip')?.weapon===weapon);fire(a,weapon,5);
  await until(()=>latest(a,'score')?.phase==='roundOver',7000);
  assert.deepEqual(latest(a,'score'),latest(b,'score'));assert.deepEqual(latest(a,'score').scores,[1,0]);
  assert.equal(latest(a,'score').performances[0].damageDealt,100,'Delayed damage contributes actual health removed to XP');
  await until(()=>latest(a,'score')?.round===2);assert.deepEqual(latest(a,'health').players.map(p=>p.health),[100,100]);
  for(const [index,ws] of [a,b].entries()){
   send(ws,{type:'combatReady'});send(ws,{type:'equip',weapon});
   send(ws,{type:'move',pose:{x:0,y:.9,z:index===0?-16:['grenade','molotov'].includes(weapon)?-9:-12,yaw:index===0?0:Math.PI,pitch:0}});
  }
  await wait(80);fire(a,weapon,6);await until(()=>latest(b,'health').players[1].health<100,4000);
  assert.deepEqual(latest(a,'score').scores,[1,0],'Fresh round utility/ammo restored; old damage never adds a point');
  console.log('PASS delayed elimination/reset:',weapon);a.terminate();b.terminate();
 }
 console.log('PASS: all ten weapons through real WebSocket clients, matching health/markers, validated payloads, headshots, range, delayed eliminations, XP, round cleanup and ammo reset.');
}finally{clients.forEach(ws=>ws.terminate());if(server)await server.close();}
