/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSubtreeActions, prepareSubtreeDropPlanPure } from './useBulkSubtreeActions';
import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import type { Mapping } from '../types';
import * as subtreeMapping from '../utils/subtreeMapping';

const srcTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    { key: 'name', path: 'name', type: 'string', value: 'Alice', children: [] },
    { key: 'age', path: 'age', type: 'number', value: 30, children: [] },
  ],
};

const tgtTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    { key: 'name', path: 'name', type: 'string', value: '', children: [] },
    { key: 'age', path: 'age', type: 'number', value: 0, children: [] },
  ],
};

/** root → user → name, age — matching leaf names under shared prefix */
const nestedSrcTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    {
      key: 'user',
      path: 'user',
      type: 'object',
      value: undefined,
      children: [
        { key: 'name', path: 'user.name', type: 'string', value: 'Bob', children: [] },
        { key: 'age', path: 'user.age', type: 'number', value: 40, children: [] },
      ],
    },
  ],
};

const nestedTgtTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    {
      key: 'user',
      path: 'user',
      type: 'object',
      value: undefined,
      children: [
        { key: 'name', path: 'user.name', type: 'string', value: '', children: [] },
        { key: 'age', path: 'user.age', type: 'number', value: 0, children: [] },
      ],
    },
  ],
};

function arrayItemNode(idx: number, name: string, age: number): JsonTreeNode {
  const base = `items[${idx}]`;
  return {
    key: `[${idx}]`,
    path: base,
    type: 'object',
    value: undefined,
    children: [
      { key: 'name', path: `${base}.name`, type: 'string', value: name, children: [] },
      { key: 'age', path: `${base}.age`, type: 'number', value: age, children: [] },
    ],
  };
}

const arraySrcTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    {
      key: 'items',
      path: 'items',
      type: 'array',
      value: undefined,
      children: [
        arrayItemNode(0, 'a', 1),
        arrayItemNode(1, 'b', 2),
      ],
    },
  ],
};

const arrayTgtTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    {
      key: 'items',
      path: 'items',
      type: 'array',
      value: undefined,
      children: [
        arrayItemNode(0, '', 0),
        arrayItemNode(1, '', 0),
      ],
    },
  ],
};

/** Same shape under `conflict/` but incompatible leaf keys → buildRelativePairs returns [] */
const mismatchSrcTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    {
      key: 'conflict',
      path: 'conflict',
      type: 'object',
      value: undefined,
      children: [
        { key: 'foo', path: 'conflict.foo', type: 'string', value: 'x', children: [] },
        { key: 'bar', path: 'conflict.bar', type: 'string', value: 'y', children: [] },
      ],
    },
  ],
};

const mismatchTgtTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    {
      key: 'conflict',
      path: 'conflict',
      type: 'object',
      value: undefined,
      children: [
        { key: 'baz', path: 'conflict.baz', type: 'string', value: '', children: [] },
        { key: 'qux', path: 'conflict.qux', type: 'string', value: '', children: [] },
      ],
    },
  ],
};

function singleLeafArrayItem(idx: number, leafKey: string): JsonTreeNode {
  const base = `items[${idx}]`;
  return {
    key: `[${idx}]`,
    path: base,
    type: 'object',
    value: undefined,
    children: [
      {
        key: leafKey,
        path: `${base}.${leafKey}`,
        type: 'string',
        value: '',
        children: [],
      },
    ],
  };
}

/** items[0].foo vs items[0].bar — expansion matches array parent but no shared relative leaf keys */
const arrayLeafMismatchSrcTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    {
      key: 'items',
      path: 'items',
      type: 'array',
      value: undefined,
      children: [singleLeafArrayItem(0, 'foo'), singleLeafArrayItem(1, 'foo')],
    },
  ],
};

const arrayLeafMismatchTgtTree: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    {
      key: 'items',
      path: 'items',
      type: 'array',
      value: undefined,
      children: [singleLeafArrayItem(0, 'bar'), singleLeafArrayItem(1, 'bar')],
    },
  ],
};

describe('prepareSubtreeDropPlanPure', () => {
  it('returns empty pairs for null source tree', () => {
    const result = prepareSubtreeDropPlanPure(null, tgtTree, '', '');
    expect(result.pairs).toHaveLength(0);
  });

  it('returns empty pairs for null target tree', () => {
    const result = prepareSubtreeDropPlanPure(srcTree, null, '', '');
    expect(result.pairs).toHaveLength(0);
  });

  it('returns leaf pairs for root-to-root mapping', () => {
    const result = prepareSubtreeDropPlanPure(srcTree, tgtTree, '', '');
    expect(result.pairs.length).toBeGreaterThan(0);
    expect(result.pairs.some((p) => p.targetPath === 'name')).toBe(true);
  });

  it('returns no pairs when source path not found', () => {
    const result = prepareSubtreeDropPlanPure(srcTree, tgtTree, 'nonexistent', '');
    expect(result.pairs).toHaveLength(0);
  });

  it('detects canExpandAcrossSiblings when paths are not inside arrays', () => {
    const result = prepareSubtreeDropPlanPure(srcTree, tgtTree, 'name', 'name');
    expect(result.canExpandAcrossSiblings).toBe(false);
    expect(result.pairs).toHaveLength(1);
  });

  it('expands array sibling pairs when flags enabled', () => {
    const plan = prepareSubtreeDropPlanPure(arraySrcTree, arrayTgtTree, 'items[0]', 'items[0]', {
      expandArraySiblings: true,
    });
    expect(plan.usedArraySiblingExpansion).toBe(true);
    expect(plan.canExpandAcrossSiblings).toBe(true);
    expect(plan.pairs.length).toBeGreaterThanOrEqual(2);
    expect(plan.pairs.some((p) => p.targetPath === 'items[0].name')).toBe(true);
    expect(plan.pairs.some((p) => p.targetPath === 'items[1].name')).toBe(true);
  });

  it('returns nested leaf pairs under shared user subtree', () => {
    const result = prepareSubtreeDropPlanPure(nestedSrcTree, nestedTgtTree, 'user', 'user');
    expect(result.pairs.map((p) => p.targetPath).sort()).toEqual(['user.age', 'user.name']);
  });
});

describe('useBulkSubtreeActions', () => {
  function setup(overrides = {}) {
    const setMappings = vi.fn();
    const setToast = vi.fn();
    const suggestDropExpression = vi.fn().mockReturnValue(undefined);

    const params = {
      bulkSourcePath: null as string | null,
      bulkSourceId: null as string | null,
      bulkTargetPath: null as string | null,
      sourceTree: srcTree,
      targetTree: tgtTree,
      mappings: [] as Mapping[],
      suggestDropExpression,
      setMappings,
      setToast,
      ...overrides,
    };

    const result = renderHook(() => useBulkSubtreeActions(params));
    return { ...result, mocks: { setMappings, setToast, suggestDropExpression } };
  }

  it('handleMapSubtree toasts when no selection', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleMapSubtree());
    expect(mocks.setToast).toHaveBeenCalledWith('Select source and target nodes first');
  });

  it('handleMapSubtree toasts when no matching fields under subtree', () => {
    const { result, mocks } = setup({
      bulkSourcePath: 'conflict',
      bulkSourceId: 's1',
      bulkTargetPath: 'conflict',
      sourceTree: mismatchSrcTree,
      targetTree: mismatchTgtTree,
    });
    act(() => result.current.handleMapSubtree());
    expect(mocks.setToast).toHaveBeenCalledWith('No matching child fields found for selected subtree');
  });

  it('handleMapSiblingSubtrees toasts when no selection', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleMapSiblingSubtrees());
    expect(mocks.setToast).toHaveBeenCalledWith('Select source and target nodes first');
  });

  it('handleClearTargetSubtree toasts when no target', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleClearTargetSubtree());
    expect(mocks.setToast).toHaveBeenCalledWith('Select a target node to clear');
  });

  it('handleMapSubtree inserts mappings when leaf names align under a shared subtree', () => {
    const { result, mocks } = setup({
      bulkSourcePath: 'user',
      bulkTargetPath: 'user',
      bulkSourceId: 'nested-src',
      sourceTree: nestedSrcTree,
      targetTree: nestedTgtTree,
      mappings: [],
    });
    act(() => result.current.handleMapSubtree());
    expect(mocks.setMappings).toHaveBeenCalledTimes(1);
    const next = mocks.setMappings.mock.calls[0][0] as Mapping[];
    expect(next.map((m) => m.targetPath).sort()).toEqual(['user.age', 'user.name']);
    expect(mocks.setToast).toHaveBeenCalledWith(expect.stringMatching(/^Mapped 2 fields/));
  });

  it('handleMapSubtree reports unchanged when subtree targets already match', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'user.name', sourceId: 'src-a', targetPath: 'user.name' },
      { id: 'm2', sourcePath: 'user.age', sourceId: 'src-a', targetPath: 'user.age' },
    ];
    const { result, mocks } = setup({
      bulkSourcePath: 'user',
      bulkTargetPath: 'user',
      bulkSourceId: 'src-a',
      mappings,
      sourceTree: nestedSrcTree,
      targetTree: nestedTgtTree,
    });
    act(() => result.current.handleMapSubtree());
    expect(mocks.setMappings).not.toHaveBeenCalled();
    expect(mocks.setToast).toHaveBeenCalledWith('No changes - matching targets already mapped');
  });

  it('handleMapSiblingSubtrees toasts when selection is not under parallel array indices', () => {
    const { result, mocks } = setup({
      bulkSourcePath: 'user',
      bulkTargetPath: 'user',
      bulkSourceId: 'nested-src',
      sourceTree: nestedSrcTree,
      targetTree: nestedTgtTree,
      mappings: [],
    });
    act(() => result.current.handleMapSiblingSubtrees());
    expect(mocks.setToast).toHaveBeenCalledWith('Select matching array index nodes to map siblings');
  });

  it('handleMapSiblingSubtrees toasts when expansion finds no sibling field alignment', () => {
    const { result, mocks } = setup({
      bulkSourcePath: 'items[0]',
      bulkTargetPath: 'items[0]',
      bulkSourceId: 'mis',
      sourceTree: arrayLeafMismatchSrcTree,
      targetTree: arrayLeafMismatchTgtTree,
      mappings: [],
    });
    act(() => result.current.handleMapSiblingSubtrees());
    expect(mocks.setToast).toHaveBeenCalledWith('No matching sibling fields found');
  });

  it('handleMapSiblingSubtrees maps across array siblings when expansion applies', () => {
    const { result, mocks } = setup({
      bulkSourcePath: 'items[0]',
      bulkTargetPath: 'items[0]',
      bulkSourceId: 'arr-src',
      sourceTree: arraySrcTree,
      targetTree: arrayTgtTree,
      mappings: [],
    });
    act(() => result.current.handleMapSiblingSubtrees());
    expect(mocks.setMappings).toHaveBeenCalledTimes(1);
    expect(mocks.setToast).toHaveBeenCalledWith(expect.stringContaining('array siblings'));
  });

  it('handleMapSiblingSubtrees reports unchanged when sibling pairs already mapped', () => {
    const plan = prepareSubtreeDropPlanPure(arraySrcTree, arrayTgtTree, 'items[0]', 'items[0]', {
      expandArraySiblings: true,
    });
    const mappings: Mapping[] = plan.pairs.map((pair, i) => ({
      id: `pre-${i}`,
      sourcePath: pair.sourcePath,
      sourceId: 'arr-src',
      targetPath: pair.targetPath,
    }));
    const { result, mocks } = setup({
      bulkSourcePath: 'items[0]',
      bulkTargetPath: 'items[0]',
      bulkSourceId: 'arr-src',
      sourceTree: arraySrcTree,
      targetTree: arrayTgtTree,
      mappings,
    });
    act(() => result.current.handleMapSiblingSubtrees());
    expect(mocks.setMappings).not.toHaveBeenCalled();
    expect(mocks.setToast).toHaveBeenCalledWith('No changes - matching targets already mapped');
  });

  it('handleClearTargetSubtree toasts when subtree has no mappings', () => {
    const { result, mocks } = setup({
      bulkTargetPath: 'name',
      mappings: [{ id: 'x', sourcePath: 'z', sourceId: 's', targetPath: 'other.leaf' }],
    });
    act(() => result.current.handleClearTargetSubtree());
    expect(mocks.setMappings).not.toHaveBeenCalled();
    expect(mocks.setToast).toHaveBeenCalledWith('No mappings found in selected target subtree');
  });

  it('handleClearTargetSubtree clears matching mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'name' },
      { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'age' },
    ];
    const { result, mocks } = setup({
      bulkTargetPath: 'name',
      mappings,
    });
    act(() => result.current.handleClearTargetSubtree());
    expect(mocks.setMappings).toHaveBeenCalledWith([mappings[1]]);
  });

  it('handleReplaceTargetSubtree toasts when no selection', () => {
    const { result, mocks } = setup();
    act(() => result.current.handleReplaceTargetSubtree());
    expect(mocks.setToast).toHaveBeenCalledWith('Select source and target nodes first');
  });

  it('handleReplaceTargetSubtree toasts when no matching fields', () => {
    const { result, mocks } = setup({
      bulkSourcePath: 'conflict',
      bulkSourceId: 's1',
      bulkTargetPath: 'conflict',
      sourceTree: mismatchSrcTree,
      targetTree: mismatchTgtTree,
      mappings: [],
    });
    act(() => result.current.handleReplaceTargetSubtree());
    expect(mocks.setToast).toHaveBeenCalledWith('No matching child fields found for selected subtree');
  });

  it('handleReplaceTargetSubtree clears subtree mappings then inserts aligned pairs', () => {
    const { result, mocks } = setup({
      bulkSourcePath: 'user',
      bulkTargetPath: 'user',
      bulkSourceId: 's-replace',
      sourceTree: nestedSrcTree,
      targetTree: nestedTgtTree,
      mappings: [{ id: 'old', sourcePath: 'gone', sourceId: 'other', targetPath: 'user.name' }],
    });
    act(() => result.current.handleReplaceTargetSubtree());
    expect(mocks.setMappings).toHaveBeenCalledTimes(1);
    expect(mocks.setToast).toHaveBeenCalledWith(expect.stringContaining('Replaced subtree'));
    const next = mocks.setMappings.mock.calls[0][0] as Mapping[];
    expect(next.map((m) => m.targetPath).sort()).toEqual(['user.age', 'user.name']);
  });

  it('handleReplaceTargetSubtree toasts when drop pairs yield no deltas', () => {
    const spy = vi.spyOn(subtreeMapping, 'applyDropPairs').mockReturnValue({
      nextMappings: [],
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 2,
    });
    try {
      const { result, mocks } = setup({
        bulkSourcePath: 'user',
        bulkTargetPath: 'user',
        bulkSourceId: 'noop',
        sourceTree: nestedSrcTree,
        targetTree: nestedTgtTree,
      });
      act(() => result.current.handleReplaceTargetSubtree());
      expect(mocks.setToast).toHaveBeenCalledWith('No changes - selected subtree already matches');
      expect(mocks.setMappings).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('prepareSubtreeDropPlan is callable', () => {
    const { result } = setup();
    const plan = result.current.prepareSubtreeDropPlan('', '');
    expect(plan).toHaveProperty('pairs');
    expect(plan).toHaveProperty('canExpandAcrossSiblings');
  });
});
