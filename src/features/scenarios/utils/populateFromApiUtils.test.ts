import { describe, it, expect } from 'vitest';
import {
  detectArrays,
  resolvePath,
  guessColType,
  collectTemplateTokens,
  findUnresolvedTokens,
  createFieldMappings,
  selectBestArray,
  normalizeForMatch,
  findMatchingColumn,
  computeRowFingerprint,
  detectDuplicateRows,
  formatCellValue,
  stringifyValue,
} from './populateFromApiUtils';
import type { DataSourceColumn } from '../../../shared/types';

describe('populateFromApiUtils', () => {
  describe('detectArrays', () => {
    it('detects root array of objects', () => {
      const data = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
      const result = detectArrays(data);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('$');
      expect(result[0].length).toBe(2);
      expect(result[0].sampleKeys).toEqual(['id', 'name']);
    });

    it('detects nested array', () => {
      const data = { users: [{ id: 1 }, { id: 2 }], meta: { total: 2 } };
      const result = detectArrays(data);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('users');
      expect(result[0].length).toBe(2);
    });

    it('detects deeply nested array', () => {
      const data = { data: { items: [{ sku: 'A' }, { sku: 'B' }, { sku: 'C' }] } };
      const result = detectArrays(data);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('data.items');
      expect(result[0].length).toBe(3);
    });

    it('detects multiple arrays', () => {
      const data = { users: [{ id: 1 }], products: [{ sku: 'A' }] };
      const result = detectArrays(data);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.path).sort()).toEqual(['products', 'users']);
    });

    it('ignores arrays of primitives', () => {
      const data = { tags: ['a', 'b', 'c'] };
      const result = detectArrays(data);
      expect(result).toHaveLength(0);
    });

    it('ignores empty arrays', () => {
      const data = { items: [] };
      const result = detectArrays(data);
      expect(result).toHaveLength(0);
    });

    it('returns empty for non-object', () => {
      expect(detectArrays(42)).toEqual([]);
      expect(detectArrays('hello')).toEqual([]);
      expect(detectArrays(null)).toEqual([]);
    });

    it('detects arrays with null first element when later elements are objects', () => {
      const data = { items: [null, { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] };
      const result = detectArrays(data);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('items');
      expect(result[0].length).toBe(3);
      expect(result[0].sampleKeys).toEqual(['id', 'name']);
    });

    it('skips arrays where all elements are null or primitive', () => {
      const data = { items: [null, undefined, 42] };
      const result = detectArrays(data);
      expect(result).toHaveLength(0);
    });

    it('handles circular references without stack overflow', () => {
      const obj: Record<string, unknown> = { id: 1, items: [{ a: 1 }] };
      obj.self = obj;
      const result = detectArrays(obj);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('items');
    });
  });

  describe('resolvePath', () => {
    it('resolves $ to root', () => {
      const data = [1, 2, 3];
      expect(resolvePath(data, '$')).toEqual([1, 2, 3]);
    });

    it('resolves single-level key', () => {
      const data = { users: [{ id: 1 }] };
      expect(resolvePath(data, 'users')).toEqual([{ id: 1 }]);
    });

    it('resolves nested path', () => {
      const data = { data: { items: [{ sku: 'A' }] } };
      expect(resolvePath(data, 'data.items')).toEqual([{ sku: 'A' }]);
    });

    it('returns undefined for missing path', () => {
      expect(resolvePath({ a: 1 }, 'b')).toBeUndefined();
      expect(resolvePath({ a: 1 }, 'a.b.c')).toBeUndefined();
    });

    it('handles null values in path', () => {
      expect(resolvePath({ a: null }, 'a.b')).toBeUndefined();
    });
  });

  describe('guessColType', () => {
    it('returns "path" for id fields', () => {
      expect(guessColType('id')).toBe('path');
      expect(guessColType('ID')).toBe('path');
      expect(guessColType('user_id')).toBe('path');
      expect(guessColType('userId')).toBe('path');
      expect(guessColType('productId')).toBe('path');
    });

    it('returns "validate" for other fields', () => {
      expect(guessColType('name')).toBe('validate');
      expect(guessColType('email')).toBe('validate');
      expect(guessColType('status')).toBe('validate');
      expect(guessColType('identity')).toBe('validate');
    });
  });

  describe('collectTemplateTokens', () => {
    it('extracts template tokens', () => {
      expect(collectTemplateTokens('Hello {{name}}!')).toEqual(['{{name}}']);
      expect(collectTemplateTokens('{{a}} and {{b}}')).toEqual(['{{a}}', '{{b}}']);
    });

    it('handles whitespace in tokens', () => {
      expect(collectTemplateTokens('{{ name }}')).toEqual(['{{name}}']);
    });

    it('returns empty array for no tokens', () => {
      expect(collectTemplateTokens('Hello World')).toEqual([]);
      expect(collectTemplateTokens('')).toEqual([]);
      expect(collectTemplateTokens(undefined)).toEqual([]);
    });

    it('handles URL-encoded strings', () => {
      expect(collectTemplateTokens('%7B%7Bid%7D%7D')).toEqual(['{{id}}']);
    });

    it('deduplicates tokens', () => {
      expect(collectTemplateTokens('{{id}} {{id}}')).toEqual(['{{id}}']);
    });
  });

  describe('findUnresolvedTokens', () => {
    it('finds tokens in URL', () => {
      const result = findUnresolvedTokens('https://api.example.com/users/{{id}}', undefined, {});
      expect(result).toEqual(['{{id}}']);
    });

    it('finds tokens in body', () => {
      const result = findUnresolvedTokens('https://api.example.com', '{"name": "{{name}}"}', {});
      expect(result).toEqual(['{{name}}']);
    });

    it('finds tokens in headers', () => {
      const result = findUnresolvedTokens('https://api.example.com', undefined, { Authorization: 'Bearer {{token}}' });
      expect(result).toEqual(['{{token}}']);
    });

    it('combines tokens from all sources', () => {
      const result = findUnresolvedTokens(
        'https://api.example.com/{{id}}',
        '{{body}}',
        { 'X-Custom': '{{header}}' }
      );
      expect(result.sort()).toEqual(['{{body}}', '{{header}}', '{{id}}']);
    });

    it('returns empty when no tokens', () => {
      const result = findUnresolvedTokens('https://api.example.com', '{}', { Accept: 'application/json' });
      expect(result).toEqual([]);
    });
  });

  describe('createFieldMappings', () => {
    it('creates mappings for all fields when no existing columns', () => {
      const result = createFieldMappings(['id', 'name', 'email'], []);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ field: 'id', colType: 'path', enabled: true });
      expect(result[1]).toEqual({ field: 'name', colType: 'validate', enabled: true });
      expect(result[2]).toEqual({ field: 'email', colType: 'validate', enabled: true });
    });

    it('only enables matching fields when existing validate columns exist', () => {
      const existingColumns: DataSourceColumn[] = [
        { id: 'col-1', name: 'name', type: 'validate', mapping: 'name' },
      ];
      const result = createFieldMappings(['id', 'name', 'email'], existingColumns);
      expect(result.find(m => m.field === 'id')?.enabled).toBe(false);
      expect(result.find(m => m.field === 'name')?.enabled).toBe(true);
      expect(result.find(m => m.field === 'email')?.enabled).toBe(false);
    });
  });

  describe('selectBestArray', () => {
    it('returns null for empty input', () => {
      expect(selectBestArray([])).toBeNull();
    });

    it('returns the largest array', () => {
      const arrays = [
        { path: 'small', length: 2, sampleKeys: ['a'] },
        { path: 'large', length: 10, sampleKeys: ['a'] },
        { path: 'medium', length: 5, sampleKeys: ['a'] },
      ];
      const result = selectBestArray(arrays);
      expect(result?.path).toBe('large');
    });
  });

  describe('normalizeForMatch', () => {
    it('trims and lowercases', () => {
      expect(normalizeForMatch('  Hello World  ')).toBe('hello world');
      expect(normalizeForMatch('TEST')).toBe('test');
    });
  });

  describe('findMatchingColumn', () => {
    const columns: DataSourceColumn[] = [
      { id: '1', name: 'userId', type: 'path', mapping: 'user_id' },
      { id: '2', name: 'Name', type: 'validate', mapping: 'name' },
      { id: '3', name: 'status', type: 'validate', mapping: 'data.status' },
    ];

    it('matches by mapping and type', () => {
      const result = findMatchingColumn(columns, 'user_id', 'path');
      expect(result?.id).toBe('1');
    });

    it('matches by name and type', () => {
      const result = findMatchingColumn(columns, 'userId', 'path');
      expect(result?.id).toBe('1');
    });

    it('matches validate columns by suffix', () => {
      const result = findMatchingColumn(columns, 'status', 'validate');
      expect(result?.id).toBe('3');
    });

    it('returns undefined when no match', () => {
      expect(findMatchingColumn(columns, 'missing', 'path')).toBeUndefined();
    });

    it('does not match columns of wrong type in fallback', () => {
      const mixed: DataSourceColumn[] = [
        { id: '1', name: 'status', type: 'validate', mapping: '' },
      ];
      expect(findMatchingColumn(mixed, 'status', 'path')).toBeUndefined();
    });
  });

  describe('computeRowFingerprint', () => {
    it('creates fingerprint from values', () => {
      const values = { a: 'Hello', b: 'World' };
      const fp = computeRowFingerprint(values, ['a', 'b']);
      expect(fp).toBe('hello\x00world');
    });

    it('handles missing values', () => {
      const values = { a: 'Hello' };
      const fp = computeRowFingerprint(values, ['a', 'b']);
      expect(fp).toBe('hello\x00');
    });

    it('trims and lowercases', () => {
      const values = { a: '  HELLO  ' };
      const fp = computeRowFingerprint(values, ['a']);
      expect(fp).toBe('hello');
    });
  });

  describe('detectDuplicateRows', () => {
    const columns: DataSourceColumn[] = [
      { id: 'col-1', name: 'id', type: 'path', mapping: 'id' },
    ];
    const existingRows = [
      { values: { 'col-1': '1' } },
      { values: { 'col-1': '2' } },
    ];

    it('detects duplicates', () => {
      const arrayItems = [{ id: '1' }, { id: '3' }];
      const mappings = [{ field: 'id', colType: 'path' as const, enabled: true }];
      const result = detectDuplicateRows(arrayItems, mappings, columns, existingRows);
      expect(result).toEqual([true, false]);
    });

    it('returns all false when no existing rows', () => {
      const arrayItems = [{ id: '1' }, { id: '2' }];
      const mappings = [{ field: 'id', colType: 'path' as const, enabled: true }];
      const result = detectDuplicateRows(arrayItems, mappings, columns, []);
      expect(result).toEqual([false, false]);
    });

    it('returns all false when no enabled mappings', () => {
      const arrayItems = [{ id: '1' }];
      const result = detectDuplicateRows(arrayItems, [], columns, existingRows);
      expect(result).toEqual([false]);
    });
  });

  describe('formatCellValue', () => {
    it('formats null and undefined', () => {
      expect(formatCellValue(null)).toBe('');
      expect(formatCellValue(undefined)).toBe('');
    });

    it('formats objects as JSON', () => {
      expect(formatCellValue({ a: 1 })).toBe('{"a":1}');
    });

    it('truncates long values', () => {
      const long = 'a'.repeat(100);
      expect(formatCellValue(long, 50)).toBe('a'.repeat(50) + '…');
    });

    it('preserves short values', () => {
      expect(formatCellValue('hello', 50)).toBe('hello');
    });
  });

  describe('stringifyValue', () => {
    it('handles null and undefined', () => {
      expect(stringifyValue(null)).toBe('');
      expect(stringifyValue(undefined)).toBe('');
    });

    it('converts primitives to strings', () => {
      expect(stringifyValue(42)).toBe('42');
      expect(stringifyValue(true)).toBe('true');
      expect(stringifyValue('hello')).toBe('hello');
    });

    it('stringifies objects as JSON', () => {
      expect(stringifyValue({ key: 'value' })).toBe('{"key":"value"}');
      expect(stringifyValue([1, 2, 3])).toBe('[1,2,3]');
    });
  });
});
