/**
 * useGraphqlConnectionProfiles — Phase 1D addition.
 *
 * Manages named connection profiles: endpoint URL + auth configuration combos
 * that the user can save once and re-apply with a single click.
 *
 * Profiles are stored in localStorage under `gql_profiles_v1` as a JSON array.
 * Each profile is a lightweight snapshot of the connection bar state at save time.
 */

import { useCallback, useState } from 'react';
import type { GraphqlAuth } from '../../../shared/types/graphql';

const PROFILES_KEY = 'gql_profiles_v1';

// ─── Type ─────────────────────────────────────────────────────────────────────

export interface ConnectionProfile {
  id: string;
  name: string;
  endpoint: string;
  auth: GraphqlAuth | null;
  createdAt: number;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadProfiles(): ConnectionProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ConnectionProfile =>
        p !== null &&
        typeof p === 'object' &&
        typeof (p as Record<string, unknown>).id === 'string' &&
        typeof (p as Record<string, unknown>).name === 'string' &&
        typeof (p as Record<string, unknown>).endpoint === 'string',
    );
  } catch {
    return [];
  }
}

function persistProfiles(profiles: ConnectionProfile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch { /* quota exceeded — silent */ }
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
  const [profiles, setProfiles] = useState<ConnectionProfile[]>(() => loadProfiles());

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
