import { describe, expect, it } from 'vitest';
import { stripQueryString } from './urlString';

describe('stripQueryString', () => {
  it('removes query parameters', () => {
    expect(stripQueryString('https://a.test/path?a=1&b=2')).toBe('https://a.test/path');
  });

  it('returns original when no query exists', () => {
    expect(stripQueryString('/vehicles/123')).toBe('/vehicles/123');
  });

  it('returns empty string for empty input', () => {
    expect(stripQueryString('')).toBe('');
  });
});
