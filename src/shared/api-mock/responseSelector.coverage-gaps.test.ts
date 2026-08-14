import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSequenceState,
  isVariantEligible,
  resetSequence,
  selectRulesResponse,
  selectResponseForRoute,
  selectStateResponse,
  selectWeightedResponse,
} from './responseSelector';
import { createInitialState, applyTransition } from './scenarioRuntime';
import { createDefaultResponse } from './defaults';
import type { ApiMockRouteV1, ApiMockResponseVariantV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function route(mode: ApiMockRouteV1['responseMode'], variants: Partial<ApiMockResponseVariantV1>[]): ApiMockRouteV1 {
  return {
    id: 'r1',
    name: 'Test',
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/test' },
    priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: mode,
    responses: variants.map((variant, index) => ({
      ...createDefaultResponse(`resp-${index}`),
      name: `V${index}`,
      status: 200 + index,
      ...variant,
    })),
    tags: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('responseSelector coverage gaps', () => {
  it('resets all sequence positions when no route id is provided', () => {
    const seq = createSequenceState();
    seq.positions.r1 = 2;
    seq.positions.r2 = 5;
    resetSequence(seq);
    expect(seq.positions).toEqual({});
  });

  it('falls through to the final weighted variant on an extreme roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1 as number);
    const selected = selectWeightedResponse(route('weighted', [{ weight: 1 }, { weight: 2 }]));
    expect(selected?.status).toBe(201);
  });

  it('uses Math.random when no seed is provided for weighted selection', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const selected = selectWeightedResponse(route('weighted', [{ weight: 1 }, { weight: 1 }]));
    expect(selected?.status).toBe(200);
  });

  it('treats probability 1 as always eligible without rolling', () => {
    const variant = {
      ...createDefaultResponse('resp-4'),
      behavior: { delayMs: 0, jitterMs: 0, probability: 1 },
    };
    expect(isVariantEligible(variant, 0).eligible).toBe(true);
  });

  it('rejects a probabilistic variant when the roll exceeds the threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const variant = {
      ...createDefaultResponse('resp-1'),
      behavior: { delayMs: 0, jitterMs: 0, probability: 0.25 },
    };
    const result = isVariantEligible(variant, 0);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Probability 0.25 not met');
  });

  it('keeps a probabilistic variant eligible when the roll stays within threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const variant = {
      ...createDefaultResponse('resp-2'),
      behavior: { delayMs: 0, jitterMs: 0, probability: 0.25 },
    };
    expect(isVariantEligible(variant, 0).eligible).toBe(true);
  });

  it('uses a fixed probability roll and selects via selectResponseForRoute modes', () => {
    const variant = {
      ...createDefaultResponse('resp-3'),
      behavior: { delayMs: 0, jitterMs: 0, probability: 0.5 },
    };
    expect(isVariantEligible(variant, 0, new Date(), 0.1).eligible).toBe(true);

    const seq = createSequenceState();
    const seqRoute = route('sequence', [{}, {}]);
    expect(selectResponseForRoute(seqRoute, {
      method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {},
      body: null, bodyTruncated: false, receivedAt: ts,
    }, createInitialState(), seq)?.status).toBe(200);

    const rulesRoute = route('rules', [{ enabled: false }]);
    expect(selectRulesResponse(rulesRoute, {
      method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {},
      body: null, bodyTruncated: false, receivedAt: ts,
    })).toBeUndefined();

    const weighted = selectResponseForRoute(
      route('weighted', [{ weight: 10 }, { weight: 90 }]),
      { method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
      createInitialState(),
      createSequenceState(),
      { seed: 'weighted-gap' },
    );
    expect(weighted).toBeDefined();

    const state = createInitialState();
    applyTransition(state, 'default', { targetState: 'active' });
    const statePick = selectResponseForRoute(
      route('state', [
        { transition: { currentState: 'active', targetState: 'done' } },
        { transition: { targetState: 'idle' } },
      ]),
      { method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
      state,
      createSequenceState(),
    );
    expect(statePick?.transition?.currentState).toBe('active');

    const rulesWithBase = selectResponseForRoute(
      route('rules', [{ isDefault: true, status: 204 }]),
      { method: 'GET', path: '/api/test', rawPath: '/api/test', query: {}, headers: {}, cookies: {}, body: null, bodyTruncated: false, receivedAt: ts },
      createInitialState(),
      createSequenceState(),
      { basePath: '/api' },
    );
    expect(rulesWithBase?.status).toBe(204);
  });

  it('returns undefined for state routes with no enabled variants', () => {
    expect(selectStateResponse(route('state', [{ enabled: false }]), createInitialState(), 'flow')).toBeUndefined();
  });
});
