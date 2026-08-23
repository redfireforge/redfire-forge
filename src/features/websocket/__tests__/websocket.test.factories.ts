/**
 * Shared factories & constants for WebSocket test files.
 * Eliminates duplicated makeFrame / makeTemplate / makeProfile across test files.
 */
import type { WsFrame, WsMessageTemplate, WsConnectionProfile } from '@shared/websocket/types';

// ── Constants ────────────────────────────────────────

export const TEST_WS_URL = 'ws://localhost:8765';
export const TEST_WSS_URL = 'wss://echo.example.com/ws';
export const TEST_PAYLOAD_JSON = '{"key":"value"}';
export const TEST_PAYLOAD_B64 = 'SGVsbG8=';

// ── Factories ────────────────────────────────────────

let frameSeq = 0;
export function makeFrame(overrides?: Partial<WsFrame>): WsFrame {
  frameSeq++;
  return {
    id: `frame-${frameSeq}`,
    direction: 'received',
    type: 'text',
    data: '{"hello":"world"}',
    size: 17,
    timestamp: '2026-06-07T12:00:01.234Z',
    ...overrides,
  };
}

export function makeTemplate(overrides?: Partial<WsMessageTemplate>): WsMessageTemplate {
  return {
    id: 'tpl-1',
    name: 'Hello Template',
    body: '{"msg":"hi"}',
    format: 'json',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeProfile(overrides?: Partial<WsConnectionProfile>): WsConnectionProfile {
  return {
    id: 'prof-1',
    name: 'Test Profile',
    url: TEST_WS_URL,
    subprotocols: '',
    protocolMode: 'raw',
    headers: [],
    queryParams: [],
    autoReconnect: false,
    maxReconnectAttempts: 3,
    reconnectIntervalMs: 1000,
    maxMessages: 1000,
    notes: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}
