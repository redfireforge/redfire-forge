/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { selectOption } from '../../../test-utils/customSelectHelper';
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
import { GrpcRpcStatisticsPanel } from './GrpcRpcStatisticsPanel';

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
    activeTabId: 'tab-ui',
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
    exportLoadTestJson: vi.fn(() => '{"kind":"grpc_load_test_summary"}'),
    exportLoadTestCsv: vi.fn(() => 'metric,value'),
    exportSchemaDiffJson: vi.fn(() => '{"changes":[]}'),
    exportSchemaDiffMarkdown: vi.fn(() => '# diff'),
    exportMockRulesJson: vi.fn(() => '{"rules":[]}'),
    advancedExportError: undefined,
    clearAdvancedExportError: vi.fn(),
    resetMockRulesToDefault: vi.fn(),
    rpcSessionStats: {
      tabId: 'tab-ui',
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
        response: { statusCode: 0 },
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

    fireEvent.click(screen.getByTestId('grpc-mock-tab-json'));
    expect(screen.queryByTestId('grpc-mock-parse-error')).toBeNull();
    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    expect(screen.getByTestId('grpc-mock-rule-rule-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-mock-start-btn'));
    expect(startMockServer).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('grpc-mock-latency-default'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('grpc-mock-latency-jitter'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('grpc-mock-tab-json'));
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
    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    fireEvent.click(screen.getByTestId('grpc-mock-stop-btn'));
    expect(stopMockServer).toHaveBeenCalled();
    expect(screen.getByTestId('grpc-mock-generation').textContent).toContain('3');
  });

  it('GrpcMockServerPanel builder tab keeps UI when rules fail schema validation', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          patchMockRulesJson,
          mockServer: {
            rulesJson: JSON.stringify({
              rules: [{
                id: 'incomplete',
                name: 'Incomplete',
                enabled: true,
                priority: 1,
                predicate: { kind: 'method_equals', method: '' },
                response: { statusCode: 0 },
              }],
            }),
            parseError: 'rules[0].predicate.method: method is required.',
          },
        })}
      />,
    );
    expect(screen.getByTestId('grpc-mock-builder-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-builder-rule-incomplete')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-builder-validation')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-builder-start-blocked')).toBeTruthy();
    expect((screen.getByTestId('grpc-mock-start-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('GrpcMockServerPanel runtime tab lists rules from lenient parse when schema is invalid', () => {
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockServer: {
            rulesJson: JSON.stringify({
              rules: [{
                id: 'incomplete',
                name: 'Incomplete',
                enabled: true,
                priority: 1,
                predicate: { kind: 'method_equals', method: '' },
                response: { statusCode: 0 },
              }],
            }),
            parseError: 'rules[0].predicate.method: method is required.',
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    // Lenient parse lists structurally valid rules; enabled flag is not schema-derived.
    expect(screen.getByText(/1 enabled \/ 1 total/i)).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-rule-incomplete')).toBeTruthy();
  });

  it('GrpcMockServerPanel builder tab adds rules via patchMockRulesJson', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          patchMockRulesJson,
          mockServer: { rulesJson: '{\n  "rules": []\n}' },
        })}
      />,
    );
    expect(screen.getByTestId('grpc-mock-builder-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-mock-builder-add-rule'));
    expect(patchMockRulesJson).toHaveBeenCalled();
  });

  it('GrpcMockServerPanel builder tab shows read-only expression predicates', () => {
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockServer: {
            rulesJson: JSON.stringify({
              rules: [{
                id: 'expr-1',
                name: 'Expr rule',
                enabled: true,
                priority: 1,
                predicate: { kind: 'expression', expression: 'method == "Echo"' },
                response: { statusCode: 0 },
              }],
            }),
          },
        })}
      />,
    );
    expect(screen.getByTestId('grpc-mock-builder-readonly-rule-expr-1')).toBeTruthy();
    expect(screen.getByText(/Edit this predicate in the JSON editor/i)).toBeTruthy();
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
    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
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
    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
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
    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    fireEvent.change(screen.getByTestId('grpc-mock-latency-jitter'), { target: { value: 'abc' } });
    expect(patchMockLatency).toHaveBeenCalledWith({ jitterMs: undefined });
  });

  it('GrpcMockServerPanel handles disabled rules', () => {
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
                response: { statusCode: 0 },
              }],
            }),
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    expect(screen.getByTestId('grpc-mock-rule-rule-off').className).not.toMatch(/--on/);
  });

  it('GrpcMockServerPanel shows empty rule list hint on runtime tab', () => {
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockServer: { rulesJson: '{"rules":[]}' },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
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
    selectOption(screen.getByTestId('grpc-schema-diff-severity-filter'), 'Breaking only');
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

  it('GrpcSchemaDiffPanel keeps full large diff list available for virtualization', () => {
    const totalChanges = 501;
    const changes = Array.from({ length: totalChanges }, (_, index) => ({
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
              summary: { breaking: 0, nonBreaking: 0, informational: totalChanges },
              changes,
            },
          },
        })}
      />,
    );
    expect(screen.queryByTestId('grpc-schema-diff-truncated')).toBeNull();
    expect(screen.getByTestId('grpc-schema-diff-a11y-summary').textContent).toContain(`Schema diff contains ${totalChanges} changes`);
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

    rerender(
      <GrpcAdvancedFeaturesShell
        advanced={buildAdvancedMock({ activeFeatureTab: 'rpc_statistics' })}
      />,
    );
    expect(screen.getByTestId('grpc-rpc-stats-panel')).toBeTruthy();

    rerender(
      <GrpcAdvancedFeaturesShell
        advanced={buildAdvancedMock({ activeFeatureTab: 'native_diagnostics' })}
      />,
    );
    expect(screen.getByTestId('grpc-native-diagnostics-panel')).toBeTruthy();
  });

  it('GrpcRpcStatisticsPanel renders summary, table rows, and reset control', async () => {
    const resetRpcSessionStats = vi.fn();
    render(
      <GrpcRpcStatisticsPanel
        advanced={buildAdvancedMock({
          activeTabLabel: 'Echo tab',
          activeRpcLabel: 'echo.EchoService / Echo',
          resetRpcSessionStats,
          rpcSessionSummary: {
            totalCalls: 3,
            totalErrors: 1,
            successRatePercent: 66.7,
            avgLatencyMs: 55,
            p95LatencyMs: 90,
          },
          rpcSessionStats: {
            tabId: 'tab-ui',
            windowStartedAt: '2026-07-01T00:00:00.000Z',
            byMethodKey: {
              'echo.EchoService/Echo': {
                service: 'echo.EchoService',
                method: 'Echo',
                callType: 'unary',
                calls: 3,
                errors: 1,
                statusDistribution: { '0': 2, '14': 1 },
                latencyMs: {
                  min: 20,
                  avg: 55,
                  p50: 50,
                  p95: 90,
                  p99: 95,
                  max: 100,
                },
              },
            },
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-rpc-stats-total-calls').textContent).toBe('3');
    expect(screen.getByTestId('grpc-rpc-stats-table')).toBeTruthy();
    expect(screen.getAllByTestId('grpc-rpc-stats-row')).toHaveLength(1);
    await userEvent.click(screen.getByTestId('grpc-rpc-stats-reset-btn'));
    expect(resetRpcSessionStats).toHaveBeenCalledTimes(1);
  });
});
