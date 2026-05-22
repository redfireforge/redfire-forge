import { describe, it, expect } from 'vitest';
import { safeParse, coerceSampleData, toJsonPathRef, resolveSourceValue, resolveTargetValue } from './mapperParsing';
import type { Mapping, MapperSource, MapperTarget } from '../types';

describe('safeParse', () => {
  it('parses valid JSON', () => {
    expect(safeParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns null for invalid JSON', () => {
    expect(safeParse('not json')).toBeNull();
  });

  it('parses JSON array', () => {
    expect(safeParse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('parses string literal', () => {
    expect(safeParse('"hello"')).toBe('hello');
  });

  it('parses number literal', () => {
    expect(safeParse('42')).toBe(42);
  });
});

describe('coerceSampleData', () => {
  it('returns undefined for null', () => {
    expect(coerceSampleData(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(coerceSampleData(undefined)).toBeUndefined();
  });

  it('returns object as-is', () => {
    const obj = { name: 'test' };
    expect(coerceSampleData(obj)).toBe(obj);
  });

  it('returns array as-is', () => {
    const arr = [1, 2, 3];
    expect(coerceSampleData(arr)).toBe(arr);
  });

  it('parses JSON string', () => {
    expect(coerceSampleData('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns undefined for unparseable string', () => {
    expect(coerceSampleData('not json')).toBeUndefined();
  });

  it('returns number as-is', () => {
    expect(coerceSampleData(42)).toBe(42);
  });

  it('returns boolean as-is', () => {
    expect(coerceSampleData(true)).toBe(true);
  });

  it('returns undefined for unsupported types', () => {
    expect(coerceSampleData(() => {})).toBeUndefined();
    expect(coerceSampleData(Symbol('x'))).toBeUndefined();
  });
});

describe('toJsonPathRef', () => {
  it('adds $. prefix to bare path', () => {
    expect(toJsonPathRef('name')).toBe('$.name');
  });

  it('preserves existing $. prefix', () => {
    expect(toJsonPathRef('$.name')).toBe('$.name');
  });

  it('handles nested path', () => {
    expect(toJsonPathRef('user.name')).toBe('$.user.name');
  });

  it('handles $. with nested path', () => {
    expect(toJsonPathRef('$.user.name')).toBe('$.user.name');
  });
});

describe('resolveSourceValue', () => {
  const sources: MapperSource[] = [
    { id: 's1', label: 'Source 1', sampleData: { name: 'Alice', age: 30 } },
    { id: 's2', label: 'Source 2', sampleData: '{"city":"NYC"}' },
  ];

  it('resolves value from object sample data', () => {
    const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'out' };
    expect(resolveSourceValue(mapping, sources)).toBe('Alice');
  });

  it('resolves value from string sample data', () => {
    const mapping: Mapping = { id: 'm2', sourcePath: 'city', sourceId: 's2', targetPath: 'out' };
    expect(resolveSourceValue(mapping, sources)).toBe('NYC');
  });

  it('returns undefined for missing source', () => {
    const mapping: Mapping = { id: 'm3', sourcePath: 'name', sourceId: 'missing', targetPath: 'out' };
    expect(resolveSourceValue(mapping, sources)).toBeUndefined();
  });

  it('returns undefined for missing path', () => {
    const mapping: Mapping = { id: 'm4', sourcePath: 'nonexistent', sourceId: 's1', targetPath: 'out' };
    expect(resolveSourceValue(mapping, sources)).toBeUndefined();
  });

  it('falls back to activeSourceId when sourceId not set', () => {
    const mapping: Mapping = { id: 'm5', sourcePath: 'name', sourceId: '', targetPath: 'out' };
    expect(resolveSourceValue(mapping, sources, 's1')).toBe('Alice');
  });

  it('returns undefined when source has no sampleData', () => {
    const noData: MapperSource[] = [{ id: 's1', label: 'Source 1', sampleData: undefined }];
    const mapping: Mapping = { id: 'm6', sourcePath: 'name', sourceId: 's1', targetPath: 'out' };
    expect(resolveSourceValue(mapping, noData)).toBeUndefined();
  });
});

describe('resolveTargetValue', () => {
  const target: MapperTarget = {
    label: 'Target',
    sampleData: { userName: 'Bob', count: 5 },
  };

  it('resolves value from target sample data', () => {
    expect(resolveTargetValue('userName', target)).toBe('Bob');
  });

  it('resolves nested value', () => {
    const nestedTarget: MapperTarget = {
      label: 'Target',
      sampleData: { user: { name: 'Charlie' } },
    };
    expect(resolveTargetValue('user.name', nestedTarget)).toBe('Charlie');
  });

  it('returns undefined for missing path', () => {
    expect(resolveTargetValue('nonexistent', target)).toBeUndefined();
  });

  it('returns undefined when no sampleData', () => {
    const emptyTarget: MapperTarget = { label: 'Target', sampleData: undefined };
    expect(resolveTargetValue('name', emptyTarget)).toBeUndefined();
  });

  it('parses string sampleData', () => {
    const strTarget: MapperTarget = { label: 'Target', sampleData: '{"name":"Dan"}' };
    expect(resolveTargetValue('name', strTarget)).toBe('Dan');
  });

  it('returns undefined for unparseable string sampleData', () => {
    const badTarget: MapperTarget = { label: 'Target', sampleData: 'not json' };
    expect(resolveTargetValue('name', badTarget)).toBeUndefined();
  });
});
