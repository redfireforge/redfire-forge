/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketUptime } from './useWebSocketUptime';

describe('useWebSocketUptime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('initializes with null uptime', () => {
    const { result } = renderHook(() => useWebSocketUptime());
    expect(result.current.uptime).toBeNull();
  });

  it('starts uptime timer and sets uptime to 0', () => {
    const { result } = renderHook(() => useWebSocketUptime());
    act(() => {
      result.current.connectedAtRef.current = Date.now();
      result.current.startUptimeTimer();
    });
    expect(result.current.uptime).toBe(0);
  });

  it('tracks uptime over time', () => {
    const { result } = renderHook(() => useWebSocketUptime());
    act(() => {
      result.current.connectedAtRef.current = Date.now();
      result.current.startUptimeTimer();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.uptime).toBeGreaterThanOrEqual(2000);
  });

  it('resets timing clears uptime and stops timer', () => {
    const { result } = renderHook(() => useWebSocketUptime());
    act(() => {
      result.current.connectedAtRef.current = Date.now();
      result.current.startUptimeTimer();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.uptime).toBeGreaterThan(0);
    act(() => {
      result.current.resetConnectionTiming();
    });
    expect(result.current.uptime).toBeNull();
    expect(result.current.connectedAtRef.current).toBeNull();
  });

  it('stopUptimeTimer prevents further updates', () => {
    const { result } = renderHook(() => useWebSocketUptime());
    act(() => {
      result.current.connectedAtRef.current = Date.now();
      result.current.startUptimeTimer();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const uptimeAfter2s = result.current.uptime!;
    act(() => {
      result.current.stopUptimeTimer();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Should not have changed since timer was stopped
    expect(result.current.uptime).toBe(uptimeAfter2s);
  });

  it('startUptimeTimer restarts cleanly after a previous timer', () => {
    const { result } = renderHook(() => useWebSocketUptime());
    act(() => {
      result.current.connectedAtRef.current = Date.now();
      result.current.startUptimeTimer();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Restart the timer
    act(() => {
      result.current.connectedAtRef.current = Date.now();
      result.current.startUptimeTimer();
    });
    expect(result.current.uptime).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Should be around 1000ms, not 6000ms
    expect(result.current.uptime).toBeLessThan(2000);
  });

  it('does not update uptime when connectedAtRef is null during tick (line 33 false branch)', () => {
    const { result } = renderHook(() => useWebSocketUptime());
    // Start timer without setting connectedAtRef
    act(() => {
      result.current.startUptimeTimer();
    });
    // Advance timer — connectedAtRef is null, so uptime stays at 0
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.uptime).toBe(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
