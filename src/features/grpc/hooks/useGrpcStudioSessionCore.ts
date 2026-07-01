import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createEmptyTabDescriptorState,
  createTabDescriptorStateAfterConnectionInvalidation,
  createTabDescriptorStateAfterReplayConnectionChange,
  isGrpcLifecycleTerminal,
  type GrpcStudioTabState,
  type GrpcTabDescriptorState,
} from '../grpcStudioTypes';
import { analyzeWarningDriftWithBaseline } from '../utils/grpcSchemaDrift';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';
import { scheduleTabSecretsVaultSync, shouldScheduleTabSecretsVaultSync } from '../utils/grpcTabSecretVault';
import type {
  GrpcConnectionProfile,
  GrpcTabConnectionPageDefaults,
} from '../utils/resolveGrpcTabConnection';
import {
  clearedSchemaDriftPatch,
  createInitialSessionState,
  invalidateTabConnectionContext,
  invalidateTabDescriptorConnectionContext,
  patchTouchesConnection,
  rememberTabConnectionFingerprint,
  sanitizeDescriptorPatch,
  sanitizeTabPatch,
  tabConnectionResolutionFingerprint,
  tabHasPendingUnaryCall,
  withTargetConnectionSessionReset,
  type GrpcStudioSessionState,
} from './grpcStudioSessionHelpers';
import { bumpGrpcTargetProbeGeneration } from '../utils/grpcTargetProbeGeneration';
import { resetTargetConnectionSession } from '../utils/grpcTargetConnection';
import { tabHasActiveStream } from './grpcStreamSessionHelpers';
import { isGrpcStreamLifecycleTerminal } from '../../../shared/grpc/streamLifecycle';

export interface UseGrpcStudioSessionCoreOptions {
  envVarMap: Record<string, string>;
  profiles: GrpcConnectionProfile[];
  pageDefaults: GrpcTabConnectionPageDefaults;
  fireCancelInFlight: (tabId: string, requestId: string) => void;
}

export function useGrpcStudioSessionCore(options: UseGrpcStudioSessionCoreOptions) {
  const { envVarMap, profiles, pageDefaults, fireCancelInFlight } = options;

  const descriptorLoadGenerationRef = useRef<Record<string, number>>({});
  const callGenerationRef = useRef<Record<string, number>>({});
  const streamGenerationRef = useRef<Record<string, number>>({});
  const streamDisposeRef = useRef<Record<string, () => void>>({});
  const inFlightCallRef = useRef<Record<string, string>>({});
  const tabConnectionFingerprintRef = useRef<Record<string, string>>({});
  const deferredConnectionInvalidationRef = useRef<Record<string, true>>({});

  const [session, setSession] = useState<GrpcStudioSessionState>(createInitialSessionState);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const tabsRef = useRef(session.tabs);
  tabsRef.current = session.tabs;

  const commitSession = useCallback((next: GrpcStudioSessionState): GrpcStudioSessionState => {
    sessionRef.current = next;
    tabsRef.current = next.tabs;
    return next;
  }, []);

  const { tabs, activeTabId, tabDescriptors } = session;

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!,
    [tabs, activeTabId],
  );

  const activeTabDescriptor = useMemo(
    () => tabDescriptors[activeTab.id] ?? createEmptyTabDescriptorState(),
    [tabDescriptors, activeTab.id],
  );

  const getTabDescriptor = useCallback((tabId: string): GrpcTabDescriptorState => {
    return sessionRef.current.tabDescriptors[tabId] ?? createEmptyTabDescriptorState();
  }, []);

  const patchTabDescriptor = useCallback((
    tabId: string,
    patch: Partial<GrpcTabDescriptorState>,
  ) => {
    const safePatch = sanitizeDescriptorPatch(patch);
    setSession((prev) => {
      if (!prev.tabs.some((tab) => tab.id === tabId)) return prev;
      const current = prev.tabDescriptors[tabId] ?? createEmptyTabDescriptorState();
      return commitSession({
        ...prev,
        tabDescriptors: {
          ...prev.tabDescriptors,
          [tabId]: { ...current, ...safePatch },
        },
      });
    });
  }, [commitSession]);

  useEffect(() => {
    if (tabs.length === 0) return;
    if (tabs.some((tab) => tab.id === activeTabId)) return;
    setSession((prev) => commitSession({ ...prev, activeTabId: prev.tabs[0]!.id }));
  }, [tabs, activeTabId, commitSession]);

  const tabTransportSignature = useMemo(
    () => tabs.map((tab) => (
      `${tab.id}:${tab.lifecycle}:${tab.streamLifecycle}:${tab.activeStreamId ?? ''}`
    )).join('|'),
    [tabs],
  );

  const applyDeferredConnectionInvalidations = useCallback(() => {
    setSession((prev) => {
      let dirty = false;
      let nextTabs = prev.tabs;
      let nextDescriptors = prev.tabDescriptors;

      for (const tab of prev.tabs) {
        if (!deferredConnectionInvalidationRef.current[tab.id]) {
          continue;
        }
        if (
          tabHasPendingUnaryCall(tab, tab.id, inFlightCallRef)
          || tabHasActiveStream(tab)
          || tab.activeStreamId
        ) {
          continue;
        }

        delete deferredConnectionInvalidationRef.current[tab.id];

        const preserveTerminalResults = isGrpcLifecycleTerminal(tab.lifecycle)
          || isGrpcStreamLifecycleTerminal(tab.streamLifecycle);
        const invalidationPatch = preserveTerminalResults
          ? invalidateTabDescriptorConnectionContext(tab.id, descriptorLoadGenerationRef)
          : invalidateTabConnectionContext(
            tab.id,
            tab,
            descriptorLoadGenerationRef,
            callGenerationRef,
            streamGenerationRef,
            inFlightCallRef,
            streamDisposeRef,
            fireCancelInFlight,
          );

        if (!dirty) {
          nextTabs = [...prev.tabs];
          nextDescriptors = { ...prev.tabDescriptors };
          dirty = true;
        }

        const index = nextTabs.findIndex((entry) => entry.id === tab.id);
        if (index < 0) continue;
        nextTabs[index] = { ...nextTabs[index]!, ...invalidationPatch };
        nextDescriptors[tab.id] = createTabDescriptorStateAfterConnectionInvalidation(
          prev.tabDescriptors[tab.id],
        );
      }

      if (!dirty) return prev;
      return commitSession({
        ...prev,
        tabs: nextTabs,
        tabDescriptors: nextDescriptors,
      });
    });
  }, [commitSession, fireCancelInFlight]);

  useEffect(() => {
    applyDeferredConnectionInvalidations();
  }, [tabTransportSignature, applyDeferredConnectionInvalidations]);

  useEffect(() => {
    setSession((prev) => {
      let dirty = false;
      let nextTabs = prev.tabs;
      let nextDescriptors = prev.tabDescriptors;

      for (const tab of prev.tabs) {
        const fingerprint = tabConnectionResolutionFingerprint(
          tab,
          envVarMap,
          profiles,
          pageDefaults,
        );
        const previousFingerprint = tabConnectionFingerprintRef.current[tab.id];
        if (previousFingerprint === undefined) {
          tabConnectionFingerprintRef.current[tab.id] = fingerprint;
          continue;
        }
        if (previousFingerprint === fingerprint) {
          continue;
        }

        tabConnectionFingerprintRef.current[tab.id] = fingerprint;

        // Phase 9C — env/connection changes must not abort in-flight executions.
        if (
          tabHasPendingUnaryCall(tab, tab.id, inFlightCallRef)
          || tabHasActiveStream(tab)
          || tab.activeStreamId
        ) {
          deferredConnectionInvalidationRef.current[tab.id] = true;
          continue;
        }

        const invalidationPatch = invalidateTabConnectionContext(
          tab.id,
          tab,
          descriptorLoadGenerationRef,
          callGenerationRef,
          streamGenerationRef,
          inFlightCallRef,
          streamDisposeRef,
          fireCancelInFlight,
        );

        if (!dirty) {
          nextTabs = [...prev.tabs];
          nextDescriptors = { ...prev.tabDescriptors };
          dirty = true;
        }

        const index = nextTabs.findIndex((entry) => entry.id === tab.id);
        if (index < 0) continue;
        nextTabs[index] = { ...nextTabs[index]!, ...invalidationPatch };
        nextDescriptors[tab.id] = createTabDescriptorStateAfterConnectionInvalidation(
          prev.tabDescriptors[tab.id],
        );
      }

      if (!dirty) return prev;
      return commitSession({
        ...prev,
        tabs: nextTabs,
        tabDescriptors: nextDescriptors,
      });
    });
  }, [commitSession, envVarMap, pageDefaults, profiles, fireCancelInFlight]);

  const updateTab = useCallback((
    tabId: string,
    patch: Partial<GrpcStudioTabState>,
    options?: { descriptorPatch?: Partial<GrpcTabDescriptorState> },
  ) => {
    const safePatch = sanitizeTabPatch(patch);
    const safeDescriptorPatch = options?.descriptorPatch
      ? sanitizeDescriptorPatch(options.descriptorPatch)
      : undefined;
    setSession((prev) => {
      if (!prev.tabs.some((tab) => tab.id === tabId)) return prev;

      const existingTab = prev.tabs.find((tab) => tab.id === tabId);
      const connectionChanged = patchTouchesConnection(safePatch)
        && existingTab
        && tabConnectionResolutionFingerprint(existingTab, envVarMap, profiles, pageDefaults)
          !== tabConnectionResolutionFingerprint(
            { ...existingTab, ...safePatch },
            envVarMap,
            profiles,
            pageDefaults,
          );

      let tabPatch = withTargetConnectionSessionReset(safePatch);
      if (
        existingTab?.targetConnection?.state === 'connecting'
        && tabPatch.targetConnection?.state === 'idle'
        && safePatch.targetConnection === undefined
      ) {
        bumpGrpcTargetProbeGeneration(tabId);
      }
      let nextDescriptors = prev.tabDescriptors;

      if (connectionChanged && existingTab) {
        const inFlight = tabHasPendingUnaryCall(existingTab, tabId, inFlightCallRef)
          || tabHasActiveStream(existingTab)
          || existingTab.activeStreamId;

        tabPatch = inFlight
          ? (() => {
            deferredConnectionInvalidationRef.current[tabId] = true;
            if (existingTab.targetConnection?.state === 'connecting') {
              bumpGrpcTargetProbeGeneration(tabId);
            }
            return {
              ...safePatch,
              targetConnection: resetTargetConnectionSession(),
            };
          })()
          : {
            ...invalidateTabConnectionContext(
              tabId,
              existingTab,
              descriptorLoadGenerationRef,
              callGenerationRef,
              streamGenerationRef,
              inFlightCallRef,
              streamDisposeRef,
              fireCancelInFlight,
            ),
            ...safePatch,
            lifecycle: 'idle',
            activeRequestId: undefined,
            lastResult: undefined,
            lastError: undefined,
            lastExecuteSnapshot: undefined,
          };

        if (!inFlight) {
          nextDescriptors = {
            ...prev.tabDescriptors,
            [tabId]: safePatch.descriptorKey?.trim()
              ? createTabDescriptorStateAfterReplayConnectionChange(
                prev.tabDescriptors[tabId],
                safePatch.descriptorKey,
              )
              : createTabDescriptorStateAfterConnectionInvalidation(prev.tabDescriptors[tabId]),
          };
        }
      }

      if (safeDescriptorPatch) {
        const currentDescriptor = nextDescriptors[tabId] ?? createEmptyTabDescriptorState();
        nextDescriptors = {
          ...nextDescriptors,
          [tabId]: { ...currentDescriptor, ...safeDescriptorPatch },
        };
      }

      const nextTabs = prev.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        return { ...tab, ...tabPatch };
      });
      const updatedTab = nextTabs.find((tab) => tab.id === tabId);
      if (updatedTab) {
        rememberTabConnectionFingerprint(
          tabConnectionFingerprintRef,
          updatedTab,
          envVarMap,
          profiles,
          pageDefaults,
        );
      }

      if (
        tabPatch.body !== undefined
        && updatedTab?.service
        && updatedTab.method
      ) {
        const descriptorState = nextDescriptors[tabId] ?? prev.tabDescriptors[tabId];
        if (
          descriptorState?.driftState === 'warning'
          && descriptorState.driftBaselineRequestSchema
          && descriptorState.descriptor
        ) {
          const method = findGrpcMethod(
            descriptorState.descriptor,
            updatedTab.service,
            updatedTab.method,
          );
          if (method) {
            const drift = analyzeWarningDriftWithBaseline(
              updatedTab.body,
              descriptorState.driftBaselineRequestSchema,
              method,
            );
            nextDescriptors = {
              ...nextDescriptors,
              [tabId]: {
                ...descriptorState,
                ...(drift.state === 'none'
                  ? clearedSchemaDriftPatch()
                  : {
                    driftState: 'warning' as const,
                    driftMessage: drift.message || undefined,
                    driftIssues: drift.issues.length > 0 ? drift.issues : undefined,
                    suggestedRebinds: undefined,
                    driftStaleMethod: undefined,
                    driftBaselineRequestSchema: descriptorState.driftBaselineRequestSchema,
                  }),
              },
            };
          }
        }
      }

      if (updatedTab && shouldScheduleTabSecretsVaultSync(tabPatch)) {
        const ownerChanged = 'target' in tabPatch || 'connectionId' in tabPatch;
        scheduleTabSecretsVaultSync({
          id: updatedTab.id,
          connectionId: updatedTab.connectionId,
          target: updatedTab.target,
          ...('tlsConfig' in tabPatch || ownerChanged ? { tlsConfig: updatedTab.tlsConfig } : {}),
          ...('auth' in tabPatch || ownerChanged ? { auth: updatedTab.auth } : {}),
        });
      }

      return commitSession({
        ...prev,
        tabDescriptors: nextDescriptors,
        tabs: nextTabs,
      });
    });
  }, [commitSession, envVarMap, pageDefaults, profiles, fireCancelInFlight]);

  return {
    session,
    setSession,
    sessionRef,
    tabsRef,
    commitSession,
    tabs,
    activeTabId,
    tabDescriptors,
    activeTab,
    activeTabDescriptor,
    getTabDescriptor,
    patchTabDescriptor,
    updateTab,
    descriptorLoadGenerationRef,
    callGenerationRef,
    streamGenerationRef,
    streamDisposeRef,
    inFlightCallRef,
    tabConnectionFingerprintRef,
  };
}

export type GrpcStudioSessionCore = ReturnType<typeof useGrpcStudioSessionCore>;
