/**
 * Phase 8E — numeric compare edge cases.
 */
import { describe, expect, it } from 'vitest';
import {
  compareGrpcHarnessNumericValues,
  isUnsafeGrpcHarnessIntegerNumber,
} from './grpcHarnessNumericCompare';

describe('grpcHarnessNumericCompare coverage gaps (Phase 8E)', () => {
  it('uses string BigInt path for int64 values that exceed Number.MAX_SAFE_INTEGER', () => {
    expect(compareGrpcHarnessNumericValues(
      '9223372036854775807',
      '==',
      '9223372036854775807',
    ).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(
      '9223372036854775807',
      '==',
      '9223372036854775806',
    ).ok).toBe(false);
  });

  it('does not promote unsafe integer numbers to BigInt', () => {
    const unsafe = Number('9223372036854775807');
    expect(isUnsafeGrpcHarnessIntegerNumber(unsafe)).toBe(true);
    expect(compareGrpcHarnessNumericValues(
      '9223372036854775807',
      '!=',
      '9223372036854775806',
    ).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(unsafe, '>', '0').ok).toBe(false);
  });

  it('compares string int64 actuals against unsafe expected numbers via decimal text', () => {
    const unsafe = Number('9223372036854775807');
    expect(isUnsafeGrpcHarnessIntegerNumber(unsafe)).toBe(true);
    const expectedDecimalText = String(unsafe);
    expect(compareGrpcHarnessNumericValues(
      expectedDecimalText,
      '==',
      unsafe,
    ).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(
      expectedDecimalText,
      '!=',
      unsafe,
    ).ok).toBe(false);
    const adjacentText = expectedDecimalText.endsWith('0')
      ? `${expectedDecimalText.slice(0, -1)}1`
      : `${expectedDecimalText.slice(0, -1)}0`;
    if (adjacentText !== expectedDecimalText) {
      expect(compareGrpcHarnessNumericValues(
        adjacentText,
        '==',
        unsafe,
      ).ok).toBe(false);
    }
  });

  it('compares both unsafe integer numbers with Object.is semantics', () => {
    const unsafe = Number('9223372036854775807');
    const otherUnsafe = Number('9007199254740994');
    expect(isUnsafeGrpcHarnessIntegerNumber(unsafe)).toBe(true);
    expect(isUnsafeGrpcHarnessIntegerNumber(otherUnsafe)).toBe(true);
    expect(unsafe).not.toBe(otherUnsafe);
    expect(compareGrpcHarnessNumericValues(unsafe, '==', unsafe).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(unsafe, '!=', otherUnsafe).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(unsafe, '>', unsafe).ok).toBe(false);
    expect(compareGrpcHarnessNumericValues(unsafe, '>=', unsafe).ok).toBe(false);
  });

  it('stringifies non-primitive actual values for failure text', () => {
    const result = compareGrpcHarnessNumericValues({ invalid: true }, '==', 'not-equal');
    expect(result.ok).toBe(false);
    expect(result.actualText).toContain('invalid');
  });

  it('compares non-numeric text with == and != only', () => {
    expect(compareGrpcHarnessNumericValues('abc', '==', 'abc').ok).toBe(true);
    expect(compareGrpcHarnessNumericValues('abc', '!=', 'xyz').ok).toBe(true);
    expect(compareGrpcHarnessNumericValues('abc', '>', 'aaa').ok).toBe(false);
  });

  it('handles bigint actual values', () => {
    expect(compareGrpcHarnessNumericValues(42n, '==', '42').ok).toBe(true);
  });

  it('treats null and undefined as empty text for ordering operators', () => {
    expect(compareGrpcHarnessNumericValues(null, '==', '').ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(undefined, '>', '1').ok).toBe(false);
  });

  it('covers remaining ordered operator branches including fallback operator handling', () => {
    expect(compareGrpcHarnessNumericValues('5', '>=', '5').ok).toBe(true);
    expect(compareGrpcHarnessNumericValues('3', '<', '4').ok).toBe(true);
    expect(compareGrpcHarnessNumericValues('3', '<=', '3').ok).toBe(true);
    expect(compareGrpcHarnessNumericValues('3', '>=' as unknown as '==', '4').ok).toBe(false);
  });

  it('falls back to String(value) when JSON serialization fails', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = compareGrpcHarnessNumericValues(circular, '==', '[object Object]');
    expect(result.actualText).toBe('[object Object]');
  });
});
