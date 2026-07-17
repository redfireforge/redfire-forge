import { useCallback, useEffect, useRef, useState } from 'react';
import type { GrpcDescriptor } from '../../../shared/grpc/contracts';
import type { GrpcSchemaDiffChange } from '../../../shared/grpc/grpcSchemaDiffContracts';
import type { GrpcSchemaDiffReport } from '../../../shared/grpc/grpcSchemaDiffContracts';
import type { GrpcSchemaDiffSeverityFilter, GrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import {
  computeGrpcStudioSchemaDiffReport,
  resetAdvancedOpToIdle,
  transitionAdvancedOpQuickComplete,
  transitionAdvancedOpToFailed,
} from '../utils/grpcStudioAdvancedCommands';
import {
  addGrpcSchemaDiffAck,
  deleteGrpcSchemaDiffAck,
  deleteGrpcSchemaDiffAcksForBaseline,
  getGrpcSchemaDiffAcks,
  grpcSchemaDiffAckId,
  grpcSchemaDiffChangeId,
} from '../utils/grpcSchemaDiffAck';
import type { StudioSlice } from './useGrpcStudioAdvancedFeaturesTypes';

const GRPC_SCHEMA_DIFF_STATE_STORAGE_PREFIX = 'grpc-schema-diff-state-v1';

interface PersistedGrpcSchemaDiffState {
  baselineDescriptor?: GrpcDescriptor;
  baselineCapturedAt?: string;
  lastReport?: GrpcSchemaDiffReport;
  severityFilter?: GrpcSchemaDiffSeverityFilter;
  hideAcknowledged?: boolean;
}

function schemaDiffStorageKey(tabId: string): string {
  return `${GRPC_SCHEMA_DIFF_STATE_STORAGE_PREFIX}:${tabId}`;
}

function readPersistedSchemaDiffState(tabId: string): PersistedGrpcSchemaDiffState | null {
  try {
    const raw = localStorage.getItem(schemaDiffStorageKey(tabId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedGrpcSchemaDiffState;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedSchemaDiffState(tabId: string, state: PersistedGrpcSchemaDiffState): void {
  try {
    localStorage.setItem(schemaDiffStorageKey(tabId), JSON.stringify(state));
  } catch {
    // localStorage may be unavailable or quota may be exceeded
  }
}

function clearPersistedSchemaDiffState(tabId: string): void {
  try {
    localStorage.removeItem(schemaDiffStorageKey(tabId));
  } catch {
    // localStorage may be unavailable
  }
}

export function useGrpcAdvancedSchemaDiffSession(
  studio: StudioSlice,
  activeTabId: string,
  getTabState: (tabId: string) => GrpcTabAdvancedFeaturesUiState,
  patchTabState: (
    tabId: string,
    patch: Partial<GrpcTabAdvancedFeaturesUiState> | ((prev: GrpcTabAdvancedFeaturesUiState) => GrpcTabAdvancedFeaturesUiState),
  ) => void,
) {
  const [schemaDiffAckChangeIds, setSchemaDiffAckChangeIds] = useState<ReadonlySet<string>>(new Set());
  const schemaDiffAckRefreshGenRef = useRef(0);
  const hydratedTabsRef = useRef<Set<string>>(new Set());

  // Keep a stable ref to getTabState so refreshSchemaDiffAcks doesn't need
  // getTabState in its dependency array. Without this, every tabStateById change
  // (e.g. after each load-test run) recreates refreshSchemaDiffAcks, which
  // triggers the ack Effect to call setSchemaDiffAckChangeIds(new Set()) with a
  // fresh object reference — cascading into React's 50-render loop limit.
  const getTabStateRef = useRef(getTabState);
  getTabStateRef.current = getTabState;

  const refreshSchemaDiffAcks = useCallback(async (explicitBaselineKey?: string) => {
    const generation = ++schemaDiffAckRefreshGenRef.current;
    const key = explicitBaselineKey ?? getTabStateRef.current(activeTabId).schemaDiff.baselineDescriptor?.key;
    if (!key) {
      if (generation === schemaDiffAckRefreshGenRef.current) {
        setSchemaDiffAckChangeIds(new Set());
      }
      return;
    }
    try {
      const acks = await getGrpcSchemaDiffAcks(key);
      if (generation !== schemaDiffAckRefreshGenRef.current) {
        return;
      }
      setSchemaDiffAckChangeIds(new Set(acks.map((ack) => ack.changeId)));
    } catch {
      if (generation === schemaDiffAckRefreshGenRef.current) {
        setSchemaDiffAckChangeIds(new Set());
      }
    }
  }, [activeTabId]);

  useEffect(() => {
    setSchemaDiffAckChangeIds(new Set());
    void refreshSchemaDiffAcks();
  }, [activeTabId, refreshSchemaDiffAcks]);

  useEffect(() => {
    const tabState = getTabState(activeTabId);
    const alreadyHydrated = tabState.schemaDiff.baselineDescriptor || tabState.schemaDiff.lastReport;
    if (!alreadyHydrated) {
      const persisted = readPersistedSchemaDiffState(activeTabId);
      if (persisted) {
        patchTabState(activeTabId, (prev) => ({
          ...prev,
          schemaDiff: {
            ...prev.schemaDiff,
            baselineDescriptor: persisted.baselineDescriptor,
            baselineCapturedAt: persisted.baselineCapturedAt,
            lastReport: persisted.lastReport,
            severityFilter: persisted.severityFilter ?? prev.schemaDiff.severityFilter,
            hideAcknowledged: persisted.hideAcknowledged ?? prev.schemaDiff.hideAcknowledged,
          },
        }));
        if (persisted.baselineDescriptor?.key) {
          void refreshSchemaDiffAcks(persisted.baselineDescriptor.key);
        }
      }
    }
    hydratedTabsRef.current.add(activeTabId);
  }, [activeTabId, getTabState, patchTabState, refreshSchemaDiffAcks]);

  useEffect(() => {
    if (!hydratedTabsRef.current.has(activeTabId)) {
      return;
    }
    const schemaDiff = getTabState(activeTabId).schemaDiff;
    if (!schemaDiff.baselineDescriptor && !schemaDiff.lastReport) {
      return;
    }
    writePersistedSchemaDiffState(activeTabId, {
      baselineDescriptor: schemaDiff.baselineDescriptor,
      baselineCapturedAt: schemaDiff.baselineCapturedAt,
      lastReport: schemaDiff.lastReport,
      severityFilter: schemaDiff.severityFilter,
      hideAcknowledged: schemaDiff.hideAcknowledged,
    });
  }, [
    activeTabId,
    getTabState,
    schemaDiffAckChangeIds,
  ]);

  const setSchemaDiffSeverityFilter = useCallback((filter: GrpcSchemaDiffSeverityFilter) => {
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: { ...prev.schemaDiff, severityFilter: filter },
    }));
  }, [activeTabId, patchTabState]);

  const setSchemaDiffHideAcknowledged = useCallback((hideAcknowledged: boolean) => {
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: { ...prev.schemaDiff, hideAcknowledged },
    }));
  }, [activeTabId, patchTabState]);

  const acknowledgeSchemaDiffChange = useCallback(async (change: GrpcSchemaDiffChange) => {
    const baselineKey = getTabState(activeTabId).schemaDiff.baselineDescriptor?.key;
    if (!baselineKey) return;
    try {
      await addGrpcSchemaDiffAck(baselineKey, change);
      await refreshSchemaDiffAcks();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save acknowledgement';
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          schemaDiff: transitionAdvancedOpToFailed(prev.runtime.schemaDiff, message),
        },
      }));
    }
  }, [activeTabId, getTabState, patchTabState, refreshSchemaDiffAcks]);

  const unacknowledgeSchemaDiffChange = useCallback(async (change: GrpcSchemaDiffChange) => {
    const baselineKey = getTabState(activeTabId).schemaDiff.baselineDescriptor?.key;
    if (!baselineKey) return;
    try {
      const changeId = grpcSchemaDiffChangeId(change);
      await deleteGrpcSchemaDiffAck(grpcSchemaDiffAckId(baselineKey, changeId));
      await refreshSchemaDiffAcks();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove acknowledgement';
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          schemaDiff: transitionAdvancedOpToFailed(prev.runtime.schemaDiff, message),
        },
      }));
    }
  }, [activeTabId, getTabState, patchTabState, refreshSchemaDiffAcks]);

  const isSchemaDiffChangeAcknowledged = useCallback((change: GrpcSchemaDiffChange) => (
    schemaDiffAckChangeIds.has(grpcSchemaDiffChangeId(change))
  ), [schemaDiffAckChangeIds]);

  const captureSchemaBaseline = useCallback(() => {
    const descriptor = studio.activeTabDescriptor.descriptor;
    if (descriptor == null) {
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          schemaDiff: transitionAdvancedOpToFailed(
            prev.runtime.schemaDiff,
            'Load a descriptor on the active tab before capturing a baseline.',
          ),
        },
      }));
      return;
    }
    const priorBaselineKey = getTabState(activeTabId).schemaDiff.baselineDescriptor?.key;
    const cloned = structuredClone(descriptor) as GrpcDescriptor;
    const newBaselineKey = cloned.key;
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: {
        ...prev.schemaDiff,
        baselineDescriptor: cloned,
        baselineCapturedAt: new Date().toISOString(),
        lastReport: undefined,
      },
      runtime: {
        ...prev.runtime,
        schemaDiff: transitionAdvancedOpQuickComplete(prev.runtime.schemaDiff),
      },
    }));
    setSchemaDiffAckChangeIds(new Set());
    const baselineKeysToClear = new Set<string>([newBaselineKey]);
    if (priorBaselineKey) {
      baselineKeysToClear.add(priorBaselineKey);
    }
    void Promise.all(
      Array.from(baselineKeysToClear, (key) => deleteGrpcSchemaDiffAcksForBaseline(key)),
    ).then(() => refreshSchemaDiffAcks(newBaselineKey));
  }, [activeTabId, getTabState, patchTabState, refreshSchemaDiffAcks, studio.activeTabDescriptor.descriptor]);

  const runSchemaDiff = useCallback(() => {
    const tabState = getTabState(activeTabId);
    const baseline = tabState.schemaDiff.baselineDescriptor;
    const candidate = studio.activeTabDescriptor.descriptor;
    if (baseline == null) {
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          schemaDiff: transitionAdvancedOpToFailed(prev.runtime.schemaDiff, 'Capture a baseline before comparing.'),
        },
      }));
      return;
    }
    if (candidate == null) {
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          schemaDiff: transitionAdvancedOpToFailed(prev.runtime.schemaDiff, 'Load a candidate descriptor on the active tab.'),
        },
      }));
      return;
    }
    const report = computeGrpcStudioSchemaDiffReport({ baseline, candidate });
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: { ...prev.schemaDiff, lastReport: report },
      runtime: {
        ...prev.runtime,
        schemaDiff: transitionAdvancedOpQuickComplete(prev.runtime.schemaDiff),
      },
    }));
  }, [activeTabId, getTabState, patchTabState, studio.activeTabDescriptor.descriptor]);

  const clearSchemaBaseline = useCallback(() => {
    const baselineKey = getTabState(activeTabId).schemaDiff.baselineDescriptor?.key;
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: {
        ...prev.schemaDiff,
        baselineDescriptor: undefined,
        baselineCapturedAt: undefined,
        lastReport: undefined,
      },
      runtime: {
        ...prev.runtime,
        schemaDiff: resetAdvancedOpToIdle(prev.runtime.schemaDiff),
      },
    }));
    if (baselineKey) {
      setSchemaDiffAckChangeIds(new Set());
      void deleteGrpcSchemaDiffAcksForBaseline(baselineKey);
    } else {
      setSchemaDiffAckChangeIds(new Set());
    }
    clearPersistedSchemaDiffState(activeTabId);
  }, [activeTabId, getTabState, patchTabState]);

  const applySchemaDiffComparison = useCallback((input: {
    baselineDescriptor: GrpcDescriptor;
    report: GrpcSchemaDiffReport;
    baselineCapturedAt?: string;
  }) => {
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: {
        ...prev.schemaDiff,
        baselineDescriptor: structuredClone(input.baselineDescriptor) as GrpcDescriptor,
        baselineCapturedAt: input.baselineCapturedAt ?? new Date().toISOString(),
        lastReport: input.report,
      },
      runtime: {
        ...prev.runtime,
        schemaDiff: transitionAdvancedOpQuickComplete(prev.runtime.schemaDiff),
      },
    }));
    void refreshSchemaDiffAcks(input.baselineDescriptor.key);
  }, [activeTabId, patchTabState, refreshSchemaDiffAcks]);

  return {
    schemaDiffAckChangeIds,
    setSchemaDiffSeverityFilter,
    setSchemaDiffHideAcknowledged,
    acknowledgeSchemaDiffChange,
    unacknowledgeSchemaDiffChange,
    isSchemaDiffChangeAcknowledged,
    captureSchemaBaseline,
    runSchemaDiff,
    clearSchemaBaseline,
    applySchemaDiffComparison,
  };
}
