import { describe, it, expect } from 'vitest';
import { s, n } from './helpers';

describe('expressionFunctions/helpers', () => {
  describe('s (string coercion)', () => {
    it('converts null to empty string', () => {
      expect(s(null)).toBe('');
    });

    it('converts undefined to empty string', () => {
      expect(s(undefined)).toBe('');
    });

    it('converts number to string', () => {
      expect(s(42)).toBe('42');
      expect(s(0)).toBe('0');
      expect(s(-123)).toBe('-123');
      expect(s(3.14)).toBe('3.14');
    });

    it('converts boolean to string', () => {
      expect(s(true)).toBe('true');
      expect(s(false)).toBe('false');
    });

    it('returns string as-is', () => {
      expect(s('hello')).toBe('hello');
      expect(s('')).toBe('');
      expect(s('  spaces  ')).toBe('  spaces  ');
    });

    it('converts object to string representation', () => {
      expect(s({})).toBe('[object Object]');
      expect(s({ key: 'value' })).toBe('[object Object]');
    });

    it('converts array to comma-separated string', () => {
      expect(s([1, 2, 3])).toBe('1,2,3');
      expect(s([])).toBe('');
      expect(s(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('handles special number values', () => {
      expect(s(Infinity)).toBe('Infinity');
      expect(s(-Infinity)).toBe('-Infinity');
      expect(s(NaN)).toBe('NaN');
    });

    it('handles BigInt', () => {
      expect(s(BigInt(123))).toBe('123');
    });
  });

  describe('n (number coercion)', () => {
    it('converts null to 0', () => {
      expect(n(null)).toBe(0);
    });

    it('converts undefined to 0', () => {
      expect(n(undefined)).toBe(0);
    });

    it('returns number as-is', () => {
      expect(n(42)).toBe(42);
      expect(n(0)).toBe(0);
      expect(n(-123)).toBe(-123);
      expect(n(3.14)).toBe(3.14);
    });

    it('converts numeric string to number', () => {
      expect(n('42')).toBe(42);
      expect(n('0')).toBe(0);
      expect(n('-123')).toBe(-123);
      expect(n('3.14')).toBe(3.14);
    });

    it('converts empty string to 0', () => {
      expect(n('')).toBe(0);
    });

    it('converts whitespace string to 0', () => {
      expect(n('   ')).toBe(0);
    });

    it('converts non-numeric string to 0', () => {
      expect(n('hello')).toBe(0);
      expect(n('abc123')).toBe(0);
      expect(n('not a number')).toBe(0);
    });

    it('converts boolean to number', () => {
      expect(n(true)).toBe(1);
      expect(n(false)).toBe(0);
    });

    it('converts object to 0', () => {
      expect(n({})).toBe(0);
      expect(n({ key: 'value' })).toBe(0);
    });

    it('converts array with single number to that number', () => {
      expect(n([42])).toBe(42);
      expect(n(['123'])).toBe(123);
    });

    it('converts empty array to 0', () => {
      expect(n([])).toBe(0);
    });

    it('converts multi-element array to 0', () => {
      expect(n([1, 2, 3])).toBe(0);
    });

    it('handles special number values', () => {
      expect(n(Infinity)).toBe(Infinity);
      expect(n(-Infinity)).toBe(-Infinity);
      expect(n(NaN)).toBe(0); // NaN gets converted to 0 by the function
    });

    it('handles scientific notation strings', () => {
      expect(n('1e3')).toBe(1000);
      expect(n('1.5e2')).toBe(150);
      expect(n('2e-1')).toBe(0.2);
    });

    it('handles hexadecimal strings', () => {
      expect(n('0x10')).toBe(16);
      expect(n('0xFF')).toBe(255);
    });

    it('converts BigInt to number', () => {
      expect(n(BigInt(123))).toBe(123);
    });
  });

  describe('edge cases', () => {
    it('s handles circular reference safely', () => {
      type Circular = Record<string, unknown> & { self?: Circular };
      const obj: Circular = { a: 1 };
      obj.self = obj;
      expect(() => s(obj)).not.toThrow();
    });

    it('n handles circular reference safely', () => {
      type Circular = Record<string, unknown> & { self?: Circular };
      const obj: Circular = { a: 1 };
      obj.self = obj;
      expect(n(obj)).toBe(0);
    });

    it('handles mixed null and number operations', () => {
      expect(n(s(null))).toBe(0);
      expect(s(n(null))).toBe('0');
    });

    it('handles chained conversions', () => {
      expect(s(n('42'))).toBe('42');
      expect(n(s(42))).toBe(42);
    });
  });
});
