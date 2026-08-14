/**
 * API Mock Studio — control client tests. Verifies success mapping and that
 * failures (server error codes, companion down, proxy 502) become classified
 * RuntimeDiagnostics.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTauri } from '../../shared/utils/platform';
import { apiMockControlClient } from './apiMockControlClient';
import { setNativeInvokeForTests } from '../../shared/api-mock/nativeTauriControl';
import { DEFAULT_SETTINGS, HARD_CEILINGS } from '../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';

vi.mock('../../shared/utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/utils/platform')>();
  return { ...actual, isTauri: vi.fn(() => false) };
});

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

  it('maps companion 404 NOT_RUNNING to a non-retrying runtime error', async () => {
    mockFetch(() => ({
      ok: false,
      status: 404,
      json: async () => ({ ok: false, error: { code: 'NOT_RUNNING', message: 'Server "srv-1" is not running' } }),
    }));
    const res = await apiMockControlClient.state('srv-1');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('MOCK_RUNTIME_ERROR');
      expect(res.error.retry).toBe(false);
    }
  });

  it('maps a bare HTTP 404 to a non-retrying runtime error', async () => {
    mockFetch(() => ({ ok: false, status: 404, json: async () => null }));
    const res = await apiMockControlClient.transactions('srv-gone');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.retry).toBe(false);
    }
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
      { ok: true, data: { transactions: [], cursor: 1, total: 0, capped: false } },
      { ok: true, data: { cleared: true } },
      { ok: true, data: { states: { default: 'done' }, counters: { hits: 2 } } },
      { ok: true, data: { reset: true } },
    ];
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => payloads.shift() } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const tx = await apiMockControlClient.transactions('srv-1', 25);
    const txDefault = await apiMockControlClient.transactions('srv-1');
    const clear = await apiMockControlClient.clearTransactions('srv-1');
    const state = await apiMockControlClient.state('srv-1');
    const reset = await apiMockControlClient.resetState('srv-1');

    expect(tx.ok && tx.data.cursor).toBe(1);
    expect(txDefault.ok).toBe(true);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(`limit=${HARD_CEILINGS.maxJournalEntries}`);
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

  it('maps known runtime error codes with retry disabled except companion unavailable', async () => {
    mockFetch(() => ({ ok: false, status: 409, json: async () => ({ ok: false, error: { code: 'MOCK_PORT_OWNED', message: 'Port owned elsewhere.' } }) }));
    const owned = await apiMockControlClient.start(def);
    expect(owned.ok).toBe(false);
    if (!owned.ok) {
      expect(owned.error.code).toBe('MOCK_PORT_OWNED');
      expect(owned.error.retry).toBe(false);
    }

    mockFetch(() => ({ ok: false, status: 400, json: async () => ({ ok: false, error: { code: 'MOCK_VALIDATION_ERROR', message: 'Bad definition.' } }) }));
    const invalid = await apiMockControlClient.commit(def);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe('MOCK_VALIDATION_ERROR');
  });

  it('calls tls and recorded draft endpoints successfully', async () => {
    const payloads = [
      { ok: true, data: { certPem: 'CERT', keyPem: 'KEY' } },
      { ok: true, data: { caCertPem: 'CA', clientCertPem: 'CC', clientKeyPem: 'CK', commonName: 'mock' } },
      { ok: true, data: { drafts: [{ id: 'd1' }], total: 1 } },
      { ok: true, data: { removed: 1 } },
      { ok: true, data: { cleared: true } },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => payloads.shift() } as unknown as Response)));

    const tls = await apiMockControlClient.generateSelfSignedTls(['localhost']);
    const creds = await apiMockControlClient.generateClientCredentials('mock-client');
    const drafts = await apiMockControlClient.recordedDrafts('srv-1');
    const ack = await apiMockControlClient.ackRecordedDrafts('srv-1', ['d1']);
    const cleared = await apiMockControlClient.clearRecordedDrafts('srv-1');

    expect(tls.ok && tls.data.certPem).toBe('CERT');
    expect(creds.ok && creds.data.commonName).toBe('mock');
    expect(drafts.ok && drafts.data.total).toBe(1);
    expect(ack.ok && ack.data.removed).toBe(1);
    expect(cleared.ok && cleared.data.cleared).toBe(true);
  });

  it('uses generic failure message for non-502 errors without body', async () => {
    mockFetch(() => ({ ok: false, status: 400, json: async () => null }));
    const res = await apiMockControlClient.status('srv-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('Request failed (400)');
  });

  it('maps diagnostics counters', async () => {
    mockFetch(() => ({
      ok: true, status: 200,
      json: async () => ({
        ok: true,
        data: {
          generation: 3, routeCount: 2, predicateCount: 4, openConnections: 1, inFlight: 0,
          matchDuration: { lastMs: 2, p95Ms: 4, count: 10 },
          outcomes: { matched: 8, unmatched: 2, ambiguous: 0, fault: 0, error: 0, proxied: 0 },
          journal: { drops: 1, truncations: 0, size: 10, maxEntries: 500 },
          templateErrors: 0,
        },
      }),
    }));
    const res = await apiMockControlClient.diagnostics('srv-1');
    expect(res.ok && res.data.journal.drops).toBe(1);
  });
});

describe('apiMockControlClient native Tauri path', () => {
  it('invokes native start instead of fetch when isTauri is true', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    setNativeInvokeForTests(async (cmd) => {
      expect(cmd).toBe('api_mock_listener_start');
      return { ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 9 } };
    });
    const res = await apiMockControlClient.start(def);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.generation).toBe(9);
    setNativeInvokeForTests(undefined);
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('routes remaining listener methods through native invoke', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const seen: string[] = [];
    setNativeInvokeForTests(async (cmd) => {
      seen.push(cmd);
      return { ok: true, data: { serverId: 'srv-1', port: 4600, state: 'stopped', generation: 1, cleared: true, reset: true, transactions: [], cursor: 0, total: 0, capped: false, states: {}, counters: {}, routeCount: 0, predicateCount: 0, openConnections: 0, inFlight: 0, matchDuration: { lastMs: 0, p95Ms: 0, count: 0 }, outcomes: { matched: 0, unmatched: 0, ambiguous: 0, fault: 0, error: 0, proxied: 0 }, journal: { drops: 0, truncations: 0, size: 0, maxEntries: 500 }, templateErrors: 0, captures: [], drafts: [], removed: 0 } };
    });
    expect((await apiMockControlClient.stop('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.restart(def)).ok).toBe(true);
    expect((await apiMockControlClient.commit(def)).ok).toBe(true);
    expect((await apiMockControlClient.status('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.transactions('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.clearTransactions('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.state('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.resetState('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.diagnostics('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.recordedDrafts('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.ackRecordedDrafts('srv-1', ['d1'])).ok).toBe(true);
    expect((await apiMockControlClient.clearRecordedDrafts('srv-1')).ok).toBe(true);
    expect((await apiMockControlClient.nextAutoPort([4600])).ok).toBe(true);
    expect((await apiMockControlClient.probePort(4610)).ok).toBe(true);
    expect(seen).toContain('api_mock_listener_stop');
    expect(seen).toContain('api_mock_listener_diagnostics');
    expect(seen).toContain('api_mock_listener_recorded_drafts');
    expect(seen).toContain('api_mock_listener_recorded_drafts_ack');
    expect(seen).toContain('api_mock_listener_recorded_drafts_clear');
    expect(seen).toContain('api_mock_ports_next');
    expect(seen).toContain('api_mock_ports_probe');
    setNativeInvokeForTests(undefined);
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('maps web nextAutoPort and falls back to probe walk', async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { port: 4605 } }),
    }));
    const direct = await apiMockControlClient.nextAutoPort([4600]);
    expect(direct.ok && direct.data.port).toBe(4605);

    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      calls += 1;
      if (url.includes('/ports/next')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'missing' } }),
        } as unknown as Response;
      }
      // probe: first free at 4601
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { port: 4601, available: true } }),
      } as unknown as Response;
    }));
    const fallback = await apiMockControlClient.nextAutoPort([4600]);
    expect(fallback.ok && fallback.data.port).toBe(4601);
    expect(calls).toBeGreaterThan(1);

    let probes = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
      if (String(input).includes('/ports/next')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: false, error: { code: 'BACKEND_UNREACHABLE', message: 'down' } }),
        } as unknown as Response;
      }
      probes += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { port: 4602, available: true } }),
      } as unknown as Response;
    }));
    const local = await apiMockControlClient.nextAutoPort([4600]);
    expect(local.ok && local.data.port).toBe(4601);
    expect(probes).toBe(0);

    const probe = await apiMockControlClient.probePort(4611);
    // last stub still active — probe uses /ports/probe
    expect(probe.ok).toBe(true);
  });
});
