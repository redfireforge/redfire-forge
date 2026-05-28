import { describe, it, expect } from 'vitest';
import { suggestExpressionsForMapping, suggestExpressionsForAll } from './expressionSuggestions';
import type { Mapping, MapperSource, MapperTarget } from '../types';

function mkMapping(id: string, sourcePath: string, targetPath: string, expression?: string): Mapping {
  return { id, sourcePath, sourceId: 's1', targetPath, expression };
}

function mkSources(data: unknown): MapperSource[] {
  return [{ id: 's1', label: 'Source', sampleData: data }];
}

function mkTarget(data: unknown, fieldConstraints?: MapperTarget['fieldConstraints']): MapperTarget {
  return { label: 'Target', sampleData: data, allowCustomFields: false, fieldConstraints };
}

describe('suggestExpressionsForMapping', () => {
  it('suggests string→number conversion', () => {
    const mapping = mkMapping('m1', 'price', 'amount');
    const sources = mkSources({ price: '42.5' });
    const target = mkTarget({ amount: 100 });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.expression.includes('$parseFloat'))).toBe(true);
  });

  it('suggests number→string conversion', () => {
    const mapping = mkMapping('m1', 'count', 'label');
    const sources = mkSources({ count: 42 });
    const target = mkTarget({ label: 'hello' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$toString'))).toBe(true);
  });

  it('suggests boolean→string conversion', () => {
    const mapping = mkMapping('m1', 'active', 'status');
    const sources = mkSources({ active: true });
    const target = mkTarget({ status: 'active' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$toString'))).toBe(true);
  });

  it('suggests array→string join', () => {
    const mapping = mkMapping('m1', 'tags', 'tagStr');
    const sources = mkSources({ tags: ['a', 'b', 'c'] });
    const target = mkTarget({ tagStr: 'hello' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$join'))).toBe(true);
  });

  it('suggests array→number count', () => {
    const mapping = mkMapping('m1', 'items', 'itemCount');
    const sources = mkSources({ items: [1, 2, 3] });
    const target = mkTarget({ itemCount: 5 });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$count'))).toBe(true);
  });

  it('returns empty for compatible types', () => {
    const mapping = mkMapping('m1', 'name', 'fullName');
    const sources = mkSources({ name: 'Alice' });
    const target = mkTarget({ fullName: 'Bob' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions).toEqual([]);
  });

  it('skips mappings with existing expression', () => {
    const mapping = mkMapping('m1', 'price', 'amount', '$parseFloat($.price)');
    const sources = mkSources({ price: '42' });
    const target = mkTarget({ amount: 100 });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions).toEqual([]);
  });

  it('suggests lowercase for string→string case mismatch', () => {
    const mapping = mkMapping('m1', 'Name', 'name');
    const sources = mkSources({ Name: 'ALICE' });
    const target = mkTarget({ name: 'alice' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$lower'))).toBe(true);
  });

  it('suggests uppercase for string→string case mismatch', () => {
    const mapping = mkMapping('m1', 'name', 'NAME');
    const sources = mkSources({ name: 'alice' });
    const target = mkTarget({ NAME: 'ALICE' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$upper'))).toBe(true);
  });

  it('suggests date formatting for date-like source', () => {
    const mapping = mkMapping('m1', 'created', 'date');
    const sources = mkSources({ created: '2024-01-15T10:30:00Z' });
    const target = mkTarget({ date: 'not-a-date' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$formatDate'))).toBe(true);
  });

  it('returns empty when source type is unresolvable', () => {
    const mapping = mkMapping('m1', 'missing', 'target');
    const sources = mkSources({ other: 'value' });
    const target = mkTarget({ target: 42 });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions).toEqual([]);
  });

  it('suggests trim for string with extra whitespace', () => {
    const mapping = mkMapping('m1', 'val', 'clean');
    const sources = mkSources({ val: '  hello  ' });
    const target = mkTarget({ clean: 'world' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$trim'))).toBe(true);
  });

  it('suggests normalize when both values are date-like', () => {
    const mapping = mkMapping('m1', 'srcDate', 'tgtDate');
    const sources = mkSources({ srcDate: '2024-01-15T10:30:00Z' });
    const target = mkTarget({ tgtDate: '01/15/2024' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.label === 'Normalize date')).toBe(true);
  });

  it('returns empty when target type is unresolvable', () => {
    const mapping = mkMapping('m1', 'val', 'missing');
    const sources = mkSources({ val: 'hello' });
    const target = mkTarget({ other: 42 });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions).toEqual([]);
  });

  it('suggests object→string conversion', () => {
    const mapping = mkMapping('m1', 'data', 'json');
    const sources = mkSources({ data: { a: 1 } });
    const target = mkTarget({ json: 'hello' });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$stringify'))).toBe(true);
  });

  it('suggests string→array split', () => {
    const mapping = mkMapping('m1', 'csv', 'items');
    const sources = mkSources({ csv: 'a,b,c' });
    const target = mkTarget({ items: ['x'] });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$split'))).toBe(true);
  });

  it('suggests array→boolean has items', () => {
    const mapping = mkMapping('m1', 'items', 'hasItems');
    const sources = mkSources({ items: [1, 2] });
    const target = mkTarget({ hasItems: true });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$toBool'))).toBe(true);
  });

  it('uses TargetField type when available', () => {
    const mapping = mkMapping('m1', 'val', 'num');
    const sources = mkSources({ val: 'hello' });
    const target: MapperTarget = {
      label: 'Target', sampleData: {}, allowCustomFields: false,
      fields: [{ path: 'num', label: 'Number', type: 'number' }],
    };
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$parseFloat'))).toBe(true);
  });

  it('returns wildcard null-handling for otherwise unsupported conversion', () => {
    const mapping = mkMapping('m1', 'val', 'out');
    const sources = mkSources({ val: { a: 1 } });
    const target = mkTarget({ out: true });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.every((s) => s.category === 'null-handling')).toBe(true);
  });

  it('uses field constraints for target type', () => {
    const mapping = mkMapping('m1', 'val', 'num');
    const sources = mkSources({ val: 'hello' });
    const target = mkTarget({ num: null }, { num: { type: 'number' } });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.some((s) => s.expression.includes('$parseFloat'))).toBe(true);
  });

  it('suggestions are sorted by priority descending', () => {
    const mapping = mkMapping('m1', 'val', 'num');
    const sources = mkSources({ val: '123' });
    const target = mkTarget({ num: 42 });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].priority).toBeGreaterThanOrEqual(suggestions[i].priority);
    }
  });
});

describe('fallback suggestions', () => {
  it('returns fallback when no library templates match the conversion key', () => {
    const mapping = mkMapping('m1', 'flag', 'count');
    const sources = mkSources({ flag: true });
    const target = mkTarget({ count: 42 });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const hasFallback = suggestions.some((s) => s.expression.includes('$toInt'));
    expect(hasFallback).toBe(true);
  });

  it('returns empty suggestions for completely unknown conversion (e.g., object→array)', () => {
    const mapping = mkMapping('m1', 'obj', 'arr');
    const sources = mkSources({ obj: { nested: true } });
    const target: MapperTarget = {
      label: 'Target',
      sampleData: { arr: [1, 2, 3] },
    };
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.length).toBe(0);
  });
});

describe('suggestExpressionsForAll', () => {
  it('returns suggestions grouped by mapping id', () => {
    const mappings: Mapping[] = [
      mkMapping('m1', 'price', 'amount'),
      mkMapping('m2', 'name', 'fullName'),
    ];
    const sources = mkSources({ price: '42', name: 'Alice' });
    const target = mkTarget({ amount: 100, fullName: 'Bob' });
    const result = suggestExpressionsForAll(mappings, sources, target);
    expect(result.has('m1')).toBe(true);
    expect(result.has('m2')).toBe(false);
  });

  it('returns empty map when no mismatches', () => {
    const mappings: Mapping[] = [mkMapping('m1', 'name', 'fullName')];
    const sources = mkSources({ name: 'Alice' });
    const target = mkTarget({ fullName: 'Bob' });
    const result = suggestExpressionsForAll(mappings, sources, target);
    expect(result.size).toBe(0);
  });

  // --- Fallback suggestion path (no library template, but FALLBACK_MAP has entry) ---
  it('suggests array→boolean via FALLBACK_MAP when no library template exists', () => {
    // array→boolean has no entry in TRANSFORMATION_LIBRARY, so falls through to FALLBACK_MAP
    const mapping = mkMapping('m1', 'items', 'hasItems');
    const sources = mkSources({ items: [1, 2, 3] });
    const target = mkTarget({ hasItems: false });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.expression.includes('$toBool'))).toBe(true);
  });

  it('returns empty when type pair has no library template and no FALLBACK_MAP entry', () => {
    // number→array is incompatible, has no library template, and is not in FALLBACK_MAP
    const mapping = mkMapping('m1', 'count', 'items');
    const sources = mkSources({ count: 42 });
    const target = mkTarget({ items: [] });
    const suggestions = suggestExpressionsForMapping(mapping, sources, target);
    expect(suggestions).toEqual([]);
  });
});
