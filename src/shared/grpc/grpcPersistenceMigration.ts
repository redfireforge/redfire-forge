/**
 * Phase 5A — migrate raw storage payloads to v1 collections/history envelopes.
 */
import type { GrpcCallType } from './contracts';
import {
  createEmptyGrpcCallHistoryStore,
  createEmptyGrpcCollectionsStore,
  createGrpcSavedRequestIdentity,
  defaultGrpcSavedRequestName,
  GRPC_CALL_HISTORY_MAX_ENTRIES,
  GRPC_PERSISTENCE_SCHEMA_VERSION,
  sanitizeGrpcCallHistoryStoreForPersist,
  sanitizeGrpcCollectionsStoreForPersist,
  validateGrpcCallHistoryStore,
  validateGrpcCollectionsStore,
  type GrpcCallHistoryEntryV1,
  type GrpcCallHistoryStoreV1,
  type GrpcCollectionV1,
  type GrpcCollectionsStoreV1,
} from './grpcPersistenceSchema';
import type { GrpcSavedRequest, GrpcResponseSnapshotBaseline } from './grpcSavedRequest';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseJsonPayload(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function normalizeResponseBaseline(raw: unknown): GrpcResponseSnapshotBaseline | undefined {
  if (!isPlainObject(raw)) return undefined;
  if (typeof raw.grpcStatus !== 'number' || !Number.isFinite(raw.grpcStatus)) return undefined;
  if (!isIsoTimestamp(raw.capturedAt)) return undefined;
  if (!isPlainObject(raw.body)) return undefined;
  if (raw.statusMessage !== undefined && typeof raw.statusMessage !== 'string') return undefined;
  return {
    capturedAt: raw.capturedAt,
    grpcStatus: raw.grpcStatus,
    statusMessage: typeof raw.statusMessage === 'string' ? raw.statusMessage : undefined,
    body: raw.body,
  };
}

function normalizeSavedRequestLegacy(raw: Record<string, unknown>): GrpcSavedRequest | null {
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.service) || !isNonEmptyString(raw.method)) {
    return null;
  }

  const callType = raw.callType;
  if (
    callType !== 'unary'
    && callType !== 'server_stream'
    && callType !== 'client_stream'
    && callType !== 'bidi_stream'
  ) {
    return null;
  }

  const now = new Date().toISOString();
  const service = String(raw.service);
  const method = String(raw.method);
  const identity = createGrpcSavedRequestIdentity(String(raw.id), now);

  const createdAt = isNonEmptyString(raw.createdAt)
    ? raw.createdAt
    : isNonEmptyString(raw.updatedAt)
      ? raw.updatedAt
      : identity.createdAt;
  const updatedAt = isNonEmptyString(raw.updatedAt) ? raw.updatedAt : identity.updatedAt;
  const revisionId = isNonEmptyString(raw.revisionId) ? raw.revisionId : identity.revisionId;
  const name = isNonEmptyString(raw.name)
    ? raw.name
    : defaultGrpcSavedRequestName(service, method);

  return {
    id: String(raw.id),
    name,
    revisionId,
    createdAt,
    updatedAt,
    callType: callType as GrpcCallType,
    target: isNonEmptyString(raw.target) ? raw.target : undefined,
    connectionId: isNonEmptyString(raw.connectionId) ? raw.connectionId : undefined,
    tlsMode: raw.tlsMode === 'disabled' || raw.tlsMode === 'tls' || raw.tlsMode === 'mtls'
      ? raw.tlsMode
      : undefined,
    tlsConfig: isPlainObject(raw.tlsConfig) ? raw.tlsConfig as GrpcSavedRequest['tlsConfig'] : undefined,
    service,
    method,
    descriptorKey: isNonEmptyString(raw.descriptorKey) ? raw.descriptorKey : 'unknown',
    body: isPlainObject(raw.body) ? raw.body : {},
    metadata: isPlainObject(raw.metadata)
      ? Object.fromEntries(Object.entries(raw.metadata).map(([k, v]) => [k, String(v)]))
      : {},
    timeoutMs: typeof raw.timeoutMs === 'number' && Number.isFinite(raw.timeoutMs) && raw.timeoutMs > 0
      ? raw.timeoutMs
      : 30_000,
    auth: isPlainObject(raw.auth) ? raw.auth as unknown as GrpcSavedRequest['auth'] : undefined,
    notes: isNonEmptyString(raw.notes) ? raw.notes : undefined,
    responseBaseline: normalizeResponseBaseline(raw.responseBaseline),
  };
}

function normalizeCollectionLegacy(raw: Record<string, unknown>, now: string): GrpcCollectionV1 | null {
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.name)) {
    return null;
  }

  const savedRequestsRaw = Array.isArray(raw.savedRequests)
    ? raw.savedRequests
    : Array.isArray(raw.requests)
      ? raw.requests
      : [];

  const savedRequests = savedRequestsRaw
    .map((entry) => (isPlainObject(entry) ? normalizeSavedRequestLegacy(entry) : null))
    .filter((entry): entry is GrpcSavedRequest => entry !== null);

  return {
    id: String(raw.id),
    name: String(raw.name),
    createdAt: isNonEmptyString(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isNonEmptyString(raw.updatedAt) ? raw.updatedAt : now,
    defaultTarget: isNonEmptyString(raw.defaultTarget)
      ? raw.defaultTarget
      : isNonEmptyString(raw.target)
        ? raw.target
        : undefined,
    defaultDescriptorKey: isNonEmptyString(raw.defaultDescriptorKey) ? raw.defaultDescriptorKey : undefined,
    savedRequests,
  };
}

function migrateCollectionsFromLegacyArray(raw: unknown[], now: string): GrpcCollectionsStoreV1 {
  const collections = raw
    .map((entry) => (isPlainObject(entry) ? normalizeCollectionLegacy(entry, now) : null))
    .filter((entry): entry is GrpcCollectionV1 => entry !== null);

  return {
    schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
    collections,
    updatedAt: now,
  };
}

function migrateCollectionsFromLegacyEnvelope(raw: Record<string, unknown>, now: string): GrpcCollectionsStoreV1 {
  if (Array.isArray(raw.collections)) {
    return migrateCollectionsFromLegacyArray(raw.collections, now);
  }
  if (Array.isArray(raw.items)) {
    return migrateCollectionsFromLegacyArray(raw.items, now);
  }
  return createEmptyGrpcCollectionsStore(now);
}

function normalizeHistoryEntryLegacy(raw: Record<string, unknown>): GrpcCallHistoryEntryV1 | null {
  if (isPlainObject(raw.record) && isNonEmptyString(raw.id)) {
    const snapshot = isPlainObject(raw.record.snapshot) ? raw.record.snapshot : null;
    if (!snapshot) return null;
    const targetObj = isPlainObject(snapshot.target) ? snapshot.target : null;
    const target = isNonEmptyString(raw.target)
      ? raw.target
      : targetObj && isNonEmptyString(targetObj.address)
        ? targetObj.address
        : null;
    if (!target) return null;

    const callType = raw.callType ?? snapshot.callType;
    if (
      callType !== 'unary'
      && callType !== 'server_stream'
      && callType !== 'client_stream'
      && callType !== 'bidi_stream'
    ) {
      return null;
    }

    const service = isNonEmptyString(raw.service)
      ? String(raw.service)
      : isNonEmptyString(snapshot.service)
        ? String(snapshot.service)
        : '';
    const method = isNonEmptyString(raw.method)
      ? String(raw.method)
      : isNonEmptyString(snapshot.method)
        ? String(snapshot.method)
        : '';
    if (!service.trim() || !method.trim()) {
      return null;
    }

    return {
      id: String(raw.id),
      callType: callType as GrpcCallType,
      target,
      service,
      method,
      descriptorKey: isNonEmptyString(raw.descriptorKey)
        ? String(raw.descriptorKey)
        : String(snapshot.descriptorKey ?? 'unknown'),
      grpcStatus: typeof raw.grpcStatus === 'number' ? raw.grpcStatus : undefined,
      durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
      capturedAt: isNonEmptyString(raw.capturedAt)
        ? raw.capturedAt
        : isNonEmptyString(raw.record.capturedAt)
          ? String(raw.record.capturedAt)
          : new Date().toISOString(),
      bodyTruncated: typeof raw.bodyTruncated === 'boolean' ? raw.bodyTruncated : false,
      record: raw.record as unknown as GrpcCallHistoryEntryV1['record'],
    };
  }
  return null;
}

function migrateHistoryFromLegacy(raw: unknown, now: string): GrpcCallHistoryStoreV1 {
  if (Array.isArray(raw)) {
    const entries = raw
      .map((entry) => (isPlainObject(entry) ? normalizeHistoryEntryLegacy(entry) : null))
      .filter((entry): entry is GrpcCallHistoryEntryV1 => entry !== null)
      .slice(-GRPC_CALL_HISTORY_MAX_ENTRIES);

    return {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      entries,
      updatedAt: now,
    };
  }

  if (isPlainObject(raw) && Array.isArray(raw.entries)) {
    const entries = raw.entries
      .map((entry) => (isPlainObject(entry) ? normalizeHistoryEntryLegacy(entry) : null))
      .filter((entry): entry is GrpcCallHistoryEntryV1 => entry !== null)
      .slice(-GRPC_CALL_HISTORY_MAX_ENTRIES);

    return {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      entries,
      updatedAt: isNonEmptyString(raw.updatedAt) ? raw.updatedAt : now,
    };
  }

  return createEmptyGrpcCallHistoryStore(now);
}

/**
 * Migrate collections payload to v1 envelope.
 * Accepts: null/undefined, empty string, valid v1 envelope, legacy array, or partial envelope.
 */
export function migrateGrpcCollectionsStore(raw: unknown): GrpcCollectionsStoreV1 {
  const parsed = parseJsonPayload(raw);
  const now = new Date().toISOString();

  if (parsed === null || parsed === undefined || parsed === '') {
    return createEmptyGrpcCollectionsStore(now);
  }

  const validated = validateGrpcCollectionsStore(parsed);
  if (validated.ok) {
    return sanitizeGrpcCollectionsStoreForPersist(validated.value as GrpcCollectionsStoreV1);
  }

  if (Array.isArray(parsed)) {
    return sanitizeGrpcCollectionsStoreForPersist(migrateCollectionsFromLegacyArray(parsed, now));
  }

  if (isPlainObject(parsed)) {
    return sanitizeGrpcCollectionsStoreForPersist(migrateCollectionsFromLegacyEnvelope(parsed, now));
  }

  return createEmptyGrpcCollectionsStore(now);
}

/**
 * Migrate call history payload to v1 envelope.
 */
export function migrateGrpcCallHistoryStore(raw: unknown): GrpcCallHistoryStoreV1 {
  const parsed = parseJsonPayload(raw);
  const now = new Date().toISOString();

  if (parsed === null || parsed === undefined || parsed === '') {
    return createEmptyGrpcCallHistoryStore(now);
  }

  const validated = validateGrpcCallHistoryStore(parsed);
  if (validated.ok) {
    return sanitizeGrpcCallHistoryStoreForPersist(validated.value as GrpcCallHistoryStoreV1);
  }

  return sanitizeGrpcCallHistoryStoreForPersist(migrateHistoryFromLegacy(parsed, now));
}
