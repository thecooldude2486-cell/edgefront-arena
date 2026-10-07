import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server=process.env.TEST_SERVER_URL ? null : createRoomServer({port:0});
if(server)await once(server.http,'listening');
const url=process.env.TEST_SERVER_URL || 'ws://127.0.0.1:'+server.http.address().port;
const clients=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
const latest=(s,type)=>s.messages.filter(m=>m.type===type).at(-1);
const send=(s,m)=>s.send(JSON.stringify(m));
async function until(check){for(let i=0;i<200;i++){if(check())return;await wait(10);}throw Error('Timed out');}
async function connect(){const s=new WebSocket(url,{origin:'http://localhost:3000'});s.messages=[];s.on('message',d=>s.messages.push(JSON.parse(d)));clients.push(s);await once(s,'open');return s;}
try {
  const a=await connect(),b=await connect(),outsider=await connect();
  send(a,{type:'create'});await until(()=>latest(a,'room'));
  send(b,{type:'join',code:latest(a,'room').code});await until(()=>latest(b,'room')?.ready);
  send(a,{type:'setName',name:'theopgamer',player:2});await until(()=>latest(b,'room')?.names[0]==='theopgamer');
  assert.deepEqual(latest(a,'nameAccepted'),{type:'nameAccepted',name:'theopgamer'});
  assert.equal(latest(b,'room').names[1],'Player2','cannot rename opponent');
  send(b,{type:'setName',name:'  '});await until(()=>latest(b,'error'));
  assert.equal(latest(b,'nameAccepted'),undefined);
  await wait(210);send(b,{type:'setName',name:'Nova42'});await until(()=>latest(a,'room')?.names[1]==='Nova42');
  send(outsider,{type:'setName',name:'Intruder',code:latest(a,'room').code});await until(()=>latest(outsider,'error'));
  assert.deepEqual(latest(a,'room').names,['theopgamer','Nova42']);
  send(a,{type:'combatReady'});await until(()=>latest(a,'health'));
  await wait(210);send(a,{type:'setName',name:'Changed'});await until(()=>latest(a,'error'));
  assert.match(latest(a,'error').message,/locked/);
  assert.deepEqual(latest(a,'room').names,['theopgamer','Nova42']);
  console.log('PASS: server name validation, both-client names, socket-owned identity, outsider rejection and match lock.');
}finally{clients.forEach(s=>s.terminate());if(server)await server.close();}
