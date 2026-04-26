import { describe, it, expect, vi, afterEach } from 'vitest';
import { createThinkTimeDelay, applyThinkTime } from './thinkTime';
import type { ThinkTimeConfig } from '../shared/types';


describe('createThinkTimeDelay', () => {
  describe('none / undefined', () => {
    it('returns 0 when config is undefined', () => {
      const fn = createThinkTimeDelay(undefined);
      expect(fn()).toBe(0);
    });

    it('returns 0 when mode is none', () => {
      const fn = createThinkTimeDelay({ mode: 'none' });
      expect(fn()).toBe(0);
    });
  });

  describe('constant mode', () => {
    it('returns the configured constant delay', () => {
      const fn = createThinkTimeDelay({ mode: 'constant', constantMs: 500 });
      expect(fn()).toBe(500);
      expect(fn()).toBe(500);
    });

    it('defaults to 1000ms when constantMs is not set', () => {
      const fn = createThinkTimeDelay({ mode: 'constant' });
      expect(fn()).toBe(1000);
    });

    it('clamps negative values to 0', () => {
      const fn = createThinkTimeDelay({ mode: 'constant', constantMs: -100 });
      expect(fn()).toBe(0);
    });

    it('returns 0 when constantMs is 0', () => {
      const fn = createThinkTimeDelay({ mode: 'constant', constantMs: 0 });
      expect(fn()).toBe(0);
    });
  });

  describe('uniform mode', () => {
    it('returns values within min-max range', () => {
      const fn = createThinkTimeDelay({ mode: 'uniform', minMs: 100, maxMs: 200 });
      for (let i = 0; i < 100; i++) {
        const val = fn();
        expect(val).toBeGreaterThanOrEqual(100);
        expect(val).toBeLessThanOrEqual(200);
      }
    });

    it('defaults to 500-2000ms range', () => {
      const fn = createThinkTimeDelay({ mode: 'uniform' });
      for (let i = 0; i < 50; i++) {
        const val = fn();
        expect(val).toBeGreaterThanOrEqual(500);
        expect(val).toBeLessThanOrEqual(2000);
      }
    });

    it('handles min > max by clamping max to min', () => {
      const fn = createThinkTimeDelay({ mode: 'uniform', minMs: 500, maxMs: 100 });
      const val = fn();
      expect(val).toBe(500);
    });

    it('returns exact value when min equals max', () => {
      const fn = createThinkTimeDelay({ mode: 'uniform', minMs: 300, maxMs: 300 });
      expect(fn()).toBe(300);
    });

    it('clamps negative min to 0', () => {
      const fn = createThinkTimeDelay({ mode: 'uniform', minMs: -50, maxMs: 100 });
      for (let i = 0; i < 50; i++) {
        const val = fn();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('gaussian mode', () => {
    it('returns non-negative values', () => {
      const fn = createThinkTimeDelay({ mode: 'gaussian', meanMs: 1000, stdDevMs: 300 });
      for (let i = 0; i < 100; i++) {
        expect(fn()).toBeGreaterThanOrEqual(0);
      }
    });

    it('defaults to mean=1000, stdDev=300', () => {
      const fn = createThinkTimeDelay({ mode: 'gaussian' });
      const samples = Array.from({ length: 500 }, () => fn());
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(avg).toBeGreaterThan(500);
      expect(avg).toBeLessThan(1500);
    });

    it('handles zero stdDev (returns mean)', () => {
      const fn = createThinkTimeDelay({ mode: 'gaussian', meanMs: 500, stdDevMs: 0 });
      expect(fn()).toBe(500);
    });

    it('clamps negative mean to 0', () => {
      const fn = createThinkTimeDelay({ mode: 'gaussian', meanMs: -100, stdDevMs: 0 });
      expect(fn()).toBe(0);
    });

    it('produces values around the mean', () => {
      const fn = createThinkTimeDelay({ mode: 'gaussian', meanMs: 2000, stdDevMs: 100 });
      const samples = Array.from({ length: 200 }, () => fn());
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(avg).toBeGreaterThan(1800);
      expect(avg).toBeLessThan(2200);
    });
  });

  describe('unknown mode', () => {
    it('returns 0 for unknown mode', () => {
      const fn = createThinkTimeDelay({ mode: 'custom' as ThinkTimeConfig['mode'] });
      expect(fn()).toBe(0);
    });
  });

  describe('deterministic behavior', () => {
    it('constant mode is deterministic', () => {
      const fn = createThinkTimeDelay({ mode: 'constant', constantMs: 750 });
      const results = Array.from({ length: 10 }, () => fn());
      expect(results.every(v => v === 750)).toBe(true);
    });

    it('uniform mode produces varying values', () => {
      const fn = createThinkTimeDelay({ mode: 'uniform', minMs: 0, maxMs: 10000 });
      const results = new Set(Array.from({ length: 20 }, () => fn()));
      expect(results.size).toBeGreaterThan(1);
    });

    it('gaussian mode produces varying values', () => {
      const fn = createThinkTimeDelay({ mode: 'gaussian', meanMs: 1000, stdDevMs: 500 });
      const results = new Set(Array.from({ length: 20 }, () => fn()));
      expect(results.size).toBeGreaterThan(1);
    });
  });
});

describe('applyThinkTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves immediately when delay is 0', async () => {
    const start = performance.now();
    await applyThinkTime(() => 0);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('resolves immediately when delay is negative', async () => {
    const start = performance.now();
    await applyThinkTime(() => -100);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('waits approximately the specified delay', async () => {
    vi.useFakeTimers();
    const promise = applyThinkTime(() => 500);
    vi.advanceTimersByTime(500);
    await promise;
    vi.useRealTimers();
  });

  it('resolves immediately when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const start = performance.now();
    await applyThinkTime(() => 5000, controller.signal);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('resolves when abort fires during wait', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const promise = applyThinkTime(() => 5000, controller.signal);
    controller.abort();
    await promise;
    vi.useRealTimers();
  });
});
