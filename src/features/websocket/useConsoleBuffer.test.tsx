/**
 * Tests for useConsoleBuffer — the generic console ring-buffer + settings hook
 * shared by the WebSocket and SSE consoles. Covers load-on-mount, append + cap,
 * clear, setSettings, debounced persistence, and the unmount flush.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WsConsoleEntry, WsConsoleSettings } from './wsConsoleTypes';
import { WS_CONSOLE_DEFAULT_SETTINGS } from './wsConsoleTypes';

const loadConsoleSettings = vi.fn();
const saveConsoleSettings = vi.fn();

vi.mock('./wsConsoleStorage', () => ({
  loadConsoleSettings: (key: string) => loadConsoleSettings(key),
  saveConsoleSettings: (key: string, settings: WsConsoleSettings) => saveConsoleSettings(key, settings),
}));

import { useConsoleBuffer } from './useConsoleBuffer';

const KEY = 'redfire-test-console-v1';

function makeEntry(id: string): WsConsoleEntry {
  return {
    id,
    ts: Date.now(),
    direction: 'in',
    level: 'info',
    category: 'message',
    summary: `entry-${id}`,
  } as WsConsoleEntry;
}

describe('useConsoleBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loadConsoleSettings.mockReset();
    saveConsoleSettings.mockReset();
    loadConsoleSettings.mockResolvedValue({ ...WS_CONSOLE_DEFAULT_SETTINGS });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('starts empty with defaults and loads persisted settings on mount', async () => {
    const loaded: WsConsoleSettings = { ...WS_CONSOLE_DEFAULT_SETTINGS, maxEntries: 50 };
    loadConsoleSettings.mockResolvedValue(loaded);
    const { result } = renderHook(() => useConsoleBuffer(KEY));

    expect(result.current.entries).toEqual([]);
    expect(result.current.settingsLoaded).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadConsoleSettings).toHaveBeenCalledWith(KEY);
    expect(result.current.settingsLoaded).toBe(true);
    expect(result.current.settings.maxEntries).toBe(50);
  });

  it('append adds entries and clear empties them', async () => {
    const { result } = renderHook(() => useConsoleBuffer(KEY));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.append(makeEntry('1'));
      result.current.append(makeEntry('2'));
    });
    expect(result.current.entries.map((e) => e.id)).toEqual(['1', '2']);

    act(() => result.current.clear());
    expect(result.current.entries).toEqual([]);
  });

  it('caps the buffer at the current maxEntries setting', async () => {
    loadConsoleSettings.mockResolvedValue({ ...WS_CONSOLE_DEFAULT_SETTINGS, maxEntries: 2 });
    const { result } = renderHook(() => useConsoleBuffer(KEY));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.append(makeEntry('1'));
      result.current.append(makeEntry('2'));
      result.current.append(makeEntry('3'));
    });
    // oldest dropped, only the last 2 remain
    expect(result.current.entries.map((e) => e.id)).toEqual(['2', '3']);
  });

  it('setSettings updates settings and persists after the debounce', async () => {
    const { result } = renderHook(() => useConsoleBuffer(KEY));
    await act(async () => {
      await Promise.resolve();
    });
    saveConsoleSettings.mockClear();

    const next: WsConsoleSettings = { ...WS_CONSOLE_DEFAULT_SETTINGS, maxEntries: 123 };
    act(() => result.current.setSettings(next));
    expect(result.current.settings.maxEntries).toBe(123);

    // not saved yet (debounce pending)
    expect(saveConsoleSettings).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(saveConsoleSettings).toHaveBeenCalledWith(KEY, next);
  });

  it('does not persist before the initial load completes', () => {
    // load never resolves → settingsLoaded stays false → no save
    loadConsoleSettings.mockReturnValue(new Promise<WsConsoleSettings>(() => {}));
    renderHook(() => useConsoleBuffer(KEY));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveConsoleSettings).not.toHaveBeenCalled();
  });

  it('flushes the latest settings on unmount when loaded', async () => {
    const { result, unmount } = renderHook(() => useConsoleBuffer(KEY));
    await act(async () => {
      await Promise.resolve();
    });
    const next: WsConsoleSettings = { ...WS_CONSOLE_DEFAULT_SETTINGS, maxEntries: 77 };
    act(() => result.current.setSettings(next));
    saveConsoleSettings.mockClear();

    unmount();
    expect(saveConsoleSettings).toHaveBeenCalledWith(KEY, next);
  });

  it('does not flush on unmount when settings never loaded', () => {
    loadConsoleSettings.mockReturnValue(new Promise<WsConsoleSettings>(() => {}));
    const { unmount } = renderHook(() => useConsoleBuffer(KEY));
    unmount();
    expect(saveConsoleSettings).not.toHaveBeenCalled();
  });

  it('ignores a resolved load after the hook has unmounted', async () => {
    let resolveLoad: (s: WsConsoleSettings) => void = () => {};
    loadConsoleSettings.mockReturnValue(
      new Promise<WsConsoleSettings>((res) => {
        resolveLoad = res;
      }),
    );
    const { result, unmount } = renderHook(() => useConsoleBuffer(KEY));
    unmount();
    await act(async () => {
      resolveLoad({ ...WS_CONSOLE_DEFAULT_SETTINGS, maxEntries: 999 });
      await Promise.resolve();
    });
    // cancelled guard: state was not applied (and no crash)
    expect(result.current.settingsLoaded).toBe(false);
  });
});
