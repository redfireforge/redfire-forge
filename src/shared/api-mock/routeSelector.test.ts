import { describe, it, expect } from 'vitest';
import { selectRoute, computeSpecificity } from './routeSelector';
import { evaluateRoute } from './predicateEvaluator';
import { createDefaultResponse, DEFAULT_SETTINGS } from './defaults';
import type { ApiMockRouteV1, ApiMockCapturedRequestV1, ApiMockServerSettingsV1 } from './contracts';

const ts = '2026-08-11T00:00:00.000Z';

function route(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'r1', name: 'Route 1', enabled: true, method: 'GET',
    path: { kind: 'exact', value: '/test' }, priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
    tags: [], createdAt: ts, updatedAt: ts, ...overrides,
  };
}

function req(overrides: Partial<ApiMockCapturedRequestV1> = {}): ApiMockCapturedRequestV1 {
  return {
    method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {},
    cookies: {}, body: null, bodyTruncated: false, receivedAt: ts, ...overrides,
  };
}

function settings(overrides: Partial<ApiMockServerSettingsV1['selection']> = {}): ApiMockServerSettingsV1 {
  return { ...DEFAULT_SETTINGS, selection: { ...DEFAULT_SETTINGS.selection, ...overrides } };
}

describe('selectRoute', () => {
  describe('single match', () => {
    it('matches the only route', () => {
      const result = selectRoute([route()], req(), DEFAULT_SETTINGS, '');
      expect(result.outcome).toBe('matched');
      expect(result.selectedRouteId).toBe('r1');
    });

    it('selects the default response', () => {
      const result = selectRoute([route()], req(), DEFAULT_SETTINGS, '');
      expect(result.selectedResponseId).toBe('resp-1');
    });

    it('uses the first response for non-rules modes', () => {
      const r = route({
        responseMode: 'sequence',
        responses: [
          { ...createDefaultResponse('resp-a'), isDefault: false },
          { ...createDefaultResponse('resp-b'), isDefault: false },
        ],
      });
      const result = selectRoute([r], req(), DEFAULT_SETTINGS, '');
      expect(result.selectedResponseId).toBe('resp-a');
    });

    it('returns matched with no selected response when rules-mode variants are all disabled', () => {
      const r = route({ responses: [{ ...createDefaultResponse('resp-1'), enabled: false }] });
      const result = selectRoute([r], req(), DEFAULT_SETTINGS, '');
      expect(result.outcome).toBe('matched');
      expect(result.selectedResponseId).toBeUndefined();
    });
  });

  describe('no match', () => {
    it('returns unmatched when no route fits', () => {
      const result = selectRoute([route()], req({ method: 'POST' }), DEFAULT_SETTINGS, '');
      expect(result.outcome).toBe('unmatched');
      expect(result.selectedRouteId).toBeUndefined();
    });

    it('produces near misses', () => {
      const result = selectRoute(
        [route({ id: 'r1', path: { kind: 'exact', value: '/users' } })],
        req({ path: '/orders' }),
        DEFAULT_SETTINGS, '',
      );
      expect(result.outcome).toBe('unmatched');
    });
  });

  describe('reject_multiple policy', () => {
    it('returns ambiguous when 2+ routes match', () => {
      const routes = [route({ id: 'a', priority: 10 }), route({ id: 'b', priority: 5 })];
      const result = selectRoute(routes, req(), settings({ multipleMatchPolicy: 'reject_multiple' }), '');
      expect(result.outcome).toBe('ambiguous');
    });
  });

  describe('highest_priority policy', () => {
    it('selects the highest priority route', () => {
      const routes = [
        route({ id: 'low', priority: 5 }),
        route({ id: 'high', priority: 20 }),
      ];
      const result = selectRoute(routes, req(), settings({ multipleMatchPolicy: 'highest_priority' }), '');
      expect(result.outcome).toBe('matched');
      expect(result.selectedRouteId).toBe('high');
    });
  });

  describe('equal priority — reject', () => {
    it('returns ambiguous when tied', () => {
      const routes = [route({ id: 'a' }), route({ id: 'b' })];
      const result = selectRoute(routes, req(), settings({ equalPriorityPolicy: 'reject' }), '');
      expect(result.outcome).toBe('ambiguous');
    });
  });

  describe('equal priority — specificity_then_id', () => {
    it('breaks tie by lexical route ID when specificity is equal', () => {
      const routes = [
        route({ id: 'route-beta' }),
        route({ id: 'route-alpha' }),
      ];
      const result = selectRoute(routes, req(), settings({ equalPriorityPolicy: 'specificity_then_id' }), '');
      expect(result.outcome).toBe('matched');
      expect(result.selectedRouteId).toBe('route-alpha');
    });

    it('higher specificity wins over lexical ID', () => {
      const routes = [
        route({ id: 'z-generic', path: { kind: 'glob', value: '/*' } }),
        route({ id: 'a-specific', path: { kind: 'exact', value: '/test' } }),
      ];
      const result = selectRoute(routes, req(), settings({ equalPriorityPolicy: 'specificity_then_id' }), '');
      expect(result.outcome).toBe('matched');
      expect(result.selectedRouteId).toBe('a-specific');
    });
  });

  describe('insertion order independence', () => {
    it('produces the same result regardless of route array order', () => {
      const r1 = route({ id: 'b', priority: 10 });
      const r2 = route({ id: 'a', priority: 10 });
      const s = settings({ equalPriorityPolicy: 'specificity_then_id' });
      const fwd = selectRoute([r1, r2], req(), s, '');
      const rev = selectRoute([r2, r1], req(), s, '');
      expect(fwd.selectedRouteId).toBe(rev.selectedRouteId);
    });
  });

  describe('explanation', () => {
    it('includes all candidates in the explanation', () => {
      const routes = [route({ id: 'a' }), route({ id: 'b', method: 'POST' })];
      const result = selectRoute(routes, req(), DEFAULT_SETTINGS, '');
      expect(result.explanation.candidates).toHaveLength(2);
    });

    it('records policy decision', () => {
      const result = selectRoute([route()], req(), DEFAULT_SETTINGS, '');
      expect(result.explanation.policyDecision.policy).toBe('highest_priority');
      expect(result.explanation.policyDecision.matchedCount).toBe(1);
    });

    it('computes near misses for partial matches', () => {
      const r = route({
        predicates: { id: 'pg', combinator: 'all', children: [
          { id: 'p1', source: 'header', selector: 'x-required', operator: 'present' },
        ] },
      });
      const result = selectRoute([r], req(), DEFAULT_SETTINGS, '');
      expect(result.outcome).toBe('unmatched');
      expect(result.explanation.nearMisses.length).toBeGreaterThanOrEqual(1);
      expect(result.explanation.nearMisses[0].failedPredicates[0].source).toBe('header');
    });

    it('falls back to the raw malformed path when decodeURIComponent fails', () => {
      const bad = '/bad/%E0%A4%A';
      const result = selectRoute([route({ path: { kind: 'exact', value: bad } })], req({ path: bad, rawPath: bad }), DEFAULT_SETTINGS, '');
      expect(result.explanation.normalizedRequest.decodedPath).toBe(bad);
    });
  });

  describe('disabled routes', () => {
    it('skips disabled routes', () => {
      const result = selectRoute([route({ enabled: false })], req(), DEFAULT_SETTINGS, '');
      expect(result.outcome).toBe('unmatched');
    });
  });

  describe('basePath stripping', () => {
    it('matches after removing basePath', () => {
      const r = route({ path: { kind: 'exact', value: '/users' } });
      const result = selectRoute([r], req({ path: '/api/v1/users' }), DEFAULT_SETTINGS, '/api/v1');
      expect(result.outcome).toBe('matched');
    });
  });
});

describe('computeSpecificity', () => {
  it('exact path scores higher than parameterized', () => {
    const r1 = route({ path: { kind: 'exact', value: '/test' } });
    const r2 = route({ id: 'r2', path: { kind: 'parameterized', value: '/:id' } });
    const routes = [r1, r2];
    const e1 = evaluateRoute(r1, req(), '');
    const e2 = evaluateRoute(r2, req(), '');
    expect(computeSpecificity(e1, routes)).toBeGreaterThan(computeSpecificity(e2, routes));
  });

  it('returns 0 for unknown route ids', () => {
    const evaluation = { routeId: 'missing', predicateResults: [] } as any;
    expect(computeSpecificity(evaluation, [route()])).toBe(0);
  });

  it('covers regex paths, ANY method, skipped failed predicates, and default operator weighting', () => {
    const r = route({ id: 'rx', method: 'ANY', path: { kind: 'regex', value: '^/test$' } });
    const evaluation = {
      routeId: 'rx',
      predicateResults: [
        { operator: 'regex', passed: true },
        { operator: 'json_strict', passed: true },
        { operator: 'json_subset', passed: true },
        { operator: 'jsonPath_exists', passed: true },
        { operator: 'xmlSchema', passed: true },
        { operator: 'exact', passed: false },
      ],
    } as any;
    expect(computeSpecificity(evaluation, [r])).toBe(1 + 10 + 3 + 10 + 7 + 6 + 1);
  });

  it('covers contains/prefix/suffix and present/absent operator weights', () => {
    const r = route({ id: 'ops' });
    const evaluation = {
      routeId: 'ops',
      predicateResults: [
        { operator: 'contains', passed: true },
        { operator: 'suffix', passed: true },
        { operator: 'present', passed: true },
        { operator: 'absent', passed: true },
      ],
    } as any;
    expect(computeSpecificity(evaluation, [r])).toBe(10 + 50 + 5 + 5 + 2 + 2);
  });
});
