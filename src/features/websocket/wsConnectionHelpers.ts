/**
 * Pure utility functions extracted from useWebSocketStudio.
 * These handle subprotocol parsing, binary message encoding,
 * system frame creation, and early protocol detection — logic
 * that was duplicated across direct and proxy transport paths.
 */
import {
  type WsFrame,
  createFrame,
} from '@shared/websocket/types';
import type { WsProtocolMode, WsProtocolDetectionResult } from '@shared/websocket/protocols/protocolTypes';
import { detectProtocol } from '@shared/websocket/protocols/protocolDetector';

/**
 * Parse a comma-separated subprotocols string into a trimmed, non-empty array.
 * Used by both connectDirect and connectProxy.
 */
export function parseSubprotocolList(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Encode WebSocket message data (string or ArrayBuffer) to a string + binary flag.
 * ArrayBuffer is converted to base64 via Uint8Array → binary string → btoa.
 */
export function encodeWsMessageData(data: unknown): { data: string; isBinary: boolean } {
  if (typeof data === 'string') return { data, isBinary: false };
  if (data instanceof ArrayBuffer) {
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { data: btoa(binary), isBinary: true };
  }
  return { data: String(data), isBinary: false };
}

/**
 * Create a system "Connected to …" frame with the isSystem flag set.
 */
export function createSystemConnectFrame(url: string, protocol: string | undefined): WsFrame {
  const proto = protocol || 'none';
  const frame = createFrame('received', 'text', `Connected to ${url} (protocol: ${proto})`);
  (frame as WsFrame & { isSystem?: boolean }).isSystem = true;
  return frame;
}

/**
 * Run early URL-based protocol detection when mode is 'auto'.
 * Returns the detection result if a non-raw protocol is detected, or null.
 */
export function runEarlyProtocolDetection(
  mode: WsProtocolMode,
  url: string,
  subprotocols: string[],
): WsProtocolDetectionResult | null {
  if (mode !== 'auto') return null;
  const result = detectProtocol(url, subprotocols);
  return result.protocol !== 'raw' ? result : null;
}

/**
 * Build headers map from draft headers + auth headers.
 * Auth headers are applied last so they override manual headers.
 */
export function buildConnectHeadersMap(
  draftHeaders: ReadonlyArray<{ enabled: boolean; key: string; value: string }>,
  envVarMap: Record<string, string>,
  authHeaders: ReadonlyArray<{ key: string; value: string }>,
  resolveEnvVars: (val: string, map: Record<string, string>) => string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of draftHeaders) {
    if (h.enabled && h.key.trim().length > 0) {
      const resolvedKey = resolveEnvVars(h.key.trim(), envVarMap);
      map[resolvedKey] = resolveEnvVars(h.value, envVarMap);
    }
  }
  for (const ah of authHeaders) {
    map[ah.key] = ah.value;
  }
  return map;
}
