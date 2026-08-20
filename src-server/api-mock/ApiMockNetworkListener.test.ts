import { describe, it, expect, afterEach } from 'vitest';
import { ApiMockNetworkListener, HEALTH_PATH_LIVE, HEALTH_PATH_READY } from './ApiMockNetworkListener';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-11T00:00:00.000Z';

function makeDef(port: number, overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-test', name: 'Test', enabled: true, host: '127.0.0.1',
    port, basePath: '', folders: [], variables: [], samples: [],
    routes: [{
      id: 'r1', name: 'Test Route', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/hello' }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [{
        ...createDefaultResponse('resp-1'),
        status: 200,
        body: { kind: 'text', content: 'Hello from mock', contentType: 'text/plain' },
      }],
      tags: [], createdAt: ts, updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts, updatedAt: ts,
    ...overrides,
  };
}

// Use ephemeral ports to avoid conflicts
let nextPort = 19300 + Math.floor(Math.random() * 500);
function getPort() { return nextPort++; }

describe('ApiMockNetworkListener', () => {
  const listeners: ApiMockNetworkListener[] = [];

  afterEach(async () => {
    for (const l of listeners) {
      if (l.isRunning()) await l.stop();
    }
    listeners.length = 0;
  });

  it('starts and responds to GET requests', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-1', definition: makeDef(port) });
    listeners.push(listener);
    await listener.start();
    expect(listener.isRunning()).toBe(true);
    expect(listener.getGeneration()).toBe(1);

    const res = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello from mock');
    const diag = listener.getLocalDiagnostics();
    expect(diag.outcomes.matched).toBe(1);
    expect(diag.matchDuration.count).toBe(1);
    expect(diag.routeCount).toBe(1);
  });

  it('returns 404 for unmatched paths', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-1', definition: makeDef(port) });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('stops cleanly', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-1', definition: makeDef(port) });
    listeners.push(listener);
    await listener.start();
    await listener.stop();
    expect(listener.isRunning()).toBe(false);
  });

  it('commits new definition and increments generation', async () => {
    const port = getPort();
    const def = makeDef(port);
    const listener = new ApiMockNetworkListener({ serverId: 'srv-1', definition: def });
    listeners.push(listener);
    await listener.start();
    expect(listener.getGeneration()).toBe(1);

    const newDef = { ...def, routes: [{
      ...def.routes[0],
      responses: [{
        ...createDefaultResponse('resp-2'),
        status: 201,
        body: { kind: 'text' as const, content: 'Updated', contentType: 'text/plain' },
      }],
    }] };
    const gen = listener.commit(newDef);
    expect(gen).toBe(2);

    const res = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('Updated');
  });

  it('records transactions when handler provided', async () => {
    const port = getPort();
    const transactions: unknown[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-1',
      definition: makeDef(port),
      onTransaction: tx => transactions.push(tx),
    });
    listeners.push(listener);
    await listener.start();

    await fetch(`http://127.0.0.1:${port}/hello`);
    expect(transactions.length).toBe(1);
  });

  it('does not record transactions when the journal is disabled', async () => {
    const port = getPort();
    const transactions: unknown[] = [];
    const def = makeDef(port, {
      settings: { ...DEFAULT_SETTINGS, journal: { ...DEFAULT_SETTINGS.journal, enabled: false } },
    });
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-1',
      definition: def,
      onTransaction: tx => transactions.push(tx),
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(res.status).toBe(200);
    expect(transactions).toHaveLength(0);
    expect(listener.getLocalDiagnostics().outcomes.matched).toBe(1);

    listener.commit({
      ...def,
      settings: { ...DEFAULT_SETTINGS, journal: { ...DEFAULT_SETTINGS.journal, enabled: true } },
    });
    await fetch(`http://127.0.0.1:${port}/hello`);
    expect(transactions).toHaveLength(1);
  });

  it('returns ambiguity response for multiple matches with reject_multiple', async () => {
    const port = getPort();
    const def = makeDef(port);
    def.routes.push({
      id: 'r2', name: 'Duplicate', enabled: true, method: 'GET',
      path: { kind: 'exact', value: '/hello' }, priority: 5,
      predicates: { id: 'pg2', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [createDefaultResponse('resp-dup')],
      tags: [], createdAt: ts, updatedAt: ts,
    });
    def.settings.selection.multipleMatchPolicy = 'reject_multiple';

    const listener = new ApiMockNetworkListener({ serverId: 'srv-1', definition: def });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(res.status).toBe(409);
  });

  it('answers CORS preflight without journaling when CORS is enabled', async () => {
    const port = getPort();
    const txs: unknown[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-cors',
      definition: makeDef(port, {
        settings: { ...DEFAULT_SETTINGS, cors: { ...DEFAULT_SETTINGS.cors, enabled: true } },
      }),
      onTransaction: tx => { txs.push(tx); },
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/hello`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.test', 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
    expect(res.headers.get('access-control-max-age')).toBe('86400');
    expect(txs).toHaveLength(0);
    expect(listener.getLocalDiagnostics().inFlight).toBe(0);
  });

  it('attaches CORS headers to matched GET responses', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-cors-get',
      definition: makeDef(port, {
        settings: {
          ...DEFAULT_SETTINGS,
          cors: {
            ...DEFAULT_SETTINGS.cors,
            enabled: true,
            allowOrigins: ['https://app.test'],
            allowCredentials: true,
            exposeHeaders: ['X-Request-Id'],
          },
        },
      }),
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/hello`, {
      headers: { Origin: 'https://app.test' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.test');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-expose-headers')).toBe('X-Request-Id');
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('does not attach CORS headers when CORS is disabled', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-no-cors',
      definition: makeDef(port),
    });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/hello`, {
      headers: { Origin: 'https://app.test' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  // ── Built-in health check endpoints ──────────────────────────────────────

  it('liveness probe responds 200 immediately after start', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-health', definition: makeDef(port) });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}${HEALTH_PATH_LIVE}`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.probe).toBe('liveness');
    // serverId comes from definition.id (makeDef hardcodes 'srv-test')
    expect(typeof body.serverId).toBe('string');
    expect(typeof body.generation).toBe('number');
    expect(typeof body.uptime).toBe('number');
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('readiness probe responds 200 after routes are committed (generation ≥ 1)', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-ready', definition: makeDef(port) });
    listeners.push(listener);
    await listener.start(); // start() sets generation to 1

    const res = await fetch(`http://127.0.0.1:${port}${HEALTH_PATH_READY}`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.probe).toBe('readiness');
    expect(body.generation).toBeGreaterThanOrEqual(1);
  });

  it('health endpoints are not journaled (do not appear in transaction callbacks)', async () => {
    const port = getPort();
    const transactions: unknown[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-no-journal',
      definition: makeDef(port),
      onTransaction: tx => transactions.push(tx),
    });
    listeners.push(listener);
    await listener.start();

    await fetch(`http://127.0.0.1:${port}${HEALTH_PATH_LIVE}`);
    await fetch(`http://127.0.0.1:${port}${HEALTH_PATH_READY}`);
    // Allow any async callbacks to flush.
    await new Promise(r => setTimeout(r, 50));
    expect(transactions).toHaveLength(0);
  });

  it('health endpoints do not shadow user-defined routes on other paths', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-shadow', definition: makeDef(port) });
    listeners.push(listener);
    await listener.start();

    // Normal route still works.
    const normalRes = await fetch(`http://127.0.0.1:${port}/hello`);
    expect(normalRes.status).toBe(200);
    expect(await normalRes.text()).toBe('Hello from mock');

    // Health routes are intercepted.
    const healthRes = await fetch(`http://127.0.0.1:${port}${HEALTH_PATH_READY}`);
    expect(healthRes.status).toBe(200);
  });

  it('health paths ignore query strings', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-qs', definition: makeDef(port) });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}${HEALTH_PATH_LIVE}?v=1`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.probe).toBe('liveness');
  });

  it('serves FLAKY as 503 even when the route predicate still requires WIDGET', async () => {
    const port = getPort();
    const skuEquals = (id: string, sku: string) => ({
      id,
      combinator: 'all' as const,
      children: [{
        id: `${id}-p`,
        source: 'body' as const,
        selector: '',
        operator: 'jsonPath_equals' as const,
        expected: ['$.sku', sku],
      }],
    });
    const happy = { ...createDefaultResponse('v-201'), isDefault: true, status: 201 };
    const flaky = {
      ...createDefaultResponse('v-503'),
      isDefault: false,
      status: 503,
      conditions: skuEquals('pg-flaky', 'FLAKY'),
      body: { kind: 'json' as const, content: '{"error":"unavailable","sku":"FLAKY"}', contentType: 'application/json' },
    };
    const def = makeDef(port, {
      routes: [{
        id: 'orders', name: 'POST /orders', enabled: true, method: 'POST',
        path: { kind: 'exact', value: '/orders' }, priority: 10,
        predicates: skuEquals('pg-root', 'WIDGET'),
        responseMode: 'rules',
        responses: [happy, flaky],
        tags: [], createdAt: ts, updatedAt: ts,
      }],
    });
    const listener = new ApiMockNetworkListener({ serverId: 'srv-flaky', definition: def });
    listeners.push(listener);
    await listener.start();

    const res = await fetch(`http://127.0.0.1:${port}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'FLAKY', qty: 1 }),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable', sku: 'FLAKY' });
  });
});
