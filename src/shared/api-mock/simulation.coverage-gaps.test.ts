import { describe, expect, it } from 'vitest';
import { simulateSingle, simulateBatch } from './simulation';
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

  it('checks bodyContains and bodyExact expectations', () => {
    const resp = createDefaultResponse('resp-1');
    resp.body = { kind: 'json', content: '{"token":"abc"}', contentType: 'application/json' };
    const pass = simulateSingle(
      sample({ expected: { bodyContains: 'abc', bodyExact: '{"token":"abc"}' } }),
      { routes: [route({ responses: [resp] })] },
    );
    expect(pass.passed).toBe(true);

    const failContains = simulateSingle(
      sample({ expected: { bodyContains: 'missing' } }),
      { routes: [route({ responses: [resp] })] },
    );
    expect(failContains.passed).toBe(false);
  });

  it('uses closest-match debug fallback for unmatched requests', () => {
    const result = simulateSingle(
      sample({ request: req({ method: 'POST' }) }),
      {
        routes: [route()],
        settings: {
          fallback: {
            ...DEFAULT_SETTINGS.fallback,
            mode: 'closest_match_debug',
          },
        },
      },
    );
    expect(result.outcome).toBe('unmatched');
    expect(result.renderedResponse?.body).toContain('closest');
  });

  it('falls back to another eligible variant when the selected one is ineligible', () => {
    const primary = createDefaultResponse('primary');
    primary.status = 200;
    primary.behavior = { ...primary.behavior, maxMatches: 0 };
    const fallback = createDefaultResponse('fallback');
    fallback.isDefault = false;
    fallback.status = 201;
    const result = simulateSingle(sample(), {
      routes: [route({ responses: [primary, fallback] })],
      seed: 'eligibility-fallback',
    });
    expect(result.preview?.eligibilityFallback).toBe(true);
    expect(result.renderedResponse?.status).toBe(201);
  });

  it('runs batch samples independently when sequentialBatch is false', () => {
    const r1 = createDefaultResponse('a');
    r1.status = 200;
    const r2 = createDefaultResponse('b');
    r2.status = 201;
    r2.isDefault = false;
    const seqRoute = route({ responseMode: 'sequence', responses: [r1, r2] });
    const results = simulateBatch(
      [sample({ id: 's1' }), sample({ id: 's2' })],
      { routes: [seqRoute], sequentialBatch: false, seed: 'non-seq' },
    );
    expect(results[0].renderedResponse?.status).toBe(200);
    expect(results[1].renderedResponse?.status).toBe(200);
  });

  it('initializes runtime containers and clones provided sequence state', () => {
    const resp = createDefaultResponse('resp-1');
    const result = simulateSingle(sample(), {
      routes: [route({ responses: [resp] })],
      runtime: {
        sequence: { positions: { r1: 2 } },
        variantMatchCounts: { 'resp-1': 1 },
      },
    });
    expect(result.preview?.sequenceIndex).toBeUndefined();
    expect(result.outcome).toBe('matched');
  });

  it('fails bodyExact expectations and skips status check when no rendered status exists', () => {
    const failExact = simulateSingle(
      sample({ expected: { bodyExact: '{"nope":true}' } }),
      { routes: [route()] },
    );
    expect(failExact.passed).toBe(false);

    const skipStatus = simulateSingle(
      sample({ expected: { outcome: 'matched', status: 999 } }),
      { routes: [route()] },
    );
    expect(skipStatus.passed).toBe(false);
  });

  it('handles routes with no enabled response variants', () => {
    const disabled = createDefaultResponse('off');
    disabled.enabled = false;
    const result = simulateSingle(sample(), {
      routes: [route({ responses: [disabled] })],
    });
    expect(result.outcome).toBe('matched');
    expect(result.preview?.selectedResponseId).toBeUndefined();
  });

  it('keeps the selected variant when every fallback is also ineligible', () => {
    const primary = createDefaultResponse('primary');
    primary.behavior = { ...primary.behavior, maxMatches: 0 };
    const secondary = createDefaultResponse('secondary');
    secondary.isDefault = false;
    secondary.behavior = { ...secondary.behavior, maxMatches: 0 };
    const result = simulateSingle(sample(), {
      routes: [route({ responses: [primary, secondary] })],
      seed: 'no-fallback',
    });
    expect(result.preview?.eligibilityFallback).toBe(false);
    expect(result.preview?.eligibilityReason).toContain('Match limit');
  });

  it('honours fixed now for expired variant eligibility', () => {
    const expired = createDefaultResponse('old');
    expired.behavior = { ...expired.behavior, expiresAt: '2020-01-01T00:00:00.000Z' };
    const fresh = createDefaultResponse('new');
    fresh.isDefault = false;
    fresh.status = 201;
    const result = simulateSingle(sample(), {
      routes: [route({ responses: [expired, fresh] })],
      now: '2026-01-01T00:00:00.000Z',
      seed: 'expired',
    });
    expect(result.preview?.eligibilityFallback).toBe(true);
    expect(result.renderedResponse?.status).toBe(201);
  });

  it('hydrates missing runtime slices on the working context', () => {
    const result = simulateSingle(
      sample(),
      { routes: [route({ responseMode: 'sequence', responses: [createDefaultResponse('a'), createDefaultResponse('b')] })], seed: 'rt' },
      {},
    );
    expect(result.preview?.sequenceIndex).toBe(0);
  });
});
