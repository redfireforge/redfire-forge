import { describe, it, expect } from 'vitest';
import type { GraphqlResponse } from '../../../shared/types/graphql';
import {
  buildGraphqlResponseBodyPayload,
  serializeGraphqlResponseBody,
} from './graphqlResponseBodyPayload';

function makeResponse(overrides: Partial<GraphqlResponse> = {}): GraphqlResponse {
  return {
    data: { user: { id: '1', name: 'Alice' } },
    errors: undefined,
    extensions: { tracing: { version: 1, duration: 1000 } },
    latencyMs: 42,
    httpStatus: 200,
    httpHeaders: {},
    timestamp: 1,
    ...overrides,
  };
}

describe('buildGraphqlResponseBodyPayload', () => {
  it('includes data, errors, and extensions by default', () => {
    const payload = buildGraphqlResponseBodyPayload(makeResponse({
      errors: [{ message: 'fail' }],
    }));
    expect(payload).toEqual({
      data: { user: { id: '1', name: 'Alice' } },
      errors: [{ message: 'fail' }],
      extensions: { tracing: { version: 1, duration: 1000 } },
    });
  });

  it('omits extensions when dataOnly is true', () => {
    const payload = buildGraphqlResponseBodyPayload(makeResponse(), { dataOnly: true });
    expect(payload).toEqual({ data: { user: { id: '1', name: 'Alice' } } });
    expect(payload.extensions).toBeUndefined();
  });

  it('still includes errors when dataOnly is true', () => {
    const payload = buildGraphqlResponseBodyPayload(makeResponse({
      errors: [{ message: 'partial' }],
    }), { dataOnly: true });
    expect(payload.errors).toEqual([{ message: 'partial' }]);
    expect(payload.extensions).toBeUndefined();
  });

  it('omits data key when response.data is undefined', () => {
    const payload = buildGraphqlResponseBodyPayload(makeResponse({
      data: undefined,
      errors: [{ message: 'only errors' }],
    }), { dataOnly: true });
    expect(payload.data).toBeUndefined();
    expect(payload.errors).toEqual([{ message: 'only errors' }]);
  });
});

describe('serializeGraphqlResponseBody', () => {
  it('returns empty string for null response', () => {
    expect(serializeGraphqlResponseBody(null)).toBe('');
  });

  it('pretty-prints payload without extensions when dataOnly', () => {
    const json = serializeGraphqlResponseBody(makeResponse(), { dataOnly: true });
    expect(json).toContain('"data"');
    expect(json).not.toContain('"extensions"');
  });

  it('pretty-prints full payload when dataOnly is false', () => {
    const json = serializeGraphqlResponseBody(makeResponse(), { dataOnly: false });
    expect(json).toContain('"extensions"');
  });
});
