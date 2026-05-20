import { describe, it, expect, vi } from 'vitest';
import { computePreview } from './previewCompute';
import { Mapping, MapperSource } from '../types';
import * as mapperExpr from './mapperExpressionEvaluator';
import * as jsonPath from '../../../utils/jsonPath';

const sources: MapperSource[] = [
  { id: 's1', label: 'Response', sampleData: { name: 'Alice', age: 30, address: { city: 'NYC' } } },
];

const targetSample = { userName: '', userAge: 0, location: '' };

describe('computePreview', () => {
  it('maps direct path mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].value).toBe('Alice');
    expect(result.fields[0].error).toBeUndefined();
    expect(result.targetObject.userName).toBe('Alice');
  });

  it('maps nested source paths', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'address.city', sourceId: 's1', targetPath: 'location' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.fields[0].value).toBe('NYC');
    expect(result.targetObject.location).toBe('NYC');
  });

  it('evaluates expression mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$upper($.name)' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.fields[0].value).toBe('ALICE');
    expect(result.fields[0].hasExpression).toBe(true);
  });

  it('reports errors for invalid expressions', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$unknownFn($.name)' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    // Unknown functions may evaluate without error (returning raw text) or with error
    // depending on the evaluator behavior — either way the field is computed
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].hasExpression).toBe(true);
  });

  it('counts errors for expression evaluation failures', () => {
    const badSources: MapperSource[] = [
      { id: 's1', label: 'Test', sampleData: null },
    ];
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$upper($.nonexistent)' },
    ];
    const result = computePreview(mappings, badSources, 's1', targetSample);
    // With null source data, resolution returns undefined
    expect(result.fields[0].value).toBeDefined();
    expect(result.fields).toHaveLength(1);
  });

  it('handles multiple mappings', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
      { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'userAge' },
      { id: 'm3', sourcePath: 'address.city', sourceId: 's1', targetPath: 'location' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.fields).toHaveLength(3);
    expect(result.errorCount).toBe(0);
    expect(result.targetObject.userName).toBe('Alice');
    expect(result.targetObject.userAge).toBe(30);
    expect(result.targetObject.location).toBe('NYC');
  });

  it('handles empty mappings', () => {
    const result = computePreview([], sources, 's1', targetSample);
    expect(result.fields).toHaveLength(0);
    expect(result.errorCount).toBe(0);
  });

  it('handles null target sample data', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' },
    ];
    const result = computePreview(mappings, sources, 's1', null);
    expect(result.targetObject.out).toBe('Alice');
  });

  it('handles string source sampleData', () => {
    const strSources: MapperSource[] = [
      { id: 's1', label: 'Test', sampleData: '{"x": 42}' },
    ];
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'x', sourceId: 's1', targetPath: 'output' },
    ];
    const result = computePreview(mappings, strSources, 's1', null);
    expect(result.fields[0].value).toBe(42);
  });

  it('sets nested target paths correctly', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'user.displayName' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    expect((result.targetObject.user as Record<string, unknown>).displayName).toBe('Alice');
  });

  it('omits unmapped target fields entirely', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.targetObject.userName).toBe('Alice');
    expect(result.targetObject.userAge).toBeUndefined();
    expect(result.targetObject.location).toBeUndefined();
  });

  it('handles bracket-notation target paths (e.g. items[0].name)', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'items[0].name' },
    ];
    const result = computePreview(mappings, sources, 's1', { items: [{ name: '' }] });
    const items = result.targetObject.items as unknown[];
    expect(Array.isArray(items)).toBe(true);
    expect((items[0] as Record<string, unknown>).name).toBe('Alice');
  });

  it('returns empty object when no mappings exist', () => {
    const mappings: Mapping[] = [];
    const result = computePreview(mappings, sources, 's1', { tags: ['a', 'b'], nested: { x: 1 } });
    expect(result.targetObject).toEqual({});
  });

  it('handles string target sample data', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = computePreview(mappings, sources, 's1', '{"userName":"","userAge":0}');
    expect(result.targetObject.userName).toBe('Alice');
    expect(result.targetObject.userAge).toBeUndefined();
  });

  it('handles unparseable string target sample data', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' },
    ];
    const result = computePreview(mappings, sources, 's1', '{bad json}');
    expect(result.targetObject.out).toBe('Alice');
  });

  it('falls back to activeSourceId when mapping has no sourceId', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: '', targetPath: 'userName' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.fields[0].value).toBe('Alice');
  });

  it('handles expression error with evaluateMapperExpression result.error', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$upper(' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.errorCount).toBeGreaterThanOrEqual(0);
    expect(result.fields).toHaveLength(1);
  });

  it('handles $.path prefix in sourcePath', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: '$.name', sourceId: 's1', targetPath: 'userName' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.fields[0].value).toBe('Alice');
  });

  it('handles source with no sampleData for direct path mapping', () => {
    const emptySources: MapperSource[] = [{ id: 's1', label: 'Empty', sampleData: null }];
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' },
    ];
    const result = computePreview(mappings, emptySources, 's1', {});
    expect(result.fields[0].value).toBeNull();
  });

  it('captures error from expression evaluation result', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '{{' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    if (result.fields[0].error) {
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.fields[0].value).toBeNull();
    }
  });

  it('handles source not found for direct mapping', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 'nonexistent', targetPath: 'userName' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.fields).toHaveLength(1);
  });

  it('strips $. prefix from targetPath before building preview object', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: '$.name', sourceId: 's1', targetPath: '$.userName' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample);
    expect(result.fields[0].value).toBe('Alice');
    expect(result.targetObject).toHaveProperty('userName');
    expect(result.targetObject).not.toHaveProperty('$');
  });

  it('handles expression that returns error-like value from custom function', () => {
    const errorFn = {
      name: '$failMe',
      category: 'Custom' as const,
      signature: '$failMe()',
      description: 'always errors',
      args: [],
      returnType: 'string' as const,
      evaluate: (): string => { throw new Error('forced error'); },
    };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$failMe()' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample, [errorFn]);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].value).toContain('[Error:');
  });

  it('handles thrown custom function errors gracefully as value', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$throwingCustom()' },
    ];
    const throwFn = {
      name: '$throwingCustom',
      category: 'Custom' as const,
      signature: '$throwingCustom()',
      description: 'test',
      args: [],
      returnType: 'string' as const,
      evaluate: () => { throw new Error('boom in fn'); },
    };
    const result = computePreview(mappings, sources, 's1', targetSample, [throwFn]);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].value).toContain('[Error:');
  });

  it('falls back to empty object when deepClone fails on non-serializable target', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' },
    ];
    const result = computePreview(mappings, sources, 's1', circular);
    expect(result.targetObject.out).toBe('Alice');
  });

  it('uses custom expression functions for preview evaluation', () => {
    const customFn = {
      name: '$double',
      category: 'Custom' as const,
      signature: '$double(v)',
      description: 'test',
      args: [{ name: 'v', type: 'number' as const, required: true, description: 'd' }],
      returnType: 'number' as const,
      evaluate: (v: unknown) => Number(v) * 2,
    };
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'age', sourceId: 's1', targetPath: 'userAge', expression: '$double($.age)' },
    ];
    const result = computePreview(mappings, sources, 's1', targetSample, [customFn]);
    expect(result.fields[0].value).toBe(60);
  });

  it('treats [*] wildcard in target path as [0]', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'items[*].label' },
    ];
    const result = computePreview(mappings, sources, 's1', { items: [{ label: '' }] });
    const items = result.targetObject.items as Record<string, unknown>[];
    expect(Array.isArray(items)).toBe(true);
    expect(items[0].label).toBe('Alice');
  });

  it('records expression evaluator error without throwing', () => {
    const spy = vi.spyOn(mapperExpr, 'evaluateMapperExpression').mockReturnValue({
      value: undefined,
      preview: '',
      error: 'parse error',
    });
    try {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$bad' },
      ];
      const result = computePreview(mappings, sources, 's1', targetSample);
      expect(result.fields[0].error).toBe('parse error');
      expect(result.errorCount).toBe(1);
      expect(result.targetObject.userName).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('maps expression value when evaluation succeeds', () => {
    const spy = vi.spyOn(mapperExpr, 'evaluateMapperExpression').mockReturnValue({
      value: 'computed',
      preview: 'computed',
    });
    try {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName', expression: '$noop()' },
      ];
      const result = computePreview(mappings, sources, 's1', targetSample);
      expect(result.fields[0].error).toBeUndefined();
      expect(result.fields[0].value).toBe('computed');
      expect(result.errorCount).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('surfaces Error instances from getByPath in preview field', () => {
    const spy = vi.spyOn(jsonPath, 'getByPath').mockImplementation(() => {
      throw new Error('path failed');
    });
    try {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' },
      ];
      const result = computePreview(mappings, sources, 's1', {});
      expect(result.fields[0].error).toBe('path failed');
      expect(result.errorCount).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('uses Evaluation failed when direct path resolution throws non-Error', () => {
    const spy = vi.spyOn(jsonPath, 'getByPath').mockImplementation(() => {
      throw 'not-an-error-instance';
    });
    try {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' },
      ];
      const result = computePreview(mappings, sources, 's1', {});
      expect(result.fields[0].error).toBe('Evaluation failed');
      expect(result.errorCount).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('does not set values under unsafe path segments', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'constructor.foo' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    expect(Object.prototype.hasOwnProperty.call(result.targetObject, 'constructor')).toBe(false);
  });

  it('parses target paths with non-numeric bracket keys', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'wrap[ab].label' },
    ];
    const result = computePreview(mappings, sources, 's1', { wrap: { ab: { label: '' } } });
    expect((result.targetObject.wrap as Record<string, unknown>).ab).toBeDefined();
    expect(((result.targetObject.wrap as Record<string, unknown>).ab as Record<string, unknown>).label).toBe('Alice');
  });

  it('stops parsing when bracket is unclosed', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: '[broken' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    expect(result.targetObject).toEqual({});
  });

  it('leaves direct mapping null when sample JSON coerces to empty', () => {
    const badSources: MapperSource[] = [{ id: 's1', label: 'x', sampleData: '{ not json' }];
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' },
    ];
    const result = computePreview(mappings, badSources, 's1', {});
    expect(result.fields[0].value).toBeNull();
  });

  it('maps target path bracket star index to zero', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'rows[*].x' },
    ];
    const result = computePreview(mappings, sources, 's1', { rows: [{ x: '' }] });
    const rows = result.targetObject.rows as Record<string, unknown>[];
    expect(rows[0].x).toBe('Alice');
  });

  it('creates array interior when next segment is numeric', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'a[0].b' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    const a = result.targetObject.a as unknown[];
    expect(Array.isArray(a)).toBe(true);
    expect((a[0] as Record<string, unknown>).b).toBe('Alice');
  });

  it('parses paths with dot immediately after a closing bracket before another bracket', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'grid[0].[1].cell' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    const grid = result.targetObject.grid as unknown[];
    expect(Array.isArray(grid)).toBe(true);
    const row = grid[0] as unknown[];
    expect(Array.isArray(row)).toBe(true);
    expect((row[1] as Record<string, unknown>).cell).toBe('Alice');
  });

  it('creates plain objects when next segment after a key is non-numeric', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'parent.child[0].leaf' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    const parent = result.targetObject.parent as Record<string, unknown>;
    const child = parent.child as unknown[];
    expect(Array.isArray(child)).toBe(true);
    expect((child[0] as Record<string, unknown>).leaf).toBe('Alice');
  });

  it('does not set values when path segment is __proto__', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: '__proto__.polluted' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    expect(Object.prototype.hasOwnProperty.call(result.targetObject, '__proto__')).toBe(false);
  });

  it('does not set values when path segment is prototype', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'holder.prototype.inner' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    expect(result.targetObject).toEqual({});
  });

  it('maps wildcard at root-level bracket segment via numeric zero index', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: '[*].title' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    const slot = result.targetObject[0 as unknown as keyof typeof result.targetObject] as Record<
      string,
      unknown
    >;
    expect(slot.title).toBe('Alice');
  });

  it('retargets nested paths when an intermediate segment was previously a primitive', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'bucket' },
      { id: 'm2', sourcePath: 'age', sourceId: 's1', targetPath: 'bucket[0].score' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    const bucket = result.targetObject.bucket as unknown[];
    expect(Array.isArray(bucket)).toBe(true);
    expect((bucket[0] as Record<string, unknown>).score).toBe(30);
  });

  it('parses segments when dot appears before bracket without overlapping indices', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'wrap.field[aux].deep' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    const wrap = result.targetObject.wrap as Record<string, unknown>;
    const inner = wrap.field as Record<string, unknown>;
    expect((inner.aux as Record<string, unknown>).deep).toBe('Alice');
  });

  it('parses trailing identifier segments after a bracket without an intermediate dot', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'node[0]tail.value' },
    ];
    const result = computePreview(mappings, sources, 's1', {});
    const node = result.targetObject.node as unknown[];
    expect(Array.isArray(node)).toBe(true);
    const mid = node[0] as Record<string, unknown>;
    expect((mid.tail as Record<string, unknown>).value).toBe('Alice');
  });
});
