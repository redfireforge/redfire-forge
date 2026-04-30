import { useMemo, useCallback, useState } from 'react';
import type { GalleryEntry, GalleryDomain } from '../../data/galleries/types';
import type { GallerySampleStatus } from './types';
import { gallerySampleHash } from '../../shared/utils/gallerySampleHash';
import { requestSampleCatalog } from '../../data/galleries/requests';
import { catalogSpecCatalog } from '../../data/galleries/catalog-specs';
import { testSampleCatalog } from '../../data/galleries/tests';
import { sampleWorkflowCatalog } from '../../data/galleries/workflows';
import { assertionPresetCatalog } from '../../data/galleries/assertion-presets';
import { GalleryGrid } from '../../shared/components/gallery';
import ConfirmModal from '../../shared/components/ConfirmModal';
import RequestPreview from './RequestPreview';
import type { Scenario } from '../../shared/types';
import '../../shared/components/gallery/gallery.css';

/** All gallery entries merged into a single list, one per domain. */
const ALL_ENTRIES: GalleryEntry<unknown>[] = [
  ...requestSampleCatalog,
  ...catalogSpecCatalog,
  ...testSampleCatalog,
  ...sampleWorkflowCatalog,
  ...assertionPresetCatalog,
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
  /** Map of gallery sample ID → hash at import time. Used to detect updates. */
  importedSamples?: Record<string, string>;
}

const ACTION_LABELS: Record<GalleryDomain, string> = {
  requests: 'Send Request',
  catalog: 'Import Spec',
  tests: 'Load Test',
  workflows: 'Load Workflow',
  assertions: 'Apply Preset',
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
  importedSamples,
}: GalleryPageProps) {
  // Compute per-entry status by comparing imported hash with current factory hash.
  const sampleStatus = useMemo<Record<string, GallerySampleStatus>>(() => {
    if (!importedSamples || Object.keys(importedSamples).length === 0) return {};
    const result: Record<string, GallerySampleStatus> = {};
    for (const entry of ALL_ENTRIES) {
      const importedHash = importedSamples[entry.id];
      if (importedHash == null) continue;
      const currentHash = gallerySampleHash(entry.factory());
      result[entry.id] = currentHash === importedHash ? 'imported' : 'updated';
    }
    return result;
  }, [importedSamples]);

  const [confirmReimport, setConfirmReimport] = useState<{ entry: GalleryEntry<unknown>; status: GallerySampleStatus } | null>(null);

  const importHandlers: Record<GalleryDomain, ((entry: GalleryEntry<unknown>) => void) | undefined> = useMemo(() => ({
    requests: onImportRequest,
    catalog: onImportCatalog,
    tests: onImportTest,
    workflows: onImportWorkflow,
    assertions: undefined,
  }), [onImportRequest, onImportCatalog, onImportTest, onImportWorkflow]);

  const handleAction = useCallback((entry: GalleryEntry<unknown>) => {
    const status = sampleStatus[entry.id];
    if (status) {
      setConfirmReimport({ entry, status });
      return;
    }
    importHandlers[entry.domain]?.(entry);
  }, [importHandlers, sampleStatus]);

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
      {confirmReimport && (
        <ConfirmModal
          title="Re-import Sample"
          message={confirmReimport.status === 'updated'
            ? `"${confirmReimport.entry.name}" has been updated since you last imported it. Re-import with the latest version?`
            : `"${confirmReimport.entry.name}" is already loaded. Import another copy?`}
          confirmLabel={confirmReimport.status === 'updated' ? 'Re-import (Updated)' : 'Import Again'}
          variant="default"
          onConfirm={() => {
            importHandlers[confirmReimport.entry.domain]?.(confirmReimport.entry);
            setConfirmReimport(null);
          }}
          onCancel={() => setConfirmReimport(null)}
        />
      )}
    </div>
  );
}
