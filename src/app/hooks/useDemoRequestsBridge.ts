import { useEffect, useRef } from 'react';
import type { RequestCollection } from '../../shared/types';

/** Minimal surface needed by the demo collection-delete bridge. */
export interface DemoRequestsBridgeApi {
  collections: RequestCollection[];
  /**
   * Must be the tab-aware remover (coordinator) so open request tabs for the
   * deleted collection are pruned — raw `useRequests().removeCollection` leaves
   * orphan tabs that render "No Request Selected".
   */
  removeCollection: (colId: string) => void;
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

    win.__demoDeleteCollectionsByName = deleteByName;

    return () => {
      delete win.__demoDeleteCollectionsByName;
    };
  }, [enabled]);
}
