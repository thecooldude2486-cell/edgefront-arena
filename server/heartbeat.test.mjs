import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
const server = createRoomServer({ port: 0, reconnectGraceMs: 1500 });
await once(server.http, 'listening');
const clients = [],
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const latest = (socket, type) =>
  socket.messages.filter((message) => message.type === type).at(-1);
async function until(check, timeout = 16000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (check()) return;
    await wait(20);
  }
  throw Error('Timed out');
}
async function peer(ack) {
  const socket = new WebSocket('ws://127.0.0.1:' + server.http.address().port, {
    origin: 'http://localhost:3000',
  });
  clients.push(socket);
  socket.messages = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data);
    socket.messages.push(message);
    if (ack && message.type === 'netProbe')
      socket.send(JSON.stringify({ type: 'netAck', id: message.id }));
  });
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'enableResume' }));
  await until(() => latest(socket, 'session'));
  return socket;
}
try {
  // Native WebSocket pong still works; the game acknowledgement deliberately stalls.
  const a = await peer(false),
    b = await peer(true);
  a.send(JSON.stringify({ type: 'create' }));
  await until(() => latest(a, 'room'));
  const code = latest(a, 'room').code;
  b.send(JSON.stringify({ type: 'join', code }));
  await until(() => latest(b, 'room')?.ready);
  await until(() => latest(b, 'room')?.paused);
  assert.equal(
    a.readyState,
    WebSocket.CLOSED,
    'Server ends an unresponsive game connection without waiting for TCP close',
  );
  assert.equal(latest(b, 'room').code, code);
  assert.equal(
    latest(b, 'room').ready,
    true,
    'Reconnect grace reserves the stalled player slot',
  );
  assert.deepEqual(latest(b, 'room').players, [false, true]);
  assert.ok(latest(b, 'netStats'), 'Responsive opponent remains connected');
  await until(() => latest(b, 'closed'), 4000);
  console.log(
    'PASS: stalled application heartbeat triggers disconnect, match pause and reserved slot, while responsive opponent stays connected; grace expiry closes the room.',
  );
} finally {
  clients.forEach((socket) => socket.terminate());
  await server.close();
}
