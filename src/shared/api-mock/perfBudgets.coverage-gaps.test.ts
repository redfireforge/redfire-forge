/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoundedCache, resolvePerfCiSlack } from './perfBudgets';

afterEach(() => {
  delete process.env.APIMOCK_PERF_CI_SLACK;
  vi.resetModules();
});

describe('perfBudgets coverage gaps', () => {
  it('resolves slack values directly', () => {
    expect(resolvePerfCiSlack(undefined)).toBe(6);
    expect(resolvePerfCiSlack('abc')).toBe(6);
    expect(resolvePerfCiSlack('0')).toBe(6);
    expect(resolvePerfCiSlack('-2')).toBe(6);
    expect(resolvePerfCiSlack('2.5')).toBe(2.5);
  });

  it('falls back to 6 when APIMOCK_PERF_CI_SLACK is invalid or non-positive', async () => {
    process.env.APIMOCK_PERF_CI_SLACK = 'abc';
    let mod = await import('./perfBudgets');
    expect(mod.PERF_CI_SLACK).toBe(6);

    vi.resetModules();
    process.env.APIMOCK_PERF_CI_SLACK = '0';
    mod = await import('./perfBudgets');
    expect(mod.PERF_CI_SLACK).toBe(6);
  });

  it('uses the provided positive slack value', async () => {
    process.env.APIMOCK_PERF_CI_SLACK = '2.5';
    const mod = await import('./perfBudgets');
    expect(mod.PERF_CI_SLACK).toBe(2.5);
  });

  it('falls back to 6 when process is unavailable at import time', async () => {
    const originalProcess = globalThis.process;
    vi.stubGlobal('process', undefined as unknown as NodeJS.Process);
    vi.resetModules();
    const mod = await import('./perfBudgets');
    expect(mod.PERF_CI_SLACK).toBe(6);
    vi.stubGlobal('process', originalProcess);
  });

  it('handles zero-cap caches without throwing', () => {
    const cache = new BoundedCache<string, number>(0);
    cache.set('a', 1);
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('covers overwriting an existing cache key', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    cache.set('a', 2);
    expect(cache.get('a')).toBe(2);
  });
});
