import { useCallback } from 'react';
import type { GrpcCallHistoryEntryV1 } from '@shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '@shared/grpc/grpcSavedRequest';
import {
  mergeHistoryMetadataForGrpcurl,
  resolveSiblingRuntimeHistoryMetadata,
  sanitizeHistoryAuthForGrpcurl,
} from './grpcStudioPageHistoryMetadata';
import { prepareGrpcExecuteRequestMetadata } from '@shared/grpc/grpcAuthPolicy';
import { resolveGrpcStudioTabFieldsForExecute } from '@shared/grpc/grpcStudioExecuteInterpolation';
import { postGrpcDescriptorLookup } from '@shared/grpc/grpcApiClient';
import type { useGrpcCallHistory } from '../hooks/useGrpcCallHistory';
import type { useGrpcCollections } from '../hooks/useGrpcCollections';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import type { useGrpcStudioReplayActions, GrpcStudioPanelView } from '../hooks/useGrpcStudioReplayActions';
import {
  buildGrpcurlInvokeCommandFromSavedRequest,
  buildGrpcurlInvokeCommandFromSnapshot,
  resolveGrpcurlExportContextForTabRequest,
} from '../utils/grpcGrpcurl';
import { resolveGrpcHistoryEntryReplay } from '../utils/grpcReplayBinding';
import { getRuntimeGrpcHistoryMetadata } from '../utils/grpcStudioCallHistoryCapture';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';

export interface UseGrpcStudioPageHistoryActionsOptions {
  studio: UseGrpcStudioReturn;
  envVarMap: Record<string, string>;
  workspaceDefaults: Record<string, string>;
  pageDefaults: GrpcTabConnectionPageDefaults;
  collections: ReturnType<typeof useGrpcCollections>;
  callHistory: ReturnType<typeof useGrpcCallHistory>;
  advancedFeatures: UseGrpcStudioAdvancedFeaturesReturn;
  replayActions: ReturnType<typeof useGrpcStudioReplayActions>;
  onNavigate: (view: GrpcStudioPanelView) => void;
}

export function useGrpcStudioPageHistoryActions({
  studio,
  envVarMap,
  workspaceDefaults,
  pageDefaults,
  collections,
  callHistory,
  advancedFeatures,
  replayActions,
  onNavigate,
}: UseGrpcStudioPageHistoryActionsOptions) {
  const activeDescriptorKey = (studio.activeTabDescriptor.descriptor?.key ?? studio.activeTab.descriptorKey ?? '').trim();

  const compareSavedRequestSchemaInAdvanced = useCallback(async (saved: GrpcSavedRequest) => {
    if (!activeDescriptorKey) {
      return;
    }
    const descriptorCache = new Map<string, Promise<import('../../../shared/grpc/contracts').GrpcDescriptor>>();
    const resolveDescriptor = (descriptorKey: string) => {
      const key = descriptorKey.trim();
      if (!key) {
        return Promise.reject(new Error('Descriptor key is required'));
      }
      const cached = descriptorCache.get(key);
      if (cached) {
        return cached;
      }
      const pending = postGrpcDescriptorLookup({
        requestId: `lookup-${Date.now()}-${key}`,
        descriptorKey: key,
      }).then((envelope) => envelope.data);
      descriptorCache.set(key, pending);
      return pending;
    };

    try {
      const intent = collections.buildSavedRequestSchemaCompareIntent(saved, activeDescriptorKey);
      if (!intent.keysDiffer) {
        return;
      }
      const report = await collections.compareSavedRequestSchema(saved, activeDescriptorKey, resolveDescriptor);
      const baselineDescriptor = await resolveDescriptor(intent.baselineDescriptorKey);
      advancedFeatures.applySchemaDiffComparison({
        baselineDescriptor,
        report,
        baselineCapturedAt: saved.updatedAt,
      });
      onNavigate('advanced');
      advancedFeatures.setActiveFeatureTab('schema_diff');
    } catch {
      /* replay error banner remains source-of-truth for action failures */
    }
  }, [activeDescriptorKey, advancedFeatures, collections, onNavigate]);

  const openHistorySchemaDiff = useCallback(async (entry: GrpcCallHistoryEntryV1) => {
    if (!activeDescriptorKey) {
      return;
    }
    const driftIntent = collections.detectHistoryDescriptorDrift(entry, activeDescriptorKey);
    if (!driftIntent) {
      return;
    }

    const descriptorCache = new Map<string, Promise<import('../../../shared/grpc/contracts').GrpcDescriptor>>();
    const resolveDescriptor = (descriptorKey: string) => {
      const key = descriptorKey.trim();
      if (!key) {
        return Promise.reject(new Error('Descriptor key is required'));
      }
      const cached = descriptorCache.get(key);
      if (cached) {
        return cached;
      }
      const pending = postGrpcDescriptorLookup({
        requestId: `lookup-${Date.now()}-${key}`,
        descriptorKey: key,
      }).then((envelope) => envelope.data);
      descriptorCache.set(key, pending);
      return pending;
    };

    try {
      const report = await collections.buildHistoryDescriptorDriftReport(entry, activeDescriptorKey, resolveDescriptor);
      if (!report) {
        return;
      }
      const baselineDescriptor = await resolveDescriptor(driftIntent.baselineDescriptorKey);
      advancedFeatures.applySchemaDiffComparison({
        baselineDescriptor,
        report,
        baselineCapturedAt: entry.capturedAt,
      });
      onNavigate('advanced');
      advancedFeatures.setActiveFeatureTab('schema_diff');
    } catch {
      /* replay error banner remains source-of-truth for action failures */
    }
  }, [activeDescriptorKey, advancedFeatures, collections, onNavigate]);

  const grpcurlForSaved = useCallback((saved: GrpcSavedRequest) => (
    buildGrpcurlInvokeCommandFromSavedRequest(
      saved,
      resolveGrpcurlExportContextForTabRequest(studio.activeTab, saved.service, saved.method),
    )
  ), [studio.activeTab]);

  const resolveActiveExecuteMetadataForHistoryRestore = useCallback((): Record<string, string> => {
    try {
      const resolved = resolveGrpcStudioTabFieldsForExecute(studio.activeTab, {
        ...workspaceDefaults,
        ...envVarMap,
      });
      return prepareGrpcExecuteRequestMetadata(
        resolved.metadata,
        resolved.auth,
      ) ?? resolved.metadata;
    } catch {
      return studio.activeTab.metadata;
    }
  }, [studio.activeTab, workspaceDefaults, envVarMap]);

  const resolveRestoredHistoryEntryMetadata = useCallback((
    entry: GrpcCallHistoryEntryV1,
  ): Record<string, string> => {
    const activeExecuteMetadata = resolveActiveExecuteMetadataForHistoryRestore();
    const replayMetadata = (() => {
      try {
        return resolveGrpcHistoryEntryReplay({
          entry,
          tab: studio.activeTab,
          requestId: 'history-metadata-restore-preview',
          envVarMap,
          profiles: studio.profiles,
          pageDefaults,
          currentDescriptor: studio.activeTabDescriptor.descriptor,
          tabDescriptorState: studio.activeTabDescriptor,
        }).snapshot.metadata;
      } catch {
        return undefined;
      }
    })();
    const runtimeMetadata = getRuntimeGrpcHistoryMetadata(entry.id);
    const siblingRuntimeMetadata = resolveSiblingRuntimeHistoryMetadata(
      entry,
      callHistory.entries,
      getRuntimeGrpcHistoryMetadata,
    );
    return mergeHistoryMetadataForGrpcurl(
      replayMetadata,
      entry.record.snapshot.metadata,
      {
        ...(siblingRuntimeMetadata ?? {}),
        ...(runtimeMetadata ?? {}),
      },
      activeExecuteMetadata,
      {
        ...workspaceDefaults,
        ...envVarMap,
      },
    );
  }, [
    callHistory.entries,
    envVarMap,
    pageDefaults,
    resolveActiveExecuteMetadataForHistoryRestore,
    studio.activeTab,
    studio.activeTabDescriptor,
    studio.profiles,
    workspaceDefaults,
  ]);

  const replayHistoryEntryWithRestoredMetadata = useCallback((
    entry: GrpcCallHistoryEntryV1,
  ): ReturnType<typeof replayActions.replayHistoryEntry> => {
    const restoredMetadata = resolveRestoredHistoryEntryMetadata(entry);
    const tabId = studio.activeTab.id;
    const binding = replayActions.replayHistoryEntry(entry);
    if (binding) {
      studio.updateTab(tabId, { metadata: restoredMetadata });
    }
    return binding;
  }, [replayActions, resolveRestoredHistoryEntryMetadata, studio]);

  const grpcurlForHistoryEntry = useCallback((entry: GrpcCallHistoryEntryV1) => {
    const exportContext = resolveGrpcurlExportContextForTabRequest(
      studio.activeTab,
      entry.record.snapshot.service,
      entry.record.snapshot.method,
    );
    try {
      const binding = resolveGrpcHistoryEntryReplay({
        entry,
        tab: studio.activeTab,
        requestId: 'grpcurl-export-preview',
        envVarMap,
        profiles: studio.profiles,
        pageDefaults,
        currentDescriptor: studio.activeTabDescriptor.descriptor,
        tabDescriptorState: studio.activeTabDescriptor,
      });
      return buildGrpcurlInvokeCommandFromSnapshot({
        ...binding.snapshot,
        auth: sanitizeHistoryAuthForGrpcurl(binding.snapshot.auth),
        metadata: resolveRestoredHistoryEntryMetadata(entry),
      }, exportContext);
    } catch {
      return buildGrpcurlInvokeCommandFromSnapshot(entry.record.snapshot, exportContext);
    }
  }, [
    envVarMap,
    pageDefaults,
    resolveRestoredHistoryEntryMetadata,
    studio.activeTab,
    studio.activeTabDescriptor,
    studio.profiles,
  ]);

  const copyTextToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard best-effort */
    }
  }, []);

  return {
    grpcurlForSaved,
    grpcurlForHistoryEntry,
    compareSavedRequestSchemaInAdvanced,
    openHistorySchemaDiff,
    replayHistoryEntryWithRestoredMetadata,
    copyTextToClipboard,
  };
}
