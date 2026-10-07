import assert from 'node:assert/strict';
const { createRoomConnection, ROOM_SESSION_KEY } =
  await import('../game/createRoomConnection.ts');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let now = 1000;
const sockets = [],
  statuses = [],
  messages = [],
  values = new Map(),
  token = 'a'.repeat(48);
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
class FakeSocket {
  readyState = 0;
  bufferedAmount = 0;
  sent = [];
  send(value) {
    this.sent.push(JSON.parse(value));
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  close() {
    this.readyState = 3;
    this.onclose?.({});
  }
}
const connection = createRoomConnection({
  url: 'ws://game',
  storage,
  now: () => now,
  makeSocket: () => {
    const s = new FakeSocket();
    sockets.push(s);
    return s;
  },
  onStatus: (status) => statuses.push(status),
  onMessage: (message) => messages.push(message),
  retryDelayMs: 5,
  retryWindowMs: 100,
});
try {
  const first = sockets[0];
  first.open();
  assert.equal(first.sent[0].type, 'enableResume');
  first.receive({ type: 'session', token });
  assert.equal(storage.getItem(ROOM_SESSION_KEY), token);
  assert.equal(connection.send({ type: 'effect', sequence: 1 }), true);
  first.bufferedAmount = 4096;
  assert.equal(connection.send({ type: 'effect', sequence: 2 }), false);
  first.bufferedAmount = 0;
  first.receive({ type: 'netProbe', id: 17 });
  assert.deepEqual(first.sent.at(-1), { type: 'netAck', id: 17 });
  first.receive({ type: 'netStats', rttMs: 48 });
  assert.equal(statuses.at(-1).rttMs, 48);
  first.close();
  assert.equal(
    connection.send({ type: 'effect', sequence: 3 }),
    false,
    'Offline attacks are dropped',
  );
  await wait(20);
  const second = sockets[1];
  second.open();
  assert.deepEqual(second.sent[0], { type: 'resume', token });
  assert.equal(
    connection.send({ type: 'effect', sequence: 4 }),
    false,
    'Gameplay waits for resume validation',
  );
  second.receive({ type: 'session', token, resumed: true });
  assert.equal(statuses.at(-1).reconnecting, false);
  assert.equal(
    second.sent.some((message) => message.type === 'effect'),
    false,
    'No stale shot replay',
  );
  second.close();
  now += 101;
  await wait(20);
  const third = sockets[2];
  third.close();
  assert.equal(statuses.at(-1).reconnecting, false, 'Retry window is bounded');
  connection.retry();
  const fourth = sockets[3];
  fourth.open();
  fourth.receive({ type: 'resumeRejected', message: 'Expired' });
  assert.equal(fourth.sent.at(-1).type, 'enableResume');
  assert.equal(storage.getItem(ROOM_SESSION_KEY), null);
  fourth.receive({ type: 'session', token: 'b'.repeat(48) });
  connection.dispose();
  assert.equal(fourth.sent.at(-1).type, 'leave');
  assert.equal(storage.getItem(ROOM_SESSION_KEY), null);
  assert.equal(connection.send({ type: 'effect' }), false);
  const count = sockets.length;
  await wait(20);
  assert.equal(sockets.length, count, 'Disposed transport cannot reconnect');
  const refresh = createRoomConnection({
    url: 'ws://game',
    storage: { ...storage, getItem: () => token },
    onMessage() {},
    onStatus() {},
    makeSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
  });
  const boot = sockets.at(-1);
  boot.open();
  assert.equal(
    boot.sent[0].token,
    token,
    'Page refresh reads saved session token',
  );
  refresh.dispose();
  // Browsers can remain CLOSING on a broken network without firing onclose.
  const stalledSockets = [];
  let stalledNow = 0;
  const stalled = createRoomConnection({
    url: 'ws://game',
    now: () => stalledNow,
    watchdogMs: 100,
    retryDelayMs: 5,
    onMessage() {},
    onStatus() {},
    makeSocket: () => {
      const socket = new FakeSocket();
      socket.close = () => {
        socket.readyState = 2;
      };
      stalledSockets.push(socket);
      return socket;
    },
  });
  try {
    const stale = stalledSockets[0];
    stale.open();
    stale.receive({ type: 'session', token });
    stalledNow = 101;
    await wait(1100);
    assert.ok(
      stalledSockets.length >= 2,
      'Watchdog reconnects without waiting for a close event',
    );
    assert.equal(
      stale.onmessage,
      null,
      'Late packets from the abandoned socket are ignored',
    );
    assert.equal(
      stalled.send({ type: 'effect' }),
      false,
      'New connection has not resumed yet',
    );
  } finally {
    stalled.dispose();
  }
  const connectingSockets = [];
  const connecting = createRoomConnection({
    url: 'ws://game',
    connectTimeoutMs: 5,
    retryDelayMs: 5,
    onMessage() {},
    onStatus() {},
    makeSocket: () => {
      const socket = new FakeSocket();
      socket.close = () => {
        socket.readyState = 2;
      };
      connectingSockets.push(socket);
      return socket;
    },
  });
  try {
    await wait(40);
    assert.ok(
      connectingSockets.length >= 2,
      'Timed-out handshakes do not wait for onclose',
    );
  } finally {
    connecting.dispose();
  }
  console.log(
    'PASS: saved resume handshake, ping, reconnect/backoff, no queued or congested shots, expired-token recovery, manual retry and complete dispose cleanup.',
  );
} finally {
  connection.dispose();
}
