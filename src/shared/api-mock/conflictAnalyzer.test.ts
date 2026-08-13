import { describe, it, expect } from 'vitest';
import { analyzeConflicts } from './conflictAnalyzer';
import { createDefaultResponse } from './defaults';
import type { ApiMockRouteV1 } from './contracts';

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

describe('analyzeConflicts', () => {
  it('does not report overlap when a parameterized path cannot capture the literal', async () => {
    const routes = [
      route({ id: 'a', path: { kind: 'parameterized', value: '/users/:id' } }),
      route({ id: 'b', path: { kind: 'exact', value: '/health' } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings).toHaveLength(0);
  });

  it('reports overlap when a parameterized path does capture the literal', async () => {
    const routes = [
      route({ id: 'a', path: { kind: 'parameterized', value: '/users/:id' }, priority: 20 }),
      route({ id: 'b', path: { kind: 'exact', value: '/users/admin' }, priority: 20 }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].dimensions.find(d => d.source === 'path')?.result).toBe('overlap');
  });

  it('compares glob paths against literals instead of guessing', async () => {
    const hit = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'glob', value: '/assets/*' }, priority: 20 }),
      route({ id: 'b', path: { kind: 'exact', value: '/assets/logo.png' }, priority: 20 }),
    ], 'srv-1');
    expect(hit.findings[0]?.dimensions.find(d => d.source === 'path')?.result).toBe('overlap');

    const miss = await analyzeConflicts([
      route({ id: 'a', path: { kind: 'glob', value: '/assets/*' } }),
      route({ id: 'b', path: { kind: 'exact', value: '/health' } }),
    ], 'srv-1');
    expect(miss.findings).toHaveLength(0);
  });

  it('returns no findings for disjoint routes', async () => {
    const routes = [
      route({ id: 'a', method: 'GET', path: { kind: 'exact', value: '/users' } }),
      route({ id: 'b', method: 'POST', path: { kind: 'exact', value: '/orders' } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings).toHaveLength(0);
  });

  it('detects duplicates', async () => {
    const routes = [route({ id: 'a' }), route({ id: 'b' })];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings.some(f => f.kind === 'duplicate')).toBe(true);
    expect(findings[0].severity).toBe('error');
  });

  it('detects definite overlap with identical method and exact path', async () => {
    const routes = [
      route({ id: 'a', predicates: { id: 'pg', combinator: 'all', children: [{ id: 'p1', source: 'header', selector: 'x', operator: 'exact', expected: 'val' }] } }),
      route({ id: 'b', predicates: { id: 'pg', combinator: 'all', children: [{ id: 'p2', source: 'header', selector: 'x', operator: 'exact', expected: 'val' }] } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('detects potential overlap for regex vs regex', async () => {
    const routes = [
      route({ id: 'a', predicates: { id: 'pg', combinator: 'all', children: [{ id: 'p1', source: 'header', selector: 'x', operator: 'regex', expected: '^a' }] } }),
      route({ id: 'b', predicates: { id: 'pg', combinator: 'all', children: [{ id: 'p2', source: 'header', selector: 'x', operator: 'regex', expected: '^a.*b' }] } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings.some(f => f.kind === 'potential_overlap')).toBe(true);
  });

  it('returns disjoint for different methods', async () => {
    const routes = [
      route({ id: 'a', method: 'GET' }),
      route({ id: 'b', method: 'POST' }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings).toHaveLength(0);
  });

  it('returns disjoint for different exact paths', async () => {
    const routes = [
      route({ id: 'a', path: { kind: 'exact', value: '/users' } }),
      route({ id: 'b', path: { kind: 'exact', value: '/orders' } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings).toHaveLength(0);
  });

  it('detects overlap for exact vs parameterized path', async () => {
    const routes = [
      route({ id: 'a', path: { kind: 'exact', value: '/users/admin' } }),
      route({ id: 'b', path: { kind: 'parameterized', value: '/users/:id' } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].dimensions.some(d => d.source === 'path' && d.result === 'overlap')).toBe(true);
  });

  it('detects regex vs exact using evaluator', async () => {
    const routes = [
      route({ id: 'a', path: { kind: 'regex', value: '^/users/\\d+$' } }),
      route({ id: 'b', path: { kind: 'exact', value: '/users/42' } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings.some(f => f.dimensions.some(d => d.source === 'path' && d.result === 'overlap'))).toBe(true);
  });

  it('marks regex vs exact as disjoint when regex does not match', async () => {
    const routes = [
      route({ id: 'a', path: { kind: 'regex', value: '^/orders/\\d+$' } }),
      route({ id: 'b', path: { kind: 'exact', value: '/users/42' } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings).toHaveLength(0);
  });

  it('detects present vs absent as disjoint', async () => {
    const routes = [
      route({ id: 'a', predicates: { id: 'pg', combinator: 'all', children: [{ id: 'p1', source: 'header', selector: 'auth', operator: 'present' }] } }),
      route({ id: 'b', predicates: { id: 'pg', combinator: 'all', children: [{ id: 'p2', source: 'header', selector: 'auth', operator: 'absent' }] } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings).toHaveLength(0);
  });

  it('detects negated exact vs same exact as disjoint', async () => {
    const routes = [
      route({ id: 'a', predicates: { id: 'pg', combinator: 'all', children: [{ id: 'p1', source: 'query', selector: 'status', operator: 'exact', expected: 'active', options: { negate: true } }] } }),
      route({ id: 'b', predicates: { id: 'pg', combinator: 'all', children: [{ id: 'p2', source: 'query', selector: 'status', operator: 'exact', expected: 'active' }] } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings).toHaveLength(0);
  });

  it('skips disabled routes', async () => {
    const routes = [route({ id: 'a' }), route({ id: 'b', enabled: false })];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings).toHaveLength(0);
  });

  it('includes fingerprints, witness request, and selection outcome in findings', async () => {
    const routes = [
      route({ id: 'a', path: { kind: 'parameterized', value: '/users/:id' }, priority: 20 }),
      route({ id: 'b', path: { kind: 'exact', value: '/users/admin' }, priority: 20 }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].ruleFingerprints[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(findings[0].ruleFingerprints[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(findings[0].witnessRequest?.path).toBe('/users/admin');
    expect(findings[0].selectionOutcome).toBe('reject_ambiguous');
  });

  it('detects shadowed route (higher priority superset)', async () => {
    const pred = { id: 'p1', source: 'header' as const, selector: 'x', operator: 'exact' as const, expected: 'v' };
    const routes = [
      route({ id: 'high', priority: 20, predicates: { id: 'pg', combinator: 'all', children: [] } }),
      route({ id: 'low', priority: 5, predicates: { id: 'pg', combinator: 'all', children: [pred] } }),
    ];
    const { findings } = await analyzeConflicts(routes, 'srv-1');
    expect(findings.some(f => f.kind === 'shadowed')).toBe(true);
  });
});
