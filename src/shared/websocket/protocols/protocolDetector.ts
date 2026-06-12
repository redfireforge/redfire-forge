import type { WsProtocolDetectionResult, WsProtocolMode } from './protocolTypes';

/**
 * Detect protocol from URL path and query parameters.
 *
 * Heuristics:
 *  - `/socket.io/` in path → socket-io (high)
 *  - `EIO=` or `transport=websocket` in query → socket-io (medium)
 *  - `/graphql` in path → graphql-ws (medium)
 *  - `/stomp` in path → stomp (medium)
 */
export function detectFromUrl(url: string): WsProtocolDetectionResult | null {
  const lower = url.toLowerCase();

  if (/\/socket\.io\//i.test(lower)) {
    return { protocol: 'socket-io', confidence: 'high', reason: 'URL path contains /socket.io/' };
  }

  if (/[?&](eio|transport)=/i.test(lower)) {
    return { protocol: 'socket-io', confidence: 'medium', reason: 'URL contains Socket.IO query parameters (EIO/transport)' };
  }

  if (/\/graphql\b/i.test(lower)) {
    return { protocol: 'graphql-ws', confidence: 'medium', reason: 'URL path contains /graphql' };
  }

  if (/\/stomp\b/i.test(lower)) {
    return { protocol: 'stomp', confidence: 'medium', reason: 'URL path contains /stomp' };
  }

  return null;
}

/**
 * Detect protocol from negotiated WebSocket subprotocols.
 *
 * Heuristics:
 *  - `graphql-ws` or `graphql-transport-ws` → graphql-ws (high)
 *  - `stomp`, `v10.stomp`, `v11.stomp`, `v12.stomp` → stomp (high)
 */
export function detectFromSubprotocols(subprotocols: string[]): WsProtocolDetectionResult | null {
  const lower = subprotocols.map((s) => s.trim().toLowerCase());

  if (lower.some((s) => s === 'graphql-ws' || s === 'graphql-transport-ws')) {
    return { protocol: 'graphql-ws', confidence: 'high', reason: 'Subprotocol matches graphql-ws' };
  }

  if (lower.some((s) => s === 'stomp' || /^v1[0-2]\.stomp$/.test(s))) {
    return { protocol: 'stomp', confidence: 'high', reason: 'Subprotocol matches STOMP' };
  }

  return null;
}

/**
 * Detect protocol from the first received message content.
 *
 * Heuristics:
 *  - Starts with `0{` (Socket.IO open packet with JSON sid) → socket-io (high)
 *  - Starts with `CONNECTED\n` → stomp (high)
 *  - Valid JSON with `"type":"connection_ack"` → graphql-ws (high)
 *  - Numeric prefix 0-6 followed by optional JSON → socket-io (medium)
 */
export function detectFromMessage(data: string): WsProtocolDetectionResult | null {
  const trimmed = data.trimStart();

  if (trimmed.startsWith('0{') || trimmed.startsWith('0{"sid"')) {
    return { protocol: 'socket-io', confidence: 'high', reason: 'First message is Socket.IO OPEN packet (0{...})' };
  }

  if (trimmed.startsWith('CONNECTED\n') || trimmed.startsWith('CONNECTED\r\n')) {
    return { protocol: 'stomp', confidence: 'high', reason: 'First message is STOMP CONNECTED frame' };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && parsed.type === 'connection_ack') {
      return { protocol: 'graphql-ws', confidence: 'high', reason: 'First message is graphql-ws connection_ack' };
    }
  } catch {
    // not JSON — continue
  }

  if (/^[0-6](\[|$)/.test(trimmed)) {
    return { protocol: 'socket-io', confidence: 'medium', reason: 'First message starts with Socket.IO packet type digit' };
  }

  return null;
}

/**
 * Combined detection with cascade priority: subprotocol > URL > message > raw fallback.
 */
export function detectProtocol(
  url: string,
  subprotocols: string[],
  firstMessage?: string,
): WsProtocolDetectionResult {
  const fromSub = detectFromSubprotocols(subprotocols);
  if (fromSub) return fromSub;

  const fromUrl = detectFromUrl(url);
  if (fromUrl) return fromUrl;

  if (firstMessage != null) {
    const fromMsg = detectFromMessage(firstMessage);
    if (fromMsg) return fromMsg;
  }

  return { protocol: 'raw', confidence: 'high', reason: 'No protocol-specific signals detected' };
}

/**
 * Resolve the effective protocol mode.
 * If `selected` is 'auto', returns the detected protocol (or 'raw' fallback).
 * Otherwise returns the manually selected mode.
 */
export function resolveEffectiveProtocol(
  selected: WsProtocolMode,
  detected: WsProtocolDetectionResult | null,
): Exclude<WsProtocolMode, 'auto'> {
  if (selected !== 'auto') return selected;
  return detected?.protocol ?? 'raw';
}
