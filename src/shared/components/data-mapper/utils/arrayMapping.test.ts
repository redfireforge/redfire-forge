import { describe, it, expect } from 'vitest';
import {
  classifyArrayMapping,
  detectArrayMappings,
  inferArrayElementType,
  isArrayWildcardPath,
  generateForEachExpression,
} from './arrayMapping';
import type { Mapping, MapperSource, MapperTarget } from '../types';

const sources: MapperSource[] = [
  {
    id: 's1',
    label: 'API',
    sampleData: {
      name: 'Alice',
      age: 30,
      tags: ['a', 'b', 'c'],
      scores: [10, 20, 30],
      items: [{ id: 1 }, { id: 2 }],
      emptyArr: [],
      nested: { values: [1, 2, 3] },
    },
  },
];

function target(overrides?: Partial<MapperTarget>): MapperTarget {
  return {
    label: 'Output',
    sampleData: {
      userName: '',
      count: 0,
      labels: ['x', 'y'],
      numbers: [0],
      data: [],
      flag: true,
    },
    allowCustomFields: false,
    ...overrides,
  };
}

describe('classifyArrayMapping', () => {
  it('returns loop for array→array', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'labels' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.kind).toBe('loop');
    expect(info.label).toContain('for each');
  });

  it('returns aggregate for array→scalar (string target)', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'userName' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.kind).toBe('aggregate');
    expect(info.suggestedExpression).toContain('$join');
  });

  it('returns aggregate for array→scalar (number target)', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'scores', sourceId: 's1', targetPath: 'count' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.kind).toBe('aggregate');
    expect(info.suggestedExpression).toContain('$count');
  });

  it('returns spread for scalar→array', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'labels' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.kind).toBe('spread');
  });

  it('returns direct for scalar→scalar', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.kind).toBe('direct');
  });

  it('returns direct when mapping has expression', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'labels', expression: '$flatten(...)' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.kind).toBe('direct');
  });

  it('handles missing source sample', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'tags', sourceId: 'missing', targetPath: 'labels' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.kind).toBe('direct');
  });

  it('handles string sampleData', () => {
    const strSources: MapperSource[] = [
      { id: 's1', label: 'API', sampleData: '{"items": [1, 2, 3]}' },
    ];
    const m: Mapping = { id: 'm1', sourcePath: 'items', sourceId: 's1', targetPath: 'labels' };
    const info = classifyArrayMapping(m, strSources, target());
    expect(info.kind).toBe('loop');
  });

  it('handles object array elements in aggregate', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'items', sourceId: 's1', targetPath: 'count' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.kind).toBe('aggregate');
    expect(info.suggestedExpression).toContain('$count');
  });
});

describe('detectArrayMappings', () => {
  it('filters out direct mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'tags', sourceId: 's1', targetPath: 'labels' },
      { id: 'm3', sourcePath: 'scores', sourceId: 's1', targetPath: 'count' },
    ];
    const result = detectArrayMappings(mappings, sources, target());
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.kind)).toEqual(['loop', 'aggregate']);
  });

  it('returns empty for all-scalar mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectArrayMappings(mappings, sources, target());
    expect(result).toHaveLength(0);
  });
});

describe('inferArrayElementType', () => {
  it('returns element type for non-empty array', () => {
    expect(inferArrayElementType([1, 2, 3])).toBe('number');
    expect(inferArrayElementType(['a', 'b'])).toBe('string');
    expect(inferArrayElementType([{ x: 1 }])).toBe('object');
    expect(inferArrayElementType([true])).toBe('boolean');
    expect(inferArrayElementType([null])).toBe('null');
    expect(inferArrayElementType([[1, 2]])).toBe('array');
  });

  it('returns unknown for empty array', () => {
    expect(inferArrayElementType([])).toBe('unknown');
  });
});

describe('isArrayWildcardPath', () => {
  it('detects [*] paths', () => {
    expect(isArrayWildcardPath('items[*].name')).toBe(true);
    expect(isArrayWildcardPath('$.data[*]')).toBe(true);
  });

  it('detects [] paths', () => {
    expect(isArrayWildcardPath('items[].name')).toBe(true);
  });

  it('returns false for non-array paths', () => {
    expect(isArrayWildcardPath('items.name')).toBe(false);
    expect(isArrayWildcardPath('items[0].name')).toBe(false);
    expect(isArrayWildcardPath('')).toBe(false);
  });
});

describe('generateForEachExpression', () => {
  it('generates flatten expression for identity pass-through', () => {
    const result = generateForEachExpression('items');
    expect(result).toBe('$flatten($.items)');
  });

  it('generates jsonpath expression with inner path', () => {
    const result = generateForEachExpression('items', 'name');
    expect(result).toBe('$jsonpath($.items, "$[*].name")');
  });

  it('does not double-prefix $.paths', () => {
    const result = generateForEachExpression('$.items');
    expect(result).toBe('$flatten($.items)');
  });
});

describe('aggregate suggestions for different element types', () => {
  it('suggests $count for number arrays to number target', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'scores', sourceId: 's1', targetPath: 'count' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.suggestedExpression).toContain('$count');
  });

  it('suggests $join for string arrays to string target', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'userName' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.suggestedExpression).toContain('$join');
  });

  it('suggests $count for object arrays to number target', () => {
    const m: Mapping = { id: 'm1', sourcePath: 'items', sourceId: 's1', targetPath: 'count' };
    const info = classifyArrayMapping(m, sources, target());
    expect(info.suggestedExpression).toContain('$count');
  });
});
