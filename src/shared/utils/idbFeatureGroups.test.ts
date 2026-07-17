/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FeatureGroup } from '../types';

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
  idbLoadFeatureGroups,
  idbSaveFeatureGroups,
  idbMigrateFeatureGroups,
} from './idbFeatureGroups';

function createMockFeatureGroup(id = 'fg-1'): FeatureGroup {
  return {
    id,
    name: 'Test Feature Group',
    microserviceId: 'svc-1',
    environmentId: 'env-1',
    scenarios: [
      {
        id: 'sc-1',
        name: 'Test Scenario',
        tests: [
          {
            id: 'test-1',
            name: 'Test 1',
            url: 'https://api.example.com/test',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        ],
      },
    ],
  };
}

describe('idbFeatureGroups', () => {
  beforeEach(() => {
    resetAllMocks();
    localStorage.clear();
    mockGetResult = undefined;
    mockGetShouldError = false;
    mockPutShouldError = false;
    mockPutCalls.length = 0;
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('idbLoadFeatureGroups', () => {
    it('returns data from IndexedDB when available', async () => {
      const mockData = [createMockFeatureGroup()];
      mockGetResult = mockData;

      const result = await idbLoadFeatureGroups();

      expect(result).toEqual(mockData);
    });

    it('returns null when no data exists', async () => {
      mockGetResult = undefined;

      const result = await idbLoadFeatureGroups();

      expect(result).toBeNull();
    });

    it('returns null on IDB error', async () => {
      mockGetShouldError = true;

      const result = await idbLoadFeatureGroups();

      expect(result).toBeNull();
    });

    it('returns null when openDB rejects', async () => {
      const mod = await import('./idbOpen');
      vi.mocked(mod.openDB).mockRejectedValueOnce(new Error('open failed'));
      expect(await idbLoadFeatureGroups()).toBeNull();
    });

    it('returns null when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbLoadFeatureGroups()).toBeNull();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbSaveFeatureGroups', () => {
    it('saves feature groups to IndexedDB', async () => {
      const fgs = [createMockFeatureGroup()];

      await idbSaveFeatureGroups(fgs);

      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toEqual({ data: fgs, key: 'all' });
    });

    it('throws when put fails', async () => {
      const fgs = [createMockFeatureGroup()];
      mockPutShouldError = true;

      await expect(idbSaveFeatureGroups(fgs)).rejects.toThrow();
    });

    it('throws when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        await expect(idbSaveFeatureGroups([createMockFeatureGroup()])).rejects.toThrow('IndexedDB not available');
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbMigrateFeatureGroups', () => {
    it('migrates data from localStorage to IndexedDB', async () => {
      const fgs = [createMockFeatureGroup()];
      localStorage.setItem('rf-feature-groups', JSON.stringify(fgs));

      const result = await idbMigrateFeatureGroups('rf-feature-groups');

      expect(result).toBe(true);
      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0].key).toBe('all');
      expect(localStorage.getItem('rf-feature-groups')).toBeNull();
    });

    it('returns false when localStorage key does not exist', async () => {
      const result = await idbMigrateFeatureGroups('non-existent-key');

      expect(result).toBe(false);
      expect(mockPutCalls).toHaveLength(0);
    });

    it('returns false when localStorage contains invalid JSON', async () => {
      localStorage.setItem('rf-feature-groups', 'not-json');

      const result = await idbMigrateFeatureGroups('rf-feature-groups');

      expect(result).toBe(false);
    });

    it('returns false when localStorage contains empty array', async () => {
      localStorage.setItem('rf-feature-groups', '[]');

      const result = await idbMigrateFeatureGroups('rf-feature-groups');

      expect(result).toBe(false);
    });

    it('returns false when localStorage contains non-array', async () => {
      localStorage.setItem('rf-feature-groups', '{"not": "array"}');

      const result = await idbMigrateFeatureGroups('rf-feature-groups');

      expect(result).toBe(false);
    });

    it('returns false when indexedDB is undefined', async () => {
      localStorage.setItem('rf-feature-groups', JSON.stringify([createMockFeatureGroup()]));
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbMigrateFeatureGroups('rf-feature-groups')).toBe(false);
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });
});
