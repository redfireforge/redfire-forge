/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcLoadTestPanel } from './GrpcLoadTestPanel';
import { GrpcMockServerPanel } from './GrpcMockServerPanel';
import { GrpcSchemaDiffPanel } from './GrpcSchemaDiffPanel';
import { GrpcAdvancedFeaturesShell } from './GrpcAdvancedFeaturesShell';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';

function makeAdvancedStub(
  overrides: Partial<UseGrpcStudioAdvancedFeaturesReturn> = {},
): UseGrpcStudioAdvancedFeaturesReturn {
  const initial = createInitialGrpcTabAdvancedFeaturesUiState();
  return {
    activeFeatureTab: 'load_test',
    runtime: initial.runtime,
    loadTest: initial.loadTest,
    mockServer: initial.mockServer,
    schemaDiff: initial.schemaDiff,
    loadTestValidationError: undefined,
    loadTestRunning: false,
    mockRunning: false,
    resolvedMockConfig: {
      source: 'workspace_default',
      connectionId: 'tab-1',
      ruleSet: { rules: [] },
    },
    mockManagerState: undefined,
    activeTabLabel: 'Tab 1',
    activeRpcLabel: 'echo.EchoService / Echo',
    setActiveFeatureTab: vi.fn(),
    patchLoadTestConfig: vi.fn(),
    patchMockRulesJson: vi.fn(),
    patchMockLatency: vi.fn(),
    setSchemaDiffSeverityFilter: vi.fn(),
    startLoadTest: vi.fn(),
    cancelLoadTest: vi.fn(),
    resetLoadTestStatus: vi.fn(),
    startMockServer: vi.fn(),
    stopMockServer: vi.fn(),
    resetMockStatus: vi.fn(),
    captureSchemaBaseline: vi.fn(),
    runSchemaDiff: vi.fn(),
    clearSchemaBaseline: vi.fn(),
    exportLoadTestJson: vi.fn(),
    exportLoadTestCsv: vi.fn(),
    exportSchemaDiffJson: vi.fn(),
    exportSchemaDiffMarkdown: vi.fn(),
    resetMockRulesToDefault: vi.fn(),
    ...overrides,
  };
}

describe('GrpcLoadTestPanel (Phase 11G)', () => {
  it('renders start button and calls startLoadTest', async () => {
    const startLoadTest = vi.fn();
    render(<GrpcLoadTestPanel advanced={makeAdvancedStub({ startLoadTest })} />);
    await userEvent.click(screen.getByTestId('grpc-load-test-start-btn'));
    expect(startLoadTest).toHaveBeenCalledTimes(1);
  });

  it('shows stop button while running and calls cancelLoadTest', async () => {
    const cancelLoadTest = vi.fn();
    render(<GrpcLoadTestPanel advanced={makeAdvancedStub({ loadTestRunning: true, cancelLoadTest })} />);
    expect(screen.getByTestId('grpc-load-test-stop-btn')).toBeTruthy();
    await userEvent.click(screen.getByTestId('grpc-load-test-stop-btn'));
    expect(cancelLoadTest).toHaveBeenCalledTimes(1);
  });

  it('renders summary metrics when lastSummary is present', () => {
    render(<GrpcLoadTestPanel advanced={makeAdvancedStub({
      loadTest: {
        config: { concurrency: 2, totalCalls: 10 },
        lastSummary: {
          schemaVersion: 1,
          kind: 'grpc_load_test_summary',
          runId: 'run-1',
          exportedAt: '2026-06-30T00:00:00.000Z',
          startedAt: '2026-06-30T00:00:00.000Z',
          completedAt: '2026-06-30T00:00:01.000Z',
          durationMs: 1000,
          stopReason: 'completed_total_calls',
          config: { concurrency: 2, totalCalls: 10 },
          counts: {
            scheduled: 10,
            completed: 10,
            succeeded: 9,
            failed: 1,
            warmupScheduled: 0,
            warmupCompleted: 0,
            peakInFlight: 2,
          },
          metrics: {
            latency: {
              samples: 10,
              warmupSamples: 0,
              measuredSamples: 10,
              minMs: 1,
              maxMs: 5,
              meanMs: 2,
              p50Ms: 2,
              p95Ms: 4,
              p99Ms: 5,
              p999Ms: 5,
            },
            throughput: {
              allAttemptsPerSecond: 10,
              measuredAttemptsPerSecond: 10,
              warmupAttemptsPerSecond: 0,
              succeededAttemptsPerSecond: 9,
              failedAttemptsPerSecond: 1,
            },
            statusDistribution: {
              totalAttempts: 10,
              warmupAttempts: 0,
              measuredAttempts: 10,
              succeededAttempts: 9,
              failedAttempts: 1,
              byStatusCode: { '0': 9, '4': 1 },
            },
          },
          attempts: [],
        },
      },
    })} />);
    expect(screen.getByTestId('grpc-load-test-summary-metrics')).toBeTruthy();
  });
});

describe('GrpcMockServerPanel (Phase 11G)', () => {
  it('starts mock runtime from panel', async () => {
    const startMockServer = vi.fn();
    render(<GrpcMockServerPanel advanced={makeAdvancedStub({ startMockServer })} />);
    await userEvent.click(screen.getByTestId('grpc-mock-start-btn'));
    expect(startMockServer).toHaveBeenCalledTimes(1);
  });

  it('stops mock runtime while running', async () => {
    const stopMockServer = vi.fn();
    render(<GrpcMockServerPanel advanced={makeAdvancedStub({ mockRunning: true, stopMockServer })} />);
    await userEvent.click(screen.getByTestId('grpc-mock-stop-btn'));
    expect(stopMockServer).toHaveBeenCalledTimes(1);
  });
});

describe('GrpcSchemaDiffPanel (Phase 11G)', () => {
  it('captures baseline and compares', async () => {
    const captureSchemaBaseline = vi.fn();
    const runSchemaDiff = vi.fn();
    render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({ captureSchemaBaseline, runSchemaDiff })} />);
    await userEvent.click(screen.getByTestId('grpc-schema-diff-capture-baseline'));
    await userEvent.click(screen.getByTestId('grpc-schema-diff-compare-btn'));
    expect(captureSchemaBaseline).toHaveBeenCalledTimes(1);
    expect(runSchemaDiff).toHaveBeenCalledTimes(1);
  });

  it('renders diff results when report is present', () => {
    render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      schemaDiff: {
        severityFilter: 'all',
        lastReport: {
          leftDescriptorKey: 'base',
          rightDescriptorKey: 'cand',
          generatedAt: '2026-06-30T00:00:00.000Z',
          summary: { breaking: 1, nonBreaking: 0, informational: 0 },
          changes: [{
            severity: 'breaking',
            entityType: 'method',
            entityPath: 'echo.EchoService/Echo',
            changeType: 'removed',
            description: 'RPC removed',
          }],
        },
      },
    })} />);
    expect(screen.getByTestId('grpc-schema-diff-results')).toBeTruthy();
    expect(screen.getByTestId('grpc-schema-diff-change-list')).toBeTruthy();
  });
});

describe('GrpcAdvancedFeaturesShell (Phase 11G)', () => {
  it('switches advanced sub-tabs', async () => {
    const setActiveFeatureTab = vi.fn();
    render(<GrpcAdvancedFeaturesShell advanced={makeAdvancedStub({ setActiveFeatureTab })} />);
    await userEvent.click(screen.getByTestId('grpc-advanced-tab-mock_server'));
    expect(setActiveFeatureTab).toHaveBeenCalledWith('mock_server');
  });
});
