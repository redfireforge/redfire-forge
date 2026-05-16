import { describe, it, expect } from 'vitest';
import { prettyDebugValue, truncateDebugValue } from './expressionDebugHelpers';

describe('expressionDebugHelpers', () => {
  describe('prettyDebugValue', () => {
    it('pretty-prints valid JSON', () => {
      expect(prettyDebugValue('{"a":1}')).toBe('{\n  "a": 1\n}');
    });

    it('pretty-prints JSON arrays', () => {
      expect(prettyDebugValue('[1,2,3]')).toBe('[\n  1,\n  2,\n  3\n]');
    });

    it('returns raw string if not valid JSON', () => {
      expect(prettyDebugValue('not json')).toBe('not json');
    });

    it('handles primitive JSON values', () => {
      expect(prettyDebugValue('"hello"')).toBe('"hello"');
      expect(prettyDebugValue('42')).toBe('42');
      expect(prettyDebugValue('true')).toBe('true');
      expect(prettyDebugValue('null')).toBe('null');
    });

    it('handles empty string', () => {
      expect(prettyDebugValue('')).toBe('');
    });
  });

  describe('truncateDebugValue', () => {
    it('returns value unchanged when under max length', () => {
      expect(truncateDebugValue('short')).toBe('short');
    });

    it('truncates with ellipsis when over max length', () => {
      const long = 'a'.repeat(250);
      const result = truncateDebugValue(long);
      expect(result.length).toBe(200);
      expect(result.endsWith('…')).toBe(true);
    });

    it('respects custom max parameter', () => {
      const result = truncateDebugValue('abcdefghij', 5);
      expect(result).toBe('abcd…');
      expect(result.length).toBe(5);
    });

    it('returns exact max-length strings unchanged', () => {
      const exact = 'a'.repeat(200);
      expect(truncateDebugValue(exact)).toBe(exact);
    });

    it('handles empty string', () => {
      expect(truncateDebugValue('')).toBe('');
    });
  });
});
