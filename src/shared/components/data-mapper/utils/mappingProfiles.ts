/**
 * Mapping Profiles — save, load, rename, and delete named mapping configurations.
 *
 * Uses the shared storage abstraction (readKey/writeKey) to support
 * both browser (localStorage) and Tauri (file-system) environments.
 */

import type { Mapping } from '../types';
import { readJsonArray, writeJson } from '../../../utils/jsonKeyStorage';
import { normalizeMapperPath } from './pathNormalization';

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
  return readJsonArray<MappingProfile>(storageKey(contextId));
}

async function persistProfiles(contextId: string, profiles: MappingProfile[]): Promise<void> {
  await writeJson(storageKey(contextId), profiles);
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

export interface ApplyProfileDeltaResult {
  mappings: Mapping[];
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
}

function isDeltaEquivalent(existing: Mapping, fromProfile: Mapping): boolean {
  return (
    normalizeMapperPath(existing.sourcePath) === normalizeMapperPath(fromProfile.sourcePath)
    && (existing.sourceId || '') === (fromProfile.sourceId || '')
    && normalizeMapperPath(existing.targetPath) === normalizeMapperPath(fromProfile.targetPath)
    && (existing.expression ?? '') === (fromProfile.expression ?? '')
    && existing.operator === fromProfile.operator
    && (existing.operatorValue ?? '') === (fromProfile.operatorValue ?? '')
    && !!existing.negate === !!fromProfile.negate
  );
}

export function applyProfileDelta(
  currentMappings: Mapping[],
  profileMappings: Mapping[],
  createId: () => string,
): ApplyProfileDeltaResult {
  const nextMappings = [...currentMappings];
  const targetIndex = new Map<string, number>();
  for (let i = 0; i < nextMappings.length; i += 1) {
    const targetKey = normalizeMapperPath(nextMappings[i].targetPath);
    if (!targetIndex.has(targetKey)) targetIndex.set(targetKey, i);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const profileMapping of profileMappings) {
    const targetKey = normalizeMapperPath(profileMapping.targetPath);
    const existingIdx = targetIndex.get(targetKey);
    if (existingIdx == null) {
      const inserted: Mapping = {
        ...profileMapping,
        id: createId(),
        isPending: false,
      };
      nextMappings.push(inserted);
      targetIndex.set(targetKey, nextMappings.length - 1);
      insertedCount += 1;
      continue;
    }

    const existing = nextMappings[existingIdx];
    if (isDeltaEquivalent(existing, profileMapping)) {
      unchangedCount += 1;
      continue;
    }

    nextMappings[existingIdx] = {
      ...existing,
      sourcePath: profileMapping.sourcePath,
      sourceId: profileMapping.sourceId,
      targetPath: profileMapping.targetPath,
      expression: profileMapping.expression,
      operator: profileMapping.operator,
      operatorValue: profileMapping.operatorValue,
      negate: profileMapping.negate,
      isPending: false,
    };
    updatedCount += 1;
  }

  return { mappings: nextMappings, insertedCount, updatedCount, unchangedCount };
}
