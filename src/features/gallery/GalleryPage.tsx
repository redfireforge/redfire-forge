import { useMemo, useCallback, useState } from 'react';
import type { GalleryEntry, GalleryDomain } from '../../data/galleries/types';
import type { GallerySampleStatus } from './types';
import { gallerySampleHash } from '../../shared/utils/gallerySampleHash';
import { requestSampleCatalog } from '../../data/galleries/requests';
import { catalogSpecCatalog } from '../../data/galleries/catalog-specs';
import { testSampleCatalog } from '../../data/galleries/tests';
import { sampleWorkflowCatalog } from '../../data/galleries/workflows';
import { assertionPresetCatalog } from '../../data/galleries/assertion-presets';
import { dataMapperSampleCatalog } from '../../data/galleries/data-mapper';
import { GalleryGrid } from '../../shared/components/gallery';
import ConfirmModal from '../../shared/components/ConfirmModal';
import RequestPreview from './RequestPreview';
import type { Scenario } from '../../shared/types';
import '../../shared/components/gallery/gallery.css';

/**
 * Sentinel value in importedSamples that means "loaded, skip version check".
 * Used for entries where the factory is non-deterministic (e.g. contains Date.now()).
 */
export const LOADED_SENTINEL = '__loaded__';

/** All gallery entries merged into a single list, one per domain. */
const ALL_ENTRIES: GalleryEntry<unknown>[] = [
  ...requestSampleCatalog,
  ...catalogSpecCatalog,
  ...testSampleCatalog,
  ...sampleWorkflowCatalog,
  ...assertionPresetCatalog,
  ...dataMapperSampleCatalog,
];

export interface GalleryPageProps {
  /** Called when the user imports a request sample. */
  onImportRequest?: (entry: GalleryEntry<unknown>) => void;
  /** Called when the user wants to try a request sample (preview without importing). */
  onTryItRequest?: (entry: GalleryEntry<unknown>) => void;
  /** Called when the user imports a catalog spec. */
  onImportCatalog?: (entry: GalleryEntry<unknown>) => void;
  /** Called when the user imports a test sample. */
  onImportTest?: (entry: GalleryEntry<unknown>) => void;
  /** Called when the user selects a workflow template. */
  onImportWorkflow?: (entry: GalleryEntry<unknown>) => void;
  /**
   * Called when the user clicks an already-imported sample (status = 'imported').
   * Should navigate to wherever the sample was loaded (e.g. scenarios tab).
   */
  onNavigateTo?: (entry: GalleryEntry<unknown>) => void;
  /** Map of gallery sample ID → hash at import time. Used to detect updates. */
  importedSamples?: Record<string, string>;
}

const ACTION_LABELS: Record<GalleryDomain, string> = {
  requests: 'Send Request',
  catalog: 'Import Spec',
  tests: 'Load Test',
  workflows: 'Load Workflow',
  assertions: 'Apply Preset',
  'data-mapper': 'Load Sample',
};

const SECONDARY_LABELS: Partial<Record<GalleryDomain, string>> = {
  requests: 'Try It',
};

/**
 * Unified Gallery Page — top-level domain that surfaces all gallery entries
 * (requests, catalog, tests, workflows, assertions) in a single browsable grid.
 */
export function GalleryPage({
  onImportRequest,
  onTryItRequest,
  onImportCatalog,
  onImportTest,
  onImportWorkflow,
  onNavigateTo,
  importedSamples,
}: GalleryPageProps) {
  // Compute per-entry status by comparing imported hash with current factory hash.
  const sampleStatus = useMemo<Record<string, GallerySampleStatus>>(() => {
    if (!importedSamples || Object.keys(importedSamples).length === 0) return {};
    const result: Record<string, GallerySampleStatus> = {};
    for (const entry of ALL_ENTRIES) {
      const importedHash = importedSamples[entry.id];
      if (importedHash === LOADED_SENTINEL) {
        result[entry.id] = 'imported';
      } else if (importedHash != null) {
        const currentHash = gallerySampleHash(entry.factory());
        result[entry.id] = currentHash === importedHash ? 'imported' : 'updated';
      } else if (importedSamples[`__name:${entry.name}`] != null) {
        // Fallback: matched by name (older imports without gallerySampleId)
        result[entry.id] = 'imported';
      }
    }
    return result;
  }, [importedSamples]);

  const [confirmUpdate, setConfirmUpdate] = useState<GalleryEntry<unknown> | null>(null);

  const importHandlers: Record<GalleryDomain, ((entry: GalleryEntry<unknown>) => void) | undefined> = useMemo(() => ({
    requests: onImportRequest,
    catalog: onImportCatalog,
    tests: onImportTest,
    workflows: onImportWorkflow,
    assertions: undefined,
    'data-mapper': onImportTest,
  }), [onImportRequest, onImportCatalog, onImportTest, onImportWorkflow]);

  const handleAction = useCallback((entry: GalleryEntry<unknown>) => {
    const status = sampleStatus[entry.id];
    if (status === 'imported') {
      // Already loaded, same version — navigate to it, no modal
      onNavigateTo?.(entry);
      return;
    }
    if (status === 'updated') {
      // New version available — ask before replacing
      setConfirmUpdate(entry);
      return;
    }
    importHandlers[entry.domain]?.(entry);
  }, [importHandlers, sampleStatus, onNavigateTo]);

  const handleSecondary = useCallback((entry: GalleryEntry<unknown>) => {
    if (entry.domain === 'requests') {
      onTryItRequest?.(entry);
    }
  }, [onTryItRequest]);

  const renderPreview = useCallback((entry: GalleryEntry<unknown>, onExpand?: (label: string, content: string) => void) => {
    if (entry.domain === 'requests') {
      const scenario = entry.factory() as Scenario;
      return (
        <RequestPreview
          key={entry.id}
          scenario={scenario}
          onExpand={onExpand ? (tab, content) => onExpand(tab === 'request' ? 'Request' : 'Response', content) : undefined}
        />
      );
    }
    const item = entry.factory();
    try {
      const text = typeof item === 'string' ? item : JSON.stringify(item, null, 2);
      return text.slice(0, 800);
    } catch {
      return String(item).slice(0, 800);
    }
  }, []);

  return (
    <div className="gallery-page">
      <GalleryGrid
        entries={ALL_ENTRIES}
        actionLabel={(e) => {
          if (!importHandlers[e.domain]) return undefined;
          const status = sampleStatus?.[e.id];
          if (status === 'imported') return '✓ Loaded';
          if (status === 'updated') return '↻ Reload (Updated)';
          return ACTION_LABELS[e.domain];
        }}
        secondaryLabel={(e) => SECONDARY_LABELS[e.domain]}
        onAction={handleAction}
        onSecondary={handleSecondary}
        renderPreview={renderPreview}
        sampleStatus={sampleStatus}
      />
      {confirmUpdate && (
        <ConfirmModal
          title="Update Available"
          message={`"${confirmUpdate.name}" has been updated since you last imported it. Re-import with the latest version?`}
          confirmLabel="Update"
          cancelLabel="Cancel"
          variant="default"
          onConfirm={() => {
            importHandlers[confirmUpdate.domain]?.(confirmUpdate);
            setConfirmUpdate(null);
          }}
          onCancel={() => setConfirmUpdate(null)}
        />
      )}
    </div>
  );
}
