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
  return {
    id: `ws-frame-${Date.now()}-${frameIdCounter}`,
    direction,
    type,
    data,
    size: textEncoder.encode(data).byteLength,
    timestamp: new Date().toISOString(),
  };
}

export function resetFrameIdCounter(): void {
  frameIdCounter = 0;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Saved Connection Profile ─────────────────────────────────────────

import type { WsProtocolMode } from './protocols/protocolTypes';
export type { WsProtocolMode } from './protocols/protocolTypes';

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

export const DEFAULT_BACKOFF_MULTIPLIER: WsBackoffMultiplier = 1.5;

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
