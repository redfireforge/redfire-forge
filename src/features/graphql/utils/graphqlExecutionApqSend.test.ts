import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApqSendFn } from './graphqlExecutionApqSend';
import { gqlFetch } from './gqlFetch';
import { parseHttpBody } from './graphqlExecutionResponseParsing';
import { gqlRequiresTlsProxy, tlsApqGetNeedsPostProxy } from '../../../shared/types/gqlTls';

vi.mock('./gqlFetch', () => ({
  gqlFetch: vi.fn(),
}));

vi.mock('../../../shared/types/gqlTls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/types/gqlTls')>();
  return {
    ...actual,
    gqlRequiresTlsProxy: vi.fn(() => false),
    tlsApqGetNeedsPostProxy: vi.fn(() => false),
  };
});

vi.mock('./graphqlExecutionResponseParsing', () => ({
  parseHttpBody: vi.fn(() => ({ data: { ok: true }, httpStatus: 200, httpHeaders: {}, latencyMs: 1, timestamp: 0 })),
}));

vi.mock('./graphqlProxyTransports', () => ({
  getProxyBase: () => 'http://proxy.test',
}));

describe('buildApqSendFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POST path delegates to gqlFetch with merged body', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 200,
      headers: {},
      body: '{"data":{"x":1}}',
    });

    const sendFn = buildApqSendFn({
      endpoint: 'http://localhost:4000/graphql',
      tls: {},
      headers: { Authorization: 'Bearer t' },
      requestHeaders: { 'Content-Type': 'application/json' },
      requestBody: { query: 'query { x }', operationName: 'Q' },
      startTime: performance.now(),
      signal: new AbortController().signal,
    });

    await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'abc' } } }, 'POST');

    expect(gqlFetch).toHaveBeenCalledWith(
      'http://localhost:4000/graphql',
      'POST',
      expect.objectContaining({ 'Content-Type': 'application/json' }),
      expect.stringContaining('abc'),
      expect.any(AbortSignal),
      {},
    );
    expect(parseHttpBody).toHaveBeenCalled();
  });

  it('GET path builds URL search params on direct endpoint', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({
      status: 200,
      headers: {},
      body: '{}',
    });

    const sendFn = buildApqSendFn({
      endpoint: 'http://localhost:4000/graphql',
      tls: {},
      headers: {},
      requestHeaders: { 'Content-Type': 'application/json' },
      requestBody: { operationName: 'MyOp' },
      startTime: performance.now(),
      signal: new AbortController().signal,
    });

    await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'hash' } } }, 'GET');

    const calledUrl = vi.mocked(gqlFetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('operationName=MyOp');
    expect(calledUrl).toContain('extensions');
  });

  it('hash-only POST omits full query from body', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{}' });
    const sendFn = buildApqSendFn({
      endpoint: 'http://localhost:4000/graphql',
      tls: {},
      headers: {},
      requestHeaders: { 'Content-Type': 'application/json' },
      requestBody: { query: 'query { secret }', operationName: 'Op' },
      startTime: performance.now(),
      signal: new AbortController().signal,
    });
    await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'h' } } }, 'POST');
    const body = vi.mocked(gqlFetch).mock.calls[0][3] as string;
    expect(body).not.toContain('secret');
    expect(body).toContain('Op');
  });

  it('GET via TLS proxy uses query-string proxy when skipTlsVerify only', async () => {
    vi.mocked(gqlRequiresTlsProxy).mockReturnValue(true);
    vi.mocked(tlsApqGetNeedsPostProxy).mockReturnValue(false);
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{}' });
    const sendFn = buildApqSendFn({
      endpoint: 'https://localhost:4443/graphql',
      tls: { skipTlsVerify: true },
      headers: {},
      requestHeaders: {},
      requestBody: { operationName: 'HashOp' },
      startTime: performance.now(),
      signal: new AbortController().signal,
    });
    await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'x' } } }, 'GET');
    const calledUrl = vi.mocked(gqlFetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('skipTlsVerify=true');
    expect(calledUrl).toContain('operationName=HashOp');
  });

  it('GET with mTLS PEM fields POSTs directly via gqlFetch', async () => {
    vi.mocked(gqlRequiresTlsProxy).mockReturnValue(true);
    vi.mocked(tlsApqGetNeedsPostProxy).mockReturnValue(true);
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{"data":{"ok":true}}' });

    const sendFn = buildApqSendFn({
      endpoint: 'https://localhost:4445/graphql',
      tls: { caCert: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----' },
      headers: { Authorization: 'Bearer t' },
      requestHeaders: {},
      requestBody: { operationName: 'ProxyOp', query: 'query ProxyOp { health }' },
      startTime: performance.now(),
      signal: new AbortController().signal,
    });

    await sendFn(
      {
        extensions: { persistedQuery: { version: 1, sha256Hash: 'hash123' } },
        variables: { id: '1' },
      },
      'GET',
    );

    expect(gqlFetch).toHaveBeenCalledWith(
      'https://localhost:4445/graphql',
      'POST',
      expect.any(Object),
      expect.stringContaining('hash123'),
      expect.any(AbortSignal),
      { caCert: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----' },
    );
    expect(parseHttpBody).toHaveBeenCalled();
  });

  it('GET with mTLS POST omits optional body fields when absent', async () => {
    vi.mocked(gqlRequiresTlsProxy).mockReturnValue(true);
    vi.mocked(tlsApqGetNeedsPostProxy).mockReturnValue(true);
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{}' });

    const sendFn = buildApqSendFn({
      endpoint: 'https://localhost:4445/graphql',
      tls: { clientCert: 'cert', clientKey: 'key' },
      headers: { 'Content-Type': 'application/json' },
      requestHeaders: {},
      requestBody: {},
      startTime: performance.now(),
      signal: new AbortController().signal,
    });

    await sendFn({ query: 'query { health }', extensions: { persistedQuery: { version: 1, sha256Hash: 'h' } } }, 'GET');

    const body = JSON.parse(String(vi.mocked(gqlFetch).mock.calls[0][3]));
    expect(body.query).toBe('query { health }');
    expect(body.extensions).toBeDefined();
    expect(body.variables).toBeUndefined();
    expect(body.operationName).toBeUndefined();
  });

  it('GET via TLS proxy omits skipTlsVerify when verification is enabled', async () => {
    vi.mocked(gqlRequiresTlsProxy).mockReturnValue(true);
    vi.mocked(tlsApqGetNeedsPostProxy).mockReturnValue(false);
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{}' });
    const sendFn = buildApqSendFn({
      endpoint: 'https://localhost:4443/graphql',
      tls: { skipTlsVerify: false },
      headers: {},
      requestHeaders: {},
      requestBody: {},
      startTime: performance.now(),
      signal: new AbortController().signal,
    });
    await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'x' } } }, 'GET');
    const calledUrl = vi.mocked(gqlFetch).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('skipTlsVerify');
  });

  it('hash-only POST omits operationName when not present on request body', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{}' });
    const sendFn = buildApqSendFn({
      endpoint: 'http://localhost:4000/graphql',
      tls: {},
      headers: {},
      requestHeaders: { 'Content-Type': 'application/json' },
      requestBody: { query: 'query { secret }' },
      startTime: performance.now(),
      signal: new AbortController().signal,
    });
    await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'h' } } }, 'POST');
    const body = JSON.parse(vi.mocked(gqlFetch).mock.calls[0][3] as string);
    expect(body.operationName).toBeUndefined();
    expect(body.extensions).toBeDefined();
  });

  it('GET direct path omits operationName when not on request body', async () => {
    vi.mocked(gqlRequiresTlsProxy).mockReturnValue(false);
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{}' });
    const sendFn = buildApqSendFn({
      endpoint: 'http://localhost:4000/graphql',
      tls: {},
      headers: {},
      requestHeaders: {},
      requestBody: { query: 'query { x }' },
      startTime: performance.now(),
      signal: new AbortController().signal,
    });
    await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'direct' } } }, 'GET');
    const calledUrl = vi.mocked(gqlFetch).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('operationName=');
  });

  it('GET resolves relative endpoint against window.location', async () => {
    vi.mocked(gqlRequiresTlsProxy).mockReturnValue(false);
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{}' });
    vi.stubGlobal('window', { location: { href: 'http://localhost:5173/app/' } });
    const sendFn = buildApqSendFn({
      endpoint: '/graphql',
      tls: {},
      headers: {},
      requestHeaders: {},
      requestBody: {},
      startTime: performance.now(),
      signal: new AbortController().signal,
    });
    await sendFn({ extensions: { persistedQuery: { version: 1, sha256Hash: 'rel' } } }, 'GET');
    const calledUrl = vi.mocked(gqlFetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/graphql');
    expect(calledUrl).toContain('extensions');
  });

  it('POST with full query in bodyFields merges request body', async () => {
    vi.mocked(gqlFetch).mockResolvedValue({ status: 200, headers: {}, body: '{}' });
    const sendFn = buildApqSendFn({
      endpoint: 'http://localhost:4000/graphql',
      tls: {},
      headers: {},
      requestHeaders: { 'Content-Type': 'application/json' },
      requestBody: { query: 'query { x }', operationName: 'Full' },
      startTime: performance.now(),
      signal: new AbortController().signal,
    });
    await sendFn({ query: 'query { y }', variables: { n: 1 } }, 'POST');
    const body = vi.mocked(gqlFetch).mock.calls[0][3] as string;
    expect(body).toContain('query { y }');
    expect(body).toContain('"n":1');
  });
});
