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
});

type Envelope = { ok: true; data: unknown } | { ok: false; error: { code?: string; message?: string } };
