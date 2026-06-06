import { describe, it, expect } from 'vitest';
import {
  getBaseUrl,
  parseQueryParams,
  parseQueryParamsPreserveTemplates,
  rebuildUrl,
  rebuildUrlEncoded,
  decodeTemplateVars,
  EMPTY_QUERY_PARAM,
} from './queryParams';

describe('getBaseUrl', () => {
  it('strips query string', () => {
    expect(getBaseUrl('http://example.com/api/v1?key=val')).toBe('http://example.com/api/v1');
  });

  it('returns original when no query', () => {
    expect(getBaseUrl('not a url')).toBe('not a url');
  });
});

describe('parseQueryParams', () => {
  it('parses and decodes via URLSearchParams', () => {
    expect(parseQueryParams('http://example.com/api?foo=bar&baz=qux')).toEqual([
      { key: 'foo', value: 'bar' },
      { key: 'baz', value: 'qux' },
    ]);
  });

  it('decodes percent-encoded values', () => {
    expect(parseQueryParams('https://x.test?q=hello%20world')).toEqual([
      { key: 'q', value: 'hello world' },
    ]);
  });

  it('returns empty array when no query', () => {
    expect(parseQueryParams('http://example.com/api')).toEqual([]);
  });

  it('returns empty array on invalid input without query', () => {
    expect(parseQueryParams('not a url')).toEqual([]);
  });
});

describe('parseQueryParamsPreserveTemplates', () => {
  it('preserves raw segments without decoding', () => {
    expect(parseQueryParamsPreserveTemplates('https://x.test?foo=bar%20&tpl=%7B%7Bid%7D%7D')).toEqual([
      { key: 'foo', value: 'bar%20' },
      { key: 'tpl', value: '%7B%7Bid%7D%7D' },
    ]);
  });

  it('keeps {{var}} literals in values', () => {
    expect(parseQueryParamsPreserveTemplates('https://x.test?token={{auth}}')).toEqual([
      { key: 'token', value: '{{auth}}' },
    ]);
  });

  it('returns empty array when no query', () => {
    expect(parseQueryParamsPreserveTemplates('http://example.com/api')).toEqual([]);
  });

  it('returns empty array for bare ?', () => {
    expect(parseQueryParamsPreserveTemplates('http://example.com/api?')).toEqual([]);
  });

  it('returns key with empty value for param without equals sign', () => {
    expect(parseQueryParamsPreserveTemplates('http://example.com?flag&key=val')).toEqual([
      { key: 'flag', value: '' },
      { key: 'key', value: 'val' },
    ]);
  });
});

describe('rebuildUrl', () => {
  it('replaces query without encoding (test editor style)', () => {
    expect(rebuildUrl('http://example.com/api?old=1', [{ key: 'new', value: '2' }])).toBe(
      'http://example.com/api?new=2',
    );
  });

  it('removes query when all keys are empty', () => {
    expect(rebuildUrl('http://example.com/api?a=1', [{ key: '', value: '' }])).toBe(
      'http://example.com/api',
    );
  });

  it('appends params for non-URL input', () => {
    expect(rebuildUrl('not a url', [{ key: 'a', value: '1' }])).toBe('not a url?a=1');
  });
});

describe('rebuildUrlEncoded', () => {
  it('percent-encodes keys and values', () => {
    expect(rebuildUrlEncoded('/api/search', [{ key: 'q', value: 'hello world' }])).toBe(
      '/api/search?q=hello%20world',
    );
  });
});

describe('rebuildUrl with preserveTemplates', () => {
  it('does not encode parts containing {{var}}', () => {
    const url = rebuildUrl('/path', [{ key: 'id', value: '{{userId}}' }], {
      encode: true,
      preserveTemplates: true,
    });
    expect(url).toBe('/path?id={{userId}}');
  });

  it('encodes plain values while preserving templates', () => {
    const url = rebuildUrl('/path', [{ key: 'q', value: 'a b' }, { key: 't', value: '{{x}}' }], {
      encode: true,
      preserveTemplates: true,
    });
    expect(url).toBe('/path?q=a%20b&t={{x}}');
  });
});

describe('decodeTemplateVars', () => {
  it('restores percent-encoded template braces', () => {
    expect(decodeTemplateVars('/api?token=%7B%7Bauth%7D%7D')).toBe('/api?token={{auth}}');
  });
});

describe('EMPTY_QUERY_PARAM', () => {
  it('is a blank key/value pair', () => {
    expect(EMPTY_QUERY_PARAM).toEqual({ key: '', value: '' });
  });
});
