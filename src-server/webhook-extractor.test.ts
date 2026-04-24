import { describe, it, expect } from 'vitest';
import { extractWebhookVariables } from './webhook-extractor';

const makeRequest = (
  body: unknown = {},
  headers: Record<string, string | string[] | undefined> = {},
  query: Record<string, string | string[] | undefined> = {}
) => ({ body, headers, query });

describe('extractWebhookVariables', () => {
  it('returns empty object when extractConfig is undefined', () => {
    const result = extractWebhookVariables(undefined as any, makeRequest());
    expect(result).toEqual({});
  });

  it('returns empty object when extractConfig is empty array', () => {
    const result = extractWebhookVariables([], makeRequest());
    expect(result).toEqual({});
  });

  it('extracts a simple body field with $.body prefix', () => {
    const config = [{ name: 'orderId', jsonPath: '$.body.orderId' }];
    const request = makeRequest({ orderId: 'ORD-123' });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({ orderId: 'ORD-123' });
  });

  it('extracts body field without body prefix (defaults to body)', () => {
    const config = [{ name: 'userId', jsonPath: '$.userId' }];
    const request = makeRequest({ userId: 'user-42' });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({ userId: 'user-42' });
  });

  it('extracts nested body fields', () => {
    const config = [{ name: 'city', jsonPath: '$.body.address.city' }];
    const request = makeRequest({ address: { city: 'Detroit' } });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({ city: 'Detroit' });
  });

  it('extracts header values', () => {
    const config = [{ name: 'token', jsonPath: '$.headers.authorization' }];
    const request = makeRequest({}, { authorization: 'Bearer abc123' });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({ token: 'Bearer abc123' });
  });

  it('extracts query parameter values', () => {
    const config = [{ name: 'page', jsonPath: '$.query.page' }];
    const request = makeRequest({}, {}, { page: '5' });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({ page: '5' });
  });

  it('extracts multiple variables at once', () => {
    const config = [
      { name: 'id', jsonPath: '$.body.id' },
      { name: 'auth', jsonPath: '$.headers.x-api-key' },
      { name: 'limit', jsonPath: '$.query.limit' },
    ];
    const request = makeRequest(
      { id: 42 },
      { 'x-api-key': 'key-abc' },
      { limit: '10' }
    );
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({ id: 42, auth: 'key-abc', limit: '10' });
  });

  it('skips undefined values (missing path)', () => {
    const config = [{ name: 'missing', jsonPath: '$.body.nonexistent' }];
    const request = makeRequest({ other: 'value' });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({});
  });

  it('handles path without $. prefix', () => {
    const config = [{ name: 'val', jsonPath: 'body.key' }];
    const request = makeRequest({ key: 'found' });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({ val: 'found' });
  });

  it('handles bare $ path (returns full data)', () => {
    const config = [{ name: 'all', jsonPath: '$' }];
    const request = makeRequest({ foo: 'bar' });
    const result = extractWebhookVariables(config, request);
    expect(result.all).toEqual(request);
  });

  it('blocks __proto__ access (prototype pollution prevention)', () => {
    const config = [{ name: 'exploit', jsonPath: '$.body.__proto__.polluted' }];
    const request = makeRequest({ __proto__: { polluted: 'yes' } });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({});
  });

  it('blocks constructor access (prototype pollution prevention)', () => {
    const config = [{ name: 'exploit', jsonPath: '$.body.constructor' }];
    const request = makeRequest({});
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({});
  });

  it('blocks prototype access (prototype pollution prevention)', () => {
    const config = [{ name: 'exploit', jsonPath: '$.body.prototype' }];
    const request = makeRequest({});
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({});
  });

  it('handles array index in path', () => {
    const config = [{ name: 'first', jsonPath: '$.body.items[0]' }];
    const request = makeRequest({ items: ['apple', 'banana'] });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({ first: 'apple' });
  });

  it('gracefully handles invalid paths without crashing', () => {
    const config = [{ name: 'bad', jsonPath: '$.body.a.b.c.d.e' }];
    const request = makeRequest({ a: null });
    const result = extractWebhookVariables(config, request);
    expect(result).toEqual({});
  });
});
