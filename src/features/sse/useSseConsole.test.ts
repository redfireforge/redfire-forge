/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSseConsole, type UseSseConsoleParams } from './useSseConsole';
import type { SseConnectionConfig, SseConnectionSnapshot } from './sseTypes';

const config: SseConnectionConfig = {
  url: 'http://localhost:9000/stream',
  headers: [{ key: 'X-Trace', value: 't', enabled: true }],
  autoReconnect: true,
  maxRetries: 10,
};

const snap = (over: Partial<SseConnectionSnapshot>): SseConnectionSnapshot => ({
  state: 'idle',
  lastEventId: '',
  retryMs: 0,
  reconnectAttempt: 0,
  ...over,
});

function params(
  connection: SseConnectionSnapshot,
  over: Partial<UseSseConsoleParams> = {},
): UseSseConsoleParams {
  return { connection, config, authProfiles: [], ...over };
}

describe('useSseConsole', () => {
  it('does not emit on the initial idle observation', () => {
    const { result } = renderHook(() => useSseConsole(params(snap({ state: 'idle' }))));
    expect(result.current.entries).toHaveLength(0);
  });

  it('records connecting + handshake with real request headers', () => {
    const { result, rerender } = renderHook((p: UseSseConsoleParams) => useSseConsole(p), {
      initialProps: params(snap({ state: 'idle' })),
    });
    rerender(params(snap({ state: 'connecting' })));
    rerender(params(snap({ state: 'connected', lastEventId: '7' })));

    const handshake = result.current.entries.find((e) => e.category === 'handshake');
    expect(handshake?.detail).toContain('Accept: text/event-stream');
    expect(handshake?.detail).toContain('Last-Event-ID: 7');
    expect(handshake?.detail).toContain('X-Trace: t');
  });

  it('records stream close and error', () => {
    const { result, rerender } = renderHook((p: UseSseConsoleParams) => useSseConsole(p), {
      initialProps: params(snap({ state: 'connected' })),
    });
    rerender(params(snap({ state: 'error', error: 'network' })));
    expect(result.current.entries.at(-1)?.message).toContain('network');
    expect(result.current.entries.at(-1)?.level).toBe('error');
  });

  it('records reconnect attempts', () => {
    const { result, rerender } = renderHook((p: UseSseConsoleParams) => useSseConsole(p), {
      initialProps: params(snap({ state: 'connected', reconnectAttempt: 0 })),
    });
    rerender(params(snap({ state: 'connecting', reconnectAttempt: 1, retryMs: 2000 })));
    const r = result.current.entries.find((e) => e.category === 'reconnect');
    expect(r?.message).toBe('Reconnecting in 2000ms (attempt 1)');
  });
});
