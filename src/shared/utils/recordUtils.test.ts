import { describe, expect, it } from 'vitest';
import { isEmptyRecord } from './recordUtils';

describe('shared/utils/recordUtils', () => {
  describe('isEmptyRecord', () => {
    it('returns true for null and undefined', () => {
      expect(isEmptyRecord(null)).toBe(true);
      expect(isEmptyRecord(undefined)).toBe(true);
    });

    it('returns true for an empty object', () => {
      expect(isEmptyRecord({})).toBe(true);
    });

    it('returns false when any key exists', () => {
      expect(isEmptyRecord({ a: 1 })).toBe(false);
      expect(isEmptyRecord({ a: undefined })).toBe(false);
    });
  });
});
