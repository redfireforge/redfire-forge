/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import {
  describeFailure,
  evaluateOperator,
  extractSecurityValue,
  extractValue,
  formatJsonPathValue,
  parseBodyCached,
  stripBasePath,
} from './predicateEvaluatorHelpers';
import type { ApiMockCapturedRequestV1, ApiMockPredicateV1 } from './contracts';
import { sha256HexSync } from './sha256Sync';

const ts = '2026-08-12T00:00:00.000Z';

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

function pred(overrides: Partial<ApiMockPredicateV1> = {}): ApiMockPredicateV1 {
  return {
    id: 'p1',
    source: 'header',
    selector: 'x-test',
    operator: 'exact',
    expected: 'yes',
    ...overrides,
  } as ApiMockPredicateV1;
}

describe('predicateEvaluatorHelpers', () => {
  it('strips base paths and preserves unmatched paths', () => {
    expect(stripBasePath('/api/v1/users', '/api/v1')).toBe('/users');
    expect(stripBasePath('/other', '/api')).toBe('/other');
    expect(stripBasePath('/api', '/api')).toBe('/');
    expect(stripBasePath('/users', '')).toBe('/users');
  });

  it('memoizes parsed bodies and handles invalid json', () => {
    const first = parseBodyCached('{"a":1}');
    const second = parseBodyCached('{"a":1}');
    const invalid = parseBodyCached('{bad');
    expect(first.ok).toBe(true);
    expect(second).toBe(first);
    expect(invalid.ok).toBe(false);
  });

  it('extracts values across sources including unknown and transport', () => {
    const request = req({
      query: { q: ['abc'] },
      headers: { 'x-test': ['yes'], authorization: ['Bearer tok'] },
      cookies: { theme: 'dark' },
      body: 'payload',
    });
    expect(extractValue(pred({ source: 'pathParam', selector: 'id' }), request, { id: '42' })).toBe('42');
    expect(extractValue(pred({ source: 'query', selector: 'q' }), request, {})).toEqual(['abc']);
    expect(extractValue(pred({ source: 'header', selector: 'X-Test' }), request, {})).toEqual(['yes']);
    expect(extractValue(pred({ source: 'cookie', selector: 'theme' }), request, {})).toBe('dark');
    expect(extractValue(pred({ source: 'security', selector: 'tokenClaim' }), request, {})).toBe('tok');
    expect(extractValue(pred({ source: 'body', selector: undefined }), request, {})).toBe('payload');
    expect(extractValue(pred({ source: 'transport', selector: undefined }), request, {})).toBeNull();
    expect(extractValue(pred({ source: 'weird' as any, selector: undefined }), request, {})).toBeNull();
    expect(extractValue(pred({ source: 'pathParam', selector: undefined }), request, { id: '42' })).toBeNull();
    expect(extractValue(pred({ source: 'query', selector: undefined }), request, {})).toBeNull();
    expect(extractValue(pred({ source: 'header', selector: undefined }), request, {})).toBeNull();
    expect(extractValue(pred({ source: 'cookie', selector: undefined }), request, {})).toBeNull();
  });

  it('extracts security selectors and their null fallbacks', () => {
    const basic = btoa('alice:secret');
    const request = req({ headers: { authorization: [`Basic ${basic}`], 'x-api-key': ['sk'] } });
    const requestApiKey = req({ headers: { 'api-key': ['sk'] } });
    const requestAuthToken = req({ headers: { 'x-auth-token': ['sk'] } });
    expect(extractSecurityValue('scheme', req({ headers: { authorization: ['Bearer token'] } }))).toBe('Bearer');
    expect(extractSecurityValue('scheme', req({ headers: { authorization: ['BearerToken'] } }))).toBe('BearerToken');
    expect(extractSecurityValue('scheme', req())).toBeNull();
    expect(extractSecurityValue('username', request)).toBe('alice');
    expect(extractSecurityValue('username', req({ headers: { authorization: ['Basic Og=='] } }))).toBeNull();
    expect(extractSecurityValue('username', req({ headers: { authorization: ['Bearer token'] } }))).toBeNull();
    expect(extractSecurityValue('username', req({ headers: { authorization: ['Basic !!!'] } }))).toBeNull();
    expect(extractSecurityValue('tokenClaim', req({ headers: { authorization: ['Bearer token'] } }))).toBe('token');
    expect(extractSecurityValue('tokenClaim', req({ headers: { authorization: ['Basic x'] } }))).toBeNull();
    expect(extractSecurityValue('apiKeyName', request)).toBe('x-api-key');
    expect(extractSecurityValue('apiKeyName', requestApiKey)).toBe('api-key');
    expect(extractSecurityValue('apiKeyName', requestAuthToken)).toBe('x-auth-token');
    expect(extractSecurityValue('apiKeyLocation', request)).toBe('header');
    expect(extractSecurityValue('apiKeyLocation', requestApiKey)).toBe('header');
    expect(extractSecurityValue('apiKeyLocation', requestAuthToken)).toBe('header');
    expect(extractSecurityValue('apiKeyName', req())).toBeNull();
    expect(extractSecurityValue('apiKeyLocation', req())).toBeNull();
    expect(extractSecurityValue(undefined, req())).toBeNull();
    expect(extractSecurityValue('unknown', req())).toBeNull();
    expect(extractSecurityValue('certSubject', req({ clientCertSubject: 'CN=acme-client' }))).toBe('CN=acme-client');
    expect(extractSecurityValue('certSubject', req())).toBeNull();
  });

  it('evaluates scalar operators including absent/present/prefix/suffix/regex/glob', () => {
    expect(evaluateOperator('present', 'x', undefined)).toBe(true);
    expect(evaluateOperator('present', '', undefined)).toBe(false);
    expect(evaluateOperator('absent', null, undefined)).toBe(true);
    expect(evaluateOperator('absent', 'x', undefined)).toBe(false);
    expect(evaluateOperator('exact', ['YES'], 'yes', { caseSensitive: false })).toBe(true);
    expect(evaluateOperator('exact', 'no', 'yes')).toBe(false);
    expect(evaluateOperator('contains', ['alpha', 'beta'], 'et')).toBe(true);
    expect(evaluateOperator('contains', 'alpha', 'zzz')).toBe(false);
    expect(evaluateOperator('prefix', 'prefix-value', 'pre')).toBe(true);
    expect(evaluateOperator('prefix', 'prefix-value', 'zzz')).toBe(false);
    expect(evaluateOperator('suffix', 'prefix-value', 'value')).toBe(true);
    expect(evaluateOperator('suffix', 'prefix-value', 'zzz')).toBe(false);
    expect(evaluateOperator('regex', 'abc123', '^[a-z]+\\d+$')).toBe(true);
    expect(evaluateOperator('regex', 'ABC123', '^[a-z]+\\d+$', { caseSensitive: false })).toBe(true);
    expect(evaluateOperator('regex', 'ABC123', '^[a-z]+\\d+$')).toBe(false);
    expect(evaluateOperator('regex', 'abc123', '(bad')).toBe(false);
    expect(evaluateOperator('regex', null, '^[a-z]+$')).toBe(false);
    expect(evaluateOperator('glob', '/v1/users/42', '/v?/users/*')).toBe(true);
    expect(evaluateOperator('glob', '/V1/USERS/42', '/v?/users/*', { caseSensitive: false })).toBe(true);
    expect(evaluateOperator('glob', '/V1/USERS/42', '/v?/users/*')).toBe(false);
    expect(evaluateOperator('glob', '/v1/users/42', '[')).toBe(false);
    expect(evaluateOperator('glob', '/v1/users/42', '/v?/admin/*')).toBe(false);
  });

  it('evaluates json, form, binary, and unsupported operators', () => {
    expect(evaluateOperator('json_strict', '1', 1 as any)).toBe(true);
    expect(evaluateOperator('json_strict', '1', 2 as any)).toBe(false);
    expect(evaluateOperator('json_strict', 'null', null as any)).toBe(true);
    expect(evaluateOperator('json_strict', '[1,2]', { a: 1 } as any)).toBe(false);
    expect(evaluateOperator('json_strict', '{"b":2,"a":1}', { a: 1, b: 2 })).toBe(true);
    expect(evaluateOperator('json_strict', '{"a":1}', [1] as any)).toBe(false);
    expect(evaluateOperator('json_strict', '[1,{"a":2}]', [1, { a: 2 }] as any)).toBe(true);
    expect(evaluateOperator('json_strict', '[1,{"a":3}]', [1, { a: 2 }] as any)).toBe(false);
    expect(evaluateOperator('json_strict', '{bad', { a: 1 })).toBe(false);
    expect(evaluateOperator('json_strict', '{"a":1}', '{bad' as any)).toBe(false);
    expect(evaluateOperator('json_strict', null, { a: 1 })).toBe(false);
    expect(evaluateOperator('json_strict', ['{"a":1}'], { a: 1 })).toBe(true);
    expect(evaluateOperator('json_subset', '{"a":1,"b":2}', { a: 1 })).toBe(true);
    expect(evaluateOperator('json_subset', '1', 1 as any)).toBe(true);
    expect(evaluateOperator('json_subset', '{"a":1}', [1] as any)).toBe(false);
    expect(evaluateOperator('json_subset', '[1,2,3]', [1, 2] as any)).toBe(true);
    expect(evaluateOperator('json_subset', '[1,3]', [1, 2] as any)).toBe(false);
    expect(evaluateOperator('json_subset', '{"a":1}', '{bad' as any)).toBe(false);
    expect(evaluateOperator('json_subset', null, { a: 1 })).toBe(false);
    expect(evaluateOperator('json_subset', ['{"a":1,"b":2}'], { a: 1 })).toBe(true);
    expect(evaluateOperator('jsonPath_exists', '{"user":{"email":"a@b.com"}}', '$.user.email')).toBe(true);
    expect(evaluateOperator('jsonPath_exists', '{"user":"a@b.com"}', '$.user.email')).toBe(false);
    expect(evaluateOperator('jsonPath_exists', '{bad', '$.user.email')).toBe(false);
    expect(evaluateOperator('jsonPath_exists', null, '$.user.email')).toBe(false);
    expect(evaluateOperator('jsonPath_exists', '{"user":1}', ['$.user'] as any)).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"role":"admin"}', ['$.role', 'admin'])).toBe(true);
    expect(evaluateOperator('jsonPath_equals', '{"role":"user"}', ['$.role', 'admin'])).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"role":"user"}', ['$.role'] as any)).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"role":"admin"}', [1 as unknown as string, 'admin'])).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{bad', ['$.role', 'admin'])).toBe(false);
    expect(evaluateOperator('jsonPath_equals', null, ['$.role', 'admin'])).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"role":"user"}', 'role' as any)).toBe(false);
    expect(evaluateOperator('jsonPath_equals', ['{"role":"admin"}'], ['$.role', 'admin'])).toBe(true);
    expect(evaluateOperator('jsonPath_exists', '{"items":[{"sku":"RF-100"}]}', '$.items[0].sku')).toBe(true);
    expect(evaluateOperator('jsonPath_equals', '{"items":[{"sku":"RF-100"}]}', ['$.items[0].sku', 'RF-100'])).toBe(true);
    expect(evaluateOperator('jsonPath_exists', '{"items":[{"sku":"RF-100"}]}', '$.items[1].sku')).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"customer":{"id":"C-4421","tier":"gold"}}', ['$.customer', '{"id":"C-4421","tier":"gold"}'])).toBe(true);
    expect(evaluateOperator('jsonPath_equals', '{"customer":{"tier":"gold","id":"C-4421"}}', ['$.customer', '{\n  "id": "C-4421",\n  "tier": "gold"\n}'])).toBe(true);
    expect(evaluateOperator('jsonPath_equals', '{"items":[1,2]}', ['$.items', [1, 2] as unknown as string])).toBe(true);
    expect(evaluateOperator('jsonPath_equals', '{"role":"administrator"}', ['$.role', 'admin'], { matchStyle: 'subset' })).toBe(true);
    expect(evaluateOperator('jsonPath_equals', '{"role":"user"}', ['$.role', 'admin'], { matchStyle: 'subset' })).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"role":"admin"}', ['$.role', ''], { matchStyle: 'subset' })).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"role":""}', ['$.role', ''], { matchStyle: 'subset' })).toBe(true);
    expect(evaluateOperator(
      'jsonPath_equals',
      '{"customer":{"tier":"gold","id":"C-4421"}}',
      ['$.customer', '{\n  "id": "C-4421",\n  "tier": "gold"\n}'],
      { matchStyle: 'subset' },
    )).toBe(true);
    expect(evaluateOperator('jsonPath_equals', '{"role":"admin"}', ['$.missing', 'admin'])).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"n":1}', ['$.n', '{"nope"'])).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"customer":{"id":1}}', ['$.customer', '{nope'])).toBe(false);
    expect(evaluateOperator('jsonPath_equals', '{"customer":{"id":1}}', ['$.customer', 'gold'])).toBe(false);
    expect(formatJsonPathValue(undefined)).toBe('');
    expect(formatJsonPathValue({ a: 1 })).toBe('{"a":1}');
    expect(evaluateOperator('form_field_exact', 'csrf=token', ['csrf', 'token'])).toBe(true);
    expect(evaluateOperator('form_field_exact', 'csrf=token', ['csrf', 'other'])).toBe(false);
    expect(evaluateOperator('form_field_exact', 'csrf=', ['csrf'] as any)).toBe(true);
    expect(evaluateOperator('form_field_regex', 'csrf=token123', ['csrf', 'tok.*'])).toBe(true);
    expect(evaluateOperator('form_field_regex', 'csrf=bad', ['csrf', 'tok.*'])).toBe(false);
    expect(evaluateOperator('form_field_regex', 'other=1', ['csrf', 'tok.*'])).toBe(false);
    expect(evaluateOperator('form_field_regex', 'csrf=abc', ['csrf'] as any)).toBe(true);
    expect(evaluateOperator('form_field_present', 'csrf=token123', ['csrf'])).toBe(true);
    expect(evaluateOperator('form_field_present', 'other=1', ['csrf'])).toBe(false);
    expect(evaluateOperator('form_field_present', 'csrf=token123', 'csrf' as any)).toBe(false);
    expect(evaluateOperator('form_field_exact', null, ['csrf', 'token'])).toBe(false);
    expect(evaluateOperator('binary_exact', 'ping', 'ping')).toBe(true);
    expect(evaluateOperator('binary_exact', 'pong', 'ping')).toBe(false);
    expect(evaluateOperator('binary_sha256', 'ping', 'hash')).toBe(false);
    expect(evaluateOperator('jsonSchema', '{"a":1}', { type: 'number' } as any)).toBe(false);
    expect(evaluateOperator('jsonSchema', '{"a":1}', { type: 'object' } as any)).toBe(true);
    // XPath is evaluated for real now — see xpathMatcher.test.ts for coverage.
    expect(evaluateOperator('xpath_exists', '<x />', '/x')).toBe(true);
    expect(evaluateOperator('xpath_exists', '<x />', '/nope')).toBe(false);
    expect(evaluateOperator('xpath_equals', '<x>1</x>', ['/x/text()', '1'] as any)).toBe(true);
    expect(evaluateOperator('xpath_equals', '<x>1</x>', ['/x/text()', '2'] as any)).toBe(false);
    expect(evaluateOperator('xmlSchema', '<x />', {} as any)).toBe(true);
    expect(evaluateOperator('xmlSchema', '<x />', 'Missing')).toBe(false);
    expect(evaluateOperator('multipart_field', 'data', 'field')).toBe(false);
    expect(evaluateOperator('multipart_file', 'data', 'file')).toBe(false);
    const digest = sha256HexSync('ping');
    expect(evaluateOperator('binary_sha256', 'ping', digest)).toBe(true);
    const mp = ['------b', 'Content-Disposition: form-data; name="note"', '', 'hi', '------b--', ''].join('\r\n');
    expect(evaluateOperator('multipart_field', mp, 'note', undefined, { contentType: 'multipart/form-data; boundary=----b' })).toBe(true);
    expect(evaluateOperator('unknown' as any, 'data', 'x')).toBe(false);
  });

  it('formats absent, joined, and truncated failure descriptions', () => {
    expect(describeFailure(pred({ source: 'query', selector: 'q', operator: 'exact' }), null)).toContain('was absent');
    expect(describeFailure(pred({ source: 'header', selector: 'accept', operator: 'exact' }), ['text/html', 'application/json'])).toContain('text/html, application/json');
    expect(describeFailure(pred({ source: 'body', selector: undefined, operator: 'exact' }), 'A'.repeat(120))).toContain('…');
  });
});
