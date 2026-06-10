/**
 * Types, constants, and pure helpers for useWebSocketStudio.
 * Extracted to keep the hook file under 900 lines.
 */
import type {
  WsConnectionDraft,
  WsConnectionSnapshot,
  WsFrame,
  WsReconnectState,
  WsTlsConfig,
  WsCloseDetail,
  WsBackoffMultiplier,
} from '../../shared/websocket/types';
import { getCloseCodeLabel } from '../../shared/websocket/types';
import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import type { SioServerParams } from './wsProtocolHelpers';

// ── Constants ──────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_MESSAGES = 10000;
export const PROXY_POLL_INTERVAL_MS = 200;
export const DEFAULT_RECONNECT_INTERVAL_MS = 3000;
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;

// ── Pure helpers ───────────────────────────────────────────────────────────────

export function formatCloseFrame(direction: 'SENT' | 'ACK', code: number, reason?: string): string {
  const label = getCloseCodeLabel(code);
  const reasonPart = reason ? ` reason: "${reason}"` : '';
  return `CLOSE ${direction} — code: ${code} (${label})${reasonPart}`;
}

// ── Public types ───────────────────────────────────────────────────────────────

export type WsDirectionFilter = 'all' | 'sent' | 'received' | 'bookmarked';
export type WsSearchMode = 'text' | 'regex' | 'jsonpath';
export type WsSizeFilter = 'all' | 'lt1k' | '1k-10k' | 'gt10k';
export type WsTimeFilter = 'all' | 'last30s' | 'last5m' | 'last30m';
export type WsContentTypeFilter = 'all' | 'json' | 'text' | 'binary' | 'control';
export type WsTransportMode = 'direct' | 'proxy' | 'native';

export const FILTER_TICK_INTERVAL_MS = 5000;

export interface UseWebSocketStudioReturn {
  draft: WsConnectionDraft;
  setDraft: (patch: Partial<WsConnectionDraft>) => void;
  connection: WsConnectionSnapshot;
  connect: () => void;
  disconnect: (detail?: WsCloseDetail) => void;
  send: (data: string, format?: 'text' | 'json' | 'binary') => void;
  sendPing: () => void;

  messages: WsFrame[];
  filteredMessages: WsFrame[];
  maxMessages: number;
  setMaxMessages: (n: number) => void;
  isMaxReached: boolean;
  searchText: string;
  setSearchText: (v: string) => void;
  searchMode: WsSearchMode;
  setSearchMode: (v: WsSearchMode) => void;
  directionFilter: WsDirectionFilter;
  setDirectionFilter: (v: WsDirectionFilter) => void;
  sizeFilter: WsSizeFilter;
  setSizeFilter: (v: WsSizeFilter) => void;
  timeFilter: WsTimeFilter;
  setTimeFilter: (v: WsTimeFilter) => void;
  contentTypeFilter: WsContentTypeFilter;
  setContentTypeFilter: (v: WsContentTypeFilter) => void;
  clearMessages: () => void;
  appendReplayFrame: (frame: WsFrame) => void;

  bookmarkedIds: ReadonlySet<string>;
  bookmarkedMessages: WsFrame[];
  toggleBookmark: (id: string) => void;

  sentCount: number;
  receivedCount: number;
  uptime: number | null;
  transportMode: WsTransportMode;

  autoReconnect: boolean;
  setAutoReconnect: (enabled: boolean) => void;
  reconnectState: WsReconnectState;
  cancelReconnect: () => void;
  reconnectIntervalMs: number;
  setReconnectIntervalMs: (ms: number) => void;
  maxReconnectAttempts: number;
  setMaxReconnectAttempts: (n: number) => void;
  backoffMultiplier: WsBackoffMultiplier;
  setBackoffMultiplier: (v: WsBackoffMultiplier) => void;
  retryNow: () => void;

  protocolMode: WsProtocolMode;
  setProtocolMode: (mode: WsProtocolMode) => void;
  detectedProtocol: WsProtocolDetectionResult | null;

  tlsConfig: WsTlsConfig;
  setTlsConfig: (patch: Partial<WsTlsConfig>) => void;

  sioServerParams: SioServerParams | null;
}
