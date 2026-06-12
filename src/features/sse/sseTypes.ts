/**
 * SSE (Server-Sent Events) types for connection state, events, and configuration.
 */

import type { WsKeyValueEntry } from '../../shared/websocket/types';
import type { AuthConfig } from '../../shared/types';

export type SseConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** Phase 8 — left-pane tabs for the SSE studio shell. */
export type SseLeftTab = 'connect' | 'auth';
export const SSE_LEFT_TABS: SseLeftTab[] = ['connect', 'auth'];
export const SSE_LEFT_TAB_LABELS: Record<SseLeftTab, string> = {
  connect: 'Connect',
  auth: 'Auth',
};

/** Phase 9 — right-pane tabs for the SSE studio shell. */
export type SseRightTab = 'events' | 'console';
export const SSE_RIGHT_TABS: SseRightTab[] = ['events', 'console'];
export const SSE_RIGHT_TAB_LABELS: Record<SseRightTab, string> = {
  events: 'Events',
  console: 'Console',
};

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
  headers: WsKeyValueEntry[];
  autoReconnect: boolean;
  maxRetries: number;
  /** Phase 8 — request auth applied at connect time (header- or query-based). */
  auth?: AuthConfig;
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
