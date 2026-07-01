/**
 * Phase 5A — persistence schema validation tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  bumpGrpcSavedRequestRevision,
  buildGrpcCallHistoryEntryV1,
  createEmptyGrpcCallHistoryStore,
  createEmptyGrpcCollectionsStore,
  createGrpcSavedRequestIdentity,
  defaultGrpcSavedRequestName,
  extractGrpcHistoryStatusFromRecord,
  GRPC_CALL_HISTORY_BODY_CAP_BYTES,
  GRPC_CALL_HISTORY_MAX_ENTRIES,
  GRPC_COLLECTIONS_STORAGE_KEY,
  GRPC_CALL_HISTORY_STORAGE_KEY,
  GRPC_PERSISTENCE_SCHEMA_VERSION,
  measureGrpcJsonUtf8Bytes,
  prepareGrpcCallHistoryEntryForPersist,
  sanitizeGrpcCollectionsStoreForPersist,
  truncateGrpcHistoryBodySnapshot,
  validateGrpcCallHistoryStore,
  validateGrpcCollectionsStore,
  type GrpcCollectionV1,
} from './grpcPersistenceSchema';
import { GRPC_REDACTED_PLACEHOLDER, prepareGrpcCallHistoryRecord } from './grpcRedaction';
import type { GrpcSavedRequest } from './grpcSavedRequest';

const TS = '2026-06-29T12:00:00.000Z';

function makeSavedRequest(overrides: Partial<GrpcSavedRequest> = {}): GrpcSavedRequest {
  const identity = createGrpcSavedRequestIdentity('sr-1', TS);
  return {
    ...identity,
    name: 'Echo / Echo',
    callType: 'unary',
    service: 'echo.EchoService',
    method: 'Echo',
    descriptorKey: 'desc-1',
    body: { message: 'hi' },
    metadata: { 'x-test': '1' },
    timeoutMs: 30_000,
    ...overrides,
  };
}

function makeCollection(overrides: Partial<GrpcCollectionV1> = {}): GrpcCollectionV1 {
  return {
    id: 'col-1',
    name: 'Staging Echo',
    createdAt: TS,
    updatedAt: TS,
    savedRequests: [makeSavedRequest()],
    ...overrides,
  };
}

describe('grpcPersistenceSchema (Phase 5A)', () => {
  it('exports stable v1 storage keys', () => {
    expect(GRPC_COLLECTIONS_STORAGE_KEY).toBe('grpc_collections_v1');
    expect(GRPC_CALL_HISTORY_STORAGE_KEY).toBe('grpc_call_history_v1');
    expect(GRPC_PERSISTENCE_SCHEMA_VERSION).toBe(1);
  });

  it('createEmptyGrpcCollectionsStore returns valid v1 envelope', () => {
    const store = createEmptyGrpcCollectionsStore(TS);
    const result = validateGrpcCollectionsStore(store);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.collections).toEqual([]);
      expect(result.value.updatedAt).toBe(TS);
    }
  });

  it('validateGrpcCollectionsStore accepts a valid envelope', () => {
    const store = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [makeCollection()],
    };
    const result = validateGrpcCollectionsStore(store);
    expect(result.ok).toBe(true);
  });

  it('validateGrpcCollectionsStore accepts optional responseBaseline on saved requests (5I)', () => {
    const store = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [makeCollection({
        savedRequests: [makeSavedRequest({
          responseBaseline: {
            capturedAt: TS,
            grpcStatus: 0,
            statusMessage: 'OK',
            body: { message: 'hello' },
          },
        })],
      })],
    };
    expect(validateGrpcCollectionsStore(store).ok).toBe(true);
  });

  it('validateGrpcCollectionsStore rejects invalid responseBaseline (5I)', () => {
    const store = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [makeCollection({
        savedRequests: [makeSavedRequest({
          responseBaseline: {
            capturedAt: 'not-a-date',
            grpcStatus: 'zero',
            body: 'not-an-object',
          } as unknown as GrpcSavedRequest['responseBaseline'],
        })],
      })],
    };
    const result = validateGrpcCollectionsStore(store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path.includes('responseBaseline.grpcStatus'))).toBe(true);
      expect(result.issues.some((i) => i.path.includes('responseBaseline.capturedAt'))).toBe(true);
      expect(result.issues.some((i) => i.path.includes('responseBaseline.body'))).toBe(true);
    }
  });

  it('validateGrpcCollectionsStore rejects non-string responseBaseline.statusMessage (5I)', () => {
    const store = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [makeCollection({
        savedRequests: [makeSavedRequest({
          responseBaseline: {
            capturedAt: TS,
            grpcStatus: 0,
            statusMessage: 42,
            body: {},
          } as unknown as GrpcSavedRequest['responseBaseline'],
        })],
      })],
    };
    const result = validateGrpcCollectionsStore(store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path.includes('responseBaseline.statusMessage'))).toBe(true);
    }
  });

  it('validateGrpcCollectionsStore rejects missing required saved-request fields', () => {
    const store = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-1',
        name: 'Test',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [{
          id: 'sr-1',
          revisionId: 'rev-1',
          updatedAt: TS,
          callType: 'unary',
          service: 'echo.EchoService',
          method: 'Echo',
          descriptorKey: 'desc-1',
          body: {},
          metadata: {},
          timeoutMs: 30_000,
        }],
      }],
    };
    const result = validateGrpcCollectionsStore(store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path.includes('name'))).toBe(true);
      expect(result.issues.some((i) => i.path.includes('createdAt'))).toBe(true);
    }
  });

  it('createGrpcSavedRequestIdentity and bumpGrpcSavedRequestRevision preserve id/createdAt', () => {
    const created = createGrpcSavedRequestIdentity('sr-1', TS);
    expect(created.id).toBe('sr-1');
    expect(created.revisionId).toBeTruthy();
    expect(created.createdAt).toBe(TS);

    const bumped = bumpGrpcSavedRequestRevision(created, '2026-06-29T13:00:00.000Z');
    expect(bumped.id).toBe('sr-1');
    expect(bumped.createdAt).toBe(TS);
    expect(bumped.updatedAt).toBe('2026-06-29T13:00:00.000Z');
    expect(bumped.revisionId).not.toBe(created.revisionId);
  });

  it('defaultGrpcSavedRequestName uses service/method', () => {
    expect(defaultGrpcSavedRequestName('echo.EchoService', 'Echo')).toBe('echo.EchoService/Echo');
    expect(defaultGrpcSavedRequestName('', '')).toBe('UnknownService/UnknownMethod');
  });

  it('truncateGrpcHistoryBodySnapshot marks oversized bodies', () => {
    const largeBody: Record<string, unknown> = { payload: 'x'.repeat(GRPC_CALL_HISTORY_BODY_CAP_BYTES) };
    expect(measureGrpcJsonUtf8Bytes(largeBody)).toBeGreaterThan(GRPC_CALL_HISTORY_BODY_CAP_BYTES);

    const { body, truncated } = truncateGrpcHistoryBodySnapshot(largeBody);
    expect(truncated).toBe(true);
    expect(body._truncated).toBe('[TRUNCATED]');
  });

  it('buildGrpcCallHistoryEntryV1 denormalizes filter fields from redacted record', () => {
    const record = prepareGrpcCallHistoryRecord({
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: FIXTURE_UNARY_CALL_REQUEST.body ?? {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
      result: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        message: {},
        durationMs: 42,
      },
    });

    const entry = buildGrpcCallHistoryEntryV1({
      id: 'hist-1',
      record,
      bodyTruncated: false,
    });

    expect(entry.service).toBe(FIXTURE_UNARY_CALL_REQUEST.service);
    expect(entry.method).toBe(FIXTURE_UNARY_CALL_REQUEST.method);
    expect(entry.grpcStatus).toBe(0);
    expect(entry.durationMs).toBe(42);
  });

  it('buildGrpcCallHistoryEntryV1 uses filterTarget for denormalized row (Phase 9F)', () => {
    const record = prepareGrpcCallHistoryRecord({
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: { address: '{{grpcHost}}', tlsMode: 'disabled' },
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
    });

    const entry = buildGrpcCallHistoryEntryV1({
      id: 'hist-template',
      record,
      bodyTruncated: false,
      filterTarget: 'localhost:50051',
    });

    expect(entry.record.snapshot.target.address).toBe('{{grpcHost}}');
    expect(entry.target).toBe('localhost:50051');
  });

  it('extractGrpcHistoryStatusFromRecord reads status from error details', () => {
    const record = prepareGrpcCallHistoryRecord({
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
      error: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'denied',
        details: { grpcStatus: 7 },
      },
    });
    expect(extractGrpcHistoryStatusFromRecord(record)).toBe(7);
  });

  it('prepareGrpcCallHistoryEntryForPersist truncates oversized body snapshots', () => {
    const largeBody = { payload: 'x'.repeat(GRPC_CALL_HISTORY_BODY_CAP_BYTES) };
    const entry = prepareGrpcCallHistoryEntryForPersist({
      id: 'hist-large',
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: largeBody,
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
    });
    expect(entry.bodyTruncated).toBe(true);
    expect(entry.record.snapshot.body).toEqual({ _truncated: '[TRUNCATED]' });
  });

  it('prepareGrpcCallHistoryEntryForPersist preserves bodyTruncated on re-prepare', () => {
    const largeBody = { payload: 'x'.repeat(GRPC_CALL_HISTORY_BODY_CAP_BYTES) };
    const first = prepareGrpcCallHistoryEntryForPersist({
      id: 'hist-reprepare',
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: largeBody,
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
    });
    expect(first.bodyTruncated).toBe(true);

    const second = prepareGrpcCallHistoryEntryForPersist({
      id: first.id,
      snapshot: first.record.snapshot,
      result: first.record.result,
      error: first.record.error,
      bodyTruncated: first.bodyTruncated,
    });
    expect(second.bodyTruncated).toBe(true);
  });

  it('sanitizeGrpcCollectionsStoreForPersist redacts nested saved requests', () => {
    const store = createEmptyGrpcCollectionsStore(TS);
    store.collections = [{
      ...makeCollection(),
      savedRequests: [{
        ...makeSavedRequest(),
        auth: { type: 'bearer', bearerToken: 'must-redact' },
      }],
    }];
    const sanitized = sanitizeGrpcCollectionsStoreForPersist(store);
    expect(sanitized.collections[0].savedRequests[0].auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('validateGrpcCallHistoryStore rejects entries over max cap', () => {
    const entries = Array.from({ length: GRPC_CALL_HISTORY_MAX_ENTRIES + 1 }, (_, i) => ({
      id: `h-${i}`,
      callType: 'unary' as const,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      descriptorKey: 'desc-1',
      capturedAt: TS,
      bodyTruncated: false,
      record: prepareGrpcCallHistoryRecord({
        snapshot: {
          tabId: 'tab-1',
          requestId: `req-${i}`,
          capturedAt: TS,
          callType: 'unary',
          target: FIXTURE_UNARY_CALL_REQUEST.target,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          body: {},
          metadata: {},
          timeoutMs: 30_000,
          descriptorKey: 'desc-1',
        },
      }),
    }));

    const result = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries,
    });
    expect(result.ok).toBe(false);
  });

  it('createEmptyGrpcCallHistoryStore returns valid v1 envelope', () => {
    const store = createEmptyGrpcCallHistoryStore(TS);
    const result = validateGrpcCallHistoryStore(store);
    expect(result.ok).toBe(true);
  });
});
