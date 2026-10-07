import type { OnlineServerMessage } from './onlineProtocol';
export const ROOM_SESSION_KEY = 'edgefront.online.session.v1';
export type ConnectionStatus = {
  connected: boolean;
  reconnecting: boolean;
  attempt: number;
  rttMs: number | null;
};
type WireSocket = Pick<
  WebSocket,
  | 'readyState'
  | 'bufferedAmount'
  | 'send'
  | 'close'
  | 'onopen'
  | 'onclose'
  | 'onmessage'
  | 'onerror'
>;
type Options = {
  url: string;
  onMessage: (message: OnlineServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  makeSocket?: (url: string) => WireSocket;
  now?: () => number;
  retryWindowMs?: number;
  retryDelayMs?: number;
  connectTimeoutMs?: number;
  watchdogMs?: number;
};
// Reconnect control traffic only. Gameplay packets are never queued or replayed.
export function createRoomConnection(options: Options) {
  const now = options.now ?? Date.now;
  let ws: WireSocket | null = null,
    disposed = false,
    token: string | null = null,
    attempt = 0,
    deadline = 0,
    lastReceived = now(),
    rttMs: number | null = null,
    connected = false,
    reconnecting = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined,
    connectTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const saved = options.storage?.getItem(ROOM_SESSION_KEY);
    if (saved && /^[a-f0-9]{48}$/.test(saved)) token = saved;
  } catch {
    /* A live session can reconnect without browser saving. */
  }
  function clearToken() {
    token = null;
    try {
      options.storage?.removeItem(ROOM_SESSION_KEY);
    } catch {
      /* Optional session persistence. */
    }
  }
  function status() {
    options.onStatus({ connected, reconnecting, attempt, rttMs });
  }
  function schedule() {
    connected = false;
    rttMs = null;
    attempt++;
    if (!deadline) deadline = now() + (options.retryWindowMs ?? 30000);
    reconnecting = now() < deadline;
    status();
    if (!reconnecting) return;
    retryTimer = setTimeout(
      connect,
      options.retryDelayMs ??
        Math.min(3000, 500 * 2 ** Math.min(attempt - 1, 3)),
    );
  }
  function abandon(socket: WireSocket, code: number, reason: string) {
    if (disposed || ws !== socket) return;
    clearTimeout(connectTimer);
    ws = null;
    socket.onopen = socket.onclose = socket.onmessage = socket.onerror = null;
    socket.close(code, reason);
    schedule();
  }
  function connect() {
    if (disposed) return;
    clearTimeout(retryTimer);
    clearTimeout(connectTimer);
    let next: WireSocket;
    try {
      next = (options.makeSocket ?? ((url) => new WebSocket(url)))(options.url);
    } catch {
      schedule();
      return;
    }
    ws = next;
    lastReceived = now();
    connectTimer = setTimeout(() => {
      if (next.readyState !== 1) abandon(next, 4000, 'Connection timed out');
    }, options.connectTimeoutMs ?? 5000);
    next.onopen = () => {
      if (disposed || ws !== next) return;
      clearTimeout(connectTimer);
      lastReceived = now();
      connected = true;
      reconnecting = !!token;
      status();
      next.send(
        JSON.stringify(
          token ? { type: 'resume', token } : { type: 'enableResume' },
        ),
      );
      next.send(JSON.stringify({ type: 'listRooms' }));
    };
    next.onmessage = (event) => {
      if (disposed || ws !== next) return;
      let raw: unknown;
      try {
        raw = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (
        !raw ||
        typeof raw !== 'object' ||
        !('type' in raw) ||
        typeof raw.type !== 'string'
      )
        return;
      const message = raw as OnlineServerMessage;
      lastReceived = now();
      if (message.type === 'netProbe' && Number.isSafeInteger(message.id)) {
        if (next.bufferedAmount < 4096)
          next.send(JSON.stringify({ type: 'netAck', id: message.id }));
        return;
      }
      if (
        message.type === 'netStats' &&
        Number.isFinite(message.rttMs) &&
        message.rttMs >= 0
      ) {
        rttMs = Math.round(message.rttMs);
        status();
        return;
      }
      if (
        message.type === 'session' &&
        typeof message.token === 'string' &&
        /^[a-f0-9]{48}$/.test(message.token)
      ) {
        token = message.token;
        try {
          options.storage?.setItem(ROOM_SESSION_KEY, message.token);
        } catch {
          /* Keep in memory. */
        }
        attempt = 0;
        deadline = 0;
        reconnecting = false;
        status();
      }
      if (message.type === 'resumeRejected' && message.retryable === true) {
        abandon(next, 4001, 'Waiting for previous connection');
        return;
      }
      if (message.type === 'resumeRejected') {
        clearToken();
        reconnecting = false;
        attempt = 0;
        deadline = 0;
        status();
        next.send(JSON.stringify({ type: 'enableResume' }));
      }
      options.onMessage(message);
    };
    next.onerror = () => {
      /* Close/timeout drives the bounded retry loop. */
    };
    next.onclose = () => {
      if (disposed || ws !== next) return;
      clearTimeout(connectTimer);
      ws = null;
      schedule();
    };
  }
  const watchdog = setInterval(() => {
    if (
      !disposed &&
      ws?.readyState === 1 &&
      now() - lastReceived > (options.watchdogMs ?? 10000)
    )
      abandon(ws, 4000, 'Connection timed out');
  }, 1000);
  connect();
  return {
    send(message: unknown) {
      if (
        disposed ||
        !connected ||
        reconnecting ||
        ws?.readyState !== 1 ||
        ws.bufferedAmount >= 4096
      )
        return false;
      ws.send(JSON.stringify(message));
      return true;
    },
    retry() {
      if (disposed) return;
      deadline = 0;
      attempt = 0;
      reconnecting = true;
      status();
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
      connect();
    },
    dispose() {
      disposed = true;
      clearTimeout(retryTimer);
      clearTimeout(connectTimer);
      clearInterval(watchdog);
      clearToken();
      if (ws) {
        ws.onopen = ws.onclose = ws.onmessage = ws.onerror = null;
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'leave' }));
        ws.close();
        ws = null;
      }
    },
  };
}
