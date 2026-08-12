/**
 * API Mock Studio — control client tests. Verifies success mapping and that
 * failures (server error codes, companion down, proxy 502) become classified
 * RuntimeDiagnostics.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiMockControlClient } from './apiMockControlClient';
import { DEFAULT_SETTINGS } from '../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';
const def: ApiMockServerDefinitionV1 = {
  id: 'srv-1', name: 'S', enabled: true, host: '127.0.0.1', port: 4600, basePath: '',
  folders: [], variables: [], samples: [], routes: [],
  settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
};

function mockFetch(impl: () => Partial<Response> & { json: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn(async () => impl() as unknown as Response));
}

afterEach(() => vi.unstubAllGlobals());

describe('apiMockControlClient', () => {
  it('maps a successful start envelope', async () => {
    mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 1 } }) }));
    const res = await apiMockControlClient.start(def);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.generation).toBe(1);
  });

  it('classifies a server port-in-use error', async () => {
    mockFetch(() => ({ ok: false, status: 409, json: async () => ({ ok: false, error: { code: 'MOCK_PORT_IN_USE', message: 'The selected port is already in use.' } }) }));
    const res = await apiMockControlClient.start(def);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MOCK_PORT_IN_USE');
  });

  it('classifies a transport failure as companion unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('fetch failed'); }));
    const res = await apiMockControlClient.start(def);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('COMPANION_UNAVAILABLE');
      expect(res.error.retry).toBe(true);
    }
  });

  it('treats a proxy 502 as companion unavailable', async () => {
    mockFetch(() => ({ ok: false, status: 502, json: async () => null }));
    const res = await apiMockControlClient.stop('srv-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('COMPANION_UNAVAILABLE');
  });

  it('maps the Vite dev-proxy BACKEND_UNREACHABLE code to companion unavailable', async () => {
    mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: false, error: { code: 'BACKEND_UNREACHABLE', message: 'Backend server is not running on localhost:3001. Start it with npm run server:dev.' } }) }));
    const res = await apiMockControlClient.start(def);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('COMPANION_UNAVAILABLE');
      expect(res.error.retry).toBe(true);
    }
  });

  it('calls restart, commit, and status endpoints successfully', async () => {
    mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 2 } }) }));

    const restart = await apiMockControlClient.restart(def);
    const commit = await apiMockControlClient.commit(def);
    const status = await apiMockControlClient.status('srv-1');

    expect(restart.ok && restart.data.generation).toBe(2);
    expect(commit.ok && commit.data.generation).toBe(2);
    expect(status.ok && status.data.serverId).toBe('srv-1');
  });

  it('calls transactions, clearTransactions, state, and resetState endpoints successfully', async () => {
    const payloads = [
      { ok: true, data: { transactions: [], cursor: 1, total: 0, capped: false } },
      { ok: true, data: { cleared: true } },
      { ok: true, data: { states: { default: 'done' }, counters: { hits: 2 } } },
      { ok: true, data: { reset: true } },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => payloads.shift() } as unknown as Response)));

    const tx = await apiMockControlClient.transactions('srv-1', 25);
    const clear = await apiMockControlClient.clearTransactions('srv-1');
    const state = await apiMockControlClient.state('srv-1');
    const reset = await apiMockControlClient.resetState('srv-1');

    expect(tx.ok && tx.data.cursor).toBe(1);
    expect(clear.ok && clear.data.cleared).toBe(true);
    expect(state.ok && state.data.counters.hits).toBe(2);
    expect(reset.ok && reset.data.reset).toBe(true);
  });

  it('falls back through classifyRuntimeError for unknown server error codes', async () => {
    mockFetch(() => ({ ok: false, status: 409, json: async () => ({ ok: false, error: { code: 'SOMETHING_ELSE', message: 'network error' } }) }));
    const res = await apiMockControlClient.start(def);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('COMPANION_UNAVAILABLE');
  });

  it('handles non-json 503 responses as companion unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => { throw new Error('bad json'); },
    } as unknown as Response)));

    const res = await apiMockControlClient.stop('srv-1');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('COMPANION_UNAVAILABLE');
      expect(res.error.message).toMatch(/not reachable/i);
    }
  });
});
