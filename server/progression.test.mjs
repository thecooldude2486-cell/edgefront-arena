import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server=process.env.TEST_SERVER_URL?null:createRoomServer({port:0});if(server)await once(server.http,'listening');
const url=process.env.TEST_SERVER_URL || 'ws://127.0.0.1:'+server.http.address().port, clients=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const latest=(s,type)=>s.messages.filter(m=>m.type===type).at(-1);
async function until(check){for(let i=0;i<200;i++){if(check())return;await wait(10);}throw Error('Timed out');}
async function connect(){const s=new WebSocket(url,{origin:'http://localhost:3000'});s.messages=[];s.on('message',d=>s.messages.push(JSON.parse(d)));clients.push(s);await once(s,'open');return s;}
const send=(s,m)=>s.send(JSON.stringify(m));
try {
  const a=await connect(), b=await connect(), outsider=await connect();
  send(a,{type:'create'});await until(()=>latest(a,'room'));
  send(b,{type:'join',code:latest(a,'room').code});await until(()=>latest(b,'room')?.ready);
  send(a,{type:'profile',player:2,profile:{level:1000000,cosmetics:{skin:999995,wrap:10,charm:15},health:999}});
  await until(()=>latest(b,'room')?.profiles?.[0]?.level===1000000);
  assert.equal(latest(b,'room').profiles[1].level,1);
  assert.deepEqual(latest(a,'room').profiles[0],{level:1000000,cosmetics:{skin:999995,wrap:10,charm:15}});
  send(b,{type:'profile',profile:{level:5,cosmetics:{skin:5,wrap:10,charm:15}}});
  await until(()=>latest(a,'room')?.profiles?.[1]?.level===5);
  assert.deepEqual(latest(a,'room').profiles[1].cosmetics,{skin:5,wrap:null,charm:null});
  send(outsider,{type:'profile',code:latest(a,'room').code,profile:{level:9999999}});
  await wait(150); assert.equal(latest(b,'room').profiles[0].level,1000000);
  send(b,{type:'profile',profile:{level:-1}}); await wait(150);assert.equal(latest(a,'room').profiles[1].level,5);
  send(a,{type:'profile',profile:{level:1000000,cosmetics:{skin:-1,wrap:-6,charm:-3},character:{suit:'prism',visor:'violet',gear:'halo'}}});
  await until(()=>latest(b,'room')?.profiles?.[0]?.character?.gear==='halo');
  assert.deepEqual(latest(b,'room').profiles[0].character,{suit:'prism',visor:'violet',gear:'halo'});
  assert.deepEqual(latest(b,'room').profiles[0].cosmetics,{skin:-1,wrap:-6,charm:-3});
  await wait(120);
  send(a,{type:'profile',profile:{level:1000000,cosmetics:{skin:-4,wrap:-7,charm:-9},character:{suit:'solar',visor:'ice',gear:'signal'}}});
  await until(()=>latest(b,'room')?.profiles?.[0]?.character?.gear==='signal');
  assert.deepEqual(latest(a,'room').profiles[0],latest(b,'room').profiles[0],'Both peers receive live shop appearance changes');
  send(b,{type:'profile',profile:{level:5,character:{suit:'bad',visor:'bad',gear:'bad'},cosmetics:{skin:-100,wrap:-200,charm:-300}}});
  await until(()=>latest(a,'room')?.profiles?.[1]?.character?.gear==='none');
  assert.deepEqual(latest(a,'room').profiles[1].character,{suit:'standard',visor:'dark',gear:'none'});
  assert.deepEqual(latest(a,'room').profiles[1].cosmetics,{skin:null,wrap:null,charm:null});
  send(a,{type:'combatReady'});await until(()=>latest(a,'health'));
  assert.deepEqual(latest(a,'health').players.map(p=>p.health),[100,100]);
  assert.deepEqual(latest(a,'score').scores,[0,0]);
  console.log('PASS: both-player character/shop/career cosmetic sync, uncapped levels, socket identity, locked rewards and unchanged combat.');
} finally { clients.forEach(s=>s.terminate());if(server)await server.close(); }
