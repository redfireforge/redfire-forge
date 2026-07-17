/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  idbLoadProjects,
  idbSaveProjects,
  idbMigrateProjects,
} from './idbProjects';

function createMockProject(id = 'proj-1') {
  return { id, name: 'Test Project' };
}

describe('idbProjects', () => {
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

  describe('idbLoadProjects', () => {
    it('returns data from IndexedDB when available', async () => {
      const mockData = [createMockProject()];
      mockGetResult = mockData;

      const result = await idbLoadProjects();

      expect(result).toEqual(mockData);
    });

    it('returns null when no data exists', async () => {
      mockGetResult = undefined;

      const result = await idbLoadProjects();

      expect(result).toBeNull();
    });

    it('returns null on IDB error', async () => {
      mockGetShouldError = true;

      const result = await idbLoadProjects();

      expect(result).toBeNull();
    });

    it('returns null when openDB rejects', async () => {
      const mod = await import('./idbOpen');
      vi.mocked(mod.openDB).mockRejectedValueOnce(new Error('open failed'));

      expect(await idbLoadProjects()).toBeNull();
    });

    it('returns null when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbLoadProjects()).toBeNull();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbSaveProjects', () => {
    it('saves projects to IndexedDB', async () => {
      const projects = [createMockProject()];

      await idbSaveProjects(projects);

      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toEqual({ data: projects, key: 'all' });
    });

    it('throws when put fails', async () => {
      mockPutShouldError = true;

      await expect(idbSaveProjects([createMockProject()])).rejects.toThrow();
    });

    it('throws when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        await expect(idbSaveProjects([createMockProject()])).rejects.toThrow('IndexedDB not available');
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbMigrateProjects', () => {
    it('migrates data from localStorage to IndexedDB', async () => {
      const projects = [createMockProject()];
      localStorage.setItem('rf-projects', JSON.stringify(projects));

      const result = await idbMigrateProjects('rf-projects');

      expect(result).toBe(true);
      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0].key).toBe('all');
      expect(localStorage.getItem('rf-projects')).toBeNull();
    });

    it('returns false when localStorage key does not exist', async () => {
      expect(await idbMigrateProjects('non-existent-key')).toBe(false);
      expect(mockPutCalls).toHaveLength(0);
    });

    it('returns false when localStorage contains invalid JSON', async () => {
      localStorage.setItem('rf-projects', 'not-json');

      expect(await idbMigrateProjects('rf-projects')).toBe(false);
    });

    it('returns false when localStorage contains empty array', async () => {
      localStorage.setItem('rf-projects', '[]');

      expect(await idbMigrateProjects('rf-projects')).toBe(false);
    });

    it('returns false when localStorage contains non-array', async () => {
      localStorage.setItem('rf-projects', '{"not": "array"}');

      expect(await idbMigrateProjects('rf-projects')).toBe(false);
    });

    it('returns false when localStorage contains an empty array payload', async () => {
      localStorage.setItem('rf-projects', '[]');
      expect(await idbMigrateProjects('rf-projects')).toBe(false);
    });

    it('returns false when indexedDB is undefined', async () => {
      localStorage.setItem('rf-projects', JSON.stringify([createMockProject()]));
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbMigrateProjects('rf-projects')).toBe(false);
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });
});
