import { describe, it, expect } from 'vitest';
import { parseUrl, analyzeUrlPath, buildUrlFromTemplate } from './csvTemplateUrl';

// ---------------------------------------------------------------------------
// parseUrl
// ---------------------------------------------------------------------------
describe('parseUrl', () => {
  it('parses a simple URL', () => {
    const { origin, pathname, params } = parseUrl('http://example.com/api/v1');
    expect(origin).toBe('http://example.com');
    expect(pathname).toBe('/api/v1');
    expect(params).toEqual([]);
  });

  it('parses query parameters', () => {
    const { params } = parseUrl('http://example.com/api?foo=bar&baz=qux');
    expect(params).toEqual([
      { key: 'foo', value: 'bar' },
      { key: 'baz', value: 'qux' },
    ]);
  });

  it('handles invalid URLs gracefully', () => {
    const { origin, pathname } = parseUrl('not-a-url');
    expect(origin).toBe('');
    expect(pathname).toBe('not-a-url');
  });

  it('parses URL with port', () => {
    const { origin } = parseUrl('http://localhost:8080/api');
    expect(origin).toBe('http://localhost:8080');
  });
});

// ---------------------------------------------------------------------------
// analyzeUrlPath
// ---------------------------------------------------------------------------
describe('analyzeUrlPath', () => {
  it('identifies path segments', () => {
    const { segments } = analyzeUrlPath('http://example.com/api/v1/users');
    expect(segments.length).toBe(3);
    expect(segments[0].segment).toBe('api');
    expect(segments[1].segment).toBe('v1');
    expect(segments[2].segment).toBe('users');
  });

  it('suggests numeric segments as variables', () => {
    const { segments } = analyzeUrlPath('http://example.com/api/users/12345');
    const numericSeg = segments.find(s => s.segment === '12345')!;
    expect(numericSeg.suggestedVariable).toBe(true);
  });

  it('suggests alphanumeric IDs (8+ chars) as variables', () => {
    const { segments } = analyzeUrlPath('http://example.com/api/users/abc12345def');
    const idSeg = segments.find(s => s.segment === 'abc12345def')!;
    expect(idSeg.suggestedVariable).toBe(true);
  });

  it('does not suggest short text segments as variables', () => {
    const { segments } = analyzeUrlPath('http://example.com/api/users');
    expect(segments.every(s => !s.suggestedVariable)).toBe(true);
  });

  it('provides default variable names for suggested variables', () => {
    const { segments } = analyzeUrlPath('http://example.com/api/12345');
    const variable = segments.find(s => s.suggestedVariable)!;
    expect(variable.variableName).toMatch(/^path_var_/);
  });

  it('returns origin and query params alongside segments', () => {
    const { origin, params } = analyzeUrlPath('http://example.com/api?key=val');
    expect(origin).toBe('http://example.com');
    expect(params).toEqual([{ key: 'key', value: 'val' }]);
  });
});

// ---------------------------------------------------------------------------
// buildUrlFromTemplate
// ---------------------------------------------------------------------------
describe('buildUrlFromTemplate', () => {
  it('replaces path variables', () => {
    const url = buildUrlFromTemplate(
      'http://example.com/api/{{vin}}/offers',
      { vin: 'ABC123' },
      []
    );
    expect(url).toBe('http://example.com/api/ABC123/offers');
  });

  it('replaces multiple variables', () => {
    const url = buildUrlFromTemplate(
      'http://example.com/{{version}}/users/{{userId}}',
      { version: 'v2', userId: '42' },
      []
    );
    expect(url).toBe('http://example.com/v2/users/42');
  });

  it('appends query parameters', () => {
    const url = buildUrlFromTemplate(
      'http://example.com/api',
      {},
      [{ key: 'page', value: '1' }, { key: 'size', value: '10' }]
    );
    expect(url).toBe('http://example.com/api?page=1&size=10');
  });

  it('encodes special characters in path values', () => {
    const url = buildUrlFromTemplate(
      'http://example.com/api/{{name}}',
      { name: 'hello world' },
      []
    );
    expect(url).toBe('http://example.com/api/hello%20world');
  });

  it('encodes special characters in query params', () => {
    const url = buildUrlFromTemplate(
      'http://example.com/api',
      {},
      [{ key: 'q', value: 'a&b' }]
    );
    expect(url).toContain('q=a%26b');
  });

  it('returns URL unchanged when no variables or params', () => {
    const url = buildUrlFromTemplate('http://example.com/api', {}, []);
    expect(url).toBe('http://example.com/api');
  });
});
