/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import { GrpcNativeDiagnosticsPanel } from './GrpcNativeDiagnosticsPanel';

const invokeDiagnostics = vi.fn();
const isTauriMock = vi.fn(() => true);

vi.mock('../../../shared/grpc/grpcNativeTauriDiagnostics', () => ({
  invokeGrpcNativeDiagnosticsNative: (...args: unknown[]) => invokeDiagnostics(...args),
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => isTauriMock(),
}));

function makeAdvancedStub(
  overrides: Partial<UseGrpcStudioAdvancedFeaturesReturn> = {},
): UseGrpcStudioAdvancedFeaturesReturn {
  const initial = createInitialGrpcTabAdvancedFeaturesUiState();
  return {
    activeFeatureTab: 'native_diagnostics',
    runtime: initial.runtime,
    loadTest: initial.loadTest,
    mockServer: initial.mockServer,
    schemaDiff: initial.schemaDiff,
    loadTestValidationError: undefined,
    loadTestRunning: false,
    mockRunning: false,
    resolvedMockConfig: { source: 'workspace_default', ruleSet: { rules: [] }, tabId: 'tab-a' },
    mockManagerState: undefined,
    activeTabLabel: 'Tab A',
    activeTabId: 'tab-a',
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
    applySchemaDiffComparison: vi.fn(),
    exportLoadTestJson: vi.fn(),
    exportLoadTestCsv: vi.fn(),
    exportSchemaDiffJson: vi.fn(),
    exportSchemaDiffMarkdown: vi.fn(),
    exportMockRulesJson: vi.fn(),
    advancedExportError: undefined,
    clearAdvancedExportError: vi.fn(),
    resetMockRulesToDefault: vi.fn(),
    rpcSessionStats: {
      tabId: 'tab-a',
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
  } as UseGrpcStudioAdvancedFeaturesReturn;
}

describe('GrpcNativeDiagnosticsPanel', () => {
  beforeEach(() => {
    invokeDiagnostics.mockReset();
    isTauriMock.mockReturnValue(true);
  });

  it('shows unavailable message on non-tauri runtime', () => {
    isTauriMock.mockReturnValue(false);
    render(<GrpcNativeDiagnosticsPanel advanced={makeAdvancedStub()} />);
    expect(screen.getByTestId('grpc-native-diagnostics-unavailable')).toBeTruthy();
    expect((screen.getByTestId('grpc-native-diagnostics-refresh') as HTMLButtonElement).disabled).toBe(true);
  });

  it('loads snapshot and copies json', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    invokeDiagnostics.mockResolvedValueOnce({
      transportUsed: 'tauri',
      tabId: 'tab-a',
      channelPool: { size: 1, capacity: 32, hitCountTotal: 0 },
      calls: { total: 1, active: 0, completed: 1, cancelled: 0 },
      streams: { total: 1, active: 0, ended: 1, cancelled: 0, error: 0 },
      listeners: { attachedTabs: 1, detachedTabs: 0, staleAttachedTabs: 0, totalListenerCount: 1 },
      taxonomy: { state: 'healthy', activeIssueCodes: [] },
    });

    render(<GrpcNativeDiagnosticsPanel advanced={makeAdvancedStub()} />);
    fireEvent.click(screen.getByTestId('grpc-native-diagnostics-refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-native-diagnostics-json')).toBeTruthy();
    });
    expect(invokeDiagnostics).toHaveBeenCalledWith('tab-a');

    fireEvent.click(screen.getByTestId('grpc-native-diagnostics-copy'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });

  it('surfaces refresh errors', async () => {
    invokeDiagnostics.mockRejectedValueOnce(new Error('ipc down'));

    render(<GrpcNativeDiagnosticsPanel advanced={makeAdvancedStub()} />);
    fireEvent.click(screen.getByTestId('grpc-native-diagnostics-refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-native-diagnostics-error').textContent).toContain('ipc down');
    });
  });
});
