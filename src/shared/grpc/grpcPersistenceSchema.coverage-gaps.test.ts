import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  bumpGrpcSavedRequestRevision,
  buildGrpcCallHistoryEntryV1,
  createEmptyGrpcCallHistoryStore,
  createEmptyGrpcCollectionsStore,
  createGrpcSavedRequestIdentity,
  extractGrpcHistoryStatusFromRecord,
  GRPC_PERSISTENCE_SCHEMA_VERSION,
  measureGrpcJsonUtf8Bytes,
  prepareGrpcCallHistoryEntryForPersist,
  prepareGrpcCallHistoryStoreForPersist,
  prepareGrpcCollectionsStoreForPersist,
  sanitizeGrpcCallHistoryStoreForPersist,
  sanitizeGrpcCollectionsStoreForPersist,
  truncateGrpcHistoryBodySnapshot,
  validateGrpcCallHistoryStore,
  validateGrpcCollectionsStore,
} from './grpcPersistenceSchema';
import { prepareGrpcCallHistoryRecord } from './grpcRedaction';
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

describe('grpcPersistenceSchema coverage gaps', () => {
  it('bumpGrpcSavedRequestRevision keeps id and createdAt stable', () => {
    const prior = createGrpcSavedRequestIdentity('sr-1', TS);
    const bumped = bumpGrpcSavedRequestRevision(prior, '2026-07-01T00:00:00.000Z');
    expect(bumped.id).toBe('sr-1');
    expect(bumped.createdAt).toBe(TS);
    expect(bumped.revisionId).not.toBe(prior.revisionId);
    expect(bumped.updatedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('validateGrpcCollectionsStore rejects duplicate collection ids', () => {
    const saved = makeSavedRequest();
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [
        { id: 'col-dup', name: 'A', createdAt: TS, updatedAt: TS, savedRequests: [saved] },
        { id: 'col-dup', name: 'B', createdAt: TS, updatedAt: TS, savedRequests: [] },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('validateGrpcCollectionsStore rejects duplicate saved request ids across collections', () => {
    const saved = makeSavedRequest({ id: 'shared-saved' });
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [
        { id: 'col-1', name: 'A', createdAt: TS, updatedAt: TS, savedRequests: [saved] },
        { id: 'col-2', name: 'B', createdAt: TS, updatedAt: TS, savedRequests: [saved] },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('validateGrpcCollectionsStore validates saved request responseBaseline and runStats', () => {
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-1',
        name: 'A',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [{
          ...makeSavedRequest(),
          responseBaseline: {
            grpcStatus: 'bad' as unknown as number,
            capturedAt: 'not-a-date',
            body: {},
          },
          runStats: {
            totalRuns: -1,
            successRuns: 0,
            errorRuns: 0,
            lastRunAt: 'not-a-date',
            lastGrpcStatus: 'bad' as unknown as number,
            lastDurationMs: -5,
          },
          tlsMode: 'invalid' as 'disabled',
        }],
      }],
    });
    expect(result.ok).toBe(false);
  });

  it('truncateGrpcHistoryBodySnapshot replaces oversized bodies with marker', () => {
    const largeBody = { payload: 'x'.repeat(70_000) };
    expect(measureGrpcJsonUtf8Bytes(largeBody)).toBeGreaterThan(64 * 1024);
    const truncated = truncateGrpcHistoryBodySnapshot(largeBody);
    expect(truncated.truncated).toBe(true);
    expect(truncated.body).toEqual({ _truncated: '[TRUNCATED]' });
  });

  it('extractGrpcHistoryStatusFromRecord reads grpcStatus from error details', () => {
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
        message: 'failed',
        details: { grpcStatus: 14 },
      },
    });
    expect(extractGrpcHistoryStatusFromRecord(record)).toBe(14);
  });

  it('prepareGrpcCallHistoryEntryForPersist preserves filterTarget and bodyTruncated flag', () => {
    const entry = prepareGrpcCallHistoryEntryForPersist({
      id: 'hist-1',
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
      filterTarget: 'localhost:50051',
      bodyTruncated: true,
    });
    expect(entry.target).toBe('localhost:50051');
    expect(entry.bodyTruncated).toBe(true);
  });

  it('prepareGrpcCollectionsStoreForPersist and history store helpers stamp updatedAt', () => {
    const collections = prepareGrpcCollectionsStoreForPersist({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [],
    }, '2026-07-01T00:00:00.000Z');
    expect(collections.updatedAt).toBe('2026-07-01T00:00:00.000Z');

    const entry = buildGrpcCallHistoryEntryV1({
      id: 'hist-1',
      bodyTruncated: false,
      record: prepareGrpcCallHistoryRecord({
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
      }),
    });
    const history = prepareGrpcCallHistoryStoreForPersist({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [entry],
    }, '2026-07-01T00:00:01.000Z');
    expect(history.updatedAt).toBe('2026-07-01T00:00:01.000Z');
    expect(sanitizeGrpcCallHistoryStoreForPersist(history).entries).toHaveLength(1);
  });

  it('validateGrpcCallHistoryStore rejects invalid grpcStatus and durationMs', () => {
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
    });
    const result = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        id: 'hist-1',
        callType: 'unary',
        target: 'localhost:50051',
        service: 'svc',
        method: 'M',
        descriptorKey: 'desc-1',
        capturedAt: TS,
        bodyTruncated: false,
        grpcStatus: 'bad' as unknown as number,
        durationMs: 'slow' as unknown as number,
        record,
      }],
    });
    expect(result.ok).toBe(false);
  });

  it('validateGrpcCollectionsStore rejects non-object roots and bad schemaVersion', () => {
    expect(validateGrpcCollectionsStore(null).ok).toBe(false);
    expect(validateGrpcCollectionsStore({
      schemaVersion: 2,
      updatedAt: TS,
      collections: [],
    }).ok).toBe(false);
  });

  it('validateGrpcCallHistoryStore rejects oversize entry arrays', () => {
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
    });
    const entries = Array.from({ length: 201 }, (_, index) => ({
      id: `hist-${index}`,
      callType: 'unary' as const,
      target: 'localhost:50051',
      service: 'svc',
      method: 'M',
      descriptorKey: 'desc-1',
      capturedAt: TS,
      bodyTruncated: false,
      record,
    }));
    expect(validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries,
    }).ok).toBe(false);
  });

  it('extractGrpcHistoryStatusFromRecord prefers result.status', () => {
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
      result: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        durationMs: 10,
      },
    });
    expect(extractGrpcHistoryStatusFromRecord(record)).toBe(0);
  });

  it('validateGrpcCollectionsStore accepts valid collections and prepare helpers redact', () => {
    const saved = makeSavedRequest({
      callType: 'server_stream',
      responseBaseline: {
        grpcStatus: 0,
        capturedAt: TS,
        body: { message: 'ok' },
      },
      runStats: {
        totalRuns: 1,
        successRuns: 1,
        errorRuns: 0,
        lastRunAt: TS,
        lastGrpcStatus: 0,
        lastDurationMs: 12,
      },
      tlsMode: 'disabled',
    });
    const store = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-valid',
        name: 'Valid',
        createdAt: TS,
        updatedAt: TS,
        defaultTarget: '{{grpcHost}}',
        defaultDescriptorKey: 'desc-1',
        savedRequests: [saved],
      }],
    };
    expect(validateGrpcCollectionsStore(store).ok).toBe(true);
    const prepared = prepareGrpcCollectionsStoreForPersist(store, TS);
    expect(prepared.updatedAt).toBe(TS);
    expect(prepared.collections[0]?.savedRequests[0]?.id).toBe(saved.id);
  });

  it('truncateGrpcHistoryBodySnapshot and measureGrpcJsonUtf8Bytes handle caps', () => {
    const small = truncateGrpcHistoryBodySnapshot({ message: 'hi' }, 1024);
    expect(small.truncated).toBe(false);
    expect(measureGrpcJsonUtf8Bytes({ x: 1 })).toBeGreaterThan(0);
    const large = truncateGrpcHistoryBodySnapshot({ blob: 'x'.repeat(80_000) }, 1024);
    expect(large.truncated).toBe(true);
  });

  it('buildGrpcCallHistoryEntryV1 and prepareGrpcCallHistoryEntryForPersist denormalize rows', () => {
    const entry = prepareGrpcCallHistoryEntryForPersist({
      id: 'hist-build',
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hi' },
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
        durationMs: 15,
      },
      filterTarget: 'localhost:50051',
    });
    expect(entry.target).toBe('localhost:50051');
    expect(entry.grpcStatus).toBe(0);
    expect(buildGrpcCallHistoryEntryV1({
      id: 'hist-2',
      bodyTruncated: false,
      record: entry.record,
    }).method).toBe(FIXTURE_UNARY_CALL_REQUEST.method);
  });

  it('extractGrpcHistoryStatusFromRecord reads error.details.grpcStatus', () => {
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
        message: 'fail',
        details: { grpcStatus: 14 },
      },
    });
    expect(extractGrpcHistoryStatusFromRecord(record)).toBe(14);
  });

  it('validateGrpcCallHistoryStore accepts valid rows and prepare helper updates timestamp', () => {
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
    });
    const store = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        id: 'hist-valid',
        callType: 'unary' as const,
        target: 'localhost:50051',
        service: 'svc',
        method: 'M',
        descriptorKey: 'desc-1',
        capturedAt: TS,
        bodyTruncated: false,
        record,
      }],
    };
    expect(validateGrpcCallHistoryStore(store).ok).toBe(true);
    const prepared = prepareGrpcCallHistoryStoreForPersist(store, TS);
    expect(prepared.updatedAt).toBe(TS);
    expect(sanitizeGrpcCallHistoryStoreForPersist(store).entries).toHaveLength(1);
  });

  it('validateGrpcCollectionsStore rejects invalid collection entries and savedRequests type', () => {
    expect(validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{ id: '', name: '', createdAt: 'bad', updatedAt: 'bad', savedRequests: 'nope' }],
    }).ok).toBe(false);
  });

  it('createEmpty persistence stores default timestamps', () => {
    expect(createEmptyGrpcCollectionsStore().collections).toEqual([]);
    expect(createEmptyGrpcCallHistoryStore('2026-07-01T00:00:00.000Z').updatedAt)
      .toBe('2026-07-01T00:00:00.000Z');
  });

  it('validateGrpcCollectionsStore accepts additional call types and tls modes', () => {
    const saved = makeSavedRequest({
      callType: 'client_stream',
      tlsMode: 'tls',
      responseBaseline: {
        grpcStatus: 0,
        capturedAt: TS,
        statusMessage: 'OK',
        body: {},
      },
      runStats: {
        totalRuns: 1,
        successRuns: 1,
        errorRuns: 0,
        lastRunAt: TS,
        lastGrpcStatus: 0,
        lastDurationMs: 10,
      },
    });
    expect(validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-stream',
        name: 'Stream',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [saved],
      }],
    }).ok).toBe(true);
  });

  it('validateGrpcCollectionsStore rejects duplicate saved request ids within a collection', () => {
    const saved = makeSavedRequest({ id: 'dup-in-col' });
    expect(validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-dup-saved',
        name: 'Dup saved',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [saved, saved],
      }],
    }).ok).toBe(false);
  });

  it('validateGrpcCollectionsStore rejects invalid saved request shapes', () => {
    expect(validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-bad-saved',
        name: 'Bad saved',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [{
          id: 'bad',
          name: 'Bad',
          revisionId: 'rev',
          createdAt: TS,
          updatedAt: TS,
          callType: 'invalid',
          service: 'svc',
          method: 'M',
          descriptorKey: 'desc',
          body: 'not-object',
          metadata: [],
          timeoutMs: 0,
        }],
      }],
    }).ok).toBe(false);
  });

  it('sanitizeGrpcCollectionsStoreForPersist redacts saved requests', () => {
    const saved = makeSavedRequest({
      auth: { type: 'bearer', bearerToken: 'secret-token' },
    });
    const sanitized = sanitizeGrpcCollectionsStoreForPersist({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-redact',
        name: 'Redact',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [saved],
      }],
    });
    expect(sanitized.collections[0]?.savedRequests[0]?.auth?.type).toBe('bearer');
    expect(JSON.stringify(sanitized)).not.toContain('secret-token');
  });

  it('extractGrpcHistoryStatusFromRecord returns undefined without status fields', () => {
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
    });
    expect(extractGrpcHistoryStatusFromRecord(record)).toBeUndefined();
  });

  it('prepareGrpcCollectionsStoreForPersist uses default now when omitted', () => {
    const prepared = prepareGrpcCollectionsStoreForPersist({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [],
    });
    expect(prepared.updatedAt).toBeTruthy();
  });

  it('validateGrpcCallHistoryStore rejects invalid roots, schema versions, and entry shapes', () => {
    expect(validateGrpcCallHistoryStore(null).ok).toBe(false);
    expect(validateGrpcCallHistoryStore({
      schemaVersion: 2,
      updatedAt: TS,
      entries: [],
    }).ok).toBe(false);
    expect(validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: 'bad-date',
      entries: 'not-array',
    }).ok).toBe(false);
    expect(validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        id: '',
        callType: 'invalid',
        target: '',
        service: '',
        method: '',
        descriptorKey: '',
        capturedAt: 'bad',
        bodyTruncated: 'no',
        record: null,
      }],
    }).ok).toBe(false);
  });

  it('validateGrpcCollectionsStore rejects non-object collections and invalid saved request records', () => {
    expect(validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [null],
    }).ok).toBe(false);
    expect(validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-bad-record',
        name: 'Bad record',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [{
          ...makeSavedRequest(),
          responseBaseline: 'bad',
        }],
      }],
    }).ok).toBe(false);
  });

  it('validateGrpcCollectionsStore accepts bidi_stream and mtls saved requests', () => {
    const saved = makeSavedRequest({
      callType: 'bidi_stream',
      tlsMode: 'mtls',
      tlsConfig: { caCertPem: 'pem', clientCertPem: 'cert', clientKeyPem: 'key' },
    });
    expect(validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-bidi',
        name: 'Bidi',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [saved],
      }],
    }).ok).toBe(true);
  });

  it('sanitizeGrpcCallHistoryStoreForPersist rebuilds entries through prepare helper', () => {
    const record = prepareGrpcCallHistoryRecord({
      snapshot: {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
      },
    });
    const sanitized = sanitizeGrpcCallHistoryStoreForPersist({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        id: 'hist-sanitize',
        callType: 'unary',
        target: 'localhost:50051',
        service: 'svc',
        method: 'M',
        descriptorKey: 'desc-1',
        capturedAt: TS,
        bodyTruncated: false,
        record,
      }],
    });
    expect(sanitized.entries[0]?.record.snapshot.body).toBeTruthy();
  });
});
