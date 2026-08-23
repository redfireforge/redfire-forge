import { useEffect, useRef } from 'react';
import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import { parseOpenApiSpec } from '../../features/catalog/utils/openApiParser';
import { clearAllPreviews } from '@shared/utils/workflowPreviewStorage';

/**
 * Demo-player bridge for the API Catalog. Mounts imperative `window.__demo*`
 * functions so the Catalog convert lesson (CAT / P4-E) can seed a Swagger 2.0
 * entry, select it, and clean it up without driving the multi-step Import modal.
 *
 * Mirrors the workflow/gql/harness bridge pattern (App shell hook → `window`
 * function → typed adapter surface consumed by lessons). Only mounted when the
 * Demo Hub build flag is on; a no-op otherwise.
 */
export function useDemoCatalogBridge(catalog: UseCatalogReturn, enabled: boolean): void {
  // Keep the latest catalog state/actions reachable from the imperative bridge
  // functions without re-mounting them on every entry change.
  const ref = useRef(catalog);
  ref.current = catalog;

  useEffect(() => {
    if (!enabled) return;
    const win = window as unknown as Record<string, unknown>;

    /** Seed a Swagger 2.0 spec as a Catalog entry (idempotent by display name). */
    const seedSwagger2 = async (name: string, rawSpec: string): Promise<string | null> => {
      const existing = ref.current.entries.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        ref.current.selectEntry(existing.id);
        return existing.id;
      }
      try {
        const parsed = await parseOpenApiSpec(rawSpec);
        const entry = { ...parsed.entry, name };
        await ref.current.addEntry(entry, parsed.rawSpec);
        return entry.id;
      } catch {
        return null;
      }
    };

    const deleteByName = (name: string): void => {
      const target = ref.current.entries.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (target) void ref.current.removeEntry(target.id);
    };

    const selectByName = (name: string): boolean => {
      const target = ref.current.entries.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!target) return false;
      ref.current.selectEntry(target.id);
      return true;
    };

    /** Add a new version to an existing entry (by display name). */
    const addVersionByName = async (name: string, rawSpec: string): Promise<boolean> => {
      const target = ref.current.entries.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!target) return false;
      try {
        const parsed = await parseOpenApiSpec(rawSpec);
        await ref.current.addVersionToEntry(target.id, parsed);
        ref.current.selectEntry(target.id);
        return true;
      } catch {
        return false;
      }
    };

    const getEntryByName = (name: string) => {
      const target = ref.current.entries.find(e => e.name.toLowerCase() === name.toLowerCase());
      return target ?? null;
    };

    /**
     * Publish an endpoint for Workflow Designer without opening Catalog UI.
     * Matches ApiCatalog.applyPublicationToEntry shape.
     */
    const publishEndpoint = (entryName: string, method: string, path: string): boolean => {
      const entry = ref.current.entries.find(e => e.name.toLowerCase() === entryName.toLowerCase());
      if (!entry) return false;
      const methodUpper = method.toUpperCase();
      let found = false;
      type Ep = (typeof entry.endpoints)[number];
      type Folder = (typeof entry.folders)[number];
      const patchEp = (ep: Ep): Ep => {
        if (ep.method.toUpperCase() === methodUpper && ep.path === path) {
          found = true;
          if (ep.workflowPublication) return ep;
          return {
            ...ep,
            workflowPublication: {
              publishedAt: Date.now(),
              publishedFromVersionId: entry.currentVersionId || '',
            },
            exposedToWorkflow: undefined,
            workflowExposure: undefined,
            workflowValues: undefined,
          };
        }
        return ep;
      };
      const patchFolders = (folders: Folder[]): Folder[] =>
        folders.map(f => ({
          ...f,
          endpoints: f.endpoints.map(patchEp),
          folders: patchFolders(f.folders ?? []),
        }));
      const nextEndpoints = entry.endpoints.map(patchEp);
      const nextFolders = patchFolders(entry.folders ?? []);
      if (!found) return false;
      ref.current.updateEntry(entry.id, { endpoints: nextEndpoints, folders: nextFolders });
      return true;
    };

    win.__demoSeedCatalogSwagger2 = seedSwagger2;
    win.__demoDeleteCatalogByName = deleteByName;
    win.__demoSelectCatalogByName = selectByName;
    win.__demoAddVersionByName = addVersionByName;
    win.__demoClearAllWorkflowPreviews = clearAllPreviews;
    win.__demoGetCatalogEntryByName = getEntryByName;
    win.__demoPublishCatalogEndpoint = publishEndpoint;

    return () => {
      delete win.__demoSeedCatalogSwagger2;
      delete win.__demoDeleteCatalogByName;
      delete win.__demoSelectCatalogByName;
      delete win.__demoAddVersionByName;
      delete win.__demoClearAllWorkflowPreviews;
      delete win.__demoGetCatalogEntryByName;
      delete win.__demoPublishCatalogEndpoint;
    };
  }, [enabled]);

  // Publish a readiness flag so lessons can wait for the catalog to hydrate.
  useEffect(() => {
    if (!enabled) return;
    (window as unknown as Record<string, unknown>).__demoCatalogLoaded = catalog.loaded;
    return () => { delete (window as unknown as Record<string, unknown>).__demoCatalogLoaded; };
  }, [enabled, catalog.loaded]);
}
