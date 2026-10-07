import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
// Optionally verify the actual running local server, using a disposable private room.
const server=process.env.TEST_SERVER_URL ? null : createRoomServer({port:0});
if (server) await once(server.http,'listening');
const serverUrl=process.env.TEST_SERVER_URL || 'ws://127.0.0.1:'+server.http.address().port;
const clients=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function connect() {
  const socket=new WebSocket(serverUrl,{origin:'http://localhost:3000'});
  socket.messages=[]; socket.on('message',data=>socket.messages.push(JSON.parse(data)));
  clients.push(socket); await once(socket,'open'); return socket;
}
const send=(s,m)=>s.send(JSON.stringify(m));
async function until(check) { for(let i=0;i<200;i++){if(check())return;await wait(10);} throw Error('Timed out waiting for server'); }
const latest=(s,type)=>s.messages.filter(m=>m.type===type).at(-1);
try {
  const a=await connect(),b=await connect(),outsider=await connect();
  send(a,{type:'create'}); await until(()=>latest(a,'room'));
  send(b,{type:'join',code:latest(a,'room').code}); await until(()=>latest(b,'room')?.ready);
  for(const [sender,receiver,player] of [[a,b,1],[b,a,2]]) {
    for(const weapon of ['pistol','assaultRifle']) {
      send(sender,{type:'equip',weapon,player:99,damage:100,ammo:900});
      await until(()=>latest(receiver,'equip')?.weapon===weapon);
      assert.deepEqual(latest(receiver,'equip'),{type:'equip',player,weapon});
    }
  }
  send(a,{type:'combatReady'});send(b,{type:'combatReady'});
  await until(()=>latest(a,'health')&&latest(b,'health'));
  assert.deepEqual(latest(a,'health').players.map(p=>p.health),[100,100]);
  const poses=[{x:0,y:.9,z:-16,yaw:0,pitch:0},{x:0,y:.9,z:-12,yaw:Math.PI,pitch:0}];
  send(a,{type:'move',pose:poses[0]});send(b,{type:'move',pose:poses[1]});
  await until(()=>latest(a,'move')&&latest(b,'move'));
  const fire=(s,player,seq,y=1.05)=>send(s,{type:'effect',action:'fire',weapon:'assaultRifle',sequence:seq,
    origin:{x:0,y,z:poses[player-1].z},direction:{x:0,y:0,z:player===1?1:-1},player:99,damage:999,health:0});
  fire(a,1,1); await until(()=>latest(b,'health').players[1].health===88);
  assert.deepEqual(latest(a,'health'),latest(b,'health'));
  assert.equal(latest(b,'effect').player,1);
  assert.deepEqual(latest(a,'hit'),{type:'hit',kind:'body',sequence:1});
  assert.equal(latest(b,'hit'),undefined,'victim does not receive shooter hit marker');
  fire(b,2,1,1.52); await until(()=>latest(a,'health').players[0].health===85);
  assert.deepEqual(latest(a,'health'),latest(b,'health'));
  assert.deepEqual(latest(b,'hit'),{type:'hit',kind:'head',sequence:1});
  fire(a,1,1); fire(outsider,1,99);
  send(a,{type:'health',players:[{health:0},{health:0}]});
  send(a,{type:'shot',weapon:'assaultRifle',damage:999});
  await wait(150); assert.deepEqual(latest(a,'health').players.map(p=>p.health),[85,88]);
  send(a,{type:'move',pose:{...poses[0],yaw:Math.PI/2}});
  send(a,{type:'effect',action:'fire',weapon:'assaultRifle',sequence:2,origin:{x:0,y:1.52,z:-16},direction:{x:1,y:0,z:0}});
  await wait(150); assert.equal(latest(b,'health').players[1].health,88,'miss does no damage');
  assert.equal(a.messages.filter(m=>m.type==='hit').length,1,'misses and duplicate shots produce no marker');
  send(a,{type:'move',pose:poses[0]});
  for(let seq=3;seq<=10;seq++){fire(a,1,seq);await wait(140);}
  await until(()=>latest(b,'health').players[1].health===0);
  assert.deepEqual(latest(a,'health'),latest(b,'health'));
  assert.deepEqual(latest(a,'hit'),{type:'hit',kind:'body',sequence:10},'lethal shot retains actual region');
  const count=a.messages.filter(m=>m.type==='effect').length;
  fire(b,2,55);send(b,{type:'grenade',origin:{x:0,y:1,z:-12},direction:{x:0,y:0,z:1}});
  await wait(160);assert.equal(a.messages.filter(m=>m.type==='effect').length,count,'eliminated fire not relayed');
  assert.equal(latest(a,'health').players[0].health,85);
  console.log('PASS: two clients agree on health, bidirectional 12/15 damage, equip/movement, identity spoofing, miss, duplicate/outsider/legacy rejection and elimination.');
} finally { clients.forEach(s=>s.terminate());if (server) await server.close(); }
