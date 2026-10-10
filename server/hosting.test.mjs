import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createRoomServer } from './index.mjs';
import { checkHostedRooms, PAGES_ORIGIN } from './check-hosted.mjs';

const server = createRoomServer({ port: 0, host: '0.0.0.0', origins: [PAGES_ORIGIN] });
await once(server.http, 'listening');
const url = 'ws://127.0.0.1:' + server.http.address().port;
try {
  await assert.rejects(checkHostedRooms(url), /secure wss/);
  const results = await checkHostedRooms(url, { allowLocal: true });
  assert.equal(results.health, 'ready');
  assert.equal(results.origin, PAGES_ORIGIN);
  assert.deepEqual(results.rooms.map((room) => room.players), [2, 4, 6, 8, 10]);
  const health = await fetch(url.replace('ws:', 'http:') + '/health?probe=1');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.match(health.headers.get('content-type'), /application\/json/);
  assert.equal((await health.json()).ready, true);
  const forbidden = new WebSocket(url, { origin: 'https://unrelated.example' });
  const rejected = await new Promise((resolve, reject) => {
    forbidden.once('error', resolve);
    forbidden.once('open', () => {
      forbidden.terminate();
      reject(new Error('Unexpected origin was accepted.'));
    });
  });
  assert.match(rejected.message, /401|403/);
  console.log('PASS: hosted setup accepts the GitHub Pages origin, creates and fills all five team modes, honors host preferences and team limits, rejects overflow and other origins, and exposes uncached readiness.');
} finally {
  await server.close();
}
