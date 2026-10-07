import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server = createRoomServer({ port: 0 });
await once(server.http, 'listening');
const url = 'ws://127.0.0.1:' + server.http.address().port;
const clients = [];
async function connect() {
  const ws = new WebSocket(url, { origin: 'http://localhost:3000' }); clients.push(ws);
  await once(ws, 'open'); return ws;
}
const next = ws => Promise.race([once(ws, 'message').then(([data]) => JSON.parse(data.toString())), new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Message timeout')), 2000); timer.unref(); })]);
try {
  const a = await connect(), b = await connect(), c = await connect();
  let message = next(a); a.send(JSON.stringify({ type: 'create' }));
  const first = await message;
  assert.match(first.code, /^[A-Z2-9]{6}$/); assert.equal(first.player, 1);
  assert.deepEqual(first.players, [true, false]);
  const aReady = next(a), bReady = next(b);
  b.send(JSON.stringify({ type: 'join', code: first.code.toLowerCase() }));
  for (const room of await Promise.all([aReady, bReady])) { assert.equal(room.ready, true); assert.deepEqual(room.players, [true, true]); }
  message = next(c); c.send(JSON.stringify({ type: 'join', code: first.code }));
  assert.match((await message).message, /full/);
  message = next(a); b.close(); assert.deepEqual((await message).players, [true, false]);
  await new Promise(resolve => setTimeout(resolve, 160));
  const joined = next(c); message = next(a); c.send(JSON.stringify({ type: 'join', code: first.code }));
  assert.equal((await joined).player, 2); assert.equal((await message).ready, true);
  message = next(c); a.close(); assert.equal((await message).type, 'closed');
  await new Promise(resolve => setTimeout(resolve, 160));
  message = next(c); c.send(JSON.stringify({ type: 'join', code: first.code }));
  assert.match((await message).message, /not found/);
  console.log('PASS: create, two-player ready, third rejected, disconnect, replacement guest, host cleanup.');
} finally { clients.forEach(ws => ws.terminate()); await server.close(); }
