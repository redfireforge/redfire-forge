/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildGrpcLoadTestRunSummaryExport } from '../../../shared/grpc/grpcLoadTestMetrics';
import { captureGrpcLoadTestExecuteSnapshot } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import * as advancedFeatureExport from '../../../shared/grpc/grpcAdvancedFeatureExport';
import { buildGrpcAdvancedFeatureSourceMetadata } from '../../../shared/grpc/grpcAdvancedFeatureExport';
import * as mockRuleSetExport from '../../../shared/grpc/grpcMockRuleSetExport';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import * as advancedModel from '../utils/grpcStudioAdvancedModel';
import { useGrpcAdvancedExportCallbacks } from './useGrpcAdvancedExportCallbacks';

function makeLoadTestState() {
  const executeSnapshot = {
    tabId: 'tab-1',
    requestId: 'req-1',
    capturedAt: '2026-07-01T00:00:00.000Z',
    callType: 'unary' as const,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body: {},
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    transportMode: 'express' as const,
  };
  const snapshot = captureGrpcLoadTestExecuteSnapshot({
    runId: 'load-run-1',
    executeSnapshot,
    config: { concurrency: 1, totalCalls: 1 },
  });
  const summary = buildGrpcLoadTestRunSummaryExport({
    snapshot,
    report: {
      runId: snapshot.runId,
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
  const state = createInitialGrpcTabAdvancedFeaturesUiState();
  state.loadTest.lastSummary = summary;
  state.loadTest.lastExportSource = buildGrpcAdvancedFeatureSourceMetadata(executeSnapshot);
  state.schemaDiff.lastReport = {
    baselineKey: FIXTURE_DESCRIPTOR_KEY,
    candidateKey: FIXTURE_DESCRIPTOR_KEY,
    generatedAt: '2026-07-01T00:00:00.000Z',
    summary: { totalChanges: 0, breaking: 0, warning: 0, info: 0 },
    changes: [],
  };
  state.schemaDiff.baselineCapturedAt = '2026-07-01T00:00:00.000Z';
  state.mockServer.rulesJson = '{ "rules": [] }';
  return state;
}

describe('useGrpcAdvancedExportCallbacks coverage gaps', () => {
  it('exports load test, schema diff, and mock rule payloads', () => {
    const setAdvancedExportError = vi.fn();
    const { result } = renderHook(() => useGrpcAdvancedExportCallbacks(
      makeLoadTestState(),
      setAdvancedExportError,
    ));

    act(() => {
      expect(result.current.exportLoadTestJson()).toContain('grpc_load_test_summary');
      expect(result.current.exportLoadTestCsv()).toContain('measuredAttemptsPerSecond');
      expect(result.current.exportSchemaDiffJson()).toContain('baselineKey');
      expect(result.current.exportSchemaDiffMarkdown()).toContain('gRPC Schema Diff Report');
      expect(result.current.exportMockRulesJson()).toContain('"rules"');
      result.current.clearAdvancedExportError();
    });

    expect(setAdvancedExportError).toHaveBeenCalledWith(undefined);
  });

  it('returns undefined when only one load-test export prerequisite is present', () => {
    const setAdvancedExportError = vi.fn();
    const partialState = makeLoadTestState();
    partialState.loadTest.lastExportSource = undefined;

    const { result: missingSource } = renderHook(() => useGrpcAdvancedExportCallbacks(
      partialState,
      setAdvancedExportError,
    ));
    act(() => {
      expect(missingSource.current.exportLoadTestJson()).toBeUndefined();
      expect(missingSource.current.exportLoadTestCsv()).toBeUndefined();
    });

    const missingSummaryState = makeLoadTestState();
    missingSummaryState.loadTest.lastSummary = undefined;
    const { result: missingSummary } = renderHook(() => useGrpcAdvancedExportCallbacks(
      missingSummaryState,
      setAdvancedExportError,
    ));
    act(() => {
      expect(missingSummary.current.exportLoadTestJson()).toBeUndefined();
    });
  });

  it('returns undefined when export prerequisites are missing', () => {
    const setAdvancedExportError = vi.fn();
    const emptyState = createInitialGrpcTabAdvancedFeaturesUiState();
    const { result } = renderHook(() => useGrpcAdvancedExportCallbacks(
      emptyState,
      setAdvancedExportError,
    ));

    act(() => {
      expect(result.current.exportLoadTestJson()).toBeUndefined();
      expect(result.current.exportLoadTestCsv()).toBeUndefined();
      expect(result.current.exportSchemaDiffJson()).toBeUndefined();
      expect(result.current.exportSchemaDiffMarkdown()).toBeUndefined();
    });
  });

  it('records serializer failures for load test and schema diff exports', () => {
    const setAdvancedExportError = vi.fn();
    const jsonSpy = vi.spyOn(advancedFeatureExport, 'serializeGrpcLoadTestRunSummaryExportSafeJson')
      .mockImplementation(() => {
        throw new Error('json blocked');
      });
    const csvSpy = vi.spyOn(advancedFeatureExport, 'serializeGrpcLoadTestRunSummaryExportSafeCsv')
      .mockImplementation(() => {
        throw 'csv blocked';
      });
    const schemaJsonSpy = vi.spyOn(advancedFeatureExport, 'serializeGrpcSchemaDiffReportExportSafeJson')
      .mockImplementation(() => {
        throw new Error('schema json blocked');
      });
    const schemaMdSpy = vi.spyOn(advancedFeatureExport, 'serializeGrpcSchemaDiffReportExportSafeMarkdown')
      .mockImplementation(() => {
        throw 'schema md blocked';
      });

    const { result } = renderHook(() => useGrpcAdvancedExportCallbacks(
      makeLoadTestState(),
      setAdvancedExportError,
    ));

    act(() => {
      expect(result.current.exportLoadTestJson()).toBeUndefined();
      expect(result.current.exportLoadTestCsv()).toBeUndefined();
      expect(result.current.exportSchemaDiffJson()).toBeUndefined();
      expect(result.current.exportSchemaDiffMarkdown()).toBeUndefined();
    });

    expect(setAdvancedExportError).toHaveBeenCalledWith('json blocked');
    expect(setAdvancedExportError).toHaveBeenCalledWith('Export blocked for safety');

    jsonSpy.mockRestore();
    csvSpy.mockRestore();
    schemaJsonSpy.mockRestore();
    schemaMdSpy.mockRestore();
  });

  it('records serializer failures with non-Error throws', () => {
    const setAdvancedExportError = vi.fn();
    vi.spyOn(advancedFeatureExport, 'serializeGrpcLoadTestRunSummaryExportSafeJson')
      .mockImplementation(() => { throw 'json blocked'; });
    vi.spyOn(advancedFeatureExport, 'serializeGrpcLoadTestRunSummaryExportSafeCsv')
      .mockImplementation(() => { throw 'csv blocked'; });
    vi.spyOn(advancedFeatureExport, 'serializeGrpcSchemaDiffReportExportSafeJson')
      .mockImplementation(() => { throw 'schema json blocked'; });
    vi.spyOn(advancedFeatureExport, 'serializeGrpcSchemaDiffReportExportSafeMarkdown')
      .mockImplementation(() => { throw 'schema md blocked'; });

    const { result } = renderHook(() => useGrpcAdvancedExportCallbacks(
      makeLoadTestState(),
      setAdvancedExportError,
    ));

    act(() => {
      expect(result.current.exportLoadTestJson()).toBeUndefined();
      expect(result.current.exportLoadTestCsv()).toBeUndefined();
      expect(result.current.exportSchemaDiffJson()).toBeUndefined();
      expect(result.current.exportSchemaDiffMarkdown()).toBeUndefined();
    });

    expect(setAdvancedExportError).toHaveBeenCalledWith('Export blocked for safety');
  });

  it('handles invalid mock rules and mock export failures', () => {
    const setAdvancedExportError = vi.fn();
    const invalidState = makeLoadTestState();
    invalidState.mockServer.rulesJson = '{ invalid json';

    const { result: invalidRules } = renderHook(() => useGrpcAdvancedExportCallbacks(
      invalidState,
      setAdvancedExportError,
    ));
    act(() => {
      expect(invalidRules.current.exportMockRulesJson()).toBeUndefined();
    });
    expect(setAdvancedExportError).toHaveBeenCalled();

    vi.spyOn(advancedModel, 'parseGrpcMockRuleSetJson').mockReturnValue({
      ok: true,
      ruleSet: { rules: [] },
    });
    vi.spyOn(mockRuleSetExport, 'serializeGrpcMockRuleSetExportSafeJson').mockImplementation(() => {
      throw new Error('mock export blocked');
    });

    const { result } = renderHook(() => useGrpcAdvancedExportCallbacks(
      makeLoadTestState(),
      setAdvancedExportError,
    ));
    act(() => {
      expect(result.current.exportMockRulesJson()).toBeUndefined();
    });
    expect(setAdvancedExportError).toHaveBeenCalledWith('mock export blocked');

    vi.spyOn(advancedModel, 'parseGrpcMockRuleSetJson').mockReturnValue({
      ok: true,
      ruleSet: { rules: [] },
    });
    vi.spyOn(mockRuleSetExport, 'serializeGrpcMockRuleSetExportSafeJson').mockImplementation(() => {
      throw 'mock export string failure';
    });
    const { result: stringFailure } = renderHook(() => useGrpcAdvancedExportCallbacks(
      makeLoadTestState(),
      setAdvancedExportError,
    ));
    act(() => {
      expect(stringFailure.current.exportMockRulesJson()).toBeUndefined();
    });
    expect(setAdvancedExportError).toHaveBeenCalledWith('Export blocked for safety');
  });
});
