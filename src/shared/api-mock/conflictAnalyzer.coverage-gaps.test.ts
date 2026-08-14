/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { analyzeConflicts } from './conflictAnalyzer';
import { createDefaultResponse } from './defaults';
import type { ApiMockRouteV1, ApiMockPredicateGroupV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

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

function group(combinator: ApiMockPredicateGroupV1['combinator'], ...children: ApiMockPredicateGroupV1['children']): ApiMockPredicateGroupV1 {
  return { id: `pg-${combinator}`, combinator, children };
}

describe('conflictAnalyzer coverage gaps', () => {
  it('handles empty enabled routes without findings', async () => {
    const { findings } = await analyzeConflicts([
      route({ id: 'a', enabled: false }),
      route({ id: 'b', enabled: false }),
    ], 'srv');
    expect(findings).toEqual([]);
  });

  it('treats ANY methods as overlapping and keeps potential overlaps informational', async () => {
    const routes = [
      route({ id: 'a', method: 'ANY', path: { kind: 'regex', value: '^/users/' } }),
      route({ id: 'b', method: 'POST', path: { kind: 'regex', value: '^/users/.+$' } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv');
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('potential_overlap');
    expect(findings[0].severity).toBe('info');
    expect(findings[0].dimensions.find(d => d.source === 'method')?.explanation).toContain('overlapping methods');
  });

  it('covers invalid regex and regex-intersection path branches', async () => {
    const invalid = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'regex', value: '(' } }),
      route({ id: 'b', path: { kind: 'exact', value: '/users/42' } }),
    ], 'srv');
    expect(invalid.findings[0].dimensions.find(d => d.source === 'path')?.result).toBe('unknown');

    const regexIntersection = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'regex', value: '^/users/.+$' } }),
      route({ id: 'b', path: { kind: 'regex', value: '^/users/\\d+$' } }),
    ], 'srv');
    expect(regexIntersection.findings[0].dimensions.find(d => d.source === 'path')?.explanation).toContain('undecidable');
  });

  it('covers parameterized path disjoint and overlap branches', async () => {
    const differentSegments = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'parameterized', value: '/users/:id' } }),
      route({ id: 'b', path: { kind: 'parameterized', value: '/users/:id/orders/:orderId' } }),
    ], 'srv');
    expect(differentSegments.findings).toEqual([]);

    const literalMismatch = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'parameterized', value: '/users/:id/orders' } }),
      route({ id: 'b', path: { kind: 'parameterized', value: '/users/:id/profile' } }),
    ], 'srv');
    expect(literalMismatch.findings).toEqual([]);

    const compatible = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'parameterized', value: '/users/:id/orders/{orderId}' } }),
      route({ id: 'b', path: { kind: 'parameterized', value: '/users/{userId}/orders/:id' } }),
    ], 'srv');
    expect(compatible.findings[0].dimensions.find(d => d.source === 'path')?.result).toBe('overlap');
  });

  it('covers unknown path-kind fallback', async () => {
    const { findings } = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'glob' as any, value: '/users/*' } }),
      route({ id: 'b', path: { kind: 'parameterized', value: '/users/:id' } }),
    ], 'srv');
    expect(findings[0].dimensions.find(d => d.source === 'path')?.result).toBe('unknown');
  });

  it('covers non-duplicate predicate tree mismatches for combinators, lengths, and mixed child kinds', async () => {
    const differentCombinator = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'exact', expected: '1' }) }),
      route({ id: 'b', predicates: group('any', { id: 'p2', source: 'header', selector: 'x', operator: 'exact', expected: '1' }) }),
    ], 'srv');
    expect(differentCombinator.findings[0].kind).toBe('definite_overlap');

    const differentLength = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'exact', expected: '1' }) }),
      route({ id: 'b', predicates: group('all') }),
    ], 'srv');
    // A predicate present on one side only is reported as an unknown dimension,
    // which downgrades the finding from definite to potential.
    expect(differentLength.findings[0].kind).toBe('potential_overlap');
    expect(differentLength.findings[0].dimensions.some(d => d.result === 'unknown')).toBe(true);

    const mixedKinds = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'exact', expected: '1' })) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'header', selector: 'x', operator: 'exact', expected: '1' }) }),
    ], 'srv');
    expect(mixedKinds.findings[0].kind).toBe('definite_overlap');

    const nestedMismatch = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'exact', expected: '1' })) }),
      route({ id: 'b', predicates: group('all', group('all', { id: 'p2', source: 'header', selector: 'x', operator: 'exact', expected: '2' })) }),
    ], 'srv');
    expect(nestedMismatch.findings).toEqual([]);
  });

  it('covers duplicate-source predicate flattening and absent/present overlap branches', async () => {
    const { findings } = await analyzeConflicts([
      route({
        id: 'a',
        predicates: group('all',
          { id: 'p1', source: 'header', selector: 'auth', operator: 'absent' },
          { id: 'p2', source: 'header', selector: 'auth', operator: 'absent' },
          { id: 'p3', source: 'body', operator: 'present' },
        ),
      }),
      route({
        id: 'b',
        predicates: group('all',
          { id: 'p4', source: 'header', selector: 'auth', operator: 'present' },
          { id: 'p5', source: 'body', operator: 'present' },
        ),
      }),
    ], 'srv');
    expect(findings).toEqual([]);
  });

  it('covers absent/absent overlap and label-without-selector branches', async () => {
    const { findings } = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'parameterized', value: '/:id' }, predicates: group('all', { id: 'p1', source: 'body', operator: 'absent' }) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'body', operator: 'absent' }) }),
    ], 'srv');
    expect(findings[0].dimensions.find(d => d.source === 'body')?.explanation).toContain('both absent');
  });

  it('covers exact-vs-exact and exact-vs-contains branches', async () => {
    const exactDisjoint = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'query', selector: 'status', operator: 'exact', expected: 'open' }) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'query', selector: 'status', operator: 'exact', expected: 'closed' }) }),
    ], 'srv');
    expect(exactDisjoint.findings).toEqual([]);

    const containsOverlap = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'query', selector: 'q', operator: 'exact', expected: 'hello-world' }) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'query', selector: 'q', operator: 'contains', expected: 'hello' }) }),
    ], 'srv');
    expect(containsOverlap.findings[0].dimensions.find(d => d.source === 'query')?.result).toBe('overlap');

    const containsDisjoint = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'query', selector: 'q', operator: 'contains', expected: 'hello' }) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'query', selector: 'q', operator: 'exact', expected: 'goodbye' }) }),
    ], 'srv');
    expect(containsDisjoint.findings).toEqual([]);
  });

  it('covers regex predicate pair branches and schema/path unknown branches', async () => {
    const regexDisjoint = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'regex', expected: '^a+$' }) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'header', selector: 'x', operator: 'exact', expected: 'bbb' }) }),
    ], 'srv');
    expect(regexDisjoint.findings).toEqual([]);

    const regexInvalidLeft = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'regex', expected: '(' }) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'header', selector: 'x', operator: 'exact', expected: 'bbb' }) }),
    ], 'srv');
    expect(regexInvalidLeft.findings[0].kind).toBe('potential_overlap');

    const regexInvalidRight = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'exact', expected: 'bbb' }) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'header', selector: 'x', operator: 'regex', expected: '(' }) }),
    ], 'srv');
    expect(regexInvalidRight.findings[0].kind).toBe('potential_overlap');

    const schemaUnknown = await analyzeConflicts([
      route({ id: 'a', predicates: group('all', { id: 'p1', source: 'body', operator: 'jsonSchema', expected: { type: 'object' } as any }) }),
      route({ id: 'b', predicates: group('all', { id: 'p2', source: 'body', operator: 'prefix', expected: '{' }) }),
    ], 'srv');
    expect(schemaUnknown.findings[0].dimensions.find(d => d.source === 'body')?.explanation).toContain('schema/path intersection undecidable');
  });

  it('covers generic unknown predicate overlap and non-shadowed superset cases', async () => {
    const unknown = await analyzeConflicts([
      route({ id: 'a', priority: 5, predicates: group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'prefix', expected: 'ab' }) }),
      route({ id: 'b', priority: 20, predicates: group('all', { id: 'p2', source: 'header', selector: 'x', operator: 'suffix', expected: 'cd' }) }),
    ], 'srv');
    expect(unknown.findings[0].kind).toBe('potential_overlap');

    const notSuperset = await analyzeConflicts([
      route({ id: 'a', priority: 20, predicates: group('all', { id: 'p1', source: 'header', selector: 'x', operator: 'prefix', expected: 'ab' }) }),
      route({ id: 'b', priority: 5, predicates: group('all', { id: 'p2', source: 'header', selector: 'x', operator: 'suffix', expected: 'cd' }) }),
    ], 'srv');
    expect(notSuperset.findings[0].kind).toBe('potential_overlap');
  });
});
