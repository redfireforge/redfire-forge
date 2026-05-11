import { describe, it, expect } from 'vitest';
import {
  buildJsonTree,
  getAllLeafPaths,
  getAllPaths,
  nodeMatchesSearch,
  suggestedVariableNameFromJsonPath,
} from './jsonTreeModel';
describe('buildJsonTree', () => {
  it('builds a tree from a simple object', () => {
    const tree = buildJsonTree({ name: 'Alice', age: 30 }, 'root', '');
    expect(tree.key).toBe('root');
    expect(tree.type).toBe('object');
    expect(tree.children).toHaveLength(2);
    expect(tree.children![0].key).toBe('name');
    expect(tree.children![0].value).toBe('Alice');
    expect(tree.children![0].type).toBe('string');
    expect(tree.children![0].path).toBe('name');
    expect(tree.children![1].key).toBe('age');
    expect(tree.children![1].value).toBe(30);
    expect(tree.children![1].type).toBe('number');
  });

  it('builds a tree from an array', () => {
    const tree = buildJsonTree([1, 2, 3], 'items', '');
    expect(tree.type).toBe('array');
    expect(tree.children).toHaveLength(3);
    expect(tree.children![0].key).toBe('[0]');
    expect(tree.children![0].value).toBe(1);
    expect(tree.children![0].path).toBe('[0]');
  });

  it('builds a tree from nested objects', () => {
    const tree = buildJsonTree({ user: { address: { city: 'NYC' } } }, '', '');
    expect(tree.children![0].key).toBe('user');
    expect(tree.children![0].path).toBe('user');
    expect(tree.children![0].children![0].key).toBe('address');
    expect(tree.children![0].children![0].path).toBe('user.address');
    expect(tree.children![0].children![0].children![0].key).toBe('city');
    expect(tree.children![0].children![0].children![0].path).toBe('user.address.city');
    expect(tree.children![0].children![0].children![0].value).toBe('NYC');
  });

  it('builds tree with array inside object', () => {
    const tree = buildJsonTree({ items: ['a', 'b'] }, '', '');
    const items = tree.children![0];
    expect(items.path).toBe('items');
    expect(items.children![0].path).toBe('items[0]');
    expect(items.children![1].path).toBe('items[1]');
  });

  it('handles null value', () => {
    const tree = buildJsonTree(null, 'root', '');
    expect(tree.type).toBe('null');
    expect(tree.value).toBeNull();
  });

  it('handles undefined value', () => {
    const tree = buildJsonTree(undefined, 'root', '');
    expect(tree.type).toBe('null');
    expect(tree.value).toBeNull();
  });

  it('handles boolean values', () => {
    const tree = buildJsonTree(true, 'flag', '');
    expect(tree.type).toBe('boolean');
    expect(tree.value).toBe(true);
  });

  it('handles number values', () => {
    const tree = buildJsonTree(42, 'count', '');
    expect(tree.type).toBe('number');
    expect(tree.value).toBe(42);
  });

  it('handles string values', () => {
    const tree = buildJsonTree('hello', 'msg', '');
    expect(tree.type).toBe('string');
    expect(tree.value).toBe('hello');
  });
});

describe('buildJsonTree – truncation options', () => {
  it('truncates arrays with maxArrayItems', () => {
    const tree = buildJsonTree([1, 2, 3, 4, 5], 'items', '', { maxArrayItems: 2 });
    expect(tree.children).toHaveLength(2);
    expect(tree.truncated).toBe(true);
    expect(tree.totalCount).toBe(5);
  });

  it('does not truncate when array fits within limit', () => {
    const tree = buildJsonTree([1, 2], 'items', '', { maxArrayItems: 5 });
    expect(tree.children).toHaveLength(2);
    expect(tree.truncated).toBeUndefined();
  });

  it('truncates at maxDepth for arrays', () => {
    const tree = buildJsonTree({ nested: [[1, 2]] }, '', '', { maxDepth: 1 });
    const nested = tree.children![0];
    expect(nested.type).toBe('array');
    expect(nested.truncated).toBe(true);
    expect(nested.totalCount).toBe(1);
    expect(nested.children).toBeUndefined();
  });

  it('truncates at maxDepth for objects', () => {
    const tree = buildJsonTree({ a: { b: { c: 1 } } }, '', '', { maxDepth: 1 });
    const a = tree.children![0];
    expect(a.type).toBe('object');
    expect(a.truncated).toBe(true);
    expect(a.totalCount).toBe(1);
    expect(a.children).toBeUndefined();
  });
});

describe('buildJsonTree – trackPaths option', () => {
  it('produces empty paths when trackPaths is false', () => {
    const tree = buildJsonTree({ a: { b: 1 } }, '', '', { trackPaths: false });
    expect(tree.path).toBe('');
    expect(tree.children![0].path).toBe('');
    expect(tree.children![0].children![0].path).toBe('');
  });

  it('produces paths by default', () => {
    const tree = buildJsonTree({ a: 1 }, '', '');
    expect(tree.children![0].path).toBe('a');
  });
});

describe('getAllLeafPaths', () => {
  it('returns leaf paths for nested structure', () => {
    const tree = buildJsonTree({ user: { name: 'A', age: 30 }, active: true }, '', '');
    const leaves = getAllLeafPaths(tree);
    expect(leaves).toEqual(['user.name', 'user.age', 'active']);
  });

  it('returns path for single leaf', () => {
    const tree = buildJsonTree('hello', 'root', 'root');
    expect(getAllLeafPaths(tree)).toEqual(['root']);
  });

  it('handles arrays', () => {
    const tree = buildJsonTree({ items: [1, 2] }, '', '');
    const leaves = getAllLeafPaths(tree);
    expect(leaves).toEqual(['items[0]', 'items[1]']);
  });
});

describe('getAllPaths', () => {
  it('returns all paths including intermediate nodes', () => {
    const tree = buildJsonTree({ user: { name: 'A' } }, '', '');
    const paths = getAllPaths(tree);
    expect(paths).toEqual(['user', 'user.name']);
  });
});

describe('nodeMatchesSearch', () => {
  it('matches by key', () => {
    const tree = buildJsonTree({ userName: 'test' }, '', '');
    expect(nodeMatchesSearch(tree.children![0], 'user')).toBe(true);
  });

  it('matches by value', () => {
    const tree = buildJsonTree({ name: 'Alice' }, '', '');
    expect(nodeMatchesSearch(tree.children![0], 'alice')).toBe(true);
  });

  it('matches by path', () => {
    const tree = buildJsonTree({ user: { name: 'A' } }, '', '');
    expect(nodeMatchesSearch(tree.children![0], 'user.name')).toBe(true);
  });

  it('returns true for empty term', () => {
    const tree = buildJsonTree({ a: 1 }, '', '');
    expect(nodeMatchesSearch(tree, '')).toBe(true);
  });

  it('returns false when no match', () => {
    const tree = buildJsonTree({ a: 1 }, '', '');
    expect(nodeMatchesSearch(tree, 'zzzzz')).toBe(false);
  });

  it('does not match object/array raw values against term', () => {
    const tree = buildJsonTree({ items: [1] }, '', '');
    // Array node value is not searched as text, only key/path/children
    expect(nodeMatchesSearch(tree.children![0], '[1]')).toBe(false);
  });

  it('matches array child values', () => {
    const tree = buildJsonTree({ items: [1] }, '', '');
    // The child node [0] has value=1, which matches "1"
    expect(nodeMatchesSearch(tree.children![0], '1')).toBe(true);
  });

  it('matches deeply nested descendants', () => {
    const tree = buildJsonTree({ a: { b: { c: 'deep' } } }, '', '');
    expect(nodeMatchesSearch(tree, 'deep')).toBe(true);
  });
});

describe('suggestedVariableNameFromJsonPath', () => {
  it('extracts last segment', () => {
    expect(suggestedVariableNameFromJsonPath('$.publication.body.country')).toBe('country');
  });

  it('handles simple paths', () => {
    expect(suggestedVariableNameFromJsonPath('name')).toBe('name');
  });

  it('strips trailing array notation', () => {
    expect(suggestedVariableNameFromJsonPath('$.items[0]')).toBe('items');
    expect(suggestedVariableNameFromJsonPath('$.items[*]')).toBe('items');
  });

  it('returns null for empty path', () => {
    expect(suggestedVariableNameFromJsonPath('')).toBeNull();
    expect(suggestedVariableNameFromJsonPath('$')).toBeNull();
  });

  it('returns null for non-identifier last segment', () => {
    expect(suggestedVariableNameFromJsonPath('$.[0]')).toBeNull();
  });

  it('handles $ prefix variations', () => {
    expect(suggestedVariableNameFromJsonPath('$.name')).toBe('name');
    // Single $ is stripped, leaving "name"
    expect(suggestedVariableNameFromJsonPath('$name')).toBe('name');
  });
});

describe('buildJsonTree – complex real-world scenarios', () => {
  it('handles API response with nested arrays of objects', () => {
    const response = {
      data: {
        users: [
          { id: 1, roles: ['admin', 'user'] },
          { id: 2, roles: ['user'] },
        ],
      },
      meta: { total: 2, page: 1 },
    };
    const tree = buildJsonTree(response, '', '');
    expect(tree.type).toBe('object');
    expect(tree.children).toHaveLength(2);

    const data = tree.children![0];
    expect(data.path).toBe('data');
    const users = data.children![0];
    expect(users.path).toBe('data.users');
    expect(users.type).toBe('array');
    expect(users.children).toHaveLength(2);

    const firstUser = users.children![0];
    expect(firstUser.path).toBe('data.users[0]');
    expect(firstUser.children![0].path).toBe('data.users[0].id');
    expect(firstUser.children![1].path).toBe('data.users[0].roles');
    expect(firstUser.children![1].children![0].path).toBe('data.users[0].roles[0]');
  });

  it('handles empty object', () => {
    const tree = buildJsonTree({}, '', '');
    expect(tree.type).toBe('object');
    expect(tree.children).toEqual([]);
  });

  it('handles empty array', () => {
    const tree = buildJsonTree([], '', '');
    expect(tree.type).toBe('array');
    expect(tree.children).toEqual([]);
  });

  it('preserves original values on nodes', () => {
    const obj = { x: 42, y: null, z: false };
    const tree = buildJsonTree(obj, '', '');
    expect(tree.children![0].value).toBe(42);
    expect(tree.children![1].value).toBeNull();
    expect(tree.children![2].value).toBe(false);
  });

  it('handles mixed types in array', () => {
    const tree = buildJsonTree([1, 'two', true, null, { nested: true }], '', '');
    expect(tree.children).toHaveLength(5);
    expect(tree.children![0].type).toBe('number');
    expect(tree.children![1].type).toBe('string');
    expect(tree.children![2].type).toBe('boolean');
    expect(tree.children![3].type).toBe('null');
    expect(tree.children![4].type).toBe('object');
  });

  it('handles circular references without stack overflow', () => {
    const obj: Record<string, unknown> = { name: 'root' };
    obj.self = obj;
    const tree = buildJsonTree(obj, '', '');
    expect(tree.type).toBe('object');
    expect(tree.children).toHaveLength(2);
    const selfChild = tree.children!.find((c) => c.key === 'self');
    expect(selfChild?.value).toBe('[Circular]');
    expect(selfChild?.type).toBe('string');
  });

  it('handles circular references in nested arrays', () => {
    const inner: Record<string, unknown> = { id: 1 };
    const obj = { items: [inner] };
    inner.parent = obj;
    const tree = buildJsonTree(obj, '', '');
    expect(tree.type).toBe('object');
    const parentNode = tree.children![0].children![0].children!.find((c) => c.key === 'parent');
    expect(parentNode?.value).toBe('[Circular]');
  });
});
