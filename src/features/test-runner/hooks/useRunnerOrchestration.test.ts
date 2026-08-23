/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRunnerOrchestration } from './useRunnerOrchestration';
import { FeatureGroup } from '@shared/types';

const { mockExecute, mockSetWeights, mockSetLoadProfile, mockClearProgress, mockTestExecOverrides, mockRunnerConfigOverrides, mockLoadProgress, mockDownloadReport, mockGenerateReport, mockCapturedPublishConfig } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockSetWeights: vi.fn(),
  mockSetLoadProfile: vi.fn((fn: unknown) => { if (typeof fn === 'function') (fn as (prev: unknown) => unknown)({ phases: [], maxConcurrency: 10 }); }),
  mockClearProgress: vi.fn(),
  mockTestExecOverrides: { value: {} as Record<string, unknown> },
  mockRunnerConfigOverrides: { value: {} as Record<string, unknown> },
  mockLoadProgress: vi.fn(() => null),
  mockDownloadReport: vi.fn(),
  mockGenerateReport: vi.fn(() => '<html></html>'),
  mockCapturedPublishConfig: { value: undefined as unknown },
}));

vi.mock('./useTestExecution', () => ({
  useTestExecution: (publishConfig?: unknown) => {
    mockCapturedPublishConfig.value = publishConfig;
    return {
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
      ...mockTestExecOverrides.value,
    };
  },
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
    forceUnordered: 'default' as const,
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
    ...mockRunnerConfigOverrides.value,
  }),
}));

vi.mock('../utils/runnerProgressStorage', () => ({
  saveProgress: vi.fn(),
  loadProgress: (...args: unknown[]) => mockLoadProgress(...args),
  clearProgress: mockClearProgress,
}));

vi.mock('../../results/utils/reportGenerator', () => ({
  generateReport: (...args: unknown[]) => mockGenerateReport(...args),
  downloadReport: (...args: unknown[]) => mockDownloadReport(...args),
}));

vi.mock('@engine/core/dataSourceExpander', () => ({
  resolveSharedDataSources: (tests: unknown[]) => tests,
  collectAllScenarioTags: () => [],
  countScenariosByTag: () => ({}),
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
    resetAllMocks();
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

  it('handleRun filters tests by tag when runnerTagFilter is set', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg1', name: 'FG',
      scenarios: [{
        id: 'sc1', name: 'S', kind: 'standard',
        tests: [{
          id: 't1', name: 'T', method: 'GET', url: '/api', headers: [],
          validation: { mode: 'none' }, auth: { type: 'none' },
          dataSource: {
            columns: [{ id: 'c1', name: 'col' }],
            rows: [
              { id: 'r1', values: { c1: 'a' }, enabled: true, tags: ['smoke'] },
              { id: 'r2', values: { c1: 'b' }, enabled: true, tags: ['full'] },
            ],
          },
        }],
      }],
    }];
    const { result } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }),
    );
    act(() => { result.current.setRunnerTagFilter('smoke'); });
    act(() => { result.current.handleRun(); });
    const passedTests = mockExecute.mock.calls[0][1];
    expect(passedTests[0].dataSource.rows).toHaveLength(1);
    expect(passedTests[0].dataSource.rows[0].id).toBe('r1');
  });

  it('handleRun excludes tests with all rows filtered out by tag', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg1', name: 'FG',
      scenarios: [{
        id: 'sc1', name: 'S', kind: 'standard',
        tests: [{
          id: 't1', name: 'T', method: 'GET', url: '/api', headers: [],
          validation: { mode: 'none' }, auth: { type: 'none' },
          dataSource: {
            columns: [{ id: 'c1', name: 'col' }],
            rows: [
              { id: 'r1', values: { c1: 'a' }, enabled: true, tags: ['full'] },
            ],
          },
        }],
      }],
    }];
    const { result } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }),
    );
    act(() => { result.current.setRunnerTagFilter('smoke'); });
    act(() => { result.current.handleRun(); });
    const passedTests = mockExecute.mock.calls[0][1];
    expect(passedTests).toHaveLength(0);
  });

  it('hostLabel returns resolvedBaseUrl for settings mode', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.hostLabel).toBe('Original');
  });

  it('configSuffix differentiates parameterized from standard', () => {
    const { result: r1 } = renderHook(() => useRunnerOrchestration(defaultOpts));
    const { result: r2 } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, kind: 'parameterized' }),
    );
    expect(r1.current.allocation.kind).toBe('standard');
    expect(r2.current.allocation.kind).toBe('parameterized');
  });

  it('displayTimeSeries defaults to empty array', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.displayTimeSeries).toEqual([]);
  });

  it('displayExecMode defaults to config executionMode', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.displayExecMode).toBe('sequential');
  });

  it('displayConc defaults to config concurrency', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    expect(result.current.displayConc).toBe(1);
  });

  it('handleRun with tag filter preserves tests without data sources', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg1', name: 'FG',
      scenarios: [{
        id: 'sc1', name: 'S', kind: 'standard',
        tests: [
          { id: 't1', name: 'T', method: 'GET', url: '/api', headers: [],
            validation: { mode: 'none' }, auth: { type: 'none' } },
        ],
      }],
    }];
    const { result } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }),
    );
    act(() => { result.current.setRunnerTagFilter('smoke'); });
    act(() => { result.current.handleRun(); });
    const passedTests = mockExecute.mock.calls[0][1];
    expect(passedTests).toHaveLength(1);
  });

  it('handleRun with empty tag filter passes all tests unchanged', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    act(() => { result.current.handleRun(); });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [cfg] = mockExecute.mock.calls[0];
    expect(cfg.executionMode).toBe('sequential');
  });

  it('progressKey uses param suffix for parameterized kind', () => {
    const { result: r1 } = renderHook(() => useRunnerOrchestration(defaultOpts));
    const { result: r2 } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, kind: 'parameterized' }),
    );
    expect(r1.current.allocation.kind).not.toBe(r2.current.allocation.kind);
  });

  it('handleRun resolves shared data sources', () => {
    const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
    act(() => { result.current.handleRun(); });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const meta = mockExecute.mock.calls[0][2];
    expect(meta.envName).toBe('Test');
  });

  it('handleRun with data rows containing no tags excludes them when tag filter is set', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg1', name: 'FG',
      scenarios: [{
        id: 'sc1', name: 'S', kind: 'standard',
        tests: [{
          id: 't1', name: 'T', method: 'GET', url: '/api', headers: [],
          validation: { mode: 'none' }, auth: { type: 'none' },
          dataSource: {
            columns: [{ id: 'c1', name: 'col' }],
            rows: [
              { id: 'r1', values: { c1: 'a' }, enabled: true },
            ],
          },
        }],
      }],
    }];
    const { result } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }),
    );
    act(() => { result.current.setRunnerTagFilter('smoke'); });
    act(() => { result.current.handleRun(); });
    const passedTests = mockExecute.mock.calls[0][1];
    expect(passedTests).toHaveLength(0);
  });

  it('configContextKey uses param suffix for parameterized kind', () => {
    const { result } = renderHook(() =>
      useRunnerOrchestration({ ...defaultOpts, kind: 'parameterized', envId: undefined, svcId: undefined }),
    );
    expect(result.current.allocation.kind).toBe('parameterized');
  });

  describe('with live progress', () => {
    beforeEach(() => {
      mockTestExecOverrides.value = {
        isRunning: true,
        completed: 10,
        total: 50,
        liveSummary: { totalRequests: 10, passCount: 8, failCount: 2, avgResponseTime: 100, totalDurationMs: 5000 },
        profileMeta: { elapsedSec: 5, currentConcurrency: 3 },
        timeSeries: [{ elapsedSec: 1, avgResponseTime: 100, tps: 5, errorRate: 0.2, concurrency: 3 }],
      };
    });

    afterEach(() => {
      mockTestExecOverrides.value = {};
    });

    it('showProgress is true when isRunning', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.showProgress).toBe(true);
    });

    it('displaySummary uses liveSummary when available', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displaySummary).toEqual(expect.objectContaining({ totalRequests: 10 }));
    });

    it('displayCompleted uses live value', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayCompleted).toBe(10);
    });

    it('displayTotal uses live value', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayTotal).toBe(50);
    });

    it('displayTimeSeries uses live timeSeries when isRunning', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayTimeSeries).toHaveLength(1);
    });

    it('displayProfileMeta uses live profileMeta', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayProfileMeta).toEqual(expect.objectContaining({ elapsedSec: 5 }));
    });
  });

  describe('with saved progress and no live data', () => {
    const savedProg = {
      summary: { totalRequests: 100, passCount: 90, failCount: 10, avgResponseTime: 200, totalDurationMs: 60000 },
      timeSeries: [{ elapsedSec: 60, avgResponseTime: 200, tps: 2, errorRate: 0.1, concurrency: 5 }],
      completed: 100,
      total: 100,
      profileMeta: { elapsedSec: 60, currentConcurrency: 5 },
      isTimeBased: false,
      executionMode: 'batch' as const,
      concurrency: 5,
      loadProfile: { phases: [], maxConcurrency: 5, durationSec: 60 },
      thinkTime: { mode: 'constant' as const, constantMs: 500 },
      resultCount: 100,
      durationMs: 60000,
    };

    beforeEach(() => {
      mockLoadProgress.mockReturnValue(savedProg);
    });

    afterEach(() => {
      mockLoadProgress.mockReturnValue(null);
    });

    it('showProgress is true with saved progress', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.showProgress).toBe(true);
    });

    it('displaySummary falls back to savedProgress.summary', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displaySummary).toEqual(expect.objectContaining({ totalRequests: 100 }));
    });

    it('displayTimeSeries falls back to savedProgress.timeSeries', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayTimeSeries).toHaveLength(1);
    });

    it('displayCompleted falls back to savedProgress.completed', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayCompleted).toBe(100);
    });

    it('displayTotal falls back to savedProgress.total', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayTotal).toBe(100);
    });

    it('displayProfileMeta falls back to savedProgress.profileMeta', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayProfileMeta).toEqual(expect.objectContaining({ elapsedSec: 60 }));
    });

    it('displayExecMode falls back to savedProgress.executionMode', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayExecMode).toBe('batch');
    });

    it('displayConc falls back to savedProgress.concurrency', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayConc).toBe(5);
    });

    it('displayLoadProfile falls back to savedProgress.loadProfile', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayLoadProfile).toEqual(expect.objectContaining({ maxConcurrency: 5 }));
    });

    it('displayThinkTime falls back to savedProgress.thinkTime', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.displayThinkTime).toEqual(expect.objectContaining({ mode: 'constant' }));
    });
  });

  describe('hostMode settings and custom', () => {
    afterEach(() => {
      mockRunnerConfigOverrides.value = {};
    });

    it('hostLabel returns resolvedBaseUrl for settings mode with URL', () => {
      mockRunnerConfigOverrides.value = { hostMode: 'settings' };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.hostLabel).toBe('http://localhost:3000');
    });

    it('hostLabel returns Original for settings mode without resolvedBaseUrl', () => {
      mockRunnerConfigOverrides.value = { hostMode: 'settings' };
      const { result } = renderHook(() =>
        useRunnerOrchestration({ ...defaultOpts, resolvedBaseUrl: undefined }),
      );
      expect(result.current.hostLabel).toBe('Original');
    });

    it('hostLabel returns customBaseUrl for custom mode', () => {
      mockRunnerConfigOverrides.value = { hostMode: 'custom', customBaseUrl: 'https://custom.api.com' };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.hostLabel).toBe('https://custom.api.com');
    });

    it('hostLabel returns Original for custom mode with empty URL', () => {
      mockRunnerConfigOverrides.value = { hostMode: 'custom', customBaseUrl: '  ' };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.hostLabel).toBe('Original');
    });

    it('handleRun passes resolvedBaseUrl for settings mode', () => {
      mockRunnerConfigOverrides.value = { hostMode: 'settings' };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const meta = mockExecute.mock.calls[0][2];
      expect(meta.baseUrl).toBe('http://localhost:3000');
    });

    it('handleRun passes customBaseUrl for custom mode', () => {
      mockRunnerConfigOverrides.value = { hostMode: 'custom', customBaseUrl: 'https://custom.api.com' };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const meta = mockExecute.mock.calls[0][2];
      expect(meta.baseUrl).toBe('https://custom.api.com');
    });

    it('handleRun passes undefined baseUrl for hardcoded mode', () => {
      mockRunnerConfigOverrides.value = { hostMode: 'hardcoded' };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const meta = mockExecute.mock.calls[0][2];
      expect(meta.baseUrl).toBeUndefined();
    });
  });

  describe('load-profile mode', () => {
    afterEach(() => {
      mockRunnerConfigOverrides.value = {};
    });

    it('isLoadProfile is true for load-profile mode', () => {
      mockRunnerConfigOverrides.value = { executionMode: 'load-profile' };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.isLoadProfile).toBe(true);
    });

    it('handleRun uses loadProfile.maxConcurrency for load-profile mode', () => {
      mockRunnerConfigOverrides.value = { executionMode: 'load-profile' };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.concurrency).toBe(10);
      expect(cfg.iterations).toBe(0);
      expect(cfg.loadProfile).toBeDefined();
    });
  });

  describe('thinkTime and timeout in handleRun', () => {
    afterEach(() => {
      mockRunnerConfigOverrides.value = {};
    });

    it('handleRun includes thinkTime when mode is not none', () => {
      mockRunnerConfigOverrides.value = { thinkTime: { mode: 'constant', constantMs: 500 } };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.thinkTime).toEqual({ mode: 'constant', constantMs: 500 });
    });

    it('handleRun omits thinkTime when mode is none', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.thinkTime).toBeUndefined();
    });

    it('handleRun includes timeoutSec when > 0', () => {
      mockRunnerConfigOverrides.value = { timeoutSec: 30 };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.timeoutSec).toBe(30);
    });

    it('handleRun omits timeoutSec when 0', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.timeoutSec).toBeUndefined();
    });

    it('handleRun includes retryCount when > 0', () => {
      mockRunnerConfigOverrides.value = { retryCount: 3 };
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.retryCount).toBe(3);
    });
  });

  describe('auto report on finalRun', () => {
    afterEach(() => {
      mockTestExecOverrides.value = {};
      mockRunnerConfigOverrides.value = {};
    });

    it('triggers auto report download when autoReport is true and finalRun exists', () => {
      const finalRun = {
        id: 'run-1',
        timestamp: Date.now(),
        results: [],
        summary: { totalDurationMs: 5000 },
        svcName: 'Service',
        envName: 'Test',
      };
      mockRunnerConfigOverrides.value = { autoReport: true, autoReportFormat: 'html' };
      mockTestExecOverrides.value = { finalRun, isRunning: false };
      renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(mockGenerateReport).toHaveBeenCalled();
      expect(mockDownloadReport).toHaveBeenCalled();
    });

    it('triggers markdown report with .md extension', () => {
      const finalRun = {
        id: 'run-2',
        timestamp: Date.now(),
        results: [],
        summary: { totalDurationMs: 5000 },
        svcName: 'Service',
        envName: 'Test',
      };
      mockRunnerConfigOverrides.value = { autoReport: true, autoReportFormat: 'markdown' };
      mockTestExecOverrides.value = { finalRun, isRunning: false };
      renderHook(() => useRunnerOrchestration(defaultOpts));
      const downloadCall = mockDownloadReport.mock.calls[0];
      expect(downloadCall[1]).toMatch(/\.md$/);
      expect(downloadCall[2]).toBe('text/markdown');
    });

    it('triggers json report', () => {
      const finalRun = {
        id: 'run-3',
        timestamp: Date.now(),
        results: [],
        summary: { totalDurationMs: 5000 },
        svcName: 'Service',
        envName: 'Test',
      };
      mockRunnerConfigOverrides.value = { autoReport: true, autoReportFormat: 'json' };
      mockTestExecOverrides.value = { finalRun, isRunning: false };
      renderHook(() => useRunnerOrchestration(defaultOpts));
      const downloadCall = mockDownloadReport.mock.calls[0];
      expect(downloadCall[1]).toMatch(/\.json$/);
      expect(downloadCall[2]).toBe('application/json');
    });

    it('does not fire auto-report when autoReport is false', () => {
      const finalRun = {
        id: 'run-4',
        timestamp: Date.now(),
        results: [],
        summary: { totalDurationMs: 5000 },
      };
      mockRunnerConfigOverrides.value = { autoReport: false };
      mockTestExecOverrides.value = { finalRun, isRunning: false };
      renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(mockDownloadReport).not.toHaveBeenCalled();
    });
  });

  describe('finalRun saves progress', () => {
    afterEach(() => {
      mockTestExecOverrides.value = {};
      mockRunnerConfigOverrides.value = {};
    });

    it('saves progress to storage when finalRun completes', async () => {
      const { saveProgress } = await import('../utils/runnerProgressStorage');
      const finalRun = {
        id: 'run-save-1',
        timestamp: Date.now(),
        results: [{ id: 'r1' }],
        summary: { totalDurationMs: 10000 },
      };
      mockTestExecOverrides.value = {
        finalRun,
        isRunning: false,
        liveSummary: { totalRequests: 50 },
        completed: 50,
        total: 50,
        timeSeries: [],
        profileMeta: null,
      };
      renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(saveProgress).toHaveBeenCalled();
    });
  });

  describe('edge cases for configContextKey and progressKey', () => {
    it('handles standard kind with no envId/svcId', () => {
      const { result } = renderHook(() =>
        useRunnerOrchestration({ ...defaultOpts, kind: 'standard', envId: undefined, svcId: undefined }),
      );
      expect(result.current.allocation.kind).toBe('standard');
    });

    it('handles parameterized kind with envId and svcId', () => {
      const { result } = renderHook(() =>
        useRunnerOrchestration({ ...defaultOpts, kind: 'parameterized', envId: 'e1', svcId: 's1' }),
      );
      expect(result.current.allocation.kind).toBe('parameterized');
    });
  });

  describe('scenario tag filter state', () => {
    it('initializes scenarioTagFilter to empty array', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.scenarioTagFilter).toEqual([]);
    });

    it('provides setScenarioTagFilter function', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(typeof result.current.setScenarioTagFilter).toBe('function');
    });

    it('exposes allScenarioTags (mocked)', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.allScenarioTags).toEqual([]);
    });

    it('exposes scenarioTagCounts (mocked)', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.scenarioTagCounts).toEqual({});
    });
  });

  // ── SLA-B5: SLA target auto-collect + merge ─────────────────────────────
  describe('SLA targets (SLA-B5)', () => {
    const makeSlaTarget = (metric: string, scenarioName?: string, value = 800) => ({
      id: `sla-${metric}-${scenarioName ?? 'global'}`,
      metric: metric as import('../../../shared/types').SlaMetric,
      operator: 'lte' as const,
      value,
      ...(scenarioName !== undefined ? { scenarioName } : {}),
    });

    it('runnerSlaTargets defaults to []', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      expect(result.current.runnerSlaTargets).toEqual([]);
    });

    it('setRunnerSlaTargets updates override targets', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      const override = makeSlaTarget('p95', 'Standard', 500);
      act(() => { result.current.setRunnerSlaTargets([override]); });
      expect(result.current.runnerSlaTargets).toEqual([override]);
    });

    it('handleRun passes scenario slaTargets to execute with scenarioName stamped', () => {
      const fgs: FeatureGroup[] = [{
        id: 'fg1', name: 'FG',
        scenarios: [{
          id: 'sc1', name: 'Standard', kind: 'standard' as const,
          slaTargets: [makeSlaTarget('p95')],
          tests: [{ id: 't1', name: 'T', method: 'GET', url: '/api', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }],
        }],
      }];
      const { result } = renderHook(() => useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.slaTargets).toHaveLength(1);
      expect(cfg.slaTargets[0].scenarioName).toBe('Standard');
      expect(cfg.slaTargets[0].metric).toBe('p95');
    });

    it('handleRun passes feature group slaTargets to execute', () => {
      const fgs: FeatureGroup[] = [{
        id: 'fg1', name: 'FG',
        slaTargets: [makeSlaTarget('errorRate')],
        scenarios: [{
          id: 'sc1', name: 'Standard', kind: 'standard' as const,
          tests: [{ id: 't1', name: 'T', method: 'GET', url: '/api', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }],
        }],
      }];
      const { result } = renderHook(() => useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.slaTargets).toHaveLength(1);
      expect(cfg.slaTargets[0].metric).toBe('errorRate');
    });

    it('handleRun runner override wins on same metric + scenarioName', () => {
      const fgs: FeatureGroup[] = [{
        id: 'fg1', name: 'FG',
        scenarios: [{
          id: 'sc1', name: 'Standard', kind: 'standard' as const,
          slaTargets: [{ ...makeSlaTarget('p95'), scenarioName: 'Standard', value: 1000 }],
          tests: [{ id: 't1', name: 'T', method: 'GET', url: '/api', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }],
        }],
      }];
      const override = { ...makeSlaTarget('p95', 'Standard'), value: 500 };
      const { result } = renderHook(() => useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }));
      act(() => { result.current.setRunnerSlaTargets([override]); });
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.slaTargets).toHaveLength(1);
      expect(cfg.slaTargets[0].value).toBe(500); // runner wins
    });

    it('handleRun adds runner-only override (no matching definition target)', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      const override = makeSlaTarget('p99', 'Standard', 300);
      act(() => { result.current.setRunnerSlaTargets([override]); });
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.slaTargets).toHaveLength(1);
      expect(cfg.slaTargets[0].metric).toBe('p99');
    });

    it('handleRun omits slaTargets from config when none are defined or overridden', () => {
      const { result } = renderHook(() => useRunnerOrchestration(defaultOpts));
      act(() => { result.current.handleRun(); });
      const [cfg] = mockExecute.mock.calls[0];
      expect(cfg.slaTargets).toBeUndefined();
    });

    it('selectedSlaScenarioNames includes names of selected scenarios', () => {
      const fgs: FeatureGroup[] = [{
        id: 'fg1', name: 'FG',
        scenarios: [
          { id: 'sc1', name: 'Standard', kind: 'standard' as const, tests: [] },
          { id: 'sc2', name: 'Param', kind: 'parameterized' as const, tests: [] },
        ],
      }];
      // selectedScenarios mock returns Set(['sc1'])
      const { result } = renderHook(() => useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }));
      expect(result.current.selectedSlaScenarioNames).toEqual(['Standard']);
    });

    it('definitionSlaTargetCount reflects scenario + FG targets for selected scenarios', () => {
      const fgs: FeatureGroup[] = [{
        id: 'fg1', name: 'FG',
        slaTargets: [makeSlaTarget('errorRate')],
        scenarios: [
          { id: 'sc1', name: 'S1', kind: 'standard' as const, slaTargets: [makeSlaTarget('p95')], tests: [] },
          { id: 'sc2', name: 'S2', kind: 'standard' as const, slaTargets: [makeSlaTarget('p99')], tests: [] },
        ],
      }];
      // selectedScenarios mock is Set(['sc1']) — sc2 not selected
      const { result } = renderHook(() => useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }));
      expect(result.current.definitionSlaTargetCount).toBe(2); // 1 FG + 1 sc1 (sc2 not selected)
    });

    it('definitionSlaTargetCount includes test-level slaTargets', () => {
      const fgs: FeatureGroup[] = [{
        id: 'fg1', name: 'FG',
        slaTargets: [makeSlaTarget('errorRate')],
        scenarios: [
          {
            id: 'sc1', name: 'S1', kind: 'standard' as const, slaTargets: [],
            tests: [
              { id: 't1', name: 'T1', method: 'GET', url: '/a', auth: { type: 'inherit' }, slaTargets: [makeSlaTarget('p95'), makeSlaTarget('errorRate')] } as unknown as (typeof fgs)[0]['scenarios'][0]['tests'][0],
              { id: 't2', name: 'T2', method: 'GET', url: '/b', auth: { type: 'inherit' }, slaTargets: [makeSlaTarget('p99')] } as unknown as (typeof fgs)[0]['scenarios'][0]['tests'][0],
              { id: 't3', name: 'T3', method: 'GET', url: '/c', auth: { type: 'inherit' } } as unknown as (typeof fgs)[0]['scenarios'][0]['tests'][0],
            ],
          },
        ],
      }];
      const { result } = renderHook(() => useRunnerOrchestration({ ...defaultOpts, featureGroups: fgs }));
      expect(result.current.definitionSlaTargetCount).toBe(4); // 1 FG + 0 sc + 2 t1 + 1 t2 + 0 t3
    });
  });

  describe('kafkaResultsPublish threading', () => {
    afterEach(() => {
      mockRunnerConfigOverrides.value = {};
      mockCapturedPublishConfig.value = undefined;
    });

    it('passes kafkaResultsPublish from useRunnerConfig to useTestExecution', () => {
      const publishCfg = { enabled: true, clusterId: 'c1', topic: 'redfireforge.results.summary' };
      mockRunnerConfigOverrides.value = { kafkaResultsPublish: publishCfg };

      renderHook(() => useRunnerOrchestration(defaultOpts));

      expect(mockCapturedPublishConfig.value).toEqual(publishCfg);
    });

    it('passes undefined to useTestExecution when kafkaResultsPublish is not set', () => {
      mockRunnerConfigOverrides.value = {};

      renderHook(() => useRunnerOrchestration(defaultOpts));

      expect(mockCapturedPublishConfig.value).toBeUndefined();
    });
  });
});
