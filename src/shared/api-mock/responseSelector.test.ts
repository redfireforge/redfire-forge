import { describe, it, expect } from 'vitest';
import {
  createSequenceState, selectSequenceResponse, resetSequence,
  selectWeightedResponse, selectStateResponse, isVariantEligible,
} from './responseSelector';
import { createInitialState, applyTransition } from './scenarioRuntime';
import { createDefaultResponse } from './defaults';
import type { ApiMockRouteV1, ApiMockResponseVariantV1 } from './contracts';

const ts = '2026-08-11T00:00:00.000Z';

function route(mode: ApiMockRouteV1['responseMode'], variants: Partial<ApiMockResponseVariantV1>[]): ApiMockRouteV1 {
  return {
    id: 'r1', name: 'Test', enabled: true, method: 'GET',
    path: { kind: 'exact', value: '/test' }, priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: mode,
    responses: variants.map((v, i) => ({ ...createDefaultResponse(`resp-${i}`), name: `V${i}`, status: 200 + i, ...v })),
    tags: [], createdAt: ts, updatedAt: ts,
  };
}

describe('selectSequenceResponse', () => {
  it('returns responses in order', () => {
    const r = route('sequence', [{}, {}, {}]);
    const seq = createSequenceState();
    expect(selectSequenceResponse(r, seq)?.status).toBe(200);
    expect(selectSequenceResponse(r, seq)?.status).toBe(201);
    expect(selectSequenceResponse(r, seq)?.status).toBe(202);
  });

  it('cycles after exhaustion by default', () => {
    const r = route('sequence', [{}, {}]);
    const seq = createSequenceState();
    selectSequenceResponse(r, seq);
    selectSequenceResponse(r, seq);
    expect(selectSequenceResponse(r, seq)?.status).toBe(200);
  });

  it('holds last with hold_last policy', () => {
    const r = route('sequence', [{}, {}]);
    const seq = createSequenceState();
    selectSequenceResponse(r, seq, 'hold_last');
    selectSequenceResponse(r, seq, 'hold_last');
    expect(selectSequenceResponse(r, seq, 'hold_last')?.status).toBe(201);
  });

  it('resets sequence position', () => {
    const r = route('sequence', [{}, {}, {}]);
    const seq = createSequenceState();
    selectSequenceResponse(r, seq);
    selectSequenceResponse(r, seq);
    resetSequence(seq, 'r1');
    expect(selectSequenceResponse(r, seq)?.status).toBe(200);
  });

  it('skips disabled variants', () => {
    const r = route('sequence', [{ enabled: false }, {}, {}]);
    const seq = createSequenceState();
    expect(selectSequenceResponse(r, seq)?.status).toBe(201);
  });

  it('returns undefined for no enabled variants', () => {
    const r = route('sequence', [{ enabled: false }]);
    const seq = createSequenceState();
    expect(selectSequenceResponse(r, seq)).toBeUndefined();
  });
});

describe('selectWeightedResponse', () => {
  it('returns a variant', () => {
    const r = route('weighted', [{ weight: 50 }, { weight: 50 }]);
    const v = selectWeightedResponse(r);
    expect(v).toBeDefined();
    expect([200, 201]).toContain(v!.status);
  });

  it('is deterministic with seed', () => {
    const r = route('weighted', [{ weight: 30 }, { weight: 70 }]);
    const v1 = selectWeightedResponse(r, 'seed-1');
    const v2 = selectWeightedResponse(r, 'seed-1');
    expect(v1?.id).toBe(v2?.id);
  });

  it('skips zero-weight variants', () => {
    const r = route('weighted', [{ weight: 0 }, { weight: 100 }]);
    const v = selectWeightedResponse(r);
    expect(v?.status).toBe(201);
  });

  it('returns undefined with no eligible variants', () => {
    const r = route('weighted', [{ weight: 0, enabled: true }]);
    expect(selectWeightedResponse(r)).toBeUndefined();
  });
});

describe('selectStateResponse', () => {
  it('selects guarded variant matching current state', () => {
    const r = route('state', [
      { transition: { currentState: 'idle', targetState: 'active' } },
      { transition: { currentState: 'active', targetState: 'done' } },
      { transition: { targetState: 'idle' } },
    ]);
    const scenario = createInitialState();
    applyTransition(scenario, 'flow', { targetState: 'active' });
    const v = selectStateResponse(r, scenario, 'flow');
    expect(v?.transition?.currentState).toBe('active');
  });

  it('falls back to unguarded variant', () => {
    const r = route('state', [
      { transition: { currentState: 'active', targetState: 'done' } },
      { transition: { targetState: 'idle' } },
    ]);
    const scenario = createInitialState();
    const v = selectStateResponse(r, scenario, 'flow');
    expect(v?.transition?.currentState).toBeUndefined();
  });
});

describe('isVariantEligible', () => {
  it('eligible by default', () => {
    const v = createDefaultResponse('r1');
    expect(isVariantEligible(v, 0).eligible).toBe(true);
  });

  it('ineligible after maxMatches', () => {
    const v = { ...createDefaultResponse('r1'), behavior: { delayMs: 0, jitterMs: 0, maxMatches: 5 } };
    expect(isVariantEligible(v, 5).eligible).toBe(false);
    expect(isVariantEligible(v, 4).eligible).toBe(true);
  });

  it('ineligible after expiry', () => {
    const v = { ...createDefaultResponse('r1'), behavior: { delayMs: 0, jitterMs: 0, expiresAt: '2020-01-01T00:00:00Z' } };
    expect(isVariantEligible(v, 0).eligible).toBe(false);
  });

  it('eligible before expiry', () => {
    const v = { ...createDefaultResponse('r1'), behavior: { delayMs: 0, jitterMs: 0, expiresAt: '2099-01-01T00:00:00Z' } };
    expect(isVariantEligible(v, 0).eligible).toBe(true);
  });
});
