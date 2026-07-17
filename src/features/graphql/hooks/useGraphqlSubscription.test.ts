/**
 * @vitest-environment jsdom
 * Tests for useGraphqlSubscription hook.
 */
import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGraphqlSubscription } from './useGraphqlSubscription';
import * as graphqlClientModule from '../utils/graphqlClient';
import type { GraphqlTransport } from '../utils/graphqlClient';

// ─── Mock selectTransport ────────────────────────────────────────────────────

vi.mock('../utils/graphqlClient', async (importOriginal) => {
  const original = await importOriginal<typeof graphqlClientModule>();
  return { ...original, selectTransport: vi.fn() };
});

const mockSelectTransport = vi.mocked(graphqlClientModule.selectTransport);

function makeMockTransport(
  subscribeImpl?: (
    onMessage: (data: unknown) => void,
    onError: (msg: string) => void,
    onComplete: () => void,
  ) => () => void,
): GraphqlTransport {
  return {
    type: 'ws',
    execute: vi.fn().mockResolvedValue({ data: null, errors: [], latencyMs: 0, httpStatus: 0, httpHeaders: {}, timestamp: 0 }),
    subscribe: vi.fn((_query, _vars, _opName, _params, callbacks) => {
      if (subscribeImpl) {
        return subscribeImpl(callbacks.onMessage, callbacks.onError, callbacks.onComplete);
      }
      return () => { /* noop */ };
    }),
  };
}

const BASE_PARAMS = {
  query: 'subscription { onMessage }',
  variables: {},
  operationName: undefined,
  endpoint: 'http://localhost:4000/graphql',
  headers: {},
};

describe('useGraphqlSubscription', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useGraphqlSubscription());
    expect(result.current.state).toBe('idle');
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.sessionId).toBeNull();
  });

  it('transitions to connecting state on subscribe()', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });

    expect(result.current.state).toBe('connecting');
    expect(result.current.sessionId).not.toBeNull();
  });

  it('transitions to active state on first message', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    expect(result.current.state).toBe('connecting');

    act(() => { capturedOnMessage?.({ data: { value: 1 } }); });
    expect(result.current.state).toBe('active');
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.stats.totalMessages).toBe(1);
  });

  it('accumulates multiple messages with correct indices', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnMessage?.({ data: { n: 1 } }); });
    act(() => { capturedOnMessage?.({ data: { n: 2 } }); });
    act(() => { capturedOnMessage?.({ data: { n: 3 } }); });

    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[0].index).toBe(1);
    expect(result.current.messages[1].index).toBe(2);
    expect(result.current.messages[2].index).toBe(3);
    expect(result.current.stats.totalMessages).toBe(3);
  });

  it('transitions to error state on onError callback', () => {
    let capturedOnError: ((msg: string) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((_, onError) => {
        capturedOnError = onError;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnError?.('Connection failed'); });

    expect(result.current.state).toBe('error');
    expect(result.current.errorMessage).toBe('Connection failed');
  });

  it('transitions to closed state on onComplete callback', () => {
    let capturedOnComplete: (() => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((_msg, _err, onComplete) => {
        capturedOnComplete = onComplete;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnComplete?.(); });

    expect(result.current.state).toBe('closed');
  });

  it('transitions to closed state on disconnect()', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { result.current.disconnect(); });

    expect(result.current.state).toBe('closed');
  });

  it('pause() buffers new messages without displaying them', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnMessage?.({ data: { n: 1 } }); }); // one visible
    act(() => { result.current.pause(); });
    act(() => { capturedOnMessage?.({ data: { n: 2 } }); }); // buffered
    act(() => { capturedOnMessage?.({ data: { n: 3 } }); }); // buffered

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.isPaused).toBe(true);
    expect(result.current.pausedBufferCount).toBe(2);
  });

  it('resume() flushes pause buffer into visible messages', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnMessage?.({ data: { n: 1 } }); });
    act(() => { result.current.pause(); });
    act(() => { capturedOnMessage?.({ data: { n: 2 } }); });
    act(() => { capturedOnMessage?.({ data: { n: 3 } }); });
    act(() => { result.current.resume(); });

    expect(result.current.messages).toHaveLength(3);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.pausedBufferCount).toBe(0);
  });

  it('clear() empties the message list', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnMessage?.({ data: { n: 1 } }); });
    act(() => { capturedOnMessage?.({ data: { n: 2 } }); });
    expect(result.current.messages).toHaveLength(2);

    act(() => { result.current.clear(); });
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.stats.totalMessages).toBe(0);
    expect(result.current.stats.errorCount).toBe(0);
    expect(result.current.stats.msgsPerSec).toBe(0);
  });

  it('session guard drops late messages from a replaced session', () => {
    let captured1: ((d: unknown) => void) | null = null;
    let captured2: ((d: unknown) => void) | null = null;
    mockSelectTransport
      .mockReturnValueOnce(makeMockTransport((onMessage) => { captured1 = onMessage; return () => { /* noop */ }; }))
      .mockReturnValueOnce(makeMockTransport((onMessage) => { captured2 = onMessage; return () => { /* noop */ }; }));

    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { captured1?.({ data: { n: 1 } }); });
    expect(result.current.messages).toHaveLength(1);

    act(() => { result.current.subscribe(BASE_PARAMS); });
    expect(result.current.messages).toHaveLength(0);

    // Late message from first session — must be silently dropped
    act(() => { captured1?.({ data: { n: 'stale' } }); });
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.stats.totalMessages).toBe(0);

    // Message from current session — accepted
    act(() => { captured2?.({ data: { n: 2 } }); });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.stats.totalMessages).toBe(1);
  });

  it('session guard drops late onError from a replaced session', () => {
    let captured1Error: ((msg: string) => void) | null = null;
    mockSelectTransport
      .mockReturnValueOnce(makeMockTransport((_onMsg, onErr) => { captured1Error = onErr; return () => { /* noop */ }; }))
      .mockReturnValueOnce(makeMockTransport());

    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { result.current.subscribe(BASE_PARAMS); });

    // Late error from first session — must be silently dropped
    act(() => { captured1Error?.('stale error'); });
    expect(result.current.state).toBe('connecting');
    expect(result.current.errorMessage).toBeNull();
  });

  it('session guard drops late onComplete from a replaced session', () => {
    let captured1Complete: (() => void) | null = null;
    mockSelectTransport
      .mockReturnValueOnce(makeMockTransport((_onMsg, _onErr, onComplete) => { captured1Complete = onComplete; return () => { /* noop */ }; }))
      .mockReturnValueOnce(makeMockTransport());

    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { result.current.subscribe(BASE_PARAMS); });

    // Late complete from first session — must be silently dropped
    act(() => { captured1Complete?.(); });
    expect(result.current.state).toBe('connecting');
  });

  it('reset() returns to idle and clears all state', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnMessage?.({ data: { n: 1 } }); });
    act(() => { result.current.reset(); });

    expect(result.current.state).toBe('idle');
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.stats.totalMessages).toBe(0);
  });

  it('second subscribe() call resets previous session', () => {
    let captured1: ((d: unknown) => void) | null = null;
    let captured2: ((d: unknown) => void) | null = null;
    mockSelectTransport
      .mockReturnValueOnce(makeMockTransport((onMessage) => { captured1 = onMessage; return () => { /* noop */ }; }))
      .mockReturnValueOnce(makeMockTransport((onMessage) => { captured2 = onMessage; return () => { /* noop */ }; }));

    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    const firstSessionId = result.current.sessionId;
    act(() => { captured1?.({ data: { n: 1 } }); });
    expect(result.current.messages).toHaveLength(1);

    // Second subscribe
    act(() => { result.current.subscribe(BASE_PARAMS); });
    const secondSessionId = result.current.sessionId;
    expect(secondSessionId).not.toBe(firstSessionId);
    // Messages from first session are cleared
    expect(result.current.messages).toHaveLength(0);

    act(() => { captured2?.({ data: { n: 2 } }); });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].sessionId).toBe(secondSessionId);
  });

  it('tracks error count in stats', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnMessage?.({ data: { n: 1 } }); });
    act(() => { capturedOnMessage?.({ data: null, errors: [{ message: 'field error' }] }); });
    act(() => { capturedOnMessage?.({ data: { n: 3 } }); });

    expect(result.current.stats.totalMessages).toBe(3);
    expect(result.current.stats.errorCount).toBe(1);
  });

  it('message direction is always "in" for server pushes', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedOnMessage?.({ data: { value: 42 } }); });

    expect(result.current.messages[0].direction).toBe('in');
  });

  it('bufferSize limits the number of stored messages', () => {
    const messages: ((data: unknown) => void)[] = [];
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        messages.push(onMessage);
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => {
      result.current.subscribe({ ...BASE_PARAMS, bufferSize: 3 });
    });

    const push = messages[0];
    act(() => {
      push({ data: { n: 1 } });
      push({ data: { n: 2 } });
      push({ data: { n: 3 } });
      push({ data: { n: 4 } }); // should evict n=1
      push({ data: { n: 5 } }); // should evict n=2
    });

    expect(result.current.messages).toHaveLength(3);
    expect((result.current.messages[0].data as Record<string, unknown>).n).toBe(3);
    expect((result.current.messages[2].data as Record<string, unknown>).n).toBe(5);
  });

  // ── WS state-change callback branches (covers lines 173-191) ─────────────

  it('onStateChange "connecting" sets state to connecting', () => {
    let capturedStateChange: ((state: string, attempt?: number) => void) | null = null;
    mockSelectTransport.mockImplementation((_sel, _op, onStateChange) => {
      capturedStateChange = onStateChange ?? null;
      return makeMockTransport();
    });
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedStateChange?.('connecting'); });

    expect(result.current.state).toBe('connecting');
  });

  it('onStateChange "connected" keeps state at connecting (first data frame moves to active)', () => {
    let capturedStateChange: ((state: string, attempt?: number) => void) | null = null;
    mockSelectTransport.mockImplementation((_sel, _op, onStateChange) => {
      capturedStateChange = onStateChange ?? null;
      return makeMockTransport();
    });
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedStateChange?.('connected'); }); // no-op — keeps 'connecting'

    expect(result.current.state).toBe('connecting');
  });

  it('onStateChange "reconnecting" sets state + attempt count', () => {
    let capturedStateChange: ((state: string, attempt?: number) => void) | null = null;
    mockSelectTransport.mockImplementation((_sel, _op, onStateChange) => {
      capturedStateChange = onStateChange ?? null;
      return makeMockTransport();
    });
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedStateChange?.('reconnecting', 2); });

    expect(result.current.state).toBe('reconnecting');
    expect(result.current.reconnectAttempt).toBe(2);
  });

  it('onStateChange "reconnecting" without attempt defaults to 1', () => {
    let capturedStateChange: ((state: string, attempt?: number) => void) | null = null;
    mockSelectTransport.mockImplementation((_sel, _op, onStateChange) => {
      capturedStateChange = onStateChange ?? null;
      return makeMockTransport();
    });
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedStateChange?.('reconnecting', undefined); });

    expect(result.current.reconnectAttempt).toBe(1);
  });

  it('onStateChange "error" does not change state directly (surfaced via onError)', () => {
    let capturedStateChange: ((state: string, attempt?: number) => void) | null = null;
    mockSelectTransport.mockImplementation((_sel, _op, onStateChange) => {
      capturedStateChange = onStateChange ?? null;
      return makeMockTransport();
    });
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedStateChange?.('error'); }); // no-op — onError callback handles it

    expect(result.current.state).toBe('connecting');
  });

  it('onStateChange "closed" does not change state directly (surfaced via onComplete)', () => {
    let capturedStateChange: ((state: string, attempt?: number) => void) | null = null;
    mockSelectTransport.mockImplementation((_sel, _op, onStateChange) => {
      capturedStateChange = onStateChange ?? null;
      return makeMockTransport();
    });
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { capturedStateChange?.('closed'); }); // no-op — onComplete handles it

    expect(result.current.state).toBe('connecting');
  });

  it('disconnect() from idle stays idle', () => {
    const { result } = renderHook(() => useGraphqlSubscription());
    act(() => { result.current.disconnect(); });
    expect(result.current.state).toBe('idle');
  });

  it('resume() with empty pause buffer just clears isPaused', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    act(() => { result.current.pause(); });
    // Resume without any buffered messages
    act(() => { result.current.resume(); });

    expect(result.current.isPaused).toBe(false);
    expect(result.current.pausedBufferCount).toBe(0);
    expect(result.current.messages).toHaveLength(0);
  });

  it('resume() flushed messages are capped by bufferSize', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe({ ...BASE_PARAMS, bufferSize: 3 }); });
    act(() => { capturedOnMessage?.({ data: { n: 1 } }); }); // visible
    act(() => { result.current.pause(); });
    // Buffer 4 more — together with 1 visible = 5, but bufferSize is 3
    act(() => { capturedOnMessage?.({ data: { n: 2 } }); });
    act(() => { capturedOnMessage?.({ data: { n: 3 } }); });
    act(() => { capturedOnMessage?.({ data: { n: 4 } }); });
    act(() => { capturedOnMessage?.({ data: { n: 5 } }); });
    act(() => { result.current.resume(); });

    expect(result.current.messages).toHaveLength(3);
  });

  it('connectedSince is set when subscribe() is called', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const before = Date.now();
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });

    expect(result.current.connectedSince).toBeGreaterThanOrEqual(before);
    expect(result.current.connectedSince).toBeLessThanOrEqual(Date.now());
  });

  it('connectedSince resets to 0 after reset()', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    expect(result.current.connectedSince).toBeGreaterThan(0);

    act(() => { result.current.reset(); });
    expect(result.current.connectedSince).toBe(0);
  });

  it('graphql-ws subprotocol sets transport label to graphql-ws', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => {
      result.current.subscribe({ ...BASE_PARAMS, subscriptionTransport: 'graphql-ws' });
    });

    expect(result.current.transport).toBe('graphql-ws');
  });

  it('sse subprotocol sets transport label to sse', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => {
      result.current.subscribe({ ...BASE_PARAMS, subscriptionTransport: 'sse' });
    });

    expect(result.current.transport).toBe('sse');
  });

  it('auto transport with /stream endpoint sets transport label to sse (Sprint 3 auto-detect)', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => {
      result.current.subscribe({
        ...BASE_PARAMS,
        endpoint: 'https://api.example.com/graphql/stream',
        subscriptionTransport: 'auto',
      });
    });

    expect(result.current.transport).toBe('sse');
  });

  it('auto transport with non-stream endpoint sets transport label to graphql-transport-ws', () => {
    mockSelectTransport.mockReturnValue(makeMockTransport());
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => {
      result.current.subscribe({
        ...BASE_PARAMS,
        endpoint: 'wss://api.example.com/graphql',
        subscriptionTransport: 'auto',
      });
    });

    expect(result.current.transport).toBe('graphql-transport-ws');
  });

  it('data extraction unwraps nested data field from frame', () => {
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    // Server sends { data: { user: { name: 'Alice' } } } — outer 'data' should be unwrapped
    act(() => { capturedOnMessage?.({ data: { user: { name: 'Alice' } } }); });

    expect((result.current.messages[0].data as Record<string, unknown>).user).toEqual({ name: 'Alice' });
  });

  it('data:null with errors stores null in msg.data (not the full result object)', () => {
    // Regression test for Bug 1: SSE/WS partial-error frame { data: null, errors: [...] }.
    // The old ?? fallback incorrectly stored the full result object when data was null.
    // The 'data' in key check correctly stores null.
    let capturedOnMessage: ((data: unknown) => void) | null = null;
    mockSelectTransport.mockReturnValue(
      makeMockTransport((onMessage) => {
        capturedOnMessage = onMessage;
        return () => { /* noop */ };
      }),
    );
    const { result } = renderHook(() => useGraphqlSubscription());

    act(() => { result.current.subscribe(BASE_PARAMS); });
    // Simulate SSE/WS sending { data: null, errors: [...] }
    act(() => { capturedOnMessage?.({ data: null, errors: [{ message: 'Partial error' }] }); });

    expect(result.current.messages).toHaveLength(1);
    // msg.data MUST be null — not the full { data: null, errors: [...] } object
    expect(result.current.messages[0].data).toBeNull();
    // Errors should still be captured
    expect(result.current.messages[0].errors).toHaveLength(1);
    expect(result.current.messages[0].errors![0].message).toBe('Partial error');
  });
});
