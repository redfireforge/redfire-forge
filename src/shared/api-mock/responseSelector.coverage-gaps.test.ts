import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSequenceState,
  isVariantEligible,
  resetSequence,
  selectWeightedResponse,
} from './responseSelector';
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
});
