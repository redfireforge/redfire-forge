/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoWorkspaceDefaultsBridge } from './useDemoWorkspaceDefaultsBridge';

describe('useDemoWorkspaceDefaultsBridge', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertWorkspaceDefaults;
    delete (window as unknown as Record<string, unknown>).__demoRemoveWorkspaceDefaults;
  });

  it('registers and unregisters both bridge functions', () => {
    const setWorkspaceDefaults = () => {};
    const { unmount } = renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    expect((window as unknown as Record<string, unknown>).__demoUpsertWorkspaceDefaults).toBeTypeOf('function');
    expect((window as unknown as Record<string, unknown>).__demoRemoveWorkspaceDefaults).toBeTypeOf('function');

    unmount();
    expect((window as unknown as Record<string, unknown>).__demoUpsertWorkspaceDefaults).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoRemoveWorkspaceDefaults).toBeUndefined();
  });

  it('merges patch into workspace defaults state', () => {
    let state: Record<string, string> = { grpcHost: 'localhost:50051' };
    const setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>> = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };

    renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    const bridge = (window as unknown as {
      __demoUpsertWorkspaceDefaults?: (patch: Record<string, string>) => void;
    }).__demoUpsertWorkspaceDefaults;

    bridge?.({ authToken: 'token-demo-123' });

    expect(state).toEqual({ grpcHost: 'localhost:50051', authToken: 'token-demo-123' });
  });

  it('removes keys from workspace defaults state', () => {
    let state: Record<string, string> = { grpcHost: 'localhost:50051', requestId: 'req-1', userId: 'u-1' };
    const setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>> = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };

    renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    const bridge = (window as unknown as {
      __demoRemoveWorkspaceDefaults?: (keys: string[]) => void;
    }).__demoRemoveWorkspaceDefaults;

    bridge?.(['requestId', 'userId']);

    expect(state).toEqual({ grpcHost: 'localhost:50051' });
  });
});
