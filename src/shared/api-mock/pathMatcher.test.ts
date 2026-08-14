import { describe, it, expect } from 'vitest';
import { matchPath, inferPathKind, pathParamNames } from './pathMatcher';

describe('inferPathKind', () => {
  it('detects parameterized paths from :param and {param}', () => {
    expect(inferPathKind('/users/:id')).toBe('parameterized');
    expect(inferPathKind('/orders/{orderId}/items/{itemId}')).toBe('parameterized');
  });
  it('detects glob paths', () => {
    expect(inferPathKind('/api/**')).toBe('glob');
    expect(inferPathKind('/assets/*.png')).toBe('glob');
  });
  it('falls back to exact for literal paths', () => {
    expect(inferPathKind('/users/admin')).toBe('exact');
    expect(inferPathKind('/')).toBe('exact');
  });
  it('preserves an explicit regex choice', () => {
    expect(inferPathKind('^/v[0-9]+/.*$', 'regex')).toBe('regex');
  });
  it('prefers parameterized when a path has both param and wildcard syntax', () => {
    expect(inferPathKind('/users/:id/*')).toBe('parameterized');
  });
  it('does not treat a bare colon or port-like text as a parameter', () => {
    expect(inferPathKind('/a:b')).toBe('parameterized');
    expect(inferPathKind('/ratio:')).toBe('exact');
  });
});

describe('pathParamNames', () => {
  it('extracts unique :param and {param} names in order', () => {
    expect(pathParamNames('/users/:id')).toEqual(['id']);
    expect(pathParamNames('/orders/{orderId}/items/{itemId}')).toEqual(['orderId', 'itemId']);
    expect(pathParamNames('/users/:id/posts/:id')).toEqual(['id']);
    expect(pathParamNames('/users')).toEqual([]);
    expect(pathParamNames('/a:b')).toEqual([]);
  });
});

describe('matchPath', () => {
  describe('exact', () => {
    it('matches identical paths', () => {
      expect(matchPath({ kind: 'exact', value: '/users' }, '/users')).toEqual({ matched: true, params: {} });
    });
    it('rejects different paths', () => {
      expect(matchPath({ kind: 'exact', value: '/users' }, '/orders').matched).toBe(false);
    });
    it('is case-sensitive by default', () => {
      expect(matchPath({ kind: 'exact', value: '/Users' }, '/users').matched).toBe(false);
    });
    it('case-insensitive with flag', () => {
      expect(matchPath({ kind: 'exact', value: '/Users', flags: { caseInsensitive: true } }, '/users').matched).toBe(true);
    });
  });

  describe('parameterized', () => {
    it('matches and extracts :param', () => {
      const r = matchPath({ kind: 'parameterized', value: '/users/:id' }, '/users/42');
      expect(r).toEqual({ matched: true, params: { id: '42' } });
    });
    it('matches {param} syntax', () => {
      const r = matchPath({ kind: 'parameterized', value: '/users/{id}' }, '/users/42');
      expect(r).toEqual({ matched: true, params: { id: '42' } });
    });
    it('matches multiple params', () => {
      const r = matchPath({ kind: 'parameterized', value: '/orgs/:org/users/:id' }, '/orgs/acme/users/7');
      expect(r.params).toEqual({ org: 'acme', id: '7' });
    });
    it('rejects segment count mismatch', () => {
      expect(matchPath({ kind: 'parameterized', value: '/users/:id' }, '/users/42/extra').matched).toBe(false);
    });
    it('matches literal segments exactly', () => {
      expect(matchPath({ kind: 'parameterized', value: '/users/:id' }, '/orders/42').matched).toBe(false);
    });
  });

  describe('glob', () => {
    it('matches * for one segment', () => {
      expect(matchPath({ kind: 'glob', value: '/api/*/health' }, '/api/v1/health').matched).toBe(true);
    });
    it('rejects * across segments', () => {
      expect(matchPath({ kind: 'glob', value: '/api/*/health' }, '/api/v1/v2/health').matched).toBe(false);
    });
    it('matches ** across segments', () => {
      expect(matchPath({ kind: 'glob', value: '/api/**/health' }, '/api/v1/v2/health').matched).toBe(true);
    });
    it('matches ? for one character', () => {
      expect(matchPath({ kind: 'glob', value: '/v?' }, '/v1').matched).toBe(true);
      expect(matchPath({ kind: 'glob', value: '/v?' }, '/v10').matched).toBe(false);
    });
  });

  describe('regex', () => {
    it('matches regex pattern', () => {
      expect(matchPath({ kind: 'regex', value: '^/api/v[0-9]+/items$' }, '/api/v2/items').matched).toBe(true);
    });
    it('rejects non-matching regex', () => {
      expect(matchPath({ kind: 'regex', value: '^/api/v[0-9]+$' }, '/api/vX').matched).toBe(false);
    });
    it('handles invalid regex gracefully', () => {
      expect(matchPath({ kind: 'regex', value: '(unclosed' }, '/test').matched).toBe(false);
    });
    it('case-insensitive regex with flag', () => {
      expect(matchPath({ kind: 'regex', value: '^/users$', flags: { caseInsensitive: true } }, '/USERS').matched).toBe(true);
    });
  });
});
