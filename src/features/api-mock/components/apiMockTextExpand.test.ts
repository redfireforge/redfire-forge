/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  findTextExpandMatches,
  formatJsonBody,
  formatTextExpandCount,
  isNestedApiMockExpandPortal,
  minifyJsonBody,
  nextTextExpandMatch,
  prettyPrintJsonBody,
  resolveApiMockExpandPortal,
  textExpandStats,
} from './apiMockTextExpand';

describe('apiMockTextExpand', () => {
  it('finds case-insensitive non-overlapping matches', () => {
    expect(findTextExpandMatches('Hello hello HELLO', 'hello')).toEqual([0, 6, 12]);
    expect(findTextExpandMatches('aaaa', 'aa')).toEqual([0, 2]);
    expect(findTextExpandMatches('payload', '  ')).toEqual([]);
    expect(findTextExpandMatches('payload', 'zzz')).toEqual([]);
  });

  it('wraps match navigation including an unset cursor', () => {
    expect(nextTextExpandMatch(0, 0, 1)).toBe(0);
    expect(nextTextExpandMatch(-1, 3, 1)).toBe(0);
    expect(nextTextExpandMatch(-1, 3, -1)).toBe(2);
    expect(nextTextExpandMatch(2, 3, 1)).toBe(0);
    expect(nextTextExpandMatch(0, 3, -1)).toBe(2);
  });

  it('nests the expand portal in the Simulate request pane when present', () => {
    expect(resolveApiMockExpandPortal()).toBe(document.body);
    expect(isNestedApiMockExpandPortal(document.body)).toBe(false);
    const host = document.createElement('section');
    host.setAttribute('data-testid', 'api-mock-sim-main');
    document.body.appendChild(host);
    expect(resolveApiMockExpandPortal()).toBe(host);
    expect(isNestedApiMockExpandPortal(host)).toBe(true);
    host.remove();
    expect(resolveApiMockExpandPortal()).toBe(document.body);
  });

  it('formats the search counter', () => {
    expect(formatTextExpandCount(0, 0)).toBe('0/0');
    expect(formatTextExpandCount(1, 4)).toBe('2/4');
  });

  it('pretty-prints JSON objects and arrays only', () => {
    expect(prettyPrintJsonBody('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyPrintJsonBody('[1,2]')).toBe('[\n  1,\n  2\n]');
    expect(prettyPrintJsonBody('  ')).toBeNull();
    expect(prettyPrintJsonBody('"just a string"')).toBeNull();
    expect(prettyPrintJsonBody('not json')).toBeNull();
    expect(prettyPrintJsonBody('null')).toBeNull();
  });

  it('minifies JSON objects and arrays to one line', () => {
    expect(minifyJsonBody('{\n  "a": 1\n}')).toBe('{"a":1}');
    expect(minifyJsonBody('[\n  1,\n  2\n]')).toBe('[1,2]');
    expect(minifyJsonBody('  ')).toBeNull();
    expect(minifyJsonBody('"just a string"')).toBeNull();
    expect(minifyJsonBody('not json')).toBeNull();
  });

  it('returns both formats from one parse', () => {
    expect(formatJsonBody('{"a":1}')).toEqual({
      pretty: '{\n  "a": 1\n}',
      minified: '{"a":1}',
    });
    expect(formatJsonBody('nope')).toBeNull();
  });

  it('counts lines and characters', () => {
    expect(textExpandStats('')).toEqual({ lines: 1, chars: 0 });
    expect(textExpandStats('ab')).toEqual({ lines: 1, chars: 2 });
    expect(textExpandStats('a\nb\n')).toEqual({ lines: 3, chars: 4 });
  });
});
