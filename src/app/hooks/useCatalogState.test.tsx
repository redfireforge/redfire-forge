/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import type { CatalogEntry } from '../../features/catalog/types/catalog';
import { useCatalogState } from './useCatalogState';

vi.mock('../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn().mockResolvedValue(undefined),
}));

import { saveFile } from '../../shared/utils/fileSaver';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeCatalog(entry?: CatalogEntry): UseCatalogReturn {
  const e = entry ?? {
    id: 'e1',
    name: 'My Service / Prod',
    currentVersionId: 'vcur',
    microserviceId: 'ms',
    servers: [{ url: 'https://api.example.com' }],
    serversByVersion: {},
    versions: [{ id: 'vcur', version: '1.2.3', importedAt: 0 }],
  };
  return {
    entries: [e],
    selectedEntry: e,
    setSelectedEntryId: vi.fn(),
    loading: false,
    error: null,
    reload: vi.fn(),
    addEntry: vi.fn(),
    addVersionToEntry: vi.fn(),
    updateEntry: vi.fn(),
    removeEntry: vi.fn(),
    switchVersion: vi.fn(),
    loadRawSpec: vi.fn(),
  } as unknown as UseCatalogReturn;
}

describe('useCatalogState', () => {
  it('starts with falsy modal and editor flags', () => {
    const { result } = renderHook(() => useCatalogState(makeCatalog()));

    expect(result.current.showCatalogImport).toBe(false);
    expect(result.current.catalogReimportId).toBeUndefined();
    expect(result.current.catalogInitialSpec).toBeUndefined();
    expect(result.current.catalogVersionHistoryId).toBeUndefined();
    expect(result.current.catalogEditId).toBeUndefined();
  });

  it('calls loadRawSpec and saveFile with sanitized filename when exporting', async () => {
    const loadRawSpec = vi.fn().mockResolvedValue('openapi: 3.0\n');
    const catalog = makeCatalog();
    catalog.loadRawSpec = loadRawSpec;

    const { result } = renderHook(() => useCatalogState(catalog));

    await act(async () => {
      await result.current.handleExportSpec('e1');
    });

    expect(loadRawSpec).toHaveBeenCalledWith('e1', 'vcur');
    expect(saveFile).toHaveBeenCalledTimes(1);
    const [, opts] = vi.mocked(saveFile).mock.calls[0];
    expect(opts.filename).toBe('My_Service___Prod-v1.2.3.yaml');
    expect(opts.mimeType).toBe('text/yaml');
  });

  it('does nothing on export when entry is missing', async () => {
    const catalog = makeCatalog();
    catalog.entries = [];
    const loadRawSpec = vi.fn();
    catalog.loadRawSpec = loadRawSpec;

    const { result } = renderHook(() => useCatalogState(catalog));

    await act(async () => {
      await result.current.handleExportSpec('missing');
    });

    expect(loadRawSpec).not.toHaveBeenCalled();
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('does not save when loadRawSpec returns empty', async () => {
    const catalog = makeCatalog();
    catalog.loadRawSpec = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(() => useCatalogState(catalog));

    await act(async () => {
      await result.current.handleExportSpec('e1');
    });

    expect(saveFile).not.toHaveBeenCalled();
  });

  it('uses unknown in filename when versions array is empty', async () => {
    const catalog = makeCatalog();
    const entry = catalog.entries[0] as CatalogEntry;
    entry.versions = [];
    catalog.loadRawSpec = vi.fn().mockResolvedValue('x');

    const { result } = renderHook(() => useCatalogState(catalog));

    await act(async () => {
      await result.current.handleExportSpec('e1');
    });

    expect(vi.mocked(saveFile).mock.calls[0]?.[1]?.filename).toMatch(/unknown\.yaml$/);
  });
});
