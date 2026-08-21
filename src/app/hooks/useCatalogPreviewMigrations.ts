import { useEffect } from 'react';
import { loadWorkflowPreviews, getPreviewEntriesForPalette } from '../../shared/utils/workflowPreviewStorage';
import type { WorkflowPreviewEntry } from '../../shared/utils/workflowPreviewStorage';
import { migratePreviewsToLocalStorage, migratePublishedToWorkflowPublication } from '../../shared/utils/workflowPreviewMigration';
import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';

type CatalogBridge = Pick<UseCatalogReturn, 'loaded' | 'entries' | 'updateEntry'>;

/**
 * Runs one-time preview/published migrations and refreshes workflow preview entries.
 */
export function useCatalogPreviewMigrations(
  catalog: CatalogBridge,
  setWfPreviewEndpoints: (entries: WorkflowPreviewEntry[]) => void,
): void {
  useEffect(() => {
    if (!catalog.loaded) return;
    let cancelled = false;

    void migratePreviewsToLocalStorage(catalog.entries, catalog.updateEntry)
      .then(() => migratePublishedToWorkflowPublication(catalog.entries, catalog.updateEntry))
      .then(() => loadWorkflowPreviews())
      .then(map => {
        if (!cancelled) setWfPreviewEndpoints(getPreviewEntriesForPalette(map));
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.loaded]);
}
