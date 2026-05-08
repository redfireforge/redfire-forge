import { describe, expect, it } from 'vitest';
import { parseClampedInteger } from './subWorkflowConfigUtils';

describe('subWorkflowConfigUtils', () => {
  it('returns the default value when parsing fails', () => {
    expect(parseClampedInteger('', { defaultValue: 10, min: 1, max: 100 })).toBe(10);
  });

  it('clamps values below the minimum', () => {
    expect(parseClampedInteger('-5', { defaultValue: 0, min: 0, max: 10 })).toBe(0);
  });

  it('clamps values above the maximum', () => {
    expect(parseClampedInteger('999999', { defaultValue: 0, min: 0, max: 60000 })).toBe(60000);
  });

  it('returns in-range values unchanged', () => {
    expect(parseClampedInteger('42', { defaultValue: 0, min: 0, max: 100 })).toBe(42);
  });

  it('returns clampedMin when max is omitted', () => {
    expect(parseClampedInteger('5', { defaultValue: 0, min: 0 })).toBe(5);
  });

  it('returns clampedMin when max is undefined explicitly', () => {
    expect(parseClampedInteger('10', { defaultValue: 0, min: 3, max: undefined })).toBe(10);
  });

  it('clamps to min when value is below min and max is omitted', () => {
    expect(parseClampedInteger('-1', { defaultValue: 0, min: 0 })).toBe(0);
  });
});