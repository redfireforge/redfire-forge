import type { CatalogEntry, CatalogEndpoint, CatalogFolder, WorkflowPublication } from '../../features/catalog/types/catalog';
import { loadWorkflowPreviews, saveWorkflowPreviews } from './workflowPreviewStorage';
import type { WorkflowPreviewEntry, PreviewMap } from './workflowPreviewStorage';
import { readKey, writeKey } from './storage';

const MIGRATION_KEY = 'perf-test-v3-wf-preview-migration-v1';
const P2_MIGRATION_KEY = 'perf-test-v3-wf-publication-migration-v2';

/**
 * Migrate preview entries from CatalogEndpoint.workflowExposure/'preview' and
 * legacy exposedToWorkflow to user-local workflowPreviewStorage.
 *
 * Returns the number of endpoints migrated. Idempotent — runs at most once.
 */
export async function migratePreviewsToLocalStorage(
  entries: CatalogEntry[],
  updateEntry: (id: string, patch: Partial<CatalogEntry>) => void,
): Promise<number> {
  const done = await readKey(MIGRATION_KEY);
  if (done === 'true') return 0;

  const previews = await loadWorkflowPreviews();
  let migrated = 0;

  for (const entry of entries) {
    const { patchedEndpoints, patchedFolders, migratedPreviews } = collectAndPatchEntry(entry, previews);

    if (migratedPreviews > 0) {
      updateEntry(entry.id, {
        endpoints: patchedEndpoints,
        folders: patchedFolders,
      });
      migrated += migratedPreviews;
    }
  }

  if (migrated > 0) {
    await saveWorkflowPreviews(previews);
  }

  await writeKey(MIGRATION_KEY, 'true');
  return migrated;
}

function collectAndPatchEntry(
  entry: CatalogEntry,
  previews: PreviewMap,
): { patchedEndpoints: CatalogEndpoint[]; patchedFolders: CatalogFolder[]; migratedPreviews: number } {
  let migratedPreviews = 0;

  const patchEndpoint = (ep: CatalogEndpoint): CatalogEndpoint => {
    const isPreview = ep.workflowExposure === 'preview';
    const isLegacy = !ep.workflowExposure && ep.exposedToWorkflow === true;

    if (!isPreview && !isLegacy) return ep;

    const key = `${entry.id}::${ep.id}`;
    if (!(key in previews)) {
      const preview: WorkflowPreviewEntry = {
        entryId: entry.id,
        endpointId: ep.id,
        method: ep.method,
        path: ep.path,
        summary: ep.summary || ep.path,
        entryName: entry.name,
        addedAt: Date.now(),
        values: ep.workflowValues
          ? {
              paramValues: ep.workflowValues.paramValues,
              headerValues: ep.workflowValues.headerValues,
              body: ep.workflowValues.body,
            }
          : undefined,
      };
      previews[key] = preview;
    }
    migratedPreviews++;

    return {
      ...ep,
      workflowExposure: undefined,
      exposedToWorkflow: undefined,
      workflowValues: undefined,
    };
  };

  const patchFolder = (folder: CatalogFolder): CatalogFolder => ({
    ...folder,
    endpoints: folder.endpoints.map(patchEndpoint),
    folders: folder.folders.map(patchFolder),
  });

  return {
    patchedEndpoints: entry.endpoints.map(patchEndpoint),
    patchedFolders: entry.folders.map(patchFolder),
    migratedPreviews,
  };
}

export async function resetPreviewMigration(): Promise<void> {
  await writeKey(MIGRATION_KEY, '');
}

/**
 * Migrate P2: convert `workflowExposure: 'published'` + `workflowValues` on
 * CatalogEndpoint to the richer `workflowPublication` metadata structure.
 *
 * Idempotent — runs at most once (tracked by separate migration key).
 */
export async function migratePublishedToWorkflowPublication(
  entries: CatalogEntry[],
  updateEntry: (id: string, patch: Partial<CatalogEntry>) => void,
): Promise<number> {
  const done = await readKey(P2_MIGRATION_KEY);
  if (done === 'true') return 0;

  let migrated = 0;

  for (const entry of entries) {
    const { patchedEndpoints, patchedFolders, count } = migrateEntryPublished(entry);
    if (count > 0) {
      updateEntry(entry.id, {
        endpoints: patchedEndpoints,
        folders: patchedFolders,
      });
      migrated += count;
    }
  }

  await writeKey(P2_MIGRATION_KEY, 'true');
  return migrated;
}

function migrateEntryPublished(
  entry: CatalogEntry,
): { patchedEndpoints: CatalogEndpoint[]; patchedFolders: CatalogFolder[]; count: number } {
  let count = 0;

  const patchEndpoint = (ep: CatalogEndpoint): CatalogEndpoint => {
    if (ep.workflowPublication) return ep;
    if (ep.workflowExposure !== 'published') return ep;

    const publication: WorkflowPublication = {
      publishedAt: Date.now(),
      publishedFromVersionId: entry.currentVersionId,
      values: ep.workflowValues
        ? {
            paramValues: ep.workflowValues.paramValues,
            headerValues: ep.workflowValues.headerValues,
            body: ep.workflowValues.body,
          }
        : undefined,
    };

    count++;
    return {
      ...ep,
      workflowPublication: publication,
      workflowExposure: undefined,
      workflowValues: undefined,
    };
  };

  const patchFolder = (folder: CatalogFolder): CatalogFolder => ({
    ...folder,
    endpoints: folder.endpoints.map(patchEndpoint),
    folders: folder.folders.map(patchFolder),
  });

  return {
    patchedEndpoints: entry.endpoints.map(patchEndpoint),
    patchedFolders: entry.folders.map(patchFolder),
    count,
  };
}

export async function resetPublicationMigration(): Promise<void> {
  await writeKey(P2_MIGRATION_KEY, '');
}
