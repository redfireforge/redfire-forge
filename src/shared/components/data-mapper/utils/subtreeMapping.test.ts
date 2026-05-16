import { describe, it, expect } from 'vitest';
import {
  findNodeByPath,
  collectLeafPathsFromNode,
  getRelativeSubpath,
  getArrayParentPath,
  buildRelativePairs,
  applyDropPairs,
  buildDropSummary,
  buildRepairIssueId,
} from './subtreeMapping';
import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import type { Mapping } from '../types';

const leaf = (path: string, type = 'string'): JsonTreeNode => ({
  path,
  key: path.split('.').pop() || path,
  type: type as JsonTreeNode['type'],
});

const obj = (path: string, children: JsonTreeNode[]): JsonTreeNode => ({
  path,
  key: path.split('.').pop() || path,
  type: 'object',
  children,
});

describe('findNodeByPath', () => {
  const tree = obj('', [
    obj('user', [leaf('user.name'), leaf('user.email')]),
    leaf('id'),
  ]);

  it('finds root node', () => {
    expect(findNodeByPath(tree, '')).toBe(tree);
  });

  it('finds nested node', () => {
    const found = findNodeByPath(tree, 'user.name');
    expect(found?.path).toBe('user.name');
  });

  it('finds intermediate object node', () => {
    const found = findNodeByPath(tree, 'user');
    expect(found?.path).toBe('user');
  });

  it('returns null for nonexistent path', () => {
    expect(findNodeByPath(tree, 'nonexistent')).toBeNull();
  });
});

describe('collectLeafPathsFromNode', () => {
  it('returns path for leaf node', () => {
    expect(collectLeafPathsFromNode(leaf('name'))).toEqual(['name']);
  });

  it('returns empty for root-like node with no path and no children', () => {
    expect(collectLeafPathsFromNode({ path: '', key: '', type: 'object' })).toEqual([]);
  });

  it('collects all leaves recursively', () => {
    const tree = obj('', [
      obj('user', [leaf('user.name'), leaf('user.email')]),
      leaf('id'),
    ]);
    const paths = collectLeafPathsFromNode(tree);
    expect(paths).toEqual(['user.name', 'user.email', 'id']);
  });
});

describe('getRelativeSubpath', () => {
  it('returns relative path for nested paths (includes leading dot)', () => {
    expect(getRelativeSubpath('user.name', 'user')).toBe('.name');
  });

  it('returns null when not within parent', () => {
    expect(getRelativeSubpath('other.name', 'user')).toBeNull();
  });

  it('returns empty string when paths match', () => {
    expect(getRelativeSubpath('user', 'user')).toBe('');
  });
});

describe('getArrayParentPath', () => {
  it('extracts parent for array-indexed path', () => {
    expect(getArrayParentPath('items[0]')).toBe('items');
  });

  it('handles nested array paths', () => {
    expect(getArrayParentPath('data.items[2]')).toBe('data.items');
  });

  it('returns null for non-array paths', () => {
    expect(getArrayParentPath('items.name')).toBeNull();
  });
});

describe('buildRelativePairs', () => {
  it('pairs leaves by relative path', () => {
    const sourceLeaves = ['src.name', 'src.email'];
    const targetLeaves = ['tgt.name', 'tgt.email'];
    const pairs = buildRelativePairs(sourceLeaves, targetLeaves, 'src', 'tgt');
    expect(pairs).toEqual([
      { sourcePath: 'src.email', targetPath: 'tgt.email' },
      { sourcePath: 'src.name', targetPath: 'tgt.name' },
    ]);
  });

  it('skips unmatched leaves', () => {
    const sourceLeaves = ['src.name', 'src.extra'];
    const targetLeaves = ['tgt.name'];
    const pairs = buildRelativePairs(sourceLeaves, targetLeaves, 'src', 'tgt');
    expect(pairs).toEqual([{ sourcePath: 'src.name', targetPath: 'tgt.name' }]);
  });

  it('returns empty for no matches', () => {
    const pairs = buildRelativePairs(['a.x'], ['b.y'], 'a', 'b');
    expect(pairs).toEqual([]);
  });
});

describe('applyDropPairs', () => {
  const noExpr = () => undefined;

  it('inserts new mappings', () => {
    const pairs = [{ sourcePath: 'name', targetPath: 'userName' }];
    const result = applyDropPairs([], pairs, 's1', noExpr);
    expect(result.insertedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(result.nextMappings).toHaveLength(1);
    expect(result.nextMappings[0].sourcePath).toBe('name');
  });

  it('counts updates when target already mapped', () => {
    const existing: Mapping[] = [
      { id: 'm1', sourcePath: 'old', sourceId: 's1', targetPath: 'userName' },
    ];
    const pairs = [{ sourcePath: 'name', targetPath: 'userName' }];
    const result = applyDropPairs(existing, pairs, 's1', noExpr);
    expect(result.updatedCount).toBe(1);
    expect(result.insertedCount).toBe(0);
  });

  it('applies suggested expression', () => {
    const suggest = () => 'Number($)';
    const pairs = [{ sourcePath: 'age', targetPath: 'userAge' }];
    const result = applyDropPairs([], pairs, 's1', suggest);
    expect(result.nextMappings[0].expression).toBe('Number($)');
  });
});

describe('buildDropSummary', () => {
  it('produces summary for single new field', () => {
    expect(buildDropSummary(1, 1, 0)).toBe('Mapped 1 field (1 new)');
  });

  it('produces summary for multiple with mix', () => {
    expect(buildDropSummary(3, 2, 1)).toBe('Mapped 3 fields (2 new, 1 updated)');
  });

  it('includes scope suffix', () => {
    expect(buildDropSummary(2, 2, 0, { scopeSuffix: 'in subtree' })).toBe('Mapped 2 fields (2 new) in subtree');
  });

  it('produces summary with no details', () => {
    expect(buildDropSummary(0, 0, 0)).toBe('Mapped 0 fields');
  });
});

describe('buildRepairIssueId', () => {
  it('creates deterministic id from kind, mapping id, and paths', () => {
    const id = buildRepairIssueId('missing-target', 'm1', 'data.name', 'user.name');
    expect(id).toBe('missing-target:m1:data.name:user.name');
  });
});
