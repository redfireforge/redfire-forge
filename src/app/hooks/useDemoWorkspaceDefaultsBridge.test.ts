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

  it('re-registers bridge after setter identity changes', () => {
    let state: Record<string, string> = {};
    let setter: React.Dispatch<React.SetStateAction<Record<string, string>>> = () => {};
    const { rerender } = renderHook(
      ({ apply }) => useDemoWorkspaceDefaultsBridge(apply),
      { initialProps: { apply: setter } },
    );

    setter = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };
    rerender({ apply: setter });

    (window as unknown as {
      __demoUpsertWorkspaceDefaults?: (patch: Record<string, string>) => void;
    }).__demoUpsertWorkspaceDefaults?.({ key: 'value' });

    expect(state).toEqual({ key: 'value' });
  });

  it('handles empty patch without errors', () => {
    let state: Record<string, string> = { grpcHost: 'localhost:50051' };
    const setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>> = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };

    renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    const bridge = (window as unknown as {
      __demoUpsertWorkspaceDefaults?: (patch: Record<string, string>) => void;
    }).__demoUpsertWorkspaceDefaults;

    bridge?.({});

    expect(state).toEqual({ grpcHost: 'localhost:50051' });
  });

  it('handles empty keys array without errors', () => {
    let state: Record<string, string> = { grpcHost: 'localhost:50051', userId: 'u-1' };
    const setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>> = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };

    renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    const bridge = (window as unknown as {
      __demoRemoveWorkspaceDefaults?: (keys: string[]) => void;
    }).__demoRemoveWorkspaceDefaults;

    bridge?.([]);

    expect(state).toEqual({ grpcHost: 'localhost:50051', userId: 'u-1' });
  });

  it('handles removing non-existent keys gracefully', () => {
    let state: Record<string, string> = { grpcHost: 'localhost:50051' };
    const setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>> = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };

    renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    const bridge = (window as unknown as {
      __demoRemoveWorkspaceDefaults?: (keys: string[]) => void;
    }).__demoRemoveWorkspaceDefaults;

    bridge?.(['nonExistent', 'alsoNotThere']);

    expect(state).toEqual({ grpcHost: 'localhost:50051' });
  });

  it('handles multiple consecutive patches correctly', () => {
    let state: Record<string, string> = { baseKey: 'base' };
    const setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>> = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };

    renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    const bridge = (window as unknown as {
      __demoUpsertWorkspaceDefaults?: (patch: Record<string, string>) => void;
    }).__demoUpsertWorkspaceDefaults;

    bridge?.({ key1: 'value1' });
    expect(state).toEqual({ baseKey: 'base', key1: 'value1' });

    bridge?.({ key2: 'value2' });
    expect(state).toEqual({ baseKey: 'base', key1: 'value1', key2: 'value2' });

    bridge?.({ key1: 'updated' });
    expect(state).toEqual({ baseKey: 'base', key1: 'updated', key2: 'value2' });
  });

  it('handles overwriting existing keys in patch', () => {
    let state: Record<string, string> = { grpcHost: 'localhost:50051', userId: 'u-1' };
    const setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>> = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };

    renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    const bridge = (window as unknown as {
      __demoUpsertWorkspaceDefaults?: (patch: Record<string, string>) => void;
    }).__demoUpsertWorkspaceDefaults;

    bridge?.({ userId: 'u-2', grpcHost: 'localhost:9000' });

    expect(state).toEqual({ grpcHost: 'localhost:9000', userId: 'u-2' });
  });

  it('handles mixed upsert and remove operations', () => {
    let state: Record<string, string> = { grpcHost: 'localhost:50051', userId: 'u-1', requestId: 'r-1' };
    const setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>> = (next) => {
      state = typeof next === 'function' ? next(state) : next;
    };

    renderHook(() => useDemoWorkspaceDefaultsBridge(setWorkspaceDefaults));

    const upsertBridge = (window as unknown as {
      __demoUpsertWorkspaceDefaults?: (patch: Record<string, string>) => void;
    }).__demoUpsertWorkspaceDefaults;
    const removeBridge = (window as unknown as {
      __demoRemoveWorkspaceDefaults?: (keys: string[]) => void;
    }).__demoRemoveWorkspaceDefaults;

    upsertBridge?.({ authToken: 'token' });
    removeBridge?.(['userId']);

    expect(state).toEqual({ grpcHost: 'localhost:50051', requestId: 'r-1', authToken: 'token' });
  });
});
