import { describe, it, expect } from 'vitest';
import { computeDefinitionFingerprint, computeRouteFingerprint, canonicalExportOrder, canonicalVariableOrder } from './fingerprint';
import { DEFAULT_SETTINGS, createDefaultResponse } from './defaults';
import type { ApiMockServerDefinitionV1, ApiMockRouteV1 } from './contracts';

const ts = '2026-08-11T00:00:00.000Z';

function makeRoute(id = 'route-1'): ApiMockRouteV1 {
  return {
    id, name: 'Test', enabled: true, method: 'GET',
    path: { kind: 'exact', value: '/test' }, priority: 10,
    predicates: { id: 'pg-1', combinator: 'all', children: [] },
    responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
    tags: ['tag1'], createdAt: ts, updatedAt: ts,
  };
}

function makeServer(id = 'srv-1'): ApiMockServerDefinitionV1 {
  return {
    id, name: 'Test', enabled: true, host: '127.0.0.1', port: 4600,
    basePath: '', folders: [], routes: [makeRoute()], samples: [],
    variables: [], settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
  };
}

describe('computeDefinitionFingerprint', () => {
  it('produces a hex string', async () => {
    const fp = await computeDefinitionFingerprint(makeServer());
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for identical definitions', async () => {
    const a = await computeDefinitionFingerprint(makeServer());
    const b = await computeDefinitionFingerprint(makeServer());
    expect(a).toBe(b);
  });

  it('ignores createdAt/updatedAt/source changes', async () => {
    const s1 = makeServer();
    const s2 = { ...makeServer(), createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' };
    expect(await computeDefinitionFingerprint(s1)).toBe(await computeDefinitionFingerprint(s2));
  });

  it('changes when a route changes', async () => {
    const s1 = makeServer();
    const s2 = makeServer();
    s2.routes[0].priority = 99;
    expect(await computeDefinitionFingerprint(s1)).not.toBe(await computeDefinitionFingerprint(s2));
  });
});

describe('computeRouteFingerprint', () => {
  it('produces a hex string', async () => {
    const fp = await computeRouteFingerprint(makeRoute());
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores tags and operationId', async () => {
    const r1 = makeRoute();
    const r2 = { ...makeRoute(), tags: ['changed'], operationId: 'op1' };
    expect(await computeRouteFingerprint(r1)).toBe(await computeRouteFingerprint(r2));
  });

  it('changes when predicates change', async () => {
    const r1 = makeRoute();
    const r2 = makeRoute();
    r2.predicates.children.push({ id: 'p1', source: 'header', selector: 'x', operator: 'exact', expected: 'v' });
    expect(await computeRouteFingerprint(r1)).not.toBe(await computeRouteFingerprint(r2));
  });
});

describe('canonicalExportOrder', () => {
  it('sorts by id', () => {
    const items = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
    expect(canonicalExportOrder(items).map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the original array', () => {
    const items = [{ id: 'b' }, { id: 'a' }];
    canonicalExportOrder(items);
    expect(items[0].id).toBe('b');
  });
});

describe('canonicalVariableOrder', () => {
  it('sorts by key', () => {
    const vars = [{ key: 'z', value: '1' }, { key: 'a', value: '2' }];
    expect(canonicalVariableOrder(vars).map(v => v.key)).toEqual(['a', 'z']);
  });
});
