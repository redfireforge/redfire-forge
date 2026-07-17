import { describe, expect, it } from 'vitest';
import { isEmptyRecord } from './recordUtils';

describe('recordUtils', () => {
  describe('isEmptyRecord', () => {
    it('returns true for nullish records', () => {
      expect(isEmptyRecord(null)).toBe(true);
      expect(isEmptyRecord(undefined)).toBe(true);
    });

    it('returns true for records with no keys', () => {
      expect(isEmptyRecord({})).toBe(true);
    });

    it('returns false for records with keys', () => {
      expect(isEmptyRecord({ a: 1 })).toBe(false);
      expect(isEmptyRecord({ a: undefined })).toBe(false);
    });
  });
});
