import { describe, it, expect } from 'vitest';
import { canonicalize, stripPaths, jsonEqual, parseQueryParams, rebuildUrl, getBaseUrl, unwrapImport } from './testEditorUtils';

// ---------------------------------------------------------------------------
// canonicalize
// ---------------------------------------------------------------------------
describe('canonicalize', () => {
  it('returns primitives unchanged', () => {
    expect(canonicalize(42)).toBe(42);
    expect(canonicalize('hello')).toBe('hello');
    expect(canonicalize(null)).toBeNull();
    expect(canonicalize(undefined)).toBeUndefined();
    expect(canonicalize(true)).toBe(true);
  });

  it('sorts object keys alphabetically', () => {
    const result = canonicalize({ c: 3, a: 1, b: 2 });
    expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
  });

  it('sorts nested object keys recursively', () => {
    const result = canonicalize({ z: { y: 1, x: 2 }, a: 0 });
    expect(Object.keys(result)).toEqual(['a', 'z']);
    expect(Object.keys(result.z)).toEqual(['x', 'y']);
  });

  it('preserves arrays (does not sort them)', () => {
    expect(canonicalize([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('canonicalizes objects inside arrays', () => {
    const result = canonicalize([{ b: 2, a: 1 }]);
    expect(Object.keys(result[0])).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// stripPaths
// ---------------------------------------------------------------------------
describe('stripPaths', () => {
  it('returns object unchanged when no paths', () => {
    const obj = { a: 1, b: 2 };
    expect(stripPaths(obj, [])).toEqual({ a: 1, b: 2 });
  });

  it('removes a top-level key', () => {
    const result = stripPaths({ a: 1, b: 2, c: 3 }, ['b']);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('removes a nested key', () => {
    const result = stripPaths({ data: { x: 1, y: 2 } }, ['$.data.y']);
    expect(result).toEqual({ data: { x: 1 } });
  });

  it('does not mutate the original object', () => {
    const original = { a: 1, b: { c: 2 } };
    stripPaths(original, ['$.b.c']);
    expect(original.b.c).toBe(2);
  });

  it('handles non-existent paths without crashing', () => {
    const obj = { a: 1 };
    const result = stripPaths(obj, ['$.nonexistent.deep']);
    expect(result.a).toBe(1);
  });

  it('handles null/undefined input', () => {
    expect(stripPaths(null, ['$.x'])).toBeNull();
    expect(stripPaths(undefined, ['$.x'])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// jsonEqual
// ---------------------------------------------------------------------------
describe('jsonEqual', () => {
  it('matches identical JSON strings', () => {
    expect(jsonEqual('{"a":1}', '{"a":1}')).toBe(true);
  });

  it('matches JSON with different key order', () => {
    expect(jsonEqual('{"b":2,"a":1}', '{"a":1,"b":2}')).toBe(true);
  });

  it('detects value differences', () => {
    expect(jsonEqual('{"a":1}', '{"a":2}')).toBe(false);
  });

  it('detects extra keys', () => {
    expect(jsonEqual('{"a":1}', '{"a":1,"b":2}')).toBe(false);
  });

  it('supports excluded paths', () => {
    expect(jsonEqual(
      '{"a":1,"timestamp":111}',
      '{"a":1,"timestamp":222}',
      ['timestamp']
    )).toBe(true);
  });

  it('handles invalid JSON by falling back to string comparison', () => {
    expect(jsonEqual('not json', 'not json')).toBe(true);
    expect(jsonEqual('not json', 'other')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseQueryParams
// ---------------------------------------------------------------------------
describe('parseQueryParams', () => {
  it('parses query parameters from URL', () => {
    const params = parseQueryParams('http://example.com/api?foo=bar&baz=qux');
    expect(params).toEqual([
      { key: 'foo', value: 'bar' },
      { key: 'baz', value: 'qux' },
    ]);
  });

  it('returns empty placeholder for URL without params', () => {
    const params = parseQueryParams('http://example.com/api');
    expect(params).toEqual([{ key: '', value: '' }]);
  });

  it('returns empty placeholder for invalid URL', () => {
    const params = parseQueryParams('not a url');
    expect(params).toEqual([{ key: '', value: '' }]);
  });
});

// ---------------------------------------------------------------------------
// rebuildUrl
// ---------------------------------------------------------------------------
describe('rebuildUrl', () => {
  it('sets query parameters on a URL', () => {
    const result = rebuildUrl('http://example.com/api?old=1', [{ key: 'new', value: '2' }]);
    expect(result).toBe('http://example.com/api?new=2');
  });

  it('removes all params when given empty keys', () => {
    const result = rebuildUrl('http://example.com/api?a=1', [{ key: '', value: '' }]);
    expect(result).toBe('http://example.com/api');
  });

  it('returns original URL for invalid input', () => {
    expect(rebuildUrl('not a url', [{ key: 'a', value: '1' }])).toBe('not a url');
  });
});

// ---------------------------------------------------------------------------
// getBaseUrl
// ---------------------------------------------------------------------------
describe('getBaseUrl', () => {
  it('strips query params and hash', () => {
    expect(getBaseUrl('http://example.com/api/v1?key=val')).toBe('http://example.com/api/v1');
  });

  it('returns original for invalid URL', () => {
    expect(getBaseUrl('not a url')).toBe('not a url');
  });
});

// ---------------------------------------------------------------------------
// unwrapImport
// ---------------------------------------------------------------------------
describe('unwrapImport', () => {
  it('unwraps export envelope', () => {
    const wrapped = { _exportMeta: { version: 1 }, data: [{ id: '1' }] };
    expect(unwrapImport(wrapped)).toEqual([{ id: '1' }]);
  });

  it('returns raw data if not wrapped', () => {
    const raw = [{ id: '1' }];
    expect(unwrapImport(raw)).toBe(raw);
  });

  it('returns primitives as-is', () => {
    expect(unwrapImport('hello')).toBe('hello');
    expect(unwrapImport(null)).toBeNull();
  });
});
