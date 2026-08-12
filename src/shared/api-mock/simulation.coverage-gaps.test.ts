import { describe, expect, it } from 'vitest';
import { simulateSingle } from './simulation';
import { createDefaultResponse, DEFAULT_SETTINGS } from './defaults';
import type { ApiMockCapturedRequestV1, ApiMockRouteV1, ApiMockSimulationSampleV1 } from './contracts';

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

function req(overrides: Partial<ApiMockCapturedRequestV1> = {}): ApiMockCapturedRequestV1 {
  return { method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts, ...overrides };
}

function sample(overrides: Partial<ApiMockSimulationSampleV1> = {}): ApiMockSimulationSampleV1 {
  return { id: 's1', name: 'Sample 1', request: req(), ...overrides };
}

describe('simulation coverage gaps', () => {
  it('fails on responseId mismatch', () => {
    const result = simulateSingle(sample({ expected: { responseId: 'wrong' } }), { routes: [route()] });
    expect(result.passed).toBe(false);
  });

  it('checks unmatched and ambiguous status expectations', () => {
    const unmatched = simulateSingle(
      sample({ request: req({ method: 'POST' }), expected: { outcome: 'unmatched', status: 404 } }),
      { routes: [route()] },
    );
    expect(unmatched.passed).toBe(true);

    const ambiguous = simulateSingle(
      sample({ expected: { outcome: 'ambiguous', status: 409 } }),
      {
        routes: [route({ id: 'a' }), route({ id: 'b' })],
        settings: { selection: { ...DEFAULT_SETTINGS.selection, multipleMatchPolicy: 'reject_multiple' } },
      },
    );
    expect(ambiguous.passed).toBe(true);

    const ambiguousWrongStatus = simulateSingle(
      sample({ expected: { outcome: 'ambiguous', status: 404 } }),
      {
        routes: [route({ id: 'a' }), route({ id: 'b' })],
        settings: { selection: { ...DEFAULT_SETTINGS.selection, multipleMatchPolicy: 'reject_multiple' } },
      },
    );
    expect(ambiguousWrongStatus.passed).toBe(false);
  });

  it('uses provided basePath and merges missing settings from defaults', () => {
    const result = simulateSingle(
      sample({ request: req({ path: '/api/test', rawPath: '/api/test' }), expected: { outcome: 'matched' } }),
      {
        routes: [route()],
        basePath: '/api',
        settings: { fallback: DEFAULT_SETTINGS.fallback },
      },
    );
    expect(result.outcome).toBe('matched');
    expect(result.passed).toBe(true);
  });
});
