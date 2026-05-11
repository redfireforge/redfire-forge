import { describe, it, expect } from 'vitest';
import {
  evaluateMapperExpression,
  buildMapperResolveVariable,
  resolveMapperPath,
  formatExpressionResult,
} from './mapperExpressionEvaluator';
import type { MapperSource } from '../types';

const sources: MapperSource[] = [
  {
    id: 's1',
    label: 'Response Body',
    sampleData: {
      name: 'Alice',
      age: 30,
      address: { city: 'NYC', zip: '10001' },
      tags: ['admin', 'user'],
    },
  },
  {
    id: 's2',
    label: 'Headers',
    sampleData: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc-123' },
  },
];

describe('buildMapperResolveVariable', () => {
  const resolve = buildMapperResolveVariable(sources, 's1');

  it('resolves $.path against active source', () => {
    expect(resolve('$.name')).toBe('Alice');
  });

  it('resolves nested $.path', () => {
    expect(resolve('$.address.city')).toBe('NYC');
  });

  it('resolves array index via $.path', () => {
    expect(resolve('$.tags[0]')).toBe('admin');
  });

  it('resolves $ alone as entire source', () => {
    const val = resolve('$');
    expect(val).toContain('Alice');
  });

  it('resolves sourceId.path for alternate source', () => {
    expect(resolve('s2.Content-Type')).toBe('application/json');
  });

  it('resolves bare field name against active source', () => {
    expect(resolve('name')).toBe('Alice');
  });

  it('returns undefined for non-existent path', () => {
    expect(resolve('$.nonExistent')).toBeUndefined();
  });

  it('returns undefined for non-existent source', () => {
    expect(resolve('s99.name')).toBeUndefined();
  });

  it('handles string sampleData (JSON string)', () => {
    const strSources: MapperSource[] = [
      { id: 's1', label: 'Src', sampleData: '{"color":"red"}' },
    ];
    const r = buildMapperResolveVariable(strSources, 's1');
    expect(r('$.color')).toBe('red');
  });

  it('handles invalid JSON string gracefully', () => {
    const badSources: MapperSource[] = [
      { id: 's1', label: 'Src', sampleData: '{bad json' },
    ];
    const r = buildMapperResolveVariable(badSources, 's1');
    expect(r('$.name')).toBeUndefined();
  });

  it('handles null sampleData', () => {
    const emptySources: MapperSource[] = [
      { id: 's1', label: 'Src' },
    ];
    const r = buildMapperResolveVariable(emptySources, 's1');
    expect(r('$.name')).toBeUndefined();
  });

  it('returns object values as JSON string', () => {
    expect(resolve('$.address')).toBe('{"city":"NYC","zip":"10001"}');
  });

  it('returns array values as JSON string', () => {
    expect(resolve('$.tags')).toBe('["admin","user"]');
  });

  it('returns number as string', () => {
    expect(resolve('$.age')).toBe('30');
  });
});

describe('evaluateMapperExpression', () => {
  it('evaluates a function with $.path arg', () => {
    const result = evaluateMapperExpression('$upper($.name)', sources, 's1');
    expect(result.value).toBe('ALICE');
    expect(result.preview).toBe('ALICE');
    expect(result.error).toBeUndefined();
  });

  it('evaluates nested functions', () => {
    const result = evaluateMapperExpression('$upper($trim($.name))', sources, 's1');
    expect(result.value).toBe('ALICE');
  });

  it('evaluates bare path as variable', () => {
    const result = evaluateMapperExpression('name', sources, 's1');
    expect(result.value).toBe('Alice');
  });

  it('evaluates string literal', () => {
    const result = evaluateMapperExpression('"hello"', sources, 's1');
    expect(result.value).toBe('hello');
  });

  it('evaluates number literal', () => {
    const result = evaluateMapperExpression('42', sources, 's1');
    expect(result.value).toBe(42);
  });

  it('returns error for unknown function', () => {
    const result = evaluateMapperExpression('$nonExistent($.name)', sources, 's1');
    expect(result.value).toContain('nonExistent');
  });

  it('returns empty preview on error', () => {
    const result = evaluateMapperExpression('', sources, 's1');
    expect(result.value).toBe('');
    expect(result.preview).toBe('');
  });

  it('evaluates $concat with multiple args', () => {
    const result = evaluateMapperExpression('$concat($.name, " from ", $.address.city)', sources, 's1');
    expect(result.value).toBe('Alice from NYC');
  });

  it('supports {{var}} syntax for backward compat', () => {
    const result = evaluateMapperExpression('$upper({{name}})', sources, 's1');
    // {{name}} is treated as a variable → resolveVariable tries bare 'name' → finds 'Alice'
    expect(result.value).toBe('ALICE');
  });

  it('evaluates with alternate source using hyphenated key', () => {
    const result = evaluateMapperExpression('$upper($.Content-Type)', sources, 's2');
    expect(result.value).toBe('APPLICATION/JSON');
    expect(result.error).toBeUndefined();
  });

  it('does not wrap $.path inside string literals', () => {
    const result = evaluateMapperExpression('"$.name is a path"', sources, 's1');
    expect(result.value).toBe('$.name is a path');
  });

  it('does not double-wrap already-wrapped {{$.path}}', () => {
    const result = evaluateMapperExpression('$upper({{$.name}})', sources, 's1');
    expect(result.value).toBe('ALICE');
  });

  it('handles $.X-Request-Id with multiple hyphens', () => {
    const result = evaluateMapperExpression('$.X-Request-Id', sources, 's2');
    expect(result.value).toBe('abc-123');
  });

  it('wraps bracket paths like $.tags[0] inside function calls', () => {
    const result = evaluateMapperExpression('$upper($.tags[0])', sources, 's1');
    expect(result.value).toBe('ADMIN');
  });

  it('wraps bracket paths with nested indices like $.items[1].name', () => {
    const src: MapperSource[] = [
      { id: 's1', label: 'Test', sampleData: { items: [{ name: 'first' }, { name: 'second' }] } },
    ];
    const result = evaluateMapperExpression('$upper($.items[1].name)', src, 's1');
    expect(result.value).toBe('SECOND');
  });
});

describe('evaluateMapperExpression – custom functions', () => {
  it('registers and uses custom adapter function', () => {
    const customFns = [{
      name: '$myCustom',
      category: 'Custom',
      signature: '$myCustom(value) → string',
      description: 'Custom test function',
      args: [{ name: 'value', type: 'string', required: true, description: 'Input' }],
      returnType: 'string',
      examples: [{ input: '$myCustom("a")', output: 'CUSTOM:a' }],
      evaluate: (v: unknown) => `CUSTOM:${String(v)}`,
    }];

    const result = evaluateMapperExpression('$myCustom($.name)', sources, 's1', customFns);
    expect(result.value).toBe('CUSTOM:Alice');
  });

  it('unregisters custom functions after evaluation', () => {
    const customFns = [{
      name: '$tempFn',
      category: 'Custom',
      signature: '$tempFn() → string',
      description: 'Temporary',
      args: [],
      returnType: 'string',
      examples: [],
      evaluate: () => 'temp',
    }];

    evaluateMapperExpression('$tempFn()', sources, 's1', customFns);
    // Second call without custom functions — should NOT find $tempFn
    const result2 = evaluateMapperExpression('$tempFn()', sources, 's1');
    expect(String(result2.value)).toContain('tempFn');
  });
});

describe('resolveMapperPath', () => {
  it('resolves a simple path', () => {
    expect(resolveMapperPath('name', sources, 's1')).toBe('Alice');
  });

  it('resolves a $.prefixed path', () => {
    expect(resolveMapperPath('$.age', sources, 's1')).toBe(30);
  });

  it('resolves nested path', () => {
    expect(resolveMapperPath('address.city', sources, 's1')).toBe('NYC');
  });

  it('returns undefined for missing path', () => {
    expect(resolveMapperPath('nope', sources, 's1')).toBeUndefined();
  });

  it('resolves object path as object', () => {
    const result = resolveMapperPath('address', sources, 's1');
    expect(result).toEqual({ city: 'NYC', zip: '10001' });
  });

  it('resolves array path as array', () => {
    const result = resolveMapperPath('tags', sources, 's1');
    expect(result).toEqual(['admin', 'user']);
  });
});

describe('formatExpressionResult (re-export)', () => {
  it('formats string', () => {
    expect(formatExpressionResult('hello')).toBe('hello');
  });

  it('formats number', () => {
    expect(formatExpressionResult(42)).toBe('42');
  });

  it('formats object as JSON', () => {
    expect(formatExpressionResult({ a: 1 })).toBe('{"a":1}');
  });

  it('formats null as empty string', () => {
    expect(formatExpressionResult(null)).toBe('');
  });
});
