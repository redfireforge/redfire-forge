import { describe, it, expect } from 'vitest';
import type { Workflow, WorkflowFolder } from '../types/workflow';
import {
  buildFolderTree,
  getUnfiledWorkflows,
  getFolderPath,
  getDescendantFolderIds,
  getWorkflowsInFolderRecursive,
  flattenFoldersForRunner,
  isDescendant,
  moveFolder,
  moveWorkflow,
} from './workflowFolderTree';

// ── Helpers ─────────────────────────────────────────

const makeFolder = (overrides: Partial<WorkflowFolder> & { id: string }): WorkflowFolder => ({
  name: overrides.id,
  order: 0,
  ...overrides,
});

const makeWorkflow = (overrides: Partial<Workflow> & { id: string }): Workflow => ({
  name: overrides.id,
  schemaVersion: 5,
  variables: {},
  nodes: [],
  edges: [],
  createdAt: 1000,
  updatedAt: 2000,
  ...overrides,
} as Workflow);

// ── buildFolderTree ─────────────────────────────────

describe('buildFolderTree', () => {
  it('returns empty array for no folders', () => {
    expect(buildFolderTree([], [])).toEqual([]);
  });

  it('builds flat root folders', () => {
    const folders = [
      makeFolder({ id: 'a', order: 1 }),
      makeFolder({ id: 'b', order: 0 }),
    ];
    const tree = buildFolderTree(folders);
    expect(tree).toHaveLength(2);
    expect(tree[0].folder.id).toBe('b');
    expect(tree[1].folder.id).toBe('a');
  });

  it('nests children under parents', () => {
    const folders = [
      makeFolder({ id: 'root', order: 0 }),
      makeFolder({ id: 'child', parentId: 'root', order: 0 }),
      makeFolder({ id: 'grandchild', parentId: 'child', order: 0 }),
    ];
    const tree = buildFolderTree(folders);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].folder.id).toBe('grandchild');
  });

  it('attaches workflows to their folders', () => {
    const folders = [makeFolder({ id: 'f1', order: 0 })];
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'f1', folderOrder: 1 }),
      makeWorkflow({ id: 'w2', folderId: 'f1', folderOrder: 0 }),
    ];
    const tree = buildFolderTree(folders, workflows);
    expect(tree[0].workflows).toHaveLength(2);
    expect(tree[0].workflows[0].id).toBe('w2');
    expect(tree[0].workflows[1].id).toBe('w1');
  });

  it('orphaned folder (parentId references missing id) becomes root', () => {
    const folders = [makeFolder({ id: 'orphan', parentId: 'gone', order: 0 })];
    const tree = buildFolderTree(folders);
    expect(tree).toHaveLength(1);
    expect(tree[0].folder.id).toBe('orphan');
  });
});

// ── getUnfiledWorkflows ─────────────────────────────

describe('getUnfiledWorkflows', () => {
  it('returns workflows with no folderId', () => {
    const folders = [makeFolder({ id: 'f1', order: 0 })];
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'f1' }),
      makeWorkflow({ id: 'w2' }),
      makeWorkflow({ id: 'w3', folderId: 'missing' }),
    ];
    const unfiled = getUnfiledWorkflows(folders, workflows);
    expect(unfiled.map((w) => w.id)).toEqual(['w2', 'w3']);
  });

  it('returns empty when all workflows have valid folders', () => {
    const folders = [makeFolder({ id: 'f1', order: 0 })];
    const workflows = [makeWorkflow({ id: 'w1', folderId: 'f1' })];
    expect(getUnfiledWorkflows(folders, workflows)).toEqual([]);
  });
});

// ── getFolderPath ───────────────────────────────────

describe('getFolderPath', () => {
  it('returns single name for root folder', () => {
    const folders = [makeFolder({ id: 'f1', name: 'Root', order: 0 })];
    expect(getFolderPath('f1', folders)).toBe('Root');
  });

  it('builds breadcrumb for nested folders', () => {
    const folders = [
      makeFolder({ id: 'a', name: 'Performance', order: 0 }),
      makeFolder({ id: 'b', name: 'Load Tests', parentId: 'a', order: 0 }),
      makeFolder({ id: 'c', name: 'Peak', parentId: 'b', order: 0 }),
    ];
    expect(getFolderPath('c', folders)).toBe('Performance / Load Tests / Peak');
  });

  it('returns empty string for non-existent folder', () => {
    expect(getFolderPath('nope', [])).toBe('');
  });

  it('handles circular parentId gracefully', () => {
    const folders = [
      makeFolder({ id: 'a', name: 'A', parentId: 'b', order: 0 }),
      makeFolder({ id: 'b', name: 'B', parentId: 'a', order: 0 }),
    ];
    const path = getFolderPath('a', folders);
    expect(path.length).toBeGreaterThan(0);
    expect(path.split(' / ').length).toBeLessThanOrEqual(2);
  });
});

// ── getDescendantFolderIds ──────────────────────────

describe('getDescendantFolderIds', () => {
  it('returns empty set for leaf folder', () => {
    const folders = [makeFolder({ id: 'leaf', order: 0 })];
    expect(getDescendantFolderIds('leaf', folders).size).toBe(0);
  });

  it('collects all descendants recursively', () => {
    const folders = [
      makeFolder({ id: 'root', order: 0 }),
      makeFolder({ id: 'child', parentId: 'root', order: 0 }),
      makeFolder({ id: 'grandchild', parentId: 'child', order: 0 }),
      makeFolder({ id: 'other', order: 1 }),
    ];
    const ids = getDescendantFolderIds('root', folders);
    expect(ids).toEqual(new Set(['child', 'grandchild']));
  });
});

// ── getWorkflowsInFolderRecursive ───────────────────

describe('getWorkflowsInFolderRecursive', () => {
  it('collects workflows from folder and sub-folders', () => {
    const folders = [
      makeFolder({ id: 'root', order: 0 }),
      makeFolder({ id: 'child', parentId: 'root', order: 0 }),
    ];
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'root' }),
      makeWorkflow({ id: 'w2', folderId: 'child' }),
      makeWorkflow({ id: 'w3' }),
    ];
    const result = getWorkflowsInFolderRecursive('root', folders, workflows);
    expect(result.map((w) => w.id).sort()).toEqual(['w1', 'w2']);
  });

  it('returns empty for folder with no workflows', () => {
    const folders = [makeFolder({ id: 'empty', order: 0 })];
    const result = getWorkflowsInFolderRecursive('empty', folders, []);
    expect(result).toEqual([]);
  });
});

// ── flattenFoldersForRunner ─────────────────────────

describe('flattenFoldersForRunner', () => {
  it('groups workflows by folder path with unfiled at the end', () => {
    const folders = [
      makeFolder({ id: 'perf', name: 'Performance', order: 0 }),
      makeFolder({ id: 'load', name: 'Load', parentId: 'perf', order: 0 }),
    ];
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'perf', folderOrder: 0 }),
      makeWorkflow({ id: 'w2', folderId: 'load', folderOrder: 0 }),
      makeWorkflow({ id: 'w3' }),
    ];
    const groups = flattenFoldersForRunner(folders, workflows);
    expect(groups).toHaveLength(3);
    expect(groups[0].path).toBe('Performance');
    expect(groups[0].workflows[0].id).toBe('w1');
    expect(groups[1].path).toBe('Performance / Load');
    expect(groups[1].workflows[0].id).toBe('w2');
    expect(groups[2].path).toBe('Unfiled');
    expect(groups[2].workflows[0].id).toBe('w3');
  });

  it('omits empty folders', () => {
    const folders = [makeFolder({ id: 'empty', name: 'Empty', order: 0 })];
    const groups = flattenFoldersForRunner(folders, []);
    expect(groups).toHaveLength(0);
  });
});

// ── isDescendant ────────────────────────────────────

describe('isDescendant', () => {
  const folders = [
    makeFolder({ id: 'root', order: 0 }),
    makeFolder({ id: 'child', parentId: 'root', order: 0 }),
    makeFolder({ id: 'grandchild', parentId: 'child', order: 0 }),
    makeFolder({ id: 'other', order: 1 }),
  ];

  it('returns true for self', () => {
    expect(isDescendant('root', 'root', folders)).toBe(true);
  });

  it('returns true for direct child', () => {
    expect(isDescendant('root', 'child', folders)).toBe(true);
  });

  it('returns true for deep descendant', () => {
    expect(isDescendant('root', 'grandchild', folders)).toBe(true);
  });

  it('returns false for unrelated folder', () => {
    expect(isDescendant('root', 'other', folders)).toBe(false);
  });

  it('returns false for ancestor', () => {
    expect(isDescendant('child', 'root', folders)).toBe(false);
  });
});

// ── moveFolder ──────────────────────────────────────

describe('moveFolder', () => {
  it('moves a folder to a new parent', () => {
    const folders = [
      makeFolder({ id: 'a', order: 0 }),
      makeFolder({ id: 'b', order: 1 }),
    ];
    const result = moveFolder('b', 'a', 0, folders);
    const moved = result.find((f) => f.id === 'b');
    expect(moved?.parentId).toBe('a');
  });

  it('promotes a sub-folder to root', () => {
    const folders = [
      makeFolder({ id: 'parent', order: 0 }),
      makeFolder({ id: 'child', parentId: 'parent', order: 0 }),
    ];
    const result = moveFolder('child', null, 0, folders);
    const moved = result.find((f) => f.id === 'child');
    expect(moved?.parentId).toBeUndefined();
  });

  it('blocks circular move (folder into its own descendant)', () => {
    const folders = [
      makeFolder({ id: 'root', order: 0 }),
      makeFolder({ id: 'child', parentId: 'root', order: 0 }),
    ];
    const result = moveFolder('root', 'child', 0, folders);
    const root = result.find((f) => f.id === 'root');
    expect(root?.parentId).toBeUndefined();
  });

  it('returns unchanged array for non-existent folder', () => {
    const folders = [makeFolder({ id: 'a', order: 0 })];
    expect(moveFolder('nope', null, 0, folders)).toBe(folders);
  });

  it('reorders siblings after move', () => {
    const folders = [
      makeFolder({ id: 'a', order: 0 }),
      makeFolder({ id: 'b', order: 1 }),
      makeFolder({ id: 'c', order: 2 }),
    ];
    const result = moveFolder('c', null, 0, folders);
    const orders = result
      .filter((f) => !f.parentId)
      .sort((a, b) => a.order - b.order)
      .map((f) => f.id);
    expect(orders).toEqual(['c', 'a', 'b']);
  });
});

// ── moveWorkflow ────────────────────────────────────

describe('moveWorkflow', () => {
  it('moves a workflow to a folder', () => {
    const workflows = [
      makeWorkflow({ id: 'w1', folderOrder: 0 }),
    ];
    const result = moveWorkflow('w1', 'folder1', 0, workflows);
    expect(result[0].folderId).toBe('folder1');
  });

  it('moves a workflow to unfiled (null)', () => {
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'f1', folderOrder: 0 }),
    ];
    const result = moveWorkflow('w1', null, 0, workflows);
    expect(result[0].folderId).toBeUndefined();
  });

  it('reorders workflows in target folder', () => {
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'f1', folderOrder: 0 }),
      makeWorkflow({ id: 'w2', folderId: 'f1', folderOrder: 1 }),
      makeWorkflow({ id: 'w3', folderOrder: 0 }),
    ];
    const result = moveWorkflow('w3', 'f1', 0, workflows);
    const inFolder = result
      .filter((w) => w.folderId === 'f1')
      .sort((a, b) => (a.folderOrder ?? 0) - (b.folderOrder ?? 0));
    expect(inFolder.map((w) => w.id)).toEqual(['w3', 'w1', 'w2']);
  });

  it('returns unchanged array for non-existent workflow', () => {
    const workflows = [makeWorkflow({ id: 'w1' })];
    expect(moveWorkflow('nope', null, 0, workflows)).toBe(workflows);
  });

  it('clamps target order when it exceeds sibling count', () => {
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'f1', folderOrder: 0 }),
      makeWorkflow({ id: 'w2', folderId: 'f1', folderOrder: 1 }),
      makeWorkflow({ id: 'w3', folderOrder: 0 }),
    ];
    const result = moveWorkflow('w3', 'f1', 999, workflows);
    const inFolder = result
      .filter((w) => w.folderId === 'f1')
      .sort((a, b) => (a.folderOrder ?? 0) - (b.folderOrder ?? 0));
    expect(inFolder.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
  });
});

// ── Additional branch coverage ──────────────────────

describe('branch coverage', () => {
  it('flattenFoldersForRunner sorts unfiled workflows by folderOrder with undefined values', () => {
    const folders = [makeFolder({ id: 'f1', name: 'Folder', order: 0 })];
    const workflows = [
      makeWorkflow({ id: 'w1', folderOrder: 2 }),
      makeWorkflow({ id: 'w2' }),
      makeWorkflow({ id: 'w3', folderOrder: 1 }),
    ];
    const groups = flattenFoldersForRunner(folders, workflows);
    expect(groups).toHaveLength(1);
    expect(groups[0].path).toBe('Unfiled');
    expect(groups[0].workflows[0].id).toBe('w2');
    expect(groups[0].workflows[1].id).toBe('w3');
    expect(groups[0].workflows[2].id).toBe('w1');
  });

  it('flattenFoldersForRunner sorts folder workflows by folderOrder with undefined values', () => {
    const folders = [makeFolder({ id: 'f1', name: 'Folder', order: 0 })];
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'f1', folderOrder: 2 }),
      makeWorkflow({ id: 'w2', folderId: 'f1' }),
      makeWorkflow({ id: 'w3', folderId: 'f1', folderOrder: 1 }),
    ];
    const groups = flattenFoldersForRunner(folders, workflows);
    expect(groups).toHaveLength(1);
    expect(groups[0].workflows[0].id).toBe('w2');
    expect(groups[0].workflows[1].id).toBe('w3');
    expect(groups[0].workflows[2].id).toBe('w1');
  });

  it('buildFolderTree handles workflows with folderId pointing to a valid folder and undefined folderOrder', () => {
    const folders = [makeFolder({ id: 'f1', order: 0 })];
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'f1' }),
      makeWorkflow({ id: 'w2', folderId: 'f1', folderOrder: 0 }),
    ];
    const tree = buildFolderTree(folders, workflows);
    expect(tree[0].workflows).toHaveLength(2);
    expect(tree[0].workflows[0].id).toBe('w1');
  });

  it('buildFolderTree ignores workflows with folderId pointing to nonexistent folder', () => {
    const folders = [makeFolder({ id: 'f1', order: 0 })];
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'missing' }),
    ];
    const tree = buildFolderTree(folders, workflows);
    expect(tree[0].workflows).toHaveLength(0);
  });

  it('getUnfiledWorkflows sorts by folderOrder with undefined defaults', () => {
    const folders = [makeFolder({ id: 'f1', order: 0 })];
    const workflows = [
      makeWorkflow({ id: 'w1', folderOrder: 5 }),
      makeWorkflow({ id: 'w2' }),
    ];
    const unfiled = getUnfiledWorkflows(folders, workflows);
    expect(unfiled[0].id).toBe('w2');
    expect(unfiled[1].id).toBe('w1');
  });

  it('moveFolder clamps order when exceeding siblings', () => {
    const folders = [
      makeFolder({ id: 'a', order: 0 }),
      makeFolder({ id: 'b', order: 1 }),
    ];
    const result = moveFolder('a', null, 999, folders);
    const orders = result.sort((a, b) => a.order - b.order).map((f) => f.id);
    expect(orders).toEqual(['b', 'a']);
  });

  it('moveWorkflow clamps negative target order to 0', () => {
    const workflows = [
      makeWorkflow({ id: 'w1', folderId: 'f1', folderOrder: 0 }),
      makeWorkflow({ id: 'w2', folderId: 'f1', folderOrder: 1 }),
    ];
    const result = moveWorkflow('w2', 'f1', -5, workflows);
    const inFolder = result
      .filter((w) => w.folderId === 'f1')
      .sort((a, b) => (a.folderOrder ?? 0) - (b.folderOrder ?? 0));
    expect(inFolder[0].id).toBe('w2');
    expect(inFolder[1].id).toBe('w1');
  });

  it('moveFolder with self as target parent is blocked', () => {
    const folders = [makeFolder({ id: 'a', order: 0 })];
    const result = moveFolder('a', 'a', 0, folders);
    expect(result.find((f) => f.id === 'a')?.parentId).toBeUndefined();
  });

  it('flattenFoldersForRunner handles no unfiled workflows', () => {
    const folders = [makeFolder({ id: 'f1', name: 'Folder', order: 0 })];
    const workflows = [makeWorkflow({ id: 'w1', folderId: 'f1', folderOrder: 0 })];
    const groups = flattenFoldersForRunner(folders, workflows);
    expect(groups).toHaveLength(1);
    expect(groups[0].path).toBe('Folder');
    expect(groups.find((g) => g.path === 'Unfiled')).toBeUndefined();
  });
});
