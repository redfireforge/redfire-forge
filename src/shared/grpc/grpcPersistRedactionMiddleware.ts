/**
 * Phase 5E — persist/export redaction middleware (leak scan at every write boundary).
 *
 * Wraps Phase 5A prepare helpers and Phase 4E leak scanner so collections, history,
 * and export bundles cannot reach storage with raw secrets.
 */
import {
  prepareGrpcCallHistoryEntryForPersist,
  prepareGrpcCallHistoryStoreForPersist,
  prepareGrpcCollectionsStoreForPersist,
  type GrpcCallHistoryEntryV1,
  type GrpcCallHistoryStoreV1,
  type GrpcCollectionsStoreV1,
} from './grpcPersistenceSchema';
import {
  GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS,
} from './grpcSecretPolicy';
import {
  assertNoGrpcSecretLeakage,
  scanForbiddenGrpcPersistTargets,
} from './grpcSecretLeakScan';
import { assertGrpcSavedRequestPortable } from './grpcReplayTemplateCompatibility';
import type { GrpcSavedRequest } from './grpcSavedRequest';
import { redactGrpcSavedRequestForPersist } from './grpcSavedRequest';
import {
  assertGrpcSavedRequestTemplatePersistSafe,
  type GrpcInterpolationTemplateSource,
} from './grpcInterpolationPersistGuard';

export type GrpcPersistTarget = (typeof GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS)[number];

/** Throw when serialized payload contains raw secret material for a forbidden target. */
export function assertGrpcPersistTargetSafe(
  target: GrpcPersistTarget,
  payload: unknown,
): void {
  assertNoGrpcSecretLeakage(payload, target);
}

/** Scan all forbidden persist targets present in a payloads map (test + diagnostics). */
export function scanGrpcPersistPayloadsForLeakage(
  payloadsByTarget: Partial<Record<GrpcPersistTarget, unknown>>,
) {
  return scanForbiddenGrpcPersistTargets(payloadsByTarget as Record<string, unknown>);
}

/** Redact + template-guard + leak-scan a saved request before collection write. */
export function prepareGrpcSavedRequestForPersistSafe(
  saved: GrpcSavedRequest,
  templateSource?: GrpcInterpolationTemplateSource,
): GrpcSavedRequest {
  const prepared = redactGrpcSavedRequestForPersist(saved, templateSource);
  assertGrpcSavedRequestTemplatePersistSafe(prepared, templateSource);
  assertGrpcSavedRequestPortable(prepared);
  assertGrpcPersistTargetSafe('grpc_collections_v1', {
    schemaVersion: 1,
    updatedAt: prepared.updatedAt,
    collections: [{ id: 'probe', name: 'probe', createdAt: prepared.createdAt, updatedAt: prepared.updatedAt, savedRequests: [prepared] }],
  });
  return prepared;
}

/** Redact + leak-scan collections store before Tauri/IDB/localStorage write. */
export function prepareGrpcCollectionsStoreForPersistSafe(
  store: GrpcCollectionsStoreV1,
  now?: string,
): GrpcCollectionsStoreV1 {
  const prepared = prepareGrpcCollectionsStoreForPersist(store, now);
  for (const collection of prepared.collections) {
    for (const saved of collection.savedRequests) {
      assertGrpcSavedRequestPortable(saved);
    }
  }
  assertGrpcPersistTargetSafe('grpc_collections_v1', prepared);
  return prepared;
}

/** Redact + cap + leak-scan a single history entry before append. */
export function prepareGrpcCallHistoryEntryForPersistSafe(
  input: Parameters<typeof prepareGrpcCallHistoryEntryForPersist>[0],
): GrpcCallHistoryEntryV1 {
  const entry = prepareGrpcCallHistoryEntryForPersist(input);
  assertGrpcPersistTargetSafe('grpc_call_history_v1', {
    schemaVersion: 1,
    updatedAt: entry.capturedAt,
    entries: [entry],
  });
  return entry;
}

/** Redact + leak-scan full history envelope before bulk save. */
export function prepareGrpcCallHistoryStoreForPersistSafe(
  store: GrpcCallHistoryStoreV1,
  now?: string,
): GrpcCallHistoryStoreV1 {
  const prepared = prepareGrpcCallHistoryStoreForPersist(store, now);
  assertGrpcPersistTargetSafe('grpc_call_history_v1', prepared);
  return prepared;
}

/** Leak-scan an already-prepared history entry at IDB/Tauri append boundary. */
export function assertGrpcCallHistoryEntryPersistSafe(entry: GrpcCallHistoryEntryV1): void {
  assertGrpcPersistTargetSafe('grpc_call_history_v1', {
    schemaVersion: 1,
    updatedAt: entry.capturedAt,
    entries: [entry],
  });
}

/** Re-redact + re-cap an existing history row for IDB/Tauri/sync write paths. */
export function reprepareGrpcCallHistoryEntryForPersistSafe(
  entry: GrpcCallHistoryEntryV1,
): GrpcCallHistoryEntryV1 {
  return prepareGrpcCallHistoryEntryForPersistSafe({
    id: entry.id,
    snapshot: entry.record.snapshot,
    result: entry.record.result,
    error: entry.record.error,
    bodyTruncated: entry.bodyTruncated,
    filterTarget: entry.target,
  });
}

/** Cross-feature export bundles (workflow/harness/grpc export/call history prep). */
export function assertGrpcCrossFeatureExportSafe(
  payload: Record<string, unknown>,
  context: string,
): void {
  assertNoGrpcSecretLeakage(payload, context);
  for (const forbiddenKey of GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS) {
    if (Object.prototype.hasOwnProperty.call(payload, forbiddenKey)) {
      assertNoGrpcSecretLeakage(payload[forbiddenKey], forbiddenKey);
    }
  }
}

