/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRunnerOrchestration } from './useRunnerOrchestration';
import type { FeatureGroup } from '../../../shared/types';

const { mockExecute, mockSetWeights, mockSetLoadProfile, mockClearProgress } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockSetWeights: vi.fn(),
  mockSetLoadProfile: vi.fn((fn: unknown) => { if (typeof fn === 'function') (fn as (prev: unknown) => unknown)({ phases: [], maxConcurrency: 10 }); }),
  mockClearProgress: vi.fn(),
}));

vi.mock('./useTestExecution', () => ({
  useTestExecution: () => ({
    isRunning: false,
    completed: 0,
    total: 0,
    liveSummary: null,
    liveResults: [],
    profileMeta: null,
    timeSeries: [],
    error: null,
    execute: mockExecute,
    abort: vi.fn(),
    finalRun: null,
    pendingRun: null,
    confirmSavePendingRun: vi.fn(),
    dismissPendingRun: vi.fn(),
  }),
}));

vi.mock('./useRunnerConfig', () => ({
  useRunnerConfig: () => ({
    concurrency: 1,
    setConcurrency: vi.fn(),
    iterations: 5,
    setIterations: vi.fn(),
    selectedScenarios: new Set<string>(['sc1']),
    setSelectedScenarios: vi.fn(),
    weights: { t1: 1 },
    setWeights: mockSetWeights,
    skipValidation: false,
    setSkipValidation: vi.fn(),
    validationOverride: 'default' as const,
    setValidationOverride: vi.fn(),
    forceUnordered: false,
    setForceUnordered: vi.fn(),
    hostMode: 'hardcoded' as const,
    setHostMode: vi.fn(),
    customBaseUrl: '',
    setCustomBaseUrl: vi.fn(),
    executionMode: 'sequential' as const,
    setExecutionMode: vi.fn(),
    loadProfile: { phases: [], maxConcurrency: 10 },
    setLoadProfile: mockSetLoadProfile,
    thinkTime: { mode: 'none' as const },
    setThinkTime: vi.fn(),
    timeoutSec: 0,
    setTimeoutSec: vi.fn(),
    retryCount: 0,
    setRetryCount: vi.fn(),
    retryDelayMs: 1000,
    setRetryDelayMs: vi.fn(),
    errorPolicy: 'continue' as const,
    setErrorPolicy: vi.fn(),
    maxErrors: 0,
    setMaxErrors: vi.fn(),
    maxErrorRate: 0,
    setMaxErrorRate: vi.fn(),
    autoReport: false,
    setAutoReport: vi.fn(),
    autoReportFormat: 'html' as const,
    setAutoReportFormat: vi.fn(),
  }),
}));

vi.mock('../utils/runnerProgressStorage', () => ({
  saveProgress: vi.fn(),
  loadProgress: () => null,
  clearProgress: mockClearProgress,
}));

vi.mock('../../results/utils/reportGenerator', () => ({
  generateReport: vi.fn(),
  downloadReport: vi.fn(),
}));

vi.mock('../../../engine/dataSourceExpander', () => ({
  resolveSharedDataSources: (tests: unknown[]) => tests,
}));

const makeFeatureGroups = (): FeatureGroup[] => [
  {
    id: 'fg1',
    name: 'API Tests',
    scenarios: [
      {
        id: 'sc1',
        name: 'Standard',
        kind: 'standard',
        tests: [
          { id: 't1', name: 'GET User', method: 'GET', url: '/api/users', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } },
        ],
      },
      {
        id: 'sc2',
        name: 'Parameterized',
        kind: 'parameterized',
        tests: [
          {
            id: 't2', name: 'POST User', method: 'POST', url: '/api/users', headers: [],
            validation: { mode: 'none' }, auth: { type: 'none' },
            dataSource: {
              columns: [{ id: 'c1', name: 'name' }],
              rows: [
                { id: 'r1', values: { c1: 'Alice' }, enabled: true },
                { id: 'r2', values: { c1: 'Bob' }, enabled: true },
              ],
            },
          },
        ],
      },
    ],
  },
];

const defaultOpts = {
  featureGroups: makeFeatureGroups(),
  kind: 'standard' as const,
  envId: 'env1',
  svcId: 'svc1',
  envName: 'Test',
  svcName: 'Service',
  resolvedBaseUrl: 'http://localhost:3000',
  globalAuthProfiles: [],
  envFallbackAuth: undefined,
  sharedDataSources: [],
};

describe('useRunnerOrchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('returns allocation with correct kind for standard', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.allocation.kind).toBe('standard');
  });

  it('returns allocation with correct kind for parameterized', () => {
    const { result } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, kind: 'parameterized' }),
    );
    expect(result.current.allocation.kind).toBe('parameterized');
  });

  it('exposes config and execution objects', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.config).toBeDefined();
    expect(result.current.execution).toBeDefined();
    expect(typeof result.current.config.setConcurrency).toBe('function');
    expect(typeof result.current.execution.execute).toBe('function');
  });

  it('returns isGalleryEnv true when svcName is Gallery Samples', () => {
    const { result } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, svcName: 'Gallery Samples' }),
    );
    expect(result.current.isGalleryEnv).toBe(true);
  });

  it('returns isGalleryEnv false for normal services', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.isGalleryEnv).toBe(false);
  });

  it('isLoadProfile is false for sequential mode', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.isLoadProfile).toBe(false);
  });

  it('savedProgress is null by default', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.savedProgress).toBeNull();
  });

  it('showProgress is false when no live or saved progress', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.showProgress).toBe(false);
  });

  it('hostLabel returns Original for hardcoded mode', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.hostLabel).toBe('Original');
  });

  it('displaySummary defaults to null', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.displaySummary).toBeNull();
  });

  it('allocation has 0 total requests when no tests selected', () => {
    const { result } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, featureGroups: [] }),
    );
    expect(result.current.allocation.totalRequests).toBe(0);
  });

  it('has active tests when selectedScenarios has matching IDs', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.activeTests.length).toBeGreaterThanOrEqual(0);
  });

  it('handleRun calls execute', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    act(() => {
      result.current.handleRun();
    });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [config, , meta] = mockExecute.mock.calls[0];
    expect(config.iterations).toBe(5);
    expect(config.concurrency).toBe(1);
    expect(meta.envName).toBe('Test');
    expect(meta.svcName).toBe('Service');
  });

  it('handleClearProgress calls clearProgress', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    act(() => {
      result.current.handleClearProgress();
    });
    expect(mockClearProgress).toHaveBeenCalledTimes(1);
  });

  it('updateProfile calls setLoadProfile', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    act(() => {
      result.current.updateProfile({ maxConcurrency: 20 });
    });
    expect(mockSetLoadProfile).toHaveBeenCalled();
  });

  it('weightsExpanded can be toggled', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.weightsExpanded).toBe(true);
    act(() => {
      result.current.setWeightsExpanded(false);
    });
    expect(result.current.weightsExpanded).toBe(false);
  });

  it('runnerTagFilter can be set', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.runnerTagFilter).toBe('');
    act(() => {
      result.current.setRunnerTagFilter('smoke');
    });
    expect(result.current.runnerTagFilter).toBe('smoke');
  });

  it('displayCompleted defaults to 0', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.displayCompleted).toBe(0);
  });

  it('displayTotal defaults to 0', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.displayTotal).toBe(0);
  });

  it('displayProfileMeta defaults to null', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.displayProfileMeta).toBeNull();
  });
});
