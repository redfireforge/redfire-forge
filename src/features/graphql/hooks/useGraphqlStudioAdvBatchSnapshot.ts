/**
 * Snapshot/restore batch tab overrides when Advanced Settings modal opens/closes.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';

interface BatchSnapshot {
  overrides: Map<string, boolean>;
  groupKey: string | null;
}

interface Params {
  advSettingsOpen: boolean;
  batchTabOverrides: Map<string, boolean>;
  activeBatchGroupKey: string | null;
  handleAdvSettingsChange: (saved: AdvancedSettingsValues) => void;
  setAdvSettingsOpen: (open: boolean) => void;
  setBatchTabOverrides: (overrides: Map<string, boolean>) => void;
  handleSetActiveBatchGroup: (key: string) => void;
}

export function useGraphqlStudioAdvBatchSnapshot({
  advSettingsOpen,
  batchTabOverrides,
  activeBatchGroupKey,
  handleAdvSettingsChange,
  setAdvSettingsOpen,
  setBatchTabOverrides,
  handleSetActiveBatchGroup,
}: Params) {
  const snapshotRef = useRef<BatchSnapshot | null>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (advSettingsOpen && !prevOpenRef.current) {
      snapshotRef.current = {
        overrides: new Map(batchTabOverrides),
        groupKey: activeBatchGroupKey,
      };
    }
    prevOpenRef.current = advSettingsOpen;
  }, [advSettingsOpen, batchTabOverrides, activeBatchGroupKey]);

  const handleAdvSettingsSave = useCallback((saved: AdvancedSettingsValues) => {
    handleAdvSettingsChange(saved);
    snapshotRef.current = null;
    setAdvSettingsOpen(false);
  }, [handleAdvSettingsChange, setAdvSettingsOpen]);

  const handleAdvSettingsCancel = useCallback(() => {
    const snap = snapshotRef.current;
    if (snap) {
      setBatchTabOverrides(snap.overrides);
      if (snap.groupKey) handleSetActiveBatchGroup(snap.groupKey);
    }
    snapshotRef.current = null;
    setAdvSettingsOpen(false);
  }, [setBatchTabOverrides, handleSetActiveBatchGroup, setAdvSettingsOpen]);

  return { handleAdvSettingsSave, handleAdvSettingsCancel };
}
