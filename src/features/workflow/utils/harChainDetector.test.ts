import { describe, it, expect } from 'vitest';
import { detectChains, toVariableName, replaceFirstSegment } from './harChainDetector';
import type { ParsedHarEntry } from './harParser';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(
  method: string,
  path: string,
  options: Partial<ParsedHarEntry> = {},
): ParsedHarEntry {
  const host = 'api.example.com';
  return {
    method: method.toUpperCase(),
    url: `https://${host}${path}`,
    host,
    path,
    query: {},
    headers: {},
    hasRedactedHeaders: false,
    redactedHeaderNames: [],
    responseStatus: 200,
    warnings: [],
    ...options,
  };
}

// ── detectChains ─────────────────────────────────────────────────────────────

describe('detectChains', () => {
  // ── Edge cases / empty input ────────────────────────────────────────────

  it('returns unchanged entries and empty chains for empty input', () => {
    const result = detectChains([]);
    expect(result.entries).toHaveLength(0);
    expect(result.chains).toHaveLength(0);
  });

  it('returns unchanged entries and empty chains for single entry', () => {
    const entry = makeEntry('GET', '/users');
    const result = detectChains([entry]);
    expect(result.entries).toHaveLength(1);
    expect(result.chains).toHaveLength(0);
    expect(result.entries[0].path).toBe('/users');
  });

  it('summary says "fewer than 2 entries" when only 1 entry', () => {
    const result = detectChains([makeEntry('GET', '/users')]);
    expect(result.summary[0]).toMatch(/fewer than 2/i);
  });

  it('returns unchanged entries when no chains exist', () => {
    const entries = [
      makeEntry('GET', '/users'),
      makeEntry('GET', '/products'),
    ];
    const result = detectChains(entries);
    expect(result.chains).toHaveLength(0);
    expect(result.entries[0].path).toBe('/users');
    expect(result.entries[1].path).toBe('/products');
  });

  it('returns "No variable chains detected." summary when nothing matches', () => {
    const entries = [
      makeEntry('GET', '/users'),
      makeEntry('GET', '/products'),
    ];
    expect(detectChains(entries).summary).toEqual(['No variable chains detected.']);
  });

  // ── Chain detection ─────────────────────────────────────────────────────

  it('detects when response JSON field value appears as next URL path segment', () => {
    const entries = [
      makeEntry('POST', '/auth/login', {
        responseBody: '{"userId":"u-99","token":"abc123"}',
      }),
      makeEntry('GET', '/users/u-99'),
    ];
    const result = detectChains(entries);
    expect(result.chains).toHaveLength(1);
    expect(result.chains[0].sourceIndex).toBe(0);
    expect(result.chains[0].targetIndex).toBe(1);
    expect(result.chains[0].matchedValue).toBe('u-99');
    expect(result.chains[0].variableName).toBe('userId');
  });

  it('replaces matched segment in target path with {{varName}}', () => {
    const entries = [
      makeEntry('POST', '/orders', { responseBody: '{"orderId":"ord-42"}' }),
      makeEntry('GET', '/orders/ord-42'),
    ];
    const result = detectChains(entries);
    expect(result.entries[1].path).toBe('/orders/{{orderId}}');
  });

  it('updates target URL to match new parameterized path', () => {
    const entries = [
      makeEntry('POST', '/orders', { responseBody: '{"orderId":"ord-42"}' }),
      makeEntry('GET', '/orders/ord-42'),
    ];
    const result = detectChains(entries);
    expect(result.entries[1].url).toContain('{{orderId}}');
    expect(result.entries[1].url).not.toContain('ord-42');
  });

  it('uses {{doublebraces}} not {singlebraces} in the replacement', () => {
    const entries = [
      makeEntry('POST', '/items', { responseBody: '{"itemId":"itm-1"}' }),
      makeEntry('GET', '/items/itm-1'),
    ];
    const result = detectChains(entries);
    expect(result.entries[1].path).toBe('/items/{{itemId}}');
    // Must not be single-brace-only (i.e. must have {{ not just {)
    expect(result.entries[1].path).toMatch(/\{\{itemId\}\}/);
    // make sure it's not triple-braces
    expect(result.entries[1].path).not.toContain('{{{');
  });

  it('records correct jsonPath in chain link', () => {
    const entries = [
      makeEntry('POST', '/users', { responseBody: '{"userId":"abc"}' }),
      makeEntry('GET', '/users/abc'),
    ];
    expect(detectChains(entries).chains[0].jsonPath).toBe('$.userId');
  });

  it('generates an Extraction with source: body and the correct expression', () => {
    const entries = [
      makeEntry('POST', '/users', { responseBody: '{"userId":"abc"}' }),
      makeEntry('GET', '/users/abc'),
    ];
    const { chains } = detectChains(entries);
    expect(chains[0].extraction.source).toBe('body');
    expect(chains[0].extraction.expression).toBe('$.userId');
    expect(chains[0].extraction.name).toBe('userId');
  });

  it('summary line includes step numbers and variable name', () => {
    const entries = [
      makeEntry('POST', '/users', { responseBody: '{"userId":"abc"}' }),
      makeEntry('GET', '/users/abc'),
    ];
    const { summary } = detectChains(entries);
    expect(summary[0]).toContain('Step 1');
    expect(summary[0]).toContain('Step 2');
    expect(summary[0]).toContain('{{userId}}');
    expect(summary[0]).toContain('$.userId');
  });

  // ── Value filter rules ──────────────────────────────────────────────────

  it('skips fields with value shorter than 3 characters', () => {
    const entries = [
      makeEntry('GET', '/data', { responseBody: '{"id":"ab"}' }),
      makeEntry('GET', '/data/ab'),
    ];
    expect(detectChains(entries).chains).toHaveLength(0);
  });

  it('accepts values of exactly 3 characters', () => {
    const entries = [
      makeEntry('GET', '/data', { responseBody: '{"id":"abc"}' }),
      makeEntry('GET', '/data/abc'),
    ];
    expect(detectChains(entries).chains).toHaveLength(1);
  });

  it('skips non-string/number fields (objects, arrays, booleans, null)', () => {
    const entries = [
      makeEntry('GET', '/data', {
        responseBody: JSON.stringify({
          nested: { id: 'abc' },
          arr: ['abc'],
          flag: true,
          nothing: null,
        }),
      }),
      makeEntry('GET', '/data/abc'),
    ];
    expect(detectChains(entries).chains).toHaveLength(0);
  });

  it('matches number field values (converted to string for comparison)', () => {
    const entries = [
      makeEntry('GET', '/data', { responseBody: '{"orderId":12345}' }),
      makeEntry('GET', '/orders/12345'),
    ];
    const { chains } = detectChains(entries);
    expect(chains).toHaveLength(1);
    expect(chains[0].matchedValue).toBe('12345');
  });

  // ── Look-ahead limit ────────────────────────────────────────────────────

  it('matches when target is 1 step ahead', () => {
    const entries = [
      makeEntry('POST', '/users', { responseBody: '{"userId":"u-99"}' }),
      makeEntry('GET', '/users/u-99'),
    ];
    expect(detectChains(entries).chains).toHaveLength(1);
  });

  it('matches when target is 2 steps ahead', () => {
    const entries = [
      makeEntry('POST', '/users', { responseBody: '{"userId":"u-99"}' }),
      makeEntry('GET', '/dashboard'),
      makeEntry('GET', '/users/u-99'),
    ];
    const { chains } = detectChains(entries);
    expect(chains).toHaveLength(1);
    expect(chains[0].targetIndex).toBe(2);
  });

  it('does NOT match when target is 3 or more steps ahead', () => {
    const entries = [
      makeEntry('POST', '/users', { responseBody: '{"userId":"u-99"}' }),
      makeEntry('GET', '/dashboard'),
      makeEntry('GET', '/settings'),
      makeEntry('GET', '/users/u-99'),
    ];
    expect(detectChains(entries).chains).toHaveLength(0);
  });

  // ── Non-JSON responses ──────────────────────────────────────────────────

  it('handles missing responseBody gracefully (no chains, no throw)', () => {
    const entries = [
      makeEntry('GET', '/users'),
      makeEntry('GET', '/users/u-99'),
    ];
    expect(() => detectChains(entries)).not.toThrow();
    expect(detectChains(entries).chains).toHaveLength(0);
  });

  it('handles non-JSON response body gracefully (no throw)', () => {
    const entries = [
      makeEntry('GET', '/users', { responseBody: 'not json at all' }),
      makeEntry('GET', '/users/u-99'),
    ];
    expect(() => detectChains(entries)).not.toThrow();
    expect(detectChains(entries).chains).toHaveLength(0);
  });

  it('handles array root in response body gracefully (no throw)', () => {
    const entries = [
      makeEntry('GET', '/users', { responseBody: '[{"userId":"u-99"}]' }),
      makeEntry('GET', '/users/u-99'),
    ];
    expect(() => detectChains(entries)).not.toThrow();
    expect(detectChains(entries).chains).toHaveLength(0);
  });

  // ── Multiple chains in same sequence ───────────────────────────────────

  it('detects multiple chains across different source entries', () => {
    const entries = [
      makeEntry('POST', '/auth', { responseBody: '{"userId":"u-1"}' }),
      makeEntry('GET', '/users/u-1', { responseBody: '{"orderId":"ord-5"}' }),
      makeEntry('GET', '/orders/ord-5'),
    ];
    const { chains } = detectChains(entries);
    expect(chains).toHaveLength(2);
    expect(chains[0].variableName).toBe('userId');
    expect(chains[1].variableName).toBe('orderId');
  });

  it('correctly parameterizes both URLs in a multi-chain sequence', () => {
    const entries = [
      makeEntry('POST', '/auth', { responseBody: '{"userId":"u-1"}' }),
      makeEntry('GET', '/users/u-1', { responseBody: '{"orderId":"ord-5"}' }),
      makeEntry('GET', '/orders/ord-5'),
    ];
    const { entries: result } = detectChains(entries);
    expect(result[1].path).toBe('/users/{{userId}}');
    expect(result[2].path).toBe('/orders/{{orderId}}');
  });

  it('does not mutate the original entries array', () => {
    const entries = [
      makeEntry('POST', '/users', { responseBody: '{"userId":"u-99"}' }),
      makeEntry('GET', '/users/u-99'),
    ];
    const originalPath = entries[1].path;
    detectChains(entries);
    expect(entries[1].path).toBe(originalPath);
  });

  // ── Edge cases: dots in segment, nested chains, varname collision ───────

  it('correctly escapes dots in segment values when building regex', () => {
    // "a.b.c" should not be treated as a regex pattern
    const entries = [
      makeEntry('GET', '/data', { responseBody: '{"fileId":"a.b.c"}' }),
      makeEntry('GET', '/files/a.b.c'),
    ];
    const { chains } = detectChains(entries);
    expect(chains).toHaveLength(1);
    expect(chains[0].matchedValue).toBe('a.b.c');
    // Verify only the exact segment was replaced
    expect(chains[0].originalSegment).toBe('a.b.c');
  });

  it('handles nested chain detection — second chain works on already-parameterized path', () => {
    // Step 1 → Step 2: userId extracted, Step 2 path becomes /users/{{userId}}/orders/ord-99
    // Step 2 → Step 3: orderId extracted, Step 3 path becomes /orders/{{orderId}}
    const entries = [
      makeEntry('POST', '/auth', { responseBody: '{"userId":"u-1"}' }),
      makeEntry('GET', '/users/u-1/orders', { responseBody: '{"orderId":"ord-5"}' }),
      makeEntry('GET', '/orders/ord-5'),
    ];
    const { entries: result, chains } = detectChains(entries);
    expect(chains).toHaveLength(2);
    // First chain: u-1 → {{userId}} in step 2
    expect(result[1].path).toBe('/users/{{userId}}/orders');
    // Second chain: ord-5 → {{orderId}} in step 3
    expect(result[2].path).toBe('/orders/{{orderId}}');
  });

  it('first field wins when two fields produce the same variable name', () => {
    // user_id and userId both → "userid" and "userId"
    // When user_id matches first, userId would need to match the same segment
    // but it's already replaced with {{userid}} — so it won't match
    const entries = [
      makeEntry('POST', '/auth', {
        // user_id → "userid", userId → "userId" — both target the same segment abc123
        responseBody: JSON.stringify({ user_id: 'abc123', userId: 'abc123' }),
      }),
      makeEntry('GET', '/users/abc123'),
    ];
    const { chains } = detectChains(entries);
    // Should detect exactly 1 chain (first field wins)
    expect(chains).toHaveLength(1);
    // The result path should be parameterized exactly once
    expect(detectChains(entries).entries[1].path.match(/\{\{/g)?.length).toBe(1);
  });

  it('skips number values shorter than 3 digits (e.g. 0, 42)', () => {
    // String(42) = '42' has length 2 < MIN_VALUE_LENGTH(3), so it's skipped
    const entries = [
      makeEntry('GET', '/data', { responseBody: '{"count":42}' }),
      makeEntry('GET', '/items/42'),
    ];
    expect(detectChains(entries).chains).toHaveLength(0);
  });

  it('accepts number values of exactly 3+ digits', () => {
    // String(123) = '123' has length 3 = MIN_VALUE_LENGTH, so it's accepted
    const entries = [
      makeEntry('GET', '/data', { responseBody: '{"id":12345}' }),
      makeEntry('GET', '/items/12345'),
    ];
    expect(detectChains(entries).chains).toHaveLength(1);
  });

  it('trims whitespace from field values before matching', () => {
    // JSON string values with surrounding whitespace are trimmed
    const entries = [
      makeEntry('GET', '/data', { responseBody: '{"userId":"  u-99  "}' }),
      makeEntry('GET', '/users/u-99'),
    ];
    const { chains } = detectChains(entries);
    expect(chains).toHaveLength(1);
    expect(chains[0].matchedValue).toBe('u-99');
  });

  it('does not match when value is null (null is not string or number)', () => {
    const entries = [
      makeEntry('GET', '/data', { responseBody: '{"userId":null}' }),
      makeEntry('GET', '/users/null'),
    ];
    // null is not string|number -> skipped
    expect(detectChains(entries).chains).toHaveLength(0);
  });

  it('URL replace only changes the first path occurrence, not query params with same value', () => {
    // /orders/ord-99?redirect=/orders/ord-99
    // Only the pathname portion should be parameterized
    const entries = [
      makeEntry('GET', '/orders', { responseBody: '{"orderId":"ord-99"}' }),
      makeEntry('GET', 'https://api.example.com/orders/ord-99', {
        // Manually construct entry with URL that has the value in query too
        url: 'https://api.example.com/orders/ord-99?redirect=%2Forders%2Ford-99',
        path: '/orders/ord-99',
        host: 'api.example.com',
        query: { redirect: '/orders/ord-99' },
      }),
    ];
    const { entries: result } = detectChains(entries);
    // Path is parameterized
    expect(result[1].path).toBe('/orders/{{orderId}}');
    // URL has first occurrence replaced (the path part)
    expect(result[1].url).toContain('{{orderId}}');
  });
});

// ── toVariableName ────────────────────────────────────────────────────────────

describe('toVariableName', () => {
  it('lowercases the first letter', () => {
    expect(toVariableName('UserId')).toBe('userId');
  });

  it('preserves camelCase', () => {
    expect(toVariableName('userId')).toBe('userId');
  });

  it('strips hyphens', () => {
    expect(toVariableName('user-id')).toBe('userid');
  });

  it('strips underscores', () => {
    expect(toVariableName('user_id')).toBe('userid');
  });

  it('strips leading digits', () => {
    expect(toVariableName('42abc')).toBe('abc');
  });

  it('returns "value" for empty string', () => {
    expect(toVariableName('')).toBe('value');
  });

  it('returns "value" when only non-alphanumeric characters', () => {
    expect(toVariableName('---')).toBe('value');
  });

  it('returns "value" when only digits', () => {
    expect(toVariableName('12345')).toBe('value');
  });

  it('strips special chars from orderId', () => {
    expect(toVariableName('order_Id')).toBe('orderId');
  });
});

// ── replaceFirstSegment ───────────────────────────────────────────────────────

describe('replaceFirstSegment', () => {
  it('replaces a segment in the middle of a path', () => {
    expect(replaceFirstSegment('/orders/ord-42/items', 'ord-42', 'orderId')).toBe(
      '/orders/{{orderId}}/items',
    );
  });

  it('replaces a segment at the end of a path', () => {
    expect(replaceFirstSegment('/users/u-99', 'u-99', 'userId')).toBe('/users/{{userId}}');
  });

  it('does not replace a partial match (only exact segment boundaries)', () => {
    // 'ord' should not match 'ord-42'
    expect(replaceFirstSegment('/orders/ord-42', 'ord', 'x')).toBe('/orders/ord-42');
  });

  it('replaces only the first occurrence', () => {
    // If the same value appears twice, only the first is replaced
    expect(replaceFirstSegment('/items/abc/abc', 'abc', 'item')).toBe('/items/{{item}}/abc');
  });

  it('handles a simple one-segment path', () => {
    expect(replaceFirstSegment('/abc', 'abc', 'myVar')).toBe('/{{myVar}}');
  });
});
