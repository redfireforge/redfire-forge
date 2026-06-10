/**
 * SSE (Server-Sent Events) types for connection state, events, and configuration.
 */

export type SseConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SseEvent {
  id: string;
  eventType: string;
  data: string;
  lastEventId: string;
  size: number;
  timestamp: string;
}

export interface SseConnectionConfig {
  url: string;
  headers: { key: string; value: string }[];
  autoReconnect: boolean;
  maxRetries: number;
}

export interface SseConnectionSnapshot {
  state: SseConnectionState;
  error?: string;
  lastEventId: string;
  retryMs: number;
  reconnectAttempt: number;
}

export interface SseStats {
  eventCount: number;
  startedAt: number | null;
  eventTypeCounts: Record<string, number>;
}

export function createDefaultSseConfig(): SseConnectionConfig {
  return {
    url: '',
    headers: [],
    autoReconnect: true,
    maxRetries: 10,
  };
}

let sseIdCounter = 0;
export function createSseEvent(
  eventType: string,
  data: string,
  lastEventId: string,
): SseEvent {
  sseIdCounter++;
  return {
    id: `sse-${sseIdCounter}-${Date.now()}`,
    eventType,
    data,
    lastEventId,
    size: new TextEncoder().encode(data).byteLength,
    timestamp: new Date().toISOString(),
  };
}

export function resetSseIdCounter(): void {
  sseIdCounter = 0;
}
