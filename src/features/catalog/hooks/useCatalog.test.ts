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
  mockParse.mockReset();
  storage.loadCatalogEntries.mockResolvedValue([]);
  storage.saveCatalogRawSpec.mockResolvedValue(undefined);
  storage.removeCatalogRawSpec.mockResolvedValue(undefined);
  storage.removeAllCatalogRawSpecs.mockResolvedValue(undefined);
  storage.removeCatalogEndpointValues.mockResolvedValue(undefined);
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

  it('removes an entry and clears selection', async () => {
    const { result } = await setup([makeEntry()]);
    await act(async () => { await result.current.removeEntry('e1'); });
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.selectedEntryId).toBeUndefined();
    expect(storage.removeAllCatalogRawSpecs).toHaveBeenCalled();
    expect(storage.removeCatalogEndpointValues).toHaveBeenCalledWith('e1');
  });

  it('updates an entry', async () => {
    const { result } = await setup([makeEntry()]);
    act(() => result.current.updateEntry('e1', { name: 'Renamed' }));
    expect(result.current.selectedEntry?.name).toBe('Renamed');
  });

  it('selects entry and endpoint', async () => {
    const { result } = await setup([makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]);
    act(() => result.current.selectEntry('b'));
    expect(result.current.selectedEntryId).toBe('b');
    act(() => result.current.selectEndpoint('ep1'));
    expect(result.current.selectedEndpointId).toBe('ep1');
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
});
