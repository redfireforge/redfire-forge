/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import { useDemoCatalogBridge } from './useDemoCatalogBridge';

vi.mock('../../shared/utils/workflowPreviewStorage');
vi.mock('../../features/catalog/utils/openApiParser');

describe('useDemoCatalogBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const keys = [
      '__demoSeedCatalogSwagger2',
      '__demoDeleteCatalogByName',
      '__demoSelectCatalogByName',
      '__demoAddVersionByName',
      '__demoClearAllWorkflowPreviews',
      '__demoGetCatalogEntryByName',
      '__demoCatalogLoaded',
    ];
    keys.forEach(key => {
      delete (window as unknown as Record<string, unknown>)[key];
    });
  });

  function createMockCatalog(loaded = true): UseCatalogReturn {
    return {
      entries: [],
      loaded,
      selectEntry: vi.fn(),
      addEntry: vi.fn().mockResolvedValue(undefined),
      removeEntry: vi.fn().mockResolvedValue(undefined),
      addVersionToEntry: vi.fn().mockResolvedValue(undefined),
    } as UseCatalogReturn;
  }

  it('registers all bridge functions when enabled', () => {
    const catalog = createMockCatalog();
    renderHook(() => useDemoCatalogBridge(catalog, true));

    const w = window as unknown as Record<string, unknown>;
    expect(typeof w.__demoSeedCatalogSwagger2).toBe('function');
    expect(typeof w.__demoDeleteCatalogByName).toBe('function');
    expect(typeof w.__demoSelectCatalogByName).toBe('function');
    expect(typeof w.__demoAddVersionByName).toBe('function');
    expect(typeof w.__demoClearAllWorkflowPreviews).toBe('function');
    expect(typeof w.__demoGetCatalogEntryByName).toBe('function');
  });

  it('does not register bridge functions when disabled', () => {
    const catalog = createMockCatalog();
    renderHook(() => useDemoCatalogBridge(catalog, false));

    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoSeedCatalogSwagger2).toBeUndefined();
    expect(w.__demoSelectCatalogByName).toBeUndefined();
  });

  it('unregisters all functions on unmount', () => {
    const catalog = createMockCatalog();
    const { unmount } = renderHook(() => useDemoCatalogBridge(catalog, true));

    unmount();

    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoSeedCatalogSwagger2).toBeUndefined();
    expect(w.__demoDeleteCatalogByName).toBeUndefined();
  });

  it('publishes __demoCatalogLoaded flag', () => {
    const catalog = createMockCatalog(true);
    renderHook(() => useDemoCatalogBridge(catalog, true));

    expect((window as unknown as Record<string, unknown>).__demoCatalogLoaded).toBe(true);
  });

  it('updates __demoCatalogLoaded when catalog.loaded changes', () => {
    let catalog = createMockCatalog(false);
    const { rerender } = renderHook(
      ({ cat }) => useDemoCatalogBridge(cat, true),
      { initialProps: { cat: catalog } },
    );

    expect((window as unknown as Record<string, unknown>).__demoCatalogLoaded).toBe(false);

    catalog = createMockCatalog(true);
    rerender({ cat: catalog });

    expect((window as unknown as Record<string, unknown>).__demoCatalogLoaded).toBe(true);
  });

  it('getEntryByName finds entry case-insensitively', async () => {
    const catalog = createMockCatalog();
    catalog.entries = [
      { id: 'entry-1', name: 'MyAPI' },
    ] as UseCatalogReturn['entries'];

    renderHook(() => useDemoCatalogBridge(catalog, true));

    const bridge = (window as unknown as Record<string, unknown>).__demoGetCatalogEntryByName;

    expect(bridge).toBeInstanceOf(Function);
    if (typeof bridge === 'function') {
      expect(bridge('myapi')).toEqual({ id: 'entry-1', name: 'MyAPI' });
      expect(bridge('MYAPI')).toEqual({ id: 'entry-1', name: 'MyAPI' });
    }
  });

  it('getEntryByName returns null for non-existent entry', async () => {
    const catalog = createMockCatalog();
    catalog.entries = [{ id: 'entry-1', name: 'MyAPI' }] as UseCatalogReturn['entries'];

    renderHook(() => useDemoCatalogBridge(catalog, true));

    const bridge = (window as unknown as Record<string, unknown>).__demoGetCatalogEntryByName;

    if (typeof bridge === 'function') {
      expect(bridge('NonExistent')).toBeNull();
    }
  });

  it('deleteByName removes entry by case-insensitive name', async () => {
    const removeEntry = vi.fn();
    const catalog = createMockCatalog();
    catalog.entries = [{ id: 'entry-1', name: 'MyAPI' }] as UseCatalogReturn['entries'];
    catalog.removeEntry = removeEntry;

    renderHook(() => useDemoCatalogBridge(catalog, true));

    const bridge = (window as unknown as Record<string, unknown>).__demoDeleteCatalogByName;

    if (typeof bridge === 'function') {
      bridge('myapi');
    }
    expect(removeEntry).toHaveBeenCalledWith('entry-1');
  });

  it('selectByName returns false when entry not found', () => {
    const catalog = createMockCatalog();
    catalog.entries = [{ id: 'entry-1', name: 'MyAPI' }] as UseCatalogReturn['entries'];

    renderHook(() => useDemoCatalogBridge(catalog, true));

    const bridge = (window as unknown as Record<string, unknown>).__demoSelectCatalogByName;

    if (typeof bridge === 'function') {
      expect(bridge('NonExistent')).toBe(false);
    }
  });

  it('selectByName returns true and selects when entry found', () => {
    const selectEntry = vi.fn();
    const catalog = createMockCatalog();
    catalog.entries = [{ id: 'entry-1', name: 'MyAPI' }] as UseCatalogReturn['entries'];
    catalog.selectEntry = selectEntry;

    renderHook(() => useDemoCatalogBridge(catalog, true));

    const bridge = (window as unknown as Record<string, unknown>).__demoSelectCatalogByName;

    if (typeof bridge === 'function') {
      expect(bridge('myapi')).toBe(true);
    }
    expect(selectEntry).toHaveBeenCalledWith('entry-1');
  });

  it('clearAllWorkflowPreviews is exposed from storage module', () => {
    const catalog = createMockCatalog();
    renderHook(() => useDemoCatalogBridge(catalog, true));

    expect(typeof (window as unknown as Record<string, unknown>).__demoClearAllWorkflowPreviews).toBe('function');
  });

  it('switches from disabled to enabled', () => {
    const catalog = createMockCatalog();
    const { rerender } = renderHook(
      ({ enabled }) => useDemoCatalogBridge(catalog, enabled),
      { initialProps: { enabled: false } },
    );

    expect((window as unknown as Record<string, unknown>).__demoSeedCatalogSwagger2).toBeUndefined();

    rerender({ enabled: true });

    expect(typeof (window as unknown as Record<string, unknown>).__demoSeedCatalogSwagger2).toBe('function');
  });
});
