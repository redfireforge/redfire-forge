/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({ isTauri: () => false }));

const { catalogStore } = vi.hoisted(() => ({
  catalogStore: {
    entries: null as import('../types/catalog').CatalogEntry[] | null,
    rawSpecs: {} as Record<string, string>,
    endpointValues: {} as Record<string, unknown>,
  },
}));

vi.mock('../../../shared/utils/idbCatalog', () => ({
  idbLoadCatalogEntries: vi.fn(async () => catalogStore.entries),
  idbSaveCatalogEntries: vi.fn(async (entries: import('../types/catalog').CatalogEntry[]) => {
    catalogStore.entries = entries;
  }),
  idbMigrateCatalogEntries: vi.fn(async () => false),
  idbLoadCatalogRawSpec: vi.fn(async (entryId: string, versionId: string) =>
    catalogStore.rawSpecs[`${entryId}-${versionId}`] ?? null),
  idbSaveCatalogRawSpec: vi.fn(async (entryId: string, versionId: string, raw: string) => {
    catalogStore.rawSpecs[`${entryId}-${versionId}`] = raw;
  }),
  idbRemoveCatalogRawSpec: vi.fn(async (entryId: string, versionId: string) => {
    delete catalogStore.rawSpecs[`${entryId}-${versionId}`];
  }),
  idbRemoveAllCatalogRawSpecs: vi.fn(async (entryId: string, versionIds: string[]) => {
    for (const vid of versionIds) delete catalogStore.rawSpecs[`${entryId}-${vid}`];
  }),
  idbMigrateCatalogRawSpecs: vi.fn(async () => 0),
  idbLoadCatalogEndpointValues: vi.fn(async (entryId: string) =>
    (catalogStore.endpointValues[entryId] as Record<string, unknown> | undefined) ?? null),
  idbSaveCatalogEndpointValues: vi.fn(async (entryId: string, values: unknown) => {
    catalogStore.endpointValues[entryId] = values;
  }),
  idbRemoveCatalogEndpointValues: vi.fn(async (entryId: string) => {
    delete catalogStore.endpointValues[entryId];
  }),
  idbMigrateCatalogEndpointValues: vi.fn(async () => 0),
}));

vi.mock('../../../shared/utils/idbWorkflows', () => ({
  idbLoadWorkflows: vi.fn(async () => null),
  idbSaveWorkflows: vi.fn(async () => {}),
  idbMigrateWorkflows: vi.fn(async () => false),
  idbLoadWorkflowFolders: vi.fn(async () => null),
  idbSaveWorkflowFolders: vi.fn(async () => {}),
  idbMigrateWorkflowFolders: vi.fn(async () => false),
}));

vi.mock('../../../shared/utils/idbRequests', () => ({
  idbLoadRequests: vi.fn(async () => null),
  idbSaveRequests: vi.fn(async () => {}),
  idbMigrateRequests: vi.fn(async () => false),
}));

vi.mock('../../../shared/utils/idbProjects', () => ({
  idbLoadProjects: vi.fn(async () => null),
  idbSaveProjects: vi.fn(async () => {}),
  idbMigrateProjects: vi.fn(async () => false),
}));

import {
  loadCatalogEntries, saveCatalogEntries,
  loadCatalogRawSpec, saveCatalogRawSpec,
  removeCatalogRawSpec, removeAllCatalogRawSpecs,
} from '@shared/utils/storage';
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
    catalogStore.entries = null;
    catalogStore.rawSpecs = {};
    catalogStore.endpointValues = {};
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

    it('stores specs separately from catalog entries', async () => {
      await saveCatalogEntries([makeEntry('e1', 'API')]);
      await saveCatalogRawSpec('e1', 'v-e1', 'the-spec');

      const entriesJson = JSON.stringify(catalogStore.entries);
      expect(entriesJson).toBeTruthy();
      expect(entriesJson).not.toContain('the-spec');

      expect(catalogStore.rawSpecs['e1-v-e1']).toBe('the-spec');
    });
  });
});
