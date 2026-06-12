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
  defaultWsTransport,
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

// ── Transport ───────────────────────────────────────────────────────────────

/**
 * WsClientTransport backed by Tauri invoke.
 *
 * The `messages` operation returns a synthetic success envelope with empty
 * messages array because Studio receives messages via `ws-message` Tauri
 * events — not by polling. `ws_receive_next` exists for programmatic use
 * (runner, workflow engine) but is not exposed through this transport.
 */
export const wsNativeTauriTransport: WsClientTransport = async (
  request: WsDispatchRequest,
): Promise<WsEnvelope> => {
  const spec = COMMAND_MAP[request.op];

  if (spec.command === '_events') {
    return {
      ok: true,
      op: request.op,
      data: { connectionId: '', messages: [], cursor: 0, bufferSize: 0 },
      meta: { timestamp: new Date().toISOString() },
    };
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

// Re-export defaultWsTransport for fallback scenarios
export { defaultWsTransport };
