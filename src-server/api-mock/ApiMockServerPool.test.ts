import { describe, it, expect, afterEach, vi } from 'vitest';
import net from 'node:net';
import { ApiMockServerPool } from './ApiMockServerPool';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-11T00:00:00.000Z';
let nextPort = 19500 + Math.floor(Math.random() * 500);
function getPort() { return nextPort++; }

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
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts, updatedAt: ts,
  };
}

describe('ApiMockServerPool', () => {
  let pool: ApiMockServerPool;

  afterEach(async () => {
    if (pool) await pool.stopAllAsync();
  });

  it('starts a server and lists it', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    const status = await pool.start(makeDef('srv-1', port));
    expect(status.state).toBe('running');
    expect(status.port).toBe(port);
    expect(pool.list()).toHaveLength(1);
  });

  it('starts two servers on different ports', async () => {
    pool = new ApiMockServerPool();
    const p1 = getPort(), p2 = getPort();
    await pool.start(makeDef('srv-a', p1));
    await pool.start(makeDef('srv-b', p2));
    expect(pool.list()).toHaveLength(2);

    const resA = await fetch(`http://127.0.0.1:${p1}/test`);
    const resB = await fetch(`http://127.0.0.1:${p2}/test`);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
  });

  it('rejects duplicate port from different server', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-a', port));
    await expect(pool.start(makeDef('srv-b', port))).rejects.toThrow('owned by');
  });

  it('stops a server', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-1', port));
    const status = await pool.stop('srv-1');
    expect(status.state).toBe('stopped');
  });

  it('stop is idempotent', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-1', port));
    await pool.stop('srv-1');
    const status = await pool.stop('srv-1');
    expect(status.state).toBe('stopped');
  });

  it('commits new definition', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-1', port));
    const def2 = makeDef('srv-1', port);
    def2.name = 'Updated';
    const status = pool.commit('srv-1', def2);
    expect(status.generation).toBe(2);
  });

  it('rejects commit on stopped server', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-1', port));
    await pool.stop('srv-1');
    expect(() => pool.commit('srv-1', makeDef('srv-1', port))).toThrow('not running');
  });

  it('returns status for running server', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-1', port));
    const status = pool.status('srv-1');
    expect(status?.state).toBe('running');
  });

  it('returns undefined for unknown server', () => {
    pool = new ApiMockServerPool();
    expect(pool.status('nonexistent')).toBeUndefined();
  });

  it('stopAllAsync stops all running servers', async () => {
    pool = new ApiMockServerPool();
    await pool.start(makeDef('a', getPort()));
    await pool.start(makeDef('b', getPort()));
    await pool.stopAllAsync();
    expect(pool.list().every(s => s.state === 'stopped')).toBe(true);
  });

  it('allocates a port from the auto range', async () => {
    pool = new ApiMockServerPool();
    const port = await pool.allocatePort();
    expect(port).toBeGreaterThanOrEqual(4600);
    expect(port).toBeLessThanOrEqual(4699);
  });

  it('prefers a valid available preferred port and falls back when it is unavailable or invalid', async () => {
    pool = new ApiMockServerPool();
    const preferred = getPort();
    expect(await pool.allocatePort(preferred)).toBe(preferred);

    const blocker = net.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(preferred, '127.0.0.1', () => resolve());
    });
    try {
      const fallback = await pool.allocatePort(preferred);
      expect(fallback).not.toBe(preferred);
      const invalid = await pool.allocatePort(80);
      expect(invalid).toBeGreaterThanOrEqual(4600);
    } finally {
      await new Promise<void>(resolve => blocker.close(() => resolve()));
    }
  });

  it('rejects starting the same running server twice', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-dup', port));
    await expect(pool.start(makeDef('srv-dup', port))).rejects.toThrow('already running');
  });

  it('throws when stopping a missing server', async () => {
    pool = new ApiMockServerPool();
    await expect(pool.stop('missing')).rejects.toThrow('not found');
  });

  it('restarts a stopped server and reuses its definition id', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    const def = makeDef('srv-r', port);
    await pool.start(def);
    await pool.stop('srv-r');
    const restarted = await pool.restart(def);
    expect(restarted.serverId).toBe('srv-r');
    expect(restarted.state).toBe('running');
  });

  it('restarts a running server by stopping then starting it again', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    const def = makeDef('srv-r2', port);
    await pool.start(def);
    const restarted = await pool.restart(def);
    expect(restarted.serverId).toBe('srv-r2');
    expect(restarted.state).toBe('running');
  });

  it('passes the transaction handler through to started listeners', async () => {
    pool = new ApiMockServerPool();
    const onTransaction = vi.fn();
    pool.setTransactionHandler(onTransaction);
    const port = getPort();
    await pool.start(makeDef('srv-tx', port));
    await (await fetch(`http://127.0.0.1:${port}/test`)).text();
    expect(onTransaction).toHaveBeenCalled();
  });

  it('delegates scenario state get/reset only while running', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    const def = makeDef('srv-state', port);
    await pool.start(def);

    expect(pool.getScenarioState('srv-state')).toEqual({ states: {}, counters: {} });
    expect(pool.getRuntimeState('srv-state')).toEqual({ states: {}, counters: {}, sequencePositions: {} });
    expect(pool.resetScenarioState('srv-state')).toBe(true);

    await pool.stop('srv-state');
    expect(pool.getScenarioState('srv-state')).toBeUndefined();
    expect(pool.resetScenarioState('srv-state')).toBe(false);
    expect(pool.getScenarioState('missing')).toBeUndefined();
    expect(pool.resetScenarioState('missing')).toBe(false);
  });
});
