import { describe, expect, it, vi, afterEach } from 'vitest';
import { executeCallback, executeCallbacks } from './apiMockCallbackExecutor';
import type { ApiMockCallbackV1 } from '../../src/shared/api-mock/callbackContracts';

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

describe('executeCallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects URLs not on the allowlist', async () => {
    const result = await executeCallback({
      callback: makeCb(),
      settings: { allowlist: ['https://other.example.com/x'] },
      activeMockPorts: [4600],
      blockPrivateNetworks: false,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/allowlist/i);
  });

  it('succeeds on 2xx without mutating caller state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })));
    const result = await executeCallback({
      callback: makeCb(),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [4600],
      blockPrivateNetworks: false,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
      'x-redfireforge-mock': 'true',
    });
  });

  it('retries on failure then returns error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 500 })));
    const result = await executeCallback({
      callback: makeCb({ maxRetries: 1, timeoutMs: 100 }),
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [4600],
      blockPrivateNetworks: false,
    });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
  }, 15_000);

  it('executeCallbacks runs enabled callbacks only', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
    const results = await executeCallbacks({
      callbacks: [makeCb({ id: 'a' }), makeCb({ id: 'b', enabled: false })],
      settings: { allowlist: ['https://hooks.example.com/event'] },
      activeMockPorts: [],
      blockPrivateNetworks: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0].callbackId).toBe('a');
  });
});
