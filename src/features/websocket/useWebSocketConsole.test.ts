/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWebSocketConsole, type UseWebSocketConsoleParams } from './useWebSocketConsole';
import type {
  WsConnectionDraft,
  WsConnectionSnapshot,
  WsReconnectState,
} from '@shared/websocket/types';

const draft: WsConnectionDraft = {
  url: 'ws://localhost:8765',
  subprotocols: 'json',
  headers: [],
  queryParams: [],
};

const reconnect = (over: Partial<WsReconnectState> = {}): WsReconnectState => ({
  active: false,
  attempt: 0,
  maxAttempts: 5,
  nextRetryAt: null,
  ...over,
});

function params(
  connection: WsConnectionSnapshot,
  over: Partial<UseWebSocketConsoleParams> = {},
): UseWebSocketConsoleParams {
  return {
    connection,
    reconnectState: reconnect(),
    detectedProtocol: null,
    draft,
    authProfiles: [],
    ...over,
  };
}

describe('useWebSocketConsole', () => {
  it('does not emit an entry for the initial observation', () => {
    const { result } = renderHook(() => useWebSocketConsole(params({ state: 'disconnected' })));
    expect(result.current.entries).toHaveLength(0);
  });

  it('records the full connect lifecycle', () => {
    const { result, rerender } = renderHook((p: UseWebSocketConsoleParams) => useWebSocketConsole(p), {
      initialProps: params({ state: 'disconnected' }),
    });

    rerender(params({ state: 'connecting', url: 'ws://localhost:8765' }));
    rerender(
      params({
        state: 'connected',
        url: 'ws://localhost:8765',
        protocol: 'json',
        extensions: 'permessage-deflate',
        latencyMs: 18,
      }),
    );

    const cats = result.current.entries.map((e) => e.category);
    expect(cats).toContain('lifecycle'); // connecting + established
    expect(cats).toContain('handshake');
    const handshake = result.current.entries.find((e) => e.category === 'handshake');
    expect(handshake?.detail).toContain('Sec-WebSocket-Protocol: json');
  });

  it('records a disconnect with close code', () => {
    const { result, rerender } = renderHook((p: UseWebSocketConsoleParams) => useWebSocketConsole(p), {
      initialProps: params({ state: 'connected' }),
    });
    rerender(params({ state: 'disconnected', closeCode: 1006 }));
    const last = result.current.entries.at(-1);
    expect(last?.message).toContain('1006');
    expect(last?.level).toBe('warn');
  });

  it('records an error transition', () => {
    const { result, rerender } = renderHook((p: UseWebSocketConsoleParams) => useWebSocketConsole(p), {
      initialProps: params({ state: 'connecting' }),
    });
    rerender(params({ state: 'error', lastError: 'ECONNREFUSED' }));
    const last = result.current.entries.at(-1);
    expect(last?.level).toBe('error');
    expect(last?.message).toContain('ECONNREFUSED');
  });

  it('does not duplicate entries when the connection object changes but state is stable', () => {
    const { result, rerender } = renderHook((p: UseWebSocketConsoleParams) => useWebSocketConsole(p), {
      initialProps: params({ state: 'connected', latencyMs: 10 }),
    });
    const before = result.current.entries.length;
    // Same state, same latency → no new entry.
    rerender(params({ state: 'connected', latencyMs: 10 }));
    expect(result.current.entries).toHaveLength(before);
  });

  it('emits a control entry when latency changes while connected', () => {
    const { result, rerender } = renderHook((p: UseWebSocketConsoleParams) => useWebSocketConsole(p), {
      initialProps: params({ state: 'connected', latencyMs: 10 }),
    });
    rerender(params({ state: 'connected', latencyMs: 25 }));
    const control = result.current.entries.find((e) => e.category === 'control');
    expect(control?.message).toContain('25ms');
  });

  it('records reconnect attempts', () => {
    const { result, rerender } = renderHook((p: UseWebSocketConsoleParams) => useWebSocketConsole(p), {
      initialProps: params({ state: 'connected' }, { reconnectState: reconnect({ active: true, attempt: 0 }) }),
    });
    rerender(params({ state: 'connecting' }, { reconnectState: reconnect({ active: true, attempt: 1 }) }));
    const r = result.current.entries.find((e) => e.category === 'reconnect');
    expect(r?.message).toBe('Reconnect attempt 1/5');
  });

  it('records the first attempt of a new cycle after the counter resets', () => {
    const { result, rerender } = renderHook((p: UseWebSocketConsoleParams) => useWebSocketConsole(p), {
      initialProps: params({ state: 'connected' }, { reconnectState: reconnect({ active: true, attempt: 0 }) }),
    });
    // First cycle climbs to attempt 3.
    rerender(params({ state: 'connecting' }, { reconnectState: reconnect({ active: true, attempt: 1 }) }));
    rerender(params({ state: 'connecting' }, { reconnectState: reconnect({ active: true, attempt: 2 }) }));
    rerender(params({ state: 'connecting' }, { reconnectState: reconnect({ active: true, attempt: 3 }) }));
    // Successful reconnect resets the counter to 0/inactive.
    rerender(params({ state: 'connected' }, { reconnectState: reconnect({ active: false, attempt: 0 }) }));
    // A fresh cycle starts again at attempt 1 — must still be recorded.
    rerender(params({ state: 'connecting' }, { reconnectState: reconnect({ active: true, attempt: 1 }) }));
    const reconnects = result.current.entries.filter((e) => e.category === 'reconnect');
    expect(reconnects.map((e) => e.message)).toEqual([
      'Reconnect attempt 1/5',
      'Reconnect attempt 2/5',
      'Reconnect attempt 3/5',
      'Reconnect attempt 1/5',
    ]);
  });

  it('records protocol detection once', () => {
    const { result, rerender } = renderHook((p: UseWebSocketConsoleParams) => useWebSocketConsole(p), {
      initialProps: params({ state: 'connected' }),
    });
    rerender(
      params({ state: 'connected' }, {
        detectedProtocol: { protocol: 'stomp', confidence: 'high', reason: 'matched subprotocol' },
      }),
    );
    rerender(
      params({ state: 'connected' }, {
        detectedProtocol: { protocol: 'stomp', confidence: 'high', reason: 'matched subprotocol' },
      }),
    );
    const protoEntries = result.current.entries.filter((e) => e.category === 'protocol');
    expect(protoEntries).toHaveLength(1);
    expect(protoEntries[0].message).toContain('stomp');
  });

  it('does not emit a protocol entry for a protocol already detected at mount', () => {
    const { result } = renderHook(() =>
      useWebSocketConsole(
        params({ state: 'connected' }, {
          detectedProtocol: { protocol: 'stomp', confidence: 'high', reason: 'matched subprotocol' },
        }),
      ),
    );
    expect(result.current.entries.filter((e) => e.category === 'protocol')).toHaveLength(0);
  });
});
