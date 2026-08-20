import { describe, expect, it } from 'vitest';
import {
  collectNearMisses,
  isClosePathMiss,
  levenshtein,
  pathMissDistance,
  pathSegments,
} from './nearMissRanking';
import type { RouteEvaluationResult } from './predicateEvaluator';
import type { ApiMockRouteV1 } from './contracts';
import { createDefaultResponse } from './defaults';

const ts = '2026-08-19T00:00:00.000Z';

function route(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'r1',
    name: 'Route 1',
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
    ...overrides,
  };
}

function evalFor(r: ApiMockRouteV1, overrides: Partial<RouteEvaluationResult> = {}): RouteEvaluationResult {
  return {
    routeId: r.id,
    routeName: r.name,
    priority: r.priority,
    enabled: r.enabled,
    methodMatch: true,
    pathMatch: false,
    pathParams: {},
    predicateResults: [],
    overallMatch: false,
    ...overrides,
  };
}

describe('pathSegments', () => {
  it('drops empty segments from leading, trailing, and doubled slashes', () => {
    expect(pathSegments('/orders/42/')).toEqual(['orders', '42']);
    expect(pathSegments('//health')).toEqual(['health']);
    expect(pathSegments('/')).toEqual([]);
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings and the other length when one is empty', () => {
    expect(levenshtein('orders', 'orders')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(0 + 3);
  });

  it('counts a one-character typo as distance 1', () => {
    expect(levenshtein('ordrs', 'orders')).toBe(1);
    expect(levenshtein('produts', 'products')).toBe(1);
  });
});

describe('pathMissDistance / isClosePathMiss', () => {
  it('treats parameterized :id and {id} segments as wildcards', () => {
    expect(pathMissDistance('/orders/:id', '/ordrs/42')).toBe(1);
    expect(pathMissDistance('/orders/{id}', '/ordrs/42')).toBe(1);
    expect(isClosePathMiss('/orders/:id', '/ordrs/42')).toBe(true);
    expect(isClosePathMiss('/products/:id', '/produts/42')).toBe(true);
  });

  it('does not treat unrelated paths as close, including different arity', () => {
    expect(isClosePathMiss('/health', '/ordrs/42')).toBe(false);
    expect(isClosePathMiss('/orders', '/ordrs/42')).toBe(false);
    expect(isClosePathMiss('/users', '/orders')).toBe(false);
    expect(pathMissDistance('/health', '/ordrs/42')).toBeGreaterThan(2);
  });

  it('treats * and ** glob segments as wildcards and matches exact paths at distance 0', () => {
    expect(pathMissDistance('/orders/*', '/ordrs/42')).toBe(1);
    expect(pathMissDistance('/api/**', '/api/v1')).toBe(0);
    expect(pathMissDistance('/test', '/test')).toBe(0);
    expect(isClosePathMiss('/test', '/test')).toBe(true);
  });
});

describe('collectNearMisses', () => {
  it('ranks a path typo against GET /orders/:id and ignores GET /health', () => {
    const item = route({
      id: 'item',
      name: 'GET /orders/{id}',
      enabled: false,
      path: { kind: 'parameterized', value: '/orders/:id', paramNames: ['id'] },
    });
    const health = route({
      id: 'health',
      name: 'GET /health',
      path: { kind: 'exact', value: '/health' },
    });
    const health2 = route({
      id: 'health-2',
      name: 'GET /health',
      path: { kind: 'exact', value: '/health' },
    });
    const post = route({
      id: 'create',
      name: 'POST /orders',
      method: 'POST',
      path: { kind: 'exact', value: '/orders' },
    });
    const misses = collectNearMisses(
      [
        evalFor(item),
        evalFor(health),
        evalFor(health2),
        evalFor(post, { methodMatch: false }),
      ],
      [item, health, health2, post],
      '/ordrs/42',
      'GET',
    );
    expect(misses.map(m => m.routeId)).toEqual(['item']);
    expect(misses[0].failedPredicates[0]).toEqual({
      predicateId: 'path',
      source: 'path',
      reason: `'ordrs' ≠ 'orders'`,
    });
  });

  it('keeps method+path predicate failures and names a disabled exact match', () => {
    const gated = route({ id: 'gated', name: 'Users' });
    const draft = route({ id: 'draft', name: 'Draft Test', enabled: false });
    const misses = collectNearMisses(
      [
        evalFor(gated, {
          pathMatch: true,
          predicateResults: [{
            predicateId: 'p1',
            groupId: 'g',
            source: 'header',
            operator: 'present',
            passed: false,
            evaluated: true,
            reason: 'missing X-Tenant',
          }],
        }),
        evalFor(draft, { pathMatch: true, enabled: false }),
      ],
      [gated, draft],
      '/test',
      'GET',
    );
    expect(misses[0].routeId).toBe('gated');
    expect(misses[0].failedPredicates[0].reason).toBe('missing X-Tenant');
    expect(misses[1].routeId).toBe('draft');
    expect(misses[1].failedPredicates[0]).toMatchObject({ source: 'enabled', reason: 'rule is disabled' });
  });

  it('defaults a missing predicate reason to failed', () => {
    const gated = route({ id: 'gated' });
    const misses = collectNearMisses(
      [evalFor(gated, {
        pathMatch: true,
        predicateResults: [{
          predicateId: 'p1',
          groupId: 'g',
          source: 'header',
          operator: 'present',
          passed: false,
          evaluated: true,
        }, {
          predicateId: 'p2',
          groupId: 'g',
          source: 'query',
          operator: 'present',
          passed: true,
          evaluated: true,
        }],
      })],
      [gated],
      '/test',
      'GET',
    );
    expect(misses[0].failedPredicates).toEqual([
      { predicateId: 'p1', source: 'header', reason: 'failed' },
    ]);
  });

  it('includes a wrong-method hit on the same path and skips unknown evaluations', () => {
    const post = route({ id: 'post', name: 'POST /test', method: 'POST' });
    const misses = collectNearMisses(
      [
        evalFor(post, { methodMatch: false, pathMatch: true }),
        {
          routeId: 'ghost',
          routeName: 'Ghost',
          priority: 10,
          enabled: true,
          methodMatch: true,
          pathMatch: true,
          pathParams: {},
          predicateResults: [],
          overallMatch: false,
        },
      ],
      [post],
      '/test',
      'GET',
    );
    expect(misses).toHaveLength(1);
    expect(misses[0].failedPredicates[0]).toEqual({
      predicateId: 'method',
      source: 'method',
      reason: 'GET ≠ POST',
    });
  });

  it('skips overall matches and ranks closer same-arity typos first, breaking remaining ties by route id', () => {
    const winner = route({ id: 'hit', name: 'Hit' });
    const zz = route({
      id: 'zz',
      name: 'zz',
      path: { kind: 'parameterized', value: '/zz/:id', paramNames: ['id'] },
    });
    const aa = route({
      id: 'aa',
      name: 'aa',
      path: { kind: 'parameterized', value: '/aa/:id', paramNames: ['id'] },
    });
    const bb = route({
      id: 'bb',
      name: 'bb',
      path: { kind: 'parameterized', value: '/bb/:id', paramNames: ['id'] },
    });
    const misses = collectNearMisses(
      [
        evalFor(winner, { pathMatch: true, overallMatch: true }),
        evalFor(zz),
        evalFor(bb),
        evalFor(aa),
      ],
      [winner, zz, bb, aa],
      '/ab/1',
      'GET',
    );
    expect(misses.map(m => m.routeId)).toEqual(['aa', 'bb', 'zz']);
    expect(misses[0].missDistance).toBeLessThan(misses[2].missDistance);
  });

  it('falls back to the full path reason when arity differs but path matched', () => {
    const exact = route({
      id: 'list',
      name: 'GET /orders',
      path: { kind: 'exact', value: '/orders' },
    });
    const misses = collectNearMisses(
      [evalFor(exact, { pathMatch: true, methodMatch: false })],
      [exact],
      '/orders',
      'POST',
    );
    expect(misses[0].failedPredicates[0].source).toBe('method');
  });

  it('uses the full-path reason when literals match but the path kind did not', () => {
    const exactParam = route({
      id: 'literal',
      name: 'GET /orders/:id',
      path: { kind: 'exact', value: '/orders/:id' },
    });
    const misses = collectNearMisses(
      [evalFor(exactParam)],
      [exactParam],
      '/orders/42',
      'GET',
    );
    expect(misses[0].failedPredicates[0].reason).toBe(`'/orders/42' ≠ '/orders/:id'`);
  });
});
