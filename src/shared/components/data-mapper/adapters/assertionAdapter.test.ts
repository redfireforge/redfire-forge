import { describe, it, expect, vi } from 'vitest';
import {
  createAssertionAdapter,
  type AssertionAdapterResult,
} from './assertionAdapter';
import type { Mapping } from '../types';

// ── Fixtures ──────────────────────────────────────────────

const SAMPLE_BODY = {
  offers: [
    { offerName: 'Connected Access', price: 29.99 },
    { offerName: 'Premium', price: 49.99 },
  ],
  status: 'active',
};

const INITIAL_RESULT: AssertionAdapterResult = {
  jsonPath: '$.offers[0].offerName',
  pattern: 'Connected Access',
  patternName: 'Exact Match',
};

// ── Adapter creation ──────────────────────────────────────

describe('createAssertionAdapter', () => {
  it('creates an adapter with correct contextId and title', () => {
    const adapter = createAssertionAdapter();
    expect(adapter.contextId).toBe('assertion');
    expect(adapter.title).toBe('Response Body → Regex Assertion');
    expect(adapter.category).toBe('http');
  });

  it('sets source sampleData from object', () => {
    const adapter = createAssertionAdapter({ sampleResponseBody: SAMPLE_BODY });
    expect(adapter.sources[0].sampleData).toEqual(SAMPLE_BODY);
  });

  it('parses source sampleData from JSON string', () => {
    const adapter = createAssertionAdapter({
      sampleResponseBody: JSON.stringify(SAMPLE_BODY),
    });
    expect(adapter.sources[0].sampleData).toEqual(SAMPLE_BODY);
  });

  it('handles invalid JSON string gracefully', () => {
    const adapter = createAssertionAdapter({ sampleResponseBody: '{bad' });
    expect(adapter.sources[0].sampleData).toBeUndefined();
  });

  it('handles null/undefined sampleResponseBody', () => {
    const adapter = createAssertionAdapter({});
    expect(adapter.sources[0].sampleData).toBeUndefined();
  });

  it('sets supportsLiveFetch when fetchSampleData provided', () => {
    const adapter = createAssertionAdapter({
      fetchSampleData: async () => ({}),
    });
    expect(adapter.sources[0].supportsLiveFetch).toBe(true);
  });

  it('does not set supportsLiveFetch when no fetchSampleData', () => {
    const adapter = createAssertionAdapter();
    expect(adapter.sources[0].supportsLiveFetch).toBe(false);
  });

  it('sets target with allowCustomFields false', () => {
    const adapter = createAssertionAdapter();
    expect(adapter.target.allowCustomFields).toBe(false);
    expect(adapter.target.label).toBe('Assertion Target');
  });

  it('target has a single required jsonPath field', () => {
    const adapter = createAssertionAdapter();
    expect(adapter.target.fields).toHaveLength(1);
    expect(adapter.target.fields![0].path).toBe('jsonPath');
    expect(adapter.target.fields![0].required).toBe(true);
  });

  it('delegates fetchSampleData to provided callback', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const adapter = createAssertionAdapter({ fetchSampleData: mockFetch });
    const result = await adapter.fetchSampleData!();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
  });
});

// ── serialize ─────────────────────────────────────────────

describe('serialize', () => {
  it('converts single mapping to AssertionAdapterResult', () => {
    const adapter = createAssertionAdapter({
      initialPattern: 'Connected Access',
      initialPatternName: 'Exact Match',
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.offers[0].offerName', targetPath: 'jsonPath' },
    ];

    const result = adapter.serialize(mappings);
    expect(result).toEqual({
      jsonPath: '$.offers[0].offerName',
      pattern: 'Connected Access',
      patternName: 'Exact Match',
    });
  });

  it('uses expression when present instead of sourcePath', () => {
    const adapter = createAssertionAdapter({ initialPattern: '\\d+' });
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourceId: 'response-body',
        sourcePath: '$.price',
        targetPath: 'jsonPath',
        expression: '$.offers[*].price',
      },
    ];

    const result = adapter.serialize(mappings);
    expect(result.jsonPath).toBe('$.offers[*].price');
  });

  it('returns empty jsonPath when no mappings', () => {
    const adapter = createAssertionAdapter({ initialPattern: 'test' });
    const result = adapter.serialize([]);
    expect(result.jsonPath).toBe('');
    expect(result.pattern).toBe('test');
  });

  it('omits patternName when not provided', () => {
    const adapter = createAssertionAdapter({ initialPattern: 'test' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.status', targetPath: 'jsonPath' },
    ];
    const result = adapter.serialize(mappings);
    expect(result.patternName).toBeUndefined();
  });

  it('uses getPattern callback for live pattern updates', () => {
    let livePattern = 'initial';
    const adapter = createAssertionAdapter({
      initialPattern: 'stale',
      getPattern: () => ({ pattern: livePattern, patternName: 'Live' }),
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.status', targetPath: 'jsonPath' },
    ];

    const result1 = adapter.serialize(mappings);
    expect(result1.pattern).toBe('initial');
    expect(result1.patternName).toBe('Live');

    livePattern = 'updated';
    const result2 = adapter.serialize(mappings);
    expect(result2.pattern).toBe('updated');
    expect(result2.patternName).toBe('Live');
  });

  it('falls back to initialPattern when getPattern returns undefined fields', () => {
    const adapter = createAssertionAdapter({
      initialPattern: 'fallback',
      initialPatternName: 'FallbackName',
      getPattern: () => ({ pattern: '', patternName: undefined }),
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.status', targetPath: 'jsonPath' },
    ];
    const result = adapter.serialize(mappings);
    expect(result.pattern).toBe('');
    expect(result.patternName).toBe('FallbackName');
  });

  it('uses first mapping only when multiple exist', () => {
    const adapter = createAssertionAdapter({ initialPattern: 'test' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.first', targetPath: 'jsonPath' },
      { id: 'm2', sourceId: 'response-body', sourcePath: '$.second', targetPath: 'other' },
    ];
    const result = adapter.serialize(mappings);
    expect(result.jsonPath).toBe('$.first');
  });

  it('defaults pattern to empty string when not provided', () => {
    const adapter = createAssertionAdapter();
    const result = adapter.serialize([]);
    expect(result.pattern).toBe('');
  });
});

// ── deserialize ───────────────────────────────────────────

describe('deserialize', () => {
  it('converts AssertionAdapterResult to single mapping', () => {
    const adapter = createAssertionAdapter();
    const result = adapter.deserialize(INITIAL_RESULT);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'assertion-0',
      sourceId: 'response-body',
      sourcePath: '$.offers[0].offerName',
      targetPath: 'jsonPath',
    });
  });

  it('returns empty array for empty jsonPath', () => {
    const adapter = createAssertionAdapter();
    const result = adapter.deserialize({ jsonPath: '', pattern: 'test' });
    expect(result).toEqual([]);
  });

  it('returns empty array for null/undefined input', () => {
    const adapter = createAssertionAdapter();
    expect(adapter.deserialize(null as unknown as AssertionAdapterResult)).toEqual([]);
    expect(adapter.deserialize(undefined as unknown as AssertionAdapterResult)).toEqual([]);
  });

  it('preserves jsonPath with $ prefix', () => {
    const adapter = createAssertionAdapter();
    const result = adapter.deserialize({ jsonPath: '$.data.id', pattern: '' });
    expect(result[0].sourcePath).toBe('$.data.id');
  });
});

// ── Round-trip ────────────────────────────────────────────

describe('round-trip', () => {
  it('serialize(deserialize(result)) preserves jsonPath', () => {
    const adapter = createAssertionAdapter({
      initialPattern: INITIAL_RESULT.pattern,
      initialPatternName: INITIAL_RESULT.patternName,
    });
    const mappings = adapter.deserialize(INITIAL_RESULT);
    const result = adapter.serialize(mappings);

    expect(result.jsonPath).toBe(INITIAL_RESULT.jsonPath);
    expect(result.pattern).toBe(INITIAL_RESULT.pattern);
    expect(result.patternName).toBe(INITIAL_RESULT.patternName);
  });

  it('round-trip with empty result', () => {
    const adapter = createAssertionAdapter();
    const mappings = adapter.deserialize({ jsonPath: '', pattern: '' });
    const result = adapter.serialize(mappings);
    expect(result.jsonPath).toBe('');
  });
});

// ── validate ──────────────────────────────────────────────

describe('validate', () => {
  it('reports error when no mappings (no path selected)', () => {
    const adapter = createAssertionAdapter({ initialPattern: 'test' });
    const issues = adapter.validate!([]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('Select a JSON path');
  });

  it('reports error when no mappings and no pattern', () => {
    const adapter = createAssertionAdapter();
    const issues = adapter.validate!([]);
    expect(issues).toHaveLength(2);
    expect(issues.some((i) => i.message.includes('JSON path'))).toBe(true);
    expect(issues.some((i) => i.message.includes('pattern'))).toBe(true);
  });

  it('warns when multiple mappings exist', () => {
    const adapter = createAssertionAdapter({ initialPattern: 'test' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.first', targetPath: 'jsonPath' },
      { id: 'm2', sourceId: 'response-body', sourcePath: '$.second', targetPath: 'other' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('Only one'))).toBe(true);
  });

  it('reports error for empty path in mapping', () => {
    const adapter = createAssertionAdapter({ initialPattern: 'test' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '', targetPath: 'jsonPath' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('empty'))).toBe(true);
  });

  it('reports error for whitespace-only path', () => {
    const adapter = createAssertionAdapter({ initialPattern: 'test' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '   ', targetPath: 'jsonPath' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('empty'))).toBe(true);
  });

  it('reports error for empty pattern', () => {
    const adapter = createAssertionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.status', targetPath: 'jsonPath' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('pattern');
  });

  it('reports error for whitespace-only pattern', () => {
    const adapter = createAssertionAdapter({ initialPattern: '   ' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.status', targetPath: 'jsonPath' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.message.includes('pattern'))).toBe(true);
  });

  it('uses getPattern over initialPattern for validation', () => {
    const adapter = createAssertionAdapter({
      initialPattern: '',
      getPattern: () => ({ pattern: 'live-pattern' }),
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.status', targetPath: 'jsonPath' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(0);
  });

  it('returns no issues for valid single mapping with pattern', () => {
    const adapter = createAssertionAdapter({ initialPattern: '^[A-Z]' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.status', targetPath: 'jsonPath' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(0);
  });

  it('uses expression over sourcePath for validation', () => {
    const adapter = createAssertionAdapter({ initialPattern: 'test' });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '', targetPath: 'jsonPath', expression: '$.status' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(0);
  });
});
