import { describe, it, expect } from 'vitest';
import { typeColor, TYPE_COLORS, getValuePreview } from './jsonTreeShared';

describe('TYPE_COLORS', () => {
  it('has correct colors for all four types', () => {
    expect(TYPE_COLORS.string).toBe('#86efac');
    expect(TYPE_COLORS.number).toBe('#fbbf24');
    expect(TYPE_COLORS.boolean).toBe('#c084fc');
    expect(TYPE_COLORS.null).toBe('#f87171');
  });
});

describe('typeColor', () => {
  it('returns mapped color for known types', () => {
    expect(typeColor('string')).toBe('#86efac');
    expect(typeColor('number')).toBe('#fbbf24');
    expect(typeColor('boolean')).toBe('#c084fc');
    expect(typeColor('null')).toBe('#f87171');
  });

  it('returns fallback for object, array, and unknown', () => {
    expect(typeColor('object')).toBe('var(--text-muted)');
    expect(typeColor('array')).toBe('var(--text-muted)');
    expect(typeColor('xyz')).toBe('var(--text-muted)');
  });
});

describe('getValuePreview', () => {
  it('formats objects with key count', () => {
    expect(getValuePreview('object', {}, 3)).toBe('{ 3 keys }');
    expect(getValuePreview('object', {}, 0)).toBe('{ 0 keys }');
  });

  it('formats arrays with item count', () => {
    expect(getValuePreview('array', [], 5)).toBe('[ 5 items ]');
    expect(getValuePreview('array', [], 0)).toBe('[ 0 items ]');
  });

  it('formats short strings with quotes', () => {
    expect(getValuePreview('string', 'hello', 0)).toBe('"hello"');
  });

  it('truncates strings exceeding maxStringLen (default 60)', () => {
    const long = 'a'.repeat(61);
    expect(getValuePreview('string', long, 0)).toBe(`"${'a'.repeat(60)}..."`);
  });

  it('does not truncate strings at exactly maxStringLen', () => {
    const exact = 'x'.repeat(60);
    expect(getValuePreview('string', exact, 0)).toBe(`"${exact}"`);
  });

  it('respects custom maxStringLen', () => {
    expect(getValuePreview('string', 'abcdefghij', 0, 5)).toBe('"abcde..."');
  });

  it('formats null', () => {
    expect(getValuePreview('null', null, 0)).toBe('null');
  });

  it('formats numbers', () => {
    expect(getValuePreview('number', 42, 0)).toBe('42');
    expect(getValuePreview('number', 3.14, 0)).toBe('3.14');
  });

  it('formats booleans', () => {
    expect(getValuePreview('boolean', true, 0)).toBe('true');
    expect(getValuePreview('boolean', false, 0)).toBe('false');
  });
});
