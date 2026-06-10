import type { WsProtocolMode } from './protocols/protocolTypes';
export type { WsProtocolMode } from './protocols/protocolTypes';
export { formatBytes } from '../utils/helpers';

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'closing' | 'error';

export interface WsConnectionSnapshot {
  state: WsConnectionState;
  url?: string;
  connectedAt?: string;
  closedAt?: string;
  closeCode?: number;
  closeReason?: string;
  lastError?: string;
  protocol?: string;
  extensions?: string;
  latencyMs?: number;
}

export interface WsKeyValueEntry {
  key: string;
  value: string;
  enabled: boolean;
}

export interface WsConnectionDraft {
  url: string;
  subprotocols: string;
  headers: WsKeyValueEntry[];
  queryParams: WsKeyValueEntry[];
}

export type WsFrameDirection = 'sent' | 'received';
export type WsFrameType = 'text' | 'binary' | 'ping' | 'pong' | 'close';

export interface WsFrameProtocolMeta {
  protocol: 'socket-io' | 'stomp' | 'graphql-ws';
  packetType: string;
  summary: string;
  namespace?: string;
  eventName?: string;
  ackId?: number;
  isSystemPacket?: boolean;
}

export interface WsFrame {
  id: string;
  direction: WsFrameDirection;
  type: WsFrameType;
  data: string;
  size: number;
  timestamp: string;
  protocolMeta?: WsFrameProtocolMeta;
}

export interface WsTlsConfig {
  rejectUnauthorized?: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
}

export function createDefaultTlsConfig(): WsTlsConfig {
  return { rejectUnauthorized: true };
}

export function hasTlsOverrides(tls: WsTlsConfig | undefined): boolean {
  if (!tls) return false;
  return tls.rejectUnauthorized === false || !!tls.caCert || !!tls.clientCert || !!tls.clientKey;
}

export function createDefaultDraft(): WsConnectionDraft {
  return { url: '', subprotocols: '', headers: [], queryParams: [] };
}

export function hasCustomHeaders(draft: WsConnectionDraft): boolean {
  return draft.headers.some((h) => h.enabled && h.key.trim().length > 0);
}

export function buildEffectiveUrl(draft: WsConnectionDraft): string {
  const base = draft.url.trim();
  const enabledParams = draft.queryParams.filter((p) => p.enabled && p.key.trim().length > 0);
  if (enabledParams.length === 0) return base;

  const separator = base.includes('?') ? '&' : '?';
  const queryString = enabledParams
    .map((p) => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`)
    .join('&');
  return `${base}${separator}${queryString}`;
}

let frameIdCounter = 0;
const textEncoder = new TextEncoder();

export function createFrame(
  direction: WsFrameDirection,
  type: WsFrameType,
  data: string,
): WsFrame {
  frameIdCounter += 1;
  let size: number;
  if (type === 'binary') {
    try {
      size = atob(data).length;
    } catch {
      size = textEncoder.encode(data).byteLength;
    }
  } else {
    size = textEncoder.encode(data).byteLength;
  }
  return {
    id: `ws-frame-${Date.now()}-${frameIdCounter}`,
    direction,
    type,
    data,
    size,
    timestamp: new Date().toISOString(),
  };
}

export function resetFrameIdCounter(): void {
  frameIdCounter = 0;
}

// ── Saved Connection Profile ─────────────────────────────────────────

export interface WsConnectionProfile {
  id: string;
  name: string;
  url: string;
  headers: WsKeyValueEntry[];
  queryParams: WsKeyValueEntry[];
  subprotocols: string;
  protocolMode: WsProtocolMode;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectIntervalMs: number;
  backoffMultiplier?: WsBackoffMultiplier;
  maxMessages: number;
  tlsConfig?: WsTlsConfig;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Message Template ─────────────────────────────────────────────────

export type WsMessageFormat = 'text' | 'json' | 'binary';

export interface WsMessageTemplate {
  id: string;
  name: string;
  body: string;
  format: WsMessageFormat;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export function profileToDraft(profile: WsConnectionProfile): WsConnectionDraft {
  return {
    url: profile.url,
    subprotocols: profile.subprotocols,
    headers: profile.headers.map((h) => ({ ...h })),
    queryParams: profile.queryParams.map((p) => ({ ...p })),
  };
}

export function draftToProfileFields(
  draft: WsConnectionDraft,
): Pick<WsConnectionProfile, 'url' | 'headers' | 'queryParams' | 'subprotocols'> {
  return {
    url: draft.url,
    headers: draft.headers.map((h) => ({ ...h })),
    queryParams: draft.queryParams.map((p) => ({ ...p })),
    subprotocols: draft.subprotocols,
  };
}

// ── Close with Code/Reason ───────────────────────────────────────────

export interface WsCloseDetail {
  code: number;
  reason?: string;
}

export interface WsCloseCodePreset {
  code: number;
  label: string;
  description: string;
}

export const WS_CLOSE_CODE_PRESETS: WsCloseCodePreset[] = [
  { code: 1000, label: 'Normal', description: 'Normal closure' },
  { code: 1001, label: 'Going Away', description: 'Endpoint going away (page close/navigate)' },
  { code: 1002, label: 'Protocol Error', description: 'Protocol error detected' },
  { code: 1003, label: 'Unsupported', description: 'Unsupported data type received' },
  { code: 1008, label: 'Policy Violation', description: 'Policy violation' },
  { code: 1011, label: 'Server Error', description: 'Unexpected server condition' },
  { code: 4000, label: 'Custom 4000', description: 'Application-defined close code' },
  { code: 4001, label: 'Custom 4001', description: 'Application-defined close code' },
];

export function getCloseCodeLabel(code: number): string {
  const preset = WS_CLOSE_CODE_PRESETS.find((p) => p.code === code);
  return preset ? preset.label : `Code ${code}`;
}

// ── Auto-Reconnect ──────────────────────────────────────────────────

export type WsBackoffMultiplier = 1 | 1.5 | 2;

export const DEFAULT_BACKOFF_MULTIPLIER: WsBackoffMultiplier = 2;

export function resolveBackoffMultiplier(
  value?: WsBackoffMultiplier | null,
): WsBackoffMultiplier {
  return value ?? DEFAULT_BACKOFF_MULTIPLIER;
}

export interface WsReconnectState {
  active: boolean;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number | null;
  lastError?: string;
  lostAt?: number;
}

export function createDefaultReconnectState(
  maxAttempts = 5,
): WsReconnectState {
  return {
    active: false,
    attempt: 0,
    maxAttempts,
    nextRetryAt: null,
    lastError: undefined,
    lostAt: undefined,
  };
}

// ── Tab Persistence ──────────────────────────────────────────────────

export type WsViewTab = 'connect' | 'messages' | 'saved' | 'mock';

export interface WsPersistedTab {
  id: string;
  label: string;
  url: string;
  viewTab: WsViewTab;
}

export interface WsPersistedTabState {
  tabs: WsPersistedTab[];
  activeTabId: string;
  renamedTabIds: string[];
}

// ── Connection History ───────────────────────────────────────────────

export interface WsConnectionHistoryEntry {
  url: string;
  protocol: WsProtocolMode;
  lastUsed: string;
  connectCount: number;
}

// ── Session Recording ────────────────────────────────────────────────

export interface WsRecordingMessageEvent {
  type: 'message';
  relativeMs: number;
  frame: WsFrame;
}

export interface WsRecordingStateEvent {
  type: 'state-change';
  relativeMs: number;
  state: string;
  url?: string;
}

export type WsRecordingEvent = WsRecordingMessageEvent | WsRecordingStateEvent;

export interface WsRecordingMetadata {
  url: string;
  protocol: string;
  startedAt: string;
  durationMs: number;
  messageCount: number;
}

export interface WsRecording {
  _format: 'ws-recording-v1';
  metadata: WsRecordingMetadata;
  events: WsRecordingEvent[];
}

export type WsReplaySpeed = 1 | 2 | 5 | 10 | 0;

export interface WsReplayProgress {
  current: number;
  total: number;
  elapsedMs: number;
  durationMs: number;
}

export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ── Filter Presets ────────────────────────────────────────────────────────────

export interface WsFilterPreset {
  id: string;
  name: string;
  searchMode: 'text' | 'regex' | 'jsonpath';
  searchQuery: string;
  sizeFilter: 'all' | 'lt1k' | '1k-10k' | 'gt10k';
  timeFilter: 'all' | 'last30s' | 'last5m' | 'last30m';
  contentTypeFilter: 'all' | 'json' | 'text' | 'binary' | 'control';
  createdAt: string;
}

// ── Mock Server ──────────────────────────────────────────────────────────────

export type WsMockMatchType = 'exact' | 'contains' | 'regex' | 'jsonpath' | 'any';
export type WsMockResponseType = 'static' | 'echo' | 'template' | 'close';
export type WsMockFallbackMode = 'echo' | 'ignore' | 'close';

export interface WsMockMatch {
  type: WsMockMatchType;
  pattern: string;
}

export interface WsMockResponse {
  type: WsMockResponseType;
  data?: string;
  delay?: number;
  closeCode?: number;
  closeReason?: string;
}

export interface WsMockRule {
  id: string;
  name: string;
  enabled: boolean;
  match: WsMockMatch;
  response: WsMockResponse;
}

export interface WsMockServerConfig {
  port: number;
  fallback: WsMockFallbackMode;
  rules: WsMockRule[];
}

export type WsMockLogEventType = 'client-connect' | 'client-disconnect' | 'message-in' | 'response-out' | 'server-start' | 'server-stop' | 'error';

export interface WsMockLogEntry {
  id: number;
  ts: string;
  event: WsMockLogEventType;
  clientId?: string;
  data?: string;
  ruleName?: string;
}

export interface WsMockClientInfo {
  id: string;
  connectedAt: string;
  messageCount: number;
  remoteAddress?: string;
}

export interface WsMockStatus {
  running: boolean;
  port: number;
  clientCount: number;
  clients: WsMockClientInfo[];
  error?: string;
}

// ── Load Testing ──────────────────────────────────────────────────────

export type WsLoadProfile = 'constant' | 'ramp' | 'burst';
export type WsLoadTestState = 'idle' | 'running' | 'stopping' | 'done';

export interface WsLoadTestConfig {
  profile: WsLoadProfile;
  messageTemplate: string;
  /** Messages per second for constant profile, or start rate for ramp */
  rate: number;
  /** End rate for ramp profile (ignored for constant/burst) */
  rateEnd: number;
  /** Duration in seconds (ignored for burst) */
  durationSec: number;
  /** Total messages for burst profile (ignored for constant/ramp) */
  burstCount: number;
}

export interface WsLoadTestProgress {
  elapsedMs: number;
  totalSent: number;
  totalReceived: number;
  targetRate: number;
  actualRate: number;
  errorCount: number;
}

export interface WsLoadTestResult {
  config: WsLoadTestConfig;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  totalSent: number;
  totalReceived: number;
  errorCount: number;
  bytesSent: number;
  bytesReceived: number;
  avgSendRate: number;
  avgReceiveRate: number;
  latency: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    samples: number;
  };
  throughputHistory: { ts: number; sent: number; received: number }[];
  latencyHistogram: { bucket: string; count: number }[];
}
