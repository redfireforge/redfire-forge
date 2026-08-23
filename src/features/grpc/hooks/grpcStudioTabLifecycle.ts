/**
 * gRPC Studio tab lifecycle — Phase 7E/7H.
 *
 * Centralizes native transport retain/release and tab-close cleanup helpers.
 */
import type { MutableRefObject } from 'react';
import { isTauri } from '@shared/utils/platform';
import type { GrpcTransportMode } from '@shared/grpc/grpcTransportTabRouting';
import type { GrpcStudioTransportMode } from '@shared/grpc/grpcWebTransportContracts';
import {
  cancelGrpcUnary,
  cleanupGrpcTabNative,
  mountGrpcStudioNativeTransport,
  releaseGrpcNativeTransport,
  retainGrpcNativeTransport,
} from '@shared/grpc/grpcTransportFacade';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import {
  abortTabActiveStream,
  detachStreamEventsForTab,
} from './grpcStreamSessionHelpers';

export {
  mountGrpcStudioNativeTransport,
  releaseGrpcNativeTransport,
  retainGrpcNativeTransport,
};

/** Best-effort native/express unary cancel for tab teardown. */
export async function cancelGrpcUnaryForTab(
  tabId: string,
  requestId: string,
  options?: { transportMode?: GrpcStudioTransportMode },
): Promise<void> {
  try {
    await cancelGrpcUnary(requestId, tabId, options);
  } catch {
    // Tab is already closing locally — cancel is best-effort.
  }
}

/** Detach stream listener and cancel active stream when a tab closes. */
export function cleanupGrpcStudioTabStreamResources(
  tabId: string,
  tab: GrpcStudioTabState,
  streamGenerationRef: MutableRefObject<Record<string, number>>,
  streamDisposeRef: MutableRefObject<Record<string, () => void>>,
): void {
  detachStreamEventsForTab(streamDisposeRef, tabId);
  abortTabActiveStream(tabId, tab, streamGenerationRef, streamDisposeRef);
}

/** Bulk native cleanup after local tab teardown (Phase 7H). */
export async function cleanupGrpcStudioTabNativeResources(
  tabId: string,
  transportMode?: GrpcTransportMode,
): Promise<void> {
  await cleanupGrpcTabNative(tabId, transportMode ? { transportMode } : undefined);
}

export interface GrpcStudioAppLifecycleOptions {
  getTabIds: () => string[];
  detachStreamEvents?: (tabId: string) => void;
}

function cleanupGrpcStudioTabs(
  getTabIds: () => string[],
  detachStreamEvents?: (tabId: string) => void,
): void {
  for (const tabId of getTabIds()) {
    detachStreamEvents?.(tabId);
    void cleanupGrpcTabNative(tabId);
  }
}

/** Loader indirection so tests can inject a Tauri window without dynamic-import mocks. */
export type GrpcStudioGetCurrentWindow = () => Promise<{
  onCloseRequested: (handler: () => void) => Promise<() => void>;
}>;

async function defaultGetCurrentWindow(): Promise<{
  onCloseRequested: (handler: () => void) => Promise<() => void>;
}> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

/** Bind Tauri window close hook (extracted for testability of dynamic import path). */
export async function bindTauriWindowCloseRequested(
  onCloseRequested: () => void,
  isCancelled: () => boolean,
  getCurrentWindow: GrpcStudioGetCurrentWindow = defaultGetCurrentWindow,
): Promise<(() => void) | undefined> {
  try {
    if (isCancelled()) {
      return undefined;
    }
    return await (await getCurrentWindow()).onCloseRequested(onCloseRequested);
  } catch {
    return undefined;
  }
}

/**
 * Register window-close and studio-unmount hooks that bulk-clean all open tabs on Tauri.
 * Returns dispose that also runs cleanup (covers navigating away from gRPC Studio).
 */
export function registerGrpcStudioAppLifecycle(options: GrpcStudioAppLifecycleOptions): () => void {
  const { getTabIds, detachStreamEvents } = options;
  if (!isTauri()) {
    return () => {};
  }

  let disposed = false;
  let disposeCloseRequested: (() => void) | undefined;

  const cleanupAll = () => {
    cleanupGrpcStudioTabs(getTabIds, detachStreamEvents);
  };

  const handleBeforeUnload = () => {
    cleanupAll();
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  void bindTauriWindowCloseRequested(cleanupAll, () => disposed).then((dispose) => {
    disposeCloseRequested = dispose;
  });

  return () => {
    disposed = true;
    window.removeEventListener('beforeunload', handleBeforeUnload);
    disposeCloseRequested?.();
    cleanupAll();
  };
}

/** @deprecated Use registerGrpcStudioAppLifecycle */
export function registerGrpcStudioWindowLifecycle(getTabIds: () => string[]): () => void {
  return registerGrpcStudioAppLifecycle({ getTabIds });
}
