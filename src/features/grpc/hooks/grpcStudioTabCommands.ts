import {
  clearedGrpcStreamSessionPatch,
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  duplicateGrpcStudioTab,
  duplicateTabDescriptorState,
  type GrpcStudioTabState,
} from '../grpcStudioTypes';
import { buildDefaultGrpcBody } from '../utils/buildDefaultGrpcBody';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';
import {
  pruneGrpcBodyToSchema,
  rebindGrpcBodyToMethod,
} from '../utils/grpcSchemaDrift';
import { syncBodyWithSchema } from '../utils/grpcProtoFormValues';
import type { GrpcTabConnectionResolution } from '../utils/resolveGrpcTabConnection';
import {
  clearTabSessionVaultSecrets,
  copyTabVaultSecrets,
} from '../utils/grpcTabSecretVault';
import {
  abortTabPendingUnaryCall,
  clearedSchemaDriftPatch,
  pickFallbackActiveTabId,
  rememberTabConnectionFingerprint,
  resolveTabConnectionWithEnv,
  tabHasPendingUnaryCall,
} from './grpcStudioSessionHelpers';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import type { GrpcStudioSessionCore } from './useGrpcStudioSessionCore';
import {
  abortTabActiveStream,
  detachStreamEventsWhenSwitchingActiveTab,
  detachStreamEventsForTab,
  tabHasActiveStream,
} from './grpcStreamSessionHelpers';
import { cleanupGrpcStudioTabNativeResources } from './grpcStudioTabLifecycle';
import {
  clearGrpcStreamTransportBinding,
} from '../../../shared/grpc/grpcTransportFallback';
import {
  clearGrpcStudioTabTransport,
  syncGrpcStudioTabTransport,
} from '../utils/grpcStudioTransportSync';
import { resolveGrpcStudioTabTransportMode } from '../grpcStudioTypes';
import {
  GRPC_DEFAULT_CALL_TIMEOUT_MS,
  GRPC_DEFAULT_STREAM_CALL_TIMEOUT_MS,
} from '../../../shared/grpc/contracts';

type SessionCore = Pick<
  GrpcStudioSessionCore,
  | 'sessionRef'
  | 'setSession'
  | 'commitSession'
  | 'streamDisposeRef'
  | 'callGenerationRef'
  | 'streamGenerationRef'
  | 'inFlightCallRef'
  | 'descriptorLoadGenerationRef'
  | 'tabConnectionFingerprintRef'
>;

export function createAddTabHandler(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
): () => void {
  return () => {
    core.setSession((prev) => {
      if (prev.tabs.length >= ctx.maxTabs) return prev;
      const tab = createGrpcStudioTab({}, prev.tabs);
      detachStreamEventsWhenSwitchingActiveTab(core.streamDisposeRef, prev.activeTabId);
      rememberTabConnectionFingerprint(
        core.tabConnectionFingerprintRef,
        tab,
        ctx.envVarMap,
        ctx.profiles,
        ctx.pageDefaults,
      );
      syncGrpcStudioTabTransport(tab);
      return core.commitSession({
        tabs: [...prev.tabs, tab],
        activeTabId: tab.id,
        tabDescriptors: {
          ...prev.tabDescriptors,
          [tab.id]: createEmptyTabDescriptorState(),
        },
      });
    });
  };
}

export function createSelectTabHandler(
  core: SessionCore,
): (tabId: string) => void {
  return (tabId) => {
    core.setSession((prev) => {
      if (!prev.tabs.some((tab) => tab.id === tabId)) return prev;

      const previousActiveId = prev.activeTabId;
      if (previousActiveId !== tabId) {
        detachStreamEventsWhenSwitchingActiveTab(core.streamDisposeRef, previousActiveId);
      }

      return core.commitSession({ ...prev, activeTabId: tabId });
    });
  };
}

export function createRenameTabHandler(
  ctx: GrpcStudioRuntimeContext,
): (tabId: string, title: string) => void {
  return (tabId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    ctx.updateTab(tabId, { title: trimmed });
  };
}

export function createCloseTabHandler(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
): (tabId: string) => void {
  return (tabId) => {
    core.setSession((prev) => {
      if (prev.tabs.length <= 1) return prev;
      const closing = prev.tabs.find((tab) => tab.id === tabId);
      if (!closing) return prev;

      if (tabHasPendingUnaryCall(closing, tabId, core.inFlightCallRef)) {
        core.callGenerationRef.current[tabId] = (core.callGenerationRef.current[tabId] ?? 0) + 1;
        abortTabPendingUnaryCall(tabId, closing, core.inFlightCallRef, ctx.fireCancelInFlight);
      }

      if (tabHasActiveStream(closing) || closing.activeStreamId) {
        abortTabActiveStream(
          tabId,
          closing,
          core.streamGenerationRef,
          core.streamDisposeRef,
        );
      } else {
        detachStreamEventsForTab(core.streamDisposeRef, tabId);
      }
      void cleanupGrpcStudioTabNativeResources(
        tabId,
        resolveGrpcStudioTabTransportMode(closing),
      );

      const nextTabs = prev.tabs.filter((tab) => tab.id !== tabId);
      const remainingDescriptors = { ...prev.tabDescriptors };
      delete remainingDescriptors[tabId];
      delete core.descriptorLoadGenerationRef.current[tabId];
      delete core.callGenerationRef.current[tabId];
      delete core.streamGenerationRef.current[tabId];
      delete core.streamDisposeRef.current[tabId];
      delete core.inFlightCallRef.current[tabId];
      delete core.tabConnectionFingerprintRef.current[tabId];
      void clearTabSessionVaultSecrets({
        id: tabId,
        connectionId: closing.connectionId,
        target: closing.target,
      });
      clearGrpcStudioTabTransport(tabId);
      clearGrpcStreamTransportBinding(tabId);
      return core.commitSession({
        tabs: nextTabs,
        tabDescriptors: remainingDescriptors,
        activeTabId: prev.activeTabId === tabId
          ? pickFallbackActiveTabId(prev.tabs, tabId)
          : prev.activeTabId,
      });
    });
  };
}

export function createDuplicateTabHandler(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
): (tabId: string) => void {
  return (tabId) => {
    core.setSession((prev) => {
      if (prev.tabs.length >= ctx.maxTabs) return prev;
      const source = prev.tabs.find((tab) => tab.id === tabId);
      if (!source) return prev;
      detachStreamEventsWhenSwitchingActiveTab(core.streamDisposeRef, prev.activeTabId);
      const copy = duplicateGrpcStudioTab(source, prev.tabs);
      void copyTabVaultSecrets(
        { id: source.id, connectionId: source.connectionId, target: source.target },
        { id: copy.id, connectionId: copy.connectionId, target: copy.target },
      );
      rememberTabConnectionFingerprint(
        core.tabConnectionFingerprintRef,
        copy,
        ctx.envVarMap,
        ctx.profiles,
        ctx.pageDefaults,
      );
      syncGrpcStudioTabTransport(copy);
      return core.commitSession({
        tabs: [...prev.tabs, copy],
        activeTabId: copy.id,
        tabDescriptors: {
          ...prev.tabDescriptors,
          [copy.id]: duplicateTabDescriptorState(
            prev.tabDescriptors[tabId] ?? createEmptyTabDescriptorState(),
          ),
        },
      });
    });
  };
}

export function createReorderTabHandler(
  core: SessionCore,
): (fromIndex: number, toIndex: number) => void {
  return (fromIndex, toIndex) => {
    core.setSession((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.tabs.length) return prev;
      if (toIndex < 0 || toIndex >= prev.tabs.length) return prev;
      const next = [...prev.tabs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return core.commitSession({ ...prev, tabs: next });
    });
  };
}

export function createCloseOtherTabsHandler(
  core: SessionCore,
  closeTab: (tabId: string) => void,
): (keepTabId: string) => void {
  return (keepTabId) => {
    const { tabs } = core.sessionRef.current;
    const toClose = tabs.filter((t) => t.id !== keepTabId);
    for (const t of toClose) closeTab(t.id);
  };
}

export function createCloseTabsToRightHandler(
  core: SessionCore,
  closeTab: (tabId: string) => void,
): (tabId: string) => void {
  return (tabId) => {
    const { tabs } = core.sessionRef.current;
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const toClose = tabs.slice(idx + 1);
    for (const t of toClose) closeTab(t.id);
  };
}

export function createToggleServiceExpandedHandler(
  core: SessionCore,
): (tabId: string, serviceFullName: string) => void {
  return (tabId, serviceFullName) => {
    core.setSession((prev) => {
      if (!prev.tabs.some((tab) => tab.id === tabId)) return prev;
      const current = prev.tabDescriptors[tabId] ?? createEmptyTabDescriptorState();
      const expanded = new Set(current.expandedServiceIds);
      if (expanded.has(serviceFullName)) {
        expanded.delete(serviceFullName);
      } else {
        expanded.add(serviceFullName);
      }
      return core.commitSession({
        ...prev,
        tabDescriptors: {
          ...prev.tabDescriptors,
          [tabId]: {
            ...current,
            expandedServiceIds: Array.from(expanded),
          },
        },
      });
    });
  };
}

function abortTabCallsBeforeMethodChange(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
  tabId: string,
  tab: GrpcStudioTabState,
): void {
  if (tabHasPendingUnaryCall(tab, tabId, core.inFlightCallRef)) {
    core.callGenerationRef.current[tabId] = (core.callGenerationRef.current[tabId] ?? 0) + 1;
    abortTabPendingUnaryCall(tabId, tab, core.inFlightCallRef, ctx.fireCancelInFlight);
  }

  if (tabHasActiveStream(tab) || tab.activeStreamId) {
    abortTabActiveStream(tabId, tab, core.streamGenerationRef, core.streamDisposeRef);
  }
}

/** Abort pending unary + active stream before replay/import tab patches (Phase 5H). */
export function createAbortTabInFlightCallsHandler(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
): (tabId: string) => void {
  return (tabId) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab) return;
    abortTabCallsBeforeMethodChange(ctx, core, tabId, tab);
  };
}

export function createSelectMethodHandler(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
): (tabId: string, serviceFullName: string, methodName: string) => void {
  return (tabId, serviceFullName, methodName) => {
    const descriptorState = core.sessionRef.current.tabDescriptors[tabId];
    const descriptor = descriptorState?.descriptor;
    if (!descriptor) return;

    const method = findGrpcMethod(descriptor, serviceFullName, methodName);
    if (!method) return;

    const hasDrift = descriptorState.driftState && descriptorState.driftState !== 'none';
    const currentTab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    const nextTimeoutMs = method.callType !== 'unary'
      && (currentTab?.timeoutMs ?? GRPC_DEFAULT_CALL_TIMEOUT_MS) === GRPC_DEFAULT_CALL_TIMEOUT_MS
      ? GRPC_DEFAULT_STREAM_CALL_TIMEOUT_MS
      : currentTab?.timeoutMs;
    if (currentTab) {
      abortTabCallsBeforeMethodChange(ctx, core, tabId, currentTab);
    }

    ctx.updateTab(tabId, {
      descriptorKey: descriptor.key,
      service: serviceFullName,
      method: methodName,
      body: hasDrift
        ? rebindGrpcBodyToMethod(currentTab?.body ?? {}, method)
        : buildDefaultGrpcBody(method.requestSchema),
      timeoutMs: nextTimeoutMs,
      requestMode: 'form',
      lifecycle: 'idle',
      activeRequestId: undefined,
      lastResult: undefined,
      lastError: undefined,
      lastExecuteSnapshot: undefined,
      ...clearedGrpcStreamSessionPatch(),
    }, { descriptorPatch: clearedSchemaDriftPatch() });
  };
}

export function createDismissSchemaDriftHandler(
  ctx: GrpcStudioRuntimeContext,
): (tabId: string) => void {
  return (tabId) => {
    const descriptorState = ctx.sessionRef.current.tabDescriptors[tabId];
    if (!descriptorState || descriptorState.driftState !== 'warning') {
      return;
    }
    ctx.patchTabDescriptor(tabId, clearedSchemaDriftPatch());
  };
}

export function createPruneSchemaDriftBodyHandler(
  ctx: GrpcStudioRuntimeContext,
): (tabId: string) => void {
  return (tabId) => {
    const tab = ctx.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    const descriptorState = ctx.sessionRef.current.tabDescriptors[tabId];
    const descriptor = descriptorState?.descriptor;
    if (!tab?.service || !tab.method || !descriptor) {
      return;
    }
    const method = findGrpcMethod(descriptor, tab.service, tab.method);
    if (!method) {
      return;
    }
    const pruned = pruneGrpcBodyToSchema(tab.body, method.requestSchema);
    const synced = syncBodyWithSchema(pruned, method.requestSchema);
    ctx.updateTab(tabId, { body: synced }, { descriptorPatch: clearedSchemaDriftPatch() });
  };
}

export function createRebindSchemaDriftMethodHandler(
  ctx: GrpcStudioRuntimeContext,
  core: SessionCore,
): (tabId: string, serviceFullName: string, methodName: string) => void {
  return (tabId, serviceFullName, methodName) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    const descriptorState = core.sessionRef.current.tabDescriptors[tabId];
    const descriptor = descriptorState?.descriptor;
    if (!tab || !descriptor) {
      return;
    }
    const method = findGrpcMethod(descriptor, serviceFullName, methodName);
    if (!method) {
      return;
    }

    abortTabCallsBeforeMethodChange(ctx, core, tabId, tab);

    ctx.updateTab(tabId, {
      descriptorKey: descriptor.key,
      service: serviceFullName,
      method: methodName,
      body: rebindGrpcBodyToMethod(tab.body, method),
      lifecycle: 'idle',
      activeRequestId: undefined,
      lastResult: undefined,
      lastError: undefined,
      lastExecuteSnapshot: undefined,
      ...clearedGrpcStreamSessionPatch(),
    }, { descriptorPatch: clearedSchemaDriftPatch() });
  };
}

export function createResolveTabConnectionHandler(
  ctx: GrpcStudioRuntimeContext,
): (tabId: string) => GrpcTabConnectionResolution {
  return (tabId) => {
    const tab = ctx.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab) {
      throw new Error(`Tab not found: ${tabId}`);
    }
    return resolveTabConnectionWithEnv(
      tab,
      ctx.envVarMap,
      ctx.profiles,
      ctx.pageDefaults,
      ctx.workspaceDefaults,
    );
  };
}
