/**
 * Phase 5E — persist/export redaction middleware tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  migrateGrpcCallHistoryStore,
  migrateGrpcCollectionsStore,
} from './grpcPersistenceMigration';
import {
  assertGrpcCallHistoryEntryPersistSafe,
  assertGrpcCrossFeatureExportSafe,
  assertGrpcPersistTargetSafe,
  prepareGrpcCallHistoryEntryForPersistSafe,
  prepareGrpcCallHistoryStoreForPersistSafe,
  prepareGrpcCollectionsStoreForPersistSafe,
  reprepareGrpcCallHistoryEntryForPersistSafe,
  scanGrpcPersistPayloadsForLeakage,
} from './grpcPersistRedactionMiddleware';
import {
  prepareGrpcCallHistoryEntryForPersist,
  prepareGrpcCollectionsStoreForPersist,
} from './grpcPersistenceSchema';
import {
  buildGrpcAdvancedFeatureSourceMetadata,
  prepareGrpcLoadTestRunSummaryExportSafe,
} from './grpcAdvancedFeatureExport';
import { captureGrpcLoadTestExecuteSnapshot } from './grpcAdvancedFeatureContracts';
import { buildGrpcLoadTestRunSummaryExport } from './grpcLoadTestMetrics';

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

describe('grpcPersistRedactionMiddleware (Phase 5E)', () => {
  it('prepareGrpcCollectionsStoreForPersistSafe redacts secrets and passes leak scan', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
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
        tlsConfig: { serverCaPem: VALID_PEM },
      }],
    }]);

    const prepared = prepareGrpcCollectionsStoreForPersistSafe(migrated, TS);
    expect(prepared.collections[0].savedRequests[0].auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(scanGrpcPersistPayloadsForLeakage({ grpc_collections_v1: prepared })).toHaveLength(0);
  });

  it('assertGrpcPersistTargetSafe throws when tampered post-prepare collections leak', () => {
    const migrated = migrateGrpcCollectionsStore([{
      id: 'col-1',
      name: 'Tamper',
      savedRequests: [{
        id: 'sr-1',
        callType: 'unary',
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-1',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        auth: { type: 'bearer', bearerToken: 'raw-secret-token-value' },
      }],
    }]);
    const prepared = prepareGrpcCollectionsStoreForPersist(migrated, TS);
    prepared.collections[0].savedRequests[0].auth!.bearerToken = 'post-prepare-leak-token';

    expect(() => assertGrpcPersistTargetSafe('grpc_collections_v1', prepared)).toThrow(/secret/i);
  });

  it('prepareGrpcCallHistoryEntryForPersistSafe redacts and validates envelope', () => {
    const entry = prepareGrpcCallHistoryEntryForPersistSafe({
      id: 'hist-1',
      snapshot: RAW_SNAPSHOT,
    });
    expect(entry.record.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(() => assertGrpcCallHistoryEntryPersistSafe(entry)).not.toThrow();
  });

  it('prepareGrpcCallHistoryStoreForPersistSafe redacts bulk envelope', () => {
    const entry = prepareGrpcCallHistoryEntryForPersistSafe({
      id: 'hist-bulk',
      snapshot: RAW_SNAPSHOT,
    });
    const store = prepareGrpcCallHistoryStoreForPersistSafe(
      migrateGrpcCallHistoryStore({ schemaVersion: 1, updatedAt: TS, entries: [entry] }),
      TS,
    );
    expect(store.entries[0].record.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(scanGrpcPersistPayloadsForLeakage({ grpc_call_history_v1: store })).toHaveLength(0);
  });

  it('assertGrpcCrossFeatureExportSafe scans nested forbidden targets', () => {
    expect(() => assertGrpcCrossFeatureExportSafe({
      grpc_export_bundle: {
        version: 1,
        savedRequest: { auth: { bearerToken: GRPC_REDACTED_PLACEHOLDER } },
        snapshot: { auth: { bearerToken: GRPC_REDACTED_PLACEHOLDER } },
      },
    }, 'export_ok')).not.toThrow();

    expect(() => assertGrpcCrossFeatureExportSafe({
      workflow_node_snapshot: {
        kind: 'grpc_call',
        label: 'leak',
        snapshot: { auth: { bearerToken: 'must-not-export' } },
      },
    }, 'export_leak')).toThrow(/secret/i);
  });

  it('assertGrpcCrossFeatureExportSafe accepts redacted advanced feature exports', () => {
    const executeSnapshot = {
      tabId: 'tab-mw',
      requestId: 'req-mw',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary' as const,
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      metadata: {},
      timeoutMs: 5000,
      descriptorKey: 'reflection:localhost:50051',
    };
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-mw',
      executeSnapshot,
      config: { concurrency: 1, totalCalls: 1 },
    });
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot,
      report: {
        runId: 'run-mw',
        startedAt: '2026-07-01T00:00:01.000Z',
        completedAt: '2026-07-01T00:00:02.000Z',
        durationMs: 1000,
        stopReason: 'completed_total_calls',
        counts: {
          scheduled: 1,
          completed: 1,
          succeeded: 1,
          failed: 0,
          warmupScheduled: 0,
          warmupCompleted: 0,
          peakInFlight: 1,
        },
        attempts: [{
          attemptNumber: 1,
          warmup: false,
          startedAt: '2026-07-01T00:00:01.000Z',
          finishedAt: '2026-07-01T00:00:02.000Z',
          durationMs: 1000,
          ok: true,
          statusCode: 0,
        }],
      },
    });
    const safe = prepareGrpcLoadTestRunSummaryExportSafe(
      summary,
      buildGrpcAdvancedFeatureSourceMetadata(executeSnapshot),
    );
    expect(() => assertGrpcCrossFeatureExportSafe({ grpc_load_test_export: safe }, 'load_test_ok')).not.toThrow();
  });

  it('assertGrpcCallHistoryEntryPersistSafe rejects raw secrets at IDB boundary', () => {
    const entry = prepareGrpcCallHistoryEntryForPersistSafe({
      id: 'hist-idb',
      snapshot: RAW_SNAPSHOT,
    });
    entry.record.snapshot.auth!.bearerToken = 'idb-boundary-leak';

    expect(() => assertGrpcCallHistoryEntryPersistSafe(entry)).toThrow(/secret/i);
  });

  it('reprepareGrpcCallHistoryEntryForPersistSafe preserves bodyTruncated and redacts', () => {
    const largeBody = { payload: 'x'.repeat(70_000) };
    const entry = prepareGrpcCallHistoryEntryForPersist({
      id: 'hist-reprepare-safe',
      snapshot: {
        ...RAW_SNAPSHOT,
        body: largeBody,
      },
    });
    expect(entry.bodyTruncated).toBe(true);

    entry.record.snapshot.auth!.bearerToken = 'reprepare-leak';
    const reprepared = reprepareGrpcCallHistoryEntryForPersistSafe(entry);
    expect(reprepared.bodyTruncated).toBe(true);
    expect(reprepared.record.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
  });
});
