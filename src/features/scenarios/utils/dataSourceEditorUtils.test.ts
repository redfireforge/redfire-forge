import { describe, it, expect } from 'vitest';
import { COLUMN_TYPES, mergeRowDetailSave, formatErrorBody } from './dataSourceEditorUtils';
import type { DataSource } from '../../../shared/types';

describe('COLUMN_TYPES', () => {
  it('has 5 column types', () => {
    expect(COLUMN_TYPES).toHaveLength(5);
    expect(COLUMN_TYPES.map((c) => c.value)).toEqual(['path', 'param', 'body', 'header', 'validate']);
  });
});

describe('mergeRowDetailSave', () => {
  const baseDt: DataSource = {
    columns: [{ id: 'c1', name: 'Name', type: 'body' }],
    rows: [
      { id: 'r1', values: { c1: 'Alice' }, enabled: true, label: '' },
      { id: 'r2', values: { c1: 'Bob' }, enabled: true, label: '' },
    ],
  };

  it('updates the target row without new columns', () => {
    const updatedRow = { id: 'r1', values: { c1: 'Charlie' }, enabled: true, label: '' };
    const result = mergeRowDetailSave(baseDt, updatedRow);
    expect(result.rows[0].values.c1).toBe('Charlie');
    expect(result.rows[1].values.c1).toBe('Bob');
    expect(result.columns).toHaveLength(1);
  });

  it('adds new columns and initializes empty values for other rows', () => {
    const updatedRow = { id: 'r1', values: { c1: 'Alice', c2: 'expected' }, enabled: true, label: '' };
    const newCols = [{ id: 'c2', name: 'Status', type: 'validate' as const }];
    const result = mergeRowDetailSave(baseDt, updatedRow, newCols);
    expect(result.columns).toHaveLength(2);
    expect(result.rows[0].values.c2).toBe('expected');
    expect(result.rows[1].values.c2).toBe('');
  });

  it('handles empty newColumns array like no new columns', () => {
    const updatedRow = { id: 'r1', values: { c1: 'Updated' }, enabled: true, label: '' };
    const result = mergeRowDetailSave(baseDt, updatedRow, []);
    expect(result.columns).toHaveLength(1);
    expect(result.rows[0].values.c1).toBe('Updated');
  });
});

describe('formatErrorBody', () => {
  it('pretty-prints valid JSON', () => {
    expect(formatErrorBody('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('returns raw string for invalid JSON', () => {
    expect(formatErrorBody('not json')).toBe('not json');
  });

  it('returns empty string for undefined', () => {
    expect(formatErrorBody(undefined)).toBe('');
  });
});
