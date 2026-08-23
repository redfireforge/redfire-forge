import { describe, it, expect, vi } from 'vitest';
import {
  evaluateMapperExpression,
  buildMapperResolveVariable,
  resolveMapperPath,
  formatExpressionResult,
} from './mapperExpressionEvaluator';
import type { MapperSource } from '../types';
import * as expressionEvaluator from '@workflow/utils/expressionEvaluator';

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

  it('resolves JSON null value as "null" string, not undefined', () => {
    const nullSources: MapperSource[] = [
      { id: 's1', label: 'Src', sampleData: { status: null, name: 'test' } },
    ];
    const r = buildMapperResolveVariable(nullSources, 's1');
    expect(r('$.status')).toBe('null');
    expect(r('$.name')).toBe('test');
  });

  it('resolves JSON null via sourceId.path as "null" string', () => {
    const nullSources: MapperSource[] = [
      { id: 'src', label: 'Src', sampleData: { val: null } },
    ];
    const r = buildMapperResolveVariable(nullSources, 'src');
    expect(r('src.val')).toBe('null');
  });

  it('returns [Object] for circular references instead of throwing', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    const circSources: MapperSource[] = [
      { id: 'c1', label: 'Circ', sampleData: circular },
    ];
    const r = buildMapperResolveVariable(circSources, 'c1');
    expect(r('$.self')).toBe('[Object]');
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
  it('maps evaluateExpression throw Error to result.error', () => {
    const spy = vi.spyOn(expressionEvaluator, 'evaluateExpression').mockImplementation(() => {
      throw new Error('boom');
    });
    try {
      const result = evaluateMapperExpression('1', sources, 's1');
      expect(result.error).toBe('boom');
      expect(result.preview).toBe('');
      expect(result.value).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('maps non-Error throw from evaluateExpression to string', () => {
    const spy = vi.spyOn(expressionEvaluator, 'evaluateExpression').mockImplementation(() => {
      throw 'plain';
    });
    try {
      const result = evaluateMapperExpression('1', sources, 's1');
      expect(result.error).toBe('plain');
    } finally {
      spy.mockRestore();
    }
  });

  it('clears preview when evaluateExpression returns error field', () => {
    const spy = vi.spyOn(expressionEvaluator, 'evaluateExpression').mockReturnValue({
      value: undefined,
      error: 'parse failed',
    });
    try {
      const result = evaluateMapperExpression('x', sources, 's1');
      expect(result.preview).toBe('');
      expect(result.error).toBe('parse failed');
    } finally {
      spy.mockRestore();
    }
  });

  it('leaves bare $. when path is only dollar-dot', () => {
    const result = evaluateMapperExpression('$.', sources, 's1');
    expect(result.error || String(result.value)).toBeTruthy();
  });

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

  it('handles throwing custom function gracefully via evaluator catch', () => {
    const badFn = {
      name: '$boom',
      category: 'Test',
      signature: '$boom()',
      description: 'throws',
      args: [],
      returnType: 'never',
      examples: [],
      evaluate: () => { throw new Error('kaboom'); },
    };
    const result = evaluateMapperExpression('$boom()', sources, 's1', [badFn]);
    // evaluateExpression catches function throws and returns error in value string
    expect(result.value).toContain('Error');
    expect(result.value).toContain('kaboom');
    expect(result.error).toBeUndefined();
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

  it('preserves backslash escapes inside single-quoted strings when wrapping paths', () => {
    const result = evaluateMapperExpression(`'a\\'$.name'`, sources, 's1');
    expect(result.value).toBeTruthy();
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

  it('parses JSON when resolved leaf is a JSON string', () => {
    const src: MapperSource[] = [{ id: 's1', label: 'S', sampleData: { payload: '{"z":9}' } }];
    expect(resolveMapperPath('payload', src, 's1')).toEqual({ z: 9 });
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

describe('bracket-path resolution in function args', () => {
  const sources: MapperSource[] = [{
    id: 's1',
    label: 'Source',
    sampleData: {
      offers: [
        { offerName: 'OnStar Premium', rank: 1 },
        { offerName: 'WiFi Plan', rank: 2 },
      ],
    },
  }];

  it('$upper(offers[0].offerName) uppercases only the single field', () => {
    const result = evaluateMapperExpression('$upper(offers[0].offerName)', sources, 's1');
    expect(result.error).toBeUndefined();
    expect(result.value).toBe('ONSTAR PREMIUM');
  });

  it('$lower(offers[1].offerName) lowercases only the single field', () => {
    const result = evaluateMapperExpression('$lower(offers[1].offerName)', sources, 's1');
    expect(result.error).toBeUndefined();
    expect(result.value).toBe('wifi plan');
  });

  it('bare bracket path resolves to specific array element', () => {
    const result = evaluateMapperExpression('offers[0].rank', sources, 's1');
    expect(result.error).toBeUndefined();
    expect(result.preview).toBe('1');
  });
});
