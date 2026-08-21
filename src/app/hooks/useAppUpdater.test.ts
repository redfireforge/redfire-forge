/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppUpdater } from './useAppUpdater';

const mockIsTauri = vi.fn(() => false);
vi.mock('../../shared/utils/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

const mockCheck = vi.fn();
const mockRelaunch = vi.fn();
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

const CHECK_DELAY_MS = 3000;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAppUpdater', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockIsTauri.mockReturnValue(false);
    mockCheck.mockReset();
    mockRelaunch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not schedule an update check outside of Tauri', async () => {
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(mockCheck).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('clears the scheduled check on unmount before it fires', async () => {
    mockIsTauri.mockReturnValue(true);
    const { unmount } = renderHook(() => useAppUpdater());
    unmount();
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it('marks an update available after the delayed check resolves', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: true, version: '1.2.3', body: 'release notes' });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(result.current.status).toBe('available');
    expect(result.current.updateInfo).toEqual({ version: '1.2.3', body: 'release notes' });
  });

  it('defaults body to null when the update has no body', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: true, version: '1.2.3' });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(result.current.updateInfo).toEqual({ version: '1.2.3', body: null });
  });

  it('stays idle when no update is available', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: false });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(result.current.status).toBe('idle');
    expect(result.current.updateInfo).toBeNull();
  });

  it('stays idle when check() resolves undefined', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(result.current.status).toBe('idle');
  });

  it('stays idle when the check throws', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(result.current.status).toBe('idle');
  });

  it('installUpdate is a no-op when there is no pending update', async () => {
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { await result.current.installUpdate(); });
    expect(mockCheck).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('downloads, tracks progress, and relaunches on install', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: true, version: '2.0.0', body: null });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(result.current.status).toBe('available');

    const downloadAndInstall = vi.fn(async (cb: (e: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => {
      cb({ event: 'Started', data: { contentLength: 100 } });
      cb({ event: 'Progress', data: { chunkLength: 50 } });
      cb({ event: 'Progress', data: { chunkLength: 50 } });
      cb({ event: 'Finished' });
    });
    mockCheck.mockResolvedValue({ available: true, downloadAndInstall });

    await act(async () => { await result.current.installUpdate(); });

    expect(downloadAndInstall).toHaveBeenCalled();
    expect(mockRelaunch).toHaveBeenCalled();
    expect(result.current.status).toBe('downloading');
    expect(result.current.downloadProgress).toBe(100);
  });

  it('does not track progress when contentLength is absent (total stays zero)', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: true, version: '2.0.0', body: null });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();

    const downloadAndInstall = vi.fn(async (cb: (e: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => {
      cb({ event: 'Started', data: {} });
      cb({ event: 'Progress', data: { chunkLength: 50 } });
      cb({ event: 'Finished' });
    });
    mockCheck.mockResolvedValue({ available: true, downloadAndInstall });

    await act(async () => { await result.current.installUpdate(); });

    expect(result.current.downloadProgress).toBe(100);
  });

  it('stops installing when a re-check reports the update is no longer available', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: true, version: '2.0.0', body: null });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();

    mockCheck.mockResolvedValue({ available: false });
    await act(async () => { await result.current.installUpdate(); });

    expect(mockRelaunch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('downloading');
  });

  it('sets an error status with the thrown message when install fails', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: true, version: '2.0.0', body: null });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();

    mockCheck.mockRejectedValue(new Error('disk full'));
    await act(async () => { await result.current.installUpdate(); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('disk full');
  });

  it('falls back to a generic error message for non-Error throws', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: true, version: '2.0.0', body: null });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();

    mockCheck.mockRejectedValue('nope');
    await act(async () => { await result.current.installUpdate(); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('Update failed');
  });

  it('dismissUpdate resets status and update info', async () => {
    mockIsTauri.mockReturnValue(true);
    mockCheck.mockResolvedValue({ available: true, version: '1.2.3', body: null });
    const { result } = renderHook(() => useAppUpdater());
    await act(async () => { vi.advanceTimersByTime(CHECK_DELAY_MS); });
    await flush();
    expect(result.current.status).toBe('available');

    act(() => { result.current.dismissUpdate(); });

    expect(result.current.status).toBe('idle');
    expect(result.current.updateInfo).toBeNull();
  });
});
