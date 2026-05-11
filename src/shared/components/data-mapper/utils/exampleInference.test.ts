import { describe, it, expect } from 'vitest';
import { inferMappingsFromExamples, parseExampleJson } from './exampleInference';
import type { ExamplePair } from './exampleInference';

describe('parseExampleJson', () => {
  it('parses valid JSON object', () => {
    const result = parseExampleJson('{"name": "Alice"}');
    expect(result.data).toEqual({ name: 'Alice' });
    expect(result.error).toBeUndefined();
  });

  it('parses valid JSON array', () => {
    const result = parseExampleJson('[1, 2, 3]');
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.error).toBeUndefined();
  });

  it('returns error for empty string', () => {
    const result = parseExampleJson('');
    expect(result.error).toBe('Empty input');
  });

  it('returns error for primitive', () => {
    const result = parseExampleJson('"hello"');
    expect(result.error).toContain('object or array');
  });

  it('returns error for invalid JSON', () => {
    const result = parseExampleJson('{bad}');
    expect(result.error).toBeTruthy();
  });

  it('trims whitespace', () => {
    const result = parseExampleJson('  {"a": 1}  ');
    expect(result.data).toEqual({ a: 1 });
  });
});

describe('inferMappingsFromExamples', () => {
  it('returns empty for no examples', () => {
    expect(inferMappingsFromExamples([])).toEqual([]);
  });

  it('detects exact value match in single example', () => {
    const examples: ExamplePair[] = [
      { input: { name: 'Alice', age: 30 }, output: { fullName: 'Alice', years: 30 } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.length).toBe(2);
    const nameMapping = result.find((r) => r.targetPath === 'fullName');
    expect(nameMapping?.sourcePath).toBe('name');
    expect(nameMapping?.confidence).toBeGreaterThanOrEqual(80);
    const ageMapping = result.find((r) => r.targetPath === 'years');
    expect(ageMapping?.sourcePath).toBe('age');
  });

  it('exact match across multiple examples has higher confidence', () => {
    const examples: ExamplePair[] = [
      { input: { name: 'Alice' }, output: { fullName: 'Alice' } },
      { input: { name: 'Bob' }, output: { fullName: 'Bob' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.length).toBe(1);
    expect(result[0].confidence).toBe(95);
  });

  it('detects lowercase transformation', () => {
    const examples: ExamplePair[] = [
      { input: { Name: 'ALICE' }, output: { name: 'alice' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.length).toBe(1);
    expect(result[0].expression).toContain('$lowercase');
  });

  it('detects string→number transformation', () => {
    const examples: ExamplePair[] = [
      { input: { price: '42.5' }, output: { amount: 42.5 } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.length).toBe(1);
    expect(result[0].expression).toContain('$parseFloat');
  });

  it('detects number→string transformation', () => {
    const examples: ExamplePair[] = [
      { input: { count: 42 }, output: { label: '42' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.length).toBe(1);
    expect(result[0].expression).toContain('$toString');
  });

  it('detects array join transformation', () => {
    const examples: ExamplePair[] = [
      { input: { tags: ['a', 'b'] }, output: { tagStr: 'a, b' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.length).toBe(1);
    expect(result[0].expression).toContain('$join');
  });

  it('handles nested objects', () => {
    const examples: ExamplePair[] = [
      {
        input: { user: { email: 'a@b.com' } },
        output: { contact: { mail: 'a@b.com' } },
      },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.sourcePath === 'user.email' && r.targetPath === 'contact.mail')).toBe(true);
  });

  it('results are sorted by confidence descending', () => {
    const examples: ExamplePair[] = [
      { input: { a: 'hello', b: 42 }, output: { x: 'hello', y: '42' } },
    ];
    const result = inferMappingsFromExamples(examples);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });

  it('does not double-map source or target paths', () => {
    const examples: ExamplePair[] = [
      { input: { a: 'X', b: 'X' }, output: { x: 'X', y: 'X' } },
    ];
    const result = inferMappingsFromExamples(examples);
    const sources = result.map((r) => r.sourcePath);
    const targets = result.map((r) => r.targetPath);
    expect(new Set(sources).size).toBe(sources.length);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('detects trim transformation', () => {
    const examples: ExamplePair[] = [
      { input: { val: '  hello  ' }, output: { clean: 'hello' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.expression?.includes('$trim'))).toBe(true);
  });

  it('detects array count transformation', () => {
    const examples: ExamplePair[] = [
      { input: { items: [1, 2, 3] }, output: { count: 3 } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.expression?.includes('$count'))).toBe(true);
  });

  it('handles multiple examples with partial matches', () => {
    const examples: ExamplePair[] = [
      { input: { name: 'Alice', age: 30 }, output: { fullName: 'Alice', years: 30 } },
      { input: { name: 'Bob', age: 25 }, output: { fullName: 'Bob', years: 25 } },
      { input: { name: 'Charlie', age: 35 }, output: { fullName: 'Charlie', years: 35 } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.confidence >= 90)).toBe(true);
  });

  it('detects uppercase transformation', () => {
    const examples: ExamplePair[] = [
      { input: { code: 'abc' }, output: { CODE: 'ABC' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.expression?.includes('$uppercase'))).toBe(true);
  });

  it('returns empty when no value matches', () => {
    const examples: ExamplePair[] = [
      { input: { a: 'foo' }, output: { b: 'bar' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result).toEqual([]);
  });

  it('detects boolean→string transformation', () => {
    const examples: ExamplePair[] = [
      { input: { active: true }, output: { status: 'true' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.expression?.includes('$toString'))).toBe(true);
  });

  it('detects string→boolean transformation correctly', () => {
    const examples: ExamplePair[] = [
      { input: { val: 'true' }, output: { flag: true } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.expression?.includes('$toBool'))).toBe(true);
  });

  it('does not infer string→boolean for empty string', () => {
    const examples: ExamplePair[] = [
      { input: { val: '' }, output: { flag: false } },
    ];
    const result = inferMappingsFromExamples(examples);
    const boolMatch = result.find((r) => r.targetPath === 'flag' && r.expression?.includes('$toBool'));
    expect(boolMatch).toBeUndefined();
  });

  it('detects string split transformation', () => {
    const examples: ExamplePair[] = [
      { input: { csv: 'a,b,c' }, output: { items: ['a', 'b', 'c'] } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.expression?.includes('$split'))).toBe(true);
  });

  it('handles null values in input/output', () => {
    const examples: ExamplePair[] = [
      { input: { a: null }, output: { b: null } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.sourcePath === 'a' && r.targetPath === 'b')).toBe(true);
  });

  it('handles array join with no spaces', () => {
    const examples: ExamplePair[] = [
      { input: { tags: ['a', 'b'] }, output: { tagStr: 'a,b' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.expression?.includes('$join'))).toBe(true);
  });

  it('handles partial exact matches across multiple examples', () => {
    const examples: ExamplePair[] = [
      { input: { a: 'X' }, output: { b: 'X' } },
      { input: { a: 'Y' }, output: { b: 'Z' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.length).toBe(1);
    expect(result[0].confidence).toBe(80);
  });

  it('handles containment / substring match', () => {
    const examples: ExamplePair[] = [
      { input: { name: 'Alice Johnson' }, output: { greeting: 'Hello Alice Johnson, welcome!' } },
    ];
    const result = inferMappingsFromExamples(examples);
    expect(result.some((r) => r.reason.includes('contained'))).toBe(true);
  });

  it('parseExampleJson returns error for null JSON literal', () => {
    const result = parseExampleJson('null');
    expect(result.error).toContain('object or array');
  });
});

describe('parseExampleJson edge cases', () => {
  it('parses nested objects', () => {
    const result = parseExampleJson('{"a": {"b": 1}}');
    expect(result.data).toEqual({ a: { b: 1 } });
  });

  it('handles number literal as invalid', () => {
    const result = parseExampleJson('42');
    expect(result.error).toContain('object or array');
  });
});
