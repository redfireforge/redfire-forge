import { describe, it, expect } from 'vitest';
import {
  detectTypeMismatches,
  getMismatchForMapping,
  inferType,
  typesCompatible,
} from './typeMismatch';
import { evaluateMapperExpression } from './mapperExpressionEvaluator';
import type { Mapping, MapperSource, MapperTarget } from '../types';

const sources: MapperSource[] = [
  {
    id: 's1',
    label: 'API',
    sampleData: {
      name: 'Alice',
      age: 30,
      active: true,
      tags: ['a', 'b'],
      address: { city: 'NYC' },
      score: null,
    },
  },
];

function target(overrides?: Partial<MapperTarget>): MapperTarget {
  return {
    label: 'Output',
    sampleData: {
      userName: '',
      userAge: 0,
      isActive: true,
      items: [],
      profile: {},
    },
    allowCustomFields: false,
    ...overrides,
  };
}

describe('inferType', () => {
  it('returns correct types', () => {
    expect(inferType('hello')).toBe('string');
    expect(inferType(42)).toBe('number');
    expect(inferType(true)).toBe('boolean');
    expect(inferType(null)).toBe('null');
    expect(inferType(undefined)).toBe('null');
    expect(inferType([])).toBe('array');
    expect(inferType({})).toBe('object');
  });
});

describe('typesCompatible', () => {
  it('same types are compatible', () => {
    expect(typesCompatible('string', 'string')).toBe(true);
    expect(typesCompatible('number', 'number')).toBe(true);
  });

  it('null is compatible with anything', () => {
    expect(typesCompatible('null', 'string')).toBe(true);
    expect(typesCompatible('number', 'null')).toBe(true);
  });

  it('any target type accepts all', () => {
    expect(typesCompatible('object', 'any')).toBe(true);
  });

  it('different scalar types are incompatible', () => {
    expect(typesCompatible('string', 'number')).toBe(false);
    expect(typesCompatible('boolean', 'string')).toBe(false);
  });
});

describe('detectTypeMismatches', () => {
  it('returns empty for compatible mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(0);
  });

  it('detects string→number mismatch', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('string');
    expect(result[0].targetType).toBe('number');
    expect(result[0].severity).toBe('warning');
    expect(result[0].suggestedFix).toContain('$parseInt');
  });

  it('detects number→string mismatch', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'age', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('number');
    expect(result[0].targetType).toBe('string');
    expect(result[0].suggestedFix).toContain('$toString');
  });

  it('detects boolean→string mismatch', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'active', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].suggestedFix).toContain('$toString');
  });

  it('detects string→boolean mismatch', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'isActive' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].suggestedFix).toContain('$toBool');
  });

  it('detects array→object structural mismatch as info', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'profile' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('info');
    expect(result[0].suggestedFix).toBeUndefined();
  });

  it('skips mappings with expressions', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge', expression: '$parseInt($.name)' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(0);
  });

  it('skips when source type is null', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'score', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(0);
  });

  it('skips when source path does not exist', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'nonexistent', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(0);
  });

  it('uses fieldConstraints when available', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'count' },
    ];
    const tgt = target({
      sampleData: { count: 0 },
      fieldConstraints: { count: { type: 'number', required: true } },
    });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].targetType).toBe('number');
  });

  it('uses target fields type when available', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'amount' },
    ];
    const tgt = target({
      sampleData: undefined,
      fields: [{ path: 'amount', label: 'Amount', type: 'number' }],
    });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].targetType).toBe('number');
  });

  it('handles multiple mismatches', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' },
      { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(2);
  });

  it('handles string sampleData in sources', () => {
    const strSources: MapperSource[] = [
      { id: 's1', label: 'API', sampleData: '{"price": "99.99"}' },
    ];
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'price', sourceId: 's1', targetPath: 'userAge' },
    ];
    const result = detectTypeMismatches(mappings, strSources, target());
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('string');
  });

  it('handles string sampleData in target', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'age', sourceId: 's1', targetPath: 'label' },
    ];
    const tgt = target({ sampleData: '{"label": "test"}' });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].targetType).toBe('string');
  });

  it('handles array type in fieldConstraints', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'val' },
    ];
    const tgt = target({
      sampleData: { val: 0 },
      fieldConstraints: { val: { type: ['number', 'string'] } },
    });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].targetType).toBe('number');
  });
});

describe('getMismatchForMapping', () => {
  it('returns the mismatch for the given id', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' },
    ];
    const mismatches = detectTypeMismatches(mappings, sources, target());
    expect(getMismatchForMapping(mismatches, 'm1')).toBeDefined();
    expect(getMismatchForMapping(mismatches, 'm2')).toBeUndefined();
  });
});

describe('suggestedFix $.prefix handling', () => {
  it('does not double-prefix sourcePaths that already start with $.', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: '$.name', sourceId: 's1', targetPath: 'userAge' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].suggestedFix).toBe('$parseInt($.name)');
    expect(result[0].suggestedFix).not.toContain('$.$.name');
  });

  it('adds $.prefix to sourcePaths without it', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].suggestedFix).toBe('$parseInt($.name)');
  });
});

describe('suggestedFix functions evaluate successfully', () => {

  it('$parseInt evaluates string to number', () => {
    const result = evaluateMapperExpression(
      '$parseInt($.name)',
      [{ id: 's1', label: 'S', sampleData: { name: '42' } }],
      's1',
    );
    expect(result.error).toBeUndefined();
    expect(result.value).toBe(42);
  });

  it('$toString evaluates number to string', () => {
    const result = evaluateMapperExpression(
      '$toString($.age)',
      [{ id: 's1', label: 'S', sampleData: { age: 30 } }],
      's1',
    );
    expect(result.error).toBeUndefined();
    expect(result.value).toBe('30');
  });

  it('$toBool evaluates string to boolean', () => {
    const result = evaluateMapperExpression(
      '$toBool($.name)',
      [{ id: 's1', label: 'S', sampleData: { name: 'yes' } }],
      's1',
    );
    expect(result.error).toBeUndefined();
    expect(result.value).toBe(true);
  });

  it('$toInt evaluates boolean to number', () => {
    const result = evaluateMapperExpression(
      '$toInt($.active)',
      [{ id: 's1', label: 'S', sampleData: { active: true } }],
      's1',
    );
    expect(result.error).toBeUndefined();
    expect(result.value).toBe(1);
  });

  it('$parseFloat evaluates string to float', () => {
    const result = evaluateMapperExpression(
      '$parseFloat($.price)',
      [{ id: 's1', label: 'S', sampleData: { price: '29.99' } }],
      's1',
    );
    expect(result.error).toBeUndefined();
    expect(result.value).toBe(29.99);
  });
});
