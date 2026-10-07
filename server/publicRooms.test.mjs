import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server=process.env.TEST_SERVER_URL ? null : createRoomServer({port:0});
if(server) await once(server.http,'listening');
const url=process.env.TEST_SERVER_URL || 'ws://127.0.0.1:'+server.http.address().port;
const clients=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
const latest=(s,type)=>s.messages.filter(m=>m.type===type).at(-1);
const send=(s,m)=>s.send(JSON.stringify(m));
async function until(check){for(let i=0;i<200;i++){if(check())return;await wait(10);}throw Error('Timed out');}
async function connect(){const s=new WebSocket(url,{origin:'http://localhost:3000'});s.messages=[];s.on('message',d=>s.messages.push(JSON.parse(d)));clients.push(s);await once(s,'open');return s;}
try {
  const viewer=await connect(),privateHost=await connect(),publicHost=await connect(),guest=await connect(),extra=await connect();
  send(viewer,{type:'listRooms'});await until(()=>latest(viewer,'rooms'));
  send(privateHost,{type:'create'});await until(()=>latest(privateHost,'room'));
  const privateCode=latest(privateHost,'room').code;
  assert.equal(latest(privateHost,'room').visibility,'private','default stays private');
  send(publicHost,{type:'create',visibility:'public'});await until(()=>latest(publicHost,'room'));
  const code=latest(publicHost,'room').code;
  await until(()=>latest(viewer,'rooms').rooms.some(r=>r.code===code));
  assert.ok(!latest(viewer,'rooms').rooms.some(r=>r.code===privateCode),'private code never exposed');
  assert.deepEqual(latest(viewer,'rooms').rooms.find(r=>r.code===code),{code,players:1,mapId:'stadium'});
  send(guest,{type:'join',code});await until(()=>latest(guest,'room')?.ready);
  await until(()=>latest(viewer,'rooms').rooms.find(r=>r.code===code)?.players===2);
  send(extra,{type:'join',code});await until(()=>latest(extra,'error'));
  assert.match(latest(extra,'error').message,/full/);
  guest.close();await until(()=>latest(viewer,'rooms').rooms.find(r=>r.code===code)?.players===1);
  publicHost.close();await until(()=>!latest(viewer,'rooms').rooms.some(r=>r.code===code));
  await wait(160);send(extra,{type:'join',code:privateCode});await until(()=>latest(extra,'room')?.ready);
  assert.equal(latest(extra,'room').visibility,'private','private room still joinable by code');
  const invalid=await connect();send(invalid,{type:'create',visibility:'invented'});await until(()=>latest(invalid,'error'));
  assert.match(latest(invalid,'error').message,/Public or Private/);
  console.log('PASS: private default/hidden, public listing, live occupancy, full rejection, removal, private code joining, invalid visibility.');
}finally{clients.forEach(s=>s.terminate());if(server)await server.close();}
