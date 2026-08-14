import { describe, expect, it, vi } from 'vitest';
import { createDefaultResponse } from './defaults';
import type { ApiMockCapturedRequestV1, ApiMockRouteV1 } from './contracts';

vi.mock('./unavailableOperators', () => ({
  UNAVAILABLE_PREDICATE_OPERATORS: ['jsonSchema'],
  isUnavailablePredicateOperator: (operator: string) => operator === 'jsonSchema',
}));

import { evaluatePredicateGroup, evaluateRoute } from './predicateEvaluator';

const ts = '2026-08-13T00:00:00.000Z';

const request: ApiMockCapturedRequestV1 = {
  method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {},
  cookies: {}, body: '{}', bodyTruncated: false, receivedAt: ts,
};

const route: ApiMockRouteV1 = {
  id: 'r1', name: 'Test', enabled: true, method: 'GET',
  path: { kind: 'exact', value: '/test' }, priority: 0,
  predicates: {
    id: 'pg', combinator: 'all',
    children: [{ id: 'p1', source: 'body', operator: 'jsonSchema', expected: {} }],
  },
  responseMode: 'rules', responses: [createDefaultResponse('v1')],
  tags: [], createdAt: ts, updatedAt: ts,
};

describe('predicateEvaluator unavailable operators', () => {
  it('never matches a stubbed operator and fail-closes NOT groups', () => {
    const result = evaluateRoute(route, request, '');
    expect(result.overallMatch).toBe(false);
    expect(result.predicateResults[0]).toMatchObject({ evaluated: false, passed: false });

    expect(evaluatePredicateGroup({
      id: 'pg', combinator: 'not',
      children: [{ id: 'p1', source: 'body', operator: 'jsonSchema', expected: {} }],
    }, request)).toBe(false);
  });

  it('rejects an unknown combinator', () => {
    expect(evaluatePredicateGroup({
      id: 'pg', combinator: 'xor' as 'all',
      children: [],
    }, request)).toBe(false);
  });
});
