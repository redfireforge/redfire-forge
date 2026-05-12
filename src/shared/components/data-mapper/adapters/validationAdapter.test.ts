import { describe, it, expect, vi } from 'vitest';
import {
  createValidationAdapter,
  type ValidationAdapterOutput,
} from './validationAdapter';
import type { Mapping } from '../types';

// ── Fixtures ──────────────────────────────────────────────

const SAMPLE_BODY = {
  data: {
    id: 42,
    name: 'Alice',
    active: true,
  },
  meta: {
    total: 100,
  },
};

const INCLUDE_OUTPUT: ValidationAdapterOutput = {
  selectiveMode: 'include',
  expectedFields: [
    { jsonPath: 'data.id', expectedValue: '42' },
    { jsonPath: 'data.name', expectedValue: 'Alice' },
  ],
  excludedPaths: [],
};

const EXCLUDE_OUTPUT: ValidationAdapterOutput = {
  selectiveMode: 'exclude',
  expectedFields: [
    { jsonPath: 'data.id', expectedValue: '42' },
    { jsonPath: 'data.name', expectedValue: 'Alice' },
  ],
  excludedPaths: ['data.active', 'meta.total'],
};

// ── Adapter creation ──────────────────────────────────────

describe('createValidationAdapter', () => {
  it('creates an adapter with correct contextId and title', () => {
    const adapter = createValidationAdapter();
    expect(adapter.contextId).toBe('validation');
    expect(adapter.title).toBe('Response Body → Validation Rules');
    expect(adapter.category).toBe('http');
  });

  it('sets source sampleData from object', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: SAMPLE_BODY });
    expect(adapter.sources[0].sampleData).toEqual(SAMPLE_BODY);
  });

  it('parses source sampleData from JSON string', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: JSON.stringify(SAMPLE_BODY),
    });
    expect(adapter.sources[0].sampleData).toEqual(SAMPLE_BODY);
  });

  it('handles invalid JSON string gracefully', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: '{bad' as unknown as string });
    expect(adapter.sources[0].sampleData).toBeUndefined();
  });

  it('handles null/undefined sampleResponseBody', () => {
    const adapter = createValidationAdapter({});
    expect(adapter.sources[0].sampleData).toBeUndefined();
  });

  it('defaults to include mode', () => {
    const adapter = createValidationAdapter();
    const result = adapter.serialize([]);
    expect(result.selectiveMode).toBe('include');
  });

  it('respects selectiveMode option', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: SAMPLE_BODY,
      selectiveMode: 'exclude',
    });
    const result = adapter.serialize([]);
    expect(result.selectiveMode).toBe('exclude');
  });

  it('sets supportsLiveFetch when fetchSampleData provided', () => {
    const adapter = createValidationAdapter({
      fetchSampleData: async () => ({}),
    });
    expect(adapter.sources[0].supportsLiveFetch).toBe(true);
  });

  it('sets target with allowCustomFields true', () => {
    const adapter = createValidationAdapter();
    expect(adapter.target.allowCustomFields).toBe(true);
    expect(adapter.target.label).toBe('Validation Fields');
  });

  it('delegates fetchSampleData to provided callback', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const adapter = createValidationAdapter({ fetchSampleData: mockFetch });
    const result = await adapter.fetchSampleData!();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
  });
});

// ── serialize (include mode) ──────────────────────────────

describe('serialize — include mode', () => {
  it('converts mappings to expectedFields', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'data.id', targetPath: '42' },
      { id: 'm2', sourceId: 'response-body', sourcePath: 'data.name', targetPath: 'Alice' },
    ];

    const result = adapter.serialize(mappings);
    expect(result.selectiveMode).toBe('include');
    expect(result.expectedFields).toEqual([
      { jsonPath: 'data.id', expectedValue: '42' },
      { jsonPath: 'data.name', expectedValue: 'Alice' },
    ]);
    expect(result.excludedPaths).toEqual([]);
  });

  it('uses expression when present instead of sourcePath', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'data.id', targetPath: '42', expression: '$.data.id' },
    ];

    const result = adapter.serialize(mappings);
    expect(result.expectedFields[0].jsonPath).toBe('$.data.id');
  });

  it('returns empty expectedFields when no mappings', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const result = adapter.serialize([]);
    expect(result.expectedFields).toEqual([]);
    expect(result.excludedPaths).toEqual([]);
  });
});

// ── serialize (exclude mode) ──────────────────────────────

describe('serialize — exclude mode', () => {
  it('un-mapped leaves become excludedPaths', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: SAMPLE_BODY,
      selectiveMode: 'exclude',
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'data.id', targetPath: '42' },
      { id: 'm2', sourceId: 'response-body', sourcePath: 'data.name', targetPath: 'Alice' },
    ];

    const result = adapter.serialize(mappings);
    expect(result.selectiveMode).toBe('exclude');
    expect(result.expectedFields).toHaveLength(2);
    expect(result.excludedPaths).toContain('data.active');
    expect(result.excludedPaths).toContain('meta.total');
  });

  it('all leaves excluded when no mappings', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: SAMPLE_BODY,
      selectiveMode: 'exclude',
    });
    const result = adapter.serialize([]);
    expect(result.expectedFields).toEqual([]);
    expect(result.excludedPaths.length).toBeGreaterThan(0);
  });

  it('no excludedPaths when all leaves are mapped', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: { a: 1, b: 2 },
      selectiveMode: 'exclude',
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'a', targetPath: '1' },
      { id: 'm2', sourceId: 'response-body', sourcePath: 'b', targetPath: '2' },
    ];
    const result = adapter.serialize(mappings);
    expect(result.excludedPaths).toEqual([]);
  });
});

// ── deserialize (include mode) ────────────────────────────

describe('deserialize — include mode', () => {
  it('converts expectedFields to mappings', () => {
    const adapter = createValidationAdapter();
    const result = adapter.deserialize(INCLUDE_OUTPUT);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'val-0',
      sourceId: 'response-body',
      sourcePath: 'data.id',
      targetPath: '42',
    });
    expect(result[1]).toEqual({
      id: 'val-1',
      sourceId: 'response-body',
      sourcePath: 'data.name',
      targetPath: 'Alice',
    });
  });

  it('returns empty array for empty expectedFields', () => {
    const adapter = createValidationAdapter();
    const result = adapter.deserialize({
      selectiveMode: 'include',
      expectedFields: [],
      excludedPaths: [],
    });
    expect(result).toEqual([]);
  });

  it('returns empty array for null/undefined input', () => {
    const adapter = createValidationAdapter();
    expect(adapter.deserialize(null as unknown as ValidationAdapterOutput)).toEqual([]);
    expect(adapter.deserialize(undefined as unknown as ValidationAdapterOutput)).toEqual([]);
  });

  it('treats missing selectiveMode as include', () => {
    const adapter = createValidationAdapter();
    const result = adapter.deserialize({
      expectedFields: [{ jsonPath: 'a', expectedValue: '1' }],
      excludedPaths: [],
    } as ValidationAdapterOutput);
    expect(result).toHaveLength(1);
  });

  it('treats unknown selectiveMode as include (not exclude)', () => {
    const adapter = createValidationAdapter();
    const result = adapter.deserialize({
      selectiveMode: 'garbage' as 'include',
      expectedFields: [{ jsonPath: 'a', expectedValue: '1' }],
      excludedPaths: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].sourcePath).toBe('a');
  });
});

// ── deserialize (exclude mode) ────────────────────────────

describe('deserialize — exclude mode', () => {
  it('inverts excludedPaths against leaf set', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: SAMPLE_BODY });
    const result = adapter.deserialize(EXCLUDE_OUTPUT);

    const paths = result.map((m) => m.sourcePath);
    expect(paths).toContain('data.id');
    expect(paths).toContain('data.name');
    expect(paths).not.toContain('data.active');
    expect(paths).not.toContain('meta.total');
  });

  it('uses expectedValue from existing fields when available', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: SAMPLE_BODY });
    const result = adapter.deserialize(EXCLUDE_OUTPUT);

    const idMapping = result.find((m) => m.sourcePath === 'data.id');
    expect(idMapping?.targetPath).toBe('42');
  });

  it('falls back to sample value when expectedValue not available', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: SAMPLE_BODY });
    const output: ValidationAdapterOutput = {
      selectiveMode: 'exclude',
      expectedFields: [],
      excludedPaths: ['data.active', 'meta.total'],
    };
    const result = adapter.deserialize(output);

    const idMapping = result.find((m) => m.sourcePath === 'data.id');
    expect(idMapping?.targetPath).toBe('42');

    const nameMapping = result.find((m) => m.sourcePath === 'data.name');
    expect(nameMapping?.targetPath).toBe('Alice');
  });

  it('returns empty array when all leaves are excluded', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: { a: 1 } });
    const result = adapter.deserialize({
      selectiveMode: 'exclude',
      expectedFields: [],
      excludedPaths: ['a'],
    });
    expect(result).toEqual([]);
  });
});

// ── Round-trip ────────────────────────────────────────────

describe('round-trip', () => {
  it('include mode: serialize(deserialize(output)) preserves fields', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const mappings = adapter.deserialize(INCLUDE_OUTPUT);
    const result = adapter.serialize(mappings);

    expect(result.selectiveMode).toBe('include');
    expect(result.expectedFields).toHaveLength(INCLUDE_OUTPUT.expectedFields.length);
    for (let i = 0; i < INCLUDE_OUTPUT.expectedFields.length; i++) {
      expect(result.expectedFields[i].jsonPath).toBe(INCLUDE_OUTPUT.expectedFields[i].jsonPath);
      expect(result.expectedFields[i].expectedValue).toBe(INCLUDE_OUTPUT.expectedFields[i].expectedValue);
    }
  });

  it('exclude mode: serialize(deserialize(output)) preserves excludedPaths', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: SAMPLE_BODY,
      selectiveMode: 'exclude',
    });
    const mappings = adapter.deserialize(EXCLUDE_OUTPUT);
    const result = adapter.serialize(mappings);

    expect(result.selectiveMode).toBe('exclude');
    expect(new Set(result.excludedPaths)).toEqual(new Set(EXCLUDE_OUTPUT.excludedPaths));
  });

  it('include mode: empty round-trip', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const empty: ValidationAdapterOutput = {
      selectiveMode: 'include',
      expectedFields: [],
      excludedPaths: [],
    };
    const mappings = adapter.deserialize(empty);
    const result = adapter.serialize(mappings);
    expect(result.expectedFields).toEqual([]);
  });
});

// ── validate ──────────────────────────────────────────────

describe('validate', () => {
  it('warns when no fields selected in include mode', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const issues = adapter.validate!([]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('No fields selected');
  });

  it('does not warn in exclude mode with no mappings', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'exclude' });
    const issues = adapter.validate!([]);
    expect(issues).toHaveLength(0);
  });

  it('reports empty path as error', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '', targetPath: '42' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('empty'))).toBe(true);
  });

  it('warns about duplicate paths', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'data.id', targetPath: '42' },
      { id: 'm2', sourceId: 'response-body', sourcePath: 'data.id', targetPath: '43' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('Duplicate'))).toBe(true);
  });

  it('returns no issues for valid mappings', () => {
    const adapter = createValidationAdapter({ selectiveMode: 'include' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'data.id', targetPath: '42' },
      { id: 'm2', sourceId: 'response-body', sourcePath: 'data.name', targetPath: 'Alice' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(0);
  });
});

// ── $.prefix normalization in exclude mode ──────────────────

describe('validationAdapter – $.prefix normalization', () => {
  it('exclude mode handles $.prefixed sourcePaths correctly', () => {
    const sample = { id: 1, name: 'Alice', email: 'a@b.com' };
    const adapter = createValidationAdapter({
      sampleResponseBody: JSON.stringify(sample),
      selectiveMode: 'exclude',
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.id', targetPath: '1' },
    ];
    const result = adapter.serialize(mappings);
    expect(result.excludedPaths).toContain('name');
    expect(result.excludedPaths).toContain('email');
    expect(result.excludedPaths).not.toContain('id');
  });

  it('exclude deserialize matches $.prefixed expectedFields to leaf paths', () => {
    const sample = { id: 1, name: 'Alice' };
    const adapter = createValidationAdapter({
      sampleResponseBody: JSON.stringify(sample),
      selectiveMode: 'exclude',
    });
    const existing = {
      selectiveMode: 'exclude' as const,
      expectedFields: [{ jsonPath: '$.id', expectedValue: '42' }],
      excludedPaths: ['name'],
    };
    const mappings = adapter.deserialize(existing);
    const idMapping = mappings.find((m) => m.sourcePath === 'id');
    expect(idMapping?.targetPath).toBe('42');
  });

  it('serialize deduplicates by normalized path (last wins)', () => {
    const sample = { id: 1, name: 'Alice' };
    const adapter = createValidationAdapter({
      sampleResponseBody: JSON.stringify(sample),
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'id', targetPath: 'first' },
      { id: 'm2', sourceId: 'response-body', sourcePath: 'id', targetPath: 'second' },
      { id: 'm3', sourceId: 'response-body', sourcePath: 'name', targetPath: 'Alice' },
    ];
    const result = adapter.serialize(mappings);
    expect(result.expectedFields).toHaveLength(2);
    const idField = result.expectedFields.find((f) => f.jsonPath === 'id');
    expect(idField?.expectedValue).toBe('second');
  });
});

// ── fetchTargetSchema ──────────────────────────────────────

describe('validationAdapter – fetchTargetSchema', () => {
  it('is undefined when fetchSampleData is not provided', () => {
    const adapter = createValidationAdapter({ sampleResponseBody: '{"id": 1}' });
    expect(adapter.fetchTargetSchema).toBeUndefined();
  });

  it('is defined when fetchSampleData is provided', () => {
    const adapter = createValidationAdapter({
      fetchSampleData: async () => ({ id: 1 }),
    });
    expect(adapter.fetchTargetSchema).toBeDefined();
  });

  it('returns sampleData and fields with defaultValue from fetched response', async () => {
    const mockData = { user: { name: 'Alice', age: 30 }, status: 'ok' };
    const adapter = createValidationAdapter({
      fetchSampleData: async () => mockData,
    });
    const result = await adapter.fetchTargetSchema!();
    expect(result.sampleData).toEqual(mockData);
    expect(result.fields).toBeDefined();
    expect(result.fields!.length).toBeGreaterThanOrEqual(3);
    const nameField = result.fields!.find(f => f.path === 'user.name');
    expect(nameField!.defaultValue).toBe('Alice');
    expect(nameField!.label).toBe('name');
  });

  it('sets defaultValue from actual response values', async () => {
    const adapter = createValidationAdapter({
      fetchSampleData: async () => ({ count: 42, active: true }),
    });
    const result = await adapter.fetchTargetSchema!();
    const countField = result.fields!.find(f => f.path === 'count');
    expect(countField!.defaultValue).toBe('42');
    const activeField = result.fields!.find(f => f.path === 'active');
    expect(activeField!.defaultValue).toBe('true');
  });

  it('handles string JSON response', async () => {
    const adapter = createValidationAdapter({
      fetchSampleData: async () => '{"key": "value"}',
    });
    const result = await adapter.fetchTargetSchema!();
    expect(result.sampleData).toEqual({ key: 'value' });
    expect(result.fields![0].path).toBe('key');
    expect(result.fields![0].defaultValue).toBe('value');
  });

  it('handles null response gracefully', async () => {
    const adapter = createValidationAdapter({
      fetchSampleData: async () => null,
    });
    const result = await adapter.fetchTargetSchema!();
    expect(result.sampleData).toBeUndefined();
    expect(result.fields).toBeUndefined();
  });

  it('propagates fetch errors', async () => {
    const adapter = createValidationAdapter({
      fetchSampleData: async () => { throw new Error('Timeout'); },
    });
    await expect(adapter.fetchTargetSchema!()).rejects.toThrow('Timeout');
  });
});
