/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyToClipboard } from './useCopyToClipboard';
import { installClipboardMock } from '../../test-utils/clipboardMock';

describe('useCopyToClipboard', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = installClipboardMock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with copied = false', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current[0]).toBe(false);
  });

  it('returns a copy function', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(typeof result.current[1]).toBe('function');
  });

  it('sets copied = true after writing to clipboard', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    const [, copy] = result.current;

    await act(async () => {
      await copy('hello');
    });

    expect(result.current[0]).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('resets copied to false after the default delay (1500ms)', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    const [, copy] = result.current;

    await act(async () => { await copy('text'); });
    expect(result.current[0]).toBe(true);

    act(() => { vi.advanceTimersByTime(1499); });
    expect(result.current[0]).toBe(true);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current[0]).toBe(false);
  });

  it('respects a custom resetDelay', async () => {
    const { result } = renderHook(() => useCopyToClipboard(3000));
    const [, copy] = result.current;

    await act(async () => { await copy('text'); });
    act(() => { vi.advanceTimersByTime(2999); });
    expect(result.current[0]).toBe(true);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current[0]).toBe(false);
  });

  it('clears previous timeout when copy is called again before reset', async () => {
    const { result } = renderHook(() => useCopyToClipboard(1500));
    const [, copy] = result.current;

    await act(async () => { await copy('first'); });
    act(() => { vi.advanceTimersByTime(1000); }); // 1000ms into first reset

    // Copy again before the first reset fires
    await act(async () => { await copy('second'); });
    expect(result.current[0]).toBe(true);

    // Another 600ms — if first timer wasn't cleared, it would have reset by now
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current[0]).toBe(true); // still true (second timer at ~600ms in)

    act(() => { vi.advanceTimersByTime(900); });
    expect(result.current[0]).toBe(false); // second timer fired at 1500ms
  });

  it('silently ignores clipboard errors', async () => {
    writeText.mockRejectedValue(new DOMException('not allowed', 'NotAllowedError'));
    const { result } = renderHook(() => useCopyToClipboard());
    const [, copy] = result.current;

    await act(async () => {
      await copy('secret');
    });

    expect(result.current[0]).toBe(false); // no feedback on failure
  });

  it('clears the timeout on unmount', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useCopyToClipboard(1500));
    const [, copy] = result.current;

    await act(async () => { await copy('text'); });
    expect(result.current[0]).toBe(true);

    unmount();

    // The timeout should have been cleared during cleanup
    expect(clearSpy).toHaveBeenCalled();
  });

  it('does not update state after unmount', async () => {
    const { result, unmount } = renderHook(() => useCopyToClipboard(500));
    const [, copy] = result.current;

    await act(async () => { await copy('text'); });
    unmount();

    // Advancing timers after unmount should not throw
    expect(() => act(() => { vi.advanceTimersByTime(600); })).not.toThrow();
  });

  it('passes the exact text to clipboard.writeText', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    const [, copy] = result.current;
    const longText = 'a'.repeat(5000);

    await act(async () => { await copy(longText); });

    expect(writeText).toHaveBeenCalledWith(longText);
  });
});
