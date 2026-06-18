/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createHttpTransport,
  createWsTransport,
  createSseTransport,
  selectTransport,
  deriveWsEndpoint,
  deriveSseEndpoint,
  requiresWsProxy,
  hasIncrementalDirective,
  type GraphqlOperationParams,
  type GraphqlSubscribeCallbacks,
} from './graphqlClient';
// buildConnectionParams is tested in authUtils.test.ts (its canonical home).
// It was previously duplicated in graphqlClient.ts but has been removed.
import type { GraphqlAuth } from '../../../shared/types/graphql';

// ─── Mock gqlFetch ─────────────────────────────────────────────────────────────

vi.mock('./gqlFetch', () => ({
  gqlFetch: vi.fn(),
}));

import { gqlFetch } from './gqlFetch';
const mockGqlFetch = vi.mocked(gqlFetch);

// ─── Mock platform ─────────────────────────────────────────────────────────────

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isTauri } from '../../../shared/utils/platform';
const mockIsTauri = vi.mocked(isTauri);

// ─── Mock graphql-ws to prevent real WebSocket connections in tests ───────────
// graphql-ws is mocked here to keep unit tests fast and hermetic.
// Integration tests (E2E) cover real WebSocket connectivity.

let mockWsSubscribeSink: { next?: (v: unknown) => void; error?: (e: unknown) => void; complete?: () => void } | null = null;
let mockWsUnsubscribeFn: (() => void) | null = null;

type WsClientConfig = {
  on?: {
    connecting?: (isRetry: boolean) => void;
    connected?: () => void;
    error?: () => void;
    closed?: () => void;
  };
  retryWait?: (attempt: number) => Promise<void>;
};

let capturedWsClientConfig: WsClientConfig | null = null;

vi.mock('graphql-ws', () => ({
  createClient: vi.fn((config: WsClientConfig) => {
    capturedWsClientConfig = config;
    return {
      subscribe: vi.fn((_op: unknown, sink: typeof mockWsSubscribeSink) => {
        mockWsSubscribeSink = sink;
        mockWsUnsubscribeFn = vi.fn();
        return mockWsUnsubscribeFn;
      }),
      dispose: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

// ─── Mock graphql-sse to prevent real SSE connections in tests ────────────────

type SseSink = {
  next?: (v: unknown) => void;
  error?: (e: unknown) => void;
  complete?: () => void;
};

type SseClientConfig = {
  url?: string;
  on?: {
    connecting?: (reconnecting: boolean) => void;
    connected?: () => void;
  };
  headers?: Record<string, string>;
  retryAttempts?: number;
  retry?: (retries: number) => Promise<void>;
};

let mockSseSubscribeSink: SseSink | null = null;
let mockSseUnsubscribeFn: (() => void) | null = null;
let capturedSseClientConfig: SseClientConfig | null = null;
let mockSseDisposeFn: (() => void) | null = null;

vi.mock('graphql-sse', () => ({
  createClient: vi.fn((config: SseClientConfig) => {
    capturedSseClientConfig = config;
    mockSseDisposeFn = vi.fn();
    return {
      subscribe: vi.fn((_op: unknown, sink: SseSink) => {
        mockSseSubscribeSink = sink;
        mockSseUnsubscribeFn = vi.fn();
        return mockSseUnsubscribeFn;
      }),
      dispose: mockSseDisposeFn,
      iterate: vi.fn(),
    };
  }),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function baseParams(overrides?: Partial<GraphqlOperationParams>): GraphqlOperationParams {
  return {
    endpoint: 'https://api.example.com/graphql',
    headers: { 'X-Custom': 'value' },
    ...overrides,
  };
}

function emptyCallbacks(): GraphqlSubscribeCallbacks {
  return {
    onMessage: vi.fn(),
    onError: vi.fn(),
    onComplete: vi.fn(),
  };
}

// ─── HTTP transport ────────────────────────────────────────────────────────────

describe('createHttpTransport', () => {
  beforeEach(() => {
    mockGqlFetch.mockReset();
    mockIsTauri.mockReturnValue(false);
  });

  describe('execute()', () => {
    it('sends POST with merged Content-Type header and serialised body', async () => {
      mockGqlFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({ data: { hello: 'world' } }),
      });

      const transport = createHttpTransport();
      const result = await transport.execute(
        '{ hello }',
        { name: 'Alice' },
        'HelloQuery',
        baseParams(),
      );

      expect(mockGqlFetch).toHaveBeenCalledOnce();
      const [url, method, headers, body] = mockGqlFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/graphql');
      expect(method).toBe('POST');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Accept']).toBe('application/json');
      expect(headers['X-Custom']).toBe('value');
      expect(JSON.parse(body!)).toMatchObject({
        query: '{ hello }',
        variables: { name: 'Alice' },
        operationName: 'HelloQuery',
      });
      expect(result.data).toEqual({ hello: 'world' });
    });

    it('omits operationName key when undefined', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{"data":{}}' });
      const transport = createHttpTransport();
      await transport.execute('{ ping }', {}, undefined, baseParams());
      const body = JSON.parse(mockGqlFetch.mock.calls[0][3]!);
      expect(body).not.toHaveProperty('operationName');
    });

    it('forwards skipTlsVerify to gqlFetch', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{"data":{}}' });
      const transport = createHttpTransport();
      await transport.execute('{ q }', {}, undefined, baseParams({ skipTlsVerify: true }));
      expect(mockGqlFetch.mock.calls[0][5]).toBe(true);
    });

    it('forwards AbortSignal to gqlFetch', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '{"data":{}}' });
      const ctrl = new AbortController();
      const transport = createHttpTransport();
      await transport.execute('{ q }', {}, undefined, baseParams({ signal: ctrl.signal }));
      expect(mockGqlFetch.mock.calls[0][4]).toBe(ctrl.signal);
    });

    it('returns error response when gqlFetch returns error field', async () => {
      mockGqlFetch.mockResolvedValue({ status: 0, statusText: '', headers: {}, body: '', error: 'Network timeout' });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      // Transport-level errors normalize data to null for consistency with useGraphqlExecution.ts
      expect(result.data).toBeNull();
      expect(result.errors?.[0].message).toBe('Network timeout');
    });

    it('returns error when response JSON is malformed', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: 'not-json' });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      // Parse errors also normalize to null
      expect(result.data).toBeNull();
      expect(result.errors?.[0].message).toMatch(/Failed to parse/);
    });

    it('handles non-object JSON response gracefully (array at top level)', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '[1, 2, 3]' });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      // Non-object parsed → asRecord = {} → data: null, no errors
      expect(result.data).toBeNull();
      expect(result.errors).toBeUndefined();
    });

    it('handles non-object JSON response gracefully (null at top level)', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: 'null' });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      expect(result.data).toBeNull();
    });

    it('handles empty body gracefully', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '' });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      // Empty body parses as '{}' → no 'data' field → normalized to null (not undefined).
      // Without the ?? null normalization, undefined !== null would wrongly report 'success'.
      expect(result.data).toBeNull();
    });

    it('returns errors array from parsed response', async () => {
      const errBody = JSON.stringify({ data: null, errors: [{ message: 'Not found' }] });
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: errBody });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].message).toBe('Not found');
    });

    it('normalizes missing data field to null (pure error response)', async () => {
      // Server returns {"errors": [...]} with no "data" field — must normalize to null.
      // Without this, `data !== null` would be true (undefined !== null) and the
      // execution status would incorrectly report 'success'.
      const errBody = JSON.stringify({ errors: [{ message: 'Auth required' }] });
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: errBody });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      expect(result.data).toBeNull();
      expect(result.errors?.[0].message).toBe('Auth required');
    });

    it('returns extensions from parsed response', async () => {
      const body = JSON.stringify({ data: {}, extensions: { tracing: { version: 1 } } });
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      expect(result.extensions).toEqual({ tracing: { version: 1 } });
    });

    it('has type === "http"', () => {
      expect(createHttpTransport().type).toBe('http');
    });
  });

  describe('subscribe()', () => {
    it('calls onError with "HTTP transport does not support subscriptions" message', () => {
      const transport = createHttpTransport();
      const callbacks = emptyCallbacks();
      const unsub = transport.subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.stringMatching(/HTTP transport does not support subscriptions/),
      );
      expect(typeof unsub).toBe('function');
      unsub(); // should not throw
    });
  });
});

// ─── WS transport (real implementation) ─────────────────────────────────────

describe('createWsTransport', () => {
  beforeEach(() => {
    mockWsSubscribeSink = null;
    mockWsUnsubscribeFn = null;
    capturedWsClientConfig = null;
  });

  it('has type === "ws"', () => {
    expect(createWsTransport().type).toBe('ws');
  });

  it('execute() resolves with error (WS does not support queries)', async () => {
    const result = await createWsTransport().execute('{ q }', {}, undefined, baseParams());
    // data must be null (not undefined) — per BUG-S1-REV-2: undefined would cause
    // status checks (data !== null) to report 'success' incorrectly.
    expect(result.data).toBeNull();
    expect(result.errors?.[0].message).toMatch(/WS transport/);
  });

  it('subscribe() returns an unsubscribe function for graphql-transport-ws', () => {
    const callbacks = emptyCallbacks();
    const unsub = createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    // Real transport: subscribe() returns a cleanup function immediately without calling onError
    expect(typeof unsub).toBe('function');
    expect(callbacks.onError).not.toHaveBeenCalled();
    unsub(); // should not throw
  });

  it('subscribe() forwards next frame to onMessage', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    // Full ExecutionResult is passed to onMessage (consistent with SSE transport).
    // useGraphqlSubscription extracts .data via the 'data' in key check.
    mockWsSubscribeSink?.next?.({ data: { value: 1 } });
    expect(callbacks.onMessage).toHaveBeenCalledWith({ data: { value: 1 } });
  });

  it('subscribe() forwards complete frame to onComplete', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    mockWsSubscribeSink?.complete?.();
    expect(callbacks.onComplete).toHaveBeenCalledOnce();
  });

  it('subscribe() forwards error to onError', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    mockWsSubscribeSink?.error?.(new Error('Connection refused'));
    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
  });

  it('subscribe() joins GraphQL error array messages in onError', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    mockWsSubscribeSink?.error?.([
      { message: 'Field unavailable' },
      { message: 'Auth expired' },
    ]);
    expect(callbacks.onError).toHaveBeenCalledWith('Field unavailable; Auth expired');
  });

  it('subscribe() stringifies unknown error types in onError', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    mockWsSubscribeSink?.error?.(42);
    expect(callbacks.onError).toHaveBeenCalledWith('42');
  });

  it('subscribe() calls onError for CloseEvent with reason', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    const closeEvent = new CloseEvent('close', { code: 4401, reason: 'Unauthorized' });
    mockWsSubscribeSink?.error?.(closeEvent);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('Unauthorized'));
  });

  it('execute() on legacy graphql-ws transport resolves with error (WS does not support queries)', async () => {
    const result = await createWsTransport('graphql-ws').execute('{ q }', {}, undefined, baseParams());
    expect(result.errors?.[0].message).toMatch(/WS transport/);
  });

  it('subscribe() calls onError for CloseEvent without reason (just code)', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    const closeEvent = new CloseEvent('close', { code: 1006 });
    mockWsSubscribeSink?.error?.(closeEvent);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('1006'));
  });

  it('defaults to graphql-transport-ws — subscribe returns function without immediate error', () => {
    const callbacks = emptyCallbacks();
    const unsub = createWsTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    expect(typeof unsub).toBe('function');
    expect(callbacks.onError).not.toHaveBeenCalled();
    unsub();
  });

  it('subscribe() immediately calls onError when AbortSignal is already aborted', () => {
    const callbacks = emptyCallbacks();
    const controller = new AbortController();
    controller.abort();
    const params = { ...baseParams(), signal: controller.signal };
    createWsTransport().subscribe('subscription { e }', {}, undefined, params, callbacks);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringMatching(/Aborted/i));
  });

  // ── WS internal lifecycle callbacks (covers on.connecting / connected / error / closed) ──

  it('on.connecting(false) calls onStateChange with "connecting"', () => {
    const onStateChange = vi.fn();
    createWsTransport('graphql-transport-ws', null, 5, onStateChange).subscribe(
      'subscription { e }', {}, undefined, baseParams(), emptyCallbacks(),
    );
    capturedWsClientConfig?.on?.connecting?.(false);
    expect(onStateChange).toHaveBeenCalledWith('connecting');
  });

  it('on.connecting(true) calls onStateChange with "reconnecting" and incrementing attempt', () => {
    const onStateChange = vi.fn();
    createWsTransport('graphql-transport-ws', null, 5, onStateChange).subscribe(
      'subscription { e }', {}, undefined, baseParams(), emptyCallbacks(),
    );
    capturedWsClientConfig?.on?.connecting?.(true);
    expect(onStateChange).toHaveBeenCalledWith('reconnecting', 1);
    capturedWsClientConfig?.on?.connecting?.(true);
    expect(onStateChange).toHaveBeenCalledWith('reconnecting', 2);
  });

  it('on.connected() calls onStateChange with "connected"', () => {
    const onStateChange = vi.fn();
    createWsTransport('graphql-transport-ws', null, 5, onStateChange).subscribe(
      'subscription { e }', {}, undefined, baseParams(), emptyCallbacks(),
    );
    capturedWsClientConfig?.on?.connected?.();
    expect(onStateChange).toHaveBeenCalledWith('connected');
  });

  it('on.error() calls onStateChange with "error"', () => {
    const onStateChange = vi.fn();
    createWsTransport('graphql-transport-ws', null, 5, onStateChange).subscribe(
      'subscription { e }', {}, undefined, baseParams(), emptyCallbacks(),
    );
    capturedWsClientConfig?.on?.error?.();
    expect(onStateChange).toHaveBeenCalledWith('error');
  });

  it('on.closed() calls onStateChange with "closed"', () => {
    const onStateChange = vi.fn();
    createWsTransport('graphql-transport-ws', null, 5, onStateChange).subscribe(
      'subscription { e }', {}, undefined, baseParams(), emptyCallbacks(),
    );
    capturedWsClientConfig?.on?.closed?.();
    expect(onStateChange).toHaveBeenCalledWith('closed');
  });

  it('retryWait() returns a promise that resolves (smoke test)', async () => {
    vi.useFakeTimers();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), emptyCallbacks(),
    );
    const retryWait = capturedWsClientConfig?.retryWait;
    expect(retryWait).toBeDefined();

    let resolved = false;
    const waitPromise = retryWait?.(0).then(() => { resolved = true; });
    vi.runAllTimers();
    await waitPromise;
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });

  it('abort signal after subscribe() triggers abortHandler calling onError', () => {
    const callbacks = emptyCallbacks();
    const controller = new AbortController();
    createWsTransport().subscribe('subscription { e }', {}, undefined, { ...baseParams(), signal: controller.signal }, callbacks);

    // Trigger abort after subscribe has registered the listener
    controller.abort();
    expect(callbacks.onError).toHaveBeenCalledWith('Subscription aborted');
  });

  it('cleanup function removes abort listener and calls unsubscribe', () => {
    const controller = new AbortController();
    const unsub = createWsTransport().subscribe(
      'subscription { e }', {}, undefined, { ...baseParams(), signal: controller.signal }, emptyCallbacks(),
    );
    expect(typeof unsub).toBe('function');
    // Call cleanup — should not throw
    expect(() => unsub()).not.toThrow();
  });

  it('subscribe() with no signal still works (no abort listener registered)', () => {
    const callbacks = emptyCallbacks();
    const unsub = createWsTransport().subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    expect(typeof unsub).toBe('function');
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('subscribe() passes variables and operationName in the operation object', async () => {
    const { createClient } = vi.mocked(await import('graphql-ws'));
    createWsTransport().subscribe(
      'subscription { e }', { userId: '1' }, 'OnMessage', baseParams(), emptyCallbacks(),
    );
    // The mock client's subscribe was called — verify it was called
    const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value as { subscribe: ReturnType<typeof vi.fn> };
    expect(mockClient.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { userId: '1' }, operationName: 'OnMessage' }),
      expect.any(Object),
    );
  });

  it('subscribe() forwards partial-error frame (data + errors) as full result to onMessage', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    // Server sends a partial-error frame: data present alongside errors
    mockWsSubscribeSink?.next?.({
      data: { user: { name: 'Alice' } },
      errors: [{ message: 'Profile field unavailable' }],
    });
    // Full result object forwarded — consumer can extract both .data and .errors
    expect(callbacks.onMessage).toHaveBeenCalledWith({
      data: { user: { name: 'Alice' } },
      errors: [{ message: 'Profile field unavailable' }],
    });
  });
});

// ─── SSE transport (Sprint 3 — real implementation) ───────────────────────────

describe('createSseTransport', () => {
  beforeEach(() => {
    mockSseSubscribeSink = null;
    mockSseUnsubscribeFn = null;
    capturedSseClientConfig = null;
    mockSseDisposeFn = null;
  });

  it('has type === "sse"', () => {
    expect(createSseTransport().type).toBe('sse');
  });

  it('execute() resolves with error (SSE does not support queries)', async () => {
    const result = await createSseTransport().execute('{ q }', {}, undefined, baseParams());
    expect(result.data).toBeNull();
    expect(result.errors?.[0].message).toMatch(/SSE transport/);
  });

  it('subscribe() creates SSE client and calls subscribe with operation', () => {
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', { id: 1 }, 'MyOp', baseParams(), callbacks);
    expect(capturedSseClientConfig).not.toBeNull();
    expect(mockSseSubscribeSink).not.toBeNull();
  });

  it('passes auth headers to SSE client via headers option', () => {
    const callbacks = emptyCallbacks();
    createSseTransport({ type: 'bearer', token: 'my-token' })
      .subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    expect(capturedSseClientConfig?.headers).toMatchObject({
      Authorization: 'Bearer my-token',
    });
  });

  it('merges user request headers with auth headers', () => {
    const callbacks = emptyCallbacks();
    createSseTransport({ type: 'bearer', token: 'tok' })
      .subscribe('subscription { e }', {}, undefined,
        baseParams({ headers: { 'X-Custom': 'yes' } }), callbacks);
    expect(capturedSseClientConfig?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'X-Custom': 'yes',
    });
  });

  it('omits headers option when no auth and no user headers', () => {
    const callbacks = emptyCallbacks();
    createSseTransport(null).subscribe('subscription { e }', {}, undefined,
      baseParams({ headers: {} }), callbacks);
    expect(capturedSseClientConfig?.headers).toBeUndefined();
  });

  it('calls onMessage with data from SSE next event', () => {
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    mockSseSubscribeSink?.next?.({ data: { value: 42 } });
    expect(callbacks.onMessage).toHaveBeenCalledWith({ data: { value: 42 } });
  });

  it('calls onComplete when SSE stream completes', () => {
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    mockSseSubscribeSink?.complete?.();
    expect(callbacks.onComplete).toHaveBeenCalled();
  });

  it('calls onError with message when SSE emits an Error', () => {
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    mockSseSubscribeSink?.error?.(new Error('SSE connection failed'));
    expect(callbacks.onError).toHaveBeenCalledWith('SSE connection failed');
  });

  it('calls onError with joined messages when SSE emits GraphqlError array', () => {
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    mockSseSubscribeSink?.error?.([
      { message: 'first' },
      { message: 'second' },
    ]);
    expect(callbacks.onError).toHaveBeenCalledWith('first; second');
  });

  it('calls onError with string conversion for unknown error type', () => {
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    mockSseSubscribeSink?.error?.('raw string error');
    expect(callbacks.onError).toHaveBeenCalledWith('raw string error');
  });

  it('calls onStateChange with "reconnecting" and incrementing attempt on retry', () => {
    const onStateChange = vi.fn();
    createSseTransport(null, 5, onStateChange)
      .subscribe('subscription { e }', {}, undefined, baseParams(), emptyCallbacks());
    capturedSseClientConfig?.on?.connecting?.(true);
    expect(onStateChange).toHaveBeenCalledWith('reconnecting', 1);
    capturedSseClientConfig?.on?.connecting?.(true);
    expect(onStateChange).toHaveBeenCalledWith('reconnecting', 2);
    capturedSseClientConfig?.on?.connecting?.(true);
    expect(onStateChange).toHaveBeenCalledWith('reconnecting', 3);
  });

  it('resets reconnect count to 0 on connected after retry', () => {
    const onStateChange = vi.fn();
    createSseTransport(null, 5, onStateChange)
      .subscribe('subscription { e }', {}, undefined, baseParams(), emptyCallbacks());
    capturedSseClientConfig?.on?.connecting?.(true);
    capturedSseClientConfig?.on?.connecting?.(true);
    expect(onStateChange).toHaveBeenCalledWith('reconnecting', 2);
    capturedSseClientConfig?.on?.connected?.();
    expect(onStateChange).toHaveBeenCalledWith('connected');
    // New reconnect after recovery should start at 1 again
    capturedSseClientConfig?.on?.connecting?.(true);
    expect(onStateChange).toHaveBeenCalledWith('reconnecting', 1);
  });

  it('calls onStateChange with "connecting" (attempt=undefined) on first connect', () => {
    const onStateChange = vi.fn();
    createSseTransport(null, 5, onStateChange)
      .subscribe('subscription { e }', {}, undefined, baseParams(), emptyCallbacks());
    capturedSseClientConfig?.on?.connecting?.(false);
    expect(onStateChange).toHaveBeenCalledWith('connecting');
  });

  it('calls onStateChange with "connected" when connected event fires', () => {
    const onStateChange = vi.fn();
    createSseTransport(null, 5, onStateChange)
      .subscribe('subscription { e }', {}, undefined, baseParams(), emptyCallbacks());
    capturedSseClientConfig?.on?.connected?.();
    expect(onStateChange).toHaveBeenCalledWith('connected');
  });

  it('returns unsubscribe function that disposes client', () => {
    const callbacks = emptyCallbacks();
    const unsub = createSseTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    expect(typeof unsub).toBe('function');
    unsub(); // should not throw
  });

  it('calls onError with abort message when signal is already aborted', () => {
    const ac = new AbortController();
    ac.abort();
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined,
      baseParams({ signal: ac.signal }), callbacks);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringMatching(/[Aa]borted/));
  });

  it('abort signal fired after subscribe() disposes the SSE client exactly once', () => {
    const ac = new AbortController();
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined,
      baseParams({ signal: ac.signal }), callbacks);

    // Client created but not yet disposed
    expect(mockSseDisposeFn).not.toHaveBeenCalled();

    // Abort fires — abortHandler should call doDispose() exactly once
    ac.abort();
    expect(mockSseDisposeFn).toHaveBeenCalledTimes(1);

    // The abortHandler only calls doDispose() — no user callbacks should be triggered
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });

  it('normalises wss:// endpoint to https:// before creating SSE client (BUG fix)', () => {
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined,
      baseParams({ endpoint: 'wss://api.example.com/graphql/stream' }), callbacks);
    // The SSE client should receive https:// URL, not wss://
    // Since the captured config has the url, verify it was normalised
    expect(capturedSseClientConfig?.url ?? '').toMatch(/^https:\/\//);
  });

  it('normalises ws:// endpoint to http:// before creating SSE client', () => {
    const callbacks = emptyCallbacks();
    createSseTransport().subscribe('subscription { e }', {}, undefined,
      baseParams({ endpoint: 'ws://localhost:4000/graphql/stream' }), callbacks);
    expect(capturedSseClientConfig?.url ?? '').toMatch(/^http:\/\//);
  });

  it('retry() applies exponential backoff with jitter (smoke test)', async () => {
    vi.useFakeTimers();
    createSseTransport().subscribe('subscription { e }', {}, undefined, baseParams(), emptyCallbacks());
    const retry = capturedSseClientConfig?.retry;
    expect(retry).toBeDefined();

    let resolved = false;
    const waitPromise = retry?.(0).then(() => { resolved = true; });
    vi.runAllTimers();
    await waitPromise;
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});

// ─── deriveWsEndpoint ──────────────────────────────────────────────────────────

describe('deriveWsEndpoint', () => {
  it('converts https:// to wss://', () => {
    expect(deriveWsEndpoint('https://api.example.com/graphql')).toBe('wss://api.example.com/graphql');
  });

  it('converts http:// to ws://', () => {
    expect(deriveWsEndpoint('http://localhost:4000/graphql')).toBe('ws://localhost:4000/graphql');
  });

  it('leaves wss:// unchanged', () => {
    expect(deriveWsEndpoint('wss://api.example.com/graphql')).toBe('wss://api.example.com/graphql');
  });

  it('leaves ws:// unchanged', () => {
    expect(deriveWsEndpoint('ws://localhost:4000/graphql')).toBe('ws://localhost:4000/graphql');
  });

  it('preserves query string and path', () => {
    expect(deriveWsEndpoint('https://api.example.com/graphql?token=abc&v=2'))
      .toBe('wss://api.example.com/graphql?token=abc&v=2');
  });

  it('returns unknown protocol unchanged', () => {
    expect(deriveWsEndpoint('ftp://example.com')).toBe('ftp://example.com');
  });
});

// ─── deriveSseEndpoint ─────────────────────────────────────────────────────────

describe('deriveSseEndpoint', () => {
  it('converts wss:// to https://', () => {
    expect(deriveSseEndpoint('wss://api.example.com/graphql/stream')).toBe('https://api.example.com/graphql/stream');
  });

  it('converts ws:// to http://', () => {
    expect(deriveSseEndpoint('ws://localhost:4000/graphql/stream')).toBe('http://localhost:4000/graphql/stream');
  });

  it('leaves https:// unchanged', () => {
    expect(deriveSseEndpoint('https://api.example.com/graphql/stream')).toBe('https://api.example.com/graphql/stream');
  });

  it('leaves http:// unchanged', () => {
    expect(deriveSseEndpoint('http://localhost:4000/graphql/stream')).toBe('http://localhost:4000/graphql/stream');
  });

  it('preserves path and query string', () => {
    expect(deriveSseEndpoint('wss://api.example.com/graphql/stream?token=abc'))
      .toBe('https://api.example.com/graphql/stream?token=abc');
  });
});

// ─── requiresWsProxy ──────────────────────────────────────────────────────────

describe('requiresWsProxy', () => {
  beforeEach(() => {
    mockIsTauri.mockReturnValue(false);
  });

  it('returns false for empty selector in browser', () => {
    expect(requiresWsProxy({})).toBe(false);
  });

  it('returns true when skipTlsVerify is true', () => {
    expect(requiresWsProxy({ skipTlsVerify: true })).toBe(true);
  });

  it('returns false when skipTlsVerify is false', () => {
    expect(requiresWsProxy({ skipTlsVerify: false })).toBe(false);
  });

  it('returns true in Tauri regardless of auth', () => {
    mockIsTauri.mockReturnValue(true);
    expect(requiresWsProxy({})).toBe(true);
  });
});

// ─── selectTransport ──────────────────────────────────────────────────────────

describe('selectTransport', () => {
  beforeEach(() => {
    mockIsTauri.mockReturnValue(false);
  });

  it('returns HTTP transport for query', () => {
    expect(selectTransport({}, 'query').type).toBe('http');
  });

  it('returns HTTP transport for mutation', () => {
    expect(selectTransport({}, 'mutation').type).toBe('http');
  });

  it('returns WS transport for subscription with auto (default)', () => {
    expect(selectTransport({}, 'subscription').type).toBe('ws');
  });

  it('returns WS transport for subscription with explicit graphql-transport-ws', () => {
    expect(selectTransport({ subscriptionTransport: 'graphql-transport-ws' }, 'subscription').type).toBe('ws');
  });

  it('returns WS transport for subscription with explicit graphql-ws', () => {
    expect(selectTransport({ subscriptionTransport: 'graphql-ws' }, 'subscription').type).toBe('ws');
  });

  it('returns SSE transport for subscription with sse preference', () => {
    expect(selectTransport({ subscriptionTransport: 'sse' }, 'subscription').type).toBe('sse');
  });

  it('returns SSE transport for auto when endpoint ends with /stream', () => {
    expect(selectTransport(
      { subscriptionTransport: 'auto', endpoint: 'https://api.example.com/graphql/stream' },
      'subscription',
    ).type).toBe('sse');
  });

  it('returns SSE transport for auto when endpoint contains /stream?', () => {
    expect(selectTransport(
      { subscriptionTransport: 'auto', endpoint: 'https://api.example.com/graphql/stream?token=abc' },
      'subscription',
    ).type).toBe('sse');
  });

  it('returns WS transport for auto when endpoint does NOT end with /stream', () => {
    expect(selectTransport(
      { subscriptionTransport: 'auto', endpoint: 'https://api.example.com/graphql' },
      'subscription',
    ).type).toBe('ws');
  });

  it('returns WS for explicitly non-stream URL even if "stream" appears elsewhere in path', () => {
    // e.g. https://api.example.com/streaming/graphql — does NOT end in /stream
    expect(selectTransport(
      { subscriptionTransport: 'auto', endpoint: 'https://api.example.com/streaming/graphql' },
      'subscription',
    ).type).toBe('ws');
  });

  it('passes graphql-ws subprotocol when graphql-ws is selected', () => {
    // Legacy WS transport should NOT immediately error — it opens a WebSocket.
    // The transport type is still 'ws'.
    const transport = selectTransport({ subscriptionTransport: 'graphql-ws' }, 'subscription');
    expect(transport.type).toBe('ws');
  });
});

// ─── Legacy WS transport (Sprint 5 — 2A-3) ────────────────────────────────────

/**
 * Minimal WebSocket mock for testing the legacy graphql-ws subprotocol client.
 * The real WebSocket is not available in jsdom for cross-origin connections.
 */
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState: number = 0;
  subprotocol: string;
  sentMessages: string[] = [];

  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  constructor(public url: string, subprotocol?: string | string[]) {
    this.subprotocol = Array.isArray(subprotocol) ? (subprotocol[0] ?? '') : (subprotocol ?? '');
  }

  send(data: string) {
    if (this.readyState === MockWebSocket.OPEN) {
      this.sentMessages.push(data);
    }
  }

  close(code?: number, reason?: string) {
    if (this.readyState !== MockWebSocket.CLOSED) {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.({ wasClean: code === 1000, code: code ?? 1000, reason: reason ?? '' } as CloseEvent);
    }
  }

  // Test helpers ─────────────────────────────────
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateError() {
    this.onerror?.();
  }

  simulateClose(wasClean = false, code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ wasClean, code, reason: '' } as CloseEvent);
  }
}

describe('createWsTransport — legacy graphql-ws subprotocol', () => {
  let mockWs: MockWebSocket;

  function makeLegacyTransport(auth?: GraphqlAuth | null) {
    // Must use a regular function (not arrow) so `new WsImpl(url, sub)` works
    // (arrow functions cannot be called with `new`).
    function MockWsCtor(url: string, sub: string): MockWebSocket {
      const inst = new MockWebSocket(url, sub);
      mockWs = inst;
      return inst;
    }
    return createWsTransport(
      'graphql-ws',
      auth,
      0,
      undefined,
      MockWsCtor as unknown as typeof WebSocket,
    );
  }

  beforeEach(() => {
    mockWs = null as unknown as MockWebSocket;
  });

  it('opens a WebSocket with subprotocol "graphql-ws"', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);
    expect(mockWs).not.toBeNull();
    expect(mockWs.subprotocol).toBe('graphql-ws');
  });

  it('sends connection_init on open, then start after connection_ack', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, 'OnE', baseParams(), cb);

    mockWs.simulateOpen();
    const initMsg = JSON.parse(mockWs.sentMessages[0] ?? '{}');
    expect(initMsg.type).toBe('connection_init');

    mockWs.simulateMessage({ type: 'connection_ack' });
    const startMsg = JSON.parse(mockWs.sentMessages[1] ?? '{}');
    expect(startMsg.type).toBe('start');
    expect(startMsg.payload.query).toBe('subscription { e }');
    expect(startMsg.payload.operationName).toBe('OnE');
  });

  it('calls onMessage for data frames', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'data', id: '1', payload: { data: { value: 42 } } });

    // Full { data, errors? } wrapper forwarded (consistent with modern WS and SSE transports)
    expect(cb.onMessage).toHaveBeenCalledWith({ data: { value: 42 } });
  });

  it('calls onComplete for complete frames', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'complete', id: '1' });

    expect(cb.onComplete).toHaveBeenCalled();
  });

  it('calls onError for error frames', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'error', id: '1', payload: 'Unauthorized' });

    expect(cb.onError).toHaveBeenCalledWith('Unauthorized');
  });

  it('calls onError on unexpected WebSocket close', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateClose(false, 1006);

    expect(cb.onError).toHaveBeenCalled();
  });

  it('calls onError immediately when signal is pre-aborted', () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, { ...baseParams(), signal: ctrl.signal }, cb);

    expect(cb.onError).toHaveBeenCalledWith(expect.stringMatching(/[Aa]borted/));
  });

  it('sends connection_init with connectionParams when auth is configured', () => {
    const transport = makeLegacyTransport({ type: 'bearer', token: 'tok' } as GraphqlAuth);
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    const initMsg = JSON.parse(mockWs.sentMessages[0] ?? '{}');
    expect(initMsg.payload).toEqual({ Authorization: 'Bearer tok' });
  });

  it('returns no-op for execute on legacy WS transport', async () => {
    const transport = makeLegacyTransport();
    const result = await transport.execute('query { q }', {}, undefined, baseParams());
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toContain('WS transport does not support');
  });

  it('ignores connection_keep_alive messages', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'connection_keep_alive' });

    expect(cb.onMessage).not.toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
    expect(cb.onComplete).not.toHaveBeenCalled();
  });

  it('data error frame with no data calls onError', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({
      type: 'data', id: '1',
      payload: { errors: [{ message: 'Forbidden' }] },
    });

    expect(cb.onError).toHaveBeenCalledWith('Forbidden');
  });

  it('data frame with both data and errors forwards wrapped result to onMessage', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({
      type: 'data', id: '1',
      payload: {
        data: { user: { name: 'Alice' } },
        errors: [{ message: 'Profile unavailable' }],
      },
    });

    // Partial-error: data is present → onMessage called with wrapped result (not onError)
    expect(cb.onMessage).toHaveBeenCalledWith({
      data: { user: { name: 'Alice' } },
      errors: [{ message: 'Profile unavailable' }],
    });
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('data frame with data:null and errors forwards wrapped result to onMessage', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    // payload.data = null is PRESENT (not undefined) — treated as partial-error, not pure error
    mockWs.simulateMessage({
      type: 'data', id: '1',
      payload: { data: null, errors: [{ message: 'Auth expired' }] },
    });

    expect(cb.onMessage).toHaveBeenCalledWith({
      data: null,
      errors: [{ message: 'Auth expired' }],
    });
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('error frame with array payload joins messages with semicolons', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({
      type: 'error', id: '1',
      payload: [{ message: 'Auth failed' }, { message: 'Rate limited' }],
    });

    expect(cb.onError).toHaveBeenCalledWith('Auth failed; Rate limited');
  });

  it('error frame with unknown payload type uses fallback message', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'error', id: '1', payload: { code: 500 } });

    expect(cb.onError).toHaveBeenCalledWith('Unknown legacy subscription error');
  });

  it('error frame for wrong operation id is silently ignored', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'error', id: '99', payload: 'wrong-id' });

    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('clean close (code 1000) without prior complete calls onComplete', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    // Server closes cleanly without sending a complete message first
    mockWs.simulateClose(true, 1000);

    expect(cb.onComplete).toHaveBeenCalledOnce();
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('complete message followed by close does not double-call onComplete', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'complete', id: '1' });
    // After complete, disposed = true — close handler should be a no-op
    mockWs.simulateClose(true, 1000);

    expect(cb.onComplete).toHaveBeenCalledOnce();
  });

  it('ignores ka (keep-alive alias) messages', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'ka' });

    expect(cb.onMessage).not.toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('connection_error frame calls onError with payload message', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_error', payload: { message: 'Invalid credentials' } });

    expect(cb.onError).toHaveBeenCalledWith('Invalid credentials');
    expect(cb.onComplete).not.toHaveBeenCalled();
  });

  it('connection_error without message uses fallback text', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_error', payload: { code: 403 } });

    expect(cb.onError).toHaveBeenCalledWith('Connection rejected by server (connection_error)');
  });

  it('connection_error disposes the WS — subsequent messages are ignored', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_error', payload: { message: 'Rejected' } });
    // After dispose, further messages must be ignored
    mockWs.simulateMessage({ type: 'data', id: '1', payload: { data: { value: 1 } } });

    expect(cb.onError).toHaveBeenCalledTimes(1);
    expect(cb.onMessage).not.toHaveBeenCalled();
  });

  it('data frame for wrong operation id is silently ignored', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'connection_ack' });
    mockWs.simulateMessage({ type: 'data', id: '99', payload: { data: { x: 1 } } });

    expect(cb.onMessage).not.toHaveBeenCalled();
  });

  it('unparseable message is silently ignored', () => {
    const transport = makeLegacyTransport();
    const cb = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), cb);

    mockWs.simulateOpen();
    mockWs.onmessage?.(new MessageEvent('message', { data: 'this is not json {{' }));

    expect(cb.onError).not.toHaveBeenCalled();
  });
});

// ─── hasIncrementalDirective ──────────────────────────────────────────────────

describe('hasIncrementalDirective', () => {
  it('returns true when query contains @defer', () => {
    const query = `
      query GetUser {
        user {
          id
          ... on User @defer {
            profile { bio }
          }
        }
      }
    `;
    expect(hasIncrementalDirective(query)).toBe(true);
  });

  it('returns true when query contains @stream', () => {
    const query = `
      query GetFeed {
        feed @stream(initialCount: 3) {
          id
          text
        }
      }
    `;
    expect(hasIncrementalDirective(query)).toBe(true);
  });

  it('returns true when query contains both @defer and @stream', () => {
    const query = `
      query Mixed {
        items @stream {
          id
          details @defer { body }
        }
      }
    `;
    expect(hasIncrementalDirective(query)).toBe(true);
  });

  it('returns false for a plain query with no incremental directives', () => {
    const query = `
      query GetUser {
        user {
          id
          name
        }
      }
    `;
    expect(hasIncrementalDirective(query)).toBe(false);
  });

  it('returns false for a mutation', () => {
    const query = 'mutation CreateUser($name: String!) { createUser(name: $name) { id } }';
    expect(hasIncrementalDirective(query)).toBe(false);
  });

  it('returns false for a subscription (no @defer/@stream)', () => {
    const query = 'subscription OnMessage { messageAdded { id text } }';
    expect(hasIncrementalDirective(query)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(hasIncrementalDirective('')).toBe(false);
  });

  it('returns false for malformed GraphQL (parse error silently returns false)', () => {
    expect(hasIncrementalDirective('this is not graphql {')).toBe(false);
  });

  it('returns false for @skip and @include (not incremental directives)', () => {
    const query = `
      query GetUser($showName: Boolean!) {
        user {
          id
          name @include(if: $showName)
          email @skip(if: false)
        }
      }
    `;
    expect(hasIncrementalDirective(query)).toBe(false);
  });

  it('returns true for inline fragment with @defer argument', () => {
    const query = `
      query Q {
        hero {
          id
          ... @defer(label: "slow") {
            friends { name }
          }
        }
      }
    `;
    expect(hasIncrementalDirective(query)).toBe(true);
  });
});
