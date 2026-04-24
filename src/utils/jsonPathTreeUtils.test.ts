import { describe, it, expect } from 'vitest';
import {
  buildTree,
  getAllLeafPaths,
  getAllPaths,
  nodeMatchesSearch,
  suggestedVariableNameFromJsonPath,
  type JsonNode,
} from './jsonPathTreeUtils';

// ---------------------------------------------------------------------------
// buildTree
// ---------------------------------------------------------------------------
describe('buildTree', () => {
  it('handles null', () => {
    const node = buildTree(null, '', 'root');
    expect(node.type).toBe('null');
    expect(node.value).toBeNull();
  });

  it('handles undefined', () => {
    const node = buildTree(undefined, '', 'root');
    expect(node.type).toBe('null');
  });

  it('handles a string primitive', () => {
    const node = buildTree('hello', 'name', 'name');
    expect(node.type).toBe('string');
    expect(node.value).toBe('hello');
    expect(node.children).toBeUndefined();
  });

  it('handles a number primitive', () => {
    const node = buildTree(42, 'count', 'count');
    expect(node.type).toBe('number');
    expect(node.value).toBe(42);
  });

  it('handles a boolean primitive', () => {
    const node = buildTree(true, 'active', 'active');
    expect(node.type).toBe('boolean');
  });

  it('builds an object tree with correct paths', () => {
    const node = buildTree({ name: 'Alice', age: 30 }, '', '$');
    expect(node.type).toBe('object');
    expect(node.children?.length).toBe(2);
    expect(node.children![0].path).toBe('name');
    expect(node.children![0].type).toBe('string');
    expect(node.children![1].path).toBe('age');
    expect(node.children![1].type).toBe('number');
  });

  it('builds nested object paths', () => {
    const node = buildTree({ data: { id: 1 } }, '', '$');
    const dataChild = node.children![0];
    expect(dataChild.path).toBe('data');
    expect(dataChild.children![0].path).toBe('data.id');
  });

  it('builds an array tree with index paths', () => {
    const node = buildTree([10, 20, 30], '', '$');
    expect(node.type).toBe('array');
    expect(node.children?.length).toBe(3);
    expect(node.children![0].path).toBe('[0]');
    expect(node.children![0].key).toBe('[0]');
    expect(node.children![2].value).toBe(30);
  });

  it('builds nested array paths', () => {
    const node = buildTree({ items: [{ id: 1 }] }, '', '$');
    const items = node.children![0];
    expect(items.path).toBe('items');
    expect(items.children![0].path).toBe('items[0]');
    expect(items.children![0].children![0].path).toBe('items[0].id');
  });

  it('handles complex nested structure', () => {
    const data = {
      users: [
        { name: 'Alice', roles: ['admin', 'user'] },
        { name: 'Bob', roles: ['user'] },
      ],
    };
    const tree = buildTree(data, '', '$');
    const users = tree.children![0];
    expect(users.children!.length).toBe(2);
    const alice = users.children![0];
    expect(alice.children![1].path).toBe('users[0].roles');
    expect(alice.children![1].children![0].path).toBe('users[0].roles[0]');
  });
});

// ---------------------------------------------------------------------------
// getAllLeafPaths
// ---------------------------------------------------------------------------
describe('getAllLeafPaths', () => {
  it('returns the path for a leaf node', () => {
    const leaf: JsonNode = { key: 'name', path: 'data.name', value: 'Alice', type: 'string' };
    expect(getAllLeafPaths(leaf)).toEqual(['data.name']);
  });

  it('returns all leaf paths for a tree', () => {
    const tree = buildTree({ a: 1, b: { c: 2, d: 3 } }, '', '$');
    const paths = getAllLeafPaths(tree);
    expect(paths).toContain('a');
    expect(paths).toContain('b.c');
    expect(paths).toContain('b.d');
    expect(paths).not.toContain('b');
  });

  it('returns array element paths as leaves', () => {
    const tree = buildTree([10, 20], '', '$');
    expect(getAllLeafPaths(tree)).toEqual(['[0]', '[1]']);
  });

  it('handles deeply nested structures', () => {
    const tree = buildTree({ data: { items: [{ id: 1 }] } }, '', '$');
    const paths = getAllLeafPaths(tree);
    expect(paths).toContain('data.items[0].id');
    expect(paths).not.toContain('data');
    expect(paths).not.toContain('data.items');
  });
});

// ---------------------------------------------------------------------------
// getAllPaths
// ---------------------------------------------------------------------------
describe('getAllPaths', () => {
  it('returns all paths including intermediate nodes', () => {
    const tree = buildTree({ a: { b: 1 } }, '', '');
    const paths = getAllPaths(tree);
    expect(paths).toContain('a');
    expect(paths).toContain('a.b');
  });

  it('filters empty root path', () => {
    const tree = buildTree({ x: 1 }, '', '');
    const paths = getAllPaths(tree);
    expect(paths).not.toContain('');
  });
});

// ---------------------------------------------------------------------------
// nodeMatchesSearch
// ---------------------------------------------------------------------------
describe('nodeMatchesSearch', () => {
  const tree = buildTree(
    { name: 'Alice', address: { city: 'NYC', zip: '10001' } },
    '', '$'
  );

  it('returns true for empty search term', () => {
    expect(nodeMatchesSearch(tree, '')).toBe(true);
  });

  it('matches by key name', () => {
    const nameChild = tree.children![0];
    expect(nodeMatchesSearch(nameChild, 'name')).toBe(true);
  });

  it('matches by value', () => {
    const nameChild = tree.children![0];
    expect(nodeMatchesSearch(nameChild, 'Alice')).toBe(true);
  });

  it('matches case-insensitively', () => {
    const nameChild = tree.children![0];
    expect(nodeMatchesSearch(nameChild, 'alice')).toBe(true);
  });

  it('matches by path', () => {
    const zipNode = tree.children![1].children![1];
    expect(nodeMatchesSearch(zipNode, 'address.zip')).toBe(true);
  });

  it('matches parent if any child matches', () => {
    expect(nodeMatchesSearch(tree, '10001')).toBe(true);
  });

  it('returns false for non-matching term', () => {
    expect(nodeMatchesSearch(tree, 'nonexistent')).toBe(false);
  });

  it('does not search object/array values as text', () => {
    expect(nodeMatchesSearch(tree, '[object')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// suggestedVariableNameFromJsonPath
// ---------------------------------------------------------------------------
describe('suggestedVariableNameFromJsonPath', () => {
  it('returns leaf key for dotted path', () => {
    expect(suggestedVariableNameFromJsonPath('$.publication.body.country')).toBe('country');
  });

  it('handles optional $ prefix and whitespace', () => {
    expect(suggestedVariableNameFromJsonPath(' publication.body.country ')).toBe('country');
  });

  it('returns last segment after array index', () => {
    expect(suggestedVariableNameFromJsonPath('$.items[0].id')).toBe('id');
  });

  it('returns wildcard segment stripped from last segment only', () => {
    expect(suggestedVariableNameFromJsonPath('$.items[*].code')).toBe('code');
  });

  it('returns single segment without dots', () => {
    expect(suggestedVariableNameFromJsonPath('$.status')).toBe('status');
  });

  it('strips trailing index on sole segment', () => {
    expect(suggestedVariableNameFromJsonPath('$.arr[0]')).toBe('arr');
  });

  it('returns null for unusable last segment', () => {
    expect(suggestedVariableNameFromJsonPath('$.[0]')).toBe(null);
  });

  it('returns null for bare $ path', () => {
    expect(suggestedVariableNameFromJsonPath('$')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(suggestedVariableNameFromJsonPath('')).toBeNull();
  });
});

describe('nodeMatchesSearch — additional branches', () => {
  it('matches node with undefined key by value', () => {
    const node: JsonNode = { key: undefined as unknown as string, path: '', type: 'string', value: 'hello' };
    expect(nodeMatchesSearch(node, 'hello')).toBe(true);
  });

  it('handles node with null value gracefully in search', () => {
    const node: JsonNode = { key: 'k', path: '$.k', type: 'number', value: undefined };
    // value is undefined, so (value ?? '') becomes '' — search by key instead
    expect(nodeMatchesSearch(node, 'k')).toBe(true);
    // The value path is entered (type !== 'object' && !== 'array') but '' won't match
    expect(nodeMatchesSearch(node, 'something')).toBe(false);
  });
});
