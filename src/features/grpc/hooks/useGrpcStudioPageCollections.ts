import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import type { UseGrpcCollectionsResult } from '../hooks/useGrpcCollections';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';
import { isGrpcReplayExecutable, resolveGrpcReplayBinding } from '../utils/grpcReplayBinding';
import { resolveUnaryResultForSavedRequestComparison } from '../utils/grpcResponseSnapshot';

export interface GrpcSelectedSavedContext {
  collectionId: string;
  saved: GrpcSavedRequest;
}

export function useGrpcSelectedSavedRequest(
  collections: UseGrpcCollectionsResult,
  selectedSavedId: string | null,
  studio: UseGrpcStudioReturn,
  envVarMap: Record<string, string>,
  pageDefaults: GrpcTabConnectionPageDefaults,
) {
  const selectedSavedContext = useMemo((): GrpcSelectedSavedContext | null => {
    if (!selectedSavedId) return null;
    for (const collection of collections.collections) {
      const saved = collection.savedRequests.find((entry) => entry.id === selectedSavedId);
      if (saved) {
        return { collectionId: collection.id, saved };
      }
    }
    return null;
  }, [collections.collections, selectedSavedId]);

  const selectedSavedRequest = selectedSavedContext?.saved ?? null;

  const lastUnaryResultForSelected = useMemo(
    () => resolveUnaryResultForSavedRequestComparison(selectedSavedContext?.saved, studio.activeTab),
    [selectedSavedContext, studio.activeTab],
  );

  const openInStudioStatusForSelected = useMemo(() => {
    if (!selectedSavedRequest) {
      return { executable: true, title: 'Open in Studio' };
    }
    try {
      const binding = resolveGrpcReplayBinding({
        saved: selectedSavedRequest,
        tab: studio.activeTab,
        requestId: 'preview',
        envVarMap,
        profiles: studio.profiles,
        pageDefaults,
        currentDescriptor: studio.activeTabDescriptor.descriptor,
        tabDescriptorState: studio.activeTabDescriptor,
      });
      const executable = isGrpcReplayExecutable(binding.drift);
      return {
        executable,
        title: executable
          ? 'Open in Studio'
          : (binding.drift.message || 'Open in Studio blocked'),
      };
    } catch (error) {
      return {
        executable: false,
        title: error instanceof Error ? error.message : 'Open in Studio blocked',
      };
    }
  }, [selectedSavedRequest, studio, envVarMap, pageDefaults]);

  const runLoadTestStatusForSelected = useMemo(() => {
    if (!selectedSavedRequest) {
      return { executable: false, title: 'Select a saved request' };
    }
    if (selectedSavedRequest.callType !== 'unary') {
      return {
        executable: false,
        title: 'Load tests support unary RPCs only',
      };
    }
    return openInStudioStatusForSelected;
  }, [selectedSavedRequest, openInStudioStatusForSelected]);

  const compareSchemaStatusForSelected = useMemo(() => {
    if (!selectedSavedRequest) {
      return { executable: false, title: 'Select a saved request' };
    }
    const currentDescriptorKey = (
      studio.activeTabDescriptor.descriptor?.key
      ?? studio.activeTab.descriptorKey
      ?? ''
    ).trim();
    if (!currentDescriptorKey) {
      return {
        executable: false,
        title: 'Load a descriptor on the active tab before comparing schemas',
      };
    }
    const intent = collections.buildSavedRequestSchemaCompareIntent(selectedSavedRequest, currentDescriptorKey);
    if (!intent.baselineDescriptorKey) {
      return {
        executable: false,
        title: 'Saved request is missing a descriptor key',
      };
    }
    if (!intent.keysDiffer) {
      return {
        executable: false,
        title: 'Saved request already uses the active descriptor',
      };
    }
    return {
      executable: true,
      title: 'Compare saved request descriptor with the active descriptor',
    };
  }, [collections, selectedSavedRequest, studio.activeTab.descriptorKey, studio.activeTabDescriptor.descriptor?.key]);

  return {
    selectedSavedRequest,
    selectedSavedContext,
    lastUnaryResultForSelected,
    openInStudioStatusForSelected,
    runLoadTestStatusForSelected,
    compareSchemaStatusForSelected,
  };
}

export interface UseGrpcSavedRequestRunTrackingOptions {
  studio: UseGrpcStudioReturn;
  collections: UseGrpcCollectionsResult;
  savedReplaySourceByTabId: Record<string, { collectionId: string; savedId: string }>;
}

export function useGrpcSavedRequestRunTracking({
  studio,
  collections,
  savedReplaySourceByTabId,
}: UseGrpcSavedRequestRunTrackingOptions) {
  const recordedSavedRunRequestIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const source = savedReplaySourceByTabId[studio.activeTab.id];
    if (!source) return;
    const tab = studio.activeTab;
    const saved = collections.collections
      .find((collection) => collection.id === source.collectionId)
      ?.savedRequests.find((entry) => entry.id === source.savedId);
    if (!saved) return;

    const snapshot = tab.lastExecuteSnapshot;
    if (!snapshot || snapshot.callType === 'unary') {
      if (!snapshot) return;
      const requestId = snapshot.requestId;
      if (recordedSavedRunRequestIdsRef.current.has(requestId)) return;
      const unaryTerminal = tab.lifecycle === 'success'
        || tab.lifecycle === 'error'
        || tab.lifecycle === 'cancelled';
      if (!unaryTerminal) return;

      let grpcStatus: number | undefined;
      let durationMs: number | undefined;
      if (tab.lifecycle === 'success') {
        grpcStatus = tab.lastResult?.status;
        durationMs = tab.lastResult?.durationMs;
      } else if (tab.lifecycle === 'cancelled') {
        grpcStatus = 1;
      } else {
        const details = tab.lastError?.details;
        const candidate = (details && typeof details === 'object' && 'grpcStatus' in details)
          ? (details as { grpcStatus?: unknown }).grpcStatus
          : undefined;
        grpcStatus = typeof candidate === 'number' ? candidate : 2;
      }

      if (
        saved.service !== snapshot.service
        || saved.method !== snapshot.method
        || (saved.descriptorKey && saved.descriptorKey !== snapshot.descriptorKey)
      ) {
        return;
      }

      recordedSavedRunRequestIdsRef.current.add(requestId);
      void collections.recordSavedRequestRun(source.collectionId, source.savedId, {
        grpcStatus,
        durationMs,
      }).catch(() => {
        recordedSavedRunRequestIdsRef.current.delete(requestId);
      });
      return;
    }

    const requestId = snapshot.requestId;
    if (recordedSavedRunRequestIdsRef.current.has(requestId)) return;
    const streamTerminal = tab.streamLifecycle === 'ended'
      || tab.streamLifecycle === 'error'
      || tab.streamLifecycle === 'cancelled';
    if (!streamTerminal) return;

    let grpcStatus: number | undefined;
    if (tab.streamLifecycle === 'ended') {
      grpcStatus = 0;
    } else if (tab.streamLifecycle === 'cancelled') {
      grpcStatus = 1;
    } else {
      const details = tab.streamError?.details;
      const candidate = (details && typeof details === 'object' && 'grpcStatus' in details)
        ? (details as { grpcStatus?: unknown }).grpcStatus
        : undefined;
      grpcStatus = typeof candidate === 'number' ? candidate : 2;
    }

    let durationMs: number | undefined;
    if (tab.streamStartedAt && tab.streamEndedAt) {
      const start = Date.parse(tab.streamStartedAt);
      const end = Date.parse(tab.streamEndedAt);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        durationMs = end - start;
      }
    }

    if (
      saved.service !== snapshot.service
      || saved.method !== snapshot.method
      || (saved.descriptorKey && saved.descriptorKey !== snapshot.descriptorKey)
    ) {
      return;
    }

    recordedSavedRunRequestIdsRef.current.add(requestId);
    void collections.recordSavedRequestRun(source.collectionId, source.savedId, {
      grpcStatus,
      durationMs,
    }).catch(() => {
      recordedSavedRunRequestIdsRef.current.delete(requestId);
    });
  }, [studio.activeTab, savedReplaySourceByTabId, collections]);
}

export function useGrpcStudioSaveSnapshot(
  studio: UseGrpcStudioReturn,
  envVarMap: Record<string, string>,
) {
  return useCallback(() => {
    const tab = studio.activeTab;
    if (!tab.service || !tab.method) {
      return { snapshot: null, errorMessage: undefined };
    }
    try {
      return {
        snapshot: studio.prepareExecuteSnapshot(
          tab.id,
          globalThis.crypto?.randomUUID?.() ?? `save-${Date.now()}`,
        ),
        errorMessage: undefined,
        tabContext: {
          connectionId: tab.connectionId,
          rawTarget: tab.target,
          rawBody: tab.body,
          rawMetadata: tab.metadata,
          rawAuth: tab.auth,
          interpolationEnv: envVarMap,
        },
      };
    } catch (error) {
      return {
        snapshot: null,
        errorMessage: error instanceof Error ? error.message : 'Cannot prepare request snapshot',
      };
    }
  }, [studio, envVarMap]);
}
