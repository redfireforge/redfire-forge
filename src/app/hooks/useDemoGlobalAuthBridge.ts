import { useEffect } from 'react';
import type { GlobalAuthProfile } from '../../shared/types';
import { saveGlobalAuthProfiles } from '../../shared/utils/storage';

/**
 * Exposes demo-player bridge helpers on `window`:
 *   - `__demoUpsertGlobalAuthProfile(profile)` — upsert a global auth profile into React state + storage
 *   - `__demoPurgeGlobalAuthProfiles(names, ids)` — remove demo-seeded profiles from React state + storage
 */
export function useDemoGlobalAuthBridge(
  setProfiles: React.Dispatch<React.SetStateAction<GlobalAuthProfile[]>>,
): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = (profile: GlobalAuthProfile) => {
      setProfiles((prev) => {
        const next = [
          ...prev.filter((p) => p.id !== profile.id && p.name !== profile.name),
          profile,
        ];
        void saveGlobalAuthProfiles(next);
        return next;
      });
    };

    (window as unknown as Record<string, unknown>).__demoPurgeGlobalAuthProfiles = (
      names: string[],
      ids: string[],
    ) => {
      const nameSet = new Set(names);
      const idSet = new Set(ids);
      setProfiles((prev) => {
        const next = prev.filter((p) => !nameSet.has(p.name) && !idSet.has(p.id));
        if (next.length === prev.length) return prev;
        void saveGlobalAuthProfiles(next);
        return next;
      });
    };

    return () => {
      delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
      delete (window as unknown as Record<string, unknown>).__demoPurgeGlobalAuthProfiles;
    };
  }, [setProfiles]);
}
