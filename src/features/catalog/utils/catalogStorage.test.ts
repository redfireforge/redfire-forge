/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({ isTauri: () => false }));

import {
  loadCatalogEntries, saveCatalogEntries,
  loadCatalogRawSpec, saveCatalogRawSpec,
  removeCatalogRawSpec, removeAllCatalogRawSpecs,
} from '../../../shared/utils/storage';
import type { CatalogEntry } from '../types/catalog';

function makeEntry(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    currentVersionId: `v-${id}`,
    versions: [{
      id: `v-${id}`,
      version: '1.0.0',
      importedAt: Date.now(),
      specHash: 'abc123',
      specSize: 500,
    }],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints: [],
    hostConfig: { strategy: 'hardcoded' },
    authConfig: { strategy: 'hardcoded' },
  };
}

describe('Catalog storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadCatalogEntries / saveCatalogEntries', () => {
    it('returns empty array when no data', async () => {
      const entries = await loadCatalogEntries();
      expect(entries).toEqual([]);
    });

    it('round-trips entries', async () => {
      const entries = [makeEntry('e1', 'API One'), makeEntry('e2', 'API Two')];
      await saveCatalogEntries(entries);
      const loaded = await loadCatalogEntries();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].name).toBe('API One');
      expect(loaded[1].name).toBe('API Two');
    });

    it('overwrites previous entries', async () => {
      await saveCatalogEntries([makeEntry('e1', 'API One')]);
      await saveCatalogEntries([makeEntry('e2', 'API Two')]);
      const loaded = await loadCatalogEntries();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('API Two');
    });

    it('handles corrupt data gracefully', async () => {
      localStorage.setItem('perf-test-catalog', '{invalid json');
      const entries = await loadCatalogEntries();
      expect(entries).toEqual([]);
    });
  });

  describe('Catalog raw spec storage', () => {
    it('round-trips raw spec', async () => {
      const spec = 'openapi: "3.0.0"\ninfo:\n  title: Test\n  version: "1.0.0"\npaths: {}';
      await saveCatalogRawSpec('e1', 'v1', spec);
      const loaded = await loadCatalogRawSpec('e1', 'v1');
      expect(loaded).toBe(spec);
    });

    it('returns null for missing spec', async () => {
      const loaded = await loadCatalogRawSpec('no-such', 'no-such');
      expect(loaded).toBeNull();
    });

    it('removes a single spec', async () => {
      await saveCatalogRawSpec('e1', 'v1', 'spec1');
      await saveCatalogRawSpec('e1', 'v2', 'spec2');
      await removeCatalogRawSpec('e1', 'v1');
      expect(await loadCatalogRawSpec('e1', 'v1')).toBeNull();
      expect(await loadCatalogRawSpec('e1', 'v2')).toBe('spec2');
    });

    it('removes all specs for an entry', async () => {
      await saveCatalogRawSpec('e1', 'v1', 'spec1');
      await saveCatalogRawSpec('e1', 'v2', 'spec2');
      await saveCatalogRawSpec('e2', 'v3', 'other');
      await removeAllCatalogRawSpecs('e1', ['v1', 'v2']);
      expect(await loadCatalogRawSpec('e1', 'v1')).toBeNull();
      expect(await loadCatalogRawSpec('e1', 'v2')).toBeNull();
      expect(await loadCatalogRawSpec('e2', 'v3')).toBe('other');
    });

    it('stores specs in separate keys from catalog entries', async () => {
      await saveCatalogEntries([makeEntry('e1', 'API')]);
      await saveCatalogRawSpec('e1', 'v-e1', 'the-spec');

      const catalogRaw = localStorage.getItem('perf-test-catalog');
      expect(catalogRaw).toBeTruthy();
      expect(catalogRaw).not.toContain('the-spec');

      const specRaw = localStorage.getItem('perf-test-catalog-spec-e1-v-e1');
      expect(specRaw).toBe('the-spec');
    });
  });
});
