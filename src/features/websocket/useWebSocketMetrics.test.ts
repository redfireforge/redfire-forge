/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketMetrics } from './useWebSocketMetrics';
import type { WsFrame } from '@shared/websocket/types';

function makeFrame(
  overrides: Partial<WsFrame> & { direction: 'sent' | 'received' },
): WsFrame {
  return {
    id: `frame-${Math.random().toString(36).slice(2)}`,
    type: 'text',
    data: 'hello',
    size: 5,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('useWebSocketMetrics', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns empty snapshot initially', () => {
    const { result } = renderHook(() => useWebSocketMetrics([], 'disconnected'));
    expect(result.current.msgPerSec).toBe(0);
    expect(result.current.history).toEqual([]);
    expect(result.current.totalBytesIn).toBe(0);
    expect(result.current.totalBytesOut).toBe(0);
    expect(result.current.textFrames).toBe(0);
    expect(result.current.binaryFrames).toBe(0);
    expect(result.current.controlFrames).toBe(0);
    expect(result.current.errorCount).toBe(0);
  });

  it('counts frame types from messages', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', type: 'text', size: 10 }),
      makeFrame({ direction: 'received', type: 'binary', size: 20 }),
      makeFrame({ direction: 'sent', type: 'ping', size: 0 }),
      makeFrame({ direction: 'received', type: 'close', size: 2 }),
    ];
    const { result } = renderHook(() => useWebSocketMetrics(messages, 'connected'));
    expect(result.current.textFrames).toBe(1);
    expect(result.current.binaryFrames).toBe(1);
    expect(result.current.controlFrames).toBe(2);
    expect(result.current.errorCount).toBe(1);
  });

  it('accumulates bytes in/out', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 100 }),
      makeFrame({ direction: 'sent', size: 50 }),
      makeFrame({ direction: 'received', size: 200 }),
    ];
    const { result } = renderHook(() => useWebSocketMetrics(messages, 'connected'));
    expect(result.current.totalBytesOut).toBe(150);
    expect(result.current.totalBytesIn).toBe(200);
  });

  it('produces per-second rates after interval tick', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 10 }),
      makeFrame({ direction: 'received', size: 20 }),
    ];
    const { result } = renderHook(() => useWebSocketMetrics(messages, 'connected'));

    act(() => { vi.advanceTimersByTime(1000); });

    expect(result.current.msgPerSec).toBe(2);
    expect(result.current.sentPerSec).toBe(1);
    expect(result.current.receivedPerSec).toBe(1);
    expect(result.current.bytesInPerSec).toBe(20);
    expect(result.current.bytesOutPerSec).toBe(10);
    expect(result.current.history.length).toBe(1);
    expect(result.current.history[0]).toBe(2);
  });

  it('resets accumulation after each sample', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 10 }),
    ];
    const { result } = renderHook(() => useWebSocketMetrics(messages, 'connected'));

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.msgPerSec).toBe(1);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.msgPerSec).toBe(0);
    expect(result.current.history.length).toBe(2);
    expect(result.current.history[1]).toBe(0);
  });

  it('builds history up to 60 entries', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 5 }),
    ];
    const { result } = renderHook(() => useWebSocketMetrics(messages, 'connected'));

    act(() => { vi.advanceTimersByTime(65_000); });

    expect(result.current.history.length).toBe(60);
  });

  it('zeroes rates but preserves totals on disconnect', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 100 }),
      makeFrame({ direction: 'received', size: 200 }),
    ];
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: messages, state: 'connected' } },
    );

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.totalBytesOut).toBe(100);
    expect(result.current.history.length).toBe(1);

    rerender({ msgs: messages, state: 'disconnected' });
    expect(result.current.msgPerSec).toBe(0);
    expect(result.current.bytesInPerSec).toBe(0);
    expect(result.current.bytesOutPerSec).toBe(0);
    expect(result.current.history).toEqual([]);
    expect(result.current.totalBytesIn).toBe(200);
    expect(result.current.totalBytesOut).toBe(100);
    expect(result.current.textFrames).toBe(2);
  });

  it('resets metrics when messages are cleared (length goes to 0)', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 100 }),
    ];
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: messages, state: 'connected' } },
    );
    expect(result.current.totalBytesOut).toBe(100);

    rerender({ msgs: [], state: 'connected' });
    expect(result.current.totalBytesOut).toBe(0);
    expect(result.current.textFrames).toBe(0);
  });

  it('does not start timer when not connected', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 10 }),
    ];
    const { result } = renderHook(() => useWebSocketMetrics(messages, 'disconnected'));

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.history).toEqual([]);
  });

  it('stops timer on unmount', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 10 }),
    ];
    const { unmount } = renderHook(() => useWebSocketMetrics(messages, 'connected'));

    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
  });

  it('processes new messages incrementally', () => {
    const msg1 = makeFrame({ direction: 'sent', size: 10 });
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: [msg1], state: 'connected' } },
    );
    expect(result.current.totalBytesOut).toBe(10);
    expect(result.current.textFrames).toBe(1);

    const msg2 = makeFrame({ direction: 'received', type: 'binary', size: 50 });
    rerender({ msgs: [msg1, msg2], state: 'connected' });
    expect(result.current.totalBytesOut).toBe(10);
    expect(result.current.totalBytesIn).toBe(50);
    expect(result.current.textFrames).toBe(1);
    expect(result.current.binaryFrames).toBe(1);
  });

  it('counts pong and close as control frames', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'received', type: 'pong', size: 0 }),
      makeFrame({ direction: 'received', type: 'close', size: 2 }),
    ];
    const { result } = renderHook(() => useWebSocketMetrics(messages, 'connected'));
    expect(result.current.controlFrames).toBe(2);
    expect(result.current.errorCount).toBe(1);
  });

  it('does not double-count messages after reconnect', () => {
    const msg1 = makeFrame({ direction: 'sent', size: 100 });
    const msg2 = makeFrame({ direction: 'received', size: 200 });
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: [msg1, msg2], state: 'connected' as string } },
    );
    expect(result.current.totalBytesOut).toBe(100);
    expect(result.current.totalBytesIn).toBe(200);

    rerender({ msgs: [msg1, msg2], state: 'disconnected' });
    rerender({ msgs: [msg1, msg2], state: 'connected' });

    const msg3 = makeFrame({ direction: 'received', size: 50 });
    rerender({ msgs: [msg1, msg2, msg3], state: 'connected' });

    expect(result.current.totalBytesOut).toBe(100);
    expect(result.current.totalBytesIn).toBe(250);
    expect(result.current.textFrames).toBe(3);
  });

  it('does not produce false spike on reconnect', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 100 }),
      makeFrame({ direction: 'received', size: 200 }),
    ];
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: messages, state: 'connected' as string } },
    );

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.msgPerSec).toBe(2);

    rerender({ msgs: messages, state: 'disconnected' });

    rerender({ msgs: messages, state: 'connected' });
    act(() => { vi.advanceTimersByTime(1000); });

    expect(result.current.msgPerSec).toBe(0);
    expect(result.current.sentPerSec).toBe(0);
    expect(result.current.receivedPerSec).toBe(0);
  });

  it('continues counting when cap eviction truncates array from front', () => {
    const m1 = makeFrame({ id: 'a1', direction: 'sent', size: 10 });
    const m2 = makeFrame({ id: 'a2', direction: 'received', size: 20 });
    const m3 = makeFrame({ id: 'a3', direction: 'sent', size: 30 });

    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: [m1, m2, m3], state: 'connected' } },
    );
    expect(result.current.totalBytesOut).toBe(40);
    expect(result.current.totalBytesIn).toBe(20);
    expect(result.current.textFrames).toBe(3);

    const m4 = makeFrame({ id: 'a4', direction: 'received', size: 50 });
    rerender({ msgs: [m2, m3, m4], state: 'connected' });

    expect(result.current.totalBytesOut).toBe(40);
    expect(result.current.totalBytesIn).toBe(70);
    expect(result.current.textFrames).toBe(4);
  });

  it('accumulates rates correctly at cap after eviction', () => {
    const m1 = makeFrame({ id: 'b1', direction: 'sent', size: 10 });
    const m2 = makeFrame({ id: 'b2', direction: 'received', size: 20 });

    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: [m1, m2], state: 'connected' } },
    );

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.msgPerSec).toBe(2);

    const m3 = makeFrame({ id: 'b3', direction: 'received', size: 30 });
    rerender({ msgs: [m2, m3], state: 'connected' });

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.msgPerSec).toBe(1);
    expect(result.current.receivedPerSec).toBe(1);
    expect(result.current.bytesInPerSec).toBe(30);
  });

  it('clears an active timer when leaving connected state', () => {
    const messages: WsFrame[] = [makeFrame({ direction: 'sent', size: 10 })];
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: messages, state: 'connected' as string } },
    );

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.history.length).toBe(1);

    rerender({ msgs: messages, state: 'connecting' });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.history.length).toBe(1);
  });

  it('resets snapshot on error state like disconnect', () => {
    const messages: WsFrame[] = [
      makeFrame({ direction: 'sent', size: 100 }),
      makeFrame({ direction: 'received', size: 200 }),
    ];
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: messages, state: 'connected' as string } },
    );

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.history.length).toBe(1);

    rerender({ msgs: messages, state: 'error' });
    expect(result.current.msgPerSec).toBe(0);
    expect(result.current.history).toEqual([]);
    expect(result.current.totalBytesOut).toBe(100);
  });

  it('does not restart timer when already connected and timer is active', () => {
    const messages: WsFrame[] = [makeFrame({ direction: 'sent', size: 5 })];
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: messages, state: 'connected' as string } },
    );

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.history.length).toBe(1);

    rerender({ msgs: messages, state: 'connected' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.history.length).toBe(2);
    expect(result.current.msgPerSec).toBe(0);
  });

  it('skips incremental processing when truncated array has no new tail', () => {
    const m1 = makeFrame({ id: 'tail-1', direction: 'sent', size: 10 });
    const m2 = makeFrame({ id: 'tail-2', direction: 'received', size: 20 });
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: [m1, m2], state: 'connected' as string } },
    );
    expect(result.current.totalBytesIn).toBe(20);

    rerender({ msgs: [m2], state: 'connected' });
    expect(result.current.totalBytesIn).toBe(20);
    expect(result.current.textFrames).toBe(2);
  });

  it('counts abnormal close frames as errors but ignores normal close codes', () => {
    const normalClose = makeFrame({
      direction: 'received',
      type: 'close',
      data: 'code: 1000 reason: ok',
      size: 12,
    });
    const abnormalClose = makeFrame({
      direction: 'received',
      type: 'close',
      data: 'code: 1006 reason: abnormal',
      size: 20,
    });
    const { result } = renderHook(() =>
      useWebSocketMetrics([normalClose, abnormalClose], 'connected'),
    );
    expect(result.current.errorCount).toBe(1);
    expect(result.current.controlFrames).toBe(2);
  });

  it('reprocesses from start when last seen id was evicted from the array', () => {
    const m1 = makeFrame({ id: 'evict-1', direction: 'sent', size: 10 });
    const m2 = makeFrame({ id: 'evict-2', direction: 'received', size: 20 });
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: [m1, m2], state: 'connected' as string } },
    );
    expect(result.current.totalBytesOut).toBe(10);

    const m3 = makeFrame({ id: 'evict-3', direction: 'sent', size: 30 });
    rerender({ msgs: [m3], state: 'connected' });
    expect(result.current.totalBytesOut).toBe(40);
    expect(result.current.textFrames).toBe(3);
  });

  it('clears timer on unmount while connected', () => {
    const messages = [makeFrame({ direction: 'sent', size: 5 })];
    const { unmount } = renderHook(() => useWebSocketMetrics(messages, 'connected'));
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
  });

  it('updates lastProcessedId without counting when tail is unchanged after shrink', () => {
    const m1 = makeFrame({ id: 'same-tail', direction: 'received', size: 10 });
    const m2 = makeFrame({ id: 'same-tail-2', direction: 'received', size: 20 });
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: [m1, m2], state: 'connected' as string } },
    );
    expect(result.current.totalBytesIn).toBe(30);

    rerender({ msgs: [m2], state: 'connected' });
    expect(result.current.totalBytesIn).toBe(30);
    expect(result.current.textFrames).toBe(2);
  });

  it('clears sampling timer when connection leaves connected state', () => {
    const messages = [makeFrame({ direction: 'sent', size: 10 })];
    const { result, rerender } = renderHook(
      ({ state }) => useWebSocketMetrics(messages, state),
      { initialProps: { state: 'connected' as string } },
    );
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.history.length).toBe(1);

    rerender({ state: 'connecting' });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.history.length).toBe(1);
  });

  it('updates lastProcessedId without counting when evicted tail leaves no new frames', () => {
    const m1 = makeFrame({ id: 'cap-a', direction: 'sent', size: 10 });
    const m2 = makeFrame({ id: 'cap-b', direction: 'received', size: 20 });
    const m3 = makeFrame({ id: 'cap-c', direction: 'received', size: 30 });
    const { result, rerender } = renderHook(
      ({ msgs, state }) => useWebSocketMetrics(msgs, state),
      { initialProps: { msgs: [m1, m2, m3], state: 'connected' as string } },
    );
    expect(result.current.totalBytesIn).toBe(50);

    rerender({ msgs: [m2, m3], state: 'connected' });
    expect(result.current.totalBytesIn).toBe(50);
    expect(result.current.textFrames).toBe(3);
  });
});
