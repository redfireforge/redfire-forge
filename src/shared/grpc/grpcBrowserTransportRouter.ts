/**
 * gRPC browser transport mode router — Phase 10B.
 */
import type { GrpcProxyTransportMode, GrpcStudioTransportMode } from './grpcWebTransportContracts';
import { GRPC_ERROR_CODES } from './contracts';
import {
  GrpcWebTransportPreflightError,
  GRPC_TRANSPORT_CAPABILITY_MATRIX,
} from './grpcWebTransportContracts';
import { resolveGrpcTransportForTab } from './grpcTransportTabRouting';
import {
  getGrpcBrowserTransportAdapter,
  GRPC_BROWSER_TRANSPORT_ADAPTERS,
} from './grpcBrowserTransportAdapters';
import type { GrpcBrowserTransportAdapter } from './grpcBrowserTransportAdapter';

function modeLabel(mode: GrpcStudioTransportMode): string {
  return GRPC_TRANSPORT_CAPABILITY_MATRIX[mode].label;
}

function deferredPhaseLabel(mode: GrpcStudioTransportMode): string {
  if (mode === 'spring-servlet') return '10H';
  if (mode === 'grpc-web') return '10H';
  return '10D';
}

export function resolveGrpcBrowserTransportAdapter(
  mode: GrpcStudioTransportMode,
): GrpcBrowserTransportAdapter {
  return getGrpcBrowserTransportAdapter(mode);
}

/** Snapshot-bound routing — frozen transportMode wins over live tab registry. */
export function resolveGrpcBrowserTransportAdapterForTab(
  tabId: string,
  snapshotTransportMode?: GrpcStudioTransportMode,
): GrpcBrowserTransportAdapter {
  const mode = snapshotTransportMode ?? resolveGrpcTransportForTab(tabId);
  return resolveGrpcBrowserTransportAdapter(mode);
}

export function isGrpcTransportDispatchImplemented(mode: GrpcStudioTransportMode): boolean {
  return resolveGrpcBrowserTransportAdapter(mode).dispatchReady;
}

export function assertGrpcTransportDispatchReady(mode: GrpcStudioTransportMode): void {
  if (isGrpcTransportDispatchImplemented(mode)) {
    return;
  }
  const phase = deferredPhaseLabel(mode);
  throw new GrpcWebTransportPreflightError({
    code: GRPC_ERROR_CODES.INVALID_REQUEST,
    category: 'validation',
    mode,
    message: `${modeLabel(mode)} transport dispatch is not yet available (Phase ${phase}). Use Express Proxy for now.`,
  });
}

/** Resolve express/tauri proxy dispatch mode; browser-direct modes are not proxy modes. */
export function resolveDispatchableGrpcTransportMode(
  mode: GrpcStudioTransportMode,
): GrpcProxyTransportMode {
  if (mode === 'express' || mode === 'tauri') {
    return mode;
  }
  assertGrpcTransportDispatchReady(mode);
  throw new Error(`Unreachable gRPC transport mode: ${mode}`);
}

export function listGrpcBrowserTransportAdapters(): readonly GrpcBrowserTransportAdapter[] {
  return Object.values(GRPC_BROWSER_TRANSPORT_ADAPTERS);
}

export function resetGrpcBrowserTransportRouterForTests(): void {
  // Adapters are stateless singletons — no-op hook for test symmetry.
}
