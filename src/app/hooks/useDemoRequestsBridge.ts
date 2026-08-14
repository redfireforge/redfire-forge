import { useEffect, useRef } from 'react';
import type { RequestCollection, RequestItem } from '../../shared/types';

/** Minimal surface needed by the demo collection-delete bridge. */
export interface DemoRequestsBridgeApi {
  collections: RequestCollection[];
  /**
   * Must be the tab-aware remover (coordinator) so open request tabs for the
   * deleted collection are pruned — raw `useRequests().removeCollection` leaves
   * orphan tabs that render "No Request Selected".
   */
  removeCollection: (colId: string) => void;
  /** Append a fully-formed collection (used to quietly seed import-lesson Requests). */
  importCollection: (col: RequestCollection) => void;
}

/**
 * Demo-player bridge for Requests collections. Mounts imperative
 * `window.__demoDeleteCollectionsByName` so demo lessons (especially CAT-*
 * export lessons) can remove orphaned request collections during cleanup
 * without fragile DOM context-menu manipulation.
 *
 * Mirrors the catalog/harness bridge pattern.
 */
export function useDemoRequestsBridge(requests: DemoRequestsBridgeApi, enabled: boolean): void {
  const ref = useRef(requests);
  ref.current = requests;

  useEffect(() => {
    if (!enabled) return;
    const win = window as unknown as Record<string, unknown>;

    /**
     * Delete all request collections whose name matches exactly (case-insensitive).
     * Returns the number of collections deleted.
     */
    const deleteByName = (name: string): number => {
      const lower = name.toLowerCase();
      const matches = ref.current.collections.filter(
        c => c.name.toLowerCase() === lower,
      );
      for (const c of matches) {
        ref.current.removeCollection(c.id);
      }
      return matches.length;
    };

    const seedCollection = (
      name: string,
      requests: Array<{ id?: string; name: string; method: string; url: string; body?: string }>,
    ): string | null => {
      const existing = ref.current.collections.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
      const id = `am-demo-col-${crypto.randomUUID().slice(0, 8)}`;
      const items: RequestItem[] = requests.map((r, i) => ({
        id: r.id ?? `am-demo-req-${i}-${crypto.randomUUID().slice(0, 6)}`,
        name: r.name,
        method: (r.method.toUpperCase() as RequestItem['method']),
        url: r.url,
        headers: [],
        body: r.body ?? '',
        auth: { type: 'none' },
      }));
      ref.current.importCollection({
        id,
        name,
        mode: 'direct',
        requests: items,
        folders: [],
      });
      return id;
    };

    win.__demoDeleteCollectionsByName = deleteByName;
    win.__demoSeedRequestCollection = seedCollection;

    return () => {
      delete win.__demoDeleteCollectionsByName;
      delete win.__demoSeedRequestCollection;
    };
  }, [enabled]);
}
