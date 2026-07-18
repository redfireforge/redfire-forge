/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoCatalogBridge } from './useDemoCatalogBridge';
import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import type { CatalogEntry } from '../../features/catalog/types/catalog';

vi.mock('../../features/catalog/utils/openApiParser', () => ({
  parseOpenApiSpec: vi.fn(),
}));
import { parseOpenApiSpec } from '../../features/catalog/utils/openApiParser';

const WIN = () => window as unknown as Record<string, unknown>;

function makeEntry(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    description: '',
    currentVersionId: `${id}-v1`,
    versions: [{ id: `${id}-v1`, version: '1.0.0', importedAt: 0, specSize: 10 }],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints: [],
  } as unknown as CatalogEntry;
}

function makeCatalog(overrides: Partial<UseCatalogReturn> = {}): UseCatalogReturn {
  return {
    entries: [],
    loaded: true,
    selectedEntry: null,
    selectedEntryId: undefined,
    selectedEndpointId: undefined,
    addEntry: vi.fn().mockResolvedValue(undefined),
    addVersionToEntry: vi.fn(),
    findByTitle: vi.fn(),
    switchVersion: vi.fn(),
    removeEntry: vi.fn().mockResolvedValue(undefined),
    updateEntry: vi.fn(),
    selectEntry: vi.fn(),
    selectEndpoint: vi.fn(),
    loadRawSpec: vi.fn(),
    removeVersion: vi.fn(),
    ...overrides,
  } as unknown as UseCatalogReturn;
}

describe('useDemoCatalogBridge', () => {
  beforeEach(() => {
    delete WIN().__demoSeedCatalogSwagger2;
    delete WIN().__demoDeleteCatalogByName;
    delete WIN().__demoSelectCatalogByName;
    delete WIN().__demoCatalogLoaded;
    vi.mocked(parseOpenApiSpec).mockReset();
  });

  it('does not mount any bridge when disabled', () => {
    renderHook(() => useDemoCatalogBridge(makeCatalog(), false));
    expect(WIN().__demoSeedCatalogSwagger2).toBeUndefined();
    expect(WIN().__demoCatalogLoaded).toBeUndefined();
  });

  it('mounts and unmounts the bridge functions + loaded flag when enabled', () => {
    const { unmount } = renderHook(() => useDemoCatalogBridge(makeCatalog(), true));
    expect(WIN().__demoSeedCatalogSwagger2).toBeTypeOf('function');
    expect(WIN().__demoDeleteCatalogByName).toBeTypeOf('function');
    expect(WIN().__demoSelectCatalogByName).toBeTypeOf('function');
    expect(WIN().__demoCatalogLoaded).toBe(true);

    unmount();
    expect(WIN().__demoSeedCatalogSwagger2).toBeUndefined();
    expect(WIN().__demoDeleteCatalogByName).toBeUndefined();
    expect(WIN().__demoSelectCatalogByName).toBeUndefined();
    expect(WIN().__demoCatalogLoaded).toBeUndefined();
  });

  it('seeds a new entry via parseOpenApiSpec + addEntry, overriding the name', async () => {
    const addEntry = vi.fn().mockResolvedValue(undefined);
    vi.mocked(parseOpenApiSpec).mockResolvedValue({
      entry: makeEntry('e-new', 'Original Title'),
      rawSpec: 'RAW',
    } as unknown as Awaited<ReturnType<typeof parseOpenApiSpec>>);
    renderHook(() => useDemoCatalogBridge(makeCatalog({ addEntry }), true));

    const seed = WIN().__demoSeedCatalogSwagger2 as (n: string, r: string) => Promise<string | null>;
    const id = await seed('Demo API', 'swagger: "2.0"');

    expect(id).toBe('e-new');
    expect(addEntry).toHaveBeenCalledTimes(1);
    const [entryArg, rawArg] = addEntry.mock.calls[0];
    expect(entryArg.name).toBe('Demo API');
    expect(rawArg).toBe('RAW');
  });

  it('seed is idempotent by name — selects the existing entry without re-adding', async () => {
    const addEntry = vi.fn();
    const selectEntry = vi.fn();
    const existing = makeEntry('e1', 'Demo API');
    renderHook(() => useDemoCatalogBridge(makeCatalog({ entries: [existing], addEntry, selectEntry }), true));

    const seed = WIN().__demoSeedCatalogSwagger2 as (n: string, r: string) => Promise<string | null>;
    const id = await seed('demo api', 'ignored'); // case-insensitive match

    expect(id).toBe('e1');
    expect(selectEntry).toHaveBeenCalledWith('e1');
    expect(addEntry).not.toHaveBeenCalled();
    expect(parseOpenApiSpec).not.toHaveBeenCalled();
  });

  it('seed returns null when parsing throws', async () => {
    vi.mocked(parseOpenApiSpec).mockRejectedValue(new Error('bad spec'));
    renderHook(() => useDemoCatalogBridge(makeCatalog(), true));

    const seed = WIN().__demoSeedCatalogSwagger2 as (n: string, r: string) => Promise<string | null>;
    expect(await seed('Demo API', 'garbage')).toBeNull();
  });

  it('deletes an entry by name (case-insensitive)', () => {
    const removeEntry = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useDemoCatalogBridge(makeCatalog({ entries: [makeEntry('e1', 'Demo API')], removeEntry }), true));

    (WIN().__demoDeleteCatalogByName as (n: string) => void)('DEMO API');
    expect(removeEntry).toHaveBeenCalledWith('e1');
  });

  it('delete is a no-op when the entry is absent', () => {
    const removeEntry = vi.fn();
    renderHook(() => useDemoCatalogBridge(makeCatalog({ removeEntry }), true));
    (WIN().__demoDeleteCatalogByName as (n: string) => void)('Nope');
    expect(removeEntry).not.toHaveBeenCalled();
  });

  it('selects an entry by name and returns true / false', () => {
    const selectEntry = vi.fn();
    renderHook(() => useDemoCatalogBridge(makeCatalog({ entries: [makeEntry('e1', 'Demo API')], selectEntry }), true));

    const select = WIN().__demoSelectCatalogByName as (n: string) => boolean;
    expect(select('Demo API')).toBe(true);
    expect(selectEntry).toHaveBeenCalledWith('e1');
    expect(select('Missing')).toBe(false);
  });

  it('reflects the latest loaded flag', () => {
    const { rerender } = renderHook(
      ({ cat }) => useDemoCatalogBridge(cat, true),
      { initialProps: { cat: makeCatalog({ loaded: false }) } },
    );
    expect(WIN().__demoCatalogLoaded).toBe(false);
    rerender({ cat: makeCatalog({ loaded: true }) });
    expect(WIN().__demoCatalogLoaded).toBe(true);
  });
});
