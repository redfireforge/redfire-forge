/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Environment, Microservice, FeatureGroup } from '../../shared/types';
import { useDemoHarnessBridge } from './useDemoHarnessBridge';

vi.mock('../../shared/utils/storage');

describe('useDemoHarnessBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const keys = [
      '__demoSeedHarnessTarget',
      '__demoDeleteFeatureGroupsByName',
      '__demoSeedFeatureGroup',
      '__demoSelectEnvSvc',
      '__demoSeedTestRun',
      '__demoDeleteTestRuns',
      '__demoHasTestRuns',
      '__demoSeedSharedDataSources',
      '__demoDeleteSharedDataSourcesByName',
    ];
    keys.forEach(key => {
      delete (window as unknown as Record<string, unknown>)[key];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers all bridge functions', () => {
    const { envs, svcs } = setupMocks();
    renderHook(() =>
      useDemoHarnessBridge(envs, svcs, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()),
    );

    const w = window as unknown as Record<string, unknown>;
    expect(typeof w.__demoSeedHarnessTarget).toBe('function');
    expect(typeof w.__demoDeleteFeatureGroupsByName).toBe('function');
    expect(typeof w.__demoSeedFeatureGroup).toBe('function');
    expect(typeof w.__demoSelectEnvSvc).toBe('function');
    expect(typeof w.__demoSeedTestRun).toBe('function');
    expect(typeof w.__demoDeleteTestRuns).toBe('function');
    expect(typeof w.__demoHasTestRuns).toBe('function');
    expect(typeof w.__demoSeedSharedDataSources).toBe('function');
    expect(typeof w.__demoDeleteSharedDataSourcesByName).toBe('function');
  });

  it('unregisters all bridge functions on unmount', () => {
    const { envs, svcs } = setupMocks();
    const { unmount } = renderHook(() =>
      useDemoHarnessBridge(envs, svcs, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()),
    );

    unmount();

    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoSeedHarnessTarget).toBeUndefined();
    expect(w.__demoDeleteFeatureGroupsByName).toBeUndefined();
  });

  it('seeds target environment and microservice', () => {
    const setEnv = vi.fn();
    const setSvc = vi.fn();
    const { envs, svcs } = setupMocks();

    renderHook(() => useDemoHarnessBridge(envs, svcs, setEnv, setSvc));

    const bridge = (window as unknown as Record<string, (arg?: unknown) => { envId: string; svcId: string }>).__demoSeedHarnessTarget;

    const result = bridge?.();

    expect(result).toHaveProperty('envId');
    expect(result).toHaveProperty('svcId');
  });

  it('deletes feature groups by name', () => {
    const setFg = vi.fn((cb) => {
      const fgs: FeatureGroup[] = [
        { name: 'FG1' } as unknown as FeatureGroup,
        { name: 'FG2' } as unknown as FeatureGroup,
      ];
      const result = cb(fgs);
      expect(result).toHaveLength(1);
    });
    const { envs, svcs } = setupMocks();

    renderHook(() =>
      useDemoHarnessBridge(envs, svcs, vi.fn(), vi.fn(), setFg),
    );

    const bridge = (window as unknown as Record<string, (name: string) => void>).__demoDeleteFeatureGroupsByName;

    bridge?.('FG1');

    expect(setFg).toHaveBeenCalled();
  });

  it('handles undefined setFeatureGroups gracefully', () => {
    const { envs, svcs } = setupMocks();

    const { rerender } = renderHook(() =>
      useDemoHarnessBridge(envs, svcs, vi.fn(), vi.fn()),
    );

    expect(() => rerender()).not.toThrow();
  });

  it('handles undefined setter callbacks gracefully', () => {
    const { envs, svcs } = setupMocks();

    const { unmount } = renderHook(() =>
      useDemoHarnessBridge(envs, svcs, vi.fn(), vi.fn()),
    );

    unmount();

    expect(() => unmount()).not.toThrow();
  });
});

function setupMocks() {
  const envs: Environment[] = [{ id: 'env1', name: 'dev' }];
  const svcs: Microservice[] = [{ id: 'svc1', name: 'api', baseUrls: {} }];
  return { envs, svcs };
}
