/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketHistory } from './useWebSocketHistory';
import * as storageModule from '@shared/websocket/websocketStorage';

vi.mock('../../shared/websocket/websocketStorage', () => ({
  loadWsHistory: vi.fn(),
  saveWsHistory: vi.fn(),
  MAX_HISTORY_ENTRIES: 20,
}));

const mockLoad = vi.mocked(storageModule.loadWsHistory);
const mockSave = vi.mocked(storageModule.saveWsHistory);

beforeEach(() => {
  resetAllMocks();
  mockLoad.mockResolvedValue([]);
  mockSave.mockResolvedValue(undefined);
});

describe('useWebSocketHistory', () => {
  it('starts with empty history', async () => {
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});
    expect(result.current.history).toEqual([]);
  });

  it('loads history on mount', async () => {
    const entries = [
      { url: 'ws://a', protocol: 'auto' as const, lastUsed: '2025-01-01', connectCount: 1 },
    ];
    mockLoad.mockResolvedValue(entries);
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});
    expect(result.current.history).toEqual(entries);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('addEntry creates a new entry and persists', async () => {
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});
    act(() => {
      result.current.addEntry('ws://localhost:8765', 'auto');
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].url).toBe('ws://localhost:8765');
    expect(result.current.history[0].protocol).toBe('auto');
    expect(result.current.history[0].connectCount).toBe(1);
    expect(mockSave).toHaveBeenCalled();
  });

  it('addEntry increments connectCount for existing URL', async () => {
    const existing = [
      { url: 'ws://localhost:8765', protocol: 'auto' as const, lastUsed: '2025-01-01', connectCount: 3 },
    ];
    mockLoad.mockResolvedValue(existing);
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});

    act(() => {
      result.current.addEntry('ws://localhost:8765', 'auto');
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].connectCount).toBe(4);
  });

  it('addEntry moves existing URL to top', async () => {
    const existing = [
      { url: 'ws://first', protocol: 'auto' as const, lastUsed: '2025-01-02', connectCount: 1 },
      { url: 'ws://second', protocol: 'auto' as const, lastUsed: '2025-01-01', connectCount: 1 },
    ];
    mockLoad.mockResolvedValue(existing);
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});

    act(() => {
      result.current.addEntry('ws://second', 'auto');
    });
    expect(result.current.history[0].url).toBe('ws://second');
    expect(result.current.history[1].url).toBe('ws://first');
  });

  it('addEntry ignores empty URLs', async () => {
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});
    act(() => {
      result.current.addEntry('', 'auto');
      result.current.addEntry('   ', 'auto');
    });
    expect(result.current.history).toHaveLength(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('removeEntry removes by URL and persists', async () => {
    const existing = [
      { url: 'ws://a', protocol: 'auto' as const, lastUsed: '2025-01-01', connectCount: 1 },
      { url: 'ws://b', protocol: 'auto' as const, lastUsed: '2025-01-01', connectCount: 1 },
    ];
    mockLoad.mockResolvedValue(existing);
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});

    act(() => {
      result.current.removeEntry('ws://a');
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].url).toBe('ws://b');
    expect(mockSave).toHaveBeenCalled();
  });

  it('clearHistory empties and persists', async () => {
    const existing = [
      { url: 'ws://a', protocol: 'auto' as const, lastUsed: '2025-01-01', connectCount: 1 },
    ];
    mockLoad.mockResolvedValue(existing);
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});

    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.history).toEqual([]);
    expect(mockSave).toHaveBeenCalledWith([]);
  });

  it('keeps empty history when loadWsHistory rejects', async () => {
    mockLoad.mockRejectedValue(new Error('storage failed'));
    const { result } = renderHook(() => useWebSocketHistory());
    await act(async () => {});
    expect(result.current.history).toEqual([]);
  });

  it('does not set history after unmount (cancelled=true false branch — line 18)', async () => {
    let resolveLoad!: (v: typeof import('../../shared/websocket/types').WsConnectionEntry[]) => void;
    mockLoad.mockReturnValue(new Promise((res) => { resolveLoad = res; }));
    const { result, unmount } = renderHook(() => useWebSocketHistory());
    // Unmount before load resolves
    unmount();
    // Resolve after unmount — should not set history (cancelled=true)
    await act(async () => { resolveLoad([]); });
    // history stays as initial value (empty array)
    expect(result.current.history).toEqual([]);
  });
});
