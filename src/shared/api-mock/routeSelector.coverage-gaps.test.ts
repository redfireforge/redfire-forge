import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import type { ApiMockCapturedRequestV1, ApiMockRouteV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

const req: ApiMockCapturedRequestV1 = {
  method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
};

function route(id: string): ApiMockRouteV1 {
  return {
    id, name: id, enabled: true, method: 'GET',
    path: { kind: 'exact', value: '/test' }, priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules', responses: [], tags: [], createdAt: ts, updatedAt: ts,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('routeSelector coverage gaps', () => {
  it('covers the tie-break routeIndex.has fallback and near-miss default reason', async () => {
    vi.doMock('./predicateEvaluator', () => ({
      evaluateRoute: (r: ApiMockRouteV1) => {
        if (r.id === 'a') {
          return { routeId: 'a', routeName: 'A', priority: 10, enabled: true, methodMatch: true, pathMatch: true, predicateResults: [], overallMatch: true };
        }
        return {
          routeId: 'missing-eval-id', routeName: 'B', priority: 10, enabled: true,
          methodMatch: true, pathMatch: true, predicateResults: [], overallMatch: true,
        };
      },
    }));
    const { selectRoute } = await import('./routeSelector');
    const result = selectRoute([route('a'), route('b')], req, { ...DEFAULT_SETTINGS, selection: { ...DEFAULT_SETTINGS.selection, equalPriorityPolicy: 'specificity_then_id' } }, '');
    expect(result.outcome).toBe('matched');
    expect(result.selectedRouteId).toBe('a');

    vi.resetModules();
    vi.doMock('./predicateEvaluator', () => ({
      evaluateRoute: (r: ApiMockRouteV1) => ({
        routeId: r.id,
        routeName: r.name,
        priority: r.priority,
        enabled: true,
        methodMatch: true,
        pathMatch: false,
        predicateResults: [{ predicateId: 'p1', source: 'header', operator: 'present', passed: false }],
        overallMatch: false,
      }),
    }));
    const mod2 = await import('./routeSelector');
    const miss = mod2.selectRoute([route('a')], req, DEFAULT_SETTINGS, '');
    expect(miss.explanation.nearMisses[0].failedPredicates[0].reason).toBe('failed');
  });
});
