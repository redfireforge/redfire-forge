import { describe, it, expect, afterEach, vi } from 'vitest';
import { ApiMockServerPool, apiMockPool } from './ApiMockServerPool';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../src/shared/api-mock/contracts';
import * as listenerModule from './ApiMockNetworkListener';

const ts = '2026-08-11T00:00:00.000Z';
let nextPort = 20500 + Math.floor(Math.random() * 500);
function getPort() { return nextPort++; }

function makeDef(
  id: string,
  port: number,
  overrides: Partial<ApiMockServerDefinitionV1> = {},
): ApiMockServerDefinitionV1 {
  return {
    id,
    name: `Server ${id}`,
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    variables: [],
    samples: [],
    routes: [{
      id: 'r1',
      name: 'Route',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/test' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [createDefaultResponse('resp-1')],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function proxyDraftDef(id: string, port: number): ApiMockServerDefinitionV1 {
  return makeDef(id, port, {
    routes: [],
    settings: {
      ...DEFAULT_SETTINGS,
      fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
      proxy: {
        ...DEFAULT_SETTINGS.proxy!,
        enabled: true,
        allowlist: ['https://upstream.example.com'],
        blockPrivateNetworks: false,
        recordAsDrafts: true,
      },
    },
  });
}

describe('ApiMockServerPool coverage gaps', () => {
  let pool: ApiMockServerPool;

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (pool) await pool.stopAllAsync();
  });

  it('exports a shared apiMockPool singleton', () => {
    expect(apiMockPool).toBeInstanceOf(ApiMockServerPool);
  });

  it('restarts a server that was never started before', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    const def = makeDef('srv-new-restart', port);
    const status = await pool.restart(def);
    expect(status.state).toBe('running');
    expect(status.serverId).toBe('srv-new-restart');
  });

  it('allows reusing a port after the previous owner was stopped', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-old', port));
    await pool.stop('srv-old');
    const status = await pool.start(makeDef('srv-new', port));
    expect(status.state).toBe('running');
    expect(status.port).toBe(port);
  });

  it('throws when no port is available in the auto range', async () => {
    pool = new ApiMockServerPool();
    vi.spyOn(listenerModule, 'isPortAvailable').mockResolvedValue(false);
    await expect(pool.allocatePort()).rejects.toThrow('No available port');
  });

  it('returns sequence state only while the server is running', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    await pool.start(makeDef('srv-seq', port));
    expect(pool.getSequenceState('srv-seq')).toEqual({ positions: {} });
    await pool.stop('srv-seq');
    expect(pool.getSequenceState('srv-seq')).toBeUndefined();
    expect(pool.getSequenceState('missing')).toBeUndefined();
  });

  it('manages recorded drafts via proxy capture, dedup, ack, and clear', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('upstream.example.com')) {
        return new Response(`{"path":"${url.split('/').pop()}"}`, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return realFetch(input, init);
    }));

    await pool.start(proxyDraftDef('srv-drafts', port));
    await fetch(`http://127.0.0.1:${port}/first`);
    await fetch(`http://127.0.0.1:${port}/first`);
    await fetch(`http://127.0.0.1:${port}/second`);

    await vi.waitFor(() => expect(pool.getRecordedDrafts('srv-drafts').length).toBe(2));

    const drafts = pool.getRecordedDrafts('srv-drafts');
    expect(pool.acknowledgeRecordedDrafts('srv-drafts', [drafts[0].id])).toBe(1);
    expect(pool.getRecordedDrafts('srv-drafts')).toHaveLength(1);

    expect(pool.acknowledgeRecordedDrafts('missing', ['x'])).toBe(0);
    expect(pool.acknowledgeRecordedDrafts('srv-drafts', [])).toBe(0);

    expect(pool.acknowledgeRecordedDrafts('srv-drafts', [drafts[1].id])).toBe(1);
    expect(pool.getRecordedDrafts('srv-drafts')).toEqual([]);

    await fetch(`http://127.0.0.1:${port}/third`);
    await vi.waitFor(() => expect(pool.getRecordedDrafts('srv-drafts').length).toBe(1));
    pool.clearRecordedDrafts('srv-drafts');
    expect(pool.getRecordedDrafts('srv-drafts')).toEqual([]);
  });

  it('trims recorded drafts when exceeding the max buffer', async () => {
    pool = new ApiMockServerPool();
    const port = getPort();
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('upstream.example.com')) {
        const path = url.split('/').pop() ?? 'x';
        return new Response(`{"n":"${path}"}`, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return realFetch(input, init);
    }));

    await pool.start(proxyDraftDef('srv-overflow', port));
    for (let i = 0; i < 205; i++) {
      await fetch(`http://127.0.0.1:${port}/path-${i}`);
    }
    await vi.waitFor(() => expect(pool.getRecordedDrafts('srv-overflow').length).toBe(200));
  });
});
