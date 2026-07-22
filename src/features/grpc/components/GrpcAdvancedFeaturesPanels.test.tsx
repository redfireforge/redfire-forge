/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOption } from '../../../test-utils/customSelectHelper';
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
    activeTabId: 'tab-1',
    activeRpcLabel: 'echo.EchoService / Echo',
    activeLoadTestCallType: 'unary',
    loadTestProfiles: [],
    loadTestProfilesLoading: false,
    loadTestProfileError: undefined,
    selectedLoadTestProfileId: '',
    setSelectedLoadTestProfileId: vi.fn(),
    saveLoadTestProfile: vi.fn().mockResolvedValue(undefined),
    loadLoadTestProfile: vi.fn(),
    renameLoadTestProfile: vi.fn().mockResolvedValue(undefined),
    removeLoadTestProfile: vi.fn().mockResolvedValue(undefined),
    schemaDiffAckChangeIds: new Set<string>(),
    acknowledgeSchemaDiffChange: vi.fn().mockResolvedValue(undefined),
    unacknowledgeSchemaDiffChange: vi.fn().mockResolvedValue(undefined),
    isSchemaDiffChangeAcknowledged: vi.fn().mockReturnValue(false),
    setActiveFeatureTab: vi.fn(),
    patchLoadTestConfig: vi.fn(),
    patchMockRulesJson: vi.fn(),
    patchMockLatency: vi.fn(),
    patchMockExposeNetwork: vi.fn(),
    setSchemaDiffSeverityFilter: vi.fn(),
    setSchemaDiffHideAcknowledged: vi.fn(),
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
    exportMockRulesJson: vi.fn(),
    advancedExportError: undefined,
    clearAdvancedExportError: vi.fn(),
    resetMockRulesToDefault: vi.fn(),
    rpcSessionStats: {
      tabId: 'tab-1',
      windowStartedAt: '2026-07-01T00:00:00.000Z',
      byMethodKey: {},
    },
    rpcSessionSummary: {
      totalCalls: 0,
      totalErrors: 0,
      successRatePercent: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
    },
    resetRpcSessionStats: vi.fn(),
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
  function makeSingleChangeReport() {
    return {
      leftDescriptorKey: 'base',
      rightDescriptorKey: 'cand',
      generatedAt: '2026-06-30T00:00:00.000Z',
      summary: { breaking: 1, nonBreaking: 0, informational: 0 },
      changes: [{
        severity: 'breaking' as const,
        entityType: 'method' as const,
        entityPath: 'echo.EchoService/Echo',
        changeType: 'removed' as const,
        description: 'RPC removed',
      }],
    };
  }

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
        lastReport: makeSingleChangeReport(),
      },
    })} />);
    expect(screen.getByTestId('grpc-schema-diff-results')).toBeTruthy();
    expect(screen.getByTestId('grpc-schema-diff-change-list')).toBeTruthy();
  });

  it('exposes accessibility metadata for schema diff list', () => {
    render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      schemaDiff: {
        severityFilter: 'all',
        lastReport: makeSingleChangeReport(),
      },
    })} />);

    const list = screen.getByTestId('grpc-schema-diff-change-list');
    expect(list.getAttribute('role')).toBe('list');
    expect(screen.getByTestId('grpc-schema-diff-a11y-summary')).toBeTruthy();
    const row = screen.getByTestId('grpc-schema-diff-change-row');
    expect(row.getAttribute('role')).toBe('listitem');
  });

  it('shows status error detail and export error hint', () => {
    render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      runtime: {
        loadTest: { status: 'idle' },
        mockServer: { status: 'idle' },
        schemaDiff: {
          status: 'failed',
          error: { code: 'GRPC_INVALID_DESCRIPTOR', message: 'Descriptor invalid' },
        },
      },
      advancedExportError: 'Unable to export diff report',
      schemaDiff: {
        severityFilter: 'all',
        lastReport: makeSingleChangeReport(),
      },
    })} />);

    expect(screen.getByTestId('grpc-schema-diff-status').textContent).toContain('Descriptor invalid');
    expect(screen.getByTestId('grpc-schema-diff-export-error').textContent).toContain('Unable to export diff report');
  });

  it('shows clear-baseline action when baseline exists and clears it', async () => {
    const clearSchemaBaseline = vi.fn();
    render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      clearSchemaBaseline,
      schemaDiff: {
        baselineDescriptor: { key: 'base-key', source: 'proto_files' },
        baselineCapturedAt: '2026-06-30T00:00:00.000Z',
        severityFilter: 'all',
        lastReport: makeSingleChangeReport(),
      },
    })} />);

    await userEvent.click(screen.getByTestId('grpc-schema-diff-clear-baseline'));
    expect(clearSchemaBaseline).toHaveBeenCalledTimes(1);
  });

  it('updates schema-diff filters from controls', async () => {
    const setSchemaDiffSeverityFilter = vi.fn();
    const setSchemaDiffHideAcknowledged = vi.fn();
    render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      setSchemaDiffSeverityFilter,
      setSchemaDiffHideAcknowledged,
      schemaDiff: {
        severityFilter: 'all',
        hideAcknowledged: false,
        lastReport: makeSingleChangeReport(),
      },
    })} />);

    selectOption(screen.getByTestId('grpc-schema-diff-severity-filter'), 'Breaking only');
    expect(setSchemaDiffSeverityFilter).toHaveBeenCalledWith('breaking');

    await userEvent.click(screen.getByTestId('grpc-schema-diff-hide-acknowledged'));
    expect(setSchemaDiffHideAcknowledged).toHaveBeenCalledWith(true);
  });

  it('acknowledges and unacknowledges schema-diff changes', async () => {
    const acknowledgeSchemaDiffChange = vi.fn().mockResolvedValue(undefined);
    const unacknowledgeSchemaDiffChange = vi.fn().mockResolvedValue(undefined);
    const report = makeSingleChangeReport();

    const { rerender } = render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      acknowledgeSchemaDiffChange,
      unacknowledgeSchemaDiffChange,
      isSchemaDiffChangeAcknowledged: vi.fn().mockReturnValue(false),
      schemaDiff: {
        severityFilter: 'all',
        lastReport: report,
      },
    })} />);

    await userEvent.click(screen.getByTestId('grpc-schema-diff-ack-btn'));
    expect(acknowledgeSchemaDiffChange).toHaveBeenCalledWith(report.changes[0]);

    rerender(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      acknowledgeSchemaDiffChange,
      unacknowledgeSchemaDiffChange,
      isSchemaDiffChangeAcknowledged: vi.fn().mockReturnValue(true),
      schemaDiff: {
        severityFilter: 'all',
        lastReport: report,
      },
    })} />);

    expect(screen.getByTestId('grpc-schema-diff-ack-btn').textContent).toContain('Unacknowledge');
    await userEvent.click(screen.getByTestId('grpc-schema-diff-ack-btn'));
    expect(unacknowledgeSchemaDiffChange).toHaveBeenCalledWith(report.changes[0]);
  });

  it('hides acknowledged changes and shows empty-state message', () => {
    const report = makeSingleChangeReport();
    render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      schemaDiffAckChangeIds: new Set(['method::echo.EchoService/Echo::removed']),
      schemaDiff: {
        severityFilter: 'all',
        hideAcknowledged: true,
        lastReport: report,
      },
    })} />);

    expect(screen.queryByTestId('grpc-schema-diff-change-row')).toBeNull();
    expect(screen.getByText('No changes match the selected filter.')).toBeTruthy();
  });

  it('virtualizes very large schema diff lists', () => {
    const manyChanges = Array.from({ length: 220 }, (_, index) => ({
      severity: 'informational' as const,
      entityType: 'field' as const,
      entityPath: `echo.EchoService/field_${index}`,
      changeType: 'modified' as const,
      description: `Field ${index} changed`,
    }));

    render(<GrpcSchemaDiffPanel advanced={makeAdvancedStub({
      schemaDiff: {
        severityFilter: 'all',
        lastReport: {
          leftDescriptorKey: 'base',
          rightDescriptorKey: 'cand',
          generatedAt: '2026-06-30T00:00:00.000Z',
          summary: { breaking: 0, nonBreaking: 0, informational: manyChanges.length },
          changes: manyChanges,
        },
      },
    })} />);

    const list = screen.getByTestId('grpc-schema-diff-change-list');
    expect(list.className).toContain('grpc-advanced-diff-list--virtual');
    const renderedRows = screen.getAllByTestId('grpc-schema-diff-change-row');
    expect(renderedRows.length).toBeLessThan(manyChanges.length);
    expect(renderedRows.length).toBeGreaterThan(0);
  });

  it('keeps rows visible when virtualized list shrinks', async () => {
    const manyChanges = Array.from({ length: 220 }, (_, index) => ({
      severity: 'informational' as const,
      entityType: 'field' as const,
      entityPath: `echo.EchoService/field_${index}`,
      changeType: 'modified' as const,
      description: `Field ${index} changed`,
    }));
    const fewChanges = Array.from({ length: 8 }, (_, index) => ({
      severity: 'informational' as const,
      entityType: 'field' as const,
      entityPath: `echo.EchoService/next_${index}`,
      changeType: 'modified' as const,
      description: `Next field ${index}`,
    }));

    const initial = makeAdvancedStub({
      schemaDiff: {
        severityFilter: 'all',
        lastReport: {
          leftDescriptorKey: 'base',
          rightDescriptorKey: 'cand',
          generatedAt: '2026-06-30T00:00:00.000Z',
          summary: { breaking: 0, nonBreaking: 0, informational: manyChanges.length },
          changes: manyChanges,
        },
      },
    });
    const { rerender } = render(<GrpcSchemaDiffPanel advanced={initial} />);

    const shrunk = makeAdvancedStub({
      schemaDiff: {
        severityFilter: 'all',
        lastReport: {
          leftDescriptorKey: 'base',
          rightDescriptorKey: 'cand',
          generatedAt: '2026-06-30T00:00:01.000Z',
          summary: { breaking: 0, nonBreaking: 0, informational: fewChanges.length },
          changes: fewChanges,
        },
      },
    });
    rerender(<GrpcSchemaDiffPanel advanced={shrunk} />);

    const renderedRows = screen.getAllByTestId('grpc-schema-diff-change-row');
    expect(renderedRows.length).toBeGreaterThan(0);
  });
});

describe('GrpcAdvancedFeaturesShell (Phase 11G)', () => {
  it('switches advanced sub-tabs', async () => {
    const setActiveFeatureTab = vi.fn();
    render(<GrpcAdvancedFeaturesShell advanced={makeAdvancedStub({ setActiveFeatureTab })} />);
    await userEvent.click(screen.getByTestId('grpc-advanced-tab-mock_server'));
    expect(setActiveFeatureTab).toHaveBeenCalledWith('mock_server');

    await userEvent.click(screen.getByTestId('grpc-advanced-tab-native_diagnostics'));
    expect(setActiveFeatureTab).toHaveBeenCalledWith('native_diagnostics');
  });
});
