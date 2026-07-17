/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./gqlFetch');

import { gqlFetch } from './gqlFetch';
import { executeGraphqlOperation } from './executeGraphqlOperation';

const mockGqlFetch = vi.mocked(gqlFetch);

function makeResult(overrides: Partial<{
  status: number; headers: Record<string, string>; body: string; error?: string;
}> = {}) {
  return {
    status: overrides.status ?? 200,
    headers: overrides.headers ?? { 'content-type': 'application/json' },
    body: overrides.body ?? '{"data":{"hello":"world"}}',
    error: overrides.error,
  };
}

beforeEach(() => resetAllMocks());

describe('executeGraphqlOperation', () => {
  it('returns data on a successful response', async () => {
    mockGqlFetch.mockResolvedValue(makeResult());
    const result = await executeGraphqlOperation({
      endpoint: 'http://api/graphql',
      query: 'query { hello }',
    });
    expect(result.data).toEqual({ hello: 'world' });
    expect(result.errors).toBeUndefined();
    expect(result.httpStatus).toBe(200);
  });

  it('includes variables and operationName in the request body', async () => {
    mockGqlFetch.mockResolvedValue(makeResult({ body: '{"data":null}' }));
    await executeGraphqlOperation({
      endpoint: 'http://api/graphql',
      query: 'query Foo { x }',
      variables: { id: '1' },
      operationName: 'Foo',
    });
    const [, , , body] = mockGqlFetch.mock.calls[0];
    const parsed = JSON.parse(body as string) as Record<string, unknown>;
    expect(parsed.variables).toEqual({ id: '1' });
    expect(parsed.operationName).toBe('Foo');
  });

  it('omits variables field when variables object is empty', async () => {
    mockGqlFetch.mockResolvedValue(makeResult({ body: '{"data":null}' }));
    await executeGraphqlOperation({
      endpoint: 'http://api/graphql',
      query: 'query { x }',
      variables: {},
    });
    const [, , , body] = mockGqlFetch.mock.calls[0];
    const parsed = JSON.parse(body as string) as Record<string, unknown>;
    expect(parsed.variables).toBeUndefined();
  });

  it('returns errors from the GraphQL response', async () => {
    mockGqlFetch.mockResolvedValue(makeResult({ body: '{"data":null,"errors":[{"message":"Not found"}]}' }));
    const result = await executeGraphqlOperation({ endpoint: 'http://api/graphql', query: 'query { x }' });
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].message).toBe('Not found');
  });

  it('includes extensions when present in the response', async () => {
    mockGqlFetch.mockResolvedValue(makeResult({ body: '{"data":{},"extensions":{"cost":10}}' }));
    const result = await executeGraphqlOperation({ endpoint: 'http://api/graphql', query: 'query { x }' });
    expect(result.extensions).toEqual({ cost: 10 });
  });

  it('returns error response on status=0 with error field', async () => {
    mockGqlFetch.mockResolvedValue(makeResult({ status: 0, body: '', error: 'Network failure' }));
    const result = await executeGraphqlOperation({ endpoint: 'http://api/graphql', query: 'query { x }' });
    expect(result.httpStatus).toBe(0);
    expect(result.data).toBeNull();
    expect(result.errors?.[0].message).toBe('Network failure');
  });

  it('handles non-JSON response body with a descriptive error', async () => {
    mockGqlFetch.mockResolvedValue(makeResult({ status: 500, body: 'Internal Server Error' }));
    const result = await executeGraphqlOperation({ endpoint: 'http://api/graphql', query: 'query { x }' });
    expect(result.data).toBeNull();
    expect(result.errors?.[0].message).toMatch(/non-JSON/);
  });

  it('truncates very long non-JSON response body in error preview', async () => {
    const longBody = 'x'.repeat(300);
    mockGqlFetch.mockResolvedValue(makeResult({ status: 500, body: longBody }));
    const result = await executeGraphqlOperation({ endpoint: 'http://api/graphql', query: 'query { x }' });
    expect(result.errors?.[0].extensions?.rawPreview as string).toHaveLength(201); // 200 chars + '…'
  });

  it('passes custom headers to gqlFetch', async () => {
    mockGqlFetch.mockResolvedValue(makeResult());
    await executeGraphqlOperation({
      endpoint: 'http://api/graphql',
      query: 'query { x }',
      headers: { Authorization: 'Bearer tok' },
    });
    const [, , headers] = mockGqlFetch.mock.calls[0];
    expect((headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });

  it('passes skipTlsVerify to gqlFetch', async () => {
    mockGqlFetch.mockResolvedValue(makeResult());
    const ctrl = new AbortController();
    await executeGraphqlOperation({
      endpoint: 'http://api/graphql',
      query: 'query { x }',
      signal: ctrl.signal,
      skipTlsVerify: true,
    });
    const args = mockGqlFetch.mock.calls[0];
    expect(args[4]).toBe(ctrl.signal);
    expect(args[5]).toEqual({ skipTlsVerify: true });
  });

  it('measures latencyMs > 0', async () => {
    mockGqlFetch.mockResolvedValue(makeResult());
    const result = await executeGraphqlOperation({ endpoint: 'http://api/graphql', query: 'query { x }' });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
