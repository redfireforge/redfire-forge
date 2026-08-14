import { describe, expect, it } from 'vitest';
import {
  findTextExpandMatches,
  formatTextExpandCount,
  nextTextExpandMatch,
  prettyPrintJsonBody,
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
});
