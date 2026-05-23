/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeWorkflow } from '../../test-utils/factories';
import type { WorkflowFolder } from '../../features/workflow/types/workflow';

import 'fake-indexeddb/auto';

const mockStores: Record<string, Map<string, unknown>> = {
  workflows: new Map(),
  workflowFolders: new Map(),
};

let mockGetShouldError = false;
let mockPutShouldError = false;
const mockPutCalls: Array<{ store: string; data: unknown; key: string }> = [];

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

  const createObjectStore = (storeName: string) => ({
    get: (key: string) => createRequest(mockStores[storeName]?.get(key), mockGetShouldError),
    put: (data: unknown, key: string) => {
      mockPutCalls.push({ store: storeName, data, key });
      if (!mockPutShouldError) mockStores[storeName]?.set(key, data);
      return createRequest(undefined, mockPutShouldError);
    },
  });

  const mockDB = {
    transaction: (storeName: string) => ({
      objectStore: () => createObjectStore(storeName),
    }),
  };
  return {
    openDB: vi.fn().mockResolvedValue(mockDB),
  };
});

import {
  idbLoadWorkflows,
  idbSaveWorkflows,
  idbMigrateWorkflows,
  idbLoadWorkflowFolders,
  idbSaveWorkflowFolders,
  idbMigrateWorkflowFolders,
} from './idbWorkflows';

function createMockWorkflowFolder(id = 'folder-1'): WorkflowFolder {
  return { id, name: 'Test Folder', order: 0 };
}

describe('idbWorkflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockStores.workflows.clear();
    mockStores.workflowFolders.clear();
    mockGetShouldError = false;
    mockPutShouldError = false;
    mockPutCalls.length = 0;
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('idbLoadWorkflows', () => {
    it('returns data from IndexedDB when available', async () => {
      const workflows = [makeWorkflow({ id: 'wf-1' })];
      mockStores.workflows.set('all', workflows);

      expect(await idbLoadWorkflows()).toEqual(workflows);
    });

    it('returns null when no data exists', async () => {
      expect(await idbLoadWorkflows()).toBeNull();
    });

    it('returns null on IDB error', async () => {
      mockGetShouldError = true;

      expect(await idbLoadWorkflows()).toBeNull();
    });

    it('returns null when openDB rejects', async () => {
      const mod = await import('./idbOpen');
      vi.mocked(mod.openDB).mockRejectedValueOnce(new Error('open failed'));

      expect(await idbLoadWorkflows()).toBeNull();
    });

    it('returns null when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbLoadWorkflows()).toBeNull();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbSaveWorkflows', () => {
    it('saves workflows to IndexedDB', async () => {
      const workflows = [makeWorkflow({ id: 'wf-1' })];

      await idbSaveWorkflows(workflows);

      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toEqual({ store: 'workflows', data: workflows, key: 'all' });
      expect(await idbLoadWorkflows()).toEqual(workflows);
    });

    it('throws when put fails', async () => {
      mockPutShouldError = true;

      await expect(idbSaveWorkflows([makeWorkflow()])).rejects.toThrow();
    });

    it('throws when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        await expect(idbSaveWorkflows([makeWorkflow()])).rejects.toThrow('IndexedDB not available');
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbMigrateWorkflows', () => {
    it('migrates data from localStorage to IndexedDB', async () => {
      const workflows = [makeWorkflow({ id: 'wf-1' })];
      localStorage.setItem('rf-workflows', JSON.stringify(workflows));

      const result = await idbMigrateWorkflows('rf-workflows');

      expect(result).toBe(true);
      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toMatchObject({ store: 'workflows', key: 'all' });
      expect(localStorage.getItem('rf-workflows')).toBeNull();
    });

    it('returns false when localStorage key does not exist', async () => {
      expect(await idbMigrateWorkflows('missing')).toBe(false);
    });

    it('returns false when localStorage contains invalid JSON', async () => {
      localStorage.setItem('rf-workflows', 'bad-json');

      expect(await idbMigrateWorkflows('rf-workflows')).toBe(false);
    });

    it('returns false when localStorage contains empty array', async () => {
      localStorage.setItem('rf-workflows', '[]');

      expect(await idbMigrateWorkflows('rf-workflows')).toBe(false);
    });

    it('returns false when localStorage contains non-array', async () => {
      localStorage.setItem('rf-workflows', '{"not": "array"}');

      expect(await idbMigrateWorkflows('rf-workflows')).toBe(false);
    });

    it('returns false when indexedDB is undefined', async () => {
      localStorage.setItem('rf-workflows', JSON.stringify([makeWorkflow()]));
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbMigrateWorkflows('rf-workflows')).toBe(false);
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbLoadWorkflowFolders', () => {
    it('returns folders from IndexedDB when available', async () => {
      const folders = [createMockWorkflowFolder()];
      mockStores.workflowFolders.set('all', folders);

      expect(await idbLoadWorkflowFolders()).toEqual(folders);
    });

    it('returns null when no data exists', async () => {
      expect(await idbLoadWorkflowFolders()).toBeNull();
    });

    it('returns null on IDB error', async () => {
      mockGetShouldError = true;

      expect(await idbLoadWorkflowFolders()).toBeNull();
    });

    it('returns null when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbLoadWorkflowFolders()).toBeNull();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbSaveWorkflowFolders', () => {
    it('saves workflow folders to IndexedDB', async () => {
      const folders = [createMockWorkflowFolder()];

      await idbSaveWorkflowFolders(folders);

      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toEqual({ store: 'workflowFolders', data: folders, key: 'all' });
      expect(await idbLoadWorkflowFolders()).toEqual(folders);
    });

    it('throws when put fails', async () => {
      mockPutShouldError = true;

      await expect(idbSaveWorkflowFolders([createMockWorkflowFolder()])).rejects.toThrow();
    });

    it('throws when indexedDB is undefined', async () => {
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        await expect(idbSaveWorkflowFolders([createMockWorkflowFolder()])).rejects.toThrow('IndexedDB not available');
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('idbMigrateWorkflowFolders', () => {
    it('migrates folders from localStorage to IndexedDB', async () => {
      const folders = [createMockWorkflowFolder()];
      localStorage.setItem('rf-workflow-folders', JSON.stringify(folders));

      const result = await idbMigrateWorkflowFolders('rf-workflow-folders');

      expect(result).toBe(true);
      expect(mockPutCalls).toHaveLength(1);
      expect(mockPutCalls[0]).toMatchObject({ store: 'workflowFolders', key: 'all' });
      expect(localStorage.getItem('rf-workflow-folders')).toBeNull();
    });

    it('returns false when localStorage key does not exist', async () => {
      expect(await idbMigrateWorkflowFolders('missing')).toBe(false);
    });

    it('returns false when localStorage contains invalid JSON', async () => {
      localStorage.setItem('rf-workflow-folders', 'not-json');

      expect(await idbMigrateWorkflowFolders('rf-workflow-folders')).toBe(false);
    });

    it('returns false when localStorage contains empty array', async () => {
      localStorage.setItem('rf-workflow-folders', '[]');

      expect(await idbMigrateWorkflowFolders('rf-workflow-folders')).toBe(false);
    });

    it('returns false when indexedDB is undefined', async () => {
      localStorage.setItem('rf-workflow-folders', JSON.stringify([createMockWorkflowFolder()]));
      const orig = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        expect(await idbMigrateWorkflowFolders('rf-workflow-folders')).toBe(false);
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });
});
