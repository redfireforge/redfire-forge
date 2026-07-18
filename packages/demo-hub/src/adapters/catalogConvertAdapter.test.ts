/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  seedSwagger2CatalogEntry,
  deleteCatalogEntryByName,
  selectCatalogEntryByName,
  isCatalogLoaded,
} from './catalogConvertAdapter';

const WIN = () => window as unknown as Record<string, unknown>;

describe('catalogConvertAdapter', () => {
  beforeEach(() => {
    delete WIN().__demoSeedCatalogSwagger2;
    delete WIN().__demoDeleteCatalogByName;
    delete WIN().__demoSelectCatalogByName;
    delete WIN().__demoCatalogLoaded;
  });

  describe('seedSwagger2CatalogEntry', () => {
    it('forwards to the bridge and resolves its id', async () => {
      const fn = vi.fn().mockResolvedValue('e1');
      WIN().__demoSeedCatalogSwagger2 = fn;
      await expect(seedSwagger2CatalogEntry('Demo', 'RAW')).resolves.toBe('e1');
      expect(fn).toHaveBeenCalledWith('Demo', 'RAW');
    });

    it('resolves null when the bridge is absent', async () => {
      await expect(seedSwagger2CatalogEntry('Demo', 'RAW')).resolves.toBeNull();
    });
  });

  describe('deleteCatalogEntryByName', () => {
    it('forwards to the bridge when present', () => {
      const fn = vi.fn();
      WIN().__demoDeleteCatalogByName = fn;
      deleteCatalogEntryByName('Demo');
      expect(fn).toHaveBeenCalledWith('Demo');
    });

    it('is a no-op when the bridge is absent', () => {
      expect(() => deleteCatalogEntryByName('Demo')).not.toThrow();
    });
  });

  describe('selectCatalogEntryByName', () => {
    it('returns the bridge result', () => {
      WIN().__demoSelectCatalogByName = vi.fn().mockReturnValue(true);
      expect(selectCatalogEntryByName('Demo')).toBe(true);
    });

    it('returns false when the bridge is absent', () => {
      expect(selectCatalogEntryByName('Demo')).toBe(false);
    });
  });

  describe('isCatalogLoaded', () => {
    it('is true only when the flag is exactly true', () => {
      expect(isCatalogLoaded()).toBe(false);
      WIN().__demoCatalogLoaded = false;
      expect(isCatalogLoaded()).toBe(false);
      WIN().__demoCatalogLoaded = true;
      expect(isCatalogLoaded()).toBe(true);
    });
  });
});
