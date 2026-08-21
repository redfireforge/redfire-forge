import { describe, expect, it, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type http from 'node:http';
import {
  buildUpstreamUrl,
  executeProxy,
  executeProxyWithFailover,
  listProxyOrigins,
  pickAllowlistedOrigin,
  shouldTryNextOrigin,
} from './apiMockProxyExecutor';
import type { ProxyExecutorResult } from './apiMockProxyExecutor';
import { DEFAULT_PROXY_SETTINGS } from '../../src/shared/api-mock/proxyContracts';

function proxyResult(over: Partial<ProxyExecutorResult>): ProxyExecutorResult {
  return { ok: true, status: 200, headers: {}, body: '', ...over };
}

function jsonResponse(status: number, body = '{}'): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

function mockReq(method = 'GET', headers: Record<string, string | string[]> = {}): http.IncomingMessage {
  const req = new EventEmitter() as http.IncomingMessage;
  (req as { method?: string }).method = method;
  (req as { headers: Record<string, string | string[]> }).headers = headers;
  return req;
}

describe('apiMockProxyExecutor helpers', () => {
  it('buildUpstreamUrl preserves path and query', () => {
    expect(buildUpstreamUrl('https://api.example.com', '/x', '/users?id=1'))
      .toBe('https://api.example.com/users?id=1');
  });

  it('pickAllowlistedOrigin returns first when enabled', () => {
    expect(pickAllowlistedOrigin({ ...DEFAULT_PROXY_SETTINGS, enabled: true, allowlist: [] })).toBeUndefined();
    expect(pickAllowlistedOrigin({
      ...DEFAULT_PROXY_SETTINGS,
      enabled: true,
      allowlist: ['https://a.example.com', 'https://b.example.com'],
    })).toBe('https://a.example.com');
  });

  it('listProxyOrigins trims, drops blanks, and is empty when disabled', () => {
    expect(listProxyOrigins({ ...DEFAULT_PROXY_SETTINGS, enabled: false, allowlist: ['https://a.example.com'] }))
      .toEqual([]);
    expect(listProxyOrigins({
      ...DEFAULT_PROXY_SETTINGS,
      enabled: true,
      allowlist: [' https://a.example.com ', '', '  ', 'https://b.example.com'],
    })).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('shouldTryNextOrigin fails over only on unreachable / 5xx / 404', () => {
    expect(shouldTryNextOrigin(proxyResult({ ok: false, status: 502 }))).toBe(true);
    expect(shouldTryNextOrigin(proxyResult({ status: 404 }))).toBe(true);
    expect(shouldTryNextOrigin(proxyResult({ status: 500 }))).toBe(true);
    expect(shouldTryNextOrigin(proxyResult({ status: 599 }))).toBe(true);
    expect(shouldTryNextOrigin(proxyResult({ status: 200 }))).toBe(false);
    expect(shouldTryNextOrigin(proxyResult({ status: 301 }))).toBe(false);
    expect(shouldTryNextOrigin(proxyResult({ status: 401 }))).toBe(false);
    expect(shouldTryNextOrigin(proxyResult({ status: 403 }))).toBe(false);
  });
});

describe('executeProxyWithFailover', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const failoverProxy = (allowlist: string[]) => ({
    ...DEFAULT_PROXY_SETTINGS,
    enabled: true,
    allowlist,
    blockPrivateNetworks: false,
  });

  const runFailover = (allowlist: string[]) => executeProxyWithFailover({
    req: mockReq('GET'),
    proxy: failoverProxy(allowlist),
    capturedPath: '/widgets/42',
    inboundUrl: '/widgets/42',
    activeMockPorts: [4600],
    body: null,
  });

  it('returns a 502 with zero attempts when the allowlist is empty', async () => {
    const res = await executeProxyWithFailover({
      req: mockReq('GET'),
      proxy: failoverProxy([]),
      capturedPath: '/x',
      inboundUrl: '/x',
      activeMockPorts: [4600],
      body: null,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
    expect(res.attempts).toBe(0);
    expect(res.attemptedOrigin).toBeUndefined();
  });

  it('stops at the first server that returns a real 2xx', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, '{"from":"a"}'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await runFailover(['https://a.example.com', 'https://b.example.com']);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.attempts).toBe(1);
    expect(res.attemptedOrigin).toBe('https://a.example.com');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://a.example.com/widgets/42');
  });

  it('falls over to the next server on a 404', async () => {
    const fetchMock = vi.fn(async (url: string | URL) =>
      String(url).includes('a.example.com') ? jsonResponse(404, '{"e":"nf"}') : jsonResponse(200, '{"from":"b"}'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await runFailover(['https://a.example.com', 'https://b.example.com']);
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"from":"b"}');
    expect(res.attempts).toBe(2);
    expect(res.attemptedOrigin).toBe('https://b.example.com');
  });

  it('falls over on 5xx and on an unreachable server', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).includes('a.example.com')) return jsonResponse(503);
      if (String(url).includes('b.example.com')) throw new Error('ECONNREFUSED');
      return jsonResponse(200, '{"from":"c"}');
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await runFailover(['https://a.example.com', 'https://b.example.com', 'https://c.example.com']);
    expect(res.status).toBe(200);
    expect(res.attempts).toBe(3);
    expect(res.attemptedOrigin).toBe('https://c.example.com');
  });

  it('does NOT fall over on a non-404 4xx (e.g. 401) — it is a real answer', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, '{"e":"unauthorized"}'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await runFailover(['https://a.example.com', 'https://b.example.com']);
    expect(res.status).toBe(401);
    expect(res.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns the last attempt when every server fails', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(404, '{"e":"nf"}'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await runFailover(['https://a.example.com', 'https://b.example.com']);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(404);
    expect(res.attempts).toBe(2);
    expect(res.attemptedOrigin).toBe('https://b.example.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('executeProxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('blocks disallowed upstreams via policy', async () => {
    const result = await executeProxy({
      req: mockReq(),
      proxy: { ...DEFAULT_PROXY_SETTINGS, enabled: true, allowlist: ['https://api.example.com'] },
      upstreamUrl: 'http://169.254.169.254/latest/meta-data',
      activeMockPorts: [4600],
      body: null,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.error).toBeTruthy();
  });

  it('forwards allowlisted responses and strips set-cookie', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'session=abc',
        connection: 'keep-alive',
      },
    })));

    const result = await executeProxy({
      req: mockReq('GET', { authorization: 'Bearer x', 'x-trace': '1' }),
      proxy: {
        ...DEFAULT_PROXY_SETTINGS,
        enabled: true,
        allowlist: ['https://api.example.com'],
        blockPrivateNetworks: false,
        forwardAuth: false,
      },
      upstreamUrl: 'https://api.example.com/hello',
      activeMockPorts: [4600],
      body: null,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"ok":true}');
    expect(result.headers['set-cookie']).toBeUndefined();
    const call = vi.mocked(fetch).mock.calls[0];
    const sent = call[1]?.headers as Record<string, string>;
    expect(sent.authorization).toBeUndefined();
    expect(sent['x-redfireforge-mock']).toBe('true');
  });

  it('does not forward HTTP/2 pseudo-headers to the upstream', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await executeProxy({
      req: mockReq('GET', {
        ':method': 'GET',
        ':path': '/hello',
        ':authority': 'mock.local',
        'x-trace': '1',
      }),
      proxy: {
        ...DEFAULT_PROXY_SETTINGS,
        enabled: true,
        allowlist: ['https://api.example.com'],
        blockPrivateNetworks: false,
      },
      upstreamUrl: 'https://api.example.com/hello',
      activeMockPorts: [4600],
      body: null,
    });

    expect(result.ok).toBe(true);
    const sent = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(sent[':method']).toBeUndefined();
    expect(sent[':path']).toBeUndefined();
    expect(sent[':authority']).toBeUndefined();
    expect(sent['x-trace']).toBe('1');
  });

  it('joins multiple Cookie headers with semicolons for upstream fetch', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await executeProxy({
      req: mockReq('GET', {
        cookie: ['session=abc', 'theme=dark'],
        'x-trace': '1',
      }),
      proxy: {
        ...DEFAULT_PROXY_SETTINGS,
        enabled: true,
        allowlist: ['https://api.example.com'],
        blockPrivateNetworks: false,
        forwardAuth: true,
        forwardCredentialHeaders: ['cookie'],
        stripHopByHop: false,
      },
      upstreamUrl: 'https://api.example.com/hello',
      activeMockPorts: [4600],
      body: null,
    });

    const sent = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(sent.cookie).toBe('session=abc; theme=dark');
    expect(sent['x-trace']).toBe('1');
  });
});
