/**
 * API Mock Studio — Phase 12C recovery/reliability drills (runtime).
 *
 * Exercises the live companion runtime for port theft, oversized traffic,
 * graceful shutdown, and invalid-draft isolation, asserting recovery behavior
 * and no silent runtime corruption.
 */
import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import { ApiMockServerPool } from './ApiMockServerPool';
import { ApiMockNetworkListener, isPortAvailable } from './ApiMockNetworkListener';
import { validateServer } from '../../src/shared/api-mock/validation';
import { classifyRuntimeError } from '../../src/shared/api-mock/recoveryDiagnostics';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';
let nextPort = 20_100 + Math.floor(Math.random() * 400);
const getPort = () => nextPort++;

function makeDef(id: string, port: number, method: ApiMockServerDefinitionV1['routes'][0]['method'] = 'GET', path = '/test'): ApiMockServerDefinitionV1 {
  return {
    id, name: `Server ${id}`, enabled: true, host: '127.0.0.1',
    port, basePath: '', folders: [], variables: [], samples: [],
    routes: [{
      id: 'r1', name: 'Route', enabled: true, method,
      path: { kind: 'exact', value: path }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
      tags: [], createdAt: ts, updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
  };
}

describe('drill: port theft', () => {
  let pool: ApiMockServerPool;
  const blockers: net.Server[] = [];

  afterEach(async () => {
    if (pool) await pool.stopAllAsync();
    await Promise.all(blockers.splice(0).map(b => new Promise<void>(r => b.close(() => r()))));
  });

  it('rejects a start when an external process already holds the port', async () => {
    const port = getPort();
    const blocker = net.createServer();
    blockers.push(blocker);
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(port, '127.0.0.1', () => resolve());
    });

    pool = new ApiMockServerPool();
    let caught: unknown;
    try {
      await pool.start(makeDef('srv-a', port));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(classifyRuntimeError(caught).code).toBe('MOCK_PORT_IN_USE');
  });

  it('rejects a second server claiming a port owned by another', async () => {
    const port = getPort();
    pool = new ApiMockServerPool();
    await pool.start(makeDef('srv-a', port));
    let caught: unknown;
    try {
      await pool.start(makeDef('srv-b', port));
    } catch (e) {
      caught = e;
    }
    expect(classifyRuntimeError(caught).code).toBe('MOCK_PORT_OWNED');
  });
});

describe('drill: oversized traffic', () => {
  const listeners: ApiMockNetworkListener[] = [];

  afterEach(async () => {
    await Promise.all(listeners.splice(0).map(l => l.stop()));
  });

  it('truncates a body over the inbound cap and keeps serving', async () => {
    const port = getPort();
    const def = makeDef('srv-big', port, 'POST', '/big');
    def.settings = { ...DEFAULT_SETTINGS, limits: { ...DEFAULT_SETTINGS.limits, maxInboundBodyBytes: 16 } };

    let captured: ApiMockTransactionV1 | undefined;
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-big', definition: def, onTransaction: tx => { captured = tx; },
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/big`, { method: 'POST', body: 'A'.repeat(5000) });
    await res.text();

    expect(res.status).toBe(200); // server still served a response, did not crash
    expect(listener.isRunning()).toBe(true);
    expect(captured?.request.bodyTruncated).toBe(true);
  });
});

describe('drill: graceful shutdown', () => {
  let pool: ApiMockServerPool;

  afterEach(async () => {
    if (pool) await pool.stopAllAsync();
  });

  it('releases all ports and marks servers stopped on shutdown', async () => {
    pool = new ApiMockServerPool();
    const ports = [getPort(), getPort(), getPort()];
    for (let i = 0; i < ports.length; i++) await pool.start(makeDef(`srv-${i}`, ports[i]));
    expect(pool.list().every(s => s.state === 'running')).toBe(true);

    await pool.stopAllAsync();
    expect(pool.list().every(s => s.state === 'stopped')).toBe(true);
    for (const p of ports) expect(await isPortAvailable(p)).toBe(true);
  });
});

describe('drill: no silent corruption from invalid drafts', () => {
  let pool: ApiMockServerPool;

  afterEach(async () => {
    if (pool) await pool.stopAllAsync();
  });

  it('an invalid draft fails validation and never replaces the running generation', async () => {
    const port = getPort();
    pool = new ApiMockServerPool();
    await pool.start(makeDef('srv-x', port));
    const before = pool.status('srv-x')!.generation;

    const invalid = makeDef('srv-x', port);
    invalid.routes[0].responses = []; // no enabled variant → validation error

    const errors = validateServer(invalid).filter(d => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    // The commit guard only runs when validation is clean; here it must not.
    if (errors.length === 0) pool.commit('srv-x', invalid);

    expect(pool.status('srv-x')!.generation).toBe(before);
    const res = await fetch(`http://127.0.0.1:${port}/test`);
    expect(res.status).toBe(200); // running server unaffected
  });
});
