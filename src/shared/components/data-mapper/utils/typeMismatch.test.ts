import { describe, it, expect } from 'vitest';
import {
  detectTypeMismatches,
  getMismatchForMapping,
  getOperatorExpectedType,
  inferType,
  suggestOperatorForType,
  suggestTypeFixExpression,
  typesCompatible,
  looksLikeDate,
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

  it('null is only compatible with null', () => {
    expect(typesCompatible('null', 'null')).toBe(true);
    expect(typesCompatible('null', 'string')).toBe(false);
    expect(typesCompatible('number', 'null')).toBe(false);
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
    expect(result[0].suggestedFix).toContain('$parseFloat');
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
    expect(result[0].suggestedFix).toContain('$first');
  });

  it('detects object→string mismatch with toString suggestion', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'address', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('object');
    expect(result[0].targetType).toBe('string');
    expect(result[0].suggestedFix).toContain('$toString');
  });

  it('detects string→object mismatch with parse suggestion', () => {
    const strObjSources: MapperSource[] = [
      { id: 's1', label: 'API', sampleData: { jsonBlob: '{"city":"NYC"}' } },
    ];
    const tgt = target({
      sampleData: undefined,
      fields: [{ path: 'profile', label: 'Profile', type: 'object' }],
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'jsonBlob', sourceId: 's1', targetPath: 'profile' },
    ];
    const result = detectTypeMismatches(mappings, strObjSources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedFix).toContain('$parse');
  });

  it('skips mappings with expressions', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge', expression: '$parseInt($.name)' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(0);
  });

  it('detects mismatch when source type is null', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'score', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('null');
    expect(result[0].targetType).toBe('string');
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

describe('getOperatorExpectedType', () => {
  it('returns number for numeric operators', () => {
    expect(getOperatorExpectedType('greater_than')).toBe('number');
    expect(getOperatorExpectedType('less_than_or_equal')).toBe('number');
    expect(getOperatorExpectedType('between')).toBe('number');
    expect(getOperatorExpectedType('close_to')).toBe('number');
  });

  it('returns boolean for boolean operators', () => {
    expect(getOperatorExpectedType('is_true')).toBe('boolean');
    expect(getOperatorExpectedType('is_false')).toBe('boolean');
  });

  it('returns string for string operators', () => {
    expect(getOperatorExpectedType('starts_with')).toBe('string');
    expect(getOperatorExpectedType('regex')).toBe('string');
    expect(getOperatorExpectedType('contains')).toBe('string');
  });

  it('returns array for collection operators', () => {
    expect(getOperatorExpectedType('length')).toBe('array');
    expect(getOperatorExpectedType('each')).toBe('array');
    expect(getOperatorExpectedType('contains_any')).toBe('array');
  });

  it('returns null for type-agnostic operators', () => {
    expect(getOperatorExpectedType('equals')).toBeNull();
    expect(getOperatorExpectedType('not_equals')).toBeNull();
    expect(getOperatorExpectedType(undefined)).toBeNull();
  });
});

describe('operator-type mismatch detection', () => {
  it('detects string field with greater_than operator', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'name', operator: 'greater_than' },
    ];
    const tgt = target({ sampleData: { name: 'Alice' } });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('string');
    expect(result[0].targetType).toBe('number');
    expect(result[0].severity).toBe('warning');
    expect(result[0].message).toContain('greater_than');
    expect(result[0].message).toContain('expects number');
    expect(result[0].suggestedOperator).toBe('equals');
  });

  it('detects number field with starts_with operator', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'age', sourceId: 's1', targetPath: 'age', operator: 'starts_with' },
    ];
    const tgt = target({ sampleData: { age: 30 } });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('number');
    expect(result[0].targetType).toBe('string');
    expect(result[0].message).toContain('starts_with');
    expect(result[0].suggestedOperator).toBe('greater_than_or_equal');
  });

  it('detects string field with is_true operator', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'name', operator: 'is_true' },
    ];
    const tgt = target({ sampleData: { name: 'Alice' } });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].targetType).toBe('boolean');
    expect(result[0].message).toContain('is_true');
  });

  it('detects string field with length operator (expects array)', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'name', operator: 'length' },
    ];
    const tgt = target({ sampleData: { name: 'Alice' } });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(1);
    expect(result[0].targetType).toBe('array');
    expect(result[0].message).toContain('length');
  });

  it('does not flag numeric field with greater_than operator', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'age', sourceId: 's1', targetPath: 'age', operator: 'greater_than' },
    ];
    const tgt = target({ sampleData: { age: 30 } });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(0);
  });

  it('does not flag boolean field with is_true operator', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'active', sourceId: 's1', targetPath: 'active', operator: 'is_true' },
    ];
    const tgt = target({ sampleData: { active: true } });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(0);
  });

  it('does not flag null source with numeric operator', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'score', sourceId: 's1', targetPath: 'score', operator: 'greater_than' },
    ];
    const tgt = target({ sampleData: { score: null } });
    const result = detectTypeMismatches(mappings, sources, tgt);
    expect(result).toHaveLength(0);
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
    expect(result[0].suggestedFix).toBe('$parseFloat($.name)');
    expect(result[0].suggestedFix).not.toContain('$.$.name');
  });

  it('adds $.prefix to sourcePaths without it', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userAge' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].suggestedFix).toBe('$parseFloat($.name)');
  });
});

describe('suggestTypeFixExpression', () => {
  it('returns object conversion suggestions', () => {
    expect(suggestTypeFixExpression('object', 'string', 'address')).toBe('$toString($.address)');
    expect(suggestTypeFixExpression('string', 'object', 'payload')).toBe('$parse($.payload)');
  });
});

describe('activeSourceId fallback', () => {
  it('uses activeSourceId when mapping has no sourceId', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: '', targetPath: 'userAge' },
    ];
    const result = detectTypeMismatches(mappings, sources, target(), 's1');
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('string');
    expect(result[0].targetType).toBe('number');
  });

  it('returns no mismatch when both sourceId and activeSourceId are missing', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: '', targetPath: 'userAge' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(0);
  });
});

describe('array→scalar and scalar→array coercion', () => {
  it('suggests $join for array→string', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('array');
    expect(result[0].targetType).toBe('string');
    expect(result[0].suggestedFix).toContain('$join');
  });

  it('suggests $count for array→number', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'userAge' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result).toHaveLength(1);
    expect(result[0].suggestedFix).toContain('$count');
  });
});

describe('looksLikeDate', () => {
  it('detects ISO 8601 dates', () => {
    expect(looksLikeDate('2024-01-15T10:30:00Z')).toBe(true);
    expect(looksLikeDate('2024-01-15T10:30')).toBe(true);
  });

  it('detects MM/DD/YYYY dates', () => {
    expect(looksLikeDate('01/15/2024')).toBe(true);
    expect(looksLikeDate('12/31/2023')).toBe(true);
  });

  it('detects YYYY/MM/DD dates', () => {
    expect(looksLikeDate('2024/01/15')).toBe(true);
  });

  it('returns false for non-dates', () => {
    expect(looksLikeDate('hello')).toBe(false);
    expect(looksLikeDate(42)).toBe(false);
    expect(looksLikeDate(null)).toBe(false);
    expect(looksLikeDate('')).toBe(false);
  });
});

describe('date format detection in detectTypeMismatches', () => {
  it('suggests $dateFormat when source looks like a date', () => {
    const dateSources: MapperSource[] = [
      { id: 's1', label: 'API', sampleData: { created: '2024-01-15T10:30:00Z', label: 'test' } },
    ];
    const tgt = target({ sampleData: { output: 'plain text' } });
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'created', sourceId: 's1', targetPath: 'output' },
    ];
    const result = detectTypeMismatches(mappings, dateSources, tgt);
    const dateMismatch = result.find((m) => m.mappingId === 'm1');
    expect(dateMismatch).toBeDefined();
    expect(dateMismatch!.suggestedFix).toContain('$formatDate');
    expect(dateMismatch!.severity).toBe('info');
  });

  it('does not flag mismatch when both sides are dates', () => {
    const dateSources: MapperSource[] = [
      { id: 's1', label: 'API', sampleData: { created: '2024-01-15T10:30:00Z' } },
    ];
    const tgt = target({ sampleData: { updated: '01/15/2024' } });
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'created', sourceId: 's1', targetPath: 'updated' },
    ];
    const result = detectTypeMismatches(mappings, dateSources, tgt);
    const dateMismatch = result.find((m) => m.mappingId === 'm1');
    expect(dateMismatch).toBeUndefined();
  });

  it('does not flag non-date strings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = detectTypeMismatches(mappings, sources, target());
    expect(result.filter((m) => m.sourceType === 'date-string')).toHaveLength(0);
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

  it('$toString evaluates object to JSON string', () => {
    const result = evaluateMapperExpression(
      '$toString($.address)',
      [{ id: 's1', label: 'S', sampleData: { address: { city: 'NYC' } } }],
      's1',
    );
    expect(result.error).toBeUndefined();
    expect(result.value).toBe('{"city":"NYC"}');
  });

  it('$parse evaluates JSON string to object', () => {
    const result = evaluateMapperExpression(
      '$parse($.jsonBlob)',
      [{ id: 's1', label: 'S', sampleData: { jsonBlob: '{"city":"NYC"}' } }],
      's1',
    );
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ city: 'NYC' });
  });
});

describe('suggestOperatorForType', () => {
  it('suggests equals for string', () => {
    expect(suggestOperatorForType('string')).toBe('equals');
  });

  it('suggests greater_than_or_equal for number', () => {
    expect(suggestOperatorForType('number')).toBe('greater_than_or_equal');
  });

  it('suggests is_true for boolean', () => {
    expect(suggestOperatorForType('boolean')).toBe('is_true');
  });

  it('suggests length for array', () => {
    expect(suggestOperatorForType('array')).toBe('length');
  });

  it('suggests exists for object', () => {
    expect(suggestOperatorForType('object')).toBe('exists');
  });

  it('suggests equals for unknown types', () => {
    expect(suggestOperatorForType('null')).toBe('equals');
    expect(suggestOperatorForType('unknown')).toBe('equals');
  });
});
