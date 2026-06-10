/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketReconnect } from './useWebSocketReconnect';
import { createDefaultReconnectState } from '../../shared/websocket/types';

function createMountedRef() {
  return { current: true };
}

function createConnectFnRef(fn: () => void = vi.fn()) {
  return { current: fn };
}

describe('useWebSocketReconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default state', () => {
    const connectRef = createConnectFnRef();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    expect(result.current.autoReconnect).toBe(false);
    expect(result.current.reconnectIntervalMs).toBe(3000);
    expect(result.current.maxReconnectAttempts).toBe(5);
    expect(result.current.backoffMultiplier).toBe(2);
    expect(result.current.reconnectState.active).toBe(false);
    expect(result.current.reconnectState.attempt).toBe(0);
  });

  it('setAutoReconnect toggles autoReconnect', () => {
    const connectRef = createConnectFnRef();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setAutoReconnect(true));
    expect(result.current.autoReconnect).toBe(true);

    act(() => result.current.setAutoReconnect(false));
    expect(result.current.autoReconnect).toBe(false);
  });

  it('setReconnectIntervalMs updates interval', () => {
    const connectRef = createConnectFnRef();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setReconnectIntervalMs(5000));
    expect(result.current.reconnectIntervalMs).toBe(5000);
  });

  it('setMaxReconnectAttempts updates max attempts', () => {
    const connectRef = createConnectFnRef();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setMaxReconnectAttempts(10));
    expect(result.current.maxReconnectAttempts).toBe(10);
  });

  it('setBackoffMultiplier updates multiplier', () => {
    const connectRef = createConnectFnRef();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setBackoffMultiplier(2));
    expect(result.current.backoffMultiplier).toBe(2);
  });

  it('scheduleReconnect does nothing when autoReconnect is false', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.scheduleReconnectRef.current());
    expect(result.current.reconnectState.active).toBe(false);
    expect(connectFn).not.toHaveBeenCalled();
  });

  it('scheduleReconnect does nothing when component unmounted', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const mountedRef = createMountedRef();
    mountedRef.current = false;

    const { result } = renderHook(() => useWebSocketReconnect(connectRef, mountedRef));
    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());

    expect(result.current.reconnectState.active).toBe(false);
  });

  it('scheduleReconnect starts reconnect cycle when autoReconnect is true', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());

    expect(result.current.reconnectState.active).toBe(true);
    expect(result.current.reconnectState.attempt).toBe(1);
    expect(result.current.reconnectState.maxAttempts).toBe(5);
    expect(result.current.reconnectState.nextRetryAt).toBeGreaterThan(0);
  });

  it('scheduleReconnect calls connectFnRef after delay', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());

    expect(connectFn).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3000));
    expect(connectFn).toHaveBeenCalledTimes(1);
  });

  it('scheduleReconnect stops after max attempts exceeded', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => {
      result.current.setAutoReconnect(true);
      result.current.setMaxReconnectAttempts(2);
      result.current.setBackoffMultiplier(1); // no backoff for predictable timing
    });

    // Attempt 1
    act(() => result.current.scheduleReconnectRef.current());
    expect(result.current.reconnectState.attempt).toBe(1);
    act(() => vi.advanceTimersByTime(3000));

    // Attempt 2
    act(() => result.current.scheduleReconnectRef.current());
    expect(result.current.reconnectState.attempt).toBe(2);
    act(() => vi.advanceTimersByTime(3000));

    // Attempt 3 — exceeds max
    act(() => result.current.scheduleReconnectRef.current());
    expect(result.current.reconnectState.active).toBe(false);
    expect(result.current.reconnectState.attempt).toBe(2);
  });

  it('applies backoff multiplier to delay', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => {
      result.current.setAutoReconnect(true);
      result.current.setReconnectIntervalMs(1000);
      result.current.setBackoffMultiplier(2);
    });

    // Attempt 1: delay = 1000 * 2^0 = 1000
    act(() => result.current.scheduleReconnectRef.current());
    act(() => vi.advanceTimersByTime(1000));
    expect(connectFn).toHaveBeenCalledTimes(1);

    // Attempt 2: delay = 1000 * 2^1 = 2000
    act(() => result.current.scheduleReconnectRef.current());
    act(() => vi.advanceTimersByTime(1999));
    expect(connectFn).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(connectFn).toHaveBeenCalledTimes(2);
  });

  it('cancelReconnect clears pending timer and resets state', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());
    expect(result.current.reconnectState.active).toBe(true);

    act(() => result.current.cancelReconnect());
    expect(result.current.reconnectState.active).toBe(false);
    expect(result.current.reconnectState.attempt).toBe(0);

    // Timer should not fire after cancel
    act(() => vi.advanceTimersByTime(5000));
    expect(connectFn).not.toHaveBeenCalled();
  });

  it('retryNow immediately calls connect and resets attempts', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setAutoReconnect(true));
    // Schedule then cancel midway
    act(() => result.current.scheduleReconnectRef.current());
    act(() => result.current.retryNow());

    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(result.current.reconnectState.attempt).toBe(0);
  });

  it('does not fire timer when unmounted before delay', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const mountedRef = createMountedRef();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, mountedRef));

    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());

    mountedRef.current = false;
    act(() => vi.advanceTimersByTime(3000));
    expect(connectFn).not.toHaveBeenCalled();
  });

  it('does not schedule duplicate when timer already pending', () => {
    const connectFn = vi.fn();
    const connectRef = createConnectFnRef(connectFn);
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());
    act(() => result.current.scheduleReconnectRef.current()); // duplicate — no-op

    act(() => vi.advanceTimersByTime(3000));
    expect(connectFn).toHaveBeenCalledTimes(1);
  });

  it('lastReconnectErrorRef persists last error string', () => {
    const connectRef = createConnectFnRef();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    result.current.lastReconnectErrorRef.current = 'connection refused';
    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());

    expect(result.current.reconnectState.lastError).toBe('connection refused');
  });

  it('records lostAt timestamp on first attempt', () => {
    const connectRef = createConnectFnRef();
    const now = Date.now();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());

    expect(result.current.reconnectState.lostAt).toBeGreaterThanOrEqual(now);
  });

  it('reconnectingRef is true only during connect call', () => {
    let duringConnect = false;
    const connectRef = createConnectFnRef(() => {
      duringConnect = true;
    });
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => result.current.setAutoReconnect(true));
    act(() => result.current.scheduleReconnectRef.current());

    expect(result.current.reconnectingRef.current).toBe(false);
    act(() => vi.advanceTimersByTime(3000));
    // After the timer fires, reconnectingRef is reset to false
    expect(result.current.reconnectingRef.current).toBe(false);
    expect(duringConnect).toBe(true);
  });

  it('cancelReconnect after max attempts resets cleanly', () => {
    const connectRef = createConnectFnRef();
    const { result } = renderHook(() => useWebSocketReconnect(connectRef, createMountedRef()));

    act(() => {
      result.current.setAutoReconnect(true);
      result.current.setMaxReconnectAttempts(1);
    });

    // exhaust attempts
    act(() => result.current.scheduleReconnectRef.current());
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.scheduleReconnectRef.current()); // exceeds max

    act(() => result.current.cancelReconnect());
    expect(result.current.reconnectState).toEqual(createDefaultReconnectState(1));
  });
});
