import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GrpcMockConfigSource } from '@shared/grpc/grpcMockConfigResolution';
import type { GrpcMockLatencyPolicy } from '@shared/grpc/grpcMockLatencySimulation';
import type { GrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import {
  buildMockConfigSourceFromEditor,
  getGrpcStudioMockRuntimeRegistry,
  resetAdvancedOpToIdle,
  resolveGrpcStudioMockConfig,
  transitionAdvancedOpToCompleted,
  transitionAdvancedOpToFailed,
  transitionAdvancedOpToRunning,
} from '../utils/grpcStudioAdvancedCommands';
import { parseGrpcMockRuleSetJson } from '../utils/grpcStudioAdvancedModel';
import {
  commitGrpcMockNetworkListener,
  exportGrpcDescriptorProtoset,
  startGrpcMockNetworkListener,
  stopGrpcMockNetworkListener,
  supportsGrpcMockNetworkListener,
} from '../utils/grpcMockListenerClient';
import { isTauri } from '@shared/utils/platform';
import { sha256HexFromBase64 } from '@shared/grpc/grpcTauriDescriptorBridge';
import type { StudioSlice } from './useGrpcStudioAdvancedFeaturesTypes';

function workspaceMockDefault(): GrpcMockConfigSource {
  return { ruleSet: { rules: [] } };
}

export interface UseGrpcStudioAdvancedMockActionsOptions {
  studio: StudioSlice;
  activeTabId: string;
  activeMockConfigOverride: GrpcTabAdvancedFeaturesUiState['mockServer']['mockConfigOverride'];
  getTabState: (tabId: string) => GrpcTabAdvancedFeaturesUiState;
  patchTabState: (
    tabId: string,
    patch: Partial<GrpcTabAdvancedFeaturesUiState> | ((prev: GrpcTabAdvancedFeaturesUiState) => GrpcTabAdvancedFeaturesUiState),
    options?: { allowClosedTab?: boolean },
  ) => void;
}

export function useGrpcStudioAdvancedMockActions(options: UseGrpcStudioAdvancedMockActionsOptions) {
  const {
    studio,
    activeTabId,
    activeMockConfigOverride,
    getTabState,
    patchTabState,
  } = options;
  const mockRegistryRef = useRef(getGrpcStudioMockRuntimeRegistry());

  useEffect(() => {
    mockRegistryRef.current.setActiveTab(activeTabId);
  }, [activeTabId]);

  const patchMockRulesJson = useCallback((rulesJson: string) => {
    const tabId = activeTabId;
    const tabState = getTabState(tabId);
    const parsed = parseGrpcMockRuleSetJson(rulesJson);
    const listenerRunning = tabState.mockServer.listenerStatus?.running === true;
    patchTabState(tabId, (prev) => {
      const mockConfigOverride = parsed.ok
        ? buildMockConfigSourceFromEditor(parsed.ruleSet, prev.mockServer.latencyPolicy)
        : prev.mockServer.mockConfigOverride;
      return {
        ...prev,
        mockServer: {
          ...prev.mockServer,
          rulesJson,
          parseError: parsed.ok ? undefined : parsed.error,
          latencyPolicy: mockConfigOverride?.latencyPolicy,
          mockConfigOverride,
        },
      };
    });
    if (parsed.ok && mockRegistryRef.current.hasManager(tabId)) {
      try {
        const manager = mockRegistryRef.current.getManager(tabId);
        if (manager.getState().operation.status === 'running') {
          manager.commitRuleSet(parsed.ruleSet);
          const policy = buildMockConfigSourceFromEditor(
            parsed.ruleSet,
            tabState.mockServer.latencyPolicy,
          )?.latencyPolicy;
          if (policy != null) {
            manager.commitLatencyPolicy(policy);
          }
        }
      } catch {
        /* manager sync is best-effort when registry is inconsistent */
      }
    }
    if (parsed.ok && listenerRunning && supportsGrpcMockNetworkListener()) {
      void commitGrpcMockNetworkListener({
        tabId,
        ruleSet: parsed.ruleSet,
        latencyPolicy: tabState.mockServer.latencyPolicy,
      }).then((committed) => {
        patchTabState(tabId, (prev) => ({
          ...prev,
          mockServer: {
            ...prev.mockServer,
            listenerStatus: prev.mockServer.listenerStatus
              ? { ...prev.mockServer.listenerStatus, generation: committed.generation }
              : prev.mockServer.listenerStatus,
          },
        }));
      }).catch(() => undefined);
    }
  }, [activeTabId, getTabState, patchTabState]);

  const patchMockLatency = useCallback((patch: Partial<GrpcMockLatencyPolicy>) => {
    const tabId = activeTabId;
    patchTabState(tabId, (prev) => {
      const mergedLatency = { ...prev.mockServer.latencyPolicy, ...patch };
      const parsed = parseGrpcMockRuleSetJson(prev.mockServer.rulesJson);
      const mockConfigOverride = parsed.ok
        ? buildMockConfigSourceFromEditor(parsed.ruleSet, mergedLatency)
        : prev.mockServer.mockConfigOverride;
      return {
        ...prev,
        mockServer: {
          ...prev.mockServer,
          latencyPolicy: mockConfigOverride?.latencyPolicy,
          mockConfigOverride,
        },
      };
    });
    const tabState = getTabState(tabId);
    const parsed = parseGrpcMockRuleSetJson(tabState.mockServer.rulesJson);
    const listenerRunning = tabState.mockServer.listenerStatus?.running === true;
    const mergedLatency = { ...tabState.mockServer.latencyPolicy, ...patch };
    if (parsed.ok && mockRegistryRef.current.hasManager(tabId)) {
      try {
        const manager = mockRegistryRef.current.getManager(tabId);
        if (manager.getState().operation.status === 'running') {
          const policy = buildMockConfigSourceFromEditor(parsed.ruleSet, mergedLatency)?.latencyPolicy;
          if (policy != null) {
            manager.commitLatencyPolicy(policy);
          }
        }
      } catch {
        /* manager sync is best-effort when registry is inconsistent */
      }
    }
    if (parsed.ok && listenerRunning && supportsGrpcMockNetworkListener()) {
      const policy = buildMockConfigSourceFromEditor(parsed.ruleSet, mergedLatency)?.latencyPolicy;
      void commitGrpcMockNetworkListener({
        tabId,
        ruleSet: parsed.ruleSet,
        latencyPolicy: policy,
      }).catch(() => undefined);
    }
  }, [activeTabId, getTabState, patchTabState]);

  const patchMockExposeNetwork = useCallback((exposeNetworkEndpoint: boolean) => {
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      mockServer: { ...prev.mockServer, exposeNetworkEndpoint },
    }));
  }, [activeTabId, patchTabState]);

  const startMockServer = useCallback(async () => {
    const tabId = activeTabId;
    const tabState = getTabState(tabId);
    if (tabState.runtime.mockRuntime.status === 'running') {
      return;
    }
    const parsed = parseGrpcMockRuleSetJson(tabState.mockServer.rulesJson);
    if (!parsed.ok) {
      patchTabState(tabId, (prev) => ({
        ...prev,
        mockServer: { ...prev.mockServer, parseError: parsed.error },
        runtime: {
          ...prev.runtime,
          mockRuntime: transitionAdvancedOpToFailed(prev.runtime.mockRuntime, parsed.error),
        },
      }));
      return;
    }
    const config = resolveGrpcStudioMockConfig({
      tabId,
      connectionId: studio.activeTab.connectionId,
      mockConfigOverride: buildMockConfigSourceFromEditor(parsed.ruleSet, tabState.mockServer.latencyPolicy),
      profileConnectionId: studio.profiles.find((entry) => entry.id === studio.activeTab.connectionId)?.id,
      profileMockConfig: undefined,
      workspaceDefault: workspaceMockDefault(),
    });
    try {
      mockRegistryRef.current.startTabFromResolved(tabId, config);
      let listenerStatus = tabState.mockServer.listenerStatus;
      const shouldExposeNetwork = tabState.mockServer.exposeNetworkEndpoint !== false
        && supportsGrpcMockNetworkListener();
      if (shouldExposeNetwork) {
        const descriptor = studio.activeTabDescriptor.descriptor;
        if (descriptor == null) {
          throw new Error('Load a descriptor on the active tab before starting the network mock listener.');
        }
        let protosetBase64: string | undefined;
        let contentSha256: string | undefined;
        try {
          const exported = await exportGrpcDescriptorProtoset(descriptor.key);
          protosetBase64 = exported.protosetBase64;
          if (protosetBase64.trim()) {
            contentSha256 = await sha256HexFromBase64(protosetBase64);
          }
        } catch (error) {
          if (isTauri()) {
            const message = error instanceof Error ? error.message : 'unknown error';
            throw new Error(`Native mock listener requires descriptor export: ${message}`, { cause: error });
          }
          protosetBase64 = undefined;
          contentSha256 = undefined;
        }
        if (isTauri() && !protosetBase64?.trim()) {
          throw new Error('Native mock listener requires descriptor export before start.');
        }
        if (isTauri() && !contentSha256?.trim()) {
          throw new Error('Native mock listener requires full descriptor SHA-256 before start.');
        }
        listenerStatus = await startGrpcMockNetworkListener({
          tabId,
          connectionId: config.connectionId,
          descriptorKey: descriptor.key,
          protosetBase64,
          contentSha256,
          ruleSet: parsed.ruleSet,
          latencyPolicy: tabState.mockServer.latencyPolicy,
        });
      }
      patchTabState(tabId, (prev) => ({
        ...prev,
        mockServer: {
          ...prev.mockServer,
          parseError: undefined,
          listenerStatus: listenerStatus ?? prev.mockServer.listenerStatus,
        },
        runtime: {
          ...prev.runtime,
          mockRuntime: transitionAdvancedOpToRunning(prev.runtime.mockRuntime, `mock-${tabId}`),
        },
      }));
    } catch (error) {
      mockRegistryRef.current.stopTab(tabId);
      if (supportsGrpcMockNetworkListener()) {
        await stopGrpcMockNetworkListener(tabId).catch(() => undefined);
      }
      const message = error instanceof Error ? error.message : 'Failed to start mock runtime';
      patchTabState(tabId, (prev) => ({
        ...prev,
        mockServer: { ...prev.mockServer, listenerStatus: undefined },
        runtime: {
          ...prev.runtime,
          mockRuntime: transitionAdvancedOpToFailed(prev.runtime.mockRuntime, message),
        },
      }));
    }
  }, [activeTabId, getTabState, patchTabState, studio.activeTab.connectionId, studio.activeTabDescriptor.descriptor, studio.profiles]);

  const stopMockServer = useCallback(async () => {
    const tabId = activeTabId;
    if (supportsGrpcMockNetworkListener()) {
      await stopGrpcMockNetworkListener(tabId).catch(() => undefined);
    }
    mockRegistryRef.current.stopTab(tabId);
    patchTabState(tabId, (prev) => ({
      ...prev,
      mockServer: { ...prev.mockServer, listenerStatus: undefined },
      runtime: {
        ...prev.runtime,
        mockRuntime: prev.runtime.mockRuntime.status === 'running'
          ? transitionAdvancedOpToCompleted(prev.runtime.mockRuntime)
          : prev.runtime.mockRuntime,
      },
    }));
  }, [activeTabId, patchTabState]);

  const resetMockStatus = useCallback(() => {
    const tabId = activeTabId;
    const current = getTabState(tabId);
    if (current.runtime.mockRuntime.status === 'running') {
      return;
    }
    patchTabState(tabId, (prev) => ({
      ...prev,
      runtime: {
        ...prev.runtime,
        mockRuntime: resetAdvancedOpToIdle(prev.runtime.mockRuntime),
      },
    }));
  }, [activeTabId, getTabState, patchTabState]);

  const resolvedMockConfig = useMemo(() => {
    const tab = studio.activeTab;
    const profile = studio.profiles.find((entry) => entry.id === tab.connectionId);
    return resolveGrpcStudioMockConfig({
      tabId: tab.id,
      connectionId: tab.connectionId,
      mockConfigOverride: activeMockConfigOverride,
      profileConnectionId: profile?.id,
      profileMockConfig: undefined,
      workspaceDefault: workspaceMockDefault(),
    });
  }, [studio.activeTab, studio.profiles, activeMockConfigOverride]);

  const mockManagerState = useMemo(() => {
    if (!mockRegistryRef.current.hasManager(activeTabId)) {
      return undefined;
    }
    try {
      return mockRegistryRef.current.getManager(activeTabId).getState();
    } catch {
      return undefined;
    }
  }, [activeTabId]);

  return {
    mockRegistryRef,
    patchMockRulesJson,
    patchMockLatency,
    patchMockExposeNetwork,
    startMockServer,
    stopMockServer,
    resetMockStatus,
    resolvedMockConfig,
    mockManagerState,
  };
}
