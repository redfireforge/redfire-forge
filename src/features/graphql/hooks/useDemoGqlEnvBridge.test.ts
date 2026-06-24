/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoGqlEnvBridge } from './useDemoGqlEnvBridge';

describe('useDemoGqlEnvBridge', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
    delete (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName;
  });

  it('registers upsert and delete handlers on window', () => {
    const upsertEnvironment = vi.fn();
    const deleteEnvironmentByName = vi.fn();

    renderHook(() => useDemoGqlEnvBridge({ upsertEnvironment, deleteEnvironmentByName }));

    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoUpsertGqlEnv).toBeTypeOf('function');
    expect(w.__demoDeleteGqlEnvByName).toBeTypeOf('function');

    act(() => {
      (w.__demoUpsertGqlEnv as (name: string, vars: Array<{ key: string; value: string }>) => void)(
        'Demo',
        [{ key: 'authToken', value: 'jwt' }],
      );
      (w.__demoDeleteGqlEnvByName as (name: string) => void)('Demo');
    });

    expect(upsertEnvironment).toHaveBeenCalledWith('Demo', [{ key: 'authToken', value: 'jwt' }]);
    expect(deleteEnvironmentByName).toHaveBeenCalledWith('Demo');
  });

  it('uses latest deps via ref after rerender', () => {
    const upsertV1 = vi.fn();
    const deleteV1 = vi.fn();
    const { rerender } = renderHook(
      ({ upsert, del }) => useDemoGqlEnvBridge({ upsertEnvironment: upsert, deleteEnvironmentByName: del }),
      { initialProps: { upsert: upsertV1, del: deleteV1 } },
    );

    const upsertV2 = vi.fn();
    const deleteV2 = vi.fn();
    rerender({ upsert: upsertV2, del: deleteV2 });

    const w = window as unknown as Record<string, unknown>;
    act(() => {
      (w.__demoUpsertGqlEnv as (name: string, vars: Array<{ key: string; value: string }>) => void)(
        'Demo',
        [{ key: 'apiKey', value: 'secret' }],
      );
      (w.__demoDeleteGqlEnvByName as (name: string) => void)('Other');
    });

    expect(upsertV1).not.toHaveBeenCalled();
    expect(deleteV1).not.toHaveBeenCalled();
    expect(upsertV2).toHaveBeenCalledWith('Demo', [{ key: 'apiKey', value: 'secret' }]);
    expect(deleteV2).toHaveBeenCalledWith('Other');
  });

  it('cleans up window handlers on unmount', () => {
    const { unmount } = renderHook(() => useDemoGqlEnvBridge({
      upsertEnvironment: vi.fn(),
      deleteEnvironmentByName: vi.fn(),
    }));
    unmount();
    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoUpsertGqlEnv).toBeUndefined();
    expect(w.__demoDeleteGqlEnvByName).toBeUndefined();
  });
});
