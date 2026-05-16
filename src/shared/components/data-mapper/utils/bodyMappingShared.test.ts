import { describe, it, expect } from 'vitest';
import { findSourceForRef, hasUnsafePathSegment } from './bodyMappingShared';
import type { MapperSource } from '../types';

describe('bodyMappingShared', () => {
  describe('findSourceForRef', () => {
    const sources: MapperSource[] = [
      { id: 'src1', label: 'Source 1', sampleData: { userId: '123', name: 'Jo' }, format: 'json' },
      { id: 'src2', label: 'Source 2', sampleData: { orderId: '456' }, format: 'json' },
    ];

    it('returns matching source id', () => {
      expect(findSourceForRef('orderId', sources)).toBe('src2');
    });

    it('returns first source id when ref not found', () => {
      expect(findSourceForRef('nonExistent', sources)).toBe('src1');
    });

    it('returns __unknown__ when sources array is empty', () => {
      expect(findSourceForRef('any', [])).toBe('__unknown__');
    });

    it('skips sources with no sampleData', () => {
      const sparse: MapperSource[] = [
        { id: 'empty', label: 'Empty', format: 'json' },
        { id: 'full', label: 'Full', sampleData: { x: 1 }, format: 'json' },
      ];
      expect(findSourceForRef('x', sparse)).toBe('full');
      expect(findSourceForRef('missing', sparse)).toBe('empty');
    });
  });

  describe('hasUnsafePathSegment', () => {
    it('detects __proto__', () => {
      expect(hasUnsafePathSegment('foo.__proto__.bar')).toBe(true);
    });

    it('detects prototype', () => {
      expect(hasUnsafePathSegment('prototype.x')).toBe(true);
    });

    it('detects constructor', () => {
      expect(hasUnsafePathSegment('a.constructor')).toBe(true);
    });

    it('returns false for safe paths', () => {
      expect(hasUnsafePathSegment('user.name')).toBe(false);
      expect(hasUnsafePathSegment('items.count')).toBe(false);
    });

    it('handles $. prefix', () => {
      expect(hasUnsafePathSegment('$.__proto__')).toBe(true);
      expect(hasUnsafePathSegment('$.user.name')).toBe(false);
    });

    it('handles empty and simple paths', () => {
      expect(hasUnsafePathSegment('')).toBe(false);
      expect(hasUnsafePathSegment('name')).toBe(false);
    });
  });
});
