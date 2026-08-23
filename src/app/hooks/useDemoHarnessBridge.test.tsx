/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { Environment, Microservice } from '@shared/types';
import { useDemoHarnessBridge } from './useDemoHarnessBridge';

function useHarnessBridgeHarness(initialEnv: Environment[] = [], initialSvc: Microservice[] = []) {
  const [environments, setEnvironments] = useState<Environment[]>(initialEnv);
  const [microservices, setMicroservices] = useState<Microservice[]>(initialSvc);
  useDemoHarnessBridge(environments, microservices, setEnvironments, setMicroservices);
  return { environments, microservices };
}

describe('useDemoHarnessBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoSeedHarnessTarget;
    delete (window as unknown as Record<string, unknown>).__demoDeleteFeatureGroupsByName;
  });

  it('seeds demo environment and jsonplaceholder service when missing', async () => {
    const { result } = renderHook(() => useHarnessBridgeHarness());

    const seed = (window as unknown as Record<string, unknown>).__demoSeedHarnessTarget as
      | (() => { envId: string; svcId: string })
      | undefined;

    expect(seed).toBeTypeOf('function');

    let ids: { envId: string; svcId: string } | undefined;
    act(() => {
      ids = seed?.();
    });

    await waitFor(() => {
      expect(result.current.environments).toHaveLength(1);
      expect(result.current.microservices).toHaveLength(1);
    });

    const env = result.current.environments[0];
    const svc = result.current.microservices[0];

    expect(env.name).toBe('demo');
    expect(svc.name).toBe('jsonplaceholder');
    expect(svc.baseUrls[env.id]).toBe('https://jsonplaceholder.typicode.com');
    expect(ids?.envId).toBe(env.id);
    expect(ids?.svcId).toBe(svc.id);
  });

  it('reuses existing targets and repairs missing env base URL', async () => {
    const env: Environment = { id: 'env-1', name: 'demo' };
    const svc: Microservice = { id: 'svc-1', name: 'jsonplaceholder', baseUrls: {} };

    const { result } = renderHook(() => useHarnessBridgeHarness([env], [svc]));

    const seed = (window as unknown as Record<string, unknown>).__demoSeedHarnessTarget as
      | (() => { envId: string; svcId: string })
      | undefined;

    let ids: { envId: string; svcId: string } | undefined;
    act(() => {
      ids = seed?.();
    });

    await waitFor(() => {
      expect(result.current.environments).toHaveLength(1);
      expect(result.current.microservices).toHaveLength(1);
      expect(result.current.microservices[0].baseUrls['env-1']).toBe('https://jsonplaceholder.typicode.com');
    });

    expect(ids).toEqual({ envId: 'env-1', svcId: 'svc-1' });
  });

  it('reuses existing targets when env base URL already exists and clears bridge on unmount', async () => {
    const env: Environment = { id: 'env-1', name: 'demo' };
    const svc: Microservice = {
      id: 'svc-1',
      name: 'jsonplaceholder',
      baseUrls: { 'env-1': 'https://jsonplaceholder.typicode.com' },
    };

    const { result, unmount } = renderHook(() => useHarnessBridgeHarness([env], [svc]));

    const seed = (window as unknown as Record<string, unknown>).__demoSeedHarnessTarget as
      | (() => { envId: string; svcId: string })
      | undefined;

    let ids: { envId: string; svcId: string } | undefined;
    act(() => {
      ids = seed?.();
    });

    await waitFor(() => {
      expect(result.current.environments).toHaveLength(1);
      expect(result.current.microservices).toHaveLength(1);
    });

    expect(result.current.microservices[0].baseUrls['env-1']).toBe('https://jsonplaceholder.typicode.com');
    expect(ids).toEqual({ envId: 'env-1', svcId: 'svc-1' });

    unmount();
    expect((window as unknown as Record<string, unknown>).__demoSeedHarnessTarget).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoDeleteFeatureGroupsByName).toBeUndefined();
  });
});
