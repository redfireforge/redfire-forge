import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeTauriControl, setNativeInvokeForTests } from './nativeTauriControl';
import { DEFAULT_SETTINGS } from './defaults';
import type { ApiMockServerDefinitionV1 } from './contracts';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const ts = '2026-08-13T00:00:00.000Z';
const def: ApiMockServerDefinitionV1 = {
  id: 'srv-1', name: 'S', enabled: true, host: '127.0.0.1', port: 4600, basePath: '',
  folders: [], variables: [], samples: [], routes: [],
  settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
};

afterEach(() => setNativeInvokeForTests(undefined));

describe('nativeTauriControl', () => {
  it('maps a successful start envelope', async () => {
    setNativeInvokeForTests(async (cmd, args) => {
      expect(cmd).toBe('api_mock_listener_start');
      expect(args?.definition).toEqual(def);
      return { ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 1 } };
    });
    const res = await nativeTauriControl.start(def);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.generation).toBe(1);
  });

  it('maps MOCK_PORT_IN_USE from the native envelope', async () => {
    setNativeInvokeForTests(async () => ({
      ok: false as const,
      error: { code: 'MOCK_PORT_IN_USE', message: 'listen EADDRINUSE' },
    }));
    const res = await nativeTauriControl.start(def);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('MOCK_PORT_IN_USE');
      expect(res.error.retry).toBe(false);
    }
  });

  it('classifies thrown invoke failures', async () => {
    setNativeInvokeForTests(async () => { throw new Error('fetch failed'); });
    const res = await nativeTauriControl.stop('srv-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('COMPANION_UNAVAILABLE');
  });

  it('invokes commit, status, journal, state, and diagnostics', async () => {
    const seen: string[] = [];
    setNativeInvokeForTests(async (cmd) => {
      seen.push(cmd);
      if (cmd.includes('transactions_query')) {
        return { ok: true, data: { transactions: [], cursor: 0, total: 0, capped: false } };
      }
      if (cmd.includes('diagnostics')) {
        return { ok: true, data: { generation: 1, routeCount: 0, predicateCount: 0, openConnections: 0, inFlight: 0, matchDuration: { lastMs: 0, p95Ms: 0, count: 0 }, outcomes: { matched: 0, unmatched: 0, ambiguous: 0, fault: 0, error: 0, proxied: 0 }, journal: { drops: 0, truncations: 0, size: 0, maxEntries: 500 }, templateErrors: 0 } };
      }
      if (cmd.includes('state') && !cmd.includes('reset')) {
        return { ok: true, data: { states: {}, counters: {} } };
      }
      return { ok: true, data: { serverId: 'srv-1', port: 4600, state: 'running', generation: 2, cleared: true, reset: true } };
    });
    expect((await nativeTauriControl.commit(def)).ok).toBe(true);
    expect((await nativeTauriControl.status('srv-1')).ok).toBe(true);
    expect((await nativeTauriControl.transactions('srv-1', 10)).ok).toBe(true);
    expect((await nativeTauriControl.clearTransactions('srv-1')).ok).toBe(true);
    expect((await nativeTauriControl.state('srv-1')).ok).toBe(true);
    expect((await nativeTauriControl.resetState('srv-1')).ok).toBe(true);
    expect((await nativeTauriControl.diagnostics('srv-1')).ok).toBe(true);
    expect((await nativeTauriControl.restart(def)).ok).toBe(true);
    expect(seen).toContain('api_mock_listener_commit');
    expect(seen).toContain('api_mock_listener_diagnostics');
  });

  it('treats a null envelope as a classified failure', async () => {
    setNativeInvokeForTests(async () => null as unknown as Envelope);
    const res = await nativeTauriControl.status('srv-1');
    expect(res.ok).toBe(false);
  });

  it('uses the fallback message when the error body has no message', async () => {
    setNativeInvokeForTests(async () => ({ ok: false as const, error: { code: 'MOCK_VALIDATION_ERROR' } }));
    const res = await nativeTauriControl.commit(def);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('MOCK_VALIDATION_ERROR');
      expect(res.error.message).toMatch(/api_mock_listener_commit/);
    }
  });

  it('marks COMPANION_UNAVAILABLE as retryable', async () => {
    setNativeInvokeForTests(async () => ({
      ok: false as const,
      error: { code: 'COMPANION_UNAVAILABLE', message: 'down' },
    }));
    const res = await nativeTauriControl.diagnostics('srv-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.retry).toBe(true);
  });

  it('loads invoke from @tauri-apps/api/core when no test override is set', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValue({ ok: true, data: { reset: true } });
    const res = await nativeTauriControl.resetState('srv-1');
    expect(res.ok).toBe(true);
    expect(invoke).toHaveBeenCalled();
  });

  it('falls through classifyRuntimeError for unknown envelope codes', async () => {
    setNativeInvokeForTests(async () => ({ ok: false as const, error: { code: 'NOPE', message: 'network error' } }));
    const res = await nativeTauriControl.status('srv-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('COMPANION_UNAVAILABLE');
  });

  it('converts native recorded captures into Studio drafts and acks by id', async () => {
    const seen: string[] = [];
    setNativeInvokeForTests(async (cmd, args) => {
      seen.push(cmd);
      if (cmd === 'api_mock_listener_recorded_drafts') {
        return {
          ok: true,
          data: {
            captures: [{
              id: 'rec-keep-me',
              fingerprint: 'GET /users/1 → 200',
              recordedAt: ts,
              request: {
                method: 'GET', path: '/users/1', rawPath: '/users/1',
                headers: { accept: ['application/json'] }, query: {}, cookies: {},
                body: null, bodyTruncated: false, receivedAt: ts,
              },
              response: { status: 200, headers: { 'content-type': 'application/json' }, body: '{"id":1}' },
              redaction: DEFAULT_SETTINGS.redaction,
            }],
            total: 1,
          },
        };
      }
      if (cmd === 'api_mock_listener_recorded_drafts_ack') {
        expect(args?.ids).toEqual(['rec-keep-me']);
        return { ok: true, data: { removed: 1 } };
      }
      return { ok: true, data: { cleared: true } };
    });
    const listed = await nativeTauriControl.recordedDrafts('srv-1');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.total).toBe(1);
      expect(listed.data.drafts[0]?.id).toBe('rec-keep-me');
      expect(listed.data.drafts[0]?.route.enabled).toBe(false);
    }
    const ack = await nativeTauriControl.ackRecordedDrafts('srv-1', ['rec-keep-me']);
    expect(ack.ok && ack.data.removed).toBe(1);
    const cleared = await nativeTauriControl.clearRecordedDrafts('srv-1');
    expect(cleared.ok && cleared.data.cleared).toBe(true);
    expect(seen).toEqual([
      'api_mock_listener_recorded_drafts',
      'api_mock_listener_recorded_drafts_ack',
      'api_mock_listener_recorded_drafts_clear',
    ]);
  });

  it('acks captures that cannot be converted so they do not block the fingerprint', async () => {
    const seen: Array<{ cmd: string; ids?: unknown }> = [];
    setNativeInvokeForTests(async (cmd, args) => {
      seen.push({ cmd, ids: args?.ids });
      if (cmd === 'api_mock_listener_recorded_drafts') {
        return {
          ok: true,
          data: {
            captures: [
              { id: 'rec-bad' },
              {
                id: 'rec-good',
                fingerprint: 'GET /users/1 → 200',
                recordedAt: ts,
                request: {
                  method: 'GET', path: '/users/1', rawPath: '/users/1',
                  headers: { accept: ['application/json'] }, query: {}, cookies: {},
                  body: null, bodyTruncated: false, receivedAt: ts,
                },
                response: { status: 200, headers: { 'content-type': 'application/json' }, body: '{}' },
              },
            ],
            total: 2,
          },
        };
      }
      return { ok: true, data: { removed: 1 } };
    });
    const listed = await nativeTauriControl.recordedDrafts('srv-1');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.drafts.map(d => d.id)).toEqual(['rec-good']);
      expect(listed.data.total).toBe(1);
    }
    expect(seen).toEqual([
      { cmd: 'api_mock_listener_recorded_drafts', ids: undefined },
      { cmd: 'api_mock_listener_recorded_drafts_ack', ids: ['rec-bad'] },
    ]);
  });

  it('forwards recorded-drafts invoke failures without converting', async () => {
    setNativeInvokeForTests(async () => ({
      ok: false as const,
      error: { code: 'COMPANION_UNAVAILABLE', message: 'down' },
    }));
    const res = await nativeTauriControl.recordedDrafts('srv-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.retry).toBe(true);
  });

  it('invokes ports_next and ports_probe', async () => {
    const seen: string[] = [];
    setNativeInvokeForTests(async (cmd, args) => {
      seen.push(cmd);
      if (cmd === 'api_mock_ports_next') {
        expect(args?.exclude).toEqual([4600]);
        return { ok: true, data: { port: 4601 } };
      }
      expect(args?.port).toBe(4610);
      return { ok: true, data: { port: 4610, available: false } };
    });
    const next = await nativeTauriControl.nextAutoPort([4600]);
    expect(next.ok && next.data.port).toBe(4601);
    const probe = await nativeTauriControl.probePort(4610);
    expect(probe.ok && probe.data.available).toBe(false);
    expect(seen).toEqual(['api_mock_ports_next', 'api_mock_ports_probe']);
  });
});

type Envelope = { ok: true; data: unknown } | { ok: false; error: { code?: string; message?: string } };
