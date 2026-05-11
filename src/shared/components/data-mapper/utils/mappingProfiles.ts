/**
 * Mapping Profiles — save, load, rename, and delete named mapping configurations.
 *
 * Uses the shared storage abstraction (readKey/writeKey) to support
 * both browser (localStorage) and Tauri (file-system) environments.
 */

import type { Mapping } from '../types';
import { readKey, writeKey } from '../../../utils/storage';

const STORAGE_PREFIX = 'dm-profiles-';

export interface MappingProfile {
  id: string;
  name: string;
  contextId: string;
  mappings: Mapping[];
  createdAt: number;
  updatedAt: number;
}

function storageKey(contextId: string): string {
  return `${STORAGE_PREFIX}${contextId}`;
}

export async function loadProfiles(contextId: string): Promise<MappingProfile[]> {
  try {
    const raw = await readKey(storageKey(contextId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persistProfiles(contextId: string, profiles: MappingProfile[]): Promise<void> {
  try {
    await writeKey(storageKey(contextId), JSON.stringify(profiles));
  } catch {
    // Quota exceeded or private mode — silently degrade
  }
}

export async function saveProfile(
  contextId: string,
  name: string,
  mappings: Mapping[],
): Promise<MappingProfile> {
  const profiles = await loadProfiles(contextId);
  const now = Date.now();
  const existing = profiles.find((p) => p.name === name);

  if (existing) {
    existing.mappings = mappings;
    existing.updatedAt = now;
    await persistProfiles(contextId, profiles);
    return existing;
  }

  const profile: MappingProfile = {
    id: `prof-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    contextId,
    mappings,
    createdAt: now,
    updatedAt: now,
  };
  profiles.push(profile);
  await persistProfiles(contextId, profiles);
  return profile;
}

export async function deleteProfile(contextId: string, profileId: string): Promise<boolean> {
  const profiles = await loadProfiles(contextId);
  const idx = profiles.findIndex((p) => p.id === profileId);
  if (idx === -1) return false;
  profiles.splice(idx, 1);
  await persistProfiles(contextId, profiles);
  return true;
}

export async function renameProfile(
  contextId: string,
  profileId: string,
  newName: string,
): Promise<MappingProfile | null> {
  const profiles = await loadProfiles(contextId);
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return null;
  if (profiles.some((p) => p.id !== profileId && p.name === newName)) return null;
  profile.name = newName;
  profile.updatedAt = Date.now();
  await persistProfiles(contextId, profiles);
  return profile;
}

export async function getProfileById(
  contextId: string,
  profileId: string,
): Promise<MappingProfile | undefined> {
  const profiles = await loadProfiles(contextId);
  return profiles.find((p) => p.id === profileId);
}
