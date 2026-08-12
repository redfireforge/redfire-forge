import { describe, expect, it } from 'vitest';
import { matchPath } from './pathMatcher';

describe('pathMatcher coverage gaps', () => {
  it('fails closed on unknown matcher kinds', () => {
    expect(matchPath({ kind: 'weird' as any, value: '/users' }, '/users')).toEqual({ matched: false, params: {} });
  });

  it('supports case-insensitive parameterized literals and ignores empty parameter names', () => {
    expect(matchPath({ kind: 'parameterized', value: '/Users/:id', flags: { caseInsensitive: true } }, '/users/42')).toEqual({ matched: true, params: { id: '42' } });
    expect(matchPath({ kind: 'parameterized', value: '/users/:', flags: { caseInsensitive: true } }, '/users/42')).toEqual({ matched: true, params: {} });
    expect(matchPath({ kind: 'parameterized', value: '/users/{}' }, '/users/42')).toEqual({ matched: true, params: {} });
  });

  it('matches globs case-insensitively and escapes literal regex characters', () => {
    expect(matchPath({ kind: 'glob', value: '/API/*/Health', flags: { caseInsensitive: true } }, '/api/v1/health').matched).toBe(true);
    expect(matchPath({ kind: 'glob', value: '/file[1].txt' }, '/file[1].txt').matched).toBe(true);
    expect(matchPath({ kind: 'glob', value: '/file[1].txt' }, '/file11.txt').matched).toBe(false);
  });
});
