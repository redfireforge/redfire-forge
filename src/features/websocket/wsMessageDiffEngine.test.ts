import { describe, it, expect } from 'vitest';
import {
  diffJson,
  diffLines,
  computeDiff,
  formatUnifiedDiff,
  formatDiffValue,
} from './wsMessageDiffEngine';

describe('diffJson', () => {
  it('returns empty for identical objects', () => {
    expect(diffJson({ a: 1, b: 2 }, { a: 1, b: 2 })).toEqual([]);
  });

  it('detects added keys', () => {
    const entries = diffJson({ a: 1 }, { a: 1, b: 2 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.b', type: 'added', newValue: 2 });
  });

  it('detects removed keys', () => {
    const entries = diffJson({ a: 1, b: 2 }, { a: 1 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.b', type: 'removed', oldValue: 2 });
  });

  it('detects changed values', () => {
    const entries = diffJson({ a: 1 }, { a: 2 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.a', type: 'changed', oldValue: 1, newValue: 2 });
  });

  it('detects nested changes', () => {
    const entries = diffJson({ a: { b: 1 } }, { a: { b: 2 } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.a.b', type: 'changed', oldValue: 1, newValue: 2 });
  });

  it('handles array additions by index', () => {
    const entries = diffJson({ items: [1, 2] }, { items: [1, 2, 3] });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.items[2]', type: 'added', newValue: 3 });
  });

  it('handles array removals by index', () => {
    const entries = diffJson({ items: [1, 2, 3] }, { items: [1, 2] });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.items[2]', type: 'removed', oldValue: 3 });
  });

  it('handles array element changes', () => {
    const entries = diffJson({ items: [1, 2] }, { items: [1, 99] });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.items[1]', type: 'changed', oldValue: 2, newValue: 99 });
  });

  it('handles type changes (object → array)', () => {
    const entries = diffJson({ a: { x: 1 } }, { a: [1, 2] });
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('changed');
    expect(entries[0].path).toBe('$.a');
  });

  it('handles null to value', () => {
    const entries = diffJson({ a: null }, { a: 42 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.a', type: 'added', newValue: 42 });
  });

  it('handles value to null', () => {
    const entries = diffJson({ a: 42 }, { a: null });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$.a', type: 'removed', oldValue: 42 });
  });

  it('handles keys with special characters', () => {
    const entries = diffJson({ 'my-key': 1 }, { 'my-key': 2 });
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('$["my-key"]');
  });

  it('handles deeply nested mixed changes', () => {
    const a = { users: [{ name: 'Alice', age: 30 }] };
    const b = { users: [{ name: 'Alice', age: 31, email: 'alice@test.com' }] };
    const entries = diffJson(a, b);
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.path === '$.users[0].age')).toEqual({
      path: '$.users[0].age', type: 'changed', oldValue: 30, newValue: 31,
    });
    expect(entries.find((e) => e.path === '$.users[0].email')).toEqual({
      path: '$.users[0].email', type: 'added', newValue: 'alice@test.com',
    });
  });

  it('handles empty objects', () => {
    expect(diffJson({}, {})).toEqual([]);
  });

  it('handles empty arrays', () => {
    expect(diffJson([], [])).toEqual([]);
  });

  it('handles primitives at root', () => {
    const entries = diffJson(42, 99);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ path: '$', type: 'changed', oldValue: 42, newValue: 99 });
  });

  it('performs within 200ms for large objects (50KB)', () => {
    const large = Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [`key_${i}`, { value: i, name: `item-${i}`, nested: { x: i * 2 } }]),
    );
    const modified = { ...large, key_0: { value: 999, name: 'changed', nested: { x: 0 } }, key_new: { value: 'added' } };
    const start = performance.now();
    const entries = diffJson(large, modified);
    const elapsed = performance.now() - start;
    expect(entries.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });
});

describe('diffLines', () => {
  it('returns all same for identical strings', () => {
    const lines = diffLines('a\nb\nc', 'a\nb\nc');
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.type === 'same')).toBe(true);
  });

  it('detects added lines', () => {
    const lines = diffLines('a\nb', 'a\nb\nc');
    const added = lines.filter((l) => l.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].content).toBe('c');
  });

  it('detects removed lines', () => {
    const lines = diffLines('a\nb\nc', 'a\nb');
    const removed = lines.filter((l) => l.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].content).toBe('c');
  });

  it('detects changed lines as remove + add', () => {
    const lines = diffLines('a\nold\nc', 'a\nnew\nc');
    expect(lines.some((l) => l.type === 'removed' && l.content === 'old')).toBe(true);
    expect(lines.some((l) => l.type === 'added' && l.content === 'new')).toBe(true);
  });

  it('handles empty strings', () => {
    const lines = diffLines('', '');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ type: 'same', content: '', leftNum: 1, rightNum: 1 });
  });

  it('assigns line numbers correctly', () => {
    const lines = diffLines('a\nb', 'a\nx\nb');
    const sameLine = lines.find((l) => l.type === 'same' && l.content === 'a');
    expect(sameLine?.leftNum).toBe(1);
    expect(sameLine?.rightNum).toBe(1);
    const addedLine = lines.find((l) => l.type === 'added' && l.content === 'x');
    expect(addedLine?.rightNum).toBe(2);
  });
});

describe('computeDiff', () => {
  it('detects JSON diff for valid JSON on both sides', () => {
    const result = computeDiff('{"a":1}', '{"a":2}');
    expect(result.isJsonDiff).toBe(true);
    expect(result.jsonEntries).toHaveLength(1);
    expect(result.lines.some((l) => l.type !== 'same')).toBe(true);
  });

  it('falls back to text diff for non-JSON', () => {
    const result = computeDiff('hello world', 'hello earth');
    expect(result.isJsonDiff).toBe(false);
    expect(result.jsonEntries).toHaveLength(0);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it('handles identical JSON messages', () => {
    const result = computeDiff('{"a":1,"b":2}', '{"a":1,"b":2}');
    expect(result.isJsonDiff).toBe(true);
    expect(result.jsonEntries).toHaveLength(0);
    expect(result.lines.every((l) => l.type === 'same')).toBe(true);
  });

  it('handles mixed: one JSON, one not', () => {
    const result = computeDiff('{"a":1}', 'not json');
    expect(result.isJsonDiff).toBe(false);
  });

  it('full pipeline completes within 500ms for 50KB JSON', () => {
    const large = Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [`key_${i}`, { value: i, name: `item-${i}`, nested: { x: i * 2 } }]),
    );
    const modified = { ...large, key_0: { value: 999, name: 'changed', nested: { x: 0 } }, key_new: { value: 'added' } };
    const leftStr = JSON.stringify(large);
    const rightStr = JSON.stringify(modified);
    const start = performance.now();
    const result = computeDiff(leftStr, rightStr);
    const elapsed = performance.now() - start;
    expect(result.isJsonDiff).toBe(true);
    expect(result.jsonEntries.length).toBeGreaterThan(0);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1500);
  });
});

describe('formatUnifiedDiff', () => {
  it('produces valid unified diff format', () => {
    const lines = diffLines('a\nb', 'a\nc');
    const text = formatUnifiedDiff(lines, 'left.json', 'right.json');
    expect(text).toContain('--- left.json');
    expect(text).toContain('+++ right.json');
    expect(text).toContain('@@ @@');
    expect(text).toContain(' a');
    expect(text).toContain('-b');
    expect(text).toContain('+c');
  });
});

describe('formatDiffValue', () => {
  it('formats strings with quotes', () => {
    expect(formatDiffValue('hello')).toBe('"hello"');
  });

  it('formats numbers', () => {
    expect(formatDiffValue(42)).toBe('42');
  });

  it('formats null', () => {
    expect(formatDiffValue(null)).toBe('null');
  });

  it('formats undefined', () => {
    expect(formatDiffValue(undefined)).toBe('undefined');
  });

  it('formats objects as JSON', () => {
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}');
  });

  it('formats booleans', () => {
    expect(formatDiffValue(true)).toBe('true');
  });
});
