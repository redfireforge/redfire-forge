/**
 * Phase 5A — persistence migration coverage gaps.
 */
import { describe, expect, it } from 'vitest';
import { GRPC_PERSISTENCE_SCHEMA_VERSION } from './grpcPersistenceSchema';
import {
  migrateGrpcCallHistoryStore,
  migrateGrpcCollectionsStore,
} from './grpcPersistenceMigration';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { prepareGrpcCallHistoryRecord } from './grpcRedaction';

const TS = '2026-06-29T12:00:00.000Z';

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

describe('grpcPersistenceMigration coverage gaps', () => {
  it('migrateGrpcCollectionsStore returns empty envelope for empty string', () => {
    const migrated = migrateGrpcCollectionsStore('');
    expect(migrated.collections).toEqual([]);
    expect(migrated.schemaVersion).toBe(GRPC_PERSISTENCE_SCHEMA_VERSION);
  });

  it('migrateGrpcCollectionsStore returns empty envelope for non-object payloads', () => {
    expect(migrateGrpcCollectionsStore(42).collections).toEqual([]);
    expect(migrateGrpcCollectionsStore(true).collections).toEqual([]);
  });

  it('migrateGrpcCollectionsStore migrates legacy envelope items[] field', () => {
    const migrated = migrateGrpcCollectionsStore({
      items: [{
        id: 'col-items',
        name: 'From Items',
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
    expect(migrated.collections[0].name).toBe('From Items');
  });

  it('migrateGrpcCollectionsStore skips invalid legacy saved requests', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Partial',
      savedRequests: [
        { id: 'bad', service: 'echo.EchoService' },
        {
          id: 'sr-ok',
          callType: 'server_stream',
          service: 'echo.EchoService',
          method: 'ServerStream',
          descriptorKey: 'desc-1',
          body: {},
          metadata: {},
          timeoutMs: 30_000,
          tlsMode: 'tls',
          tlsConfig: { serverCaPem: 'pem' },
          auth: { type: 'basic', username: 'u', password: 'p' },
          notes: 'legacy note',
        },
      ],
    }]);
    expect(migrated.collections[0].savedRequests).toHaveLength(1);
    expect(migrated.collections[0].savedRequests[0].callType).toBe('server_stream');
    expect(migrated.collections[0].savedRequests[0].notes).toBe('legacy note');
  });

  it('migrateGrpcCollectionsStore drops invalid responseBaseline shapes', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Baseline',
      savedRequests: [{
        id: 'sr-1',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        responseBaseline: {
          capturedAt: 'not-a-date',
          grpcStatus: 0,
          body: {},
        },
      }],
    }]);
    expect(migrated.collections[0].savedRequests[0].responseBaseline).toBeUndefined();
  });

  it('migrateGrpcCallHistoryStore returns empty envelope for empty string', () => {
    expect(migrateGrpcCallHistoryStore('').entries).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore extracts target from snapshot.target.address', () => {
    const migrated = migrateGrpcCallHistoryStore([{
      id: 'hist-1',
      callType: 'unary',
      record: {
        capturedAt: TS,
        snapshot: {
          callType: 'unary',
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: 'echo.EchoService',
          method: 'Echo',
          descriptorKey: 'desc-1',
        },
      },
    }]);
    expect(migrated.entries).toHaveLength(1);
    expect(migrated.entries[0].target).toBe('localhost:50051');
    expect(migrated.entries[0].service).toBe('echo.EchoService');
  });

  it('migrateGrpcCallHistoryStore rejects legacy rows with invalid callType', () => {
    const migrated = migrateGrpcCallHistoryStore([{
      id: 'hist-bad-type',
      record: {
        capturedAt: TS,
        snapshot: {
          callType: 'not_a_stream',
          target: { address: 'localhost:50051' },
          service: 'echo.EchoService',
          method: 'Echo',
        },
      },
    }]);
    expect(migrated.entries).toEqual([]);
  });

  it('migrateGrpcCollectionsStore returns empty envelope for legacy envelope without collections', () => {
    const migrated = migrateGrpcCollectionsStore({ version: 0 });
    expect(migrated.collections).toEqual([]);
  });

  it('migrateGrpcCollectionsStore accepts valid v1 envelope unchanged', () => {
    const migrated = migrateGrpcCollectionsStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      collections: [{
        id: 'col-v1',
        name: 'V1',
        createdAt: TS,
        updatedAt: TS,
        savedRequests: [],
      }],
    });
    expect(migrated.collections[0].id).toBe('col-v1');
  });

  it('normalizeSavedRequestLegacy uses updatedAt for createdAt when createdAt missing', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Dates',
      savedRequests: [{
        id: 'sr-1',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: { trace: 123 },
        timeoutMs: 'bad',
        updatedAt: TS,
      }],
    }]);
    const saved = migrated.collections[0].savedRequests[0];
    expect(saved.createdAt).toBe(TS);
    expect(saved.metadata.trace).toBe('123');
    expect(saved.timeoutMs).toBe(30_000);
  });

  it('normalizeResponseBaseline rejects non-object body and non-string statusMessage', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Baseline edge',
      savedRequests: [{
        id: 'sr-1',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        responseBaseline: {
          capturedAt: TS,
          grpcStatus: 0,
          statusMessage: 42,
          body: 'not-object',
        },
      }],
    }]);
    expect(migrated.collections[0].savedRequests[0].responseBaseline).toBeUndefined();
  });

  it('migrateGrpcCallHistoryStore migrates top-level target and grpcStatus fields', () => {
    const migrated = migrateGrpcCallHistoryStore([{
      id: 'hist-top',
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'client_stream',
      grpcStatus: 0,
      durationMs: 12,
      bodyTruncated: true,
      record: {
        capturedAt: TS,
        snapshot: {
          callType: 'client_stream',
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: 'echo.EchoService',
          method: 'Echo',
          descriptorKey: 'desc-1',
        },
      },
    }]);
    expect(migrated.entries[0]).toMatchObject({
      callType: 'client_stream',
      target: 'localhost:50051',
      bodyTruncated: true,
    });
  });

  it('migrateGrpcCallHistoryStore accepts validated v1 envelope', () => {
    const migrated = migrateGrpcCallHistoryStore({
      schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
      updatedAt: TS,
      entries: [],
    });
    expect(migrated.entries).toEqual([]);
    expect(migrated.updatedAt).toBe(TS);
  });

  it('migrateGrpcCallHistoryStore returns empty store for legacy object without entries', () => {
    expect(migrateGrpcCallHistoryStore({ foo: 'bar' }).entries).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore skips legacy rows missing record snapshot', () => {
    expect(migrateGrpcCallHistoryStore([{ id: 'hist-no-record', target: 'localhost:50051' }]).entries).toEqual([]);
  });

  it('migrateGrpcCollectionsStore skips saved requests with invalid callType', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Invalid call type',
      savedRequests: [{
        id: 'sr-bad',
        callType: 'invalid',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
      }],
    }]);
    expect(migrated.collections[0].savedRequests).toEqual([]);
  });

  it('migrateGrpcCollectionsStore skips collections missing id or name', () => {
    const migrated = migrateGrpcCollectionsStore([{ name: 'No id' }, { id: 'no-name' }]);
    expect(migrated.collections).toEqual([]);
  });

  it('migrateGrpcCollectionsStore normalizes bidi_stream and defaultTarget from legacy collection', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-bidi',
      name: 'Bidi',
      defaultTarget: 'localhost:50051',
      savedRequests: [{
        id: 'sr-bidi',
        callType: 'bidi_stream',
        service: 'echo.EchoService',
        method: 'BidiStream',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        connectionId: 'conn-1',
        tlsMode: 'mtls',
      }],
    }]);
    const saved = migrated.collections[0].savedRequests[0];
    expect(saved.callType).toBe('bidi_stream');
    expect(saved.connectionId).toBe('conn-1');
    expect(saved.tlsMode).toBe('mtls');
    expect(migrated.collections[0].defaultTarget).toBe('localhost:50051');
  });

  it('migrateGrpcCollectionsStore uses legacy collection target as defaultTarget', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-target',
      name: 'Target',
      target: 'legacy-host:50051',
      savedRequests: [],
    }]);
    expect(migrated.collections[0].defaultTarget).toBe('legacy-host:50051');
  });

  it('migrateGrpcCollectionsStore keeps valid responseBaseline on legacy saved requests', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-baseline',
      name: 'Baseline ok',
      savedRequests: [{
        id: 'sr-1',
        callType: 'server_stream',
        service: 'echo.EchoService',
        method: 'ServerStream',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        responseBaseline: {
          capturedAt: TS,
          grpcStatus: 0,
          body: { message: 'ok' },
        },
      }],
    }]);
    expect(migrated.collections[0].savedRequests[0].responseBaseline).toEqual({
      capturedAt: TS,
      grpcStatus: 0,
      body: { message: 'ok' },
    });
  });

  it('migrateGrpcCallHistoryStore reads service and method from snapshot when raw fields missing', () => {
    const migrated = migrateGrpcCallHistoryStore([{
      id: 'hist-snapshot-fields',
      callType: 'unary',
      record: {
        capturedAt: TS,
        snapshot: {
          callType: 'unary',
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: 'echo.EchoService',
          method: 'Echo',
          descriptorKey: 'desc-1',
        },
      },
    }]);
    expect(migrated.entries[0]).toMatchObject({
      service: 'echo.EchoService',
      method: 'Echo',
      descriptorKey: 'desc-1',
    });
  });

  it('migrateGrpcCollectionsStore skips saved requests missing required identity fields', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Missing identity',
      savedRequests: [{ callType: 'unary', service: 'echo.EchoService', method: 'Echo' }],
    }]);
    expect(migrated.collections[0].savedRequests).toEqual([]);
  });

  it('migrateGrpcCallHistoryStore migrates legacy envelope entries array', () => {
    const migrated = migrateGrpcCallHistoryStore({
      entries: [{
        id: 'hist-env',
        callType: 'unary',
        record: {
          capturedAt: TS,
          snapshot: {
            callType: 'unary',
            target: { address: 'localhost:50051', tlsMode: 'disabled' },
            service: 'echo.EchoService',
            method: 'Echo',
            descriptorKey: 'desc-from-snapshot',
          },
        },
      }],
      updatedAt: TS,
    });
    expect(migrated.entries).toHaveLength(1);
    expect(migrated.entries[0].descriptorKey).toBe('desc-from-snapshot');
    expect(migrated.updatedAt).toBe(TS);
  });

  it('migrateGrpcCallHistoryStore assigns updatedAt when legacy envelope omits it', () => {
    const migrated = migrateGrpcCallHistoryStore({
      entries: [makeHistoryEntry('e1')],
    });
    expect(migrated.entries).toHaveLength(1);
    expect(migrated.updatedAt).toMatch(/^\d{4}-/);
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
    expect(saved.tlsMode).toBe('mtls');
    expect(saved.notes).toBe('saved notes');
  });
});
