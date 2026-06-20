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

  it('records stream close on disconnect', () => {
    const { result, rerender } = renderHook((p: UseSseConsoleParams) => useSseConsole(p), {
      initialProps: params(snap({ state: 'connected' })),
    });
    rerender(params(snap({ state: 'disconnected' })));
    const closed = result.current.entries.at(-1);
    expect(closed?.category).toBe('lifecycle');
    expect(closed?.message).toContain('closed');
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

  it('does not emit duplicate entries when state is unchanged', () => {
    const { result, rerender } = renderHook((p: UseSseConsoleParams) => useSseConsole(p), {
      initialProps: params(snap({ state: 'idle' })),
    });
    rerender(params(snap({ state: 'connected', lastEventId: '7' })));
    const countAfterConnect = result.current.entries.length;
    rerender(params(snap({ state: 'connected', lastEventId: '7' })));
    expect(result.current.entries).toHaveLength(countAfterConnect);
  });

  it('omits Last-Event-ID in handshake when lastEventId is empty', () => {
    const { result, rerender } = renderHook((p: UseSseConsoleParams) => useSseConsole(p), {
      initialProps: params(snap({ state: 'idle' })),
    });
    rerender(params(snap({ state: 'connecting' })));
    rerender(params(snap({ state: 'connected', lastEventId: '' })));
    const handshake = result.current.entries.find((e) => e.category === 'handshake');
    expect(handshake?.detail).not.toContain('Last-Event-ID');
  });

  it('filters disabled and blank-key headers from handshake', () => {
    const cfg: SseConnectionConfig = {
      ...config,
      headers: [
        { key: 'X-Trace', value: 't', enabled: true },
        { key: '', value: 'ignored', enabled: true },
        { key: 'X-Off', value: 'off', enabled: false },
      ],
    };
    const { result, rerender } = renderHook((p: UseSseConsoleParams) => useSseConsole(p), {
      initialProps: params(snap({ state: 'idle' }), { config: cfg }),
    });
    rerender(params(snap({ state: 'connecting' }), { config: cfg }));
    rerender(params(snap({ state: 'connected' }), { config: cfg }));
    const handshake = result.current.entries.find((e) => e.category === 'handshake');
    expect(handshake?.detail).toContain('X-Trace: t');
    expect(handshake?.detail).not.toContain('X-Off');
    expect(handshake?.detail).not.toContain('ignored');
  });

  it('does not record reconnect when attempt is unchanged', () => {
    const { result, rerender } = renderHook((p: UseSseConsoleParams) => useSseConsole(p), {
      initialProps: params(snap({ state: 'connected', reconnectAttempt: 0 })),
    });
    rerender(params(snap({ state: 'connecting', reconnectAttempt: 1, retryMs: 2000 })));
    const countAfterFirst = result.current.entries.length;
    rerender(params(snap({ state: 'connecting', reconnectAttempt: 1, retryMs: 2000 })));
    expect(result.current.entries).toHaveLength(countAfterFirst);
  });
});
