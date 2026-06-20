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
import { writeKey } from '../../../shared/utils/storage';
import {
  GQL_PROFILES_STORAGE_KEY,
  readConnectionProfiles,
  type ConnectionProfile,
} from '../utils/connectionProfileStorage';

export type { ConnectionProfile } from '../utils/connectionProfileStorage';

function persistProfiles(profiles: ConnectionProfile[]): void {
  writeKey(GQL_PROFILES_STORAGE_KEY, JSON.stringify(profiles)).catch(() => { /* quota exceeded — silent */ });
}

function generateId(): string {
  return `gql-profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseGraphqlConnectionProfilesResult {
  profiles: ConnectionProfile[];
  /** Creates a new profile for the given name/endpoint/auth and persists it. */
  saveProfile: (name: string, endpoint: string, auth: GraphqlAuth | null) => ConnectionProfile;
  /** Renames an existing profile in-place. */
  renameProfile: (id: string, newName: string) => void;
  /** Permanently removes a profile by id. */
  deleteProfile: (id: string) => void;
}

export function useGraphqlConnectionProfiles(): UseGraphqlConnectionProfilesResult {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);

  // Load from storage on mount
  useEffect(() => {
    readConnectionProfiles()
      .then(setProfiles)
      .catch(() => { /* storage unavailable */ });
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

  return { profiles, saveProfile, renameProfile, deleteProfile };
}
