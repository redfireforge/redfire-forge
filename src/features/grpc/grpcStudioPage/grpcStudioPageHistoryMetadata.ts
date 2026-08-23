import type { GrpcCallHistoryEntryV1 } from '@shared/grpc/grpcPersistenceSchema';
import { isGrpcRedactedPersistValue } from '@shared/grpc/grpcSavedRequest';

export function sanitizeHistoryAuthForGrpcurl(
  auth: GrpcCallHistoryEntryV1['record']['snapshot']['auth'],
): GrpcCallHistoryEntryV1['record']['snapshot']['auth'] | undefined {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') {
    return auth;
  }
  switch (auth.type) {
    case 'bearer':
      return isGrpcRedactedPersistValue(auth.bearerToken) ? undefined : auth;
    case 'basic':
      return isGrpcRedactedPersistValue(auth.basicPassword) ? undefined : auth;
    case 'api_key':
      return isGrpcRedactedPersistValue(auth.apiKeyValue) ? undefined : auth;
    case 'oauth2':
      return isGrpcRedactedPersistValue(auth.oauth2?.clientSecret) ? undefined : auth;
    default:
      return auth;
  }
}

export function mergeHistoryMetadataForGrpcurl(
  replayMetadata: Record<string, string> | undefined,
  historyMetadata: Record<string, string> | undefined,
  runtimeMetadata: Record<string, string> | undefined,
  activeMetadata: Record<string, string> | undefined,
  environmentMetadata: Record<string, string>,
): Record<string, string> {
  if (!historyMetadata && !activeMetadata && !runtimeMetadata) {
    return replayMetadata ? { ...replayMetadata } : {};
  }
  const merged = {
    ...historyMetadata,
    ...(runtimeMetadata ?? {}),
    ...(activeMetadata ?? {}),
    ...(replayMetadata ?? {}),
  };
  if (!historyMetadata) {
    return merged;
  }
  for (const [key, value] of Object.entries(historyMetadata)) {
    if (!isGrpcRedactedPersistValue(value)) continue;
    const replayValue = replayMetadata?.[key];
    if (replayValue && !isGrpcRedactedPersistValue(replayValue)) {
      merged[key] = replayValue;
      continue;
    }
    const runtimeValue = runtimeMetadata?.[key];
    if (runtimeValue && !isGrpcRedactedPersistValue(runtimeValue)) {
      merged[key] = runtimeValue;
      continue;
    }
    const activeValue = activeMetadata?.[key];
    if (activeValue && !isGrpcRedactedPersistValue(activeValue)) {
      merged[key] = activeValue;
      continue;
    }

    const normalized = key.trim();
    const candidates = [
      normalized,
      normalized.toLowerCase(),
      normalized.toUpperCase(),
      normalized.replace(/-/g, '_'),
      normalized.replace(/-/g, '_').toUpperCase(),
      normalized.replace(/[^A-Za-z0-9]+/g, ''),
    ];
    const envValue = candidates
      .map((candidate) => environmentMetadata[candidate])
      .find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
    if (envValue && !isGrpcRedactedPersistValue(envValue)) {
      merged[key] = envValue;
    }
  }
  return merged;
}

export function resolveSiblingRuntimeHistoryMetadata(
  entry: GrpcCallHistoryEntryV1,
  callHistoryEntries: GrpcCallHistoryEntryV1[],
  getRuntimeMetadata: (entryId: string) => Record<string, string> | undefined,
): Record<string, string> | undefined {
  const redactedKeys = Object.entries(entry.record.snapshot.metadata ?? {})
    .filter(([, value]) => isGrpcRedactedPersistValue(value))
    .map(([key]) => key);
  if (redactedKeys.length === 0) {
    return undefined;
  }

  const pending = new Set(redactedKeys);
  const resolved: Record<string, string> = {};
  const byDistance = callHistoryEntries
    .filter((candidate) => (
      candidate.id !== entry.id
      && candidate.service === entry.service
      && candidate.method === entry.method
      && candidate.target === entry.target
    ))
    .sort((left, right) => {
      const leftDelta = Math.abs(Date.parse(left.capturedAt) - Date.parse(entry.capturedAt));
      const rightDelta = Math.abs(Date.parse(right.capturedAt) - Date.parse(entry.capturedAt));
      return leftDelta - rightDelta;
    });

  for (const candidate of byDistance) {
    const candidateRuntime = getRuntimeMetadata(candidate.id);
    if (!candidateRuntime) continue;

    for (const key of [...pending]) {
      const value = candidateRuntime[key];
      if (!value || isGrpcRedactedPersistValue(value)) continue;
      resolved[key] = value;
      pending.delete(key);
    }

    if (pending.size === 0) {
      break;
    }
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}
