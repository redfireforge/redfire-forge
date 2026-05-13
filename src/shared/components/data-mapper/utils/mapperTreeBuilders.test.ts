import { describe, it, expect } from 'vitest';
import { parseSampleToTree, parseSampleData, buildTargetTree } from './mapperTreeBuilders';

describe('parseSampleToTree', () => {
  it('returns tree from parsed object', () => {
    const tree = parseSampleToTree({ name: 'Alice', age: 30 });
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(2);
  });

  it('returns tree from JSON string', () => {
    const tree = parseSampleToTree('{"a":1}');
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(1);
    expect(tree!.children![0].key).toBe('a');
  });

  it('returns null for null input', () => {
    expect(parseSampleToTree(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseSampleToTree(undefined)).toBeNull();
  });

  it('returns null for invalid JSON string', () => {
    expect(parseSampleToTree('not-json')).toBeNull();
  });

  it('handles nested objects', () => {
    const tree = parseSampleToTree({ user: { name: 'Bob' } });
    expect(tree).not.toBeNull();
    expect(tree!.children![0].key).toBe('user');
    expect(tree!.children![0].children).toHaveLength(1);
  });

  it('handles arrays', () => {
    const tree = parseSampleToTree([1, 2, 3]);
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(3);
  });

  it('handles empty object', () => {
    const tree = parseSampleToTree({});
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(0);
  });
});

describe('parseSampleData', () => {
  it('parses a JSON string', () => {
    expect(parseSampleData('{"x":1}')).toEqual({ x: 1 });
  });

  it('returns the object as-is if not a string', () => {
    const obj = { x: 1 };
    expect(parseSampleData(obj)).toBe(obj);
  });

  it('returns undefined for null', () => {
    expect(parseSampleData(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(parseSampleData(undefined)).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseSampleData('{{bad')).toBeUndefined();
  });
});

describe('buildTargetTree', () => {
  it('builds tree from sampleData string', () => {
    const result = buildTargetTree({ sampleData: '{"a":1,"b":2}' });
    expect(result.tree).not.toBeNull();
    expect(result.tree!.children).toHaveLength(2);
    expect(result.targetData).toEqual({ a: 1, b: 2 });
  });

  it('builds tree from sampleData object', () => {
    const data = { items: [1, 2] };
    const result = buildTargetTree({ sampleData: data });
    expect(result.tree).not.toBeNull();
    expect(result.targetData).toBe(data);
  });

  it('builds tree from fields when no sampleData', () => {
    const result = buildTargetTree({
      fields: [
        { path: '$.name', label: 'Name' },
        { path: '$.age', label: 'Age' },
      ],
    });
    expect(result.tree).not.toBeNull();
    expect(result.targetData).toBeUndefined();
  });

  it('returns null tree when no sampleData and no fields', () => {
    const result = buildTargetTree({});
    expect(result.tree).toBeNull();
    expect(result.targetData).toBeUndefined();
  });

  it('returns null tree when sampleData is invalid JSON', () => {
    const result = buildTargetTree({ sampleData: '{{bad' });
    expect(result.tree).toBeNull();
  });

  it('returns null tree for empty fields array', () => {
    const result = buildTargetTree({ fields: [] });
    expect(result.tree).toBeNull();
  });

  it('prefers sampleData over fields', () => {
    const result = buildTargetTree({
      sampleData: '{"x":1}',
      fields: [{ path: '$.y', label: 'Y' }],
    });
    expect(result.tree!.children![0].key).toBe('x');
    expect(result.targetData).toEqual({ x: 1 });
  });
});
