import {
  GRPC_ERROR_CODES,
  type GrpcErrorBody,
} from '../../../shared/grpc/contracts';
import { resolveDescriptorSourceFingerprint } from '../../../shared/grpc/descriptorSourcePolicy';
import {
  invokeGrpcUnary,
  cancelGrpcUnary,
} from '../../../shared/grpc/grpcTransportFacade';
import {
  GrpcApiClientError,
} from '../../../shared/grpc/grpcApiClient';
import {
  assertGrpcTransportExecutePreflight,
} from '../../../shared/grpc/grpcWebTransportContracts';
import { assertGrpcTransportDispatchReady } from '../../../shared/grpc/grpcBrowserTransportRouter';
import {
  captureGrpcTabExecuteSnapshotFromResolution,
  resolveGrpcStudioTabTransportMode,
  clearedGrpcStreamSessionPatch,
  isGrpcLifecycleInFlight,
  snapshotToUnaryCallRequest,
  type GrpcExecuteOverrides,
  type GrpcTabExecuteSnapshot,
} from '../grpcStudioTypes';
import { isGrpcExecuteBlockedByDrift } from '../utils/grpcReplayBinding';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';
import { captureGrpcCallHistoryFromOutcome } from '../utils/grpcStudioCallHistoryCapture';
import {
  grpcApiErrorToExpressFallbackBody,
  isGrpcExpressFallbackOffered,
  isGrpcNativePreflightFailure,
  type GrpcExpressFallbackDetails,
} from '../../../shared/grpc/grpcTransportFallback';
import {
  grpcApiErrorToBrowserExpressFallbackBody,
  isBrowserDirectTransportMode,
} from '../../../shared/grpc/grpcBrowserTransportErrorMapper';
import {
  assertTabTlsConfigValid,
  releaseCompletedGrpcCall,
  bindTabInterpolationEnvForExecute,
  resolveTabConnectionWithEnv,
  tabHasPendingUnaryCall,
} from './grpcStudioSessionHelpers';
import { resolveGrpcStudioTabFieldsForExecute } from '../../../shared/grpc/grpcStudioExecuteInterpolation';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import type { GrpcStudioSessionCore } from './useGrpcStudioSessionCore';
import {
  abortTabActiveStream,
  buildStreamEventErrorBody,
  tabHasActiveStream,
} from './grpcStreamSessionHelpers';

type SessionCore = Pick<
  GrpcStudioSessionCore,
  | 'sessionRef'
  | 'tabsRef'
  | 'commitSession'
  | 'setSession'
  | 'callGenerationRef'
  | 'streamGenerationRef'
  | 'streamDisposeRef'
  | 'inFlightCallRef'
>;

export function createPrepareExecuteSnapshotHandler(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
): (tabId: string, requestId: string, overrides?: GrpcExecuteOverrides) => GrpcTabExecuteSnapshot {
  return (tabId, requestId, overrides) => {
    const tab = core.tabsRef.current.find((entry) => entry.id === tabId);
    if (!tab) {
      throw new Error(`Tab not found: ${tabId}`);
    }
    const mergedTab = overrides ? { ...tab, ...overrides } : tab;
    const interpolationEnv = bindTabInterpolationEnvForExecute(
      mergedTab,
      ctx.envVarMap,
      ctx.profiles,
      ctx.pageDefaults,
      ctx.workspaceDefaults,
    );
    const resolution = resolveTabConnectionWithEnv(
      mergedTab,
      ctx.envVarMap,
      ctx.profiles,
      ctx.pageDefaults,
      ctx.workspaceDefaults,
    );
    if (!resolution.targetValidation.valid) {
      throw new Error(resolution.targetValidation.reason);
    }
    assertTabTlsConfigValid(resolution, mergedTab.tlsConfig);
    const descriptorState = core.sessionRef.current.tabDescriptors[tabId];
    if (isGrpcExecuteBlockedByDrift(descriptorState?.driftState)) {
      throw new Error(descriptorState?.driftMessage ?? 'Resolve blocking schema drift before executing');
    }
    if (descriptorState?.loadState === 'loading') {
      throw new Error('Schema is still loading — wait for reflect or describe to finish');
    }
    const descriptor = descriptorState?.descriptor;
    const method = mergedTab.service && mergedTab.method && descriptor
      ? findGrpcMethod(descriptor, mergedTab.service, mergedTab.method)
      : undefined;
    const callType = method?.callType ?? 'unary';
    const transportMode = resolveGrpcStudioTabTransportMode(mergedTab);
    assertGrpcTransportExecutePreflight({
      transportMode,
      callType,
      tlsMode: resolution.tlsMode ?? mergedTab.tlsMode,
    });
    const resolvedFields = resolveGrpcStudioTabFieldsForExecute(
      mergedTab,
      interpolationEnv.env,
    );
    const executeTab = {
      ...mergedTab,
      body: resolvedFields.body,
      metadata: resolvedFields.metadata,
      auth: resolvedFields.auth,
    };
    return captureGrpcTabExecuteSnapshotFromResolution(executeTab, requestId, resolution, callType, {
      sourceFingerprint: resolveDescriptorSourceFingerprint(
        descriptor,
        descriptorState?.sourceFingerprint,
      ),
      interpolationEnv,
    });
  };
}

export function createCancelUnaryCallHandler(
  _ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
  onCancelInFlight?: (tabId: string, requestId: string) => void,
): (tabId: string) => Promise<void> {
  return async (tabId) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab || !tabHasPendingUnaryCall(tab, tabId, core.inFlightCallRef)) {
      return;
    }

    const requestId = tab.activeRequestId ?? core.inFlightCallRef.current[tabId];
    core.callGenerationRef.current[tabId] = (core.callGenerationRef.current[tabId] ?? 0) + 1;
    delete core.inFlightCallRef.current[tabId];

    core.setSession((prev) => {
      const target = prev.tabs.find((entry) => entry.id === tabId);
      if (!target) return prev;
      if (target.lifecycle === 'success') return prev;
      if (requestId && target.activeRequestId && target.activeRequestId !== requestId) {
        return prev;
      }
      if (!isGrpcLifecycleInFlight(target.lifecycle) && !requestId) {
        return prev;
      }
      return core.commitSession({
        ...prev,
        tabs: prev.tabs.map((entry) => {
          if (entry.id !== tabId) return entry;
          return {
            ...entry,
            lifecycle: 'cancelled' as const,
            activeRequestId: undefined,
          };
        }),
      });
    });

    if (requestId) {
      onCancelInFlight?.(tabId, requestId);
      try {
        const latestTab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
        const cancelMode = latestTab?.lastExecuteSnapshot?.transportMode
          ?? (latestTab ? resolveGrpcStudioTabTransportMode(latestTab) : resolveGrpcStudioTabTransportMode(tab));
        await cancelGrpcUnary(requestId, tabId, { transportMode: cancelMode });
      } catch {
        // Best-effort cancel — tab is already marked cancelled locally when still in-flight.
      }
    }
  };
}

export function createExecuteUnaryCallHandler(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
  prepareExecuteSnapshot: (
    tabId: string,
    requestId: string,
    overrides?: GrpcExecuteOverrides,
  ) => GrpcTabExecuteSnapshot,
): (tabId: string, overrides?: GrpcExecuteOverrides) => Promise<void> {
  return async (tabId, overrides) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab || isGrpcLifecycleInFlight(tab.lifecycle) || core.inFlightCallRef.current[tabId]) {
      return;
    }

    const expressFallbackReason = resolveGrpcStudioTabTransportMode(tab) === 'express'
      && tab.lastError
      && isGrpcExpressFallbackOffered(tab.lastError)
      ? ((tab.lastError.details as GrpcExpressFallbackDetails | undefined)?.fallbackReason
        ?? tab.lastError.message)
      : undefined;

    if (tabHasActiveStream(tab) || tab.activeStreamId) {
      abortTabActiveStream(tabId, tab, core.streamGenerationRef, core.streamDisposeRef);
      ctx.updateTab(tabId, clearedGrpcStreamSessionPatch());
    }

    const generation = (core.callGenerationRef.current[tabId] ?? 0) + 1;
    core.callGenerationRef.current[tabId] = generation;
    const isStale = () => core.callGenerationRef.current[tabId] !== generation;

    const requestId = globalThis.crypto?.randomUUID?.() ?? `req-call-${Date.now()}`;
    core.inFlightCallRef.current[tabId] = requestId;

    ctx.updateTab(tabId, {
      lifecycle: 'calling',
      activeRequestId: requestId,
      lastExecuteSnapshot: undefined,
      lastResult: undefined,
      lastError: undefined,
    });

    let snapshot: GrpcTabExecuteSnapshot;
    try {
      snapshot = prepareExecuteSnapshot(tabId, requestId, overrides);
    } catch (error) {
      delete core.inFlightCallRef.current[tabId];
      if (isStale()) return;
      const message = error instanceof Error ? error.message : 'Cannot execute unary call';
      const lastError: GrpcErrorBody = {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        category: 'validation',
        message,
      };
      ctx.updateTab(tabId, {
        lifecycle: 'error',
        activeRequestId: undefined,
        lastError,
      });
      return;
    }

    ctx.updateTab(tabId, {
      lastExecuteSnapshot: snapshot,
    });

    if (snapshot.callType !== 'unary') {
      delete core.inFlightCallRef.current[tabId];
      if (isStale()) return;
      ctx.updateTab(tabId, {
        lifecycle: 'error',
        activeRequestId: undefined,
        lastError: {
          code: GRPC_ERROR_CODES.INVALID_REQUEST,
          category: 'validation',
          message: `Unary Send is not available for ${snapshot.callType} methods`,
        },
      });
      return;
    }

    try {
      assertGrpcTransportDispatchReady(snapshot.transportMode ?? resolveGrpcStudioTabTransportMode(tab));
    } catch (error) {
      delete core.inFlightCallRef.current[tabId];
      if (isStale()) return;
      const message = error instanceof Error ? error.message : 'Transport dispatch is not available';
      ctx.updateTab(tabId, {
        lifecycle: 'error',
        activeRequestId: undefined,
        lastError: {
          code: GRPC_ERROR_CODES.INVALID_REQUEST,
          category: 'validation',
          message,
        },
      });
      return;
    }

    try {
      const request = snapshotToUnaryCallRequest(snapshot);
      const envelope = await invokeGrpcUnary({
        request,
        tabId,
        transportMode: snapshot.transportMode,
        fallbackReason: expressFallbackReason,
      });
      if (isStale()) return;

      if (core.inFlightCallRef.current[tabId] !== snapshot.requestId) {
        return;
      }
      delete core.inFlightCallRef.current[tabId];

      const latencyHistoryMs = [
        ...(core.sessionRef.current.tabs.find((entry) => entry.id === tabId)?.latencyHistoryMs ?? []),
        envelope.data.durationMs,
      ].slice(-200);

      ctx.updateTab(tabId, {
        lifecycle: 'success',
        activeRequestId: undefined,
        lastResult: envelope.data,
        lastError: undefined,
        latencyHistoryMs,
      });

      captureGrpcCallHistoryFromOutcome({
        snapshot,
        result: envelope.data,
        templateContext: {
          rawTarget: core.sessionRef.current.tabs.find((entry) => entry.id === tabId)?.target,
          filterTarget: snapshot.target.address,
        },
      });
    } catch (error) {
      if (isStale()) return;

      if (core.inFlightCallRef.current[tabId] !== snapshot.requestId) {
        return;
      }
      delete core.inFlightCallRef.current[tabId];

      const current = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
      if (current?.lifecycle === 'cancelled') {
        return;
      }

      if (error instanceof GrpcApiClientError && error.code === GRPC_ERROR_CODES.CANCELLED) {
        ctx.updateTab(tabId, {
          lifecycle: 'cancelled',
          activeRequestId: undefined,
        });
        return;
      }

      const lastError: GrpcErrorBody = error instanceof GrpcApiClientError
        ? (() => {
            const body = error.toErrorBody();
            const tabForFallback = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
            if (
              tabForFallback
              && resolveGrpcStudioTabTransportMode(tabForFallback) === 'tauri'
              && isGrpcNativePreflightFailure(error)
            ) {
              return grpcApiErrorToExpressFallbackBody(error);
            }
            const browserMode = snapshot.transportMode
              ?? (tabForFallback ? resolveGrpcStudioTabTransportMode(tabForFallback) : undefined);
            if (browserMode && isBrowserDirectTransportMode(browserMode)) {
              return grpcApiErrorToBrowserExpressFallbackBody(error, browserMode);
            }
            return body;
          })()
        : buildStreamEventErrorBody(
            error instanceof Error ? error.message : 'Unary call failed',
          );

      ctx.updateTab(tabId, {
        lifecycle: 'error',
        activeRequestId: undefined,
        lastError,
      });

      captureGrpcCallHistoryFromOutcome({
        snapshot,
        error: lastError,
        templateContext: {
          rawTarget: core.sessionRef.current.tabs.find((entry) => entry.id === tabId)?.target,
          filterTarget: snapshot.target.address,
        },
      });
    } finally {
      releaseCompletedGrpcCall(snapshot.requestId, tabId, {
        transportMode: snapshot.transportMode,
      });
    }
  };
}
