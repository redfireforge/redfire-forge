import { describe, it, expect } from 'vitest';
import { simulateSingle, simulateBatch } from './simulation';
import { createDefaultResponse, DEFAULT_SETTINGS } from './defaults';
import type { ApiMockRouteV1, ApiMockSimulationSampleV1, ApiMockCapturedRequestV1 } from './contracts';

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
  return { method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts, ...overrides };
}

function sample(overrides: Partial<ApiMockSimulationSampleV1> = {}): ApiMockSimulationSampleV1 {
  return { id: 's1', name: 'Sample 1', request: req(), ...overrides };
}

describe('simulateSingle', () => {
  it('returns matched for a matching route', () => {
    const result = simulateSingle(sample(), { routes: [route()] });
    expect(result.outcome).toBe('matched');
    expect(result.sampleId).toBe('s1');
    expect(result.generation).toBe('draft');
  });

  it('returns unmatched when no route fits', () => {
    const result = simulateSingle(sample({ request: req({ method: 'POST' }) }), { routes: [route()] });
    expect(result.outcome).toBe('unmatched');
  });

  it('uses provided generation', () => {
    const result = simulateSingle(sample(), { routes: [route()], generation: 42 });
    expect(result.generation).toBe(42);
  });

  it('checks expected outcome — pass', () => {
    const s = sample({ expected: { outcome: 'matched', routeId: 'r1', status: 200 } });
    const result = simulateSingle(s, { routes: [route()] });
    expect(result.passed).toBe(true);
  });

  it('checks expected outcome — fail on wrong route', () => {
    const s = sample({ expected: { outcome: 'matched', routeId: 'wrong' } });
    const result = simulateSingle(s, { routes: [route()] });
    expect(result.passed).toBe(false);
  });

  it('checks expected outcome — fail on wrong outcome', () => {
    const s = sample({ expected: { outcome: 'unmatched' } });
    const result = simulateSingle(s, { routes: [route()] });
    expect(result.passed).toBe(false);
  });

  it('passed is undefined when no expectations', () => {
    const result = simulateSingle(sample(), { routes: [route()] });
    expect(result.passed).toBeUndefined();
  });

  it('includes trace in result', () => {
    const result = simulateSingle(sample(), { routes: [route()] });
    expect(result.trace).toBeDefined();
    expect(result.trace.candidates).toHaveLength(1);
  });

  it('is side-effect-free — repeated calls give same result', () => {
    const s = sample();
    const routes = [route()];
    const r1 = simulateSingle(s, { routes });
    const r2 = simulateSingle(s, { routes });
    expect(r1.outcome).toBe(r2.outcome);
    expect(r1.trace.policyDecision).toEqual(r2.trace.policyDecision);
  });
});

describe('simulateBatch', () => {
  it('runs all samples', () => {
    const samples = [
      sample({ id: 's1' }),
      sample({ id: 's2', request: req({ method: 'POST' }) }),
    ];
    const results = simulateBatch(samples, { routes: [route()] });
    expect(results).toHaveLength(2);
    expect(results[0].outcome).toBe('matched');
    expect(results[1].outcome).toBe('unmatched');
  });

  it('uses partial settings', () => {
    const routes = [route({ id: 'a' }), route({ id: 'b' })];
    const results = simulateBatch(
      [sample()],
      { routes, settings: { selection: { ...DEFAULT_SETTINGS.selection, multipleMatchPolicy: 'reject_multiple' } } },
    );
    expect(results[0].outcome).toBe('ambiguous');
  });
});
