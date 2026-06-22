/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { apqInfoFromResponse, parseHttpBody, stampRequestHeaders } from './graphqlExecutionResponseParsing';

describe('parseHttpBody', () => {
  it('parses GraphQL JSON success payload', () => {
    const resp = parseHttpBody(200, {}, JSON.stringify({ data: { hello: 'world' } }), 10);
    expect(resp.data).toEqual({ hello: 'world' });
    expect(resp.errors).toBeUndefined();
  });

  it('parses errors and extensions from GraphQL JSON', () => {
    const resp = parseHttpBody(
      200,
      {},
      JSON.stringify({
        data: null,
        errors: [{ message: 'bad field' }],
        extensions: { traceId: 'abc' },
      }),
      10,
    );
    expect(resp.errors?.[0]?.message).toBe('bad field');
    expect(resp.extensions).toEqual({ traceId: 'abc' });
  });

  it('returns network error payload when status is 0', () => {
    const resp = parseHttpBody(0, {}, '', 0, 'Connection refused');
    expect(resp.data).toBeNull();
    expect(resp.errors?.[0]?.message).toBe('Connection refused');
  });

  it('adds synthetic error for non-JSON 4xx responses', () => {
    const resp = parseHttpBody(502, {}, 'Bad Gateway', 5);
    expect(resp.data).toBeNull();
    expect(resp.errors?.[0]?.message).toContain('non-JSON');
  });

  it('truncates long non-JSON body preview', () => {
    const longBody = 'x'.repeat(250);
    const resp = parseHttpBody(500, {}, longBody, 5);
    expect(resp.errors?.[0]?.extensions?.rawPreview).toMatch(/…$/);
  });

  it('adds synthetic error for 4xx JSON without errors field', () => {
    const resp = parseHttpBody(400, {}, JSON.stringify({ error: 'bad' }), 5);
    expect(resp.errors?.[0]?.message).toContain('HTTP 400');
  });

  it('non-JSON empty body on 4xx still yields parse error message', () => {
    const resp = parseHttpBody(404, {}, '', 5);
    expect(resp.errors?.[0]?.message).toContain('non-JSON');
  });
});

describe('stampRequestHeaders', () => {
  it('copies request headers onto the response', () => {
    const base = parseHttpBody(200, {}, '{}', 1);
    const stamped = stampRequestHeaders(base, { Authorization: 'Bearer x' });
    expect(stamped.requestHeaders).toEqual({ Authorization: 'Bearer x' });
  });
});

describe('apqInfoFromResponse', () => {
  it('returns null when response has no apqHash', () => {
    expect(apqInfoFromResponse(parseHttpBody(200, {}, '{}', 1))).toBeNull();
  });

  it('maps APQ fields from response', () => {
    const resp = {
      ...parseHttpBody(200, {}, '{}', 1),
      apqHash: 'abc',
      apqCacheHit: true,
      apqUnsupported: false,
    };
    expect(apqInfoFromResponse(resp, 'https://api.example.com/graphql')).toEqual({
      hash: 'abc',
      cacheHit: true,
      unsupported: false,
      connectionId: 'https://api.example.com/graphql',
    });
  });

  it('defaults APQ boolean flags when omitted', () => {
    const resp = {
      ...parseHttpBody(200, {}, '{}', 1),
      apqHash: 'abc',
    };
    expect(apqInfoFromResponse(resp)).toEqual({
      hash: 'abc',
      cacheHit: false,
      unsupported: false,
      connectionId: undefined,
    });
  });
});
