import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';

export const PAGES_ORIGIN = 'https://thecooldude2486-cell.github.io';

export async function checkHostedRooms(address, { allowLocal = false } = {}) {
  const endpoint = new URL(address);
  if (endpoint.protocol === 'https:') endpoint.protocol = 'wss:';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  assert.ok(
    endpoint.protocol === 'wss:' ||
      (allowLocal && local && endpoint.protocol === 'ws:'),
    'The published game requires a secure wss:// room-server address.',
  );
  assert.ok(!endpoint.username && !endpoint.password && !endpoint.hash,
    'Use a public server address without credentials or a fragment.');
  const health = new URL('/health', endpoint);
  health.protocol = endpoint.protocol === 'wss:' ? 'https:' : 'http:';
  const response = await fetch(health, { signal: AbortSignal.timeout(90000) });
  assert.equal(response.status, 200, 'The room server health check must pass.');
  const status = await response.json();
  assert.equal(status.service, 'edgefront-rooms');
  assert.equal(status.ready, true);
  assert.deepEqual(status.teamSizes, [1, 2, 3, 4, 5]);

  const results = [];
  const send = (peer, message) => peer.socket.send(JSON.stringify(message));
  const latest = (peer, type = 'teamState') =>
    peer.messages.filter((message) => message.type === type).at(-1);
  async function until(check, label) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (check()) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Timed out: ' + label);
  }
  for (const size of [1, 2, 3, 4, 5]) {
    const peers = [];
    async function connect() {
      const peer = {
        socket: new WebSocket(endpoint, {
          origin: PAGES_ORIGIN,
          handshakeTimeout: 15000,
        }),
        messages: [],
      };
      peers.push(peer);
      peer.socket.on('message', (data) => {
        const message = JSON.parse(data);
        peer.messages.push(message);
        if (message.type === 'netProbe')
          send(peer, { type: 'netAck', id: message.id });
      });
      peer.socket.on('error', () => {});
      await new Promise((resolve, reject) => {
        peer.socket.once('error', reject);
        peer.socket.once('open', () => {
          peer.socket.off('error', reject);
          resolve();
        });
      });
      return peer;
    }
    try {
      const host = await connect();
      send(host, { type: 'teamCreate', size, team: 1, visibility: 'private' });
      await until(() => latest(host), size + 'v' + size + ' room creation');
      const initial = latest(host);
      assert.equal(initial.size, size);
      assert.equal(initial.phase, 'waiting');
      assert.equal(Math.floor(initial.slot / size), size === 1 ? 0 : 1,
        'Team-mode hosts can select Coral; duels use fixed opposing slots.');
      for (let index = 1; index < size * 2; index++) {
        const joiner = await connect();
        send(joiner, { type: 'teamJoin', code: initial.code, team: 1 });
        await until(() => latest(joiner), 'join player ' + (index + 1));
        assert.equal(latest(joiner).code, initial.code);
        assert.equal(Math.floor(latest(joiner).slot / size),
          size === 1 ? 1 : index < size ? 1 : 0,
          'A full preferred team assigns the player to the other team.');
      }
      await until(() => latest(host).phase === 'voting', 'full room starts voting');
      const state = latest(host);
      assert.equal(state.players.filter((player) => player.connected).length, size * 2);
      assert.equal(state.players.filter((player) => player.occupied).length, size * 2);
      const overflow = await connect();
      send(overflow, { type: 'teamJoin', code: initial.code });
      await until(() => latest(overflow, 'teamError'), 'full room rejection');
      assert.match(latest(overflow, 'teamError').message, /full|playing/);
      results.push({ mode: size + 'v' + size, players: size * 2, passed: true });
      send(host, { type: 'teamLeave' });
      await until(() => latest(host, 'teamLeft'), 'test room cleanup');
    } finally {
      peers.forEach((peer) => peer.socket.terminate());
    }
  }
  return { origin: PAGES_ORIGIN, health: 'ready', rooms: results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const address = process.argv[2] || process.env.VITE_MULTIPLAYER_URL;
    assert.ok(address, 'Run: node server/check-hosted.mjs https://YOUR-SERVER.onrender.com');
    console.log(JSON.stringify(await checkHostedRooms(address), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
