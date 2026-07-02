/**
 * Phase 5H — open saved requests / history / grpcurl import in the active tab.
 */
import { useCallback, useState } from 'react';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import type { UseGrpcStudioReturn } from './useGrpcStudio';
import type { GrpcTabConnectionPageDefaults, GrpcConnectionProfile } from '../utils/resolveGrpcTabConnection';
import {
  createReplaySavedRequestFromHistoryEntry,
  resolveGrpcHistoryEntryReplay,
  resolveGrpcReplayBinding,
} from '../utils/grpcReplayBinding';
import type { GrpcGrpcurlImportSuccess } from '../utils/grpcGrpcurlTypes';
import {
  analyzeGrpcurlImportSchemaDrift,
  buildDriftDescriptorPatchFromAnalysis,
  grpcurlImportDescriptorStatePatch,
  grpcurlImportToTabStatePatch,
  savedRequestToTabPatch,
} from '../utils/grpcReplayTabApply';

export type GrpcStudioPanelView = 'studio' | 'collections' | 'history' | 'advanced';

export interface UseGrpcStudioReplayActionsOptions {
  studio: UseGrpcStudioReturn;
  envVarMap: Record<string, string>;
  profiles: GrpcConnectionProfile[];
  pageDefaults: GrpcTabConnectionPageDefaults;
  onNavigate: (view: GrpcStudioPanelView) => void;
}

function replayActionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Replay failed';
}

export function useGrpcStudioReplayActions(options: UseGrpcStudioReplayActionsOptions) {
  const { studio, envVarMap, profiles, pageDefaults, onNavigate } = options;
  const [lastActionError, setLastActionError] = useState<string | undefined>();

  const clearLastActionError = useCallback(() => {
    setLastActionError(undefined);
  }, []);

  const abortActiveTabCallsBeforePatch = useCallback((tabId: string) => {
    studio.abortTabInFlightCalls(tabId);
  }, [studio]);

  const applyBindingToActiveTab = useCallback((
    saved: GrpcSavedRequest,
    bodyOverride?: Record<string, unknown>,
    navigateTo: GrpcStudioPanelView = 'studio',
  ) => {
    const tab = studio.activeTab;
    abortActiveTabCallsBeforePatch(tab.id);
    const descriptorState = studio.activeTabDescriptor;
    const binding = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: globalThis.crypto?.randomUUID?.() ?? `replay-${Date.now()}`,
      envVarMap,
      profiles,
      pageDefaults,
      currentDescriptor: descriptorState.descriptor,
      tabDescriptorState: descriptorState,
    });

    studio.updateTab(tab.id, savedRequestToTabPatch(tab, saved, bodyOverride ?? binding.body));
    studio.patchTabDescriptor(tab.id, buildDriftDescriptorPatchFromAnalysis(
      binding.drift,
      descriptorState.descriptor,
      saved.service,
      saved.method,
    ));
    onNavigate(navigateTo);
    return binding;
  }, [studio, envVarMap, profiles, pageDefaults, onNavigate, abortActiveTabCallsBeforePatch]);

  const openSavedRequestInStudio = useCallback((saved: GrpcSavedRequest): boolean => {
    try {
      setLastActionError(undefined);
      applyBindingToActiveTab(saved);
      return true;
    } catch (error) {
      setLastActionError(replayActionErrorMessage(error));
      return false;
    }
  }, [applyBindingToActiveTab]);

  const openSavedRequestForLoadTest = useCallback((saved: GrpcSavedRequest): boolean => {
    try {
      setLastActionError(undefined);
      applyBindingToActiveTab(saved, undefined, 'advanced');
      return true;
    } catch (error) {
      setLastActionError(replayActionErrorMessage(error));
      return false;
    }
  }, [applyBindingToActiveTab]);

  const replayHistoryEntry = useCallback((entry: GrpcCallHistoryEntryV1) => {
    try {
      setLastActionError(undefined);
      const tab = studio.activeTab;
      abortActiveTabCallsBeforePatch(tab.id);
      const descriptorState = studio.activeTabDescriptor;
      const saved = createReplaySavedRequestFromHistoryEntry(entry);
      const binding = resolveGrpcHistoryEntryReplay({
        entry,
        tab,
        requestId: globalThis.crypto?.randomUUID?.() ?? `history-replay-${Date.now()}`,
        envVarMap,
        profiles,
        pageDefaults,
        currentDescriptor: descriptorState.descriptor,
        tabDescriptorState: descriptorState,
      });

      studio.updateTab(tab.id, savedRequestToTabPatch(tab, saved, binding.body));
      studio.patchTabDescriptor(tab.id, buildDriftDescriptorPatchFromAnalysis(
        binding.drift,
        descriptorState.descriptor,
        saved.service,
        saved.method,
      ));
      onNavigate('studio');
      return binding;
    } catch (error) {
      setLastActionError(replayActionErrorMessage(error));
      return undefined;
    }
  }, [studio, envVarMap, profiles, pageDefaults, onNavigate, abortActiveTabCallsBeforePatch]);

  const applyGrpcurlImport = useCallback((importResult: GrpcGrpcurlImportSuccess) => {
    try {
      setLastActionError(undefined);
      const tab = studio.activeTab;
      abortActiveTabCallsBeforePatch(tab.id);
      const descriptorState = studio.activeTabDescriptor;
      const importDrift = analyzeGrpcurlImportSchemaDrift(tab, descriptorState, importResult);
      studio.updateTab(tab.id, grpcurlImportToTabStatePatch(tab, importResult));
      const descriptorPatch = grpcurlImportDescriptorStatePatch(descriptorState, importResult);
      studio.patchTabDescriptor(tab.id, {
        ...buildDriftDescriptorPatchFromAnalysis(
          importDrift,
          descriptorState.descriptor,
          importResult.serviceFullName,
          importResult.methodName,
        ),
        ...descriptorPatch,
      });
      onNavigate('studio');
    } catch (error) {
      setLastActionError(replayActionErrorMessage(error));
    }
  }, [studio, onNavigate, abortActiveTabCallsBeforePatch]);

  return {
    openSavedRequestInStudio,
    openSavedRequestForLoadTest,
    replayHistoryEntry,
    applyGrpcurlImport,
    applyBindingToActiveTab,
    lastActionError,
    clearLastActionError,
  };
}
