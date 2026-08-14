/**
 * API Mock Studio — Phase 12A performance & resource tests (server side).
 *
 * Covers journal append throughput at cap, journal memory ceiling, ring-buffer
 * ordering under churn, and no-leak lifecycle for eight concurrent servers.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ApiMockTransactionJournal } from './ApiMockTransactionJournal';
import { ApiMockServerPool } from './ApiMockServerPool';
import { isPortAvailable } from './ApiMockNetworkListener';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import { API_MOCK_PERF_BUDGETS, PERF_CI_SLACK, percentile } from '../../src/shared/api-mock/perfBudgets';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeTx(path = '/test'): ApiMockTransactionV1 {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    serverId: 'srv-1', generation: 1, receivedAt: ts,
    request: {
      method: 'GET', path, rawPath: path, query: {}, cookies: {},
      headers: { authorization: ['Bearer secret-token'] },
      body: null, bodyTruncated: false, receivedAt: ts,
    },
    outcome: 'matched', matchedRouteId: 'r1',
    explanation: {
      normalizedRequest: { method: 'GET', path, decodedPath: path, pathSegments: [path.slice(1)], query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0 },
      candidates: [], policyDecision: { policy: 'highest_priority', equalPriorityPolicy: 'reject', matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched' },
      nearMisses: [],
    },
  };
}

describe('journal performance & memory ceiling', () => {
  it('append at cap stays within per-op budget and bounded memory', () => {
    const journal = new ApiMockTransactionJournal({
      ...DEFAULT_SETTINGS,
      journal: { ...DEFAULT_SETTINGS.journal, maxEntries: 500 },
    });
    const tx = makeTx();
    for (let i = 0; i < 500; i++) journal.append(tx); // fill to cap (warmup)

    const iterations = 20_000;
    const samples = new Array<number>(iterations);
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      journal.append(tx);
      samples[i] = performance.now() - t0;
    }

    const p95 = percentile(samples, 95);
    console.log(`[perf] journal append: p95=${p95.toFixed(4)}ms budget=${API_MOCK_PERF_BUDGETS.journalAppend.p95Ms}ms`);
    expect(journal.size()).toBe(500); // memory ceiling: never grows past cap
    expect(p95).toBeLessThan(API_MOCK_PERF_BUDGETS.journalAppend.p95Ms * PERF_CI_SLACK);
  });

  it('ring buffer preserves insertion order and drops oldest', () => {
    const journal = new ApiMockTransactionJournal({
      ...DEFAULT_SETTINGS,
      journal: { ...DEFAULT_SETTINGS.journal, maxEntries: 3 },
    });
    for (let i = 0; i < 10; i++) journal.append(makeTx(`/p${i}`));
    const paths = journal.getAll().map(t => t.request.path);
    expect(paths).toEqual(['/p7', '/p8', '/p9']);
  });

  it('a zero-cap journal stores nothing but still advances cursor', () => {
    const journal = new ApiMockTransactionJournal({
      ...DEFAULT_SETTINGS,
      journal: { ...DEFAULT_SETTINGS.journal, maxEntries: 0 },
    });
    const c1 = journal.append(makeTx());
    const c2 = journal.append(makeTx());
    expect(journal.size()).toBe(0);
    expect(c2).toBeGreaterThan(c1);
    expect(journal.query().capped).toBe(false);
  });
});

describe('pool no-leak lifecycle (eight servers)', () => {
  let pool: ApiMockServerPool;
  let ports: number[] = [];

  afterEach(async () => {
    if (pool) await pool.stopAllAsync();
  });

  function makeDef(id: string, port: number): ApiMockServerDefinitionV1 {
    return {
      id, name: `Server ${id}`, enabled: true, host: '127.0.0.1',
      port, basePath: '', folders: [], variables: [], samples: [],
      routes: [{
        id: 'r1', name: 'Route', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/test' }, priority: 10,
        predicates: { id: 'pg', combinator: 'all', children: [] },
        responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
        tags: [], createdAt: ts, updatedAt: ts,
      }],
      settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
    };
  }

  it('starts, serves, and fully releases eight servers with no leaked ports', async () => {
    pool = new ApiMockServerPool();
    const base = 18_600 + Math.floor(Math.random() * 300);
    ports = Array.from({ length: 8 }, (_, i) => base + i);

    for (let i = 0; i < 8; i++) await pool.start(makeDef(`srv-${i}`, ports[i]));
    expect(pool.list()).toHaveLength(8);
    expect(pool.list().every(s => s.state === 'running')).toBe(true);

    // Exercise each listener so connections open and must be drained on stop.
    await Promise.all(ports.map(p => fetch(`http://127.0.0.1:${p}/test`).then(r => r.text())));

    await pool.stopAllAsync();
    expect(pool.list().every(s => s.state === 'stopped')).toBe(true);

    // No leaked http.Server / sockets: every port is bindable again.
    for (const p of ports) {
      expect(await isPortAvailable(p)).toBe(true);
    }
  });

  it('repeated start/stop of the same port does not leak listeners', async () => {
    pool = new ApiMockServerPool();
    const port = 18_950 + Math.floor(Math.random() * 40);
    for (let cycle = 0; cycle < 5; cycle++) {
      await pool.start(makeDef('srv-cycle', port));
      expect(pool.status('srv-cycle')?.state).toBe('running');
      await pool.stop('srv-cycle');
      expect(await isPortAvailable(port)).toBe(true);
    }
  });
});
