import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual React connection effect with deterministic browser timers.
const source = await readFile(new URL('../components/TeamOnlineRooms.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('rooms.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let body;
function find(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' &&
      node.arguments[0]?.getText(ast).includes('new WebSocket(url)')) body = node.arguments[0].body.getText(ast);
  ts.forEachChild(node, find);
}
find(ast);
assert.ok(body, 'Found room connection effect');
// A block cannot be invoked directly; compile it as a function expression.
const runnable = ts.transpileModule(`(() => ${body.replaceAll('import.meta.env.VITE_MULTIPLAYER_URL', "'wss://rooms.example'")})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(inRoom = false) {
  let now = 1000, id = 0, status, error;
  const timers = new Map(), sockets = [];
  const schedule = (fn, delay, repeat = false) => { timers.set(++id, { fn, at: now + delay, delay, repeat }); return id; };
  class Socket {
    static CONNECTING = 0; static OPEN = 1;
    readyState = 0;
    constructor() { sockets.push(this); }
    send() {}
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen?.(); }
  }
  const noop = () => {};
  const context = {
    Date: { now: () => now }, WebSocket: Socket, location: { hostname: 'thecooldude2486-cell.github.io' },
    sessionStorage: { getItem: () => null, removeItem: noop }, KEY: 'test',
    token: { current: null }, socket: { current: null }, roomRef: { current: inRoom ? {} : null },
    needsResume: { current: false }, game: { setOnlineNetworkPaused: noop, setOnlineEffectListener: noop, setPreMatchLocked: noop, enterLobby: noop },
    setNetworkStatus: value => { status = value; }, setError: value => { error = value; },
    setConnected: noop, setPing: noop, setClock: noop, send: noop,
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: value => timers.delete(value),
    setInterval: (fn, delay) => schedule(fn, delay, true), clearInterval: value => timers.delete(value),
    queueMicrotask: fn => fn(),
  };
  const cleanup = vm.runInNewContext(runnable.replace(/;\s*$/, '') + '()', context);
  function advance(ms) {
    const until = now + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [key, timer] = next; now = timer.at;
      if (timer.repeat) timer.at += timer.delay; else timers.delete(key);
      timer.fn();
    }
    now = until;
  }
  return { sockets, advance, cleanup, timers, status: () => status, error: () => error };
}
{
  const h = harness();
  h.advance(45000);
  assert.ok(h.sockets.length >= 3, 'Stalled handshakes are retried');
  assert.equal(h.status(), 'reconnecting', 'Cold startup continues beyond the old 30-second limit');
  h.sockets.at(-1).open();
  assert.equal(h.status(), 'connected');
  h.advance(1000);
  assert.equal(h.status(), 'connected', 'Handshake timeout was cleared on open');
  h.cleanup();
  assert.equal(h.timers.size, 0, 'Unmount clears connection and retry timers');
}
{
  const h = harness(); h.advance(150000);
  assert.equal(h.status(), 'unavailable');
  assert.match(h.error(), /did not wake up/);
  h.cleanup();
}
{
  const h = harness(true); h.advance(50000);
  assert.equal(h.status(), 'unavailable', 'Existing rooms retain the bounded reconnect window');
  assert.match(h.error(), /Reconnect timed out/);
  h.cleanup();
}
console.log('PASS: actual connection effect retries sleeping servers, times out stalled handshakes, connects after 45 seconds, preserves match reconnect bounds and cleans up timers.');
