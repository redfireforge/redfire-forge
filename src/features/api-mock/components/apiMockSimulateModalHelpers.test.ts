/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1, ApiMockSimulationResultV1 } from '../../../shared/api-mock/contracts';
import {
  annotateSimulatePass,
  reannotateSimulatePass,
  buildAutoRouteSamples,
  exactHeadersFromAllOf,
  capturedHeadersFromText,
  lowercaseHeaderMap,
  createSavedSimulationSample,
  downloadSimulationTrace,
  headersToText,
  isAutoRouteSample,
  mergeSimulateSamples,
  nearMissConditionSummary,
  orderTracePredicateResults,
  outcomeBadge,
  isNoneOfChild,
  predicateTraceDetail,
  predicateTraceNote,
  predicateTraceSatisfied,
  predicateTraceSource,
  parseSimulateHeaderLines,
  SIMULATE_METHOD_OPTIONS,
  SIMULATE_SEED_HELP,
  simulateRenderedBodyViews,
  suggestedSimulateSampleName,
  createSimulateReplaySeed,
  simulationTraceFilename,
  simulationTraceNoticePreview,
} from './apiMockSimulateModalHelpers';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(id: string, method: 'GET' | 'ANY' = 'GET'): ApiMockRouteV1 {
  return {
    id, name: `Route ${id}`, enabled: true, method,
    path: { kind: 'exact', value: `/${id}` }, priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules', responses: [createDefaultResponse(`resp-${id}`)],
    tags: [], createdAt: ts, updatedAt: ts,
  };
}

describe('apiMockSimulateModalHelpers', () => {
  it('colors simulate method options like Requests', () => {
    expect(SIMULATE_METHOD_OPTIONS[0]).toMatchObject({
      value: 'GET',
      detail: 'Retrieve data',
      swatch: '#22c55e',
    });
  });

  it('detects auto-generated from-rules probes', () => {
    expect(isAutoRouteSample('auto-r1')).toBe(true);
    expect(isAutoRouteSample('sample-ab12')).toBe(false);
    expect(isAutoRouteSample('adhoc')).toBe(false);
  });

  it('parses header lines and skips rows without a colon', () => {
    expect(parseSimulateHeaderLines('X-Tenant: acme\nInvalid\nX-Trace: a:b:c')).toEqual({
      'X-Tenant': 'acme',
      'X-Trace': 'a:b:c',
    });
    expect(capturedHeadersFromText('X-Tenant: acme')).toEqual({ 'x-tenant': ['acme'] });
    expect(lowercaseHeaderMap({ 'X-Api-Version': ['2024-11'], 'X-Tenant': 'acme-eu' })).toEqual({
      'x-api-version': ['2024-11'],
      'x-tenant': ['acme-eu'],
    });
    expect(lowercaseHeaderMap({ Accept: ['a'], accept: ['b'], skip: undefined })).toEqual({
      accept: ['a', 'b'],
    });
  });

  it('renders header maps including multi-value rows', () => {
    expect(headersToText({ Accept: 'application/json', 'X-Id': ['a', 'b'] }))
      .toBe('Accept: application/json\nX-Id: a, b');
  });

  it('maps outcomes onto badge tones', () => {
    expect(outcomeBadge('matched')).toBe('success');
    expect(outcomeBadge('ambiguous')).toBe('warning');
    expect(outcomeBadge('fault')).toBe('warning');
    expect(outcomeBadge('unmatched')).toBe('danger');
  });

  it('suggests a sample name from the live method and path', () => {
    expect(suggestedSimulateSampleName('PUT', '/firmware')).toBe('PUT /firmware');
    expect(suggestedSimulateSampleName('GET', '')).toBe('GET /');
  });

  it('overlays local saved copies on persisted samples so a rename wins', () => {
    const server = [
      { id: 's1', name: 'Old', request: { method: 'GET', path: '/a' } },
      { id: 's2', name: 'Keep', request: { method: 'GET', path: '/b' } },
    ] as never;
    const local = [
      { id: 's1', name: 'Renamed', request: { method: 'GET', path: '/a' } },
      { id: 's3', name: 'New', request: { method: 'POST', path: '/c' } },
    ] as never;
    expect(mergeSimulateSamples(server, local).map(s => s.id)).toEqual(['s1', 's2', 's3']);
    expect(mergeSimulateSamples(server, local)[0].name).toBe('Renamed');
    expect(mergeSimulateSamples(undefined, local)).toHaveLength(2);
  });

  it('copies All-of exact header predicates onto from-rules probes', () => {
    const route = makeRoute('catalog');
    route.predicates = {
      id: 'pg',
      combinator: 'all',
      children: [
        { id: 'p-ver', source: 'header', selector: 'X-Api-Version', operator: 'exact', expected: '2024-11' },
        { id: 'any', combinator: 'any', children: [
          { id: 'p-eu', source: 'header', selector: 'x-tenant', operator: 'exact', expected: 'acme-eu' },
        ] },
      ],
    };
    expect(exactHeadersFromAllOf(route.predicates)).toEqual({ 'x-api-version': ['2024-11'] });
    expect(buildAutoRouteSamples([route])[0]?.request.headers).toEqual({ 'x-api-version': ['2024-11'] });
    expect(exactHeadersFromAllOf(undefined)).toEqual({});
    expect(exactHeadersFromAllOf({ id: 'pg', combinator: 'any', children: [] })).toEqual({});
  });

  it('builds at most five from-rules probes and treats ANY as GET', () => {
    const routes = Array.from({ length: 6 }, (_, i) => makeRoute(`r${i}`, i === 0 ? 'ANY' : 'GET'));
    const samples = buildAutoRouteSamples(routes);
    expect(samples).toHaveLength(5);
    expect(samples[0].id).toBe('auto-r0');
    expect(samples[0].request.method).toBe('GET');
    expect(samples[0].request.path).toBe('/r0');
    expect(samples[0].request.body).toBeNull();
  });

  it('stamps a saved sample with the current request and optional trace expectations', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('abcd1234-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    const request = {
      method: 'POST', path: '/oauth/token', rawPath: '/oauth/token',
      query: {}, cookies: {}, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials', bodyTruncated: false, receivedAt: ts,
    };
    const bare = createSavedSimulationSample('POST /oauth/token', request);
    expect(bare.id).toBe('sample-abcd1234');
    expect(bare.expected).toEqual({ outcome: 'matched' });

    const result = {
      outcome: 'matched',
      trace: { policyDecision: { selectedRouteId: 'r-token' } },
      preview: { selectedResponseId: 'resp-1' },
      renderedResponse: { status: 200 },
    } as ApiMockSimulationResultV1;
    const proven = createSavedSimulationSample('Token happy path', request, result);
    expect(proven.routeId).toBe('r-token');
    expect(proven.expected).toEqual({
      outcome: 'matched',
      routeId: 'r-token',
      responseId: 'resp-1',
      status: 200,
    });
  });

  it('annotates pass from existing engine result, expectations, or outcome', () => {
    const sample = {
      id: 's1',
      name: 'S',
      request: { method: 'GET', path: '/', rawPath: '/', query: {}, cookies: {}, headers: {}, body: null, bodyTruncated: false, receivedAt: ts },
      expected: { outcome: 'matched' as const, routeId: 'r1', responseId: 'resp-1', status: 200, bodyContains: 'ok', bodyExact: '{"ok":true}' },
    };
    const enginePassed = { outcome: 'matched', passed: true } as ApiMockSimulationResultV1;
    expect(annotateSimulatePass(sample, enginePassed).passed).toBe(true);

    const mismatch = {
      outcome: 'matched',
      trace: { policyDecision: { selectedRouteId: 'r1' } },
      preview: { selectedResponseId: 'resp-1' },
      renderedResponse: { status: 200, body: '{"ok":true}' },
    } as ApiMockSimulationResultV1;
    expect(annotateSimulatePass(sample, mismatch).passed).toBe(true);
    expect(annotateSimulatePass(sample, { ...mismatch, renderedResponse: { status: 200, body: 'nope' } } as ApiMockSimulationResultV1).passed).toBe(false);

    const bare = { ...sample, expected: undefined };
    expect(annotateSimulatePass(bare, { outcome: 'matched' } as ApiMockSimulationResultV1).passed).toBe(true);
    expect(annotateSimulatePass(bare, { outcome: 'ambiguous' } as ApiMockSimulationResultV1).passed).toBe(false);

    const stalePass = { ...mismatch, passed: true } as ApiMockSimulationResultV1;
    expect(reannotateSimulatePass({ ...sample, expected: { ...sample.expected!, status: 201 } }, stalePass).passed).toBe(false);
  });

  it('downloads a simulation trace JSON file', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:trace');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args) => {
      const el = origCreate(tag, ...args);
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(click);
      return el;
    });
    downloadSimulationTrace('srv-1', '12345', []);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:trace');
    expect(simulationTraceFilename('12345')).toBe('api-mock-sim-trace-12345.json');
    expect(simulationTraceNoticePreview('srv-1', '12345', 2)).toContain('"resultCount": 2');
  });

  it('mints a five-digit session seed from the random source', () => {
    expect(createSimulateReplaySeed(() => 0)).toBe('10000');
    expect(createSimulateReplaySeed(() => 0.9999)).toBe('99991');
    expect(SIMULATE_SEED_HELP).toMatch(/Same number repeats random choices/);
  });

  it('pretty-prints object and array JSON bodies and leaves everything else alone', () => {
    expect(simulateRenderedBodyViews('{"id":42,"name":"Espresso"}')).toEqual({
      pretty: '{\n  "id": 42,\n  "name": "Espresso"\n}',
      compact: '{"id":42,"name":"Espresso"}',
      canFormat: true,
    });
    expect(simulateRenderedBodyViews('[1,2]')).toEqual({
      pretty: '[\n  1,\n  2\n]',
      compact: '[1,2]',
      canFormat: true,
    });
    expect(simulateRenderedBodyViews(undefined)).toEqual({ pretty: '', compact: '', canFormat: false });
    expect(simulateRenderedBodyViews('')).toEqual({ pretty: '', compact: '', canFormat: false });
    expect(simulateRenderedBodyViews('not json')).toEqual({ pretty: 'not json', compact: 'not json', canFormat: false });
    expect(simulateRenderedBodyViews('"just a string"')).toEqual({
      pretty: '"just a string"',
      compact: '"just a string"',
      canFormat: true,
    });
  });

  it('orders failed predicate rows first and labels group vs leaf traces', () => {
    const passed = { predicateId: 'p1', groupId: '', source: 'query', operator: 'exact' as const, passed: true, evaluated: true, selector: 'page' };
    const failed = { predicateId: 'g1', groupId: '', source: 'None of', operator: 'present' as const, passed: false, evaluated: true, combinator: 'not' as const, reason: 'rejected — header "x-debug" matched' };
    expect(orderTracePredicateResults([passed, failed], false).map(r => r.predicateId)).toEqual(['g1', 'p1']);
    expect(orderTracePredicateResults([passed, failed], true)[0].predicateId).toBe('p1');
    expect(predicateTraceSource(failed)).toBe('None of');
    expect(predicateTraceSource(passed)).toBe('query');
    expect(predicateTraceDetail(failed)).toContain('x-debug');
    expect(predicateTraceDetail(passed)).toBe('page · exact');
    expect(predicateTraceNote(failed)).toBe('rejected');
    expect(predicateTraceNote(passed)).toBe('passed');
    expect(predicateTraceNote({ ...passed, evaluated: false })).toBe('skipped');
    expect(predicateTraceNote({ ...failed, passed: true })).toBe('held');
    expect(predicateTraceDetail({ ...passed, selector: undefined })).toBe('exact');
    expect(predicateTraceDetail({
      ...passed, source: 'header', reason: 'header "x-debug" was absent — as required',
    })).toBe('"x-debug" was absent — as required');

    const noneOf = {
      predicateId: 'group:guard', groupId: 'pg', source: 'None of', operator: 'present' as const,
      passed: true, evaluated: true, combinator: 'not' as const, reason: 'passed — no child matched',
    };
    const absentLeaf = {
      predicateId: 'p-debug', groupId: 'guard', source: 'header', operator: 'present' as const,
      passed: false, evaluated: true, selector: 'x-debug', reason: 'header "x-debug" was absent — as required',
    };
    const presentLeaf = { ...absentLeaf, passed: true, reason: 'header "x-debug" matched — rejected by None of' };
    expect(isNoneOfChild(absentLeaf, [absentLeaf, noneOf])).toBe(true);
    expect(isNoneOfChild(noneOf, [absentLeaf, noneOf])).toBe(false);
    expect(predicateTraceSatisfied(absentLeaf, [absentLeaf, noneOf])).toBe(true);
    expect(predicateTraceNote(absentLeaf, [absentLeaf, noneOf])).toBe('held');
    expect(predicateTraceSatisfied(presentLeaf, [presentLeaf, { ...noneOf, passed: false }])).toBe(false);
    expect(predicateTraceNote(presentLeaf, [presentLeaf, { ...noneOf, passed: false }])).toBe('rejected');
    expect(nearMissConditionSummary([
      { routeName: 'List Reports', failedPredicates: [{ reason: 'rejected — header "x-debug" matched' }] },
    ])).toContain('x-debug');
    expect(nearMissConditionSummary([{ routeName: 'A' }, { routeName: 'B' }])).toBe(
      'A, B matched method/path but failed conditions.',
    );
    expect(nearMissConditionSummary([])).toBe('Matched method/path but failed conditions.');
  });
});
