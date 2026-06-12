// graphql-ws protocol message types (client → server)
export const GQL_CLIENT_TYPES = ['connection_init', 'subscribe', 'complete', 'ping', 'pong'] as const;

// graphql-ws protocol message types (server → client)
export const GQL_SERVER_TYPES = ['connection_ack', 'next', 'error', 'complete', 'ping', 'pong'] as const;

export type GqlWsClientType = (typeof GQL_CLIENT_TYPES)[number];
export type GqlWsServerType = (typeof GQL_SERVER_TYPES)[number];
export type GqlWsMessageType = GqlWsClientType | GqlWsServerType;

export interface GqlWsMessage {
  type: string;
  id?: string;
  payload?: unknown;
}

/**
 * Decode a raw graphql-ws JSON message.
 */
export function decodeGqlWsMessage(raw: string): GqlWsMessage {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return {
        type: parsed.type,
        id: parsed.id != null ? String(parsed.id) : undefined,
        payload: parsed.payload,
      };
    }
  } catch {
    // not valid JSON
  }
  return { type: 'unknown', payload: raw };
}

/**
 * Encode a `connection_init` message.
 */
export function encodeGqlWsConnectionInit(payload?: Record<string, unknown>): string {
  const msg: GqlWsMessage = { type: 'connection_init' };
  if (payload && Object.keys(payload).length > 0) {
    msg.payload = payload;
  }
  return JSON.stringify(msg);
}

/**
 * Encode a `subscribe` message (used for queries, mutations, and subscriptions).
 */
export function encodeGqlWsSubscribe(
  id: string,
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string,
): string {
  const payload: Record<string, unknown> = { query };
  if (variables && Object.keys(variables).length > 0) {
    payload.variables = variables;
  }
  if (operationName) {
    payload.operationName = operationName;
  }
  return JSON.stringify({ type: 'subscribe', id, payload });
}

/**
 * Encode a `complete` message (client stops subscription).
 */
export function encodeGqlWsComplete(id: string): string {
  return JSON.stringify({ type: 'complete', id });
}

/**
 * Encode a `ping` message.
 */
export function encodeGqlWsPing(payload?: unknown): string {
  const msg: GqlWsMessage = { type: 'ping' };
  if (payload !== undefined) msg.payload = payload;
  return JSON.stringify(msg);
}

/**
 * Encode a `pong` message.
 */
export function encodeGqlWsPong(payload?: unknown): string {
  const msg: GqlWsMessage = { type: 'pong' };
  if (payload !== undefined) msg.payload = payload;
  return JSON.stringify(msg);
}

/**
 * Generate a human-readable summary for a graphql-ws message.
 */
export function getGqlWsMessageSummary(msg: GqlWsMessage): string {
  switch (msg.type) {
    case 'connection_init':
      return 'connection_init';
    case 'connection_ack':
      return 'connection_ack';
    case 'subscribe': {
      const payload = msg.payload as Record<string, unknown> | undefined;
      const query = typeof payload?.query === 'string' ? payload.query : '';
      const opMatch = query.match(/^\s*(query|mutation|subscription)\s+(\w+)/);
      if (opMatch) return `subscribe #${msg.id}: ${opMatch[1]} ${opMatch[2]}`;
      const typeMatch = query.match(/^\s*(query|mutation|subscription)\b/);
      if (typeMatch) return `subscribe #${msg.id}: ${typeMatch[1]}`;
      return `subscribe #${msg.id}`;
    }
    case 'next': {
      const data = (msg.payload as Record<string, unknown>)?.data;
      if (data && typeof data === 'object') {
        const keys = Object.keys(data as object);
        if (keys.length > 0) return `next #${msg.id}: {${keys[0]}…}`;
      }
      return `next #${msg.id}`;
    }
    case 'error': {
      const errors = msg.payload as Array<{ message?: string }> | undefined;
      if (Array.isArray(errors) && errors.length > 0 && errors[0]?.message) {
        return `error #${msg.id}: ${errors[0].message}`;
      }
      return `error #${msg.id}`;
    }
    case 'complete':
      return msg.id ? `complete #${msg.id}` : 'complete';
    case 'ping':
      return 'ping';
    case 'pong':
      return 'pong';
    default:
      return msg.type;
  }
}

/**
 * Check if a decoded message is a server `ping` (requires auto-pong).
 */
export function isGqlWsPing(msg: GqlWsMessage): boolean {
  return msg.type === 'ping';
}

/**
 * Check if a decoded message is `connection_ack`.
 */
export function isGqlWsConnectionAck(msg: GqlWsMessage): boolean {
  return msg.type === 'connection_ack';
}
