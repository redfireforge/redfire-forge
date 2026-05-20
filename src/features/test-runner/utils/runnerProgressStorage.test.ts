/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { thinkTimeLabel, saveProgress, loadProgress, clearProgress, type PersistedProgress } from './runnerProgressStorage';
import { ThinkTimeConfig } from '../../../shared/types';

describe('thinkTimeLabel', () => {
  it('returns null for undefined config', () => {
    expect(thinkTimeLabel(undefined)).toBeNull();
  });

  it('returns null for mode "none"', () => {
    expect(thinkTimeLabel({ mode: 'none' })).toBeNull();
  });

  it('returns constant label with configured value', () => {
    expect(thinkTimeLabel({ mode: 'constant', constantMs: 500 })).toBe('Think: 500ms');
  });

  it('returns constant label with default when constantMs is missing', () => {
    expect(thinkTimeLabel({ mode: 'constant' })).toBe('Think: 1000ms');
  });

  it('returns uniform label with configured range', () => {
    expect(thinkTimeLabel({ mode: 'uniform', minMs: 200, maxMs: 3000 })).toBe('Think: 200–3000ms');
  });

  it('returns uniform label with defaults when min/max missing', () => {
    expect(thinkTimeLabel({ mode: 'uniform' })).toBe('Think: 500–2000ms');
  });

  it('returns gaussian label with configured values', () => {
    expect(thinkTimeLabel({ mode: 'gaussian', meanMs: 1500, stdDevMs: 400 })).toBe('Think: μ1500ms σ400ms');
  });

  it('returns gaussian label with defaults when mean/stdDev missing', () => {
    expect(thinkTimeLabel({ mode: 'gaussian' })).toBe('Think: μ1000ms σ300ms');
  });

  it('returns null for unknown mode', () => {
    expect(thinkTimeLabel({ mode: 'custom' as ThinkTimeConfig['mode'] })).toBeNull();
  });

  it('returns constant label with zero ms', () => {
    expect(thinkTimeLabel({ mode: 'constant', constantMs: 0 })).toBe('Think: 0ms');
  });

  it('returns uniform label with same min and max', () => {
    expect(thinkTimeLabel({ mode: 'uniform', minMs: 1000, maxMs: 1000 })).toBe('Think: 1000–1000ms');
  });

  it('returns gaussian label with zero stdDev', () => {
    expect(thinkTimeLabel({ mode: 'gaussian', meanMs: 500, stdDevMs: 0 })).toBe('Think: μ500ms σ0ms');
  });
});

describe('saveProgress / loadProgress / clearProgress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const makeProgress = (overrides: Partial<PersistedProgress> = {}): PersistedProgress => ({
    summary: {
      totalRequests: 10,
      tps: 5,
      avgResponseTime: 100,
      minResponseTime: 50,
      maxResponseTime: 200,
      p95ResponseTime: 180,
      p99ResponseTime: 195,
      errorRate: 0,
      failedValidations: 0,
      totalDurationMs: 2000,
      errorsByStatus: {},
    },
    timeSeries: [],
    completed: 10,
    total: 10,
    profileMeta: null,
    isTimeBased: false,
    executionMode: 'batch',
    concurrency: 2,
    loadProfile: { type: 'sustained', durationSec: 60, maxConcurrency: 5 },
    resultCount: 10,
    durationMs: 2000,
    ...overrides,
  });

  it('saves and loads progress', () => {
    const data = makeProgress();
    saveProgress('test-key', data);
    const loaded = loadProgress('test-key');
    expect(loaded).toEqual(data);
  });

  it('returns null for non-existent key', () => {
    expect(loadProgress('nonexistent')).toBeNull();
  });

  it('clears progress', () => {
    saveProgress('test-key', makeProgress());
    expect(loadProgress('test-key')).not.toBeNull();
    clearProgress('test-key');
    expect(loadProgress('test-key')).toBeNull();
  });

  it('saves and loads progress with thinkTime', () => {
    const thinkTime: ThinkTimeConfig = { mode: 'gaussian', meanMs: 1000, stdDevMs: 300 };
    const data = makeProgress({ thinkTime });
    saveProgress('tt-key', data);
    const loaded = loadProgress('tt-key');
    expect(loaded?.thinkTime).toEqual(thinkTime);
  });

  it('loads progress without thinkTime (backward compatible)', () => {
    const data = makeProgress();
    saveProgress('compat-key', data);
    const loaded = loadProgress('compat-key');
    expect(loaded?.thinkTime).toBeUndefined();
  });

  it('isolates different keys', () => {
    saveProgress('key-a', makeProgress({ completed: 5 }));
    saveProgress('key-b', makeProgress({ completed: 20 }));
    expect(loadProgress('key-a')?.completed).toBe(5);
    expect(loadProgress('key-b')?.completed).toBe(20);
  });

  it('overwrites existing progress for same key', () => {
    saveProgress('key', makeProgress({ completed: 5 }));
    saveProgress('key', makeProgress({ completed: 99 }));
    expect(loadProgress('key')?.completed).toBe(99);
  });
});
