import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from 'ws';
import {createRoomServer} from './index.mjs';
const server=createRoomServer({port:0});await once(server.http,'listening');
const clients=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const latest=(ws,type)=>ws.messages.filter(message=>message.type===type).at(-1);
async function until(check){for(let i=0;i<300;i++){if(check())return;await wait(10);}throw Error('Timed out');}
async function connect(){const ws=new WebSocket('ws://127.0.0.1:'+server.http.address().port,{origin:'http://localhost:3000'});ws.messages=[];ws.on('message',data=>ws.messages.push(JSON.parse(data)));clients.push(ws);await once(ws,'open');return ws;}
const send=(ws,data)=>ws.send(JSON.stringify(data));
try{
 const a=await connect(),b=await connect(),c=await connect();
 send(a,{type:'create'});await until(()=>latest(a,'room'));
 send(b,{type:'join',code:latest(a,'room').code});await until(()=>latest(b,'room')?.ready);
 send(a,{type:'combatReady'});send(b,{type:'combatReady'});await until(()=>latest(a,'health')&&latest(b,'health'));
 for(const [sender,receiver,player] of [[a,b,1],[b,a,2]]){
   for(const weapon of ['pistol','assaultRifle']){
     send(sender,{type:'equip',weapon,player:99,ammo:8,reserve:60,damage:100});
     await until(()=>latest(receiver,'equip')?.weapon===weapon);
     assert.deepEqual(latest(receiver,'equip'),{type:'equip',player,weapon});
   }
 }
 for(const [index,ws] of [a,b].entries()) send(ws,{type:'move',pose:{x:0,y:.9,z:index===0?-16:16,yaw:index===0?0:Math.PI,pitch:0}});
 await until(()=>latest(a,'move')&&latest(b,'move'));
 for(const [sender,receiver,player] of [[a,b,1],[b,a,2]]) {
   const z=player===1?-16:16,direction={x:0,y:0,z:player===1?1:-1},origin={x:0,y:1.05,z};
   send(sender,{type:'move',pose:{x:0,y:.9,z,yaw:player===1?0:Math.PI,pitch:0}});
   send(sender,{type:'equip',weapon:'pistol'});await until(()=>latest(receiver,'equip')?.weapon==='pistol');
   let sequence=0;
   for(const action of ['fire','reload','reloadEnd']) {
     if(action==='reloadEnd')await wait(1510);
     const payload=action==='fire'?{origin,direction}:{};
     send(sender,{type:'effect',action,weapon:'pistol',sequence:++sequence,...payload,damage:100,ammo:100,player:99});
     await until(()=>latest(receiver,'effect')?.action===action);
     assert.deepEqual(latest(receiver,'effect'),{type:'effect',player,action,weapon:'pistol',...payload});
   }
   send(sender,{type:'equip',weapon:'grenade'});await until(()=>latest(receiver,'equip')?.weapon==='grenade');
   send(sender,{type:'effect',action:'fire',weapon:'grenade',sequence:++sequence,origin,direction,player:99,damage:100});
   await until(()=>latest(receiver,'effect')?.weapon==='grenade');
   assert.deepEqual(latest(receiver,'effect'),{type:'effect',player,action:'fire',weapon:'grenade',origin,direction});
 }
 const combatPackets=()=>b.messages.filter(message=>['equip','effect','shot','grenade','hit'].includes(message.type)).length;
 const count=combatPackets();
 for(const packet of [{type:'shot',weapon:'pistol'},{type:'shot',weapon:'grenade'},{type:'shot',weapon:'fake'},
   {type:'grenade',origin:{x:0,y:1,z:0},direction:{x:0,y:0,z:1}},{type:'equip',weapon:'invented'}]) send(a,packet);
 send(c,{type:'equip',weapon:'pistol',code:latest(a,'room').code});
 await wait(160);assert.equal(combatPackets(),count,'Invalid and legacy packets cannot bypass combat validation');
 const pose={x:2,y:.9,z:-10,yaw:0,pitch:0};send(a,{type:'move',pose});await until(()=>latest(b,'move')?.pose.x===2);
 assert.deepEqual(latest(b,'move'),{type:'move',player:1,pose});
 console.log('PASS: bidirectional equipment and validated weapon effects, stripped identity/damage/ammo payloads, utility relay, legacy/outsider rejection and movement.');
}finally{clients.forEach(ws=>ws.terminate());await server.close();}
