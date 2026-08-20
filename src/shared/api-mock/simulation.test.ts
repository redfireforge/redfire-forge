import { describe, it, expect } from 'vitest';
import { simulateSingle, simulateBatch } from './simulation';
import { createDefaultResponse, DEFAULT_SETTINGS } from './defaults';
import type { ApiMockRouteV1, ApiMockSimulationSampleV1, ApiMockCapturedRequestV1, ApiMockPredicateGroupV1 } from './contracts';

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

  it('advances sequence across samples when sequential', () => {
    const r1 = createDefaultResponse('a');
    r1.status = 200;
    const r2 = createDefaultResponse('b');
    r2.status = 201;
    r2.isDefault = false;
    const seqRoute = route({
      responseMode: 'sequence',
      responses: [r1, r2],
    });
    const results = simulateBatch(
      [sample({ id: 's1' }), sample({ id: 's2' })],
      { routes: [seqRoute], seed: 'seq-batch', sequentialBatch: true },
    );
    expect(results[0].renderedResponse?.status).toBe(200);
    expect(results[1].renderedResponse?.status).toBe(201);
  });
});

describe('simulateSingle Phase 7 preview', () => {
  it('renders response body and virtual delay', () => {
    const resp = createDefaultResponse('resp-1');
    resp.body = { kind: 'json', content: '{"ok":true}', contentType: 'application/json' };
    resp.behavior.delayMs = 50;
    const result = simulateSingle(sample(), { routes: [route({ responses: [resp] })], seed: 'd1' });
    expect(result.outcome).toBe('matched');
    expect(result.renderedResponse?.body).toContain('ok');
    expect(result.preview?.virtualDelayMs).toBe(50);
    expect(result.preview?.selectedResponseId).toBe('resp-1');
  });

  it('reports fault outcome for reset without HTTP body', () => {
    const resp = createDefaultResponse('resp-1');
    resp.behavior.fault = 'reset';
    const result = simulateSingle(sample(), { routes: [route({ responses: [resp] })], seed: 'f1' });
    expect(result.outcome).toBe('fault');
    expect(result.preview?.fault).toBe('reset');
    expect(result.preview?.httpCompleted).toBe(false);
    expect(result.renderedResponse?.body).toBeNull();
  });

  it('selects weighted response with seed', () => {
    const a = createDefaultResponse('a');
    a.weight = 1;
    a.status = 200;
    const b = createDefaultResponse('b');
    b.weight = 99;
    b.status = 201;
    b.isDefault = false;
    const result = simulateSingle(
      sample(),
      { routes: [route({ responseMode: 'weighted', responses: [a, b] })], seed: 'w-seed' },
    );
    expect(result.preview?.selectedResponseId).toBeTruthy();
    expect([200, 201]).toContain(result.renderedResponse?.status);
  });

  it('previews state transition without mutating input runtime', () => {
    const start = createDefaultResponse('start');
    start.transition = { currentState: '', targetState: 'opened' };
    start.status = 200;
    const next = createDefaultResponse('next');
    next.isDefault = false;
    next.transition = { currentState: 'opened', targetState: 'done' };
    next.status = 201;
    const runtime = { scenario: { states: {}, counters: {} } };
    const first = simulateSingle(
      sample({ id: 's1' }),
      { routes: [route({ responseMode: 'state', responses: [start, next] })], runtime, seed: 'st' },
    );
    expect(first.preview?.stateAfter).toBe('opened');
    expect(first.preview?.transitionApplied).toBe(true);
    expect(runtime.scenario?.states).toEqual({});
  });
});

function skuEquals(id: string, sku: string): ApiMockPredicateGroupV1 {
  return {
    id,
    combinator: 'all',
    children: [{
      id: `${id}-p`,
      source: 'body',
      selector: '',
      operator: 'jsonPath_equals',
      expected: ['$.sku', sku],
    }],
  };
}

/** AM-24 leftover: route still requires WIDGET while variants claim MISSING / FLAKY. */
function ordersContractRoute(opts?: { flakyFault?: boolean; flakyProbability?: number }): ApiMockRouteV1 {
  const happy = createDefaultResponse('v-201');
  happy.isDefault = true;
  happy.status = 201;
  happy.body = { kind: 'json', content: '{"sku":"WIDGET"}', contentType: 'application/json' };

  const missing = createDefaultResponse('v-404');
  missing.isDefault = false;
  missing.status = 404;
  missing.conditions = skuEquals('pg-missing', 'MISSING');
  missing.body = { kind: 'json', content: '{"error":"not_found","sku":"MISSING"}', contentType: 'application/json' };

  const flaky = createDefaultResponse('v-503');
  flaky.isDefault = false;
  flaky.status = 503;
  flaky.conditions = skuEquals('pg-flaky', 'FLAKY');
  flaky.body = { kind: 'json', content: '{"error":"unavailable","sku":"FLAKY"}', contentType: 'application/json' };
  if (opts?.flakyFault) {
    flaky.behavior = {
      ...flaky.behavior,
      fault: 'timeout',
      probability: opts.flakyProbability ?? 0.5,
    };
  }

  return route({
    id: 'orders',
    name: 'POST /orders',
    method: 'POST',
    path: { kind: 'exact', value: '/orders' },
    predicates: skuEquals('pg-root', 'WIDGET'),
    responses: [happy, missing, flaky],
  });
}

function ordersSample(sku: string, id = 'sample-flaky'): ApiMockSimulationSampleV1 {
  return sample({
    id,
    name: `POST /orders - ${sku}`,
    request: req({
      method: 'POST',
      path: '/orders',
      rawPath: '/orders',
      body: JSON.stringify({ sku, qty: 1 }),
    }),
  });
}

describe('simulateSingle — leftover route predicate vs variant SKUs', () => {
  it('renders 503 for FLAKY instead of the unmatched 404 fallback', () => {
    const result = simulateSingle(ordersSample('FLAKY'), { routes: [ordersContractRoute()] });
    expect(result.outcome).toBe('matched');
    expect(result.renderedResponse?.status).toBe(503);
    expect(result.renderedResponse?.body).toBe('{"error":"unavailable","sku":"FLAKY"}');
    expect(result.renderedResponse?.body).not.toContain('"requestId"');
  });

  it('renders the Not found variant for MISSING, not the unmatched fallback', () => {
    const result = simulateSingle(ordersSample('MISSING', 'sample-missing'), {
      routes: [ordersContractRoute()],
    });
    expect(result.outcome).toBe('matched');
    expect(result.renderedResponse?.status).toBe(404);
    expect(result.renderedResponse?.body).toBe('{"error":"not_found","sku":"MISSING"}');
  });

  it('still serves the default 201 for WIDGET', () => {
    const result = simulateSingle(ordersSample('WIDGET', 'sample-widget'), {
      routes: [ordersContractRoute()],
    });
    expect(result.outcome).toBe('matched');
    expect(result.renderedResponse?.status).toBe(201);
  });

  it('keeps unmatched 404 when no variant claims the SKU', () => {
    const result = simulateSingle(ordersSample('OTHER', 'sample-other'), {
      routes: [ordersContractRoute()],
    });
    expect(result.outcome).toBe('unmatched');
    expect(result.renderedResponse?.status).toBe(404);
    expect(result.renderedResponse?.body).toContain('"error":"not_found"');
    expect(result.renderedResponse?.body).toContain('"requestId":"sample-other"');
  });

  it('does not fall back to 201 when FLAKY probability misses a timeout fault', () => {
    const result = simulateSingle(ordersSample('FLAKY'), {
      routes: [ordersContractRoute({ flakyFault: true, flakyProbability: 0 })],
      seed: 'flaky-prob-miss',
    });
    expect(result.outcome).toBe('matched');
    expect(result.renderedResponse?.status).toBe(503);
    expect(result.preview?.fault).toBe('none');
  });

  it('applies the timeout when FLAKY probability always hits, still not unmatched', () => {
    const result = simulateSingle(ordersSample('FLAKY'), {
      routes: [ordersContractRoute({ flakyFault: true, flakyProbability: 1 })],
      seed: 'flaky-timeout',
    });
    expect(result.outcome).toBe('fault');
    expect(result.outcome).not.toBe('unmatched');
    expect(result.preview?.selectedResponseId).toBe('v-503');
  });
});
