/**
 * Phase 5A — persistence schema/migration coverage gaps.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  migrateGrpcCallHistoryStore,
  migrateGrpcCollectionsStore,
} from './grpcPersistenceMigration';
import {
  GRPC_PERSISTENCE_SCHEMA_VERSION,
  prepareGrpcCallHistoryStoreForPersist,
  prepareGrpcCollectionsStoreForPersist,
  truncateGrpcHistoryBodySnapshot,
  validateGrpcCallHistoryStore,
  validateGrpcCollectionsStore,
  type GrpcCollectionV1,
} from './grpcPersistenceSchema';
import { GRPC_REDACTED_PLACEHOLDER, prepareGrpcCallHistoryRecord } from './grpcRedaction';
import type { GrpcSavedRequest } from './grpcSavedRequest';

const TS = '2026-06-29T12:00:00.000Z';

function makeSavedRequest(): GrpcSavedRequest {
  return {
    id: 'sr-1',
    name: 'Echo / Echo',
    revisionId: 'rev-1',
    createdAt: TS,
    updatedAt: TS,
    callType: 'unary',
    service: 'echo.EchoService',
    method: 'Echo',
    descriptorKey: 'desc-1',
    body: {},
    metadata: {},
    timeoutMs: 30_000,
  };
}

function makeCollection(): GrpcCollectionV1 {
  return {
    id: 'col-1',
    name: 'Test',
    createdAt: TS,
    updatedAt: TS,
    savedRequests: [makeSavedRequest()],
  };
}

function makeHistoryEntry(id: string) {
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
  return {
    id,
    callType: 'unary' as const,
    target: 'localhost:50051',
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    descriptorKey: 'desc-1',
    grpcStatus: 0,
    durationMs: 12,
    capturedAt: TS,
    bodyTruncated: false,
    record,
  };
}

describe('grpcPersistence coverage gaps (Phase 5A)', () => {
  it('validateGrpcCollectionsStore rejects non-object root and wrong schemaVersion', () => {
    expect(validateGrpcCollectionsStore(null).ok).toBe(false);
    expect(validateGrpcCollectionsStore([]).ok).toBe(false);
    const badVersion = validateGrpcCollectionsStore({
      schemaVersion: 99,
      updatedAt: TS,
      collections: [],
    });
    expect(badVersion.ok).toBe(false);
  });

  it('validateGrpcCollectionsStore rejects invalid collection and saved-request shapes', () => {
    const missingCollectionFields = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{}],
    });
    expect(missingCollectionFields.ok).toBe(false);

    const badSavedRequests = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'c1',
        name: 'n',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: 'not-array',
      }],
    });
    expect(badSavedRequests.ok).toBe(false);

    const invalidSavedRequest = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'c1',
        name: 'n',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [{
          id: 'sr-1',
          name: 'n',
          revisionId: 'r',
          createdAt: TS,
          updatedAt: TS,
          callType: 'bad-type',
          service: 's',
          method: 'm',
          descriptorKey: 'd',
          body: 'not-object',
          metadata: {},
          timeoutMs: 30_000,
        }],
      }],
    });
    expect(invalidSavedRequest.ok).toBe(false);
  });

  it('validateGrpcCallHistoryStore accepts valid entry and rejects bad grpcStatus/durationMs', () => {
    const valid = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [makeHistoryEntry('h-1')],
    });
    expect(valid.ok).toBe(true);

    const badMetrics = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        ...makeHistoryEntry('h-2'),
        grpcStatus: 'zero',
        durationMs: NaN,
      }],
    });
    expect(badMetrics.ok).toBe(false);
  });

  it('validateGrpcCallHistoryStore rejects invalid entry fields', () => {
    expect(validateGrpcCallHistoryStore(null).ok).toBe(false);
    const bad = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        id: '',
        callType: 'invalid',
        target: '',
        service: '',
        method: '',
        descriptorKey: '',
        capturedAt: 'not-a-date',
        bodyTruncated: 'no',
        record: {},
      }],
    });
    expect(bad.ok).toBe(false);
  });

  it('truncateGrpcHistoryBodySnapshot returns clone when under cap', () => {
    const body = { message: 'small' };
    const { body: out, truncated } = truncateGrpcHistoryBodySnapshot(body);
    expect(truncated).toBe(false);
    expect(out).toEqual(body);
    expect(out).not.toBe(body);
  });

  it('migrateGrpcCollectionsStore returns validated v1 envelope unchanged', () => {
    const input = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [makeCollection()],
    };
    const migrated = migrateGrpcCollectionsStore(input);
    expect(migrated).toEqual(input);
  });

  it('migrateGrpcCollectionsStore migrates legacy items[] root key', () => {
    const migrated = migrateGrpcCollectionsStore({
      items: [{
        id: 'col-legacy',
        name: 'Legacy',
        requests: [makeSavedRequest()],
      }],
    });
    expect(migrated.collections).toHaveLength(1);
    expect(migrated.collections[0].id).toBe('col-legacy');
  });

  it('migrateGrpcCollectionsStore returns empty for unrecognizable object', () => {
    const migrated = migrateGrpcCollectionsStore({ foo: 'bar' });
    expect(migrated.collections).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore accepts valid v1 envelope', () => {
    const migrated = migrateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [],
    });
    expect(migrated.entries).toEqual([]);
    expect(migrated.updatedAt).toBe(TS);
  });

  it('migrateGrpcCallHistoryStore migrates legacy entries envelope', () => {
    const migrated = migrateGrpcCallHistoryStore({
      entries: [makeHistoryEntry('hist-legacy')],
    });
    expect(migrated.entries).toHaveLength(1);
    expect(migrated.entries[0].id).toBe('hist-legacy');
  });

  it('migrateGrpcCollectionsStore returns empty for primitive payload', () => {
    expect(migrateGrpcCollectionsStore(42).collections).toEqual([]);
  });

  it('validateGrpcCallHistoryStore rejects record without snapshot', () => {
    const result = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        ...makeHistoryEntry('h-bad'),
        record: { capturedAt: TS },
      }],
    });
    expect(result.ok).toBe(false);
  });

  it('migrateGrpcCollectionsStore preserves optional saved-request fields from legacy data', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-opt',
      name: 'Optional fields',
      savedRequests: [{
        id: 'sr-opt',
        revisionId: 'rev-opt',
        createdAt: TS,
        updatedAt: TS,
        name: 'Custom name',
        callType: 'server_stream',
        target: 'host:50051',
        connectionId: 'conn-1',
        tlsMode: 'mtls',
        tlsConfig: { serverNameOverride: 'override.example.com' },
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: { n: 1 },
        metadata: { 'x-a': 'b' },
        timeoutMs: 5000,
        auth: { type: 'none' },
        notes: 'saved notes',
      }],
    }]);

    const saved = migrated.collections[0].savedRequests[0];
    expect(saved.name).toBe('Custom name');
    expect(saved.callType).toBe('server_stream');
    expect(saved.connectionId).toBe('conn-1');
    expect(saved.tlsMode).toBe('mtls');
    expect(saved.notes).toBe('saved notes');
  });

  it('validateGrpcCollectionsStore accepts optional collection defaults', () => {
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'c1',
        name: 'n',
        createdAt: TS,
        updatedAt: TS,
        defaultTarget: '{{grpcHost}}',
        defaultDescriptorKey: 'desc-default',
        savedRequests: [],
      }],
    });
    expect(result.ok).toBe(true);
  });

  it('validateGrpcCollectionsStore rejects invalid saved-request metadata and timeout', () => {
    const badMetadata = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'c1',
        name: 'n',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [{
          ...makeSavedRequest(),
          metadata: 'bad',
        }],
      }],
    });
    expect(badMetadata.ok).toBe(false);

    const badTimeout = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'c1',
        name: 'n',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [{
          ...makeSavedRequest(),
          timeoutMs: 0,
        }],
      }],
    });
    expect(badTimeout.ok).toBe(false);
  });

  it('validateGrpcCallHistoryStore rejects non-array entries', () => {
    const result = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: {},
    });
    expect(result.ok).toBe(false);
  });

  it('validateGrpcCollectionsStore rejects bad root updatedAt', () => {
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: 'not-a-date',
      collections: [],
    });
    expect(result.ok).toBe(false);
  });

  it('migrateGrpcCollectionsStore filters invalid legacy saved requests', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-filter',
      name: 'Filter',
      savedRequests: [{ id: 'only-id' }],
    }]);
    expect(migrated.collections[0].savedRequests).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore skips legacy entries with invalid callType', () => {
    const entry = makeHistoryEntry('bad-ct');
    const migrated = migrateGrpcCallHistoryStore([{
      ...entry,
      callType: 'not-a-stream',
      record: {
        ...entry.record,
        snapshot: {
          ...entry.record.snapshot,
          callType: 'not-a-stream' as never,
        },
      },
    }]);
    expect(migrated.entries).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore skips entries missing id or record', () => {
    expect(migrateGrpcCallHistoryStore([{ record: {} }]).entries).toEqual([]);
    expect(migrateGrpcCallHistoryStore(['not-object']).entries).toEqual([]);
  });

  it('migrateGrpcCollectionsStore skips non-object collection rows', () => {
    const migrated = migrateGrpcCollectionsStore([null, 'bad', makeCollection()]);
    expect(migrated.collections).toHaveLength(1);
    expect(migrated.collections[0].id).toBe('col-1');
  });

  it('migrateGrpcCallHistoryStore assigns updatedAt when legacy envelope omits it', () => {
    const migrated = migrateGrpcCallHistoryStore({
      entries: [makeHistoryEntry('e1')],
    });
    expect(migrated.entries).toHaveLength(1);
    expect(migrated.updatedAt).toMatch(/^\d{4}-/);
  });

  it('validateGrpcCallHistoryStore rejects history entry rows that are not objects', () => {
    const result = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: ['not-an-entry'],
    });
    expect(result.ok).toBe(false);
  });

  it('migrateGrpcCollectionsStore skips legacy collections missing required fields', () => {
    const migrated = migrateGrpcCollectionsStore([{ id: 'col-no-name' }]);
    expect(migrated.collections).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore returns empty for primitive payload', () => {
    expect(migrateGrpcCallHistoryStore(123).entries).toEqual([]);
  });

  it('migrateGrpcCollectionsStore filters legacy saved requests with invalid callType', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-bad-ct',
      name: 'Bad call type',
      savedRequests: [{
        id: 'sr-1',
        service: 's',
        method: 'm',
        callType: 'invalid',
      }],
    }]);
    expect(migrated.collections[0].savedRequests).toEqual([]);
  });

  it('validateGrpcCollectionsStore rejects non-object collection rows', () => {
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: ['not-a-collection'],
    });
    expect(result.ok).toBe(false);
  });

  it('validateGrpcCollectionsStore rejects duplicate saved-request ids', () => {
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'c1',
        name: 'n',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [
          { ...makeSavedRequest(), id: 'sr-dup' },
          { ...makeSavedRequest(), id: 'sr-dup', name: 'Other' },
        ],
      }],
    });
    expect(result.ok).toBe(false);
  });

  it('validateGrpcCollectionsStore rejects duplicate saved-request ids across collections', () => {
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [
        {
          id: 'c1',
          name: 'A',
          createdAt: TS,
          updatedAt: TS,
          savedRequests: [{ ...makeSavedRequest(), id: 'sr-dup' }],
        },
        {
          id: 'c2',
          name: 'B',
          createdAt: TS,
          updatedAt: TS,
          savedRequests: [{ ...makeSavedRequest(), id: 'sr-dup', name: 'Other' }],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => /across collections/i.test(issue.message))).toBe(true);
    }
  });

  it('validateGrpcCollectionsStore rejects invalid tlsMode', () => {
    const result = validateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'c1',
        name: 'n',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [{ ...makeSavedRequest(), tlsMode: 'invalid' as never }],
      }],
    });
    expect(result.ok).toBe(false);
  });

  it('validateGrpcCallHistoryStore rejects non-object record payload', () => {
    const result = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        ...makeHistoryEntry('bad-record'),
        record: 'not-object',
      }],
    });
    expect(result.ok).toBe(false);
  });

  it('migrateGrpcCollectionsStore normalizes legacy envelope items[] field', () => {
    const migrated = migrateGrpcCollectionsStore({
      items: [{
        id: 'col-items',
        name: 'From items',
        savedRequests: [{
          id: 'sr-1',
          callType: 'unary',
          service: 'echo.EchoService',
          method: 'Echo',
          descriptorKey: 'desc-1',
          body: {},
          metadata: {},
          timeoutMs: 30_000,
        }],
      }],
    });
    expect(migrated.collections).toHaveLength(1);
    expect(migrated.collections[0].id).toBe('col-items');
  });

  it('migrateGrpcCollectionsStore returns empty for primitive payload', () => {
    expect(migrateGrpcCollectionsStore(123).collections).toEqual([]);
  });

  it('prepareGrpcCallHistoryStoreForPersist truncates oversized bodies in existing entries', () => {
    const largeBody: Record<string, unknown> = { payload: 'x'.repeat(70_000) };
    const store = migrateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        id: 'hist-large',
        callType: 'unary',
        target: 'localhost:50051',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        capturedAt: TS,
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
            body: largeBody,
            metadata: {},
            timeoutMs: 30_000,
            descriptorKey: 'desc-1',
          },
        }),
      }],
    });

    const prepared = prepareGrpcCallHistoryStoreForPersist(store, TS);
    expect(prepared.updatedAt).toBe(TS);
    expect(prepared.entries[0].bodyTruncated).toBe(true);
    expect(prepared.entries[0].record.snapshot.body).toEqual({ _truncated: '[TRUNCATED]' });
  });

  it('validateGrpcCallHistoryStore rejects invalid record capturedAt timestamps', () => {
    const result = validateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [{
        ...makeHistoryEntry('bad-captured-at'),
        record: {
          ...makeHistoryEntry('bad-captured-at').record,
          capturedAt: 'not-a-date',
        },
      }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path.includes('capturedAt'))).toBe(true);
  });

  it('prepareGrpcCollectionsStoreForPersist redacts collections and stamps updatedAt', () => {
    const prepared = prepareGrpcCollectionsStoreForPersist({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: '2020-01-01T00:00:00.000Z',
      collections: [{
        ...makeCollection(),
        savedRequests: [{
          ...makeSavedRequest(),
          auth: { type: 'bearer', bearerToken: 'must-redact' },
        }],
      }],
    }, TS);
    expect(prepared.updatedAt).toBe(TS);
    expect(prepared.collections[0]?.savedRequests[0]?.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('validateGrpcCollectionsStore rejects runStats, tlsMode, and duplicate ids', () => {
    const baseStore = {
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [makeCollection()],
    };
    expect(validateGrpcCollectionsStore({
      ...baseStore,
      collections: [{
        ...makeCollection(),
        savedRequests: [{
          ...makeSavedRequest(),
          runStats: { totalRuns: -1, successRuns: 0, errorRuns: 0 },
        }],
      }],
    }).ok).toBe(false);
    expect(validateGrpcCollectionsStore({
      ...baseStore,
      collections: [{
        ...makeCollection(),
        savedRequests: [{
          ...makeSavedRequest(),
          runStats: {
            totalRuns: 1,
            successRuns: 1,
            errorRuns: 0,
            lastRunAt: 'bad-ts',
            lastGrpcStatus: 'bad',
            lastDurationMs: -5,
          },
        }],
      }],
    }).ok).toBe(false);
    expect(validateGrpcCollectionsStore({
      ...baseStore,
      collections: [{
        ...makeCollection(),
        savedRequests: [{
          ...makeSavedRequest(),
          tlsMode: 'invalid',
          updatedAt: 'not-iso',
        }],
      }],
    }).ok).toBe(false);
    expect(validateGrpcCollectionsStore({
      ...baseStore,
      collections: [makeCollection(), makeCollection()],
    }).ok).toBe(false);
    expect(validateGrpcCollectionsStore({
      ...baseStore,
      collections: [
        makeCollection(),
        { ...makeCollection(), id: 'col-2', savedRequests: [makeSavedRequest()] },
      ],
    }).ok).toBe(false);
  });
});
