import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } from './contractFixtures';
import { computeGrpcSchemaDiff } from './grpcSchemaDiffEngine';
import {
  prepareGrpcHarnessResultReportExportWithAdvanced,
  prepareGrpcLoadTestProfileHarnessFixture,
} from './grpcHarnessAdvancedPromotion';
import { makeResult } from '../../test-utils/factories';

describe('grpcHarnessAdvancedPromotion', () => {
  it('builds leak-scanned profile fixture and harness bundle attachments', () => {
    const profile = prepareGrpcLoadTestProfileHarnessFixture({
      name: 'wf-profile',
      config: { concurrency: 2, totalCalls: 10, warmupCalls: 1 },
    });
    const bundle = prepareGrpcHarnessResultReportExportWithAdvanced({
      base: {
        scenarioName: 'grpc-advanced',
        result: makeResult({ passed: true }),
      },
      loadTestProfile: profile,
      schemaDiffReport: computeGrpcSchemaDiff({
        leftDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
        rightDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
        left: FIXTURE_DESCRIPTOR,
        right: FIXTURE_DESCRIPTOR,
      }),
    });
    expect(bundle.kind).toBe('grpc_harness_result_report');
    expect(bundle.advancedAttachments?.loadTestProfile?.config.concurrency).toBe(2);
    expect(bundle.advancedAttachments?.schemaDiffReport?.summary.breaking).toBe(0);
    expect(bundle.advancedAttachments?.schemaDiffMarkdown).toContain('breaking');
  });

  it('prepareGrpcLoadTestProfileHarnessFixture omits sourceMetadata without execute snapshot', () => {
    const profile = prepareGrpcLoadTestProfileHarnessFixture({
      name: 'bare-profile',
      config: { concurrency: 1, totalCalls: 1 },
    });
    expect(profile.sourceMetadata).toBeUndefined();
  });

  it('prepareGrpcHarnessResultReportExportWithAdvanced attaches load test summary only with metadata', () => {
    const profile = prepareGrpcLoadTestProfileHarnessFixture({
      name: 'wf-profile',
      config: { concurrency: 2, totalCalls: 10, warmupCalls: 1 },
    });
    const bundle = prepareGrpcHarnessResultReportExportWithAdvanced({
      base: {
        scenarioName: 'grpc-advanced',
        result: makeResult({ passed: true }),
      },
      loadTestProfile: profile,
      loadTestSummary: {
        runId: 'run-1',
        startedAt: '2026-07-01T00:00:00.000Z',
        completedAt: '2026-07-01T00:00:01.000Z',
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
        attempts: [],
      },
    });
    expect(bundle.advancedAttachments?.loadTestSummary).toBeUndefined();

    const withMetadata = prepareGrpcHarnessResultReportExportWithAdvanced({
      base: {
        scenarioName: 'grpc-advanced',
        result: makeResult({ passed: true }),
      },
      loadTestSummary: {
        runId: 'run-1',
        startedAt: '2026-07-01T00:00:00.000Z',
        completedAt: '2026-07-01T00:00:01.000Z',
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
        attempts: [],
      },
      loadTestSourceMetadata: {
        schemaVersion: 1,
        exportedFrom: 'grpc_studio_advanced',
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: '2026-07-01T00:00:00.000Z',
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        targetTemplate: 'localhost:50051',
      },
    });
    expect(withMetadata.advancedAttachments?.loadTestSummary?.runId).toBe('run-1');
  });

  it('prepareGrpcHarnessResultReportExportWithAdvanced omits attachments when none provided', () => {
    const bundle = prepareGrpcHarnessResultReportExportWithAdvanced({
      base: {
        scenarioName: 'plain',
        result: makeResult({ passed: true }),
      },
    });
    expect(bundle.advancedAttachments).toBeUndefined();
  });
});
