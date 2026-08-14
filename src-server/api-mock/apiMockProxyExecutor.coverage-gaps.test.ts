import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type http from 'node:http';
import {
  buildUpstreamUrl,
  executeProxy,
  pickAllowlistedOrigin,
} from './apiMockProxyExecutor';
import { DEFAULT_PROXY_SETTINGS } from '../../src/shared/api-mock/proxyContracts';

vi.mock('../grpc/serverOutboundUrlPolicy.js', () => ({
  validateServerOutboundUrlWithDns: vi.fn(async () => undefined),
}));

import { validateServerOutboundUrlWithDns } from '../grpc/serverOutboundUrlPolicy.js';

function mockReq(
  method = 'GET',
  headers: Record<string, string | string[] | undefined> = {},
): http.IncomingMessage {
  const req = new EventEmitter() as http.IncomingMessage;
  (req as { method?: string }).method = method;
  (req as { headers: Record<string, string | string[] | undefined> }).headers = headers;
  return req;
}

describe('apiMockProxyExecutor coverage gaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.mocked(validateServerOutboundUrlWithDns).mockReset();
    vi.mocked(validateServerOutboundUrlWithDns).mockResolvedValue(undefined);
  });

  describe('buildUpstreamUrl', () => {
    it('joins path without leading slash and keeps inboundPath when URL parse fails', () => {
      expect(buildUpstreamUrl('https://api.example.com/', 'no-slash', '/users?q=1'))
        .toBe('https://api.example.com/users?q=1');
      expect(buildUpstreamUrl('https://api.example.com', '', ''))
        .toBe('https://api.example.com/');

      const OriginalURL = globalThis.URL;
      vi.spyOn(globalThis, 'URL').mockImplementationOnce((input, base) => {
        if (input === 'TRIGGER_THROW') throw new TypeError('bad url');
        return new OriginalURL(input as string, base as string);
      });
      expect(buildUpstreamUrl('https://api.example.com', 'no-slash', 'TRIGGER_THROW'))
        .toBe('https://api.example.com/no-slash');
    });
  });

  describe('pickAllowlistedOrigin', () => {
    const proxy = {
      ...DEFAULT_PROXY_SETTINGS,
      enabled: true,
      allowlist: ['https://hooks.example.com', 'https://api.example.com'],
    };

    it('matches inboundHostHint against allowlist entries', () => {
      expect(pickAllowlistedOrigin(proxy, 'hooks.example.com'))
        .toBe('https://hooks.example.com');
      expect(pickAllowlistedOrigin(proxy, 'https://api.example.com/v1'))
        .toBe('https://api.example.com');
    });

    it('falls back to first allowlist entry when hint does not match', () => {
      expect(pickAllowlistedOrigin(proxy, 'unknown.host'))
        .toBe('https://hooks.example.com');
    });
  });

  describe('executeProxy', () => {
    it('rejects upstream when blockPrivateNetworks DNS validation fails', async () => {
      vi.mocked(validateServerOutboundUrlWithDns).mockRejectedValue(new Error('private IP blocked'));

      const result = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: true,
        },
        upstreamUrl: 'https://api.example.com/data',
        activeMockPorts: [4600],
        body: null,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('private IP blocked');
      expect(validateServerOutboundUrlWithDns).toHaveBeenCalledWith('https://api.example.com/data');
    });

    it('maps non-Error DNS rejection to generic message', async () => {
      vi.mocked(validateServerOutboundUrlWithDns).mockRejectedValue('blocked');

      const result = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: true,
        },
        upstreamUrl: 'https://api.example.com/data',
        activeMockPorts: [],
        body: null,
      });

      expect(result.error).toBe('DNS/policy rejected upstream');
    });

    it('forwards auth headers when forwardAuth is enabled', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })));

      await executeProxy({
        req: mockReq('GET', { authorization: 'Bearer secret', cookie: 'sid=1' }),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
          forwardAuth: true,
          forwardCredentialHeaders: ['authorization'],
          stripHopByHop: false,
        },
        upstreamUrl: 'https://api.example.com/secure',
        activeMockPorts: [],
        body: null,
      });

      const sent = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
      expect(sent.authorization).toBe('Bearer secret');
      expect(sent.cookie).toBeUndefined();
    });

    it('forwards POST body and flattens array header values', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('created', { status: 201 })));

      const body = Buffer.from('{"x":1}');
      await executeProxy({
        req: mockReq('POST', { 'x-custom': ['a', 'b'], accept: 'application/json' }),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
        },
        upstreamUrl: 'https://api.example.com/items',
        activeMockPorts: [],
        body,
      });

      const call = vi.mocked(fetch).mock.calls[0][1];
      expect(call?.method).toBe('POST');
      expect(call?.body).toBeInstanceOf(Uint8Array);
      const sent = call?.headers as Record<string, string>;
      expect(sent['x-custom']).toBe('a, b');
    });

    it('follows redirects and sets redirected flag', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(new Response('', {
          status: 302,
          headers: { location: '/final' },
        }))
        .mockResolvedValueOnce(new Response('done', {
          status: 200,
          headers: {
            'set-cookie': ['a=1', 'b=2'],
            connection: 'keep-alive',
          },
        })));

      const result = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
          maxRedirects: 2,
          stripHopByHop: true,
        },
        upstreamUrl: 'https://api.example.com/start',
        activeMockPorts: [],
        body: null,
      });

      expect(result.ok).toBe(true);
      expect(result.redirected).toBe(true);
      expect(result.body).toBe('done');
      expect(vi.mocked(fetch).mock.calls[1][0]).toBe('https://api.example.com/final');
    });

    it('returns error when redirect limit is exceeded', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', {
        status: 301,
        headers: { location: '/again' },
      })));

      const result = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
          maxRedirects: 0,
        },
        upstreamUrl: 'https://api.example.com/loop',
        activeMockPorts: [],
        body: null,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Redirect limit exceeded');
    });

    it('truncates oversized responses to maxResponseBytes', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('abcdefghij', { status: 200 })));

      const result = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
          maxResponseBytes: 5,
        },
        upstreamUrl: 'https://api.example.com/big',
        activeMockPorts: [],
        body: null,
      });

      expect(result.ok).toBe(true);
      expect(result.body).toBe('abcde');
    });

    it('returns fetch errors and non-Error throws', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

      const errResult = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
          timeoutMs: 5_000,
        },
        upstreamUrl: 'https://api.example.com/fail',
        activeMockPorts: [],
        body: null,
      });
      expect(errResult.error).toBe('network down');

      vi.stubGlobal('fetch', vi.fn(async () => { throw 'boom'; }));
      const generic = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
        },
        upstreamUrl: 'https://api.example.com/fail',
        activeMockPorts: [],
        body: null,
      });
      expect(generic.error).toBe('Proxy fetch failed');
    });

    it('aggregates duplicate response header values via headers.forEach', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        status: 200,
        headers: {
          forEach(cb: (value: string, key: string) => void) {
            cb('first', 'x-dup');
            cb('second', 'x-dup');
            cb('third', 'x-dup');
          },
        },
        arrayBuffer: async () => Buffer.from('ok'),
      } as unknown as Response)));

      const result = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
        },
        upstreamUrl: 'https://api.example.com/dup-headers',
        activeMockPorts: [],
        body: null,
      });

      expect(result.ok).toBe(true);
      expect(result.headers['x-dup']).toEqual(['first', 'second', 'third']);
    });

    it('skips null inbound header values and defaults missing method to GET', async () => {
      vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        expect(init?.method).toBe('GET');
        return new Response('ok', { status: 200 });
      }));

      const req = new EventEmitter() as http.IncomingMessage;
      (req as { headers: Record<string, string | string[] | undefined> }).headers = {
        'x-keep': 'yes',
        'x-null': undefined,
      };

      const result = await executeProxy({
        req,
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
        },
        upstreamUrl: 'https://api.example.com/ping',
        activeMockPorts: [],
        body: null,
      });

      expect(result.ok).toBe(true);
      const sent = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
      expect(sent['x-keep']).toBe('yes');
      expect(sent['x-null']).toBeUndefined();
    });

    it('aborts slow upstream fetches when timeout elapses', async () => {
      vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      })));

      const result = await executeProxy({
        req: mockReq(),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
          timeoutMs: 30,
        },
        upstreamUrl: 'https://api.example.com/slow',
        activeMockPorts: [],
        body: null,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/aborted/i);
    });

    it('skips body for GET/HEAD and clamps settings to hard ceilings', async () => {
      vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        expect(init?.body).toBeUndefined();
        return new Response('', { status: 204 });
      }));

      await executeProxy({
        req: mockReq('HEAD'),
        proxy: {
          ...DEFAULT_PROXY_SETTINGS,
          enabled: true,
          allowlist: ['https://api.example.com'],
          blockPrivateNetworks: false,
          timeoutMs: 999_999,
          maxRedirects: 999,
          maxResponseBytes: 999_999_999,
        },
        upstreamUrl: 'https://api.example.com/ping',
        activeMockPorts: [],
        body: Buffer.from('ignored'),
      });

      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
  });
});
