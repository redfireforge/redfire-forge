import { describe, it, expect } from 'vitest';
import {
  normalizeMapperPath,
  isSameMapperPath,
  isMapperPathWithin,
  getMapperRelativePath,
} from './pathNormalization';

describe('normalizeMapperPath', () => {
  it('strips leading $. prefix', () => {
    expect(normalizeMapperPath('$.data.id')).toBe('data.id');
  });

  it('strips standalone $ prefix', () => {
    expect(normalizeMapperPath('$data')).toBe('data');
  });

  it('normalizes .[  to [', () => {
    expect(normalizeMapperPath('items.[0].name')).toBe('items[0].name');
  });

  it('collapses consecutive dots', () => {
    expect(normalizeMapperPath('a..b')).toBe('a.b');
  });

  it('removes trailing dot', () => {
    expect(normalizeMapperPath('data.')).toBe('data');
  });

  it('trims whitespace', () => {
    expect(normalizeMapperPath('  data.id  ')).toBe('data.id');
  });

  it('returns empty for empty string', () => {
    expect(normalizeMapperPath('')).toBe('');
  });
});

describe('isSameMapperPath', () => {
  it('returns true for equivalent paths', () => {
    expect(isSameMapperPath('$.data.id', 'data.id')).toBe(true);
  });

  it('returns false for different paths', () => {
    expect(isSameMapperPath('data.id', 'data.name')).toBe(false);
  });
});

describe('isMapperPathWithin', () => {
  it('returns true for child path', () => {
    expect(isMapperPathWithin('user.name', 'user')).toBe(true);
  });

  it('returns true for array child path', () => {
    expect(isMapperPathWithin('items[0].name', 'items')).toBe(true);
  });

  it('returns true when paths match exactly', () => {
    expect(isMapperPathWithin('user', 'user')).toBe(true);
  });

  it('returns false for unrelated paths', () => {
    expect(isMapperPathWithin('other.name', 'user')).toBe(false);
  });

  it('returns true for any non-empty path when parent is empty', () => {
    expect(isMapperPathWithin('data', '')).toBe(true);
  });

  it('returns false for empty path when parent is empty', () => {
    expect(isMapperPathWithin('', '')).toBe(false);
  });
});

describe('getMapperRelativePath', () => {
  it('returns relative portion for child path', () => {
    expect(getMapperRelativePath('user.name', 'user')).toBe('.name');
  });

  it('returns array-indexed relative for child', () => {
    expect(getMapperRelativePath('items[0].name', 'items')).toBe('[0].name');
  });

  it('returns empty when paths match', () => {
    expect(getMapperRelativePath('user', 'user')).toBe('');
  });

  it('returns full normalized path when parent is empty', () => {
    expect(getMapperRelativePath('data.id', '')).toBe('data.id');
  });

  it('returns null for unrelated paths', () => {
    expect(getMapperRelativePath('other.name', 'user')).toBeNull();
  });
});
