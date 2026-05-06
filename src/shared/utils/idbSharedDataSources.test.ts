/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SharedDataSource } from '../types';

// Setup fake IndexedDB before importing the module
import 'fake-indexeddb/auto';

// Mock tracking
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
  idbLoadSharedDataSources,
  idbSaveSharedDataSources,
  idbMigrateSharedDataSources,
} from './idbSharedDataSources';

function createMockSharedDataSource(id = 'sds-1'): SharedDataSource {
  return {
    id,
    name: 'Test Data Source',
    columns: ['userId', 'token'],
    rows: [
      { userId: '1', token: 'abc' },
      { userId: '2', token: 'def' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('idbSharedDataSources', () => {
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

  describe('idbLoadSharedDataSources', () => {
    it('returns data from IndexedDB when available', async () => {
      const mockData = [createMockSharedDataSource()];
      mockGetResult = mockData;

      const result = await idbLoadSharedDataSources();

      expect(result).toEqual(mockData);
    });

    it('returns null when no data exists', async () => {
      mockGetResult = undefined;

      const result = await idbLoadSharedDataSources();

      expect(result).toBeNull();
    });

    it('returns null on IDB error', async () => {
      mockGetShouldError = true;

      const result = await idbLoadSharedDataSources();

      expect(result).toBeNull();
    });
  });

  describe('idbSaveSharedDataSources', () => {
    it('saves data sources to IndexedDB', async () => {
      const sources = [createMockSharedDataSource()];

      await idbSaveSharedDataSources(sources);

      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toEqual({ data: sources, key: 'all' });
    });

    it('throws when put fails', async () => {
      const sources = [createMockSharedDataSource()];
      mockPutShouldError = true;

      await expect(idbSaveSharedDataSources(sources)).rejects.toThrow();
    });
  });

  describe('idbMigrateSharedDataSources', () => {
    it('migrates data from localStorage to IndexedDB', async () => {
      const sources = [createMockSharedDataSource()];
      localStorage.setItem('rf-shared-data-sources', JSON.stringify(sources));

      const result = await idbMigrateSharedDataSources('rf-shared-data-sources');

      expect(result).toBe(true);
      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0].key).toBe('all');
      expect(localStorage.getItem('rf-shared-data-sources')).toBeNull();
    });

    it('returns false when localStorage key does not exist', async () => {
      const result = await idbMigrateSharedDataSources('non-existent-key');

      expect(result).toBe(false);
      expect(mockPutCalls).toHaveLength(0);
    });

    it('returns false when localStorage contains invalid JSON', async () => {
      localStorage.setItem('rf-shared-data-sources', 'not-json');

      const result = await idbMigrateSharedDataSources('rf-shared-data-sources');

      expect(result).toBe(false);
    });

    it('returns false when localStorage contains empty array', async () => {
      localStorage.setItem('rf-shared-data-sources', '[]');

      const result = await idbMigrateSharedDataSources('rf-shared-data-sources');

      expect(result).toBe(false);
    });

    it('returns false when localStorage contains non-array', async () => {
      localStorage.setItem('rf-shared-data-sources', '{"not": "array"}');

      const result = await idbMigrateSharedDataSources('rf-shared-data-sources');

      expect(result).toBe(false);
    });
  });
});
