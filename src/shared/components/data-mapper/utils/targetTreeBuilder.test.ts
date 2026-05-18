import { describe, it, expect } from 'vitest';
import { buildTreeFromFields, normalizeFieldType, collectAllPaths } from './targetTreeBuilder';
import type { TargetField } from '../types';

describe('normalizeFieldType', () => {
  it('returns standard types as-is', () => {
    expect(normalizeFieldType('string')).toBe('string');
    expect(normalizeFieldType('number')).toBe('number');
    expect(normalizeFieldType('boolean')).toBe('boolean');
    expect(normalizeFieldType('object')).toBe('object');
    expect(normalizeFieldType('array')).toBe('array');
    expect(normalizeFieldType('null')).toBe('null');
  });

  it('is case-insensitive', () => {
    expect(normalizeFieldType('String')).toBe('string');
    expect(normalizeFieldType('NUMBER')).toBe('number');
    expect(normalizeFieldType('Boolean')).toBe('boolean');
  });

  it('returns string for adapter-specific types', () => {
    expect(normalizeFieldType('path')).toBe('string');
    expect(normalizeFieldType('param')).toBe('string');
    expect(normalizeFieldType('header')).toBe('string');
    expect(normalizeFieldType('body')).toBe('string');
    expect(normalizeFieldType('validate')).toBe('string');
  });

  it('returns string for undefined/empty', () => {
    expect(normalizeFieldType(undefined)).toBe('string');
    expect(normalizeFieldType('')).toBe('string');
  });
});

describe('buildTreeFromFields', () => {
  it('returns empty root for empty array', () => {
    const tree = buildTreeFromFields([]);
    expect(tree.key).toBe('(root)');
    expect(tree.type).toBe('object');
    expect(tree.children).toHaveLength(0);
  });

  it('returns empty root for undefined input', () => {
    const tree = buildTreeFromFields(undefined as unknown as TargetField[]);
    expect(tree.children).toHaveLength(0);
  });

  it('builds flat leaves from simple fields', () => {
    const fields: TargetField[] = [
      { path: 'name', label: 'Name', type: 'string' },
      { path: 'age', label: 'Age', type: 'number' },
      { path: 'active', label: 'Active', type: 'boolean' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children).toHaveLength(3);
    expect(tree.children![0].key).toBe('Name');
    expect(tree.children![0].path).toBe('name');
    expect(tree.children![0].type).toBe('string');
    expect(tree.children![1].key).toBe('Age');
    expect(tree.children![1].type).toBe('number');
    expect(tree.children![2].key).toBe('Active');
    expect(tree.children![2].type).toBe('boolean');
  });

  it('creates nested object nodes for dot-separated paths', () => {
    const fields: TargetField[] = [
      { path: 'user.name', label: 'User Name', type: 'string' },
      { path: 'user.email', label: 'User Email', type: 'string' },
      { path: 'address.city', label: 'City' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children).toHaveLength(2);

    const userNode = tree.children![0];
    expect(userNode.key).toBe('user');
    expect(userNode.path).toBe('user');
    expect(userNode.type).toBe('object');
    expect(userNode.children).toHaveLength(2);
    expect(userNode.children![0].key).toBe('User Name');
    expect(userNode.children![0].path).toBe('user.name');

    const addrNode = tree.children![1];
    expect(addrNode.key).toBe('address');
    expect(addrNode.children).toHaveLength(1);
    expect(addrNode.children![0].key).toBe('City');
    expect(addrNode.children![0].path).toBe('address.city');
  });

  it('keeps :: separator paths as flat leaves (no nesting)', () => {
    const fields: TargetField[] = [
      { path: 'path::userId', label: 'userId (path)', type: 'path' },
      { path: 'param::page', label: 'page (param)', type: 'param' },
      { path: 'header::Authorization', label: 'Authorization', type: 'header' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children).toHaveLength(3);
    expect(tree.children![0].path).toBe('path::userId');
    expect(tree.children![0].key).toBe('userId (path)');
    expect(tree.children![0].type).toBe('string');
    expect(tree.children![1].path).toBe('param::page');
    expect(tree.children![2].path).toBe('header::Authorization');
  });

  it('deduplicates paths (first wins)', () => {
    const fields: TargetField[] = [
      { path: 'id', label: 'First ID', type: 'string' },
      { path: 'id', label: 'Duplicate ID', type: 'number' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children).toHaveLength(1);
    expect(tree.children![0].key).toBe('First ID');
    expect(tree.children![0].type).toBe('string');
  });

  it('skips fields with empty paths', () => {
    const fields: TargetField[] = [
      { path: '', label: 'Empty', type: 'string' },
      { path: 'valid', label: 'Valid', type: 'string' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children).toHaveLength(1);
    expect(tree.children![0].path).toBe('valid');
  });

  it('handles mixed flat and nested fields', () => {
    const fields: TargetField[] = [
      { path: 'topLevel', label: 'Top Level' },
      { path: 'nested.a', label: 'Nested A', type: 'string' },
      { path: 'nested.b', label: 'Nested B', type: 'number' },
      { path: 'path::id', label: 'Path ID', type: 'path' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children).toHaveLength(3);
    expect(tree.children![0].path).toBe('topLevel');
    expect(tree.children![1].key).toBe('nested');
    expect(tree.children![1].children).toHaveLength(2);
    expect(tree.children![2].path).toBe('path::id');
  });

  it('uses field.path as key when label is missing', () => {
    const fields: TargetField[] = [
      { path: 'foo', label: '' },
      { path: 'bar', label: 'Bar Label' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children![0].key).toBe('foo');
    expect(tree.children![1].key).toBe('Bar Label');
  });

  it('handles deep nesting (3 levels)', () => {
    const fields: TargetField[] = [
      { path: 'a.b.c', label: 'Deep', type: 'number' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children).toHaveLength(1);
    const aNode = tree.children![0];
    expect(aNode.key).toBe('a');
    expect(aNode.path).toBe('a');
    expect(aNode.type).toBe('object');
    const bNode = aNode.children![0];
    expect(bNode.key).toBe('b');
    expect(bNode.path).toBe('a.b');
    expect(bNode.type).toBe('object');
    const cNode = bNode.children![0];
    expect(cNode.key).toBe('Deep');
    expect(cNode.path).toBe('a.b.c');
    expect(cNode.type).toBe('number');
  });

  it('splits array index paths into offers -> [0] -> leaf', () => {
    const fields: TargetField[] = [
      { path: 'offers[0].associatedOfferingCode', label: 'associatedOfferingCode', type: 'string' },
    ];
    const tree = buildTreeFromFields(fields);
    const offersNode = tree.children![0];
    expect(offersNode.key).toBe('offers');
    expect(offersNode.path).toBe('offers');
    expect(offersNode.type).toBe('array');

    const indexNode = offersNode.children![0];
    expect(indexNode.key).toBe('[0]');
    expect(indexNode.path).toBe('offers[0]');
    expect(indexNode.type).toBe('object');

    const leaf = indexNode.children![0];
    expect(leaf.key).toBe('associatedOfferingCode');
    expect(leaf.path).toBe('offers[0].associatedOfferingCode');
  });

  it('keeps bracket path format without dot before index', () => {
    const fields: TargetField[] = [
      { path: 'offers[12].rank', label: 'rank', type: 'number' },
    ];
    const tree = buildTreeFromFields(fields);
    const offersNode = tree.children![0];
    const indexNode = offersNode.children![0];
    expect(indexNode.path).toBe('offers[12]');
    expect(indexNode.children![0].path).toBe('offers[12].rank');
  });

  it('reuses intermediate nodes for shared prefixes', () => {
    const fields: TargetField[] = [
      { path: 'user.name', label: 'Name' },
      { path: 'user.age', label: 'Age', type: 'number' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children).toHaveLength(1);
    const userNode = tree.children![0];
    expect(userNode.children).toHaveLength(2);
  });

  it('normalizes non-standard types on leaf nodes', () => {
    const fields: TargetField[] = [
      { path: 'validate::status', label: 'Status', type: 'validate' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children![0].type).toBe('string');
  });

  it('defaults type to string when unspecified', () => {
    const fields: TargetField[] = [
      { path: 'name', label: 'Name' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children![0].type).toBe('string');
  });
});

describe('defaultValue support', () => {
  it('sets node value from field defaultValue for flat fields', () => {
    const fields: TargetField[] = [
      { path: 'page', label: 'page', type: 'string', defaultValue: '1' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children![0].value).toBe('1');
  });

  it('sets node value from field defaultValue for nested fields', () => {
    const fields: TargetField[] = [
      { path: 'user.name', label: 'name', type: 'string', defaultValue: 'Alice' },
    ];
    const tree = buildTreeFromFields(fields);
    const user = tree.children![0];
    const name = user.children![0];
    expect(name.value).toBe('Alice');
  });

  it('leaves value undefined when no defaultValue', () => {
    const fields: TargetField[] = [
      { path: 'id', label: 'id', type: 'string' },
    ];
    const tree = buildTreeFromFields(fields);
    expect(tree.children![0].value).toBeUndefined();
  });
});

describe('collectAllPaths', () => {
  it('collects all paths from tree', () => {
    const fields: TargetField[] = [
      { path: 'user.name', label: 'Name' },
      { path: 'flat', label: 'Flat' },
    ];
    const tree = buildTreeFromFields(fields);
    const paths = collectAllPaths(tree);
    expect(paths.has('__root__')).toBe(true);
    expect(paths.has('user')).toBe(true);
    expect(paths.has('user.name')).toBe(true);
    expect(paths.has('flat')).toBe(true);
    expect(paths.size).toBe(4);
  });

  it('handles empty tree', () => {
    const tree = buildTreeFromFields([]);
    const paths = collectAllPaths(tree);
    expect(paths.has('__root__')).toBe(true);
    expect(paths.size).toBe(1);
  });
});
