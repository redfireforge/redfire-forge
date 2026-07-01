/**
 * Phase 5A — gRPC Studio collections/history persistence schema (v1 freeze).
 *
 * Defines storage envelopes, validation, identity/revision helpers, and history
 * body truncation. CRUD and IDB write paths ship in Phase 5B/5D.
 */
import type { GrpcCallType } from './contracts';
import type { GrpcCallHistoryRecord } from './grpcRedaction';
import { prepareGrpcCallHistoryRecord } from './grpcRedaction';
import type { GrpcSavedRequest } from './grpcSavedRequest';
import { redactGrpcSavedRequestForPersist } from './grpcSavedRequest';

/** localStorage / Tauri FS root key for collections envelope. */
export const GRPC_COLLECTIONS_STORAGE_KEY = 'grpc_collections_v1';

/** localStorage / Tauri FS root key for call history envelope. */
export const GRPC_CALL_HISTORY_STORAGE_KEY = 'grpc_call_history_v1';

/** Future IndexedDB object store names (created in idbOpen v11 — 5B/5D). */
export const GRPC_COLLECTIONS_IDB_STORE = 'grpc-collections';
export const GRPC_COLLECTION_ITEMS_IDB_STORE = 'grpc-collection-items';
export const GRPC_CALL_HISTORY_IDB_STORE = 'grpc-call-history';

export const GRPC_PERSISTENCE_SCHEMA_VERSION = 1 as const;

/** Global history cap — oldest entries evicted on append (Phase 5D enforces). */
export const GRPC_CALL_HISTORY_MAX_ENTRIES = 200;

/** Per-entry body snapshot cap before truncation marker (Phase 5 plan). */
export const GRPC_CALL_HISTORY_BODY_CAP_BYTES = 64 * 1024;

export const GRPC_HISTORY_BODY_TRUNCATED_MARKER = '[TRUNCATED]';

export interface GrpcSavedRequestIdentity {
  id: string;
  revisionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrpcCollectionV1 {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Optional default target token, e.g. `{{grpcHost}}`. */
  defaultTarget?: string;
  defaultDescriptorKey?: string;
  savedRequests: GrpcSavedRequest[];
}

export interface GrpcCollectionsStoreV1 {
  schemaVersion: typeof GRPC_PERSISTENCE_SCHEMA_VERSION;
  collections: GrpcCollectionV1[];
  updatedAt: string;
}

/** Persisted history row — denormalized filter fields + redacted record payload. */
export interface GrpcCallHistoryEntryV1 {
  id: string;
  callType: GrpcCallType;
  target: string;
  service: string;
  method: string;
  descriptorKey: string;
  grpcStatus?: number;
  durationMs?: number;
  capturedAt: string;
  bodyTruncated: boolean;
  record: GrpcCallHistoryRecord;
}

export interface GrpcCallHistoryStoreV1 {
  schemaVersion: typeof GRPC_PERSISTENCE_SCHEMA_VERSION;
  entries: GrpcCallHistoryEntryV1[];
  updatedAt: string;
}

export type GrpcPersistenceValidationIssue = {
  path: string;
  message: string;
};

export type GrpcPersistenceValidationResult =
  | { ok: true; value: GrpcCollectionsStoreV1 | GrpcCallHistoryStoreV1 }
  | { ok: false; issues: GrpcPersistenceValidationIssue[] };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isGrpcCallType(value: unknown): value is GrpcCallType {
  return value === 'unary'
    || value === 'server_stream'
    || value === 'client_stream'
    || value === 'bidi_stream';
}

/** Default display name — canonical implementation in grpcSavedRequest.ts. */
export { defaultGrpcSavedRequestName } from './grpcSavedRequest';

export function createGrpcSavedRequestIdentity(
  id: string,
  now: string = new Date().toISOString(),
): GrpcSavedRequestIdentity {
  return {
    id,
    revisionId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Bump revision on "Update saved request" — `id` and `createdAt` stay stable. */
export function bumpGrpcSavedRequestRevision(
  prior: Pick<GrpcSavedRequestIdentity, 'id' | 'createdAt'>,
  now: string = new Date().toISOString(),
): GrpcSavedRequestIdentity {
  return {
    id: prior.id,
    createdAt: prior.createdAt,
    revisionId: crypto.randomUUID(),
    updatedAt: now,
  };
}

export function createEmptyGrpcCollectionsStore(now?: string): GrpcCollectionsStoreV1 {
  const ts = now ?? new Date().toISOString();
  return {
    schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
    collections: [],
    updatedAt: ts,
  };
}

export function createEmptyGrpcCallHistoryStore(now?: string): GrpcCallHistoryStoreV1 {
  const ts = now ?? new Date().toISOString();
  return {
    schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
    entries: [],
    updatedAt: ts,
  };
}

function validateSavedRequest(
  raw: unknown,
  path: string,
  issues: GrpcPersistenceValidationIssue[],
): GrpcSavedRequest | null {
  if (!isPlainObject(raw)) {
    issues.push({ path, message: 'Saved request must be an object' });
    return null;
  }

  const requiredStrings: Array<[keyof GrpcSavedRequest, string]> = [
    ['id', 'id'],
    ['name', 'name'],
    ['revisionId', 'revisionId'],
    ['createdAt', 'createdAt'],
    ['updatedAt', 'updatedAt'],
    ['service', 'service'],
    ['method', 'method'],
    ['descriptorKey', 'descriptorKey'],
  ];

  for (const [field, label] of requiredStrings) {
    if (!isNonEmptyString(raw[field as string])) {
      issues.push({ path: `${path}.${label}`, message: `${label} is required` });
    }
  }

  if (!isGrpcCallType(raw.callType)) {
    issues.push({ path: `${path}.callType`, message: 'Invalid callType' });
  }

  if (!isPlainObject(raw.body)) {
    issues.push({ path: `${path}.body`, message: 'body must be an object' });
  }

  if (!isPlainObject(raw.metadata)) {
    issues.push({ path: `${path}.metadata`, message: 'metadata must be an object' });
  }

  if (typeof raw.timeoutMs !== 'number' || !Number.isFinite(raw.timeoutMs) || raw.timeoutMs <= 0) {
    issues.push({ path: `${path}.timeoutMs`, message: 'timeoutMs must be a positive number' });
  }

  if (raw.responseBaseline !== undefined) {
    if (!isPlainObject(raw.responseBaseline)) {
      issues.push({ path: `${path}.responseBaseline`, message: 'responseBaseline must be an object' });
    } else {
      const baseline = raw.responseBaseline;
      if (typeof baseline.grpcStatus !== 'number' || !Number.isFinite(baseline.grpcStatus)) {
        issues.push({ path: `${path}.responseBaseline.grpcStatus`, message: 'grpcStatus must be a number' });
      }
      if (
        baseline.statusMessage !== undefined
        && typeof baseline.statusMessage !== 'string'
      ) {
        issues.push({ path: `${path}.responseBaseline.statusMessage`, message: 'statusMessage must be a string' });
      }
      if (!isIsoTimestamp(baseline.capturedAt)) {
        issues.push({ path: `${path}.responseBaseline.capturedAt`, message: 'capturedAt must be ISO-8601' });
      }
      if (!isPlainObject(baseline.body)) {
        issues.push({ path: `${path}.responseBaseline.body`, message: 'body must be an object' });
      }
    }
  }

  if (
    raw.tlsMode !== undefined
    && raw.tlsMode !== 'disabled'
    && raw.tlsMode !== 'tls'
    && raw.tlsMode !== 'mtls'
  ) {
    issues.push({ path: `${path}.tlsMode`, message: 'Invalid tlsMode' });
  }

  for (const tsField of ['createdAt', 'updatedAt'] as const) {
    if (raw[tsField] !== undefined && !isIsoTimestamp(raw[tsField])) {
      issues.push({ path: `${path}.${tsField}`, message: `${tsField} must be ISO-8601` });
    }
  }

  if (issues.some((issue) => issue.path.startsWith(`${path}.`))) {
    return null;
  }

  return raw as unknown as GrpcSavedRequest;
}

function validateCollection(
  raw: unknown,
  path: string,
  issues: GrpcPersistenceValidationIssue[],
): GrpcCollectionV1 | null {
  if (!isPlainObject(raw)) {
    issues.push({ path, message: 'Collection must be an object' });
    return null;
  }

  if (!isNonEmptyString(raw.id)) issues.push({ path: `${path}.id`, message: 'id is required' });
  if (!isNonEmptyString(raw.name)) issues.push({ path: `${path}.name`, message: 'name is required' });
  if (!isIsoTimestamp(raw.createdAt)) issues.push({ path: `${path}.createdAt`, message: 'createdAt must be ISO-8601' });
  if (!isIsoTimestamp(raw.updatedAt)) issues.push({ path: `${path}.updatedAt`, message: 'updatedAt must be ISO-8601' });

  const savedRequests: GrpcSavedRequest[] = [];
  if (raw.savedRequests !== undefined) {
    if (!Array.isArray(raw.savedRequests)) {
      issues.push({ path: `${path}.savedRequests`, message: 'savedRequests must be an array' });
    } else {
      raw.savedRequests.forEach((entry, index) => {
        const validated = validateSavedRequest(entry, `${path}.savedRequests[${index}]`, issues);
        if (validated) savedRequests.push(validated);
      });
    }
  }

  if (issues.some((issue) => issue.path.startsWith(`${path}.`))) {
    return null;
  }

  const seenSavedIds = new Set<string>();
  for (const saved of savedRequests) {
    if (seenSavedIds.has(saved.id)) {
      issues.push({
        path: `${path}.savedRequests`,
        message: `Duplicate saved request id: ${saved.id}`,
      });
      return null;
    }
    seenSavedIds.add(saved.id);
  }

  return {
    id: String(raw.id),
    name: String(raw.name),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    defaultTarget: isNonEmptyString(raw.defaultTarget) ? raw.defaultTarget : undefined,
    defaultDescriptorKey: isNonEmptyString(raw.defaultDescriptorKey) ? raw.defaultDescriptorKey : undefined,
    savedRequests,
  };
}

export function validateGrpcCollectionsStore(raw: unknown): GrpcPersistenceValidationResult {
  const issues: GrpcPersistenceValidationIssue[] = [];

  if (!isPlainObject(raw)) {
    return { ok: false, issues: [{ path: '', message: 'Root must be an object' }] };
  }

  if (raw.schemaVersion !== GRPC_PERSISTENCE_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `Expected schemaVersion ${GRPC_PERSISTENCE_SCHEMA_VERSION}`,
    });
  }

  if (!isIsoTimestamp(raw.updatedAt)) {
    issues.push({ path: 'updatedAt', message: 'updatedAt must be ISO-8601' });
  }

  const collections: GrpcCollectionV1[] = [];
  if (!Array.isArray(raw.collections)) {
    issues.push({ path: 'collections', message: 'collections must be an array' });
  } else {
    raw.collections.forEach((entry, index) => {
      const validated = validateCollection(entry, `collections[${index}]`, issues);
      if (validated) collections.push(validated);
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const seenCollectionIds = new Set<string>();
  const seenSavedRequestIds = new Set<string>();
  for (const collection of collections) {
    if (seenCollectionIds.has(collection.id)) {
      return {
        ok: false,
        issues: [{
          path: 'collections',
          message: `Duplicate collection id: ${collection.id}`,
        }],
      };
    }
    seenCollectionIds.add(collection.id);

    for (const saved of collection.savedRequests) {
      if (seenSavedRequestIds.has(saved.id)) {
        return {
          ok: false,
          issues: [{
            path: 'collections',
            message: `Duplicate saved request id across collections: ${saved.id}`,
          }],
        };
      }
      seenSavedRequestIds.add(saved.id);
    }
  }

  return {
    ok: true,
    value: {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      collections,
      updatedAt: String(raw.updatedAt),
    },
  };
}

function validateHistoryRecord(
  raw: unknown,
  path: string,
  issues: GrpcPersistenceValidationIssue[],
): GrpcCallHistoryRecord | null {
  if (!isPlainObject(raw)) {
    issues.push({ path, message: 'record must be an object' });
    return null;
  }
  if (!isPlainObject(raw.snapshot)) {
    issues.push({ path: `${path}.snapshot`, message: 'snapshot is required' });
    return null;
  }
  if (!isIsoTimestamp(raw.capturedAt)) {
    issues.push({ path: `${path}.capturedAt`, message: 'capturedAt must be ISO-8601' });
  }
  if (issues.some((issue) => issue.path.startsWith(`${path}.`))) {
    return null;
  }
  return raw as unknown as GrpcCallHistoryRecord;
}

function validateHistoryEntry(
  raw: unknown,
  path: string,
  issues: GrpcPersistenceValidationIssue[],
): GrpcCallHistoryEntryV1 | null {
  if (!isPlainObject(raw)) {
    issues.push({ path, message: 'History entry must be an object' });
    return null;
  }

  if (!isNonEmptyString(raw.id)) issues.push({ path: `${path}.id`, message: 'id is required' });
  if (!isGrpcCallType(raw.callType)) issues.push({ path: `${path}.callType`, message: 'Invalid callType' });
  if (!isNonEmptyString(raw.target)) issues.push({ path: `${path}.target`, message: 'target is required' });
  if (!isNonEmptyString(raw.service)) issues.push({ path: `${path}.service`, message: 'service is required' });
  if (!isNonEmptyString(raw.method)) issues.push({ path: `${path}.method`, message: 'method is required' });
  if (!isNonEmptyString(raw.descriptorKey)) issues.push({ path: `${path}.descriptorKey`, message: 'descriptorKey is required' });
  if (!isIsoTimestamp(raw.capturedAt)) issues.push({ path: `${path}.capturedAt`, message: 'capturedAt must be ISO-8601' });
  if (typeof raw.bodyTruncated !== 'boolean') {
    issues.push({ path: `${path}.bodyTruncated`, message: 'bodyTruncated must be boolean' });
  }

  if (raw.grpcStatus !== undefined && (typeof raw.grpcStatus !== 'number' || !Number.isFinite(raw.grpcStatus))) {
    issues.push({ path: `${path}.grpcStatus`, message: 'grpcStatus must be a number when present' });
  }
  if (raw.durationMs !== undefined && (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs))) {
    issues.push({ path: `${path}.durationMs`, message: 'durationMs must be a number when present' });
  }

  const record = validateHistoryRecord(raw.record, `${path}.record`, issues);
  if (!record) return null;

  if (issues.some((issue) => issue.path.startsWith(`${path}.`))) {
    return null;
  }

  return {
    id: String(raw.id),
    callType: raw.callType as GrpcCallType,
    target: String(raw.target),
    service: String(raw.service),
    method: String(raw.method),
    descriptorKey: String(raw.descriptorKey),
    grpcStatus: typeof raw.grpcStatus === 'number' ? raw.grpcStatus : undefined,
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
    capturedAt: String(raw.capturedAt),
    bodyTruncated: Boolean(raw.bodyTruncated),
    record,
  };
}

export function validateGrpcCallHistoryStore(raw: unknown): GrpcPersistenceValidationResult {
  const issues: GrpcPersistenceValidationIssue[] = [];

  if (!isPlainObject(raw)) {
    return { ok: false, issues: [{ path: '', message: 'Root must be an object' }] };
  }

  if (raw.schemaVersion !== GRPC_PERSISTENCE_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `Expected schemaVersion ${GRPC_PERSISTENCE_SCHEMA_VERSION}`,
    });
  }

  if (!isIsoTimestamp(raw.updatedAt)) {
    issues.push({ path: 'updatedAt', message: 'updatedAt must be ISO-8601' });
  }

  const entries: GrpcCallHistoryEntryV1[] = [];
  if (!Array.isArray(raw.entries)) {
    issues.push({ path: 'entries', message: 'entries must be an array' });
  } else {
    if (raw.entries.length > GRPC_CALL_HISTORY_MAX_ENTRIES) {
      issues.push({
        path: 'entries',
        message: `entries exceeds max ${GRPC_CALL_HISTORY_MAX_ENTRIES}`,
      });
    }
    raw.entries.forEach((entry, index) => {
      const validated = validateHistoryEntry(entry, `entries[${index}]`, issues);
      if (validated) entries.push(validated);
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      entries,
      updatedAt: String(raw.updatedAt),
    },
  };
}

/** UTF-8 byte length estimate for JSON body truncation (Phase 5D uses same helper). */
export function measureGrpcJsonUtf8Bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Truncate history body snapshot when it exceeds the v1 cap.
 * Returns a shallow-cloned body with marker when truncated.
 */
export function truncateGrpcHistoryBodySnapshot(
  body: Record<string, unknown>,
  capBytes: number = GRPC_CALL_HISTORY_BODY_CAP_BYTES,
): { body: Record<string, unknown>; truncated: boolean } {
  if (measureGrpcJsonUtf8Bytes(body) <= capBytes) {
    return { body: structuredClone(body), truncated: false };
  }
  return {
    body: { _truncated: GRPC_HISTORY_BODY_TRUNCATED_MARKER },
    truncated: true,
  };
}

/** Extract gRPC status code from a redacted history record for filter UI (Phase 5D). */
export function extractGrpcHistoryStatusFromRecord(record: GrpcCallHistoryRecord): number | undefined {
  if (typeof record.result?.status === 'number') {
    return record.result.status;
  }
  const details = record.error?.details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const grpcStatus = (details as { grpcStatus?: unknown }).grpcStatus;
    if (typeof grpcStatus === 'number' && Number.isFinite(grpcStatus)) {
      return grpcStatus;
    }
  }
  return undefined;
}

/** Redact all saved requests in a collections envelope (persist/migrate boundary). */
export function sanitizeGrpcCollectionsStoreForPersist(
  store: GrpcCollectionsStoreV1,
): GrpcCollectionsStoreV1 {
  return {
    ...store,
    collections: store.collections.map((collection) => ({
      ...collection,
      savedRequests: collection.savedRequests.map((saved) => redactGrpcSavedRequestForPersist(saved)),
    })),
  };
}

/** Redact and cap body on a history record before building a persisted entry. */
export function prepareGrpcCallHistoryEntryForPersist(input: {
  id: string;
  snapshot: GrpcCallHistoryRecord['snapshot'];
  result?: GrpcCallHistoryRecord['result'];
  error?: GrpcCallHistoryRecord['error'];
  /** Preserve truncation marker when re-preparing an already-capped entry. */
  bodyTruncated?: boolean;
  /** Denormalized filter target when snapshot stores template form (Phase 9F). */
  filterTarget?: string;
}): GrpcCallHistoryEntryV1 {
  const record = prepareGrpcCallHistoryRecord(input);
  const { body, truncated } = truncateGrpcHistoryBodySnapshot(record.snapshot.body ?? {});
  if (truncated) {
    record.snapshot = {
      ...record.snapshot,
      body,
    };
  }
  return buildGrpcCallHistoryEntryV1({
    id: input.id,
    record,
    bodyTruncated: truncated || Boolean(input.bodyTruncated),
    filterTarget: input.filterTarget,
  });
}

/** Redact all history records in an envelope (persist/migrate boundary). */
export function sanitizeGrpcCallHistoryStoreForPersist(
  store: GrpcCallHistoryStoreV1,
): GrpcCallHistoryStoreV1 {
  return {
    ...store,
    entries: store.entries.map((entry) => prepareGrpcCallHistoryEntryForPersist({
      id: entry.id,
      snapshot: entry.record.snapshot,
      result: entry.record.result,
      error: entry.record.error,
      bodyTruncated: entry.bodyTruncated,
    })),
  };
}

/** Canonical write-boundary helper for collections (5B repository uses this before save). */
export function prepareGrpcCollectionsStoreForPersist(
  store: GrpcCollectionsStoreV1,
  now: string = new Date().toISOString(),
): GrpcCollectionsStoreV1 {
  return {
    ...sanitizeGrpcCollectionsStoreForPersist(store),
    updatedAt: now,
  };
}

/** Canonical write-boundary helper for call history (5D recorder uses this before save). */
export function prepareGrpcCallHistoryStoreForPersist(
  store: GrpcCallHistoryStoreV1,
  now: string = new Date().toISOString(),
): GrpcCallHistoryStoreV1 {
  return {
    ...sanitizeGrpcCallHistoryStoreForPersist(store),
    updatedAt: now,
  };
}

/** Build denormalized history entry from a redacted record (5D recorder uses this). */
export function buildGrpcCallHistoryEntryV1(input: {
  id: string;
  record: GrpcCallHistoryRecord;
  bodyTruncated: boolean;
  /** Denormalized filter target when snapshot stores template form (Phase 9F). */
  filterTarget?: string;
}): GrpcCallHistoryEntryV1 {
  const { snapshot } = input.record;
  return {
    id: input.id,
    callType: snapshot.callType,
    target: input.filterTarget ?? snapshot.target.address,
    service: snapshot.service,
    method: snapshot.method,
    descriptorKey: snapshot.descriptorKey,
    grpcStatus: extractGrpcHistoryStatusFromRecord(input.record),
    durationMs: input.record.result?.durationMs,
    capturedAt: input.record.capturedAt,
    bodyTruncated: input.bodyTruncated,
    record: input.record,
  };
}
