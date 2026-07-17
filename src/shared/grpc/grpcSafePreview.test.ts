/**
 * Phase 5E — safe UI preview serialization tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  createEmptyGrpcCallHistoryStore,
  createEmptyGrpcCollectionsStore,
  prepareGrpcCallHistoryEntryForPersist,
} from './grpcPersistenceSchema';
import {
  previewGrpcCallHistoryEntryForUi,
  previewGrpcCallHistoryStoreForUi,
  previewGrpcCollectionsStoreForUi,
  previewGrpcExecuteSnapshotForUi,
  previewGrpcSavedRequestForUi,
  previewGrpcStudioPayloadForUi,
  serializeGrpcPreviewJson,
} from './grpcSafePreview';
import { createGrpcSavedRequestFromSnapshot } from './grpcSavedRequest';

const TS = '2026-06-29T12:00:00.000Z';
const VALID_PEM = `-----BEGIN CERTIFICATE-----
LEAKED-CA
-----END CERTIFICATE-----`;

const RAW_SNAPSHOT = {
  tabId: 'tab-1',
  requestId: 'req-1',
  capturedAt: TS,
  callType: 'unary' as const,
  target: {
    address: 'localhost:50051',
    tlsMode: 'tls' as const,
    tlsConfig: { serverCaPem: VALID_PEM },
  },
  service: FIXTURE_UNARY_CALL_REQUEST.service,
  method: FIXTURE_UNARY_CALL_REQUEST.method,
  body: { message: 'hi' },
  metadata: { authorization: 'Bearer super-secret-token-value' },
  timeoutMs: 30_000,
  descriptorKey: 'desc-1',
  auth: { type: 'bearer' as const, bearerToken: 'super-secret-token-value' },
};

describe('grpcSafePreview (Phase 5E)', () => {
  it('previewGrpcSavedRequestForUi redacts auth and tls fields', () => {
    const saved = createGrpcSavedRequestFromSnapshot(RAW_SNAPSHOT, {
      id: 'sr-1',
      revisionId: 'rev-1',
      updatedAt: TS,
    });
    saved.auth!.bearerToken = 'ui-preview-leak';
    saved.tlsConfig = { serverCaPem: VALID_PEM };

    const preview = previewGrpcSavedRequestForUi(saved);
    expect(preview.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(preview.tlsConfig?.serverCaPem).toBe('[REDACTED_PEM]');
  });

  it('previewGrpcExecuteSnapshotForUi redacts execute snapshot', () => {
    const preview = previewGrpcExecuteSnapshotForUi(RAW_SNAPSHOT);
    expect(preview.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(preview.metadata.authorization).not.toContain('super-secret');
  });

  it('previewGrpcCallHistoryEntryForUi re-redacts history rows', () => {
    const entry = prepareGrpcCallHistoryEntryForPersist({
      id: 'hist-ui',
      snapshot: RAW_SNAPSHOT,
    });
    entry.record.snapshot.auth!.bearerToken = 'history-ui-leak';

    const preview = previewGrpcCallHistoryEntryForUi(entry);
    expect(preview.record.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('previewGrpcCollectionsStoreForUi and previewGrpcCallHistoryStoreForUi redact nested rows', () => {
    const saved = createGrpcSavedRequestFromSnapshot(RAW_SNAPSHOT, {
      id: 'sr-store',
      revisionId: 'rev-store',
      updatedAt: TS,
    });
    saved.auth!.bearerToken = 'collection-store-leak';

    const collections = previewGrpcCollectionsStoreForUi({
      ...createEmptyGrpcCollectionsStore(),
      updatedAt: TS,
      collections: [{
        id: 'col-1',
        name: 'Preview',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [saved],
      }],
    });
    expect(collections.collections[0].savedRequests[0].auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);

    const entry = prepareGrpcCallHistoryEntryForPersist({ id: 'h-1', snapshot: RAW_SNAPSHOT });
    entry.record.snapshot.auth!.bearerToken = 'history-store-leak';
    const history = previewGrpcCallHistoryStoreForUi({
      ...createEmptyGrpcCallHistoryStore(),
      updatedAt: TS,
      entries: [entry],
    });
    expect(history.entries[0].record.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('serializeGrpcPreviewJson pretty-prints redacted payloads', () => {
    const preview = previewGrpcExecuteSnapshotForUi(RAW_SNAPSHOT);
    const json = serializeGrpcPreviewJson(preview);
    expect(json).toContain('\n');
    expect(json).toContain(GRPC_REDACTED_PLACEHOLDER);
    expect(json).not.toContain('super-secret-token-value');
  });

  it('previewGrpcStudioPayloadForUi respects consumer redaction', () => {
    const preview = previewGrpcStudioPayloadForUi({
      metadata: { authorization: 'Bearer super-secret-token-value' },
      auth: { type: 'bearer', bearerToken: 'super-secret-token-value' },
    }, 'clipboard_copy');
    expect(preview.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });
});
