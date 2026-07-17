/**
 * useGraphqlConnectionProfiles — Phase 1D addition.
 *
 * Manages named connection profiles: endpoint URL + auth configuration combos
 * that the user can save once and re-apply with a single click.
 *
 * Profiles are stored under `gql_profiles_v1` as a JSON array via the shared storage abstraction.
 * Each profile is a lightweight snapshot of the connection bar state at save time.
 */

import { useCallback, useEffect, useState } from 'react';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import {
  GQL_PROFILES_RELOAD_EVENT,
  readConnectionProfiles,
  writeConnectionProfiles,
  type ConnectionProfile,
} from '../utils/connectionProfileStorage';
import { graphqlAuthEquals } from '../utils/tabPersistence';

export type { ConnectionProfile } from '../utils/connectionProfileStorage';

function persistProfiles(profiles: ConnectionProfile[]): void {
  writeConnectionProfiles(profiles).catch(() => { /* quota exceeded — silent */ });
}

function generateId(): string {
  return `gql-profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface ProfileUpdatePatch {
  endpoint?: string;
  auth?: GraphqlAuth | null;
}

export interface UseGraphqlConnectionProfilesResult {
  profiles: ConnectionProfile[];
  /** False until the initial profile catalog load completes. */
  profilesReady: boolean;
  /** Creates a new profile for the given name/endpoint/auth and persists it. */
  saveProfile: (name: string, endpoint: string, auth: GraphqlAuth | null) => ConnectionProfile;
  /** Updates endpoint and/or auth on an existing profile (linked-tab edits). */
  updateProfile: (id: string, patch: ProfileUpdatePatch) => void;
  /** Renames an existing profile in-place. */
  renameProfile: (id: string, newName: string) => void;
  /** Permanently removes a profile by id. */
  deleteProfile: (id: string) => void;
}

export function useGraphqlConnectionProfiles(): UseGraphqlConnectionProfilesResult {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [profilesReady, setProfilesReady] = useState(false);

  // Load from storage on mount and when external purge/save dispatches reload.
  useEffect(() => {
    let cancelled = false;
    const reload = () => {
      readConnectionProfiles()
        .then((next) => {
          if (!cancelled) setProfiles(next);
        })
        .catch(() => { /* storage unavailable */ })
        .finally(() => {
          if (!cancelled) setProfilesReady(true);
        });
    };
    reload();
    window.addEventListener(GQL_PROFILES_RELOAD_EVENT, reload);
    return () => {
      cancelled = true;
      window.removeEventListener(GQL_PROFILES_RELOAD_EVENT, reload);
    };
  }, []);

  const saveProfile = useCallback((
    name: string,
    endpoint: string,
    auth: GraphqlAuth | null,
  ): ConnectionProfile => {
    const profile: ConnectionProfile = {
      id: generateId(),
      name: name.trim() || 'Untitled Profile',
      endpoint,
      auth,
      createdAt: Date.now(),
    };
    setProfiles((prev) => {
      const next = [...prev, profile];
      persistProfiles(next);
      return next;
    });
    return profile;
  }, []);

  const updateProfile = useCallback((id: string, patch: ProfileUpdatePatch) => {
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const current = prev[idx];
      const nextProfile: ConnectionProfile = {
        ...current,
        ...(patch.endpoint !== undefined ? { endpoint: patch.endpoint } : {}),
        ...(patch.auth !== undefined ? { auth: patch.auth } : {}),
      };
      const authUnchanged = patch.auth === undefined
        || graphqlAuthEquals(nextProfile.auth ?? null, current.auth ?? null);
      if (nextProfile.endpoint === current.endpoint && authUnchanged) {
        return prev;
      }
      const next = [...prev];
      next[idx] = nextProfile;
      persistProfiles(next);
      return next;
    });
  }, []);

  const renameProfile = useCallback((id: string, newName: string) => {
    setProfiles((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, name: newName.trim() || p.name } : p,
      );
      persistProfiles(next);
      return next;
    });
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistProfiles(next);
      return next;
    });
  }, []);

  return { profiles, profilesReady, saveProfile, updateProfile, renameProfile, deleteProfile };
}
