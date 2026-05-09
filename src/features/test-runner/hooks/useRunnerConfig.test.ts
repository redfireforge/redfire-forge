/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRunnerConfig, defaultLoadProfile, defaultThinkTime, type RunnerConfig } from './useRunnerConfig';

// ── Mocks ──

const mockLoadRunnerConfig = vi.fn(async () => null);
const mockSaveRunnerConfig = vi.fn(async () => {});

vi.mock('../../../shared/utils/storage', () => ({
  loadRunnerConfig: (...args: unknown[]) => mockLoadRunnerConfig(...args),
  saveRunnerConfig: (...args: unknown[]) => mockSaveRunnerConfig(...args),
}));

// ── Tests ──

describe('useRunnerConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default values when no saved config exists', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useRunnerConfig('test-key'));

    // Wait for async load
    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(result.current.concurrency).toBe(1);
    expect(result.current.totalTransactions).toBe(1);
    expect(result.current.selectedScenarios.size).toBe(0);
    expect(result.current.weights).toEqual({});
    expect(result.current.skipValidation).toBe(false);
    expect(result.current.validationOverride).toBe('default');
    expect(result.current.forceUnordered).toBe(false);
    expect(result.current.hostMode).toBe('settings');
    expect(result.current.customBaseUrl).toBe('');
    expect(result.current.executionMode).toBe('batch');
    expect(result.current.timeoutSec).toBe(10);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.retryDelayMs).toBe(1000);
    expect(result.current.errorPolicy).toBe('continue');
    expect(result.current.maxErrors).toBe(10);
    expect(result.current.maxErrorRate).toBe(50);
    expect(result.current.autoReport).toBe(false);
    expect(result.current.autoReportFormat).toBe('html');
  });

  it('restores saved config from storage', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce({
      concurrency: 5,
      totalTransactions: 100,
      selectedScenarios: ['s1', 's2'],
      weights: { s1: 70, s2: 30 },
      skipValidation: true,
      validationOverride: 'full',
      forceUnordered: true,
      hostMode: 'custom',
      customBaseUrl: 'http://custom.com',
      executionMode: 'weighted',
      timeoutSec: 30,
      retryCount: 3,
      retryDelayMs: 2000,
      errorPolicy: 'stop',
      maxErrors: 5,
      maxErrorRate: 25,
      autoReport: true,
      autoReportFormat: 'pdf',
    });

    const { result } = renderHook(() => useRunnerConfig('saved-key'));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(result.current.concurrency).toBe(5);
    expect(result.current.totalTransactions).toBe(100);
    expect(result.current.selectedScenarios).toEqual(new Set(['s1', 's2']));
    expect(result.current.weights).toEqual({ s1: 70, s2: 30 });
    expect(result.current.skipValidation).toBe(true);
    expect(result.current.hostMode).toBe('custom');
    expect(result.current.customBaseUrl).toBe('http://custom.com');
    expect(result.current.executionMode).toBe('weighted');
    expect(result.current.timeoutSec).toBe(30);
    expect(result.current.retryCount).toBe(3);
    expect(result.current.autoReport).toBe(true);
  });

  it('restores markdown auto-report format when saved', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce({
      concurrency: 1,
      totalTransactions: 1,
      selectedScenarios: [],
      weights: {},
      autoReport: true,
      autoReportFormat: 'markdown',
    });

    const { result } = renderHook(() => useRunnerConfig('fmt-md'));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(result.current.autoReportFormat).toBe('markdown');
  });

  it('auto-saves when config changes', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useRunnerConfig('auto-save-key'));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    // Clear the initial save from load
    mockSaveRunnerConfig.mockClear();

    await act(async () => {
      result.current.setConcurrency(10);
    });

    // Wait for the save effect to fire
    await vi.waitFor(() => {
      expect(mockSaveRunnerConfig).toHaveBeenCalled();
    });

    const savedConfig = mockSaveRunnerConfig.mock.calls[0][0];
    expect(savedConfig.concurrency).toBe(10);
  });

  it('loads and saves with undefined storage key', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useRunnerConfig(undefined));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(mockLoadRunnerConfig).toHaveBeenCalledWith(undefined);

    mockSaveRunnerConfig.mockClear();

    await act(async () => {
      result.current.setConcurrency(9);
    });

    await vi.waitFor(() => {
      expect(mockSaveRunnerConfig).toHaveBeenCalledWith(
        expect.objectContaining({ concurrency: 9 }),
        undefined,
      );
    });
  });

  it('reloads when configContextKey changes', async () => {
    mockLoadRunnerConfig.mockResolvedValue(null);

    const { result, rerender } = renderHook(
      ({ key }) => useRunnerConfig(key),
      { initialProps: { key: 'key-1' } },
    );

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(mockLoadRunnerConfig).toHaveBeenCalledWith('key-1');

    mockLoadRunnerConfig.mockResolvedValueOnce({
      concurrency: 20,
      totalTransactions: 50,
      selectedScenarios: [],
      weights: {},
    });

    rerender({ key: 'key-2' });

    await vi.waitFor(() => {
      expect(result.current.concurrency).toBe(20);
    });

    expect(mockLoadRunnerConfig).toHaveBeenCalledWith('key-2');
  });

  it('omits persisted loadProfile and thinkTime when absent on saved blob', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce({
      concurrency: 5,
      totalTransactions: 3,
      selectedScenarios: [],
      weights: {},
      executionMode: 'batch',
      skipValidation: false,
      validationOverride: 'selective',
    });

    const { result } = renderHook(() => useRunnerConfig('no-profile-key'));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(result.current.loadProfile.durationSec).toBe(60);
    expect(result.current.thinkTime.mode).toBe('none');
  });

  it('fills default values for fields missing from sparse saved config', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce({
      concurrency: 7,
      totalTransactions: 11,
      selectedScenarios: ['a'],
      weights: { a: 100 },
      skipValidation: true,
      hostMode: 'hardcoded',
    });

    const { result } = renderHook(() => useRunnerConfig('sparse-key'));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(result.current.concurrency).toBe(7);
    expect(result.current.validationOverride).toBe('default');
    expect(result.current.autoReportFormat).toBe('html');
    expect(result.current.errorPolicy).toBe('continue');
  });

  it('falls back to built-in defaults when concurrency and totals are omitted from saved blob', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce({
      selectedScenarios: [],
      weights: {},
    });

    const { result } = renderHook(() => useRunnerConfig('missing-counts'));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(result.current.concurrency).toBe(1);
    expect(result.current.totalTransactions).toBe(1);
    expect(result.current.timeoutSec).toBe(10);
  });

  it('treats null auto-report fields as unset defaults', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce({
      concurrency: 2,
      totalTransactions: 2,
      selectedScenarios: [],
      weights: {},
      autoReport: null,
      autoReportFormat: null,
    } as unknown as RunnerConfig);

    const { result } = renderHook(() => useRunnerConfig('null-auto'));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    expect(result.current.autoReport).toBe(false);
    expect(result.current.autoReportFormat).toBe('html');
  });

  it('exports defaultLoadProfile and defaultThinkTime', () => {
    expect(defaultLoadProfile.type).toBe('sustained');
    expect(defaultLoadProfile.durationSec).toBe(60);
    expect(defaultThinkTime.mode).toBe('none');
  });

  it('provides setter functions for all config fields', async () => {
    mockLoadRunnerConfig.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useRunnerConfig('setter-test'));

    await vi.waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });

    // Verify all setters are functions
    expect(typeof result.current.setConcurrency).toBe('function');
    expect(typeof result.current.setTotalTransactions).toBe('function');
    expect(typeof result.current.setSelectedScenarios).toBe('function');
    expect(typeof result.current.setWeights).toBe('function');
    expect(typeof result.current.setSkipValidation).toBe('function');
    expect(typeof result.current.setValidationOverride).toBe('function');
    expect(typeof result.current.setForceUnordered).toBe('function');
    expect(typeof result.current.setHostMode).toBe('function');
    expect(typeof result.current.setCustomBaseUrl).toBe('function');
    expect(typeof result.current.setExecutionMode).toBe('function');
    expect(typeof result.current.setLoadProfile).toBe('function');
    expect(typeof result.current.setThinkTime).toBe('function');
    expect(typeof result.current.setTimeoutSec).toBe('function');
    expect(typeof result.current.setRetryCount).toBe('function');
    expect(typeof result.current.setRetryDelayMs).toBe('function');
    expect(typeof result.current.setErrorPolicy).toBe('function');
    expect(typeof result.current.setMaxErrors).toBe('function');
    expect(typeof result.current.setMaxErrorRate).toBe('function');
    expect(typeof result.current.setAutoReport).toBe('function');
    expect(typeof result.current.setAutoReportFormat).toBe('function');
  });
});
