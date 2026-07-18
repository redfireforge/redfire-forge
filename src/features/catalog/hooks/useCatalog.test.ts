/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { CatalogEntry } from '../types/catalog';

const storage = {
  loadCatalogEntries: vi.fn(),
  saveCatalogEntries: vi.fn(),
  saveCatalogRawSpec: vi.fn(),
  removeCatalogRawSpec: vi.fn(),
  removeAllCatalogRawSpecs: vi.fn(),
  loadCatalogRawSpec: vi.fn(),
  removeCatalogEndpointValues: vi.fn(),
};
const catalogSelectionStorage = {
  loadCatalogSelectedEntryId: vi.fn(),
  saveCatalogSelectedEntryId: vi.fn(),
  removeCatalogSelectedEntryId: vi.fn(),
};
const mockParse = vi.fn();

vi.mock('../../../shared/utils/storage', () => ({
  loadCatalogEntries: () => storage.loadCatalogEntries(),
  saveCatalogEntries: (e: unknown) => storage.saveCatalogEntries(e),
  saveCatalogRawSpec: (...a: unknown[]) => storage.saveCatalogRawSpec(...a),
  removeCatalogRawSpec: (...a: unknown[]) => storage.removeCatalogRawSpec(...a),
  removeAllCatalogRawSpecs: (...a: unknown[]) => storage.removeAllCatalogRawSpecs(...a),
  loadCatalogRawSpec: (...a: unknown[]) => storage.loadCatalogRawSpec(...a),
  removeCatalogEndpointValues: (...a: unknown[]) => storage.removeCatalogEndpointValues(...a),
}));
vi.mock('../../../shared/utils/storageCatalog', () => ({
  loadCatalogSelectedEntryId: () => catalogSelectionStorage.loadCatalogSelectedEntryId(),
  saveCatalogSelectedEntryId: (...a: unknown[]) => catalogSelectionStorage.saveCatalogSelectedEntryId(...a),
  removeCatalogSelectedEntryId: () => catalogSelectionStorage.removeCatalogSelectedEntryId(),
}));
vi.mock('../utils/openApiParser', () => ({
  parseOpenApiSpec: (raw: string) => mockParse(raw),
}));

import { useCatalog } from './useCatalog';

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'e1', name: 'API', currentVersionId: 'v1',
    versions: [{ id: 'v1', version: '1.0', importedAt: 1, specHash: 'h', specSize: 1 }],
    servers: [], securitySchemes: {}, folders: [], endpoints: [],
    hostConfig: {} as CatalogEntry['hostConfig'],
    authConfig: {} as CatalogEntry['authConfig'],
    ...overrides,
  };
}

function makeParsed(versionId: string) {
  return {
    rawSpec: 'raw',
    entry: {
      description: 'desc', servers: [], securitySchemes: {}, folders: [], endpoints: [],
      versions: [{ id: versionId, version: '2.0', importedAt: 2, specHash: 'h2', specSize: 2 }],
    },
  };
}

beforeEach(() => {
  Object.values(storage).forEach((m) => m.mockReset());
  Object.values(catalogSelectionStorage).forEach((m) => m.mockReset());
  mockParse.mockReset();
  storage.loadCatalogEntries.mockResolvedValue([]);
  catalogSelectionStorage.loadCatalogSelectedEntryId.mockResolvedValue(null);
  storage.saveCatalogRawSpec.mockResolvedValue(undefined);
  storage.removeCatalogRawSpec.mockResolvedValue(undefined);
  storage.removeAllCatalogRawSpecs.mockResolvedValue(undefined);
  storage.removeCatalogEndpointValues.mockResolvedValue(undefined);
  catalogSelectionStorage.saveCatalogSelectedEntryId.mockResolvedValue(undefined);
  catalogSelectionStorage.removeCatalogSelectedEntryId.mockResolvedValue(undefined);
});

async function setup(initial: CatalogEntry[] = []) {
  storage.loadCatalogEntries.mockResolvedValue(initial);
  const hook = renderHook(() => useCatalog());
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return hook;
}

describe('useCatalog', () => {
  it('loads entries and auto-selects when exactly one entry', async () => {
    const { result } = await setup([makeEntry()]);
    expect(result.current.selectedEntryId).toBe('e1');
    expect(result.current.selectedEntry?.name).toBe('API');
  });

  it('does not auto-select when there are multiple entries', async () => {
    const { result } = await setup([makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]);
    expect(result.current.selectedEntryId).toBeUndefined();
  });

  it('restores the persisted selected entry when it still exists', async () => {
    catalogSelectionStorage.loadCatalogSelectedEntryId.mockResolvedValueOnce('b');
    const { result } = await setup([makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]);
    expect(result.current.selectedEntryId).toBe('b');
    expect(result.current.selectedEntry?.id).toBe('b');
  });

  it('persists entries after load', async () => {
    const { result } = await setup();
    await act(async () => { await result.current.addEntry(makeEntry(), 'raw'); });
    expect(storage.saveCatalogEntries).toHaveBeenCalled();
    expect(storage.saveCatalogRawSpec).toHaveBeenCalledWith('e1', 'v1', 'raw');
  });

  it('finds an entry by title (case-insensitive)', async () => {
    const { result } = await setup([makeEntry({ name: 'My Api' })]);
    expect(result.current.findByTitle('my api')?.id).toBe('e1');
    expect(result.current.findByTitle('nope')).toBeUndefined();
  });

  it('adds a new version, prunes beyond MAX_VERSIONS', async () => {
    const versions = Array.from({ length: 10 }, (_, i) => ({
      id: `v${i}`, version: `${i}`, importedAt: i, specHash: 'h', specSize: 1,
    }));
    const { result } = await setup([makeEntry({ versions })]);
    await act(async () => {
      await result.current.addVersionToEntry('e1', makeParsed('vNew'));
    });
    expect(result.current.selectedEntry?.currentVersionId).toBe('vNew');
    expect(result.current.selectedEntry?.versions).toHaveLength(10);
    expect(storage.removeCatalogRawSpec).toHaveBeenCalled();
  });

  it('addVersionToEntry is a no-op when parsed has no version', async () => {
    const { result } = await setup([makeEntry()]);
    await act(async () => {
      await result.current.addVersionToEntry('e1', { rawSpec: 'r', entry: { versions: [] } } as never);
    });
    expect(result.current.selectedEntry?.currentVersionId).toBe('v1');
  });

  it('addVersionToEntry skips prune when entry id is unknown', async () => {
    const { result } = await setup([makeEntry()]);
    await act(async () => {
      await result.current.addVersionToEntry('unknown', makeParsed('vNew'));
    });
    expect(storage.removeCatalogRawSpec).not.toHaveBeenCalled();
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].currentVersionId).toBe('v1');
  });

  it('addVersionToEntry leaves other entries unchanged', async () => {
    const { result } = await setup([
      makeEntry({ id: 'e1', name: 'API A' }),
      makeEntry({ id: 'e2', name: 'API B', currentVersionId: 'v1' }),
    ]);
    await act(async () => {
      await result.current.addVersionToEntry('e1', makeParsed('vNew'));
    });
    const untouched = result.current.entries.find((e) => e.id === 'e2');
    expect(untouched?.currentVersionId).toBe('v1');
    expect(untouched?.versions).toHaveLength(1);
  });

  it('switches version by reparsing the raw spec', async () => {
    const entry = makeEntry({
      versions: [
        { id: 'v1', version: '1', importedAt: 1, specHash: 'h', specSize: 1 },
        { id: 'v2', version: '2', importedAt: 2, specHash: 'h', specSize: 1 },
      ],
    });
    const { result } = await setup([entry]);
    storage.loadCatalogRawSpec.mockResolvedValue('raw-v2');
    mockParse.mockResolvedValue(makeParsed('v2'));
    await act(async () => { await result.current.switchVersion('e1', 'v2'); });
    expect(result.current.selectedEntry?.currentVersionId).toBe('v2');
  });

  it('switchVersion bails on unknown entry/version or missing raw spec', async () => {
    const { result } = await setup([makeEntry()]);
    await act(async () => { await result.current.switchVersion('nope', 'v1'); });
    await act(async () => { await result.current.switchVersion('e1', 'nope'); });
    storage.loadCatalogRawSpec.mockResolvedValue(null);
    await act(async () => { await result.current.switchVersion('e1', 'v1'); });
    expect(result.current.selectedEntry?.currentVersionId).toBe('v1');
  });

  it('switchVersion swallows a parse error', async () => {
    const { result } = await setup([makeEntry()]);
    storage.loadCatalogRawSpec.mockResolvedValue('raw');
    mockParse.mockRejectedValue(new Error('bad spec'));
    await act(async () => { await result.current.switchVersion('e1', 'v1'); });
    expect(result.current.selectedEntry?.currentVersionId).toBe('v1');
  });

  it('switchVersion leaves other entries unchanged', async () => {
    const entry1 = makeEntry({
      id: 'e1',
      versions: [
        { id: 'v1', version: '1', importedAt: 1, specHash: 'h', specSize: 1 },
        { id: 'v2', version: '2', importedAt: 2, specHash: 'h', specSize: 1 },
      ],
    });
    const entry2 = makeEntry({ id: 'e2', name: 'Other API' });
    const { result } = await setup([entry1, entry2]);
    storage.loadCatalogRawSpec.mockResolvedValue('raw-v2');
    mockParse.mockResolvedValue(makeParsed('v2'));
    await act(async () => { await result.current.switchVersion('e1', 'v2'); });
    const untouched = result.current.entries.find((e) => e.id === 'e2');
    expect(untouched?.currentVersionId).toBe('v1');
    expect(result.current.entries.find((e) => e.id === 'e1')?.currentVersionId).toBe('v2');
  });

  it('removes an entry and clears selection', async () => {
    const { result } = await setup([makeEntry()]);
    await act(async () => { await result.current.removeEntry('e1'); });
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.selectedEntryId).toBeUndefined();
    expect(storage.removeAllCatalogRawSpecs).toHaveBeenCalled();
    expect(storage.removeCatalogEndpointValues).toHaveBeenCalledWith('e1');
  });

  it('removes a non-selected entry without clearing selection', async () => {
    const { result } = await setup([
      makeEntry({ id: 'e1', name: 'Keep' }),
      makeEntry({ id: 'e2', name: 'Remove' }),
    ]);
    act(() => result.current.selectEntry('e1'));
    await act(async () => { await result.current.removeEntry('e2'); });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.selectedEntryId).toBe('e1');
    expect(storage.removeAllCatalogRawSpecs).toHaveBeenCalledWith('e2', ['v1']);
  });

  it('updates an entry', async () => {
    const { result } = await setup([makeEntry()]);
    act(() => result.current.updateEntry('e1', { name: 'Renamed' }));
    expect(result.current.selectedEntry?.name).toBe('Renamed');
  });

  it('updateEntry leaves other entries unchanged', async () => {
    const { result } = await setup([
      makeEntry({ id: 'e1', name: 'API A' }),
      makeEntry({ id: 'e2', name: 'API B' }),
    ]);
    act(() => result.current.updateEntry('e1', { name: 'Renamed A' }));
    expect(result.current.entries.find((e) => e.id === 'e2')?.name).toBe('API B');
  });

  it('removeEntry for unknown id skips storage cleanup', async () => {
    const { result } = await setup([makeEntry()]);
    await act(async () => { await result.current.removeEntry('unknown'); });
    expect(result.current.entries).toHaveLength(1);
    expect(storage.removeAllCatalogRawSpecs).not.toHaveBeenCalled();
  });

  it('selects entry and endpoint', async () => {
    const { result } = await setup([makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]);
    act(() => result.current.selectEntry('b'));
    expect(result.current.selectedEntryId).toBe('b');
    await waitFor(() => expect(catalogSelectionStorage.saveCatalogSelectedEntryId).toHaveBeenCalledWith('b'));
    act(() => result.current.selectEndpoint('ep1'));
    expect(result.current.selectedEndpointId).toBe('ep1');
  });

  it('clears the persisted selection when the selected entry is removed', async () => {
    const { result } = await setup([makeEntry()]);
    await act(async () => { await result.current.removeEntry('e1'); });
    await waitFor(() => expect(catalogSelectionStorage.removeCatalogSelectedEntryId).toHaveBeenCalled());
  });

  it('delegates loadRawSpec to storage', async () => {
    const { result } = await setup([makeEntry()]);
    storage.loadCatalogRawSpec.mockResolvedValue('the-raw');
    let raw: string | null = null;
    await act(async () => { raw = await result.current.loadRawSpec('e1', 'v1'); });
    expect(raw).toBe('the-raw');
  });

  it('removes a version and resets currentVersionId when removing the current one', async () => {
    const entry = makeEntry({
      currentVersionId: 'v2',
      versions: [
        { id: 'v1', version: '1', importedAt: 1, specHash: 'h', specSize: 1 },
        { id: 'v2', version: '2', importedAt: 2, specHash: 'h', specSize: 1 },
      ],
    });
    const { result } = await setup([entry]);
    await act(async () => { await result.current.removeVersion('e1', 'v2'); });
    expect(result.current.selectedEntry?.versions).toHaveLength(1);
    expect(result.current.selectedEntry?.currentVersionId).toBe('v1');
  });

  it('removes a non-current version without changing currentVersionId', async () => {
    const entry = makeEntry({
      currentVersionId: 'v2',
      versions: [
        { id: 'v1', version: '1', importedAt: 1, specHash: 'h', specSize: 1 },
        { id: 'v2', version: '2', importedAt: 2, specHash: 'h', specSize: 1 },
      ],
    });
    const { result } = await setup([entry]);
    await act(async () => { await result.current.removeVersion('e1', 'v1'); });
    expect(result.current.selectedEntry?.versions).toHaveLength(1);
    expect(result.current.selectedEntry?.currentVersionId).toBe('v2');
  });

  it('removeVersion of the last remaining version resets currentVersionId to empty string', async () => {
    // newVersions = [] → newVersions[0]?.id = undefined → ?? '' fallback
    const entry = makeEntry({
      currentVersionId: 'v1',
      versions: [{ id: 'v1', version: '1', importedAt: 1, specHash: 'h', specSize: 1 }],
    });
    const { result } = await setup([entry]);
    await act(async () => { await result.current.removeVersion('e1', 'v1'); });
    expect(result.current.entries[0]?.versions).toHaveLength(0);
    expect(result.current.entries[0]?.currentVersionId).toBe('');
  });

  it('addVersionToEntry prunes old raw specs when versions exceed MAX (10)', async () => {
    const existingVersions = Array.from({ length: 10 }, (_, i) => ({
      id: `v${i + 1}`, version: `${i + 1}.0`, importedAt: i, specHash: 'h', specSize: 1,
    }));
    const entry = makeEntry({ currentVersionId: 'v10', versions: existingVersions });
    const { result } = await setup([entry]);
    const parsed = makeParsed('vNew');
    storage.saveCatalogRawSpec.mockResolvedValue(undefined);
    storage.removeCatalogRawSpec.mockResolvedValue(undefined);
    await act(async () => { await result.current.addVersionToEntry('e1', parsed); });
    // allVersions = [vNew, v1, v2 ... v10] → 11 total → toPrune = [v10]
    expect(storage.removeCatalogRawSpec).toHaveBeenCalledWith('e1', 'v10');
  });
});
