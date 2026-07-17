/**
 * Phase 5E — safe serialization for UI previews (collections/history modals, copy).
 */
import type { GrpcTabExecuteSnapshot } from './contracts';
import type { GrpcCallHistoryEntryV1 } from './grpcPersistenceSchema';
import {
  buildGrpcCallHistoryEntryV1,
  type GrpcCallHistoryStoreV1,
  type GrpcCollectionsStoreV1,
} from './grpcPersistenceSchema';
import {
  prepareGrpcCallHistoryRecord,
  redactGrpcExecuteSnapshotForExport,
  redactGrpcStudioPayloadForConsumer,
} from './grpcRedaction';
import type { GrpcRedactionConsumer } from './grpcSecretPolicy';
import type { GrpcSavedRequest } from './grpcSavedRequest';
import { redactGrpcSavedRequestForPersist } from './grpcSavedRequest';

export type GrpcPreviewConsumer = Extract<
  GrpcRedactionConsumer,
  'clipboard_copy' | 'diagnostics' | 'toast_messages'
>;

const DEFAULT_PREVIEW_CONSUMER: GrpcPreviewConsumer = 'clipboard_copy';

/** Redact saved request fields for collection panel / modal display. */
export function previewGrpcSavedRequestForUi(
  saved: GrpcSavedRequest,
): GrpcSavedRequest {
  return redactGrpcSavedRequestForPersist(structuredClone(saved));
}

/** Redact execute snapshot for read-only preview surfaces. */
export function previewGrpcExecuteSnapshotForUi(
  snapshot: GrpcTabExecuteSnapshot,
): GrpcTabExecuteSnapshot {
  return redactGrpcExecuteSnapshotForExport(snapshot);
}

/** Re-redact history row defensively before rendering in UI. */
export function previewGrpcCallHistoryEntryForUi(
  entry: GrpcCallHistoryEntryV1,
): GrpcCallHistoryEntryV1 {
  const record = prepareGrpcCallHistoryRecord({
    snapshot: entry.record.snapshot,
    result: entry.record.result,
    error: entry.record.error,
  });
  return buildGrpcCallHistoryEntryV1({
    id: entry.id,
    record,
    bodyTruncated: entry.bodyTruncated,
  });
}

/** Pretty-print JSON for preview modals — input must already be redacted. */
export function serializeGrpcPreviewJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Redact tab-shaped payload fragments for toast/diagnostics/clipboard consumers. */
export function previewGrpcStudioPayloadForUi(
  payload: Parameters<typeof redactGrpcStudioPayloadForConsumer>[0],
  consumer: GrpcPreviewConsumer = DEFAULT_PREVIEW_CONSUMER,
): ReturnType<typeof redactGrpcStudioPayloadForConsumer> {
  return redactGrpcStudioPayloadForConsumer(payload, consumer);
}

/** Preview helper for entire collections store (read-only inspector). */
export function previewGrpcCollectionsStoreForUi(
  store: GrpcCollectionsStoreV1,
): GrpcCollectionsStoreV1 {
  return {
    ...store,
    collections: store.collections.map((collection) => ({
      ...collection,
      savedRequests: collection.savedRequests.map((saved) => previewGrpcSavedRequestForUi(saved)),
    })),
  };
}

/** Preview helper for history envelope (read-only inspector). */
export function previewGrpcCallHistoryStoreForUi(
  store: GrpcCallHistoryStoreV1,
): GrpcCallHistoryStoreV1 {
  return {
    ...store,
    entries: store.entries.map((entry) => previewGrpcCallHistoryEntryForUi(entry)),
  };
}
