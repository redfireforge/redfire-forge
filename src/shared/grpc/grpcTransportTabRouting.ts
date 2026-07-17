/**
 * Per-tab gRPC transport mode routing — Phase 7F / 10A.
 */
import {
  defaultGrpcStudioTransportModeForPlatform,
  type GrpcStudioTransportMode,
} from './grpcWebTransportContracts';
import { getGrpcStreamTransportBinding, resetGrpcStreamTransportBindingsForTests } from './grpcTransportFallback';

export type { GrpcStudioTransportMode as GrpcTransportMode } from './grpcWebTransportContracts';
export { defaultGrpcStudioTransportModeForPlatform as defaultGrpcStudioTransportMode } from './grpcWebTransportContracts';

type GrpcTransportMode = GrpcStudioTransportMode;

let globalTransportModeOverride: GrpcTransportMode | null = null;
const tabTransportById = new Map<string, GrpcTransportMode>();

export function setGrpcTransportMode(mode: GrpcTransportMode | null): void {
  globalTransportModeOverride = mode;
}

export function syncGrpcTabTransportMode(tabId: string, mode: GrpcTransportMode): void {
  tabTransportById.set(tabId, mode);
}

export function clearGrpcTabTransportRegistration(tabId: string): void {
  tabTransportById.delete(tabId);
}

export function getGrpcTabTransportMode(tabId: string): GrpcTransportMode | undefined {
  return tabTransportById.get(tabId);
}

export function resetGrpcTabTransportRoutingForTests(): void {
  globalTransportModeOverride = null;
  tabTransportById.clear();
  resetGrpcStreamTransportBindingsForTests();
}

// Per-tab registry uses ''-less default key; __studio_default__ is only for selectGrpcTransport() without tabId.
const STUDIO_DEFAULT_TAB_KEY = '__studio_default__';

export function resolveGrpcTransportForTab(tabId: string): GrpcTransportMode {
  if (globalTransportModeOverride) {
    return globalTransportModeOverride;
  }
  const streamBinding = getGrpcStreamTransportBinding(tabId);
  if (streamBinding) {
    return streamBinding;
  }
  if (tabId === STUDIO_DEFAULT_TAB_KEY) {
    return defaultGrpcStudioTransportModeForPlatform();
  }
  const tabMode = tabTransportById.get(tabId);
  if (tabMode) {
    return tabMode;
  }
  return defaultGrpcStudioTransportModeForPlatform();
}

export function shouldUseNativeGrpcTransportForTab(tabId: string): boolean {
  return resolveGrpcTransportForTab(tabId) === 'tauri';
}

/** Phase 10B — returns true when tab mode routes through Express proxy (HTTP/2). */
export function isGrpcProxyTransportMode(mode: GrpcTransportMode): boolean {
  return mode === 'express';
}

/** Phase 10B — returns true when tab mode uses browser-direct fetch (grpc-web / servlet). */
export function isGrpcBrowserDirectTransportMode(mode: GrpcTransportMode): boolean {
  return mode === 'grpc-web' || mode === 'spring-servlet';
}

export function extractTabIdFromGrpcStreamPath(path: string): string | undefined {
  try {
    return new URL(path, 'http://local').searchParams.get('tabId') ?? undefined;
  } catch {
    return undefined;
  }
}
