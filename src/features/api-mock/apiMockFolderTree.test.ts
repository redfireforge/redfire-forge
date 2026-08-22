import { describe, expect, it } from 'vitest';
import {
  buildFolderTree,
  childFolderNames,
  collectFolderPaths,
  folderAncestors,
  folderLeafName,
  folderParentPath,
  folderSegments,
  isSameOrDescendant,
  joinFolderPath,
  moveFolderPaths,
  pathAfterDeletingFolder,
  renameFolderPaths,
} from './apiMockFolderTree';

describe('apiMockFolderTree path helpers', () => {
  it('splits, names, and finds parents', () => {
    expect(folderSegments('A/B/C')).toEqual(['A', 'B', 'C']);
    expect(folderLeafName('A/B/C')).toBe('C');
    expect(folderLeafName('Solo')).toBe('Solo');
    expect(folderParentPath('A/B/C')).toBe('A/B');
    expect(folderParentPath('A')).toBeUndefined();
  });

  it('joins parent + name and lists ancestors', () => {
    expect(joinFolderPath(undefined, 'A')).toBe('A');
    expect(joinFolderPath('A/B', ' C ')).toBe('A/B/C');
    expect(folderAncestors('A/B/C')).toEqual(['A', 'A/B', 'A/B/C']);
  });

  it('detects same-or-descendant relationships', () => {
    expect(isSameOrDescendant('A/B', 'A')).toBe(true);
    expect(isSameOrDescendant('A', 'A')).toBe(true);
    expect(isSameOrDescendant('AB', 'A')).toBe(false);
    expect(isSameOrDescendant('A', 'A/B')).toBe(false);
  });

  it('collects ancestor prefixes from server + empty folders', () => {
    const paths = collectFolderPaths(['A/B/C', undefined, 'X'], ['Y/Z']);
    expect([...paths].sort()).toEqual(['A', 'A/B', 'A/B/C', 'X', 'Y', 'Y/Z']);
  });
});

describe('buildFolderTree', () => {
  it('nests folders and orders by preferred order then alpha', () => {
    const paths = collectFolderPaths(['Zeta', 'Alpha/Two', 'Alpha/One'], ['Alpha']);
    const tree = buildFolderTree(paths, ['Alpha', 'Zeta']);
    expect(tree.map(n => n.path)).toEqual(['Alpha', 'Zeta']);
    const alpha = tree[0];
    expect(alpha.depth).toBe(0);
    // children fall back to alpha order (One before Two)
    expect(alpha.children.map(n => n.name)).toEqual(['One', 'Two']);
    expect(alpha.children[0].depth).toBe(1);
  });

  it('lists direct child folder names', () => {
    const paths = collectFolderPaths(['A/B', 'A/C', 'A/B/D'], []);
    expect(childFolderNames(paths, 'A').sort()).toEqual(['B', 'C']);
    expect(childFolderNames(paths, 'A/B')).toEqual(['D']);
    expect(childFolderNames(paths, undefined)).toEqual(['A']);
  });
});

describe('renameFolderPaths', () => {
  it('remaps the folder and all descendants', () => {
    const paths = ['A', 'A/B', 'A/B/C', 'Other'];
    const remap = renameFolderPaths('A/B', 'BB', paths)!;
    expect(remap.get('A/B')).toBe('A/BB');
    expect(remap.get('A/B/C')).toBe('A/BB/C');
    expect(remap.has('A')).toBe(false);
    expect(remap.has('Other')).toBe(false);
  });

  it('returns null for empty or unchanged names', () => {
    expect(renameFolderPaths('A/B', '   ', ['A/B'])).toBeNull();
    expect(renameFolderPaths('A/B', 'B', ['A/B'])).toBeNull();
  });
});

describe('moveFolderPaths', () => {
  it('re-prefixes folder + descendants under a new parent', () => {
    const paths = ['A', 'A/B', 'A/B/C', 'X'];
    const remap = moveFolderPaths('A/B', 'X', paths)!;
    expect(remap.get('A/B')).toBe('X/B');
    expect(remap.get('A/B/C')).toBe('X/B/C');
    expect(remap.has('A')).toBe(false);
  });

  it('moves a folder to top level', () => {
    const remap = moveFolderPaths('A/B', undefined, ['A/B', 'A/B/C'])!;
    expect(remap.get('A/B')).toBe('B');
    expect(remap.get('A/B/C')).toBe('B/C');
  });

  it('rejects moving into itself or a descendant', () => {
    expect(moveFolderPaths('A', 'A', ['A'])).toBeNull();
    expect(moveFolderPaths('A', 'A/B', ['A', 'A/B'])).toBeNull();
  });

  it('returns null when already under the target parent', () => {
    expect(moveFolderPaths('A/B', 'A', ['A', 'A/B'])).toBeNull();
  });
});

describe('pathAfterDeletingFolder', () => {
  it('ungroups servers that lived directly in the deleted folder', () => {
    expect(pathAfterDeletingFolder('Folder 2', 'Folder 2')).toBeUndefined();
  });

  it('promotes subfolders of a top-level folder to the top level', () => {
    expect(pathAfterDeletingFolder('Folder 2/Subfolder1', 'Folder 2')).toBe('Subfolder1');
    expect(pathAfterDeletingFolder('Folder 2/Subfolder1/Deep', 'Folder 2')).toBe('Subfolder1/Deep');
  });

  it('promotes descendants into the remaining parent when a nested folder is deleted', () => {
    expect(pathAfterDeletingFolder('A/B', 'A/B')).toBeUndefined();
    expect(pathAfterDeletingFolder('A/B/C', 'A/B')).toBe('A/C');
    expect(pathAfterDeletingFolder('A/B/C/D', 'A/B')).toBe('A/C/D');
  });

  it('leaves unrelated paths unchanged', () => {
    expect(pathAfterDeletingFolder('Folder 1', 'Folder 2')).toBe('Folder 1');
  });
});
