import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';

const server = createRoomServer({ port: 0 });
await once(server.http, 'listening');
const clients = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (socket, data) => socket.send(JSON.stringify(data));
const latest = (socket, type) => socket.messages.filter(message => message.type === type).at(-1);
async function until(check) {
  for (let i = 0; i < 300; i++) { if (check()) return; await wait(10); }
  throw Error('Timed out waiting for room state');
}
async function connect() {
  const socket = new WebSocket(`ws://127.0.0.1:${server.http.address().port}`, { origin: 'http://localhost:3000' });
  socket.messages = [];
  socket.on('message', data => socket.messages.push(JSON.parse(data)));
  clients.push(socket); await once(socket, 'open'); return socket;
}
try {
  const a = await connect(), b = await connect();
  send(a, { type: 'create' }); await until(() => latest(a, 'room'));
  send(b, { type: 'join', code: latest(a, 'room').code }); await until(() => latest(b, 'room')?.ready);
  send(a, { type: 'loadoutReady' });
  await wait(10500);
  assert.equal(latest(a, 'loadoutCountdown'), undefined, 'one ready player cannot start the timer');
  send(a, { type: 'combatReady' }); await wait(50);
  assert.equal(latest(a, 'health'), undefined, 'cannot start combat while opponent selects');
  send(b, { type: 'loadoutReady' });
  await until(() => latest(a, 'loadoutCountdown') && latest(b, 'loadoutCountdown'));
  assert.equal(latest(a, 'loadoutCountdown').remainingMs, 10000);
  send(a, { type: 'combatReady' }); await wait(50);
  assert.equal(latest(a, 'health'), undefined, 'combat locked during countdown');
  send(a, { type: 'loadoutReady' }); await wait(50);
  assert.equal(a.messages.filter(message => message.type === 'loadoutCountdown').length, 1, 'duplicate ready does not restart countdown');
  await wait(10000);
  send(a, { type: 'combatReady' }); send(b, { type: 'combatReady' });
  await until(() => latest(a, 'health') && latest(b, 'health'));
  console.log('PASS: unlimited selection, both-player readiness, shared 10-second countdown, early combat blocked, combat unlock.');
} finally { clients.forEach(socket => socket.terminate()); await server.close(); }
