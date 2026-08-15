/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { evaluateRoute } from './predicateEvaluator';
import { createDefaultResponse } from './defaults';
import type { ApiMockRouteV1, ApiMockCapturedRequestV1, ApiMockPredicateGroupV1 } from './contracts';

const ts = '2026-08-11T00:00:00.000Z';

function route(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'r1', name: 'Test', enabled: true, method: 'GET',
    path: { kind: 'exact', value: '/test' }, priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
    tags: [], createdAt: ts, updatedAt: ts, ...overrides,
  };
}

function req(overrides: Partial<ApiMockCapturedRequestV1> = {}): ApiMockCapturedRequestV1 {
  return {
    method: 'GET', path: '/test', rawPath: '/test', query: {}, headers: {},
    cookies: {}, body: null, bodyTruncated: false, receivedAt: ts, ...overrides,
  };
}

function preds(...children: ApiMockPredicateGroupV1['children']): ApiMockPredicateGroupV1 {
  return { id: 'pg', combinator: 'all', children };
}

describe('evaluateRoute', () => {
  describe('method matching', () => {
    it('matches exact method', () => {
      expect(evaluateRoute(route(), req(), '').overallMatch).toBe(true);
    });
    it('rejects wrong method', () => {
      expect(evaluateRoute(route(), req({ method: 'POST' }), '').overallMatch).toBe(false);
    });
    it('ANY matches all methods', () => {
      expect(evaluateRoute(route({ method: 'ANY' }), req({ method: 'DELETE' }), '').overallMatch).toBe(true);
    });
    it('disabled route never matches', () => {
      expect(evaluateRoute(route({ enabled: false }), req(), '').overallMatch).toBe(false);
    });
  });

  describe('path matching', () => {
    it('matches exact path', () => {
      expect(evaluateRoute(route(), req(), '').overallMatch).toBe(true);
    });
    it('strips basePath', () => {
      const r = route({ path: { kind: 'exact', value: '/users' } });
      expect(evaluateRoute(r, req({ path: '/api/v1/users' }), '/api/v1').overallMatch).toBe(true);
    });
    it('parameterized path extracts params', () => {
      const r = route({ path: { kind: 'parameterized', value: '/users/:id' } });
      const result = evaluateRoute(r, req({ path: '/users/42' }), '');
      expect(result.overallMatch).toBe(true);
      expect(result.pathParams).toEqual({ id: '42' });
    });
  });

  describe('predicate: exact', () => {
    it('passes when header matches', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'header', selector: 'x-tenant', operator: 'exact', expected: 'acme' }) });
      expect(evaluateRoute(r, req({ headers: { 'x-tenant': ['acme'] } }), '').overallMatch).toBe(true);
    });
    it('fails when header differs', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'header', selector: 'x-tenant', operator: 'exact', expected: 'acme' }) });
      expect(evaluateRoute(r, req({ headers: { 'x-tenant': ['other'] } }), '').overallMatch).toBe(false);
    });
    it('case-insensitive exact match', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'header', selector: 'accept', operator: 'exact', expected: 'TEXT/HTML', options: { caseSensitive: false } }) });
      expect(evaluateRoute(r, req({ headers: { accept: ['text/html'] } }), '').overallMatch).toBe(true);
    });
  });

  describe('predicate: contains', () => {
    it('passes when query contains substring', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'query', selector: 'q', operator: 'contains', expected: 'hello' }) });
      expect(evaluateRoute(r, req({ query: { q: ['hello-world'] } }), '').overallMatch).toBe(true);
    });
    it('fails when not contained', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'query', selector: 'q', operator: 'contains', expected: 'xyz' }) });
      expect(evaluateRoute(r, req({ query: { q: ['hello'] } }), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: present/absent', () => {
    it('present passes when key exists', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'header', selector: 'authorization', operator: 'present' }) });
      expect(evaluateRoute(r, req({ headers: { authorization: ['Bearer tok'] } }), '').overallMatch).toBe(true);
    });
    it('present fails when key missing', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'header', selector: 'authorization', operator: 'present' }) });
      expect(evaluateRoute(r, req(), '').overallMatch).toBe(false);
    });
    it('absent passes when key missing', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'header', selector: 'authorization', operator: 'absent' }) });
      expect(evaluateRoute(r, req(), '').overallMatch).toBe(true);
    });
    it('absent fails when key exists', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'header', selector: 'authorization', operator: 'absent' }) });
      expect(evaluateRoute(r, req({ headers: { authorization: ['x'] } }), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: regex', () => {
    it('passes when regex matches', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'pathParam', selector: 'id', operator: 'regex', expected: '^[0-9]+$' }),
        path: { kind: 'parameterized', value: '/users/:id' } });
      expect(evaluateRoute(r, req({ path: '/users/42' }), '').overallMatch).toBe(true);
    });
    it('fails when regex does not match', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'pathParam', selector: 'id', operator: 'regex', expected: '^[0-9]+$' }),
        path: { kind: 'parameterized', value: '/users/:id' } });
      expect(evaluateRoute(r, req({ path: '/users/abc' }), '').overallMatch).toBe(false);
    });
    it('handles invalid regex', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'query', selector: 'q', operator: 'regex', expected: '(bad' }) });
      expect(evaluateRoute(r, req({ query: { q: ['test'] } }), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: cookie', () => {
    it('exact cookie match', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'cookie', selector: 'theme', operator: 'exact', expected: 'dark' }) });
      expect(evaluateRoute(r, req({ cookies: { theme: 'dark' } }), '').overallMatch).toBe(true);
    });
    it('cookie absent', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'cookie', selector: 'session', operator: 'absent' }) });
      expect(evaluateRoute(r, req({ cookies: {} }), '').overallMatch).toBe(true);
    });
  });

  describe('predicate: negation', () => {
    it('negate inverts the result', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'query', selector: 'status', operator: 'exact', expected: 'deleted', options: { negate: true } }) });
      expect(evaluateRoute(r, req({ query: { status: ['active'] } }), '').overallMatch).toBe(true);
    });
    it('negate fails when original passes', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'query', selector: 'status', operator: 'exact', expected: 'deleted', options: { negate: true } }) });
      expect(evaluateRoute(r, req({ query: { status: ['deleted'] } }), '').overallMatch).toBe(false);
    });
    it('negate inverts a compiled JSON Schema match', () => {
      const r = route({ predicates: preds({
        id: 'p1', source: 'body', operator: 'jsonSchema', expected: { type: 'object' } as never, options: { negate: true },
      }) });
      const result = evaluateRoute(r, req({ body: '{"a":1}' }), '');
      expect(result.overallMatch).toBe(false);
      expect(result.predicateResults[0].evaluated).toBe(true);
    });
    it('None-of around a matching JSON Schema does not match', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'not', children: [
          { id: 'p1', source: 'body', operator: 'jsonSchema', expected: { type: 'object' } as never },
        ],
      } });
      const result = evaluateRoute(r, req({ body: '{"a":1}' }), '');
      expect(result.overallMatch).toBe(false);
      expect(result.predicateResults[0].evaluated).toBe(true);
    });
  });

  describe('predicate: json_strict', () => {
    it('matches semantically equal JSON (key order differs)', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'json_strict', expected: { a: 1, b: 2 } }) });
      expect(evaluateRoute(r, req({ body: '{"b":2,"a":1}' }), '').overallMatch).toBe(true);
    });
    it('fails when JSON differs', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'json_strict', expected: { a: 1 } }) });
      expect(evaluateRoute(r, req({ body: '{"a":2}' }), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: json_subset', () => {
    it('matches when expected is subset of actual', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'json_subset', expected: { action: 'create' } }) });
      expect(evaluateRoute(r, req({ body: '{"action":"create","name":"test"}' }), '').overallMatch).toBe(true);
    });
    it('fails when expected key missing from actual', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'json_subset', expected: { missing: 'key' } }) });
      expect(evaluateRoute(r, req({ body: '{"other":"val"}' }), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: jsonPath_exists', () => {
    it('passes when path exists', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'jsonPath_exists', expected: '$.user.email' }) });
      expect(evaluateRoute(r, req({ body: '{"user":{"email":"a@b.com"}}' }), '').overallMatch).toBe(true);
    });
    it('fails when path missing', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'jsonPath_exists', expected: '$.user.phone' }) });
      expect(evaluateRoute(r, req({ body: '{"user":{"email":"a@b.com"}}' }), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: jsonPath_equals', () => {
    it('passes when path value matches', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'jsonPath_equals', expected: ['$.role', 'admin'] }) });
      expect(evaluateRoute(r, req({ body: '{"role":"admin"}' }), '').overallMatch).toBe(true);
    });
    it('fails when path value differs', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'jsonPath_equals', expected: ['$.role', 'admin'] }) });
      expect(evaluateRoute(r, req({ body: '{"role":"user"}' }), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: form_field_exact', () => {
    it('matches form field value', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'form_field_exact', expected: ['username', 'admin'] }) });
      expect(evaluateRoute(r, req({ body: 'username=admin&password=secret' }), '').overallMatch).toBe(true);
    });
    it('fails when field value differs', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'form_field_exact', expected: ['username', 'admin'] }) });
      expect(evaluateRoute(r, req({ body: 'username=guest' }), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: form_field_present', () => {
    it('passes when field exists', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'form_field_present', expected: ['csrf'] }) });
      expect(evaluateRoute(r, req({ body: 'csrf=token123' }), '').overallMatch).toBe(true);
    });
  });

  describe('predicate: security', () => {
    it('matches auth scheme', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'security', selector: 'scheme', operator: 'exact', expected: 'Bearer' }) });
      expect(evaluateRoute(r, req({ headers: { authorization: ['Bearer tok123'] } }), '').overallMatch).toBe(true);
    });
    it('matches basic username', () => {
      const encoded = btoa('alice:password');
      const r = route({ predicates: preds({ id: 'p1', source: 'security', selector: 'username', operator: 'exact', expected: 'alice' }) });
      expect(evaluateRoute(r, req({ headers: { authorization: [`Basic ${encoded}`] } }), '').overallMatch).toBe(true);
    });
    it('matches api key name', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'security', selector: 'apiKeyName', operator: 'exact', expected: 'x-api-key' }) });
      expect(evaluateRoute(r, req({ headers: { 'x-api-key': ['sk-test'] } }), '').overallMatch).toBe(true);
    });
    it('matches mTLS certificate subject', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'security', selector: 'certSubject', operator: 'exact', expected: 'CN=acme-client' }) });
      expect(evaluateRoute(r, req({ clientCertSubject: 'CN=acme-client' }), '').overallMatch).toBe(true);
      expect(evaluateRoute(r, req({ clientCertSubject: 'CN=other' }), '').overallMatch).toBe(false);
      expect(evaluateRoute(r, req(), '').overallMatch).toBe(false);
    });
  });

  describe('predicate: text body', () => {
    it('exact body match', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'exact', expected: 'ping' }) });
      expect(evaluateRoute(r, req({ body: 'ping' }), '').overallMatch).toBe(true);
    });
    it('body contains match', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'contains', expected: 'ERROR' }) });
      expect(evaluateRoute(r, req({ body: '2026-08-11 ERROR: fail' }), '').overallMatch).toBe(true);
    });
    it('body regex match', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'body', operator: 'regex', expected: '^\\d{4}-\\d{2}-\\d{2}' }) });
      expect(evaluateRoute(r, req({ body: '2026-08-11 log entry' }), '').overallMatch).toBe(true);
    });
  });

  describe('combinator: ANY', () => {
    it('passes if any child passes', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'any', children: [
          { id: 'p1', source: 'header', selector: 'x-a', operator: 'exact', expected: 'no' },
          { id: 'p2', source: 'header', selector: 'x-b', operator: 'exact', expected: 'yes' },
        ],
      } });
      expect(evaluateRoute(r, req({ headers: { 'x-b': ['yes'] } }), '').overallMatch).toBe(true);
    });

    it('records a failed Any-of group when no child passed', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'any', children: [
          { id: 'p1', source: 'header', selector: 'x-a', operator: 'exact', expected: 'yes' },
          { id: 'p2', source: 'header', selector: 'x-b', operator: 'exact', expected: 'yes' },
        ],
      } });
      const result = evaluateRoute(r, req(), '');
      expect(result.overallMatch).toBe(false);
      const group = result.predicateResults.find(p => p.combinator === 'any');
      expect(group?.passed).toBe(false);
      expect(group?.reason).toContain('no child passed');
    });

    it('supports nested groups as children', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'any', children: [
          {
            id: 'nested', combinator: 'all', children: [
              { id: 'p1', source: 'header', selector: 'x-a', operator: 'exact', expected: 'yes' },
            ],
          },
          { id: 'p2', source: 'header', selector: 'x-b', operator: 'exact', expected: 'no' },
        ],
      } });
      expect(evaluateRoute(r, req({ headers: { 'x-a': ['yes'] } }), '').overallMatch).toBe(true);
    });
  });

  describe('combinator: NOT', () => {
    it('passes if no child passes', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'not', children: [
          { id: 'p1', source: 'header', selector: 'x-block', operator: 'present' },
        ],
      } });
      expect(evaluateRoute(r, req(), '').overallMatch).toBe(true);
    });
    it('fails if any child passes', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'not', children: [
          { id: 'p1', source: 'header', selector: 'x-block', operator: 'present' },
        ],
      } });
      expect(evaluateRoute(r, req({ headers: { 'x-block': ['yes'] } }), '').overallMatch).toBe(false);
    });

    it('records a None-of group row when every leaf passed', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'not', children: [
          { id: 'p1', source: 'header', selector: 'x-debug', operator: 'present' },
        ],
      } });
      const result = evaluateRoute(r, req({ headers: { 'x-debug': ['1'] } }), '');
      expect(result.overallMatch).toBe(false);
      const group = result.predicateResults.find(p => p.combinator === 'not');
      expect(group?.passed).toBe(false);
      expect(group?.reason).toContain('header "x-debug"');
      expect(group?.reason).toMatch(/rejected/);
      const leaf = result.predicateResults.find(p => p.predicateId === 'p1');
      expect(leaf?.passed).toBe(true);
      expect(leaf?.reason).toContain('rejected by None of');
    });

    it('records a passing None-of group row when no child matched', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'not', children: [
          { id: 'p1', source: 'header', selector: 'x-debug', operator: 'present' },
        ],
      } });
      const result = evaluateRoute(r, req(), '');
      expect(result.overallMatch).toBe(true);
      const group = result.predicateResults.find(p => p.combinator === 'not');
      expect(group?.passed).toBe(true);
      expect(group?.reason).toContain('no child matched');
    });

    it('supports nested groups under NOT', () => {
      const r = route({ predicates: {
        id: 'pg', combinator: 'not', children: [
          {
            id: 'nested', combinator: 'all', children: [
              { id: 'p1', source: 'header', selector: 'x-block', operator: 'present' },
            ],
          },
        ],
      } });
      expect(evaluateRoute(r, req({ headers: { 'x-block': ['yes'] } }), '').overallMatch).toBe(false);
    });
  });

  describe('invalid predicate groups', () => {
    it('fails closed on unknown combinators', () => {
      const r = route({ predicates: {
        id: 'pg',
        combinator: 'weird' as any,
        children: [{ id: 'p1', source: 'header', selector: 'x-a', operator: 'present' }],
      } });
      const result = evaluateRoute(r, req({ headers: { 'x-a': ['yes'] } }), '');
      expect(result.overallMatch).toBe(false);
      expect(result.predicateResults.some(p => p.reason?.includes('unknown combinator'))).toBe(true);
    });
  });

  describe('predicate results', () => {
    it('records results for each predicate', () => {
      const r = route({ predicates: preds(
        { id: 'p1', source: 'header', selector: 'x-a', operator: 'exact', expected: 'yes' },
        { id: 'p2', source: 'header', selector: 'x-b', operator: 'exact', expected: 'yes' },
      ) });
      const result = evaluateRoute(r, req({ headers: { 'x-a': ['yes'], 'x-b': ['no'] } }), '');
      expect(result.predicateResults).toHaveLength(2);
      expect(result.predicateResults[0].passed).toBe(true);
      expect(result.predicateResults[1].passed).toBe(false);
      expect(result.predicateResults[1].reason).toContain('failed');
    });
  });

  describe('repeated header values', () => {
    it('matches any value in a repeated header', () => {
      const r = route({ predicates: preds({ id: 'p1', source: 'header', selector: 'accept', operator: 'contains', expected: 'json' }) });
      expect(evaluateRoute(r, req({ headers: { accept: ['text/html', 'application/json'] } }), '').overallMatch).toBe(true);
    });
  });

  describe('predicate: multipart_field', () => {
    const body = [
      'preamble ignored',
      '------bound',
      'Content-Disposition: form-data; name="note"',
      '',
      'hello',
      '------bound--',
      '',
    ].join('\r\n');

    it('reads boundary from captured contentType when the header map is empty', () => {
      const r = route({
        method: 'POST',
        predicates: preds({ id: 'p1', source: 'body', operator: 'multipart_field', expected: 'note' }),
      });
      expect(evaluateRoute(r, req({
        method: 'POST',
        body,
        contentType: 'multipart/form-data; boundary=----bound',
      }), '').overallMatch).toBe(true);
    });
  });
});
