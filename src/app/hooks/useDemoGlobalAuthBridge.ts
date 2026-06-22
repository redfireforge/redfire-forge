import { useEffect } from 'react';
import type { GlobalAuthProfile } from '../../shared/types';
import { saveGlobalAuthProfiles } from '../../shared/utils/storage';

/**
 * Exposes demo-player bridge helpers on `window`:
 *   - `__demoUpsertGlobalAuthProfile(profile)` — upsert a global auth profile into React state + storage
 */
export function useDemoGlobalAuthBridge(
  setProfiles: React.Dispatch<React.SetStateAction<GlobalAuthProfile[]>>,
): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = (profile: GlobalAuthProfile) => {
      setProfiles((prev) => {
        const idx = prev.findIndex((p) => p.id === profile.id);
        const next = idx >= 0
          ? [...prev.slice(0, idx), profile, ...prev.slice(idx + 1)]
          : [...prev, profile];
        void saveGlobalAuthProfiles(next);
        return next;
      });
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    };
  }, [setProfiles]);
}
