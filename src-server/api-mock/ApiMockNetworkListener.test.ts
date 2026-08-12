import { describe, it, expect, afterEach } from 'vitest';
import { ApiMockNetworkListener } from './ApiMockNetworkListener';
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
});
