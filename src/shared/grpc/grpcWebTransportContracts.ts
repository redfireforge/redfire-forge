/**
 * grpcWebTransportContracts.ts — Phase 10A
 *
 * Frozen browser transport mode capabilities, preflight validation, and
 * execution snapshot fields for gRPC-Web / Spring Servlet support.
 *
 * Design rules:
 * - Standalone types (minimal imports) — mirrors Phase 7A grpcTauriContracts pattern.
 * - Preflight failures use category `validation` before any network I/O (Phase 10 contract).
 * - `express` + `tauri` remain Phase 1/7 proxy/native paths; `grpc-web` + `spring-servlet`
 *   are browser-direct modes implemented in 10B–10D.
 */
import { isTauri } from '../utils/platform';
import type { GrpcCallType } from './contracts';
import { GRPC_ERROR_CODES, type GrpcTlsMode } from './contracts';

// ─── Schema versioning ────────────────────────────────────────────────────────

/** Bump on breaking changes to transport mode capabilities or snapshot fields. */
export const GRPC_WEB_TRANSPORT_SCHEMA_VERSION = 1 as const;
export type GrpcWebTransportSchemaVersion = typeof GRPC_WEB_TRANSPORT_SCHEMA_VERSION;

export function validateGrpcWebTransportSchemaVersion(
  version: number,
): version is GrpcWebTransportSchemaVersion {
  return version === GRPC_WEB_TRANSPORT_SCHEMA_VERSION;
}

// ─── Transport modes ──────────────────────────────────────────────────────────

export const GRPC_STUDIO_TRANSPORT_MODES = [
  'express',
  'tauri',
  'grpc-web',
  'spring-servlet',
] as const;

export type GrpcStudioTransportMode = (typeof GRPC_STUDIO_TRANSPORT_MODES)[number];

/** Phase 7 proxy/native modes — subset used by grpcTransportTabRouting until 10B dispatch. */
export type GrpcProxyTransportMode = Extract<GrpcStudioTransportMode, 'express' | 'tauri'>;

export const GRPC_WEB_CONTENT_TYPES = {
  BINARY: 'application/grpc-web+proto',
  TEXT: 'application/grpc-web-text+proto',
} as const;

export type GrpcWebContentType = (typeof GRPC_WEB_CONTENT_TYPES)[keyof typeof GRPC_WEB_CONTENT_TYPES];

/** Phase 10F — Headers owned by the gRPC-Web transport layer; user metadata cannot override. */
export const GRPC_WEB_RESERVED_HEADERS: ReadonlySet<string> = new Set([
  'accept',
  'content-type',
  'x-grpc-web',
  'grpc-timeout',
]);

// ─── Capability matrix ────────────────────────────────────────────────────────

export interface GrpcTransportModeCapabilities {
  mode: GrpcStudioTransportMode;
  label: string;
  description: string;
  unary: boolean;
  serverStreaming: boolean;
  clientStreaming: boolean;
  bidiStreaming: boolean;
  /** Routes through Express/Node @grpc/grpc-js proxy (HTTP/2). */
  usesExpressProxy: boolean;
  /** Direct browser fetch — no Express proxy (Phase 10C/10D). */
  browserDirect: boolean;
  /** Tauri tonic native (Phase 7). */
  tauriNative: boolean;
  desktopOnly: boolean;
  browserOnly: boolean;
}

export const GRPC_TRANSPORT_CAPABILITY_MATRIX: Record<
  GrpcStudioTransportMode,
  GrpcTransportModeCapabilities
> = {
  express: {
    mode: 'express',
    label: 'Express Proxy',
    description: 'HTTP/2 gRPC via local Node proxy — all call types on web and desktop.',
    unary: true,
    serverStreaming: true,
    clientStreaming: true,
    bidiStreaming: true,
    usesExpressProxy: true,
    browserDirect: false,
    tauriNative: false,
    desktopOnly: false,
    browserOnly: false,
  },
  tauri: {
    mode: 'tauri',
    label: 'Tauri Native (tonic)',
    description: 'True HTTP/2 via Rust tonic — all call types, desktop only.',
    unary: true,
    serverStreaming: true,
    clientStreaming: true,
    bidiStreaming: true,
    usesExpressProxy: false,
    browserDirect: false,
    tauriNative: true,
    desktopOnly: true,
    browserOnly: false,
  },
  'grpc-web': {
    mode: 'grpc-web',
    label: 'gRPC-Web',
    description: 'Browser fetch with grpc-web framing — unary live; server streaming deferred in Studio (use Express Proxy).',
    unary: true,
    serverStreaming: true,
    clientStreaming: false,
    bidiStreaming: false,
    usesExpressProxy: false,
    browserDirect: true,
    tauriNative: false,
    desktopOnly: false,
    browserOnly: false,
  },
  'spring-servlet': {
    mode: 'spring-servlet',
    label: 'Spring Servlet',
    description: 'HTTP/1.1 POST to /<service>/<method> — unary live; server streaming deferred in Studio (use Express Proxy).',
    unary: true,
    serverStreaming: true,
    clientStreaming: false,
    bidiStreaming: false,
    usesExpressProxy: false,
    browserDirect: true,
    tauriNative: false,
    desktopOnly: false,
    browserOnly: false,
  },
};

export function getGrpcTransportCapabilities(
  mode: GrpcStudioTransportMode,
): GrpcTransportModeCapabilities {
  return GRPC_TRANSPORT_CAPABILITY_MATRIX[mode];
}

export function isGrpcStudioTransportMode(value: string): value is GrpcStudioTransportMode {
  return (GRPC_STUDIO_TRANSPORT_MODES as readonly string[]).includes(value);
}

export function defaultGrpcStudioTransportModeForPlatform(): GrpcStudioTransportMode {
  return isTauri() ? 'tauri' : 'express';
}

// ─── Preflight validation ─────────────────────────────────────────────────────

export interface GrpcWebTransportPreflightIssue {
  code: typeof GRPC_ERROR_CODES.INVALID_REQUEST;
  category: 'validation';
  message: string;
  mode: GrpcStudioTransportMode;
  callType?: GrpcCallType;
}

export class GrpcWebTransportPreflightError extends Error {
  readonly code = GRPC_ERROR_CODES.INVALID_REQUEST;
  readonly category = 'validation' as const;
  readonly mode: GrpcStudioTransportMode;
  readonly callType?: GrpcCallType;

  constructor(issue: GrpcWebTransportPreflightIssue) {
    super(issue.message);
    this.name = 'GrpcWebTransportPreflightError';
    this.mode = issue.mode;
    this.callType = issue.callType;
  }

  toErrorBody() {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
    };
  }
}

function callTypeLabel(callType: GrpcCallType): string {
  switch (callType) {
    case 'client_streaming': return 'client streaming';
    case 'bidi_streaming': return 'bidirectional streaming';
    case 'server_streaming': return 'server streaming';
    default: return 'unary';
  }
}

function modeLabel(mode: GrpcStudioTransportMode): string {
  return GRPC_TRANSPORT_CAPABILITY_MATRIX[mode].label;
}

export function isGrpcTransportCallTypeSupported(
  mode: GrpcStudioTransportMode,
  callType: GrpcCallType,
): boolean {
  const caps = getGrpcTransportCapabilities(mode);
  switch (callType) {
    case 'unary': return caps.unary;
    case 'server_streaming': return caps.serverStreaming;
    case 'client_streaming': return caps.clientStreaming;
    case 'bidi_streaming': return caps.bidiStreaming;
    default: return false;
  }
}

export function isGrpcTransportPlatformSupported(mode: GrpcStudioTransportMode): boolean {
  const caps = getGrpcTransportCapabilities(mode);
  if (caps.desktopOnly && !isTauri()) {
    return false;
  }
  if (caps.browserOnly && isTauri()) {
    return false;
  }
  return true;
}

export function assertGrpcTransportPlatformSupported(mode: GrpcStudioTransportMode): void {
  const caps = getGrpcTransportCapabilities(mode);
  if (caps.desktopOnly && !isTauri()) {
    throw new GrpcWebTransportPreflightError({
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation',
      mode,
      message: `${modeLabel(mode)} is only available in the desktop (Tauri) app.`,
    });
  }
  if (caps.browserOnly && isTauri()) {
    throw new GrpcWebTransportPreflightError({
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation',
      mode,
      message: `${modeLabel(mode)} is only available in the browser build — switch to Express Proxy on desktop.`,
    });
  }
}

export function assertGrpcTransportCallTypeSupported(
  mode: GrpcStudioTransportMode,
  callType: GrpcCallType,
): void {
  if (isGrpcTransportCallTypeSupported(mode, callType)) {
    return;
  }
  const unsupported = callType === 'client_streaming' || callType === 'bidi_streaming';
  const hint = unsupported
    ? ' Switch to Express Proxy or Tauri Native for client/bidi streaming.'
    : '';
  throw new GrpcWebTransportPreflightError({
    code: GRPC_ERROR_CODES.INVALID_REQUEST,
    category: 'validation',
    mode,
    callType,
    message: `${modeLabel(mode)} does not support ${callTypeLabel(callType)} calls.${hint}`,
  });
}

/** Combined preflight — platform + call-type matrix (no network I/O). */
export function assertGrpcTransportExecutePreflight(input: {
  transportMode: GrpcStudioTransportMode;
  callType: GrpcCallType;
  tlsMode?: GrpcTlsMode;
}): void {
  assertGrpcTransportPlatformSupported(input.transportMode);
  assertGrpcTransportCallTypeSupported(input.transportMode, input.callType);
  assertBrowserDirectTransportTlsSupported(input.transportMode, input.tlsMode);
}

/** Browser fetch cannot attach mTLS client certificates — block before network I/O. */
export function assertBrowserDirectTransportTlsSupported(
  transportMode: GrpcStudioTransportMode,
  tlsMode: GrpcTlsMode | undefined,
): void {
  if (!getGrpcTransportCapabilities(transportMode).browserDirect) {
    return;
  }
  if (tlsMode === 'mtls') {
    throw new GrpcWebTransportPreflightError({
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation',
      mode: transportMode,
      message: `${modeLabel(transportMode)} cannot send mTLS client certificates from the browser. Switch to Express Proxy or Tauri Native.`,
    });
  }
}

export interface GrpcTransportExecuteSnapshotFields {
  transportMode: GrpcStudioTransportMode;
  transportSchemaVersion: typeof GRPC_WEB_TRANSPORT_SCHEMA_VERSION;
}

/** Build immutable transport fields frozen at execute click. */
export function captureGrpcTransportExecuteSnapshotFields(
  transportMode: GrpcStudioTransportMode,
): GrpcTransportExecuteSnapshotFields {
  return {
    transportMode,
    transportSchemaVersion: GRPC_WEB_TRANSPORT_SCHEMA_VERSION,
  };
}
