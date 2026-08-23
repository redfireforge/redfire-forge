/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Workflow, WorkflowFolder, WorkflowVersion } from '@workflow/types/workflow';
import { makeWorkflow } from '@test-utils/factories';

const { isTauriMock, tauriStoreMap, tauriGetItem, tauriSetItem, workflowsStore } = vi.hoisted(() => {
  const tauriStoreMap = new Map<string, string>();
  return {
    isTauriMock: vi.fn(() => false),
    tauriStoreMap,
    tauriGetItem: vi.fn(async (key: string) => tauriStoreMap.get(key) ?? null),
    tauriSetItem: vi.fn(async (key: string, value: string) => {
      if (value === '') tauriStoreMap.delete(key);
      else tauriStoreMap.set(key, value);
    }),
    workflowsStore: {
    workflows: null as Workflow[] | null,
    folders: null as WorkflowFolder[] | null,
    throwOnSaveWorkflows: false,
    throwOnLoadWorkflows: false,
    throwOnSaveFolders: false,
    throwOnLoadFolders: false,
    throwOnMigrateWorkflows: false,
    throwOnMigrateFolders: false,
    },
  };
});

vi.mock('./platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('./tauriStore', () => ({
  getItem: (key: string) => tauriGetItem(key),
  setItem: (key: string, value: string) => tauriSetItem(key, value),
  getUsageBytes: vi.fn(async () => ({ usedBytes: 0, entries: {} })),
}));

vi.mock('./idbWorkflows', () => ({
  idbLoadWorkflows: vi.fn(async () => {
    if (workflowsStore.throwOnLoadWorkflows) throw new Error('idb load workflows fail');
    return workflowsStore.workflows;
  }),
  idbSaveWorkflows: vi.fn(async (workflows: Workflow[]) => {
    if (workflowsStore.throwOnSaveWorkflows) throw new Error('idb save workflows fail');
    workflowsStore.workflows = workflows;
  }),
  idbMigrateWorkflows: vi.fn(async () => {
    if (workflowsStore.throwOnMigrateWorkflows) throw new Error('idb migrate workflows fail');
    return true;
  }),
  idbLoadWorkflowFolders: vi.fn(async () => {
    if (workflowsStore.throwOnLoadFolders) throw new Error('idb load folders fail');
    return workflowsStore.folders;
  }),
  idbSaveWorkflowFolders: vi.fn(async (folders: WorkflowFolder[]) => {
    if (workflowsStore.throwOnSaveFolders) throw new Error('idb save folders fail');
    workflowsStore.folders = folders;
  }),
  idbMigrateWorkflowFolders: vi.fn(async () => {
    if (workflowsStore.throwOnMigrateFolders) throw new Error('idb migrate folders fail');
    return true;
  }),
}));

import {
  WORKFLOWS_KEY,
  WORKFLOW_FOLDERS_KEY,
  loadWorkflows,
  saveWorkflows,
  loadWorkflowFolders,
  saveWorkflowFolders,
  compactWorkflowStorage,
  migrateWorkflowKeysToIdb,
} from './storageWorkflows';
import {
  idbLoadWorkflows,
  idbSaveWorkflows,
  idbMigrateWorkflows,
  idbMigrateWorkflowFolders,
} from './idbWorkflows';

function makeFolder(id: string, name: string): WorkflowFolder {
  return { id, name, order: 0 };
}

function makeVersion(id: string): WorkflowVersion {
  return {
    id,
    timestamp: Date.now(),
    fingerprint: `fp-${id}`,
    nodeCount: 0,
    edgeCount: 0,
    nodes: [],
    edges: [],
    variables: {},
  };
}

function resetWorkflowsStore() {
  workflowsStore.workflows = null;
  workflowsStore.folders = null;
  workflowsStore.throwOnSaveWorkflows = false;
  workflowsStore.throwOnLoadWorkflows = false;
  workflowsStore.throwOnSaveFolders = false;
  workflowsStore.throwOnLoadFolders = false;
  workflowsStore.throwOnMigrateWorkflows = false;
  workflowsStore.throwOnMigrateFolders = false;
}

describe('storageWorkflows — browser (IDB primary)', () => {
  beforeEach(() => {
    localStorage.clear();
    isTauriMock.mockReturnValue(false);
    resetWorkflowsStore();
    resetAllMocks();
  });

  describe('loadWorkflows / saveWorkflows', () => {
    it('returns empty array when nothing stored', async () => {
      expect(await loadWorkflows()).toEqual([]);
    });

    it('round-trips workflows through IDB', async () => {
      const workflows = [makeWorkflow({ id: 'w1', name: 'Flow A' })];
      await saveWorkflows(workflows);
      expect(workflowsStore.workflows).toEqual(workflows);
      expect(await loadWorkflows()).toEqual(workflows);
    });

    it('removes legacy localStorage key after IDB save', async () => {
      localStorage.setItem(WORKFLOWS_KEY, JSON.stringify([makeWorkflow({ id: 'legacy' })]));
      await saveWorkflows([makeWorkflow({ id: 'w1' })]);
      expect(localStorage.getItem(WORKFLOWS_KEY)).toBeNull();
    });

    it('does not write to localStorage when IDB save fails on web', async () => {
      workflowsStore.throwOnSaveWorkflows = true;
      const workflows = [makeWorkflow({ id: 'w1' })];
      await saveWorkflows(workflows);
      expect(localStorage.getItem(WORKFLOWS_KEY)).toBeNull();
      expect(workflowsStore.workflows).toBeNull();
    });

    it('loads from localStorage and migrates when IDB is empty', async () => {
      const workflows = [makeWorkflow({ id: 'w1', name: 'Migrated' })];
      localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
      const loaded = await loadWorkflows();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('Migrated');
      expect(idbMigrateWorkflows).toHaveBeenCalledWith(WORKFLOWS_KEY);
    });

    it('does not migrate when localStorage workflows array is empty', async () => {
      localStorage.setItem(WORKFLOWS_KEY, JSON.stringify([]));
      expect(await loadWorkflows()).toEqual([]);
      expect(idbMigrateWorkflows).not.toHaveBeenCalled();
      expect(localStorage.getItem(WORKFLOWS_KEY)).toBeNull();
    });

    it('returns empty array when localStorage workflows JSON is not an array', async () => {
      localStorage.setItem(WORKFLOWS_KEY, JSON.stringify({ not: 'array' }));
      expect(await loadWorkflows()).toEqual([]);
    });

    it('returns empty array when IDB load throws', async () => {
      workflowsStore.throwOnLoadWorkflows = true;
      expect(await loadWorkflows()).toEqual([]);
    });

    it('prefers IDB over localStorage', async () => {
      workflowsStore.workflows = [makeWorkflow({ id: 'idb', name: 'From IDB' })];
      localStorage.setItem(WORKFLOWS_KEY, JSON.stringify([makeWorkflow({ id: 'ls', name: 'From LS' })]));
      const loaded = await loadWorkflows();
      expect(loaded[0].id).toBe('idb');
    });
  });

  describe('loadWorkflowFolders / saveWorkflowFolders', () => {
    it('returns empty array when nothing stored', async () => {
      expect(await loadWorkflowFolders()).toEqual([]);
    });

    it('round-trips folders through IDB', async () => {
      const folders = [makeFolder('f1', 'Folder One')];
      await saveWorkflowFolders(folders);
      expect(await loadWorkflowFolders()).toEqual(folders);
    });

    it('removes legacy localStorage key after IDB save', async () => {
      localStorage.setItem(WORKFLOW_FOLDERS_KEY, JSON.stringify([makeFolder('legacy', 'Old')]));
      await saveWorkflowFolders([makeFolder('f1', 'New')]);
      expect(localStorage.getItem(WORKFLOW_FOLDERS_KEY)).toBeNull();
    });

    it('does not write to localStorage when IDB save fails on web', async () => {
      workflowsStore.throwOnSaveFolders = true;
      const folders = [makeFolder('f1', 'Fallback')];
      await saveWorkflowFolders(folders);
      expect(localStorage.getItem(WORKFLOW_FOLDERS_KEY)).toBeNull();
      expect(workflowsStore.folders).toBeNull();
    });

    it('loads from localStorage and migrates when IDB is empty', async () => {
      const folders = [makeFolder('f1', 'Migrated')];
      localStorage.setItem(WORKFLOW_FOLDERS_KEY, JSON.stringify(folders));
      const loaded = await loadWorkflowFolders();
      expect(loaded).toEqual(folders);
      expect(idbMigrateWorkflowFolders).toHaveBeenCalledWith(WORKFLOW_FOLDERS_KEY);
    });

    it('does not migrate when localStorage folders array is empty', async () => {
      localStorage.setItem(WORKFLOW_FOLDERS_KEY, JSON.stringify([]));
      expect(await loadWorkflowFolders()).toEqual([]);
      expect(idbMigrateWorkflowFolders).not.toHaveBeenCalled();
      expect(localStorage.getItem(WORKFLOW_FOLDERS_KEY)).toBeNull();
    });

    it('returns empty array when localStorage folders JSON is not an array', async () => {
      localStorage.setItem(WORKFLOW_FOLDERS_KEY, JSON.stringify({ not: 'array' }));
      expect(await loadWorkflowFolders()).toEqual([]);
    });

    it('returns empty array when IDB load throws', async () => {
      workflowsStore.throwOnLoadFolders = true;
      expect(await loadWorkflowFolders()).toEqual([]);
    });

    it('prefers IDB over localStorage', async () => {
      workflowsStore.folders = [makeFolder('idb', 'From IDB')];
      localStorage.setItem(WORKFLOW_FOLDERS_KEY, JSON.stringify([makeFolder('ls', 'From LS')]));
      const loaded = await loadWorkflowFolders();
      expect(loaded[0].id).toBe('idb');
    });
  });

  describe('compactWorkflowStorage', () => {
    it('returns zero KB when no workflows', async () => {
      expect(await compactWorkflowStorage()).toEqual({ beforeKB: 0, afterKB: 0 });
    });

    it('trims version history to maxVersionsPerWorkflow and saves', async () => {
      const versions = Array.from({ length: 8 }, (_, i) => makeVersion(`v${i}`));
      const wf = makeWorkflow({ id: 'w1', versions });
      await saveWorkflows([wf]);

      const result = await compactWorkflowStorage(3);
      expect(result.beforeKB).toBeGreaterThan(0);
      expect(result.afterKB).toBeLessThanOrEqual(result.beforeKB);

      const loaded = await loadWorkflows();
      expect(loaded[0].versions).toHaveLength(3);
      expect(loaded[0].versions![0].id).toBe('v0');
    });

    it('leaves workflows unchanged when versions are within limit', async () => {
      const wf = makeWorkflow({ id: 'w1', versions: [makeVersion('v1'), makeVersion('v2')] });
      await saveWorkflows([wf]);
      const before = await loadWorkflows();
      const result = await compactWorkflowStorage(5);
      const after = await loadWorkflows();
      expect(after[0].versions).toHaveLength(2);
      expect(result.beforeKB).toBe(result.afterKB);
      expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    });

    it('returns unchanged afterKB when trimming throws', async () => {
      const wf = makeWorkflow({
        id: 'w1',
        versions: Array.from({ length: 10 }, (_, i) => makeVersion(`v${i}`)),
      });
      Object.defineProperty(wf, 'versions', {
        configurable: true,
        get() {
          return (wf as Workflow & { _versions?: WorkflowVersion[] })._versions ?? [];
        },
        set(value: WorkflowVersion[]) {
          (wf as Workflow & { _versions?: WorkflowVersion[] })._versions = value;
        },
      });
      (wf as Workflow & { _versions?: WorkflowVersion[] })._versions = {
        length: 10,
        slice: () => {
          throw new Error('slice fail');
        },
      } as unknown as WorkflowVersion[];

      workflowsStore.workflows = [wf];
      const result = await compactWorkflowStorage(2);
      expect(result.afterKB).toBe(result.beforeKB);
    });
  });

  describe('migrateWorkflowKeysToIdb', () => {
    it('migrates workflows and folders when localStorage keys exist', async () => {
      localStorage.setItem(WORKFLOWS_KEY, JSON.stringify([makeWorkflow({ id: 'w1' })]));
      localStorage.setItem(WORKFLOW_FOLDERS_KEY, JSON.stringify([makeFolder('f1', 'F')]));
      await migrateWorkflowKeysToIdb();
      expect(idbMigrateWorkflows).toHaveBeenCalledWith(WORKFLOWS_KEY);
      expect(idbMigrateWorkflowFolders).toHaveBeenCalledWith(WORKFLOW_FOLDERS_KEY);
    });

    it('skips migration when keys are absent', async () => {
      await migrateWorkflowKeysToIdb();
      expect(idbMigrateWorkflows).not.toHaveBeenCalled();
      expect(idbMigrateWorkflowFolders).not.toHaveBeenCalled();
    });

    it('ignores migration errors', async () => {
      localStorage.setItem(WORKFLOWS_KEY, '[]');
      localStorage.setItem(WORKFLOW_FOLDERS_KEY, '[]');
      workflowsStore.throwOnMigrateWorkflows = true;
      workflowsStore.throwOnMigrateFolders = true;
      await expect(migrateWorkflowKeysToIdb()).resolves.toBeUndefined();
    });
  });
});

describe('storageWorkflows — tauri backend', () => {
  beforeEach(() => {
    localStorage.clear();
    tauriStoreMap.clear();
    isTauriMock.mockReturnValue(true);
    resetWorkflowsStore();
    tauriGetItem.mockImplementation(async (key: string) => tauriStoreMap.get(key) ?? null);
    tauriSetItem.mockImplementation(async (key: string, value: string) => {
      if (value === '') tauriStoreMap.delete(key);
      else tauriStoreMap.set(key, value);
    });
    resetAllMocks();
  });

  it('loadWorkflows reads from tauriStore', async () => {
    tauriStoreMap.set(WORKFLOWS_KEY, JSON.stringify([{ id: 'w1', name: 'Tauri WF' }]));
    const loaded = await loadWorkflows();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('w1');
    expect(idbLoadWorkflows).not.toHaveBeenCalled();
  });

  it('loadWorkflows returns empty array when null', async () => {
    expect(await loadWorkflows()).toEqual([]);
  });

  it('loadWorkflows returns empty array on error', async () => {
    tauriStoreMap.set(WORKFLOWS_KEY, 'not-json');
    expect(await loadWorkflows()).toEqual([]);
  });

  it('loadWorkflows returns empty array when tauriStore read fails', async () => {
    tauriGetItem.mockRejectedValueOnce(new Error('read fail'));
    expect(await loadWorkflows()).toEqual([]);
  });

  it('saveWorkflows writes JSON via tauriStore', async () => {
    const workflows = [makeWorkflow({ id: 'w1' })];
    await saveWorkflows(workflows);
    expect(JSON.parse(tauriStoreMap.get(WORKFLOWS_KEY)!)).toEqual(workflows);
    expect(idbSaveWorkflows).not.toHaveBeenCalled();
  });

  it('saveWorkflows swallows QuotaExceededError from writeKey', async () => {
    tauriSetItem.mockRejectedValueOnce(new DOMException('quota', 'QuotaExceededError'));
    await expect(saveWorkflows([makeWorkflow()])).resolves.toBeUndefined();
  });

  it('loadWorkflowFolders reads from tauriStore', async () => {
    const folders = [makeFolder('f1', 'Tauri Folder')];
    tauriStoreMap.set(WORKFLOW_FOLDERS_KEY, JSON.stringify(folders));
    expect(await loadWorkflowFolders()).toEqual(folders);
  });

  it('loadWorkflowFolders returns empty array on error', async () => {
    tauriStoreMap.set(WORKFLOW_FOLDERS_KEY, '{bad');
    expect(await loadWorkflowFolders()).toEqual([]);
  });

  it('loadWorkflowFolders returns empty array when null', async () => {
    expect(await loadWorkflowFolders()).toEqual([]);
  });

  it('saveWorkflowFolders writes JSON via tauriStore', async () => {
    const folders = [makeFolder('f1', 'Saved')];
    await saveWorkflowFolders(folders);
    expect(JSON.parse(tauriStoreMap.get(WORKFLOW_FOLDERS_KEY)!)).toEqual(folders);
  });

  it('saveWorkflowFolders surfaces tauriStore write errors', async () => {
    tauriSetItem.mockRejectedValueOnce(new Error('write fail'));
    await expect(saveWorkflowFolders([makeFolder('f1', 'Saved')])).rejects.toThrow('write fail');
  });
});
