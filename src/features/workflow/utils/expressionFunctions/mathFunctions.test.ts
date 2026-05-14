import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mathFunctions } from './mathFunctions';

function fn(name: string) {
  const f = mathFunctions.find((mf) => mf.name === name);
  if (!f) throw new Error(`Function ${name} not found`);
  return f.evaluate;
}

function mockPredictableRandom(value: number) {
  vi.spyOn(Math, 'random').mockReturnValue(value);
}

describe('mathFunctions', () => {
  it('exports 28 functions', () => {
    expect(mathFunctions).toHaveLength(28);
  });

  describe('$add', () => {
    it('adds two numbers', () => expect(fn('$add')(10, 5)).toBe(15));
    it('coerces strings', () => expect(fn('$add')('3', '7')).toBe(10));
  });

  describe('$subtract', () => {
    it('subtracts b from a', () => expect(fn('$subtract')(10, 3)).toBe(7));
  });

  describe('$multiply', () => {
    it('multiplies', () => expect(fn('$multiply')(4, 5)).toBe(20));
  });

  describe('$divide', () => {
    it('divides', () => expect(fn('$divide')(10, 2)).toBe(5));
    it('returns 0 for division by zero', () => expect(fn('$divide')(10, 0)).toBe(0));
  });

  describe('$round', () => {
    it('rounds to nearest integer by default', () => expect(fn('$round')(3.7)).toBe(4));
    it('rounds to specified decimals', () => expect(fn('$round')(3.14159, 2)).toBe(3.14));
    it('treats null decimals like default precision', () => expect(fn('$round')(12.499, null)).toBe(12));
    it('clamps decimals above 20 to 20', () => expect(fn('$round')(1.123456789, 50)).toBeCloseTo(1.123456789, 15));
    it('clamps decimals below zero to zero', () => expect(fn('$round')(9.876, -3)).toBe(10));
  });

  describe('$abs', () => {
    it('returns absolute value', () => expect(fn('$abs')(-5)).toBe(5));
    it('returns positive unchanged', () => expect(fn('$abs')(5)).toBe(5));
  });

  describe('$min', () => {
    it('returns smaller value', () => expect(fn('$min')(3, 7)).toBe(3));
  });

  describe('$max', () => {
    it('returns larger value', () => expect(fn('$max')(3, 7)).toBe(7));
  });

  describe('$mod', () => {
    it('returns remainder', () => expect(fn('$mod')(10, 3)).toBe(1));
    it('returns 0 when mod by zero', () => expect(fn('$mod')(10, 0)).toBe(0));
  });

  describe('$floor', () => {
    it('floors down', () => expect(fn('$floor')(3.9)).toBe(3));
  });

  describe('$ceil', () => {
    it('ceils up', () => expect(fn('$ceil')(3.1)).toBe(4));
  });

  describe('$power', () => {
    it('raises to power', () => expect(fn('$power')(2, 3)).toBe(8));
  });

  describe('$random', () => {
    beforeEach(() => {
      mockPredictableRandom(0);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns a number between min and max', () => {
      mockPredictableRandom(0.999);
      expect(fn('$random')(1, 10)).toBe(10);
    });

    it('handles swapped min/max gracefully', () => {
      mockPredictableRandom(0);
      expect(fn('$random')(10, 1)).toBe(1);
    });

    it('defaults min to zero and max when only end bound provided', () => {
      mockPredictableRandom(0);
      expect(fn('$random')(null, 2)).toBe(0);
    });

    it('uses inclusive 0-based default ceiling when bounds omitted entirely', () => {
      mockPredictableRandom(0);
      expect(fn('$random')()).toBe(0);
    });

    it('defaults max when only min provided', () => {
      mockPredictableRandom(0);
      expect(fn('$random')(5)).toBe(5);
    });
  });

  describe('$parseInt', () => {
    it('parses integer string', () => expect(fn('$parseInt')('42')).toBe(42));
    it('truncates float string', () => expect(fn('$parseInt')('3.14')).toBe(3));
    it('returns 0 for non-numeric', () => expect(fn('$parseInt')('abc')).toBe(0));
  });

  describe('$toInt', () => {
    it('converts boolean true to 1', () => expect(fn('$toInt')(true)).toBe(1));
    it('converts boolean false to 0', () => expect(fn('$toInt')(false)).toBe(0));
    it('converts string "true" to 1', () => expect(fn('$toInt')('true')).toBe(1));
    it('converts string "false" to 0', () => expect(fn('$toInt')('false')).toBe(0));
    it('converts string "TRUE" (case-insensitive) to 1', () => expect(fn('$toInt')('  TRUE  ')).toBe(1));
    it('converts numeric string', () => expect(fn('$toInt')('7')).toBe(7));
    it('returns 0 for non-numeric string', () => expect(fn('$toInt')('abc')).toBe(0));
    it('handles NaN from parseInt', () => expect(fn('$toInt')('not-a-number')).toBe(0));
  });

  describe('$parseFloat', () => {
    it('parses float string', () => expect(fn('$parseFloat')('3.14')).toBe(3.14));
    it('returns 0 for non-numeric', () => expect(fn('$parseFloat')('abc')).toBe(0));
  });

  describe('$sqrt', () => {
    it('returns square root of positive number', () => expect(fn('$sqrt')(16)).toBe(4));
    it('returns square root of 2', () => expect(fn('$sqrt')(2)).toBeCloseTo(1.4142, 4));
    it('returns 0 for negative number', () => expect(fn('$sqrt')(-4)).toBe(0));
    it('returns 0 for zero', () => expect(fn('$sqrt')(0)).toBe(0));
    it('coerces string input', () => expect(fn('$sqrt')('25')).toBe(5));
  });

  describe('$clamp', () => {
    it('clamps value above max', () => expect(fn('$clamp')(15, 0, 10)).toBe(10));
    it('clamps value below min', () => expect(fn('$clamp')(-5, 0, 10)).toBe(0));
    it('returns value within range unchanged', () => expect(fn('$clamp')(5, 0, 10)).toBe(5));
    it('handles boundary values', () => {
      expect(fn('$clamp')(0, 0, 10)).toBe(0);
      expect(fn('$clamp')(10, 0, 10)).toBe(10);
    });
    it('coerces string inputs', () => expect(fn('$clamp')('7', '1', '9')).toBe(7));
  });

  describe('$uuid', () => {
    const origRandom = Math.random.bind(Math);

    afterEach(() => {
      Math.random = origRandom;
      vi.unstubAllGlobals();
    });

    it('returns a valid UUID v4 format', () => {
      Math.random = origRandom;
      const result = fn('$uuid')() as string;
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('generates unique values on successive calls', () => {
      Math.random = origRandom;
      const a = fn('$uuid')() as string;
      const b = fn('$uuid')() as string;
      expect(a).not.toBe(b);
    });

    it('falls back when Web Crypto lacks randomUUID', () => {
      vi.stubGlobal('crypto', {});
      mockPredictableRandom(0);

      expect(fn('$uuid')()).toMatch(/^[0-9a-f-]{36}$/);

      Math.random = origRandom;
    });
  });

  describe('$range', () => {
    it('generates ascending sequence', () => {
      expect(fn('$range')(0, 5)).toEqual([0, 1, 2, 3, 4]);
    });

    it('respects custom step', () => {
      expect(fn('$range')(0, 10, 2)).toEqual([0, 2, 4, 6, 8]);
    });

    it('returns empty for start >= end with positive step', () => {
      expect(fn('$range')(5, 5)).toEqual([]);
      expect(fn('$range')(10, 5)).toEqual([]);
    });

    it('handles negative step for descending', () => {
      expect(fn('$range')(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
    });

    it('short-circuits negative step ranges that never approach end', () => {
      expect(fn('$range')(0, 10, -1)).toEqual([]);
      expect(fn('$range')(10, -5, -1)).toContain(10);
    });

    it('treats step of 0 as 1', () => {
      expect(fn('$range')(0, 3, 0)).toEqual([0, 1, 2]);
    });

    it('omits trailing values when fractional step aligns past boundary', () => {
      expect(fn('$range')(0, 11, 2.75)).toEqual([0, 2.75, 5.5, 8.25]);
    });

    it('caps at 10000 elements to prevent infinite loops', () => {
      const result = fn('$range')(0, 100000, 1) as number[];
      expect(result).toHaveLength(10000);
    });
  });

  describe('$gt', () => {
    it('returns true when a > b', () => expect(fn('$gt')(5, 3)).toBe(true));
    it('returns false when a < b', () => expect(fn('$gt')(2, 5)).toBe(false));
    it('returns false when a = b', () => expect(fn('$gt')(3, 3)).toBe(false));
    it('coerces strings to numbers', () => expect(fn('$gt')('10', '2')).toBe(true));
  });

  describe('$gte', () => {
    it('returns true when a > b', () => expect(fn('$gte')(5, 3)).toBe(true));
    it('returns true when a = b', () => expect(fn('$gte')(3, 3)).toBe(true));
    it('returns false when a < b', () => expect(fn('$gte')(2, 3)).toBe(false));
  });

  describe('$lt', () => {
    it('returns true when a < b', () => expect(fn('$lt')(2, 5)).toBe(true));
    it('returns false when a > b', () => expect(fn('$lt')(5, 3)).toBe(false));
    it('returns false when a = b', () => expect(fn('$lt')(3, 3)).toBe(false));
  });

  describe('$lte', () => {
    it('returns true when a < b', () => expect(fn('$lte')(2, 5)).toBe(true));
    it('returns true when a = b', () => expect(fn('$lte')(3, 3)).toBe(true));
    it('returns false when a > b', () => expect(fn('$lte')(5, 3)).toBe(false));
  });

  describe('$eq', () => {
    it('returns true for equal numbers', () => expect(fn('$eq')(5, 5)).toBe(true));
    it('returns false for different numbers', () => expect(fn('$eq')(5, 3)).toBe(false));
    it('compares strings', () => expect(fn('$eq')('abc', 'abc')).toBe(true));
    it('handles null comparisons', () => expect(fn('$eq')(null, null)).toBe(true));
    it('handles mixed types via string coercion', () => expect(fn('$eq')('5', '5')).toBe(true));
  });

  describe('$neq', () => {
    it('returns true for different numbers', () => expect(fn('$neq')(5, 3)).toBe(true));
    it('returns false for equal numbers', () => expect(fn('$neq')(5, 5)).toBe(false));
    it('compares strings', () => expect(fn('$neq')('a', 'b')).toBe(true));
    it('compares heterogeneous operands after string coercion', () => expect(fn('$neq')(5, '3')).toBe(true));
  });

  describe('$log', () => {
    it('returns 0 for log(1)', () => expect(fn('$log')(1)).toBe(0));
    it('returns ~1 for log(e)', () => expect(fn('$log')(Math.E)).toBeCloseTo(1, 10));
    it('returns negative for log(0.5)', () => expect(fn('$log')(0.5)).toBeLessThan(0));
  });

  describe('$exp', () => {
    it('returns 1 for exp(0)', () => expect(fn('$exp')(0)).toBe(1));
    it('returns e for exp(1)', () => expect(fn('$exp')(1)).toBeCloseTo(Math.E, 10));
    it('returns e^2 for exp(2)', () => expect(fn('$exp')(2)).toBeCloseTo(Math.E * Math.E, 5));
  });
});
