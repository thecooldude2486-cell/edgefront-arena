import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server = createRoomServer({ port: 0 }); await once(server.http, 'listening');
const clients = [];
async function connect() {
  const ws = new WebSocket('ws://127.0.0.1:' + server.http.address().port, { origin: 'http://localhost:3000' });
  clients.push(ws); await once(ws, 'open'); return ws;
}
const next = ws => once(ws, 'message').then(([data]) => JSON.parse(data));
const wait = () => new Promise(resolve => setTimeout(resolve, 170));
try {
  const a = await connect(), b = await connect(), outsider = await connect();
  let reply = next(a); a.send(JSON.stringify({type: 'create'})); const room = await reply;
  let ready = next(a); reply = next(b); b.send(JSON.stringify({type: 'join', code:room.code})); await ready; await reply;
  const p1 = { x: 1, y: .9, z: -16, yaw: .3, pitch: .2 };
  const p2 = { x: -2, y: 1.8, z: 15, yaw: 3, pitch: -.1 };
  reply = next(b); a.send(JSON.stringify({type:'move', player:2, health:0, pose:p1}));
  assert.deepEqual(await reply, {type:'move', player:1, pose:p1});
  reply = next(a); b.send(JSON.stringify({type:'move', pose:p2}));
  assert.deepEqual(await reply, {type:'move', player:2, pose:p2});
  const messages = []; b.on('message', data => messages.push(JSON.parse(data)));
  a.send(JSON.stringify({type:'move', pose:p1})); // too soon: limited
  outsider.send(JSON.stringify({type:'move', code:room.code, pose:p1}));
  await wait(); assert.equal(messages.length, 0, 'flood and outsider cannot relay');
  a.send(JSON.stringify({type:'move', pose:{...p1, x:9999}}));
  a.send(JSON.stringify({type:'move', pose:{...p1, x:null}}));
  await wait(); assert.equal(messages.length, 0, 'rejects invalid/out-of-bounds coordinates');
  a.send(JSON.stringify({type:'move', pose:p1})); await wait(); assert.equal(messages.length, 1);
  console.log('PASS: bidirectional movement, server-assigned identity, position validation, rate limit, room isolation, no combat data.');
} finally { clients.forEach(ws => ws.terminate()); await server.close(); }
