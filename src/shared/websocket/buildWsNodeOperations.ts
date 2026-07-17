/**
 * Factory that creates a WsNodeOperations adapter backed by dispatchWsOperation.
 *
 * This bridges the generic WsNodeOperations interface (used by workflow node handlers)
 * to the concrete WebSocket proxy API (connect / send / messages / disconnect / status).
 *
 * Shape mappings:
 *  - connect: calls proxy connect, stores proxy connectionId in internal registry,
 *    returns WsConnectResult with negotiated protocol/extensions/latency.
 *  - send: looks up proxy connectionId from registry, calls proxy send.
 *  - waitForMessage: polls proxy messages endpoint at WS_POLL_INTERVAL_MS intervals,
 *    applies match criteria client-side, returns first match or throws on timeout.
 *  - disconnect: calls proxy disconnect, removes from registry.
 *  - disconnectAll: iterates registry, disconnects each (ignores individual errors).
 */

import type {
  WsNodeOperations,
  WsConnectResult,
  WsSendResult,
  WsReceivedMessage,
  WsMessageMatchCriteria,
} from '../../features/workflow/engine/graphRunnerNodeHandlerContext';
import { dispatchWsOperation, WsClientError } from './websocketClient';
import { getByPath } from '../utils/jsonPath';

/** Poll interval for waitForMessage (ms). */
const WS_POLL_INTERVAL_MS = 200;

/** Default connect timeout (ms). */
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

// ── Inline server response shapes (mirrors src-server/ws contracts) ──

interface ServerConnectResult {
  connectionId: string;
  protocol?: string;
  extensions?: string;
}

interface ServerSendResult {
  bytesSent?: number;
}

interface ServerMessage {
  data: string;
  type?: 'text' | 'binary';
  timestamp?: number;
  cursor?: string;
}

interface ServerMessagesResult {
  messages: ServerMessage[];
  cursor?: string;
}

// ── Match criteria helpers ──

function messageMatchesCriteria(
  msg: ServerMessage,
  criteria: WsMessageMatchCriteria,
): boolean {
  if (criteria.messageType && criteria.messageType !== 'any') {
    const msgType = msg.type ?? 'text';
    if (msgType !== criteria.messageType) return false;
  }

  if (criteria.contentContains) {
    if (!msg.data.includes(criteria.contentContains)) return false;
  }

  if (criteria.contentRegex) {
    try {
      const re = new RegExp(criteria.contentRegex);
      if (!re.test(msg.data)) return false;
    } catch {
      return false;
    }
  }

  if (criteria.jsonPathMatch) {
    try {
      const parsed = JSON.parse(msg.data);
      const value = getByPath(parsed, criteria.jsonPathMatch);
      if (value === undefined) return false;
      if (criteria.jsonPathValue !== undefined) {
        const strVal = typeof value === 'string' ? value : JSON.stringify(value);
        if (strVal !== criteria.jsonPathValue) return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Adapter factory ──

/**
 * Build a WsNodeOperations instance that uses dispatchWsOperation under the hood.
 * Maintains an internal connection registry mapping user-facing connectionIds
 * to proxy-assigned connectionIds.
 */
export function buildWsNodeOperations(): WsNodeOperations {
  const registry = new Map<string, string>();

  return {
    async connect(params): Promise<WsConnectResult> {
      const t0 = performance.now();
      const envelope = await dispatchWsOperation<ServerConnectResult>('connect', {
        url: params.url,
        headers: params.headers,
        queryParams: params.queryParams,
        subprotocols: params.subprotocols,
        timeoutMs: params.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
      });

      if (!envelope.data) {
        throw new WsClientError('connect', 'Proxy returned success with missing data', { code: 'WS_NO_DATA', retryable: false });
      }
      const data = envelope.data;
      const latencyMs = Math.round(performance.now() - t0);
      const proxyConnectionId = data.connectionId;

      // Register both the user-facing label and the proxy ID for lookup.
      // Send/Receive nodes reference the user label (e.g. "ws1").
      if (params.connectionId) {
        registry.set(params.connectionId, proxyConnectionId);
      }
      registry.set(proxyConnectionId, proxyConnectionId);

      return {
        connectionId: proxyConnectionId,
        protocol: data.protocol,
        extensions: data.extensions,
        latencyMs,
      };
    },

    async send(params): Promise<WsSendResult> {
      const proxyId = registry.get(params.connectionId) ?? params.connectionId;
      const t0 = performance.now();

      await dispatchWsOperation<ServerSendResult>('send', {
        connectionId: proxyId,
        data: params.data,
        type: params.type ?? 'text',
      });

      return { latencyMs: Math.round(performance.now() - t0) };
    },

    async snapshotCursor(params): Promise<string | undefined> {
      const proxyId = registry.get(params.connectionId) ?? params.connectionId;
      const envelope = await dispatchWsOperation<ServerMessagesResult>('messages', {
        connectionId: proxyId,
      });
      return envelope.data?.cursor;
    },

    async waitForMessage(params): Promise<WsReceivedMessage> {
      const proxyId = registry.get(params.connectionId) ?? params.connectionId;
      const deadline = Date.now() + params.timeoutMs;
      let cursor: string | undefined = params.sinceCursor;

      while (Date.now() < deadline) {
        if (params.abortSignal?.aborted) {
          throw new WsClientError('messages', 'WebSocket waitForMessage aborted', {
            code: 'WS_ABORTED',
            retryable: false,
          });
        }

        const envelope = await dispatchWsOperation<ServerMessagesResult>('messages', {
          connectionId: proxyId,
          sinceCursor: cursor,
        });

        const data = envelope.data ?? { messages: [], cursor: undefined };
        if (data.cursor) cursor = data.cursor;

        for (const msg of data.messages ?? []) {
          if (!params.matchCriteria || messageMatchesCriteria(msg, params.matchCriteria)) {
            return {
              data: msg.data,
              type: (msg.type as 'text' | 'binary') ?? 'text',
              timestamp: msg.timestamp ?? Date.now(),
            };
          }
        }

        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await sleep(Math.min(WS_POLL_INTERVAL_MS, remaining));
      }

      throw new WsClientError('messages', 'WebSocket waitForMessage timed out', {
        code: 'WS_TIMEOUT',
        retryable: false,
      });
    },

    async disconnect(params): Promise<void> {
      const proxyId = registry.get(params.connectionId) ?? params.connectionId;
      await dispatchWsOperation('disconnect', {
        connectionId: proxyId,
        code: params.code,
        reason: params.reason,
      });
      registry.delete(params.connectionId);
      registry.delete(proxyId);
    },

    async disconnectAll(): Promise<void> {
      const uniqueProxyIds = new Set(registry.values());
      for (const proxyCid of uniqueProxyIds) {
        try {
          await dispatchWsOperation('disconnect', { connectionId: proxyCid });
        } catch {
          // Best-effort cleanup — ignore individual disconnect failures
        }
      }
      registry.clear();
    },
  };
}
