/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  collectFieldEntries,
  captureSchemaSnapshot,
  captureSnapshotPair,
  loadSnapshot,
  saveSnapshot,
  deleteSnapshot,
} from './schemaSnapshot';
import type { SchemaSnapshotPair } from './schemaSnapshot';

vi.mock('../../../utils/storage', () => ({
  readKey: vi.fn((key: string) => Promise.resolve(localStorage.getItem(key))),
  writeKey: vi.fn((key: string, value: string) => { localStorage.setItem(key, value); return Promise.resolve(); }),
}));

// ─── collectFieldEntries ──────────────────────────────────

describe('collectFieldEntries', () => {
  it('returns empty for null root', () => {
    expect(collectFieldEntries(null)).toEqual([]);
  });

  it('returns empty for undefined root', () => {
    expect(collectFieldEntries(undefined)).toEqual([]);
  });

  it('collects scalar leaf fields from flat object', () => {
    const result = collectFieldEntries({ name: 'Alice', age: 30, active: true });
    expect(result).toHaveLength(3);

    const name = result.find(f => f.path === 'name')!;
    expect(name.type).toBe('string');
    expect(name.depth).toBe(0);
    expect(name.nullable).toBe(false);
    expect(name.isArrayElement).toBe(false);

    const age = result.find(f => f.path === 'age')!;
    expect(age.type).toBe('number');

    const active = result.find(f => f.path === 'active')!;
    expect(active.type).toBe('boolean');
  });

  it('collects nested object fields with correct depth', () => {
    const result = collectFieldEntries({ user: { address: { city: 'NY' } } });
    const paths = result.map(f => f.path);
    expect(paths).toContain('user');
    expect(paths).toContain('user.address');
    expect(paths).toContain('user.address.city');

    const user = result.find(f => f.path === 'user')!;
    expect(user.type).toBe('object');
    expect(user.depth).toBe(0);

    const address = result.find(f => f.path === 'user.address')!;
    expect(address.type).toBe('object');
    expect(address.depth).toBe(1);

    const city = result.find(f => f.path === 'user.address.city')!;
    expect(city.type).toBe('string');
    expect(city.depth).toBe(2);
  });

  it('collects array fields with [*] element entries', () => {
    const result = collectFieldEntries({ tags: ['a', 'b'] });
    const tags = result.find(f => f.path === 'tags')!;
    expect(tags.type).toBe('array');
    expect(tags.isArrayElement).toBe(false);

    const element = result.find(f => f.path === 'tags.[*]')!;
    expect(element.type).toBe('string');
    expect(element.isArrayElement).toBe(true);
  });

  it('collects array of objects with nested field entries', () => {
    const result = collectFieldEntries({
      items: [{ id: 1, name: 'Item' }],
    });
    const paths = result.map(f => f.path);
    expect(paths).toContain('items');
    expect(paths).toContain('items.[*]');
    expect(paths).toContain('items.[*].id');
    expect(paths).toContain('items.[*].name');

    const id = result.find(f => f.path === 'items.[*].id')!;
    expect(id.type).toBe('number');
    expect(id.isArrayElement).toBe(true);
    expect(id.depth).toBe(2);
  });

  it('handles null field values as nullable', () => {
    const result = collectFieldEntries({ value: null });
    const field = result.find(f => f.path === 'value')!;
    expect(field.type).toBe('null');
    expect(field.nullable).toBe(true);
  });

  it('handles empty object (no nested fields)', () => {
    const result = collectFieldEntries({});
    expect(result).toEqual([]);
  });

  it('handles empty array (no element schema)', () => {
    const result = collectFieldEntries({ empty: [] });
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('empty');
    expect(result[0].type).toBe('array');
  });

  it('handles deeply nested structures', () => {
    const result = collectFieldEntries({ a: { b: { c: { d: 42 } } } });
    const d = result.find(f => f.path === 'a.b.c.d')!;
    expect(d.type).toBe('number');
    expect(d.depth).toBe(3);
  });

  it('handles mixed types in same object', () => {
    const result = collectFieldEntries({
      str: 'hello',
      num: 42,
      bool: false,
      arr: [1],
      obj: { x: 1 },
      nil: null,
    });
    expect(result.find(f => f.path === 'str')!.type).toBe('string');
    expect(result.find(f => f.path === 'num')!.type).toBe('number');
    expect(result.find(f => f.path === 'bool')!.type).toBe('boolean');
    expect(result.find(f => f.path === 'arr')!.type).toBe('array');
    expect(result.find(f => f.path === 'obj')!.type).toBe('object');
    expect(result.find(f => f.path === 'nil')!.type).toBe('null');
  });

  it('does not create entry for scalar root value (no prefix)', () => {
    const result = collectFieldEntries('just a string');
    expect(result).toEqual([]);
  });

  it('handles array of scalars (number)', () => {
    const result = collectFieldEntries({ ids: [1, 2, 3] });
    const elem = result.find(f => f.path === 'ids.[*]')!;
    expect(elem.type).toBe('number');
    expect(elem.isArrayElement).toBe(true);
  });

  it('handles array of null values', () => {
    const result = collectFieldEntries({ items: [null] });
    const elem = result.find(f => f.path === 'items.[*]')!;
    expect(elem.type).toBe('null');
    expect(elem.nullable).toBe(true);
    expect(elem.isArrayElement).toBe(true);
  });

  it('handles null-first heterogeneous array (uses first non-null element)', () => {
    const result = collectFieldEntries({ items: [null, { id: 1, name: 'Item' }] });
    const paths = result.map(f => f.path);
    expect(paths).toContain('items.[*]');
    expect(paths).toContain('items.[*].id');
    expect(paths).toContain('items.[*].name');
  });

  it('handles keys with dots in them (single key, not nested)', () => {
    const result = collectFieldEntries({ 'a.b': 42 });
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('a.b');
    expect(result[0].type).toBe('number');
  });

  it('handles prototype-ish key names without pollution', () => {
    const result = collectFieldEntries({ __proto__: 'val', constructor: 'ctor' });
    const protoPaths = result.map(f => f.path);
    expect(protoPaths).toContain('constructor');
    // __proto__ is not an own enumerable key in most engines
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('handles circular references without stack overflow', () => {
    const obj: Record<string, unknown> = { name: 'root' };
    obj.self = obj;
    const result = collectFieldEntries(obj);
    expect(result.find(f => f.path === 'name')).toBeDefined();
    // Should terminate without error; self-ref produces object entry or is skipped
    expect(result.length).toBeGreaterThan(0);
  });

  it('respects max depth guard for very deep nesting', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 30; i++) {
      deep = { nested: deep };
    }
    const result = collectFieldEntries(deep);
    // Should not contain entries deeper than MAX_DEPTH (20)
    const maxDepth = Math.max(...result.map(f => f.depth));
    expect(maxDepth).toBeLessThanOrEqual(20);
    // Should not throw or hang
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles array with mixed scalar types (uses first non-null)', () => {
    const result = collectFieldEntries({ values: [42, 'hello', true] });
    const elem = result.find(f => f.path === 'values.[*]')!;
    expect(elem.type).toBe('number');
  });
});

// ─── captureSchemaSnapshot ────────────────────────────────

describe('captureSchemaSnapshot', () => {
  it('captures snapshot with correct metadata', () => {
    const snap = captureSchemaSnapshot('test-ctx', 'source', { name: 'Alice' });
    expect(snap.contextId).toBe('test-ctx');
    expect(snap.side).toBe('source');
    expect(snap.id).toMatch(/^snap-/);
    expect(snap.capturedAt).toBeTruthy();
    expect(snap.topLevelKeyCount).toBe(1);
    expect(snap.fields).toHaveLength(1);
    expect(snap.fields[0].path).toBe('name');
  });

  it('captures target snapshot', () => {
    const snap = captureSchemaSnapshot('ctx', 'target', { x: 1, y: 2 });
    expect(snap.side).toBe('target');
    expect(snap.topLevelKeyCount).toBe(2);
    expect(snap.fields).toHaveLength(2);
  });

  it('includes sourceId when provided', () => {
    const snap = captureSchemaSnapshot('ctx', 'source', { a: 1 }, 'src-123');
    expect(snap.sourceId).toBe('src-123');
  });

  it('handles null sample data', () => {
    const snap = captureSchemaSnapshot('ctx', 'source', null);
    expect(snap.fields).toEqual([]);
    expect(snap.topLevelKeyCount).toBe(0);
  });

  it('handles array sample data (not object)', () => {
    const snap = captureSchemaSnapshot('ctx', 'source', [1, 2, 3]);
    expect(snap.topLevelKeyCount).toBe(0);
  });

  it('captures complex nested structure', () => {
    const data = {
      user: { name: 'Alice', roles: ['admin'] },
      settings: { theme: 'dark' },
    };
    const snap = captureSchemaSnapshot('ctx', 'source', data);
    expect(snap.topLevelKeyCount).toBe(2);
    const paths = snap.fields.map(f => f.path);
    expect(paths).toContain('user');
    expect(paths).toContain('user.name');
    expect(paths).toContain('user.roles');
    expect(paths).toContain('settings');
    expect(paths).toContain('settings.theme');
  });
});

// ─── captureSnapshotPair ──────────────────────────────────

describe('captureSnapshotPair', () => {
  it('captures sources and target', () => {
    const pair = captureSnapshotPair(
      'ctx',
      [
        { id: 's1', sampleData: { name: 'Alice' } },
        { id: 's2', sampleData: { code: 200 } },
      ],
      { output: '' },
    );
    expect(pair.source).toHaveLength(2);
    expect(pair.source[0].sourceId).toBe('s1');
    expect(pair.source[1].sourceId).toBe('s2');
    expect(pair.target).not.toBeNull();
    expect(pair.target!.side).toBe('target');
  });

  it('skips sources with no sampleData', () => {
    const pair = captureSnapshotPair(
      'ctx',
      [
        { id: 's1', sampleData: undefined },
        { id: 's2', sampleData: { x: 1 } },
      ],
      { y: 2 },
    );
    expect(pair.source).toHaveLength(1);
    expect(pair.source[0].sourceId).toBe('s2');
  });

  it('returns null target when no target sample data', () => {
    const pair = captureSnapshotPair('ctx', [], null);
    expect(pair.source).toHaveLength(0);
    expect(pair.target).toBeNull();
  });
});

// ─── Storage ──────────────────────────────────────────────

describe('schema snapshot storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveSnapshot + loadSnapshot round-trip', async () => {
    const pair: SchemaSnapshotPair = {
      source: [captureSchemaSnapshot('ctx', 'source', { name: 'Alice' })],
      target: captureSchemaSnapshot('ctx', 'target', { out: '' }),
    };
    await saveSnapshot('ctx', pair);
    const loaded = await loadSnapshot('ctx');
    expect(loaded).not.toBeNull();
    expect(loaded!.source).toHaveLength(1);
    expect(loaded!.source[0].fields[0].path).toBe('name');
    expect(loaded!.target!.fields[0].path).toBe('out');
  });

  it('loadSnapshot returns null when no data exists', async () => {
    const loaded = await loadSnapshot('nonexistent');
    expect(loaded).toBeNull();
  });

  it('loadSnapshot returns null for corrupt data', async () => {
    localStorage.setItem('dm-schema-snapshot-corrupt', 'not json!!!');
    const loaded = await loadSnapshot('corrupt');
    expect(loaded).toBeNull();
  });

  it('loadSnapshot returns null for non-pair shape', async () => {
    localStorage.setItem('dm-schema-snapshot-bad', JSON.stringify({ foo: 'bar' }));
    const loaded = await loadSnapshot('bad');
    expect(loaded).toBeNull();
  });

  it('deleteSnapshot clears stored data', async () => {
    const pair: SchemaSnapshotPair = {
      source: [captureSchemaSnapshot('ctx', 'source', { x: 1 })],
      target: null,
    };
    await saveSnapshot('del-test', pair);
    expect(await loadSnapshot('del-test')).not.toBeNull();
    await deleteSnapshot('del-test');
    const loaded = await loadSnapshot('del-test');
    expect(loaded).toBeNull();
  });
});
