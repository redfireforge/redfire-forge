import { describe, it, expect } from 'vitest';
import {
  TRASH_MS_PER_DAY,
  DEFAULT_TRASH_SETTINGS,
  TRASH_RETENTION_OPTIONS,
  TRASH_MAX_ITEMS_OPTIONS,
  RESTORED_ITEMS_FG_NAME,
  RESTORED_TESTS_SC_NAME,
  RESTORED_SUFFIX,
  computeExpiresAt,
} from './trashConstants';

describe('trashConstants', () => {
  it('TRASH_MS_PER_DAY equals 86400000', () => {
    expect(TRASH_MS_PER_DAY).toBe(86_400_000);
  });

  it('DEFAULT_TRASH_SETTINGS has expected defaults', () => {
    expect(DEFAULT_TRASH_SETTINGS).toEqual({ retentionDays: 30, maxItems: 100 });
  });

  it('TRASH_RETENTION_OPTIONS contains expected values', () => {
    expect([...TRASH_RETENTION_OPTIONS]).toEqual([7, 14, 30, 60, 90]);
  });

  it('TRASH_MAX_ITEMS_OPTIONS contains expected values', () => {
    expect([...TRASH_MAX_ITEMS_OPTIONS]).toEqual([50, 100, 200]);
  });

  it('RESTORED_ITEMS_FG_NAME is defined', () => {
    expect(RESTORED_ITEMS_FG_NAME).toBe('Restored Items');
  });

  it('RESTORED_TESTS_SC_NAME is defined', () => {
    expect(RESTORED_TESTS_SC_NAME).toBe('Restored Tests');
  });

  it('RESTORED_SUFFIX is defined', () => {
    expect(RESTORED_SUFFIX).toBe(' (restored)');
  });

  describe('computeExpiresAt', () => {
    it('computes expiry as deletedAt + retentionDays * MS_PER_DAY', () => {
      const deletedAt = 1_000_000;
      const retentionDays = 7;
      expect(computeExpiresAt(deletedAt, retentionDays)).toBe(1_000_000 + 7 * 86_400_000);
    });

    it('returns deletedAt when retentionDays is 0', () => {
      expect(computeExpiresAt(5000, 0)).toBe(5000);
    });
  });
});
