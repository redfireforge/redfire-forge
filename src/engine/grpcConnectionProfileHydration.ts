import type { GrpcTlsMode } from '@shared/grpc/contracts';
import type { GrpcConnectionProfile } from '../features/grpc/utils/resolveGrpcTabConnection';

export const GRPC_PROFILE_STORAGE_KEYS = [
  'grpc_profiles_v1',
  'redfire-grpc-profiles-v1',
  'grpc_connection_profiles_v1',
] as const;

function isTlsMode(value: unknown): value is GrpcTlsMode {
  return value === 'disabled' || value === 'tls' || value === 'mtls';
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeProfile(value: unknown): GrpcConnectionProfile | null {
  const entry = toRecord(value);
  if (!entry) return null;
  if (typeof entry.id !== 'string' || !entry.id.trim()) return null;
  if (typeof entry.name !== 'string') return null;
  if (typeof entry.target !== 'string') return null;

  const tlsMode = isTlsMode(entry.tlsMode) ? entry.tlsMode : 'disabled';
  const variablesRecord = toRecord(entry.variables);
  const variables = variablesRecord
    ? Object.fromEntries(
      Object.entries(variablesRecord).filter(
        ([, raw]) => typeof raw === 'string',
      ) as Array<[string, string]>,
    )
    : undefined;

  return {
    id: entry.id,
    name: entry.name,
    target: entry.target,
    tlsMode,
    variables,
  };
}

export function parseGrpcConnectionProfiles(raw: string | null | undefined): GrpcConnectionProfile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeProfile(entry))
      .filter((entry): entry is GrpcConnectionProfile => entry !== null);
  } catch {
    return [];
  }
}

function defaultStorageReader(key: string): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadGrpcConnectionProfilesFromStorage(
  readStorage: (key: string) => string | null = defaultStorageReader,
): GrpcConnectionProfile[] {
  for (const key of GRPC_PROFILE_STORAGE_KEYS) {
    const parsed = parseGrpcConnectionProfiles(readStorage(key));
    if (parsed.length > 0) {
      return parsed;
    }
  }
  return [];
}