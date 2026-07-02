/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import { GrpcRpcStatisticsPanel } from './GrpcRpcStatisticsPanel';

function buildAdvancedMock(
  patch: Partial<UseGrpcStudioAdvancedFeaturesReturn> = {},
): UseGrpcStudioAdvancedFeaturesReturn {
  const initial = createInitialGrpcTabAdvancedFeaturesUiState();
  return {
    activeFeatureTab: 'rpc_statistics',
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
    activeRpcLabel: '',
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

describe('GrpcRpcStatisticsPanel coverage gaps', () => {
  it('renders empty state and disables reset when no calls recorded', () => {
    render(
      <GrpcRpcStatisticsPanel
        advanced={buildAdvancedMock({
          activeRpcLabel: undefined,
          rpcSessionSummary: {
            totalCalls: 0,
            totalErrors: 0,
            successRatePercent: 0,
            avgLatencyMs: Number.NaN,
            p95LatencyMs: -1,
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-rpc-stats-empty')).toBeTruthy();
    expect(screen.getByTestId('grpc-rpc-stats-avg-latency').textContent).toBe('0ms');
    expect((screen.getByTestId('grpc-rpc-stats-reset-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Tab: Echo tab$/)).toBeTruthy();
  });

  it('applies success metric modifiers for high success and error rates', () => {
    const { rerender } = render(
      <GrpcRpcStatisticsPanel
        advanced={buildAdvancedMock({
          rpcSessionSummary: {
            totalCalls: 10,
            totalErrors: 0,
            successRatePercent: 95,
            avgLatencyMs: 12.4,
            p95LatencyMs: 20,
          },
          rpcSessionStats: {
            tabId: 'tab-ui',
            windowStartedAt: '2026-07-01T00:00:00.000Z',
            byMethodKey: {
              'svc/Method': {
                service: 'svc',
                method: 'Method',
                callType: 'unary',
                calls: 10,
                errors: 0,
                statusDistribution: { '0': 10 },
                latencyMs: { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 },
              },
            },
          },
        })}
      />,
    );

    const okMetric = screen.getByTestId('grpc-rpc-stats-success-rate').closest('.grpc-rpc-stats-metric');
    expect(okMetric?.className).toContain('grpc-rpc-stats-metric--ok');

    rerender(
      <GrpcRpcStatisticsPanel
        advanced={buildAdvancedMock({
          rpcSessionSummary: {
            totalCalls: 4,
            totalErrors: 2,
            successRatePercent: 50,
            avgLatencyMs: 8,
            p95LatencyMs: 12,
          },
          rpcSessionStats: {
            tabId: 'tab-ui',
            windowStartedAt: '2026-07-01T00:00:00.000Z',
            byMethodKey: {
              'svc/Fail': {
                service: 'svc',
                method: 'Fail',
                callType: 'unary',
                calls: 4,
                errors: 2,
                statusDistribution: { '0': 2, '13': 2 },
                latencyMs: { min: 5, avg: 8, p50: 7, p95: 12, p99: 12, max: 12 },
              },
            },
          },
        })}
      />,
    );

    const errMetric = screen.getByTestId('grpc-rpc-stats-success-rate').closest('.grpc-rpc-stats-metric');
    expect(errMetric?.className).toContain('grpc-rpc-stats-metric--err');
    expect(screen.getByText('13: 2').className).toContain('grpc-rpc-stats-status-chip--err');
    expect(screen.getByText('0: 2').className).toContain('grpc-rpc-stats-status-chip--ok');
  });

  it('renders zero-width latency bars when average latency is non-positive', () => {
    render(
      <GrpcRpcStatisticsPanel
        advanced={buildAdvancedMock({
          activeRpcLabel: 'echo.EchoService / Echo',
          rpcSessionSummary: {
            totalCalls: 1,
            totalErrors: 0,
            successRatePercent: 100,
            avgLatencyMs: 0,
            p95LatencyMs: 0,
          },
          rpcSessionStats: {
            tabId: 'tab-ui',
            windowStartedAt: '2026-07-01T00:00:00.000Z',
            byMethodKey: {
              'echo.EchoService/Echo': {
                service: 'echo.EchoService',
                method: 'Echo',
                callType: 'unary',
                calls: 1,
                errors: 0,
                statusDistribution: { '0': 1 },
                latencyMs: { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 },
              },
            },
          },
        })}
      />,
    );

    const bar = document.querySelector('.grpc-rpc-stats-latency-bar') as HTMLSpanElement;
    expect(bar.style.width).toBe('0px');
    expect(screen.getByText(/Echo tab · echo\.EchoService \/ Echo/)).toBeTruthy();
  });

  it('invokes reset when session has recorded calls', () => {
    const resetRpcSessionStats = vi.fn();
    render(
      <GrpcRpcStatisticsPanel
        advanced={buildAdvancedMock({
          resetRpcSessionStats,
          rpcSessionSummary: {
            totalCalls: 2,
            totalErrors: 0,
            successRatePercent: 100,
            avgLatencyMs: 40,
            p95LatencyMs: 55,
          },
          rpcSessionStats: {
            tabId: 'tab-ui',
            windowStartedAt: '2026-07-01T00:00:00.000Z',
            byMethodKey: {
              'svc/Fast': {
                service: 'svc',
                method: 'Fast',
                callType: 'unary',
                calls: 2,
                errors: 0,
                statusDistribution: { '0': 2 },
                latencyMs: { min: 30, avg: 40, p50: 40, p95: 55, p99: 55, max: 55 },
              },
            },
          },
        })}
      />,
    );

    const bar = document.querySelector('.grpc-rpc-stats-latency-bar') as HTMLSpanElement;
    expect(Number.parseInt(bar.style.width, 10)).toBeGreaterThanOrEqual(4);
    fireEvent.click(screen.getByTestId('grpc-rpc-stats-reset-btn'));
    expect(resetRpcSessionStats).toHaveBeenCalledTimes(1);
  });
});
