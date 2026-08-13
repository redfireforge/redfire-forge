import { describe, expect, it, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type http from 'node:http';
import {
  buildUpstreamUrl,
  executeProxy,
  pickAllowlistedOrigin,
} from './apiMockProxyExecutor';
import { DEFAULT_PROXY_SETTINGS } from '../../src/shared/api-mock/proxyContracts';

function mockReq(method = 'GET', headers: Record<string, string> = {}): http.IncomingMessage {
  const req = new EventEmitter() as http.IncomingMessage;
  (req as { method?: string }).method = method;
  (req as { headers: Record<string, string> }).headers = headers;
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
});
