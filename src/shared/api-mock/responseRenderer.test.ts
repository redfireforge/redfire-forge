import { describe, it, expect } from 'vitest';
import { renderResponseVariant, toCapturedHeaders } from './responseRenderer';
import { createDefaultResponse } from './defaults';
import { createInitialState } from './scenarioRuntime';
import type { ApiMockCapturedRequestV1, ApiMockRouteV1 } from './contracts';

const ts = '2026-08-11T00:00:00.000Z';

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

function request(overrides: Partial<ApiMockCapturedRequestV1> = {}): ApiMockCapturedRequestV1 {
  return {
    method: 'GET',
    path: '/test',
    rawPath: '/test',
    query: { q: '1' },
    headers: { 'X-Req': 'hdr' },
    cookies: { sid: 'abc' },
    body: null,
    bodyTruncated: false,
    receivedAt: ts,
    ...overrides,
  };
}

describe('renderResponseVariant', () => {
  it('defaults status 200 and empty body when variant is undefined', () => {
    const result = renderResponseVariant({
      variant: undefined,
      request: request(),
      route: route(),
      basePath: '',
      scenario: createInitialState(),
      variables: [],
      seed: 's1',
      maxResponseBodyBytes: 10_000,
      now: ts,
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('');
    expect(result.headers).toEqual({});
  });

  it('renders plain headers, content-type, and body', () => {
    const variant = createDefaultResponse('v1');
    variant.status = 201;
    variant.headers = [{ id: 'h1', key: 'X-Custom', value: 'plain', enabled: true }];
    variant.body = { kind: 'json', contentType: 'application/json', content: '{"ok":true}' };
    const result = renderResponseVariant({
      variant,
      request: request(),
      route: route(),
      basePath: '',
      scenario: createInitialState(),
      variables: [{ key: 'env', value: 'dev' }],
      seed: 's1',
      maxResponseBodyBytes: 10_000,
      now: ts,
    });
    expect(result.status).toBe(201);
    expect(result.headers['X-Custom']).toBe('plain');
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.body).toBe('{"ok":true}');
  });

  it('skips disabled headers and renders template headers', () => {
    const variant = createDefaultResponse('v1');
    variant.headers = [
      { id: 'h1', key: 'X-Off', value: 'skip', enabled: false },
      { id: 'h2', key: 'X-Tmpl', value: '{{request.method}}', enabled: true },
    ];
    const result = renderResponseVariant({
      variant,
      request: request({ method: 'POST' }),
      route: route(),
      basePath: '',
      scenario: createInitialState(),
      variables: [],
      seed: 's1',
      maxResponseBodyBytes: 10_000,
      now: ts,
    });
    expect(result.headers['X-Off']).toBeUndefined();
    expect(result.headers['X-Tmpl']).toBe('POST');
  });

  it('builds Set-Cookie for single and multiple cookies with all attributes', () => {
    const variant = createDefaultResponse('v1');
    variant.cookies = [
      {
        id: 'c1',
        name: 'a',
        value: '1',
        enabled: true,
        path: '/api',
        domain: 'example.com',
        maxAge: 3600,
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      },
      { id: 'c2', name: 'b', value: '{{variables.env}}', enabled: true },
      { id: 'c3', name: 'off', value: 'x', enabled: false },
    ];
    const result = renderResponseVariant({
      variant,
      request: request(),
      route: route(),
      basePath: '',
      scenario: createInitialState(),
      variables: [{ key: 'env', value: 'prod' }],
      seed: 's1',
      maxResponseBodyBytes: 10_000,
      now: ts,
    });
    expect(result.headers['Set-Cookie']).toEqual([
      'a=1; Path=/api; Domain=example.com; Max-Age=3600; Secure; HttpOnly; SameSite=Strict',
      'b=prod',
    ]);
  });

  it('uses a single Set-Cookie string when only one cookie is enabled', () => {
    const variant = createDefaultResponse('v1');
    variant.cookies = [{ id: 'c1', name: 'sid', value: 'xyz', enabled: true }];
    const result = renderResponseVariant({
      variant,
      request: request(),
      route: route(),
      basePath: '',
      scenario: createInitialState(),
      variables: [],
      seed: 's1',
      maxResponseBodyBytes: 10_000,
      now: ts,
    });
    expect(result.headers['Set-Cookie']).toBe('sid=xyz');
  });

  it('renders template body and truncates when over max bytes', () => {
    const variant = createDefaultResponse('v1');
    variant.body = { kind: 'text', content: '{{seed}}-long-tail', contentType: 'text/plain' };
    const result = renderResponseVariant({
      variant,
      request: request(),
      route: route(),
      basePath: '',
      scenario: createInitialState(),
      variables: [],
      seed: 'abc',
      maxResponseBodyBytes: 3,
      now: ts,
    });
    expect(result.body).toBe('abc');
  });

  it('parses JSON request body and falls back to raw string on parse error', () => {
    const variant = createDefaultResponse('v1');
    variant.body = { kind: 'json', content: '{{request.rawBody}}', contentType: 'application/json' };

    const jsonReq = request({ body: '{"id":1}' });
    const jsonResult = renderResponseVariant({
      variant,
      request: jsonReq,
      route: route(),
      basePath: '',
      scenario: createInitialState(),
      variables: [],
      seed: 's1',
      maxResponseBodyBytes: 10_000,
      now: ts,
    });
    expect(jsonResult.body).toBe('{"id":1}');

    const plainReq = request({ body: 'not-json' });
    const plainResult = renderResponseVariant({
      variant,
      request: plainReq,
      route: route(),
      basePath: '',
      scenario: createInitialState(),
      variables: [],
      seed: 's1',
      maxResponseBodyBytes: 10_000,
      now: ts,
    });
    expect(plainResult.body).toBe('not-json');
  });

  it('uses default now when omitted and strips base path for path params', () => {
    const variant = createDefaultResponse('v1');
    variant.body = { kind: 'text', content: '{{now}}', contentType: 'text/plain' };
    const result = renderResponseVariant({
      variant,
      request: request({ path: '/api/users/42', rawPath: '/api/users/42' }),
      route: route({ path: { kind: 'parameterized', value: '/users/{id}' } }),
      basePath: '/api',
      scenario: { states: { order: 'paid' }, counters: { hits: 2 } },
      variables: [],
      seed: 's1',
      maxResponseBodyBytes: 10_000,
    });
    expect(result.body).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('toCapturedHeaders', () => {
  it('lowercases keys and wraps scalar values in arrays', () => {
    expect(toCapturedHeaders({ 'X-Test': 'a', 'Set-Cookie': ['c1', 'c2'] })).toEqual({
      'x-test': ['a'],
      'set-cookie': ['c1', 'c2'],
    });
  });
});
