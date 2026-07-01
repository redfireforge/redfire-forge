/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
} from '../../../shared/grpc/contractFixtures';
import { buildGrpcLoadTestRunSummaryExport } from '../../../shared/grpc/grpcLoadTestMetrics';
import { captureGrpcLoadTestExecuteSnapshot } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { computeGrpcStudioSchemaDiffReport } from '../utils/grpcStudioAdvancedCommands';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import { GrpcAdvancedFeaturesShell } from './GrpcAdvancedFeaturesShell';
import { GrpcLoadTestPanel } from './GrpcLoadTestPanel';
import { GrpcMockServerPanel } from './GrpcMockServerPanel';
import { GrpcSchemaDiffPanel } from './GrpcSchemaDiffPanel';

function makeSummary() {
  return buildGrpcLoadTestRunSummaryExport({
    snapshot: captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-ui',
      executeSnapshot: {
        tabId: 'tab-ui',
        requestId: 'req-ui',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      config: { concurrency: 2, totalCalls: 4 },
    }),
    report: {
      runId: 'run-ui',
      startedAt: '2026-07-01T00:00:00.000Z',
      completedAt: '2026-07-01T00:00:02.000Z',
      durationMs: 2000,
      stopReason: 'completed_total_calls',
      counts: {
        scheduled: 4,
        completed: 4,
        succeeded: 3,
        failed: 1,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 2,
      },
      attempts: [],
    },
  });
}

function buildAdvancedMock(
  patch: Partial<UseGrpcStudioAdvancedFeaturesReturn> = {},
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
    resolvedMockConfig: { source: 'workspace_default', ruleSet: { rules: [] }, tabId: 'tab-ui' },
    mockManagerState: undefined,
    activeTabLabel: 'Echo tab',
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
    exportLoadTestJson: vi.fn(() => '{"kind":"grpc_load_test_summary"}'),
    exportLoadTestCsv: vi.fn(() => 'metric,value'),
    exportSchemaDiffJson: vi.fn(() => '{"changes":[]}'),
    exportSchemaDiffMarkdown: vi.fn(() => '# diff'),
    resetMockRulesToDefault: vi.fn(),
    ...patch,
  } as UseGrpcStudioAdvancedFeaturesReturn;
}

describe('Grpc advanced panels coverage gaps', () => {
  it('GrpcLoadTestPanel renders idle, running, live, summary, and validation states', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const startLoadTest = vi.fn();
    const cancelLoadTest = vi.fn();
    const patchLoadTestConfig = vi.fn();
    const resetLoadTestStatus = vi.fn();

    const { rerender } = render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          startLoadTest,
          patchLoadTestConfig,
          loadTestValidationError: 'Need unary RPC',
        })}
      />,
    );
    expect(screen.getByTestId('grpc-load-test-validation-error').textContent).toMatch(/unary RPC/i);
    expect((screen.getByTestId('grpc-load-test-start-btn') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('grpc-load-test-start-btn'));
    expect(startLoadTest).not.toHaveBeenCalled();

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          startLoadTest,
          cancelLoadTest,
          patchLoadTestConfig,
          resetLoadTestStatus,
          loadTestRunning: true,
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: {
              status: 'running',
              cancellationRequested: false,
              operationId: 'op-1',
              error: { category: 'runtime', message: 'worker stalled' },
            },
          },
          loadTest: {
            config: { concurrency: 2, totalCalls: 10, durationMs: 5000, rampUpMs: 100, warmupCalls: 1 },
            live: {
              counts: {
                scheduled: 10,
                completed: 4,
                succeeded: 4,
                failed: 0,
                warmupScheduled: 1,
                warmupCompleted: 1,
                peakInFlight: 2,
              },
              progressPercent: 40,
            },
            lastSummary: makeSummary(),
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-load-test-stop-btn')).toBeTruthy();
    expect(screen.getByTestId('grpc-load-test-live-completed').textContent).toBe('4');
    expect(screen.getByText(/worker stalled/i)).toBeTruthy();
    expect(screen.queryByTestId('grpc-load-test-export-json')).toBeNull();
    expect(screen.queryByTestId('grpc-load-test-summary-metrics')).toBeNull();

    fireEvent.change(screen.getByTestId('grpc-load-test-concurrency'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('grpc-load-test-total-calls'), { target: { value: '20' } });
    fireEvent.change(screen.getByTestId('grpc-load-test-duration'), { target: { value: '6000' } });
    fireEvent.change(screen.getByTestId('grpc-load-test-ramp-up'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('grpc-load-test-warmup'), { target: { value: '2' } });
    expect(patchLoadTestConfig).toHaveBeenCalled();

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          resetLoadTestStatus,
          exportLoadTestJson: vi.fn(() => '{"kind":"grpc_load_test_summary"}'),
          exportLoadTestCsv: vi.fn(() => 'measuredAttemptsPerSecond'),
          loadTest: {
            config: { concurrency: 2, totalCalls: 4 },
            lastSummary: makeSummary(),
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: { status: 'completed', cancellationRequested: false },
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-load-test-export-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-export-csv'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalled();

    rerender(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          resetLoadTestStatus,
          loadTest: {
            config: { concurrency: 2, totalCalls: 4 },
            lastSummary: makeSummary(),
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            loadTest: { status: 'completed', cancellationRequested: false },
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-load-test-reset-status'));
    expect(resetLoadTestStatus).toHaveBeenCalled();
    expect(screen.getByTestId('grpc-load-test-summary-metrics')).toBeTruthy();
  });

  it('GrpcLoadTestPanel ignores invalid numeric input and omits optional RPC label', () => {
    const patchLoadTestConfig = vi.fn();
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          activeRpcLabel: undefined,
          patchLoadTestConfig,
        })}
      />,
    );
    expect(screen.getByTestId('grpc-load-test-panel').textContent).not.toMatch(/EchoService \/ Echo/);

    fireEvent.change(screen.getByTestId('grpc-load-test-concurrency'), { target: { value: '' } });
    expect(patchLoadTestConfig).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('grpc-load-test-total-calls'), { target: { value: 'abc' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ totalCalls: undefined });
  });

  it('GrpcLoadTestPanel skips clipboard copy when export helpers return empty', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          loadTest: {
            config: { concurrency: 2, totalCalls: 4 },
            lastSummary: makeSummary(),
          },
          exportLoadTestJson: vi.fn(() => undefined),
          exportLoadTestCsv: vi.fn(() => undefined),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-load-test-export-json'));
    fireEvent.click(screen.getByTestId('grpc-load-test-export-csv'));
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('GrpcLoadTestPanel parses non-negative ramp-up and warmup values', () => {
    const patchLoadTestConfig = vi.fn();
    render(
      <GrpcLoadTestPanel
        advanced={buildAdvancedMock({
          patchLoadTestConfig,
          loadTest: { config: { concurrency: 2 } },
        })}
      />,
    );
    expect((screen.getByTestId('grpc-load-test-total-calls') as HTMLInputElement).value).toBe('');

    fireEvent.change(screen.getByTestId('grpc-load-test-ramp-up'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('grpc-load-test-warmup'), { target: { value: '-1' } });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ rampUpMs: 0 });
    expect(patchLoadTestConfig).toHaveBeenCalledWith({ warmupCalls: undefined });
  });

  it('GrpcMockServerPanel renders rules, latency edits, and runtime controls', () => {
    const patchMockRulesJson = vi.fn();
    const patchMockLatency = vi.fn();
    const startMockServer = vi.fn();
    const stopMockServer = vi.fn();
    const resetMockRulesToDefault = vi.fn();

    const rulesJson = JSON.stringify({
      rules: [{
        id: 'rule-1',
        name: 'Echo ok',
        enabled: true,
        priority: 1,
        predicate: { kind: 'method_equals', method: 'Echo' },
        response: { status: 0 },
      }],
    }, null, 2);

    const { rerender } = render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          patchMockRulesJson,
          patchMockLatency,
          startMockServer,
          resetMockRulesToDefault,
          mockServer: {
            rulesJson,
            latencyPolicy: { defaultLatencyMs: 5, jitterMs: 1 },
            parseError: 'bad json',
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            mockRuntime: {
              status: 'failed',
              cancellationRequested: false,
              error: { category: 'runtime', message: 'start failed' },
            },
          },
          resolvedMockConfig: {
            source: 'tab_override',
            ruleSet: { rules: [] },
            tabId: 'tab-ui',
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-mock-parse-error')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-rule-rule-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-mock-start-btn'));
    expect(startMockServer).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('grpc-mock-latency-default'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('grpc-mock-latency-jitter'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('grpc-mock-rules-json'), {
      target: { value: '{"rules":[]}' },
    });
    expect(patchMockLatency).toHaveBeenCalled();
    expect(patchMockRulesJson).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('grpc-mock-reset-rules'));
    expect(resetMockRulesToDefault).toHaveBeenCalled();

    rerender(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          stopMockServer,
          resetMockRulesToDefault,
          mockRunning: true,
          mockManagerState: { committed: { generation: 3, ruleSet: { rules: [] } } } as never,
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            mockRuntime: { status: 'running', cancellationRequested: true, operationId: 'mock-1' },
          },
          mockServer: { rulesJson, latencyPolicy: { defaultLatencyMs: 5 } },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-mock-stop-btn'));
    expect(stopMockServer).toHaveBeenCalled();
    expect(screen.getByTestId('grpc-mock-generation').textContent).toContain('3');
  });

  it('GrpcMockServerPanel handles invalid rules JSON fallback and non-finite latency input', async () => {
    const patchMockLatency = vi.fn();
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          patchMockLatency,
          mockServer: { rulesJson: '{' },
        })}
      />,
    );
    expect(screen.getByText(/0 enabled \/ 0 total/i)).toBeTruthy();

    await userEvent.type(screen.getByTestId('grpc-mock-latency-jitter'), '2');
    expect(patchMockLatency).toHaveBeenCalled();
  });

  it('GrpcMockServerPanel clears invalid default latency input', () => {
    const patchMockLatency = vi.fn();
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          patchMockLatency,
          mockServer: { rulesJson: '{"rules":[]}', latencyPolicy: { defaultLatencyMs: 5 } },
        })}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-mock-latency-default'), { target: { value: 'abc' } });
    expect(patchMockLatency).toHaveBeenCalledWith({ defaultLatencyMs: undefined });

    fireEvent.change(screen.getByTestId('grpc-mock-latency-jitter'), { target: { value: 'abc' } });
    expect(patchMockLatency).toHaveBeenCalledWith({ jitterMs: undefined });
  });

  it('GrpcMockServerPanel clears invalid jitter latency input', () => {
    const patchMockLatency = vi.fn();
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          patchMockLatency,
          mockServer: { rulesJson: '{"rules":[]}', latencyPolicy: { jitterMs: 2 } },
        })}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-mock-latency-jitter'), { target: { value: 'abc' } });
    expect(patchMockLatency).toHaveBeenCalledWith({ jitterMs: undefined });
  });

  it('GrpcMockServerPanel handles disabled rules and empty rule list hint', () => {
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockServer: {
            rulesJson: JSON.stringify({
              rules: [{
                id: 'rule-off',
                name: 'Disabled',
                enabled: false,
                priority: 1,
                predicate: { kind: 'service_equals', service: 'echo.EchoService' },
                response: { status: 0 },
              }],
            }),
          },
        })}
      />,
    );
    expect(screen.getByTestId('grpc-mock-rule-rule-off').className).not.toMatch(/--on/);

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockServer: { rulesJson: '{"rules":[]}' },
        })}
      />,
    );
    expect(screen.getByText(/No rules configured/i)).toBeTruthy();
  });

  it('GrpcSchemaDiffPanel renders baseline, report, filters, and exports', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const report = computeGrpcStudioSchemaDiffReport({
      baseline: FIXTURE_DESCRIPTOR,
      candidate: {
        ...FIXTURE_DESCRIPTOR,
        services: FIXTURE_DESCRIPTOR.services.slice(0, 1),
      },
    });

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          captureSchemaBaseline: vi.fn(),
          runSchemaDiff: vi.fn(),
          clearSchemaBaseline: vi.fn(),
          setSchemaDiffSeverityFilter: vi.fn(),
          schemaDiff: {
            severityFilter: 'all',
            baselineDescriptor: FIXTURE_DESCRIPTOR,
            baselineCapturedAt: '2026-07-01T00:00:00.000Z',
            lastReport: report,
          },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            schemaDiff: {
              status: 'completed',
              cancellationRequested: false,
              error: { category: 'runtime', message: 'compare failed' },
            },
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-diff-capture-baseline'));
    fireEvent.click(screen.getByTestId('grpc-schema-diff-compare-btn'));
    fireEvent.click(screen.getByTestId('grpc-schema-diff-clear-baseline'));
    fireEvent.change(screen.getByTestId('grpc-schema-diff-severity-filter'), { target: { value: 'breaking' } });
    fireEvent.click(screen.getByTestId('grpc-schema-diff-export-json'));
    fireEvent.click(screen.getByTestId('grpc-schema-diff-export-markdown'));
    await Promise.resolve();

    expect(screen.getByTestId('grpc-schema-diff-results')).toBeTruthy();
    expect(screen.getByTestId('grpc-schema-diff-summary')).toBeTruthy();
    expect(writeText).toHaveBeenCalled();
  });

  it('GrpcSchemaDiffPanel shows empty filtered list message', () => {
    const report = computeGrpcStudioSchemaDiffReport({
      baseline: FIXTURE_DESCRIPTOR,
      candidate: FIXTURE_DESCRIPTOR,
    });
    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: {
            severityFilter: 'breaking',
            lastReport: report,
          },
        })}
      />,
    );
    expect(screen.getByText(/No changes match the selected filter/i)).toBeTruthy();
  });

  it('GrpcSchemaDiffPanel shows truncated diff banner for large reports', () => {
    const changes = Array.from({ length: 501 }, (_, index) => ({
      severity: 'informational' as const,
      entityType: 'field' as const,
      entityPath: `msg.f${index}`,
      changeType: 'doc_comment_changed' as const,
      description: `change ${index}`,
    }));
    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: {
            severityFilter: 'all',
            lastReport: {
              leftDescriptorKey: 'left',
              rightDescriptorKey: 'right',
              generatedAt: '2026-07-01T00:00:00.000Z',
              summary: { breaking: 0, nonBreaking: 0, informational: 501 },
              changes,
            },
          },
        })}
      />,
    );
    expect(screen.getByTestId('grpc-schema-diff-truncated')).toBeTruthy();
  });

  it('GrpcSchemaDiffPanel skips clipboard copy when export helpers return empty', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const report = computeGrpcStudioSchemaDiffReport({
      baseline: FIXTURE_DESCRIPTOR,
      candidate: FIXTURE_DESCRIPTOR,
    });

    render(
      <GrpcSchemaDiffPanel
        advanced={buildAdvancedMock({
          schemaDiff: { severityFilter: 'all', lastReport: report },
          exportSchemaDiffJson: vi.fn(() => undefined),
          exportSchemaDiffMarkdown: vi.fn(() => undefined),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-schema-diff-export-json'));
    fireEvent.click(screen.getByTestId('grpc-schema-diff-export-markdown'));
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('GrpcAdvancedFeaturesShell switches between advanced tabs', () => {
    const setActiveFeatureTab = vi.fn();
    const advanced = buildAdvancedMock({ setActiveFeatureTab });

    const { rerender } = render(<GrpcAdvancedFeaturesShell advanced={advanced} />);
    expect(screen.getByTestId('grpc-load-test-panel')).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-advanced-tab-mock_server'));
    expect(setActiveFeatureTab).toHaveBeenCalledWith('mock_server');

    rerender(
      <GrpcAdvancedFeaturesShell
        advanced={buildAdvancedMock({ activeFeatureTab: 'mock_server' })}
      />,
    );
    expect(screen.getByTestId('grpc-mock-server-panel')).toBeTruthy();

    rerender(
      <GrpcAdvancedFeaturesShell
        advanced={buildAdvancedMock({ activeFeatureTab: 'schema_diff' })}
      />,
    );
    expect(screen.getByTestId('grpc-schema-diff-panel')).toBeTruthy();
  });
});
