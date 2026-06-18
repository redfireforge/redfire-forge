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
  requiresWsProxy,
  type GraphqlOperationParams,
  type GraphqlSubscribeCallbacks,
} from './graphqlClient';

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
      expect(result.data).toBeUndefined();
      expect(result.errors?.[0].message).toBe('Network timeout');
    });

    it('returns error when response JSON is malformed', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: 'not-json' });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      expect(result.data).toBeUndefined();
      expect(result.errors?.[0].message).toMatch(/Failed to parse/);
    });

    it('handles empty body gracefully', async () => {
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: '' });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      expect(result.data).toBeUndefined();
    });

    it('returns errors array from parsed response', async () => {
      const errBody = JSON.stringify({ data: null, errors: [{ message: 'Not found' }] });
      mockGqlFetch.mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: errBody });
      const transport = createHttpTransport();
      const result = await transport.execute('{ q }', {}, undefined, baseParams());
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].message).toBe('Not found');
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

// ─── WS transport stub ─────────────────────────────────────────────────────────

describe('createWsTransport', () => {
  it('has type === "ws"', () => {
    expect(createWsTransport().type).toBe('ws');
  });

  it('execute() resolves with error (WS does not support queries)', async () => {
    const result = await createWsTransport().execute('{ q }', {}, undefined, baseParams());
    expect(result.data).toBeUndefined();
    expect(result.errors?.[0].message).toMatch(/WS transport/);
  });

  it('subscribe() calls onError with not-implemented message for graphql-transport-ws', () => {
    const callbacks = emptyCallbacks();
    const unsub = createWsTransport('graphql-transport-ws').subscribe(
      'subscription { e }', {}, undefined, baseParams(), callbacks,
    );
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringMatching(/graphql-transport-ws/),
    );
    unsub(); // should not throw
  });

  it('subscribe() calls onError with not-implemented message for graphql-ws', () => {
    const callbacks = emptyCallbacks();
    createWsTransport('graphql-ws').subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringMatching(/graphql-ws/),
    );
  });

  it('defaults to graphql-transport-ws subprotocol', async () => {
    const callbacks = emptyCallbacks();
    createWsTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringMatching(/graphql-transport-ws/),
    );
  });
});

// ─── SSE transport stub ────────────────────────────────────────────────────────

describe('createSseTransport', () => {
  it('has type === "sse"', () => {
    expect(createSseTransport().type).toBe('sse');
  });

  it('execute() resolves with error (SSE does not support queries)', async () => {
    const result = await createSseTransport().execute('{ q }', {}, undefined, baseParams());
    expect(result.data).toBeUndefined();
    expect(result.errors?.[0].message).toMatch(/SSE transport/);
  });

  it('subscribe() calls onError with not-implemented message', () => {
    const callbacks = emptyCallbacks();
    const unsub = createSseTransport().subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringMatching(/SSE subscription transport is not yet implemented/),
    );
    unsub(); // should not throw
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

  it('passes graphql-ws subprotocol when graphql-ws is selected', () => {
    const transport = selectTransport({ subscriptionTransport: 'graphql-ws' }, 'subscription');
    const callbacks = emptyCallbacks();
    transport.subscribe('subscription { e }', {}, undefined, baseParams(), callbacks);
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringMatching(/graphql-ws/),
    );
  });
});
