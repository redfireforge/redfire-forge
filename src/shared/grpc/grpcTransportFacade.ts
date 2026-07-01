/**
 * gRPC transport facade — Phase 7C/7F, Phase 10B router delegation.
 */
import { isTauri } from '../utils/platform';
import {
  clearGrpcNativeStreamTransport,
  installGrpcNativeStreamTransport,
} from './grpcNativeTauriStreamTransport';
import type {
  GrpcCallResult,
  GrpcCancelCallResult,
  GrpcSuccessEnvelope,
} from './contracts';
import {
  invokeGrpcTabCleanupNative,
} from './grpcNativeTauriLifecycle';
import {
  clearGrpcTabTransportRegistration,
  defaultGrpcStudioTransportMode,
  resolveGrpcTransportForTab,
  resetGrpcTabTransportRoutingForTests,
  setGrpcTransportMode,
  syncGrpcTabTransportMode,
  type GrpcTransportMode,
} from './grpcTransportTabRouting';
import type { GrpcStudioTransportMode } from './grpcWebTransportContracts';
import {
  assertGrpcTransportDispatchReady,
  resolveGrpcBrowserTransportAdapterForTab,
} from './grpcBrowserTransportRouter';
import type { BuildGrpcTauriDescriptorPayloadInput } from './grpcTauriDescriptorPayload';
import type { GrpcCallRequest } from './contracts';

export {
  clearGrpcTabTransportRegistration,
  defaultGrpcStudioTransportMode,
  resolveGrpcTransportForTab,
  resetGrpcTabTransportRoutingForTests,
  setGrpcTransportMode,
  syncGrpcTabTransportMode,
  type GrpcTransportMode,
};

export function selectGrpcTransport(tabId?: string): GrpcTransportMode {
  if (tabId) {
    return resolveGrpcTransportForTab(tabId);
  }
  return resolveGrpcTransportForTab('__studio_default__');
}

let nativeTransportRefCount = 0;

/** Retain native stream transport install (ref-counted; shared by Studio + workflow). */
export function retainGrpcNativeTransport(): void {
  if (!isTauri()) {
    return;
  }
  if (nativeTransportRefCount === 0) {
    installGrpcNativeStreamTransport();
  }
  nativeTransportRefCount += 1;
}

/** Release one retain; clears overrides when ref count reaches zero. */
export function releaseGrpcNativeTransport(): void {
  if (nativeTransportRefCount === 0) {
    return;
  }
  nativeTransportRefCount -= 1;
  if (nativeTransportRefCount === 0) {
    clearGrpcNativeStreamTransport();
  }
}

/** Studio mount hook — returns dispose that releases one retain. */
export function mountGrpcStudioNativeTransport(): () => void {
  retainGrpcNativeTransport();
  return () => releaseGrpcNativeTransport();
}

export function getGrpcNativeTransportRefCountForTests(): number {
  return nativeTransportRefCount;
}

export function resetGrpcNativeTransportRefCountForTests(): void {
  nativeTransportRefCount = 0;
  clearGrpcNativeStreamTransport();
  resetGrpcTabTransportRoutingForTests();
}

export type GrpcUnaryInvokeOptions = {
  request: GrpcCallRequest;
  tabId: string;
  descriptorPayload?: BuildGrpcTauriDescriptorPayloadInput;
  /** Phase 7F — set when retrying via express after native pre-start failure. */
  fallbackReason?: string;
  /** Phase 10B — frozen snapshot transport mode overrides live tab registry. */
  transportMode?: GrpcStudioTransportMode;
};

export async function invokeGrpcUnary(
  options: GrpcUnaryInvokeOptions,
): Promise<GrpcSuccessEnvelope<GrpcCallResult>> {
  const { request, tabId, descriptorPayload, fallbackReason, transportMode } = options;
  const mode = transportMode ?? resolveGrpcTransportForTab(tabId);
  assertGrpcTransportDispatchReady(mode);
  const adapter = resolveGrpcBrowserTransportAdapterForTab(tabId, transportMode);
  return adapter.invokeUnary({
    request,
    tabId,
    descriptorPayload,
    fallbackReason,
  });
}

export async function cancelGrpcUnary(
  requestId: string,
  tabId: string,
  options?: { transportMode?: GrpcStudioTransportMode },
): Promise<GrpcSuccessEnvelope<GrpcCancelCallResult>> {
  const mode = options?.transportMode ?? resolveGrpcTransportForTab(tabId);
  assertGrpcTransportDispatchReady(mode);
  const adapter = resolveGrpcBrowserTransportAdapterForTab(tabId, options?.transportMode);
  return adapter.cancelUnary(requestId, tabId);
}

/** Best-effort bulk native cleanup for a closed tab (Phase 7H). */
export async function cleanupGrpcTabNative(
  tabId: string,
  options?: { transportMode?: GrpcTransportMode },
): Promise<void> {
  const mode = options?.transportMode ?? resolveGrpcTransportForTab(tabId);
  if (!isTauri() || mode !== 'tauri') {
    return;
  }
  try {
    await invokeGrpcTabCleanupNative(tabId);
  } catch {
    // Tab is already closing locally — cleanup is best-effort.
  }
}
