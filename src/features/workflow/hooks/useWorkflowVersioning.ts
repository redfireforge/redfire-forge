import { useState, useCallback } from 'react';
import type { WorkflowVersion } from '../types/workflow';

interface UseWorkflowVersioningParams {
  selectedId: string | null;
  versions: WorkflowVersion[];
  update: (id: string, patch: Record<string, unknown>) => void;
  /** Take an undo snapshot before restoring a version. */
  takeSnapshot: (label?: string) => void;
  /** Apply restored version to the canvas (setNodes, setEdges, setVars, setServices). */
  applyToCanvas: (version: WorkflowVersion) => void;
  /** Persist the restored version data to storage. */
  persistRestore: (version: WorkflowVersion) => void;
  showToast: (type: 'success' | 'error', title: string, detail?: string) => void;
  /** Whether preview mode is active (blocks restore). */
  isPreview: boolean;
  /** Close service panel when opening versions panel. */
  closeServicePanel: () => void;
  /** Deselect node when toggling version panel. */
  deselectNode: () => void;
}

export interface WorkflowVersioningResult {
  versionPanelOpen: boolean;
  versionDiffState: { older: WorkflowVersion; newer: WorkflowVersion } | null;
  versionCount: number;
  handleVersionRestore: (version: WorkflowVersion) => void;
  handleVersionDelete: (versionId: string) => void;
  handleVersionRename: (versionId: string, label: string) => void;
  handleVersionCompare: (older: WorkflowVersion, newer: WorkflowVersion) => void;
  openVersionPanel: () => void;
  closeVersionPanel: () => void;
  closeVersionDiff: () => void;
}

export function useWorkflowVersioning({
  selectedId,
  versions,
  update,
  takeSnapshot,
  applyToCanvas,
  persistRestore,
  showToast,
  isPreview,
  closeServicePanel,
  deselectNode,
}: UseWorkflowVersioningParams): WorkflowVersioningResult {
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [versionDiffState, setVersionDiffState] = useState<{ older: WorkflowVersion; newer: WorkflowVersion } | null>(null);

  const handleVersionRestore = useCallback((version: WorkflowVersion) => {
    if (!selectedId || isPreview) return;
    takeSnapshot('Restore version');
    applyToCanvas(version);
    persistRestore(version);
    showToast('success', 'Version restored', version.label || new Date(version.timestamp).toLocaleString());
  }, [selectedId, isPreview, takeSnapshot, applyToCanvas, persistRestore, showToast]);

  const handleVersionDelete = useCallback((versionId: string) => {
    if (!selectedId) return;
    const updated = versions.filter((v) => v.id !== versionId);
    update(selectedId, { versions: updated });
  }, [selectedId, versions, update]);

  const handleVersionRename = useCallback((versionId: string, label: string) => {
    if (!selectedId) return;
    const updated = versions.map((v) => v.id === versionId ? { ...v, label } : v);
    update(selectedId, { versions: updated });
  }, [selectedId, versions, update]);

  const handleVersionCompare = useCallback((older: WorkflowVersion, newer: WorkflowVersion) => {
    setVersionDiffState({ older, newer });
  }, []);

  const openVersionPanel = useCallback(() => {
    setVersionPanelOpen((v) => !v);
    closeServicePanel();
    deselectNode();
  }, [closeServicePanel, deselectNode]);

  const closeVersionPanel = useCallback(() => {
    setVersionPanelOpen(false);
  }, []);

  const closeVersionDiff = useCallback(() => {
    setVersionDiffState(null);
  }, []);

  return {
    versionPanelOpen,
    versionDiffState,
    versionCount: versions.length,
    handleVersionRestore,
    handleVersionDelete,
    handleVersionRename,
    handleVersionCompare,
    openVersionPanel,
    closeVersionPanel,
    closeVersionDiff,
  };
}
