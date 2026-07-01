/**
 * Phase 5A — persistence migration tests.
 */
import { describe, expect, it } from 'vitest';
import {
  GRPC_CALL_HISTORY_MAX_ENTRIES,
  GRPC_PERSISTENCE_SCHEMA_VERSION,
} from './grpcPersistenceSchema';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  migrateGrpcCallHistoryStore,
  migrateGrpcCollectionsStore,
} from './grpcPersistenceMigration';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { prepareGrpcCallHistoryRecord } from './grpcRedaction';

const TS = '2026-06-29T12:00:00.000Z';

describe('grpcPersistenceMigration (Phase 5A)', () => {
  it('migrateGrpcCollectionsStore returns empty envelope for null/undefined', () => {
    const migrated = migrateGrpcCollectionsStore(null);
    expect(migrated.schemaVersion).toBe(GRPC_PERSISTENCE_SCHEMA_VERSION);
    expect(migrated.collections).toEqual([]);
  });

  it('migrateGrpcCollectionsStore parses JSON string payloads', () => {
    const migrated = migrateGrpcCollectionsStore(JSON.stringify({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [],
    }));
    expect(migrated.collections).toEqual([]);
    expect(migrated.updatedAt).toBe(TS);
  });

  it('migrateGrpcCollectionsStore normalizes legacy collection.requests[] field', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Legacy Collection',
      target: '{{grpcHost}}',
      requests: [{
        id: 'sr-1',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: { message: 'legacy' },
        metadata: {},
        timeoutMs: 30_000,
      }],
    }]);

    expect(migrated.collections).toHaveLength(1);
    expect(migrated.collections[0].defaultTarget).toBe('{{grpcHost}}');
    expect(migrated.collections[0].savedRequests).toHaveLength(1);
    expect(migrated.collections[0].savedRequests[0].name).toBe('echo.EchoService/Echo');
    expect(migrated.collections[0].savedRequests[0].revisionId).toBeTruthy();
    expect(migrated.collections[0].savedRequests[0].createdAt).toBeTruthy();
  });

  it('migrateGrpcCollectionsStore preserves responseBaseline on legacy saved requests (5I)', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Legacy Collection',
      requests: [{
        id: 'sr-1',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: { message: 'legacy' },
        metadata: {},
        timeoutMs: 30_000,
        responseBaseline: {
          capturedAt: TS,
          grpcStatus: 0,
          statusMessage: 'OK',
          body: { message: 'legacy' },
        },
      }],
    }]);

    expect(migrated.collections[0].savedRequests[0].responseBaseline).toEqual({
      capturedAt: TS,
      grpcStatus: 0,
      statusMessage: 'OK',
      body: { message: 'legacy' },
    });
  });

  it('migrateGrpcCollectionsStore normalizes legacy 4H saved requests missing name/createdAt', () => {
    const migrated = migrateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-1',
        name: '4H compat',
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
    });

    const saved = migrated.collections[0].savedRequests[0];
    expect(saved.name).toBe('echo.EchoService/Echo');
    expect(saved.createdAt).toBe(TS);
  });

  it('migrateGrpcCallHistoryStore returns empty envelope for malformed JSON string', () => {
    const migrated = migrateGrpcCallHistoryStore('{not-json');
    expect(migrated.entries).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore migrates legacy entry array and caps at max entries', () => {
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

    const legacy = Array.from({ length: GRPC_CALL_HISTORY_MAX_ENTRIES + 5 }, (_, i) => ({
      id: `hist-${i}`,
      record,
      bodyTruncated: false,
    }));

    const migrated = migrateGrpcCallHistoryStore(legacy);
    expect(migrated.entries.length).toBe(GRPC_CALL_HISTORY_MAX_ENTRIES);
    expect(migrated.entries[0].id).toBe('hist-5');
    expect(migrated.entries[migrated.entries.length - 1].id).toBe(`hist-${GRPC_CALL_HISTORY_MAX_ENTRIES + 4}`);
  });

  it('migrateGrpcCollectionsStore redacts secrets in legacy saved requests', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-secrets',
      name: 'Secrets',
      savedRequests: [{
        id: 'sr-1',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: { authorization: 'Bearer raw-secret-token-value' },
        timeoutMs: 30_000,
        auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
      }],
    }]);

    const saved = migrated.collections[0].savedRequests[0];
    expect(saved.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(saved.metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('migrateGrpcCallHistoryStore redacts secrets in legacy entries', () => {
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
        metadata: { authorization: 'Bearer raw-secret-token-value' },
        timeoutMs: 30_000,
        descriptorKey: 'desc-1',
        auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
      },
    });

    const migrated = migrateGrpcCallHistoryStore([{
      id: 'hist-secret',
      record,
      bodyTruncated: false,
    }]);

    expect(migrated.entries).toHaveLength(1);
    expect(migrated.entries[0].record.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('migrateGrpcCallHistoryStore filters legacy entries missing service/method', () => {
    const migrated = migrateGrpcCallHistoryStore([{
      id: 'hist-bad',
      record: {
        snapshot: {
          callType: 'unary',
          target: { address: 'localhost:50051' },
        },
        capturedAt: TS,
      },
    }]);
    expect(migrated.entries).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore preserves legacy envelope updatedAt', () => {
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

    const migrated = migrateGrpcCallHistoryStore({
      entries: [{
        id: 'hist-env',
        record,
        bodyTruncated: false,
      }],
      updatedAt: TS,
    });

    expect(migrated.updatedAt).toBe(TS);
    expect(migrated.entries[0].target).toBe(FIXTURE_UNARY_CALL_REQUEST.target.address);
  });

  it('migrateGrpcCallHistoryStore skips non-object legacy rows', () => {
    const migrated = migrateGrpcCallHistoryStore(['not-an-entry', null]);
    expect(migrated.entries).toEqual([]);
  });
});
