/**
 * The unmatched/ambiguous bodies are static settings, so they bypassed the
 * template engine and served `{{requestId}}` literally. These assert the id is
 * rendered AND equals the journal entry, which is the whole point of it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ApiMockNetworkListener } from './ApiMockNetworkListener';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';
let nextPort = 19600 + Math.floor(Math.random() * 200);

function makeDef(port: number, routes: ApiMockServerDefinitionV1['routes']): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-fb', name: 'Fallback', enabled: true, host: '127.0.0.1', port,
    basePath: '', folders: [], variables: [], samples: [], routes,
    settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
  };
}

const route = (id: string, path: string) => ({
  id, name: id, enabled: true, method: 'GET' as const,
  path: { kind: 'exact' as const, value: path }, priority: 10,
  predicates: { id: `pg-${id}`, combinator: 'all' as const, children: [] },
  responseMode: 'rules' as const,
  responses: [{ ...createDefaultResponse(`r-${id}`), status: 200 }],
  tags: [], createdAt: ts, updatedAt: ts,
});

describe('fallback response templating', () => {
  const listeners: ApiMockNetworkListener[] = [];
  afterEach(async () => {
    for (const l of listeners) if (l.isRunning()) await l.stop();
    listeners.length = 0;
  });

  async function start(routes: ApiMockServerDefinitionV1['routes']) {
    const port = nextPort++;
    const transactions: ApiMockTransactionV1[] = [];
    const listener = new ApiMockNetworkListener({
      serverId: 'srv-fb',
      definition: makeDef(port, routes),
      onTransaction: t => transactions.push(t),
    });
    listeners.push(listener);
    await listener.start();
    return { port, transactions };
  }

  it('renders requestId on an unmatched request and matches the journal id', async () => {
    const { port, transactions } = await start([]);
    const res = await fetch(`http://127.0.0.1:${port}/nope`);
    expect(res.status).toBe(404);

    const body = JSON.parse(await res.text());
    expect(body.error).toBe('not_found');
    expect(body.requestId).not.toBe('{{requestId}}');
    expect(body.requestId).toMatch(/^tx-/);

    // The id is only useful if it identifies the journal entry.
    expect(transactions).toHaveLength(1);
    expect(transactions[0].id).toBe(body.requestId);
  }, 30_000);

  it('renders requestId and competingRules on an ambiguous match', async () => {
    // Two identical rules at equal priority — the default policy rejects.
    const { port, transactions } = await start([route('a', '/dup'), route('b', '/dup')]);
    const res = await fetch(`http://127.0.0.1:${port}/dup`);

    const text = await res.text();
    expect(text).not.toContain('{{');
    const body = JSON.parse(text);
    expect(body.error).toBe('ambiguous');
    expect(body.requestId).toMatch(/^tx-/);
    expect(typeof body.competingRules).toBe('number');
    expect(body.competingRules).toBeGreaterThan(0);
    expect(transactions[0].id).toBe(body.requestId);
  }, 30_000);

  it('produces valid JSON — the raw template was not parseable', async () => {
    const { port } = await start([]);
    const res = await fetch(`http://127.0.0.1:${port}/missing`);
    await expect(res.json()).resolves.toBeTruthy();
  }, 30_000);
});
