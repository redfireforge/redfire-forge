/**
 * subscriptionProtocolHandlers.ts — Phase 2A
 *
 * Stateless message-handling functions for the two GraphQL-over-WebSocket
 * subprotocols used by the subscription proxy route.
 *
 * Extracted from graphql-routes.ts to reduce its size and enable isolated unit
 * testing of the protocol logic without starting an Express server or WebSocket.
 */
import type { WebSocket } from 'ws';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Callback that writes an SSE event frame to the client response. */
export type SendEventFn = (eventName: string, data: unknown) => void;

/** Mutable subscription state shared with the ws.on('message') handler. */
export interface SubscriptionState {
  subscribed: boolean;
}

/** Everything the message handler needs about the current operation. */
export interface SubscriptionOperationParams {
  query: string;
  variables: Record<string, unknown>;
  operationName: string | undefined;
  operationId: string;
}

// ─── graphql-transport-ws (Apollo Router / Yoga / Stellate default) ───────────

/**
 * Handle one raw message from an upstream server using the `graphql-transport-ws`
 * subprotocol (Apollo Router, Yoga, Stellate default).
 *
 * Message types handled:
 *   connection_ack  — sends `subscribe` and marks subscribed=true
 *   next            — relays payload as `next` SSE event
 *   error           — relays errors as `error` SSE event, closes WS
 *   complete        — sends `complete` SSE event, closes WS
 *   connection_error — sends `error` SSE event, closes WS with code 4499
 *   ping            — responds with pong
 *   (all others)    — silently ignored
 */
export function handleGraphqlTransportWsMessage(
  msg: Record<string, unknown>,
  ws: Pick<WebSocket, 'send' | 'close'>,
  sendEvent: SendEventFn,
  params: SubscriptionOperationParams,
  state: SubscriptionState,
): void {
  const { query, variables, operationName, operationId } = params;
  const msgType = msg.type as string;

  switch (msgType) {
    case 'connection_ack':
      sendEvent('connected', {});
      ws.send(JSON.stringify({
        id:   operationId,
        type: 'subscribe',
        payload: {
          query,
          ...(Object.keys(variables).length > 0 ? { variables } : {}),
          ...(operationName ? { operationName } : {}),
        },
      }));
      state.subscribed = true;
      break;

    case 'next':
      if (msg.id === operationId) {
        sendEvent('next', msg.payload ?? {});
      }
      break;

    case 'error':
      if (msg.id === operationId) {
        sendEvent('error', msg.payload ?? [{ message: 'Unknown subscription error' }]);
        ws.close(1000);
      }
      break;

    case 'complete':
      if (msg.id === operationId) {
        sendEvent('complete', {});
        ws.close(1000);
      }
      break;

    case 'connection_error': {
      const errPayload = msg.payload as Record<string, unknown> | undefined;
      sendEvent('error', [{
        message: typeof errPayload?.message === 'string'
          ? errPayload.message
          : 'Connection rejected by server',
      }]);
      ws.close(4499, 'Connection rejected');
      break;
    }

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      break;
  }
}

// ─── Legacy graphql-ws (Apollo Server ≤v3) ────────────────────────────────────

/**
 * Handle one raw message from an upstream server using the legacy `graphql-ws`
 * subprotocol (Apollo Server ≤v3).
 *
 * Message types handled:
 *   connection_ack       — sends `start` and marks subscribed=true
 *   connection_keep_alive / ka — keep-alive heartbeat (silently consumed)
 *   connection_error     — sends `error` SSE event, closes WS with code 4499
 *   data                 — relays payload as `next` SSE event
 *   error                — relays errors as `error` SSE event, closes WS
 *   complete             — sends `complete` SSE event, closes WS
 *   (all others)         — silently ignored
 */
export function handleGraphqlWsMessage(
  msg: Record<string, unknown>,
  ws: Pick<WebSocket, 'send' | 'close'>,
  sendEvent: SendEventFn,
  params: SubscriptionOperationParams,
  state: SubscriptionState,
): void {
  const { query, variables, operationName, operationId } = params;
  const msgType = msg.type as string;

  switch (msgType) {
    case 'connection_ack':
      sendEvent('connected', {});
      ws.send(JSON.stringify({
        type: 'start',
        id:   operationId,
        payload: {
          query,
          ...(Object.keys(variables).length > 0 ? { variables } : {}),
          ...(operationName ? { operationName } : {}),
        },
      }));
      state.subscribed = true;
      break;

    case 'connection_keep_alive':
    case 'ka':
      // Keep-alive heartbeat — no action needed.
      break;

    case 'connection_error': {
      const errPayload = msg.payload as Record<string, unknown> | undefined;
      sendEvent('error', [{
        message: typeof errPayload?.message === 'string'
          ? errPayload.message
          : 'Connection rejected by server',
      }]);
      ws.close(4499, 'Connection rejected');
      break;
    }

    case 'data': {
      if (msg.id !== operationId) break;
      const payload = (msg.payload ?? {}) as Record<string, unknown>;
      sendEvent('next', {
        data: payload.data ?? null,
        ...(Array.isArray(payload.errors) ? { errors: payload.errors } : {}),
      });
      break;
    }

    case 'error': {
      if (msg.id !== operationId) break;
      const errPayload = msg.payload;
      const errors = Array.isArray(errPayload)
        ? errPayload
        : [{ message: typeof errPayload === 'string' ? errPayload : 'Unknown legacy subscription error' }];
      sendEvent('error', errors);
      ws.close(1000);
      break;
    }

    case 'complete':
      if (msg.id !== operationId) break;
      sendEvent('complete', {});
      ws.close(1000);
      break;

    default:
      break;
  }
}
