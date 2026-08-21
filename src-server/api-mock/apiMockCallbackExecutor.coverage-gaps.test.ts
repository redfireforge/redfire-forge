import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeCallback, executeCallbacks } from './apiMockCallbackExecutor';
import type { ApiMockCallbackV1 } from '../../src/shared/api-mock/callbackContracts';
import type { ApiMockTemplateContextV1 } from '../../src/shared/api-mock/contracts';
import { CALLBACK_HARD_CEILINGS } from '../../src/shared/api-mock/callbackContracts';

vi.mock('../grpc/serverOutboundUrlPolicy.js', () => ({
  validateServerOutboundUrlWithDns: vi.fn(async () => undefined),
}));

import { validateServerOutboundUrlWithDns } from '../grpc/serverOutboundUrlPolicy.js';

function makeCb(overrides: Partial<ApiMockCallbackV1> = {}): ApiMockCallbackV1 {
  return {
    id: 'cb1',
    enabled: true,
    url: 'https://hooks.example.com/event',
    method: 'POST',
    headers: [],
    bodyTemplate: '{"ok":true}',
    timeoutMs: 5_000,
    maxRetries: 0,
    ...overrides,
  };
}

const ctx: ApiMockTemplateContextV1 = {
  request: {
    method: 'GET',
    path: '/users/1',
    pathParams: {},
    query: {},
    headers: {},
    cookies: {},
    body: null,
    rawBody: '',
  },
  state: {},
  variables: { token: 'abc' },
  counters: {},
  now: '2026-08-13T00:00:00.000Z',
  seed: 'seed',
};

describe('apiMockCallbackExecutor coverage gaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.mocked(validateServerOutboundUrlWithDns).mockReset();
    vi.mocked(validateServerOutboundUrlWithDns).mockResolvedValue(undefined);
  });

  it('returns early for disabled callback and empty URL', async () => {
    expect(await executeCallback({
      callback: makeCb({ enabled: false }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
    })).toMatchObject({ ok: false, error: 'disabled', attempts: 0 });

    expect(await executeCallback({
      callback: makeCb({ url: '   ' }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
    })).toMatchObject({ ok: false, error: 'empty url' });
  });

  it('rejects oversized callback bodies', async () => {
    const huge = 'x'.repeat(CALLBACK_HARD_CEILINGS.maxBodyBytes + 1);
    const result = await executeCallback({
      callback: makeCb({ bodyTemplate: huge }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
    });
    expect(result.error).toBe('Callback body exceeds ceiling');
  });

  it('blocks callback URLs rejected by proxy policy', async () => {
    const result = await executeCallback({
      callback: makeCb({ url: 'http://169.254.169.254/meta' }),
      settings: { allowlist: ['http://169.254.169.254/meta'] },
      activeMockPorts: [4600],
      blockPrivateNetworks: false,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects URLs when blockPrivateNetworks DNS validation fails', async () => {
    vi.mocked(validateServerOutboundUrlWithDns).mockRejectedValue(new Error('private network'));

    const errResult = await executeCallback({
      callback: makeCb(),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: true,
    });
    expect(errResult.error).toBe('private network');

    vi.mocked(validateServerOutboundUrlWithDns).mockRejectedValue('blocked');
    const generic = await executeCallback({
      callback: makeCb(),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
    });
    expect(generic.error).toBe('DNS/policy rejected callback URL');
  });

  it('skips DNS validation when blockPrivateNetworks is false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 204 })));
    await executeCallback({
      callback: makeCb(),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
    });
    expect(validateServerOutboundUrlWithDns).not.toHaveBeenCalled();
  });

  it('renders body and header templates from context', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      expect(init?.body).toContain('/users/1');
      const headers = init?.headers as Record<string, string>;
      expect(headers['x-token']).toBe('abc');
      expect(headers['x-static']).toBe('plain');
      return new Response('', { status: 200 });
    }));

    await executeCallback({
      callback: makeCb({
        bodyTemplate: '{"path":"{{request.path}}"}',
        headers: [
          { id: '1', key: 'x-token', value: '{{variables.token}}', enabled: true },
          { id: '2', key: 'x-static', value: 'plain', enabled: true },
          { id: '3', key: '', value: 'skip', enabled: true },
          { id: '4', key: 'x-off', value: 'off', enabled: false },
        ],
      }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
      ctx,
    });
  });

  it('keeps templates when renderTemplate throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      expect(init?.body).toBe('{{bad.template');
      const headers = init?.headers as Record<string, string>;
      expect(headers['x-bad']).toBe('{{also.bad');
      return new Response('', { status: 200 });
    }));

    await executeCallback({
      callback: makeCb({
        bodyTemplate: '{{bad.template',
        headers: [{ id: '1', key: 'x-bad', value: '{{also.bad', enabled: true }],
      }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
      ctx,
    });
  });

  it('uses plain bodyTemplate when context is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      expect(init?.body).toBe('{"plain":true}');
      return new Response('', { status: 200 });
    }));

    await executeCallback({
      callback: makeCb({ bodyTemplate: '{"plain":true}' }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
    });
  });

  it('records non-Error fetch failures and abort timeouts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw 'boom'; }));
    const generic = await executeCallback({
      callback: makeCb({ maxRetries: 0 }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
    });
    expect(generic.error).toBe('callback fetch failed');

    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted', 'AbortError'));
      });
    })));
    const aborted = await executeCallback({
      callback: makeCb({ timeoutMs: 30, maxRetries: 0 }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
    });
    expect(aborted.error).toMatch(/aborted/i);
  });

  it('waits between retries with exponential backoff', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));

    const pending = executeCallback({
      callback: makeCb({ maxRetries: 1, timeoutMs: 100 }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.error).toBe('HTTP 503');
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
  });

  it('executeCallbacks handles undefined callbacks and multiple enabled entries', async () => {
    expect(await executeCallbacks({
      callbacks: undefined,
      settings: { allowlist: [] },
      activeMockPorts: [],
    })).toEqual([]);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
    const results = await executeCallbacks({
      callbacks: [
        makeCb({ id: 'a' }),
        makeCb({ id: 'b', enabled: false }),
        makeCb({ id: 'c', url: 'https://hooks.example.com/other' }),
      ],
      settings: { allowlist: ['https://hooks.example.com/event', 'https://hooks.example.com/other'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
    });
    expect(results.map(r => r.callbackId)).toEqual(['a', 'c']);
  });
});
