import { describe, it, expect } from 'vitest';
import {
  buildPivotedRulesFromExpectedFields,
  trailingBracketArrayIndex,
} from './testEditorValidationPivot';
import type { ExpectedField } from '../../../shared/types';

function field(jsonPath: string, expectedValue = 'x'): ExpectedField {
  return { jsonPath, expectedValue };
}

describe('trailingBracketArrayIndex', () => {
  it('returns 0 when key has no trailing bracket index', () => {
    expect(trailingBracketArrayIndex('$.foo')).toBe(0);
    expect(trailingBracketArrayIndex('items')).toBe(0);
  });

  it('returns 0 when bracket suffix is non-numeric', () => {
    expect(trailingBracketArrayIndex('items[x]')).toBe(0);
  });

  it('parses numeric suffix including leading zeros', () => {
    expect(trailingBracketArrayIndex('items[01]')).toBe(1);
    expect(trailingBracketArrayIndex('items[12]')).toBe(12);
  });
});

describe('buildPivotedRulesFromExpectedFields', () => {
  it('returns empty model for empty fields', () => {
    const r = buildPivotedRulesFromExpectedFields([]);
    expect(r.columns).toEqual([]);
    expect(r.rows).toEqual([]);
    expect(r.arrayPrefix).toBe('');
  });

  it('uses (root) row key when jsonPath has no dot', () => {
    const r = buildPivotedRulesFromExpectedFields([field('status'), field('code')]);
    expect(r.rows.map((x) => x.key)).toEqual(['(root)']);
    expect(r.columns.sort()).toEqual(['code', 'status']);
    const cells = r.rows[0]!.cells;
    expect(cells.get('status')?.value).toBe('x');
    expect(cells.get('code')?.originalIndex).toBe(1);
  });

  it('reuses the same row Map when multiple fields share a row key', () => {
    const r = buildPivotedRulesFromExpectedFields([
      field('$.user.name', 'a'),
      field('$.user.id', 'b'),
    ]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.key).toBe('$.user');
    expect([...r.rows[0]!.cells.keys()].sort()).toEqual(['id', 'name']);
  });

  it('does not set arrayPrefix when row keys do not all end with [digits]', () => {
    const r = buildPivotedRulesFromExpectedFields([
      field('items[0].x', '1'),
      field('other.y', '2'),
    ]);
    expect(r.arrayPrefix).toBe('');
    expect(r.rows.map((row) => row.key).sort()).toEqual(['items[0]', 'other']);
  });

  it('does not set arrayPrefix when bracket starts at index 0', () => {
    const r = buildPivotedRulesFromExpectedFields([field('[0].x', '1'), field('[1].x', '2')]);
    expect(r.arrayPrefix).toBe('');
  });

  it('sets arrayPrefix and sorts rows by numeric bracket index when all keys share array prefix', () => {
    const r = buildPivotedRulesFromExpectedFields([
      field('items[2].name', 'c'),
      field('items[0].name', 'a'),
      field('items[1].name', 'b'),
    ]);
    expect(r.arrayPrefix).toBe('items');
    expect(r.rows.map((row) => row.key)).toEqual(['items[0]', 'items[1]', 'items[2]']);
    expect(r.rows[0]!.cells.get('name')?.value).toBe('a');
    expect(r.rows[2]!.cells.get('name')?.value).toBe('c');
  });

  it('sort comparator handles equal numeric suffixes (stable ordering)', () => {
    const r = buildPivotedRulesFromExpectedFields([
      field('items[01].x', 'b'),
      field('items[1].y', 'a'),
    ]);
    expect(r.arrayPrefix).toBe('items');
    expect(r.rows.map((row) => row.key)).toEqual(['items[01]', 'items[1]']);
  });

  it('does not set arrayPrefix when first row key has [ only at position 0', () => {
    const r = buildPivotedRulesFromExpectedFields([field('[2].x', '1'), field('[10].x', '2')]);
    expect(r.arrayPrefix).toBe('');
  });
});
