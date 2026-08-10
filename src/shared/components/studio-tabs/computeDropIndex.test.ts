import { describe, it, expect } from 'vitest';
import { computeDropIndex } from './computeDropIndex';

describe('computeDropIndex', () => {
  it('returns null when source === computed target (no-op)', () => {
    expect(computeDropIndex(1, 1, 100, 50, 100)).toBeNull();
  });

  it('drops before target when cursor is left of midpoint', () => {
    expect(computeDropIndex(0, 2, 50, 40, 100)).toBe(1);
  });

  it('drops after target when cursor is right of midpoint', () => {
    expect(computeDropIndex(0, 1, 120, 40, 100)).toBe(1);
  });

  it('adjusts when dragging forwards (fromIndex < toIndex)', () => {
    expect(computeDropIndex(0, 3, 200, 150, 80)).toBe(3);
  });

  it('moves backwards correctly', () => {
    expect(computeDropIndex(3, 0, 10, 0, 100)).toBe(0);
  });

  it('returns null when drop would not change position (left of same)', () => {
    expect(computeDropIndex(2, 2, 10, 0, 100)).toBeNull();
  });

  it('returns null when drop would keep item in-place after adjustment', () => {
    expect(computeDropIndex(1, 2, 10, 0, 100)).toBeNull();
  });
});
