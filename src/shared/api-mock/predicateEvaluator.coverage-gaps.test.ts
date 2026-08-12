/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { evaluateRoute } from './predicateEvaluator';
import { createDefaultResponse } from './defaults';
import type { ApiMockRouteV1, ApiMockCapturedRequestV1, ApiMockPredicateGroupV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function route(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'r1',
    name: 'Test',
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
  return {
    method: 'GET',
    path: '/test',
    rawPath: '/test',
    query: {},
    headers: {},
    cookies: {},
    body: null,
    bodyTruncated: false,
    receivedAt: ts,
    ...overrides,
  };
}

function preds(combinator: ApiMockPredicateGroupV1['combinator'], ...children: ApiMockPredicateGroupV1['children']): ApiMockPredicateGroupV1 {
  return { id: 'pg', combinator, children };
}

describe('predicateEvaluator coverage gaps', () => {
  it('covers query/header/pathParam/cookie missing selectors and transport source', () => {
    const r = route({ predicates: preds('all',
      { id: 'p1', source: 'query', operator: 'absent' },
      { id: 'p2', source: 'header', operator: 'absent' },
      { id: 'p3', source: 'pathParam', operator: 'absent' },
      { id: 'p4', source: 'cookie', operator: 'absent' },
      { id: 'p5', source: 'transport', operator: 'absent' },
    ) });
    expect(evaluateRoute(r, req(), '').overallMatch).toBe(true);
  });

  it('covers security selectors for missing/invalid/basic/bearer/api-key variants', () => {
    const basicBad = route({ predicates: preds('all', { id: 'p1', source: 'security', selector: 'username', operator: 'absent' }) });
    expect(evaluateRoute(basicBad, req({ headers: { authorization: ['Basic !!!'] } }), '').overallMatch).toBe(true);

    const token = route({ predicates: preds('all', { id: 'p1', source: 'security', selector: 'tokenClaim', operator: 'exact', expected: 'abc' }) });
    expect(evaluateRoute(token, req({ headers: { authorization: ['Bearer abc'] } }), '').overallMatch).toBe(true);
    expect(evaluateRoute(token, req({ headers: { authorization: ['Basic xyz'] } }), '').overallMatch).toBe(false);

    const apiLoc = route({ predicates: preds('all', { id: 'p1', source: 'security', selector: 'apiKeyLocation', operator: 'exact', expected: 'header' }) });
    expect(evaluateRoute(apiLoc, req({ headers: { 'x-auth-token': ['sk'] } }), '').overallMatch).toBe(true);

    const unknownSelector = route({ predicates: preds('all', { id: 'p1', source: 'security', selector: 'unknown' as any, operator: 'absent' }) });
    expect(evaluateRoute(unknownSelector, req(), '').overallMatch).toBe(true);
  });

  it('covers prefix/suffix/glob and repeated array matching branches', () => {
    const r = route({ predicates: preds('all',
      { id: 'p1', source: 'header', selector: 'accept', operator: 'prefix', expected: 'application/' },
      { id: 'p2', source: 'header', selector: 'accept', operator: 'suffix', expected: 'json' },
      { id: 'p3', source: 'query', selector: 'path', operator: 'glob', expected: '/v?/users/*' },
    ) });
    const result = evaluateRoute(r, req({ headers: { accept: ['text/html', 'application/json'] }, query: { path: ['/v1/users/42'] } }), '');
    expect(result.overallMatch).toBe(true);
  });

  it('covers json and form-field failure branches', () => {
    const strictBadExpected = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'json_strict', expected: '{bad' as any }) });
    expect(evaluateRoute(strictBadExpected, req({ body: '{"a":1}' }), '').overallMatch).toBe(false);

    const subsetBadExpected = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'json_subset', expected: '{bad' as any }) });
    expect(evaluateRoute(subsetBadExpected, req({ body: '{"a":1}' }), '').overallMatch).toBe(false);

    const pathEqShort = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'jsonPath_equals', expected: ['$.a'] as any }) });
    expect(evaluateRoute(pathEqShort, req({ body: '{"a":1}' }), '').overallMatch).toBe(false);

    const formBadExpected = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'form_field_present', expected: 'csrf' as any }) });
    expect(evaluateRoute(formBadExpected, req({ body: 'csrf=1' }), '').overallMatch).toBe(false);

    const formRegexMissing = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'form_field_regex', expected: ['csrf', 'tok.*'] }) });
    expect(evaluateRoute(formRegexMissing, req({ body: 'other=1' }), '').overallMatch).toBe(false);
  });

  it('covers binary and unsupported operators plus NOT false branch', () => {
    const supported = route({ predicates: preds('all',
      { id: 'p1', source: 'body', operator: 'binary_exact', expected: 'ping' },
    ) });
    expect(evaluateRoute(supported, req({ body: 'ping' }), '').overallMatch).toBe(true);

    const unsupported = route({ predicates: preds('all',
      { id: 'p1', source: 'body', operator: 'binary_sha256', expected: 'hash' },
    ) });
    expect(evaluateRoute(unsupported, req({ body: 'ping' }), '').overallMatch).toBe(false);

    const xml = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'xmlSchema', expected: 'x' as any }) });
    expect(evaluateRoute(xml, req({ body: '<x />' }), '').overallMatch).toBe(false);

    const notFalse = route({ predicates: preds('not', { id: 'p1', source: 'header', selector: 'x-block', operator: 'present' }) });
    expect(evaluateRoute(notFalse, req({ headers: { 'x-block': ['yes'] } }), '').overallMatch).toBe(false);
  });

  it('covers long failure descriptions and body parse cache reuse branches', () => {
    const long = 'A'.repeat(120);
    const r = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'exact', expected: 'needle' }) });
    const result1 = evaluateRoute(r, req({ body: long }), '');
    const result2 = evaluateRoute(r, req({ body: long }), '');
    expect(result1.predicateResults[0].reason).toContain('…');
    expect(result2.overallMatch).toBe(false);
  });

  it('covers security null branches and bare auth schemes', () => {
    const schemeBare = route({ predicates: preds('all', { id: 'p1', source: 'security', selector: 'scheme', operator: 'exact', expected: 'BearerToken' }) });
    expect(evaluateRoute(schemeBare, req({ headers: { authorization: ['BearerToken'] } }), '').overallMatch).toBe(true);

    const schemeMissing = route({ predicates: preds('all', { id: 'p1', source: 'security', selector: 'scheme', operator: 'absent' }) });
    expect(evaluateRoute(schemeMissing, req(), '').overallMatch).toBe(true);

    const apiKeyNameAbsent = route({ predicates: preds('all', { id: 'p1', source: 'security', selector: 'apiKeyName', operator: 'absent' }) });
    expect(evaluateRoute(apiKeyNameAbsent, req(), '').overallMatch).toBe(true);

    const apiKeyLocAbsent = route({ predicates: preds('all', { id: 'p1', source: 'security', selector: 'apiKeyLocation', operator: 'absent' }) });
    expect(evaluateRoute(apiKeyLocAbsent, req(), '').overallMatch).toBe(true);
  });

  it('covers json/form/body null and malformed branches', () => {
    const bodyNullStrict = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'json_strict', expected: { a: 1 } }) });
    expect(evaluateRoute(bodyNullStrict, req(), '').overallMatch).toBe(false);

    const bodyBadJson = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'jsonPath_exists', expected: '$.a' }) });
    expect(evaluateRoute(bodyBadJson, req({ body: '{bad' }), '').overallMatch).toBe(false);

    const bodyPathBad = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'jsonPath_equals', expected: ['$.a', '1'] }) });
    expect(evaluateRoute(bodyPathBad, req({ body: '{bad' }), '').overallMatch).toBe(false);

    const formNull = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'form_field_exact', expected: ['csrf', 'x'] }) });
    expect(evaluateRoute(formNull, req(), '').overallMatch).toBe(false);
  });

  it('covers strict/subset structural mismatch branches', () => {
    const strictArrayMismatch = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'json_strict', expected: [1, 2] as any }) });
    expect(evaluateRoute(strictArrayMismatch, req({ body: '[1]' }), '').overallMatch).toBe(false);

    const strictKeyMismatch = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'json_strict', expected: { a: 1, b: 2 } }) });
    expect(evaluateRoute(strictKeyMismatch, req({ body: '{"a":1}' }), '').overallMatch).toBe(false);

    const subsetArrayNeedsArray = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'json_subset', expected: [1] as any }) });
    expect(evaluateRoute(subsetArrayNeedsArray, req({ body: '{"a":1}' }), '').overallMatch).toBe(false);

    const subsetArrayLength = route({ predicates: preds('all', { id: 'p1', source: 'body', operator: 'json_subset', expected: [1, 2] as any }) });
    expect(evaluateRoute(subsetArrayLength, req({ body: '[1]' }), '').overallMatch).toBe(false);
  });

  it('covers repeated-array failure formatting and unknown predicate sources', () => {
    const repeatedFail = route({ predicates: preds('all', { id: 'p1', source: 'header', selector: 'accept', operator: 'exact', expected: 'application/xml' }) });
    const result = evaluateRoute(repeatedFail, req({ headers: { accept: ['text/html', 'application/json'] } }), '');
    expect(result.overallMatch).toBe(false);
    expect(result.predicateResults[0].reason).toContain('text/html, application/json');

    const unknownSource = route({ predicates: preds('all', { id: 'p1', source: 'weird' as any, operator: 'absent' }) });
    expect(evaluateRoute(unknownSource, req(), '').overallMatch).toBe(true);
  });
});
