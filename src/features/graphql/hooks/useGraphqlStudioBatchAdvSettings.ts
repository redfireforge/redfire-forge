/**
 * Advanced settings panel save/cancel with batch override snapshot restore.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import type { BatchEndpointGroup } from '../utils/batchEndpointUtils';

export interface GraphqlStudioBatchAdvSettingsInput {
  advSettingsOpen: boolean;
  advSettings: { batchEnabled: boolean };
  handleAdvSettingsChange: (saved: AdvancedSettingsValues) => void;
  setAdvSettingsOpen: (open: boolean) => void;
  batchTabOverrides: Map<string, boolean>;
  activeBatchGroupKey: string | null;
  setBatchTabOverrides: (overrides: Map<string, boolean>) => void;
  handleSetActiveBatchGroup: (key: string) => void;
  batchGroups: BatchEndpointGroup[];
  batchedTabIdsSet: Set<string>;
  handleToggleBatch: (tabId: string) => void;
  tabs: GqlStudioTab[];
  profiles: ConnectionProfile[];
  endpoint: string;
  pageDefaultEndpointResolved: string;
  activeDemoLessonId: string | null;
  activeBatchGroup: { displayLabel: string } | null;
  effectiveBatchedTabs: GqlStudioTab[];
}

export function useGraphqlStudioBatchAdvSettings({
  advSettingsOpen,
  advSettings,
  handleAdvSettingsChange,
  setAdvSettingsOpen,
  batchTabOverrides,
  activeBatchGroupKey,
  setBatchTabOverrides,
  handleSetActiveBatchGroup,
  batchGroups,
  batchedTabIdsSet,
  handleToggleBatch,
  tabs,
  profiles,
  endpoint,
  pageDefaultEndpointResolved,
  activeDemoLessonId,
  activeBatchGroup,
  effectiveBatchedTabs,
}: GraphqlStudioBatchAdvSettingsInput) {
  const advSettingsBatchSnapshotRef = useRef<{
    overrides: Map<string, boolean>;
    groupKey: string | null;
  } | null>(null);
  const prevAdvSettingsOpenRef = useRef(false);

  useEffect(() => {
    if (advSettingsOpen && !prevAdvSettingsOpenRef.current) {
      advSettingsBatchSnapshotRef.current = {
        overrides: new Map(batchTabOverrides),
        groupKey: activeBatchGroupKey,
      };
    }
    prevAdvSettingsOpenRef.current = advSettingsOpen;
  }, [advSettingsOpen, batchTabOverrides, activeBatchGroupKey]);

  const handleAdvSettingsSave = useCallback((saved: AdvancedSettingsValues) => {
    handleAdvSettingsChange(saved);
    advSettingsBatchSnapshotRef.current = null;
    setAdvSettingsOpen(false);
  }, [handleAdvSettingsChange, setAdvSettingsOpen]);

  const handleAdvSettingsCancel = useCallback(() => {
    const snap = advSettingsBatchSnapshotRef.current;
    if (snap) {
      setBatchTabOverrides(snap.overrides);
      if (snap.groupKey) handleSetActiveBatchGroup(snap.groupKey);
    }
    advSettingsBatchSnapshotRef.current = null;
    setAdvSettingsOpen(false);
  }, [setBatchTabOverrides, handleSetActiveBatchGroup, setAdvSettingsOpen]);

  const batchSummaryLabel = useMemo(() => {
    if (!advSettings.batchEnabled || !activeBatchGroup) return null;
    return `${activeBatchGroup.displayLabel} · ${effectiveBatchedTabs.length} selected`;
  }, [advSettings.batchEnabled, activeBatchGroup, effectiveBatchedTabs.length]);

  const batchSettingsProps = useMemo(
    () => ({
      groups: batchGroups,
      activeGroupKey: activeBatchGroupKey,
      onGroupChange: handleSetActiveBatchGroup,
      batchedTabIds: batchedTabIdsSet,
      onToggleBatchTab: handleToggleBatch,
      tabs,
      profiles,
      pageDefaultEndpoint: endpoint,
      pageDefaultEndpointResolved,
      demoLessonActive: Boolean(activeDemoLessonId),
    }),
    [
      batchGroups, activeBatchGroupKey, handleSetActiveBatchGroup, batchedTabIdsSet, handleToggleBatch,
      tabs, profiles, endpoint, pageDefaultEndpointResolved, activeDemoLessonId,
    ],
  );

  return {
    handleAdvSettingsSave,
    handleAdvSettingsCancel,
    batchSummaryLabel,
    batchSettingsProps,
  };
}
