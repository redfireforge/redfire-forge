import { useCallback, useEffect, useState } from 'react';
import type { GrpcLoadTestConfig } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import {
  deleteGrpcLoadTestProfile,
  listGrpcLoadTestProfiles,
  renameGrpcLoadTestProfile,
  saveGrpcLoadTestProfile,
  type GrpcLoadTestProfile,
} from '../data/grpcLoadTestProfileRepository';
import {
  isGrpcAdvancedOperationInFlight,
  resetAdvancedOpToIdle,
} from '../utils/grpcStudioAdvancedCommands';
import type { GrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';

export function useGrpcLoadTestProfilesState(
  activeTabId: string,
  activeLoadTestConfig: GrpcLoadTestConfig,
  patchTabState: (
    tabId: string,
    patch: Partial<GrpcTabAdvancedFeaturesUiState> | ((prev: GrpcTabAdvancedFeaturesUiState) => GrpcTabAdvancedFeaturesUiState),
  ) => void,
  enabled = true,
) {
  const [loadTestProfiles, setLoadTestProfiles] = useState<GrpcLoadTestProfile[]>([]);
  const [loadTestProfilesLoading, setLoadTestProfilesLoading] = useState(enabled);
  const [loadTestProfileError, setLoadTestProfileError] = useState<string | undefined>();
  const [selectedLoadTestProfileId, setSelectedLoadTestProfileId] = useState<string>('');

  const refreshLoadTestProfiles = useCallback(async () => {
    if (!enabled) {
      setLoadTestProfilesLoading(false);
      return;
    }
    setLoadTestProfilesLoading(true);
    try {
      const profiles = await listGrpcLoadTestProfiles();
      setLoadTestProfiles(profiles);
      setSelectedLoadTestProfileId((prev) => (
        prev && profiles.some((profile) => profile.id === prev) ? prev : ''
      ));
      setLoadTestProfileError(undefined);
    } catch (error) {
      setLoadTestProfileError(error instanceof Error ? error.message : 'Failed to load profiles');
    } finally {
      setLoadTestProfilesLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoadTestProfilesLoading(false);
      return;
    }
    void refreshLoadTestProfiles();
  }, [enabled, refreshLoadTestProfiles]);

  const saveLoadTestProfile = useCallback(async (name: string) => {
    setLoadTestProfileError(undefined);
    try {
      const trimmedName = name.trim();
      const selected = loadTestProfiles.find((entry) => entry.id === selectedLoadTestProfileId);
      const updateExisting = selected != null
        && selected.name.localeCompare(trimmedName, undefined, { sensitivity: 'base' }) === 0;
      const profile = await saveGrpcLoadTestProfile({
        id: updateExisting ? selectedLoadTestProfileId : undefined,
        name: trimmedName,
        config: activeLoadTestConfig,
      });
      setSelectedLoadTestProfileId(profile.id);
      await refreshLoadTestProfiles();
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      setLoadTestProfileError(message);
      throw error;
    }
  }, [
    activeLoadTestConfig,
    loadTestProfiles,
    refreshLoadTestProfiles,
    selectedLoadTestProfileId,
  ]);

  const loadLoadTestProfile = useCallback((profileId: string) => {
    const profile = loadTestProfiles.find((entry) => entry.id === profileId);
    if (!profile) return;
    setSelectedLoadTestProfileId(profile.id);
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      loadTest: {
        ...prev.loadTest,
        config: structuredClone(profile.config),
        lastSummary: undefined,
        lastExportSource: undefined,
        live: undefined,
      },
      runtime: isGrpcAdvancedOperationInFlight(prev.runtime.loadTest.status)
        ? prev.runtime
        : {
          ...prev.runtime,
          loadTest: resetAdvancedOpToIdle(prev.runtime.loadTest),
        },
    }));
    setLoadTestProfileError(undefined);
  }, [activeTabId, loadTestProfiles, patchTabState]);

  const renameLoadTestProfile = useCallback(async (profileId: string, name: string) => {
    setLoadTestProfileError(undefined);
    try {
      const profile = await renameGrpcLoadTestProfile(profileId, name);
      if (selectedLoadTestProfileId === profileId) {
        setSelectedLoadTestProfileId(profile.id);
      }
      await refreshLoadTestProfiles();
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename profile';
      setLoadTestProfileError(message);
      throw error;
    }
  }, [refreshLoadTestProfiles, selectedLoadTestProfileId]);

  const removeLoadTestProfile = useCallback(async (profileId: string) => {
    setLoadTestProfileError(undefined);
    try {
      await deleteGrpcLoadTestProfile(profileId);
      if (selectedLoadTestProfileId === profileId) {
        setSelectedLoadTestProfileId('');
      }
      await refreshLoadTestProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete profile';
      setLoadTestProfileError(message);
      throw error;
    }
  }, [refreshLoadTestProfiles, selectedLoadTestProfileId]);

  return {
    loadTestProfiles,
    loadTestProfilesLoading,
    loadTestProfileError,
    selectedLoadTestProfileId,
    setSelectedLoadTestProfileId,
    saveLoadTestProfile,
    loadLoadTestProfile,
    renameLoadTestProfile,
    removeLoadTestProfile,
  };
}
