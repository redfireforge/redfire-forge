import { useEffect } from 'react';

/**
 * Exposes `window.__demoUpsertWorkspaceDefaults(patch)` and
 * `window.__demoRemoveWorkspaceDefaults(keys)` for lesson runtime.
 * Applies key/value patches (or key removals) into React workspace defaults state.
 */
export function useDemoWorkspaceDefaultsBridge(
  setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>>,
): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__demoUpsertWorkspaceDefaults = (
      patch: Record<string, string>,
    ) => {
      setWorkspaceDefaults((prev) => ({ ...prev, ...patch }));
    };
    (window as unknown as Record<string, unknown>).__demoRemoveWorkspaceDefaults = (
      keys: string[],
    ) => {
      setWorkspaceDefaults((prev) => {
        const next = { ...prev };
        for (const key of keys) delete next[key];
        return next;
      });
    };

    return () => {
      delete (window as unknown as Record<string, unknown>).__demoUpsertWorkspaceDefaults;
      delete (window as unknown as Record<string, unknown>).__demoRemoveWorkspaceDefaults;
    };
  }, [setWorkspaceDefaults]);
}
