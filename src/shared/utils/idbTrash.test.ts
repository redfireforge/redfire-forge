/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeTrashItem } from '@test-utils/factories';

import 'fake-indexeddb/auto';

let mockGetResult: unknown = undefined;
let mockGetShouldError = false;
let mockPutShouldError = false;
const mockPutCalls: Array<{ data: unknown; key: string }> = [];

vi.mock('./idbOpen', () => {
  const createRequest = <T>(result: T, shouldError: boolean): IDBRequest<T> => {
    return {
      result,
      error: shouldError ? new Error('IDB Error') : null,
      get onsuccess() { return null; },
      set onsuccess(fn: ((ev: Event) => void) | null) {
        if (fn && !shouldError) Promise.resolve().then(() => fn(new Event('success')));
      },
      get onerror() { return null; },
      set onerror(fn: ((ev: Event) => void) | null) {
        if (fn && shouldError) Promise.resolve().then(() => fn(new Event('error')));
      },
    } as unknown as IDBRequest<T>;
  };

  const mockObjectStore = {
    get: () => createRequest(mockGetResult, mockGetShouldError),
    put: (data: unknown, key: string) => {
      mockPutCalls.push({ data, key });
      return createRequest(undefined, mockPutShouldError);
    },
  };
  return {
    openDB: vi.fn().mockResolvedValue({
      transaction: () => ({ objectStore: () => mockObjectStore }),
    }),
  };
});

import { idbLoadTrash, idbSaveTrash } from './idbTrash';


describe('idbTrash', () => {
  beforeEach(() => {
    resetAllMocks();
    mockGetResult = undefined;
    mockGetShouldError = false;
    mockPutShouldError = false;
    mockPutCalls.length = 0;
  });

  describe('idbLoadTrash', () => {
    it('returns data from IndexedDB', async () => {
      const data = [makeTrashItem()];
      mockGetResult = data;
      expect(await idbLoadTrash()).toEqual(data);
    });

    it('returns null when no data', async () => {
      mockGetResult = undefined;
      expect(await idbLoadTrash()).toBeNull();
    });

    it('returns null on error', async () => {
      mockGetShouldError = true;
      expect(await idbLoadTrash()).toBeNull();
    });

    it('returns null when openDB rejects', async () => {
      const mod = await import('./idbOpen');
      vi.mocked(mod.openDB).mockRejectedValueOnce(new Error('open failed'));
      expect(await idbLoadTrash()).toBeNull();
    });
  });

  describe('idbSaveTrash', () => {
    it('saves trash items', async () => {
      const items = [makeTrashItem()];
      await idbSaveTrash(items);
      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toEqual({ data: items, key: 'all' });
    });

    it('throws on put error', async () => {
      mockPutShouldError = true;
      await expect(idbSaveTrash([makeTrashItem()])).rejects.toThrow();
    });

    it('throws when openDB rejects', async () => {
      const mod = await import('./idbOpen');
      vi.mocked(mod.openDB).mockRejectedValueOnce(new Error('open failed'));
      await expect(idbSaveTrash([makeTrashItem()])).rejects.toThrow('open failed');
    });
  });

  describe('idbAvailable fallback', () => {
    it('idbLoadTrash returns null when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbLoadTrash()).toBeNull();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });

    it('idbSaveTrash throws when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        await expect(idbSaveTrash([makeTrashItem()])).rejects.toThrow('IndexedDB not available');
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });
});
