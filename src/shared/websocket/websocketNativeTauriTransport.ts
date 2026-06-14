/**
 * Native Tauri transport for WebSocket operations.
 *
 * Wires each WsProxyOperation to the corresponding Tauri Rust command via
 * `invoke` from @tauri-apps/api/core.  Both @tauri-apps/api/core and
 * @tauri-apps/api/event are dynamically imported INSIDE the function bodies
 * — never at the top level — so this module can be imported in browser/dev
 * mode without exploding when the Tauri global is absent.
 *
 * Command name table  (WsProxyOperation → Rust fn name):
 *   connect    → ws_connect
 *   disconnect → ws_disconnect
 *   send       → ws_send
 *   ping       → ws_ping
 *   status     → ws_status
 *   messages   → (synthetic — Studio uses ws-message events, not polling)
 */

import {
  WsClientError,
  throwIfWsEnvelopeNotOk,
  type WsClientTransport,
  type WsDispatchRequest,
  type WsEnvelope,
  type WsProxyOperation,
} from './websocketClient';

// ── Command mapping ─────────────────────────────────────────────────────────

interface CommandSpec {
  command: string;
  paramKey?: string;
}

const COMMAND_MAP: Record<WsProxyOperation, CommandSpec> = {
  connect:    { command: 'ws_connect',    paramKey: 'request' },
  disconnect: { command: 'ws_disconnect', paramKey: 'request' },
  send:       { command: 'ws_send',       paramKey: 'request' },
  ping:       { command: 'ws_ping',       paramKey: 'request' },
  status:     { command: 'ws_status',     paramKey: 'request' },
  messages:   { command: '_events' },
};

// ── Client-side message buffer for Tauri native transport ──────────────────
//
// The Rust read loop emits `ws-message` events.  Studio uses those for
// real-time display, but the workflow engine's `waitForMessage` needs
// polling-style `messages` calls that return buffered data.  We keep a
// per-connection buffer here and serve it when `messages` is requested.

interface BufferedMsg {
  data: string;
  type: string;
  receivedAt: string;
  size: number;
}

interface ConnectionBuffer {
  messages: BufferedMsg[];
  cursor: number;
}

const messageBuffers = new Map<string, ConnectionBuffer>();

/** Max messages per connection buffer before trimming the oldest. */
const MAX_BUFFER_SIZE = 500;

let listenerPromise: Promise<void> | null = null;

/**
 * Lazily starts a global `ws-message` listener that buffers incoming
 * messages.  Safe to call multiple times — the listener is set up once.
 */
function ensureMessageListener(): Promise<void> {
  if (!listenerPromise) {
    listenerPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      await listen<WsMessagePayload>('ws-message', (event) => {
        const p = event.payload;
        let buf = messageBuffers.get(p.connectionId);
        if (!buf) {
          buf = { messages: [], cursor: 0 };
          messageBuffers.set(p.connectionId, buf);
        }
        buf.messages.push({
          data: p.data,
          type: p.messageType ?? 'text',
          receivedAt: new Date(p.timestamp).toISOString(),
          size: p.data.length,
        });
        buf.cursor += 1;
        if (buf.messages.length > MAX_BUFFER_SIZE) {
          buf.messages = buf.messages.slice(buf.messages.length - MAX_BUFFER_SIZE);
        }
      });
    })();
  }
  return listenerPromise;
}

/**
 * Reset internal state — for tests only.  Clears message buffers and
 * forces the next `ensureMessageListener` call to re-register.
 * @internal
 */
export function _resetMessageBuffersForTesting(): void {
  messageBuffers.clear();
  listenerPromise = null;
}

/**
 * Serve the client-side message buffer for a `messages` request.
 * sinceCursor semantics mirror the Express proxy: return messages after
 * the given cursor index, or all messages if sinceCursor is 0/absent.
 */
function serveMessagesFromBuffer(request: WsDispatchRequest): WsEnvelope {
  const connectionId = request.query?.connectionId ?? '';
  const sinceCursor = Number(request.query?.sinceCursor) || 0;
  const buf = messageBuffers.get(connectionId);

  if (!buf) {
    return {
      ok: true,
      op: request.op,
      data: { connectionId, messages: [], cursor: 0, bufferSize: 0 },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  const bufferStartCursor = buf.cursor - buf.messages.length;
  const startIndex = Math.max(0, sinceCursor - bufferStartCursor);
  const messages = buf.messages.slice(startIndex);

  return {
    ok: true,
    op: request.op,
    data: { connectionId, messages, cursor: buf.cursor, bufferSize: buf.messages.length },
    meta: { timestamp: new Date().toISOString() },
  };
}

// ── Transport ───────────────────────────────────────────────────────────────

/**
 * WsClientTransport backed by Tauri invoke.
 *
 * The `messages` operation is served from a client-side buffer populated
 * by `ws-message` Tauri events emitted by the Rust read loop.  This
 * allows the workflow engine's polling-based `waitForMessage` to work
 * correctly in desktop mode.
 */
export const wsNativeTauriTransport: WsClientTransport = async (
  request: WsDispatchRequest,
): Promise<WsEnvelope> => {
  // Start the event listener early so messages arriving before the
  // first `messages` poll are captured.
  await ensureMessageListener();

  const spec = COMMAND_MAP[request.op];

  if (spec.command === '_events') {
    return serveMessagesFromBuffer(request);
  }

  const { invoke } = await import('@tauri-apps/api/core');

  const body = request.body ?? {};
  let args: Record<string, unknown>;
  if (request.method === 'GET') {
    const restored = restoreQueryTypes(request.query);
    args = spec.paramKey !== undefined ? { [spec.paramKey]: restored } : restored;
  } else {
    args = spec.paramKey !== undefined ? { [spec.paramKey]: body } : body;
  }

  let envelope: WsEnvelope;
  try {
    envelope = await invoke<WsEnvelope>(spec.command, args);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new WsClientError(request.op, message, {
      code: 'WS_INVOKE_ERROR',
      retryable: true,
    });
  }

  throwIfWsEnvelopeNotOk(request.op, envelope);

  // Clean up message buffer when a connection is disconnected.
  if (request.op === 'disconnect' && body && typeof body === 'object' && 'connectionId' in body) {
    messageBuffers.delete((body as { connectionId: string }).connectionId);
  }

  return envelope;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Restore JS types that buildQuery() serialised to strings for URL params.
 * Numbers are restored, 'true'/'false' become booleans.
 * Needed because GET operations pass query params as strings, but Rust
 * commands expect typed JSON values.
 */
function restoreQueryTypes(
  query: Record<string, string>,
): Record<string, string | boolean | number> {
  const result: Record<string, string | boolean | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === 'true') result[key] = true;
    else if (value === 'false') result[key] = false;
    else {
      const num = Number(value);
      if (!isNaN(num) && value.trim().length > 0) result[key] = num;
      else result[key] = value;
    }
  }
  return result;
}

// ── Event listeners ─────────────────────────────────────────────────────────

export interface WsMessagePayload {
  connectionId: string;
  data: string;
  messageType: string;
  timestamp: number;
}

export interface WsConnectionClosedPayload {
  connectionId: string;
  code?: number;
  reason?: string;
}

/**
 * Listen for streaming WebSocket messages from the native read loop.
 * Returns an unlisten function — call it to stop receiving events.
 */
export async function listenWsMessage(
  callback: (payload: WsMessagePayload) => void,
): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event');
  return listen<WsMessagePayload>('ws-message', (e) => callback(e.payload));
}

/**
 * Listen for WebSocket connection close events from the native module.
 * Returns an unlisten function — call it to stop receiving events.
 */
export async function listenWsConnectionClosed(
  callback: (payload: WsConnectionClosedPayload) => void,
): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event');
  return listen<WsConnectionClosedPayload>(
    'ws-connection-closed',
    (e) => callback(e.payload),
  );
}
