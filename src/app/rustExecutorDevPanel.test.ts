import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('rustExecutorDevPanel', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports a lazy panel component in development builds', async () => {
    vi.stubEnv('DEV', true);
    const mod = await import('./rustExecutorDevPanel');
    expect(mod.RustExecutorTestPanel).toBeTruthy();
    expect(typeof mod.RustExecutorTestPanel).toBe('object');
  });

  it('exports null in production builds', async () => {
    vi.stubEnv('DEV', false);
    const mod = await import('./rustExecutorDevPanel');
    expect(mod.RustExecutorTestPanel).toBeNull();
  });
});
