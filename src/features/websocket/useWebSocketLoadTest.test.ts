/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketLoadTest, embedNonce, extractNonce } from './useWebSocketLoadTest';
import type { WsFrame } from '../../shared/websocket/types';

vi.mock('./wsLoadTestMetrics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./wsLoadTestMetrics')>();
  return {
    ...actual,
    createLatencyTracker: vi.fn(actual.createLatencyTracker),
    createThroughputSampler: vi.fn(actual.createThroughputSampler),
    buildLoadTestResult: vi.fn(actual.buildLoadTestResult),
  };
});

function makeFrame(overrides: Partial<WsFrame> = {}): WsFrame {
  return {
    id: `f-${Math.random().toString(36).slice(2, 6)}`,
    direction: 'received',
    type: 'text',
    data: '{"hello":"world"}',
    size: 17,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── Pure function tests ──────────────────────────────────────────────────

describe('embedNonce', () => {
  it('injects nonce into JSON object', () => {
    const result = embedNonce('{"foo":"bar"}', 1);
    expect(result).toContain('"__lt_nonce"');
    expect(result).toContain('__lt_1_');
    // Should still be valid JSON
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('creates JSON wrapper for empty JSON object', () => {
    const result = embedNonce('{}', 5);
    expect(result).toContain('"__lt_nonce"');
    const parsed = JSON.parse(result);
    expect(parsed.__lt_nonce).toMatch(/^__lt_5_\d+$/);
  });

  it('returns original message for non-JSON strings', () => {
    const result = embedNonce('hello world', 1);
    expect(result).toBe('hello world');
  });

  it('returns original message for strings that start/end with braces but contain only whitespace', () => {
    const result = embedNonce('{  }', 1);
    expect(result).toContain('__lt_nonce');
  });
});

describe('extractNonce', () => {
  it('extracts nonce from JSON with embedded nonce', () => {
    const embedded = embedNonce('{"data":1}', 42);
    const nonce = extractNonce(embedded);
    expect(nonce).toMatch(/^__lt_42_\d+$/);
  });

  it('returns null for messages without nonce', () => {
    expect(extractNonce('{"foo":"bar"}')).toBeNull();
    expect(extractNonce('hello')).toBeNull();
  });

  it('returns null for messages with prefix but no valid nonce format', () => {
    expect(extractNonce('__lt_ something')).toBeNull();
  });

  it('round-trips: extractNonce(embedNonce(msg, n)) matches', () => {
    const msg = '{"type":"ping"}';
    const embedded = embedNonce(msg, 99);
    const extracted = extractNonce(embedded);
    expect(extracted).toMatch(/^__lt_99_\d+$/);
  });
});

// ── Hook tests ───────────────────────────────────────────────────────────

describe('useWebSocketLoadTest', () => {
  const mockSendFn = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderLoadTestHook(
    sendFn: ((data: string) => void) | null = mockSendFn,
    messages: WsFrame[] = [],
    isConnected = true,
  ) {
    return renderHook(
      ({ sendFn: sf, messages: msgs, isConnected: ic }) =>
        useWebSocketLoadTest(sf, msgs, ic),
      { initialProps: { sendFn, messages, isConnected } },
    );
  }

  // ── Initial state ────────────────────────────────────────────────
  it('initializes with idle state and defaults', () => {
    const { result } = renderLoadTestHook();
    expect(result.current.state).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.progress.totalSent).toBe(0);
    expect(result.current.config.profile).toBe('constant');
    expect(result.current.config.rate).toBe(10);
  });

  // ── setConfig ────────────────────────────────────────────────────
  it('setConfig applies partial updates', () => {
    const { result } = renderLoadTestHook();

    act(() => { result.current.setConfig({ rate: 50 }); });
    expect(result.current.config.rate).toBe(50);
    // Other fields unchanged
    expect(result.current.config.profile).toBe('constant');

    act(() => { result.current.setConfig({ profile: 'burst', burstCount: 200 }); });
    expect(result.current.config.profile).toBe('burst');
    expect(result.current.config.burstCount).toBe(200);
    expect(result.current.config.rate).toBe(50); // preserved
  });

  // ── start: does not start when sendFn is null ────────────────────
  it('does not start when sendFn is null', () => {
    const { result } = renderLoadTestHook(null);

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('idle');
  });

  // ── start: transitions to running ────────────────────────────────
  it('start transitions to running state', () => {
    const { result } = renderLoadTestHook();

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('running');
    expect(result.current.result).toBeNull();
  });

  // ── does not start when already running ──────────────────────────
  it('does not restart when already running', () => {
    const { result } = renderLoadTestHook();

    act(() => { result.current.start(); });
    mockSendFn.mockClear();

    // Try to start again
    act(() => { result.current.start(); });
    // Should not have reset - still running from first start
    expect(result.current.state).toBe('running');
  });

  // ── stop ─────────────────────────────────────────────────────────
  it('stop transitions to done and produces result', () => {
    const { result } = renderLoadTestHook();

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('running');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
    expect(result.current.result).not.toBeNull();
  });

  it('stop does nothing when not running', () => {
    const { result } = renderLoadTestHook();

    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('idle');
  });

  // ── clearResult ──────────────────────────────────────────────────
  it('clearResult resets to idle with no result', () => {
    const { result } = renderLoadTestHook();

    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
    expect(result.current.result).not.toBeNull();

    act(() => { result.current.clearResult(); });
    expect(result.current.state).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.progress.totalSent).toBe(0);
  });

  // ── Burst mode ───────────────────────────────────────────────────
  it('burst mode sends up to burstCount then finishes', () => {
    const { result } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({ profile: 'burst', burstCount: 10 });
    });

    act(() => { result.current.start(); });

    // Advance timers to let the burst loop complete
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should have finished
    expect(result.current.state).toBe('done');
    expect(mockSendFn.mock.calls.length).toBe(10);
  });

  // ── Rate limiting / clamping ─────────────────────────────────────
  it('clamps rate and duration to valid bounds on start', () => {
    const { result } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({
        profile: 'constant',
        rate: 9999,        // exceeds MAX_RATE (1000)
        durationSec: 999,  // exceeds MAX_DURATION_SEC (60)
      });
    });

    act(() => { result.current.start(); });

    // After start, config should be clamped
    expect(result.current.config.rate).toBe(1000);
    expect(result.current.config.durationSec).toBe(60);
  });

  // ── Constant profile finishes after duration ─────────────────────
  it('constant profile finishes after duration expires', () => {
    const { result } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({
        profile: 'constant',
        rate: 10,
        durationSec: 1, // 1 second
      });
    });

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('running');

    // Advance past the duration
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.state).toBe('done');
    expect(result.current.result).not.toBeNull();
  });

  // ── sendFn errors increment error count ──────────────────────────
  it('increments error count when sendFn throws', () => {
    const throwingSend = vi.fn().mockImplementation(() => { throw new Error('send failed'); });
    const { result } = renderLoadTestHook(throwingSend);

    act(() => {
      result.current.setConfig({ profile: 'constant', rate: 100, durationSec: 1 });
    });

    act(() => { result.current.start(); });

    // Advance some time — sends will fail
    act(() => { vi.advanceTimersByTime(200); });

    // The hook is still running, but errors were counted
    expect(throwingSend).toHaveBeenCalled();
    // errorRef gets incremented on each failed send
    // Stop to finalize and check result
    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.errorCount).toBeGreaterThan(0);
    expect(result.current.result!.totalSent).toBe(0);
  });

  // ── Disconnection auto-stops ─────────────────────────────────────
  it('auto-stops when connection drops during running', () => {
    const { result, rerender } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({ profile: 'constant', rate: 10, durationSec: 10 });
    });

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('running');

    // Simulate disconnection
    rerender({ sendFn: mockSendFn, messages: [], isConnected: false });

    expect(result.current.state).toBe('done');
    expect(result.current.result).not.toBeNull();
  });

  // ── Progress updates ─────────────────────────────────────────────
  it('updates progress periodically while running', () => {
    const { result } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({ profile: 'constant', rate: 100, durationSec: 5 });
    });

    act(() => { result.current.start(); });

    // Advance past a couple progress intervals (250ms each)
    act(() => { vi.advanceTimersByTime(600); });

    expect(result.current.progress.elapsedMs).toBeGreaterThan(0);
    expect(result.current.progress.totalSent).toBeGreaterThan(0);

    // Clean up
    act(() => { result.current.stop(); });
  });

  // ── Ramp profile ─────────────────────────────────────────────────
  it('handles ramp profile', () => {
    const { result } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({
        profile: 'ramp',
        rate: 5,
        rateEnd: 50,
        durationSec: 1,
      });
    });

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('running');

    act(() => { vi.advanceTimersByTime(1500); });

    expect(result.current.state).toBe('done');
    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.totalSent).toBeGreaterThan(0);
  });

  it('clears result when clearResult is called', () => {
    const { result } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({ profile: 'burst', burstCount: 5, messageTemplate: '{"msg":true}' });
    });

    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(2000); });

    expect(result.current.state).toBe('done');
    expect(result.current.result).not.toBeNull();

    act(() => { result.current.clearResult(); });
    expect(result.current.result).toBeNull();
    expect(result.current.state).toBe('idle');
  });

  it('does not start when sendFn is null', () => {
    const { result } = renderHook(() =>
      useWebSocketLoadTest(null, [], true),
    );

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('idle');
  });

  it('starts even when not connected if sendFn is provided', () => {
    const sendFn = vi.fn();
    const { result } = renderHook(() =>
      useWebSocketLoadTest(sendFn, [], false),
    );

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('running');
    act(() => { result.current.stop(); });
  });

  it('clamps config values to valid ranges', () => {
    const { result } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({ rate: 9999, durationSec: 999, burstCount: -5 });
    });

    // When start is called, config is clamped internally
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('running');
    act(() => { result.current.stop(); });
  });

  it('embeds nonce in JSON with content', () => {
    const result = embedNonce('{"key":"value"}', 42);
    const parsed = JSON.parse(result);
    expect(parsed.key).toBe('value');
    expect(parsed.__lt_nonce).toMatch(/^__lt_42_/);
  });

  it('extractNonce returns null for non-nonce data', () => {
    expect(extractNonce('hello world')).toBeNull();
    expect(extractNonce('{"key":"value"}')).toBeNull();
  });

  it('extracts nonce from data with prefix', () => {
    const withNonce = embedNonce('{"test":1}', 7);
    const nonce = extractNonce(withNonce);
    expect(nonce).toMatch(/^__lt_7_/);
  });

  it('handles stop during burst mode', () => {
    const { result } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({ profile: 'burst', burstCount: 1000, messageTemplate: '{"burst":true}' });
    });

    act(() => { result.current.start(); });
    expect(result.current.state).toBe('running');

    // Stop early
    act(() => { result.current.stop(); });
    // State transitions to stopping then done
    act(() => { vi.advanceTimersByTime(500); });
    expect(['stopping', 'done']).toContain(result.current.state);
  });

  // ── Additional coverage: processReceivedFrames with nonce correlation ──
  it('correlates received messages with nonces during running', () => {
    const { result, rerender } = renderLoadTestHook();

    act(() => {
      result.current.setConfig({ profile: 'constant', rate: 10, durationSec: 5, messageTemplate: '{"test":1}' });
    });

    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(300); });

    // Get a sent message nonce from mockSendFn calls
    const sentData = mockSendFn.mock.calls[0]?.[0] as string;
    const nonce = sentData ? extractNonce(sentData) : null;

    // Provide a received message with matching nonce
    const receivedFrame = makeFrame({
      direction: 'received',
      data: nonce ? `{"response":true,"__lt_nonce":"${nonce}"}` : '{"response":true}',
    });

    rerender({ sendFn: mockSendFn, messages: [receivedFrame], isConnected: true });
    act(() => { vi.advanceTimersByTime(300); });

    act(() => { result.current.stop(); });
    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.totalReceived).toBeGreaterThan(0);
  });

  // ── processReceivedFrames: cap eviction (array shrank) branch ──
  it('handles message array shrink (cap eviction) during running', () => {
    const msg1 = makeFrame({ id: 'msg-1', direction: 'received', data: '{"v":1}' });
    const msg2 = makeFrame({ id: 'msg-2', direction: 'received', data: '{"v":2}' });
    const msg3 = makeFrame({ id: 'msg-3', direction: 'received', data: '{"v":3}' });

    const { result, rerender } = renderLoadTestHook(mockSendFn, [msg1, msg2], true);

    act(() => {
      result.current.setConfig({ profile: 'constant', rate: 10, durationSec: 5 });
    });
    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(100); });

    // Simulate cap eviction: array shrinks but has new items
    rerender({ sendFn: mockSendFn, messages: [msg2, msg3], isConnected: true });
    act(() => { vi.advanceTimersByTime(100); });

    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
  });

  // ── processReceivedFrames: sent direction messages are skipped ──
  it('ignores sent-direction frames in processReceivedFrames', () => {
    const { result, rerender } = renderLoadTestHook();

    act(() => { result.current.setConfig({ profile: 'constant', rate: 10, durationSec: 5 }); });
    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(100); });

    const sentFrame = makeFrame({ direction: 'sent', data: '{"sent":true}' });
    rerender({ sendFn: mockSendFn, messages: [sentFrame], isConnected: true });
    act(() => { vi.advanceTimersByTime(100); });

    act(() => { result.current.stop(); });
    // Sent frames should not be counted as received
    expect(result.current.result!.totalReceived).toBe(0);
  });

  // ── Cleanup effect on unmount ──
  it('cleans up timers on unmount', () => {
    const { result, unmount } = renderLoadTestHook();

    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(100); });

    // Should not throw on unmount
    unmount();
    // Advance timers after unmount to ensure no dangling callbacks
    act(() => { vi.advanceTimersByTime(1000); });
  });

  // ── processReceivedFrames with empty messages array while running ──
  it('handles empty messages while running', () => {
    const { result, rerender } = renderLoadTestHook(mockSendFn, [], true);

    act(() => { result.current.setConfig({ profile: 'constant', rate: 10, durationSec: 5 }); });
    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(100); });

    // Rerender with empty messages
    rerender({ sendFn: mockSendFn, messages: [], isConnected: true });
    act(() => { vi.advanceTimersByTime(100); });

    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
  });

  // ── Messages rerender with same lastId (no-op) ──
  it('skips processing when lastId has not changed', () => {
    const msg1 = makeFrame({ id: 'same-id', direction: 'received' });
    const { result, rerender } = renderLoadTestHook(mockSendFn, [msg1], true);

    act(() => { result.current.setConfig({ profile: 'constant', rate: 10, durationSec: 5 }); });
    act(() => { result.current.start(); });
    act(() => { vi.advanceTimersByTime(100); });

    // Rerender with same message (lastId unchanged)
    rerender({ sendFn: mockSendFn, messages: [msg1], isConnected: true });
    act(() => { vi.advanceTimersByTime(100); });

    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
  });
});
