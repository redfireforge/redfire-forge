import { describe, it, expect } from 'vitest';
import { encodingFunctions } from './encodingFunctions';

function evalFn(name: string, ...args: unknown[]): unknown {
  const fn = encodingFunctions.find((f) => f.name === name);
  if (!fn) throw new Error(`Function ${name} not found`);
  return fn.evaluate(...args);
}

describe('encodingFunctions', () => {
  describe('$base64', () => {
    it('encodes string to base64', () => expect(evalFn('$base64', 'hello')).toBe('aGVsbG8='));
    it('encodes empty string', () => expect(evalFn('$base64', '')).toBe(''));
    it('encodes numbers via coercion', () => expect(evalFn('$base64', 42)).toBe(btoa('42')));
    it('handles null', () => expect(evalFn('$base64', null)).toBe(''));
    it('returns empty string for non-Latin-1 chars (catch branch)', () => expect(evalFn('$base64', '\u{1F600}')).toBe(''));
  });

  describe('$base64Decode', () => {
    it('decodes base64 to string', () => expect(evalFn('$base64Decode', 'aGVsbG8=')).toBe('hello'));
    it('returns empty for invalid base64', () => expect(evalFn('$base64Decode', '!!invalid!!')).toBe(''));
    it('decodes empty string', () => expect(evalFn('$base64Decode', '')).toBe(''));
    it('round-trips with $base64', () => {
      const encoded = evalFn('$base64', 'test data');
      expect(evalFn('$base64Decode', encoded)).toBe('test data');
    });
  });

  describe('$urlEncode', () => {
    it('encodes spaces', () => expect(evalFn('$urlEncode', 'hello world')).toBe('hello%20world'));
    it('encodes special characters', () => expect(evalFn('$urlEncode', 'a&b=c')).toBe('a%26b%3Dc'));
    it('leaves alphanumeric unchanged', () => expect(evalFn('$urlEncode', 'abc123')).toBe('abc123'));
    it('handles empty string', () => expect(evalFn('$urlEncode', '')).toBe(''));
    it('returns input string for lone surrogates (catch branch)', () => {
      const lone = '\uD800';
      const result = evalFn('$urlEncode', lone);
      expect(typeof result).toBe('string');
    });
  });

  describe('$urlDecode', () => {
    it('decodes percent-encoded', () => expect(evalFn('$urlDecode', 'hello%20world')).toBe('hello world'));
    it('returns original on invalid encoding', () => expect(evalFn('$urlDecode', '%ZZ')).toBe('%ZZ'));
    it('round-trips with $urlEncode', () => {
      const encoded = evalFn('$urlEncode', 'key=val&foo=bar');
      expect(evalFn('$urlDecode', encoded)).toBe('key=val&foo=bar');
    });
  });

  describe('$hash', () => {
    it('returns hex string', () => {
      const result = evalFn('$hash', 'hello');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]+$/);
    });
    it('is deterministic', () => {
      expect(evalFn('$hash', 'test')).toBe(evalFn('$hash', 'test'));
    });
    it('produces different hashes for different inputs', () => {
      expect(evalFn('$hash', 'abc')).not.toBe(evalFn('$hash', 'xyz'));
    });
    it('handles empty string', () => {
      const result = evalFn('$hash', '');
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThan(0);
    });
    it('matches documented example', () => {
      expect(evalFn('$hash', 'hello')).toBe('f923099');
    });
  });

  it('exports all 5 functions', () => {
    expect(encodingFunctions).toHaveLength(5);
    const names = encodingFunctions.map((f) => f.name);
    expect(names).toContain('$base64');
    expect(names).toContain('$hash');
  });
});
