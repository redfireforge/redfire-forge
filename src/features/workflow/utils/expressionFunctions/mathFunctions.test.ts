import { describe, it, expect } from 'vitest';
import { mathFunctions } from './mathFunctions';

function fn(name: string) {
  const f = mathFunctions.find((mf) => mf.name === name);
  if (!f) throw new Error(`Function ${name} not found`);
  return f.evaluate;
}

describe('mathFunctions', () => {
  it('exports 16 functions', () => {
    expect(mathFunctions).toHaveLength(16);
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
    it('returns a number between min and max', () => {
      const result = fn('$random')(1, 10);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    });

    it('handles swapped min/max gracefully', () => {
      const result = fn('$random')(10, 1);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
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
});
