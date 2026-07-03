/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestsData } from '../types';

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
  const mockTransaction = {
    objectStore: () => mockObjectStore,
  };
  const mockDB = {
    transaction: () => mockTransaction,
  };
  return {
    openDB: vi.fn().mockResolvedValue(mockDB),
  };
});

import {
  idbLoadRequests,
  idbSaveRequests,
  idbMigrateRequests,
} from './idbRequests';

function createMockRequestsData(): RequestsData {
  return {
    environments: [{ id: 'env-1', name: 'Local', baseUrl: 'http://localhost' }],
    collections: [{ id: 'col-1', name: 'My Collection', requests: [] }],
  };
}

describe('idbRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetResult = undefined;
    mockGetShouldError = false;
    mockPutShouldError = false;
    mockPutCalls.length = 0;
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('idbLoadRequests', () => {
    it('returns data from IndexedDB when available', async () => {
      const mockData = createMockRequestsData();
      mockGetResult = mockData;

      const result = await idbLoadRequests();

      expect(result).toEqual(mockData);
    });

    it('returns null when no data exists', async () => {
      mockGetResult = undefined;

      expect(await idbLoadRequests()).toBeNull();
    });

    it('returns null on IDB error', async () => {
      mockGetShouldError = true;

      expect(await idbLoadRequests()).toBeNull();
    });

    it('returns null when openDB rejects', async () => {
      const mod = await import('./idbOpen');
      vi.mocked(mod.openDB).mockRejectedValueOnce(new Error('open failed'));

      expect(await idbLoadRequests()).toBeNull();
    });

    it('returns null when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbLoadRequests()).toBeNull();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbSaveRequests', () => {
    it('saves requests data to IndexedDB', async () => {
      const data = createMockRequestsData();

      await idbSaveRequests(data);

      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toEqual({ data, key: 'all' });
    });

    it('throws when put fails', async () => {
      mockPutShouldError = true;

      await expect(idbSaveRequests(createMockRequestsData())).rejects.toThrow();
    });

    it('throws when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        await expect(idbSaveRequests(createMockRequestsData())).rejects.toThrow('IndexedDB not available');
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbMigrateRequests', () => {
    it('migrates data from localStorage to IndexedDB', async () => {
      const data = createMockRequestsData();
      localStorage.setItem('rf-requests', JSON.stringify(data));

      const result = await idbMigrateRequests('rf-requests');

      expect(result).toBe(true);
      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0].key).toBe('all');
      expect(localStorage.getItem('rf-requests')).toBeNull();
    });

    it('returns false when localStorage key does not exist', async () => {
      expect(await idbMigrateRequests('non-existent-key')).toBe(false);
      expect(mockPutCalls).toHaveLength(0);
    });

    it('returns false when localStorage contains invalid JSON', async () => {
      localStorage.setItem('rf-requests', 'not-json');

      expect(await idbMigrateRequests('rf-requests')).toBe(false);
    });

    it('returns false when localStorage contains null', async () => {
      localStorage.setItem('rf-requests', 'null');

      expect(await idbMigrateRequests('rf-requests')).toBe(false);
    });

    it('returns false when localStorage contains non-object', async () => {
      localStorage.setItem('rf-requests', '"string"');

      expect(await idbMigrateRequests('rf-requests')).toBe(false);
    });

    it('returns true when localStorage contains an empty object payload', async () => {
      localStorage.setItem('rf-requests', JSON.stringify({}));
      expect(await idbMigrateRequests('rf-requests')).toBe(true);
    });

    it('returns false when indexedDB is undefined', async () => {
      localStorage.setItem('rf-requests', JSON.stringify(createMockRequestsData()));
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbMigrateRequests('rf-requests')).toBe(false);
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });
});
