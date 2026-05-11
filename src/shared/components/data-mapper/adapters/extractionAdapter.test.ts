import { describe, it, expect, vi } from 'vitest';
import {
  createExtractionAdapter,
  splitExtractions,
} from './extractionAdapter';
import type { Extraction } from '../../../types';
import type { Mapping } from '../types';

// ── Fixtures ──────────────────────────────────────────────

const SAMPLE_BODY = {
  data: { id: 42, name: 'Alice', email: 'a@b.com' },
  meta: { total: 100 },
};

const BODY_EXTRACTIONS: Extraction[] = [
  { name: 'userId', source: 'body', expression: '$.data.id' },
  { name: 'userName', source: 'body', expression: '$.data.name' },
];

const HEADER_EXTRACTION: Extraction = {
  name: 'location',
  source: 'header',
  expression: 'Location',
};

const STATUS_EXTRACTION: Extraction = {
  name: 'code',
  source: 'status',
  expression: '',
};

const MIXED_EXTRACTIONS: Extraction[] = [
  HEADER_EXTRACTION,
  ...BODY_EXTRACTIONS,
  STATUS_EXTRACTION,
];

// ── Adapter creation ──────────────────────────────────────

describe('createExtractionAdapter', () => {
  it('creates an adapter with correct contextId and title', () => {
    const adapter = createExtractionAdapter();
    expect(adapter.contextId).toBe('extraction');
    expect(adapter.title).toBe('Response Body → Variables');
    expect(adapter.category).toBe('http');
  });

  it('sets source sampleData from object', () => {
    const adapter = createExtractionAdapter({ sampleResponseBody: SAMPLE_BODY });
    expect(adapter.sources[0].sampleData).toEqual(SAMPLE_BODY);
  });

  it('parses source sampleData from JSON string', () => {
    const adapter = createExtractionAdapter({
      sampleResponseBody: JSON.stringify(SAMPLE_BODY),
    });
    expect(adapter.sources[0].sampleData).toEqual(SAMPLE_BODY);
  });

  it('handles invalid JSON string gracefully', () => {
    const adapter = createExtractionAdapter({ sampleResponseBody: '{bad' });
    expect(adapter.sources[0].sampleData).toBeUndefined();
  });

  it('handles null/undefined sampleResponseBody', () => {
    const adapter = createExtractionAdapter({});
    expect(adapter.sources[0].sampleData).toBeUndefined();
  });

  it('sets supportsLiveFetch when fetchSampleData provided', () => {
    const adapter = createExtractionAdapter({
      fetchSampleData: async () => ({}),
    });
    expect(adapter.sources[0].supportsLiveFetch).toBe(true);
  });

  it('does not set supportsLiveFetch when no fetchSampleData', () => {
    const adapter = createExtractionAdapter();
    expect(adapter.sources[0].supportsLiveFetch).toBe(false);
  });

  it('sets target with allowCustomFields true', () => {
    const adapter = createExtractionAdapter();
    expect(adapter.target.allowCustomFields).toBe(true);
    expect(adapter.target.label).toBe('Extracted Variables');
  });

  it('delegates fetchSampleData to provided callback', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const adapter = createExtractionAdapter({ fetchSampleData: mockFetch });
    const result = await adapter.fetchSampleData!();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
  });
});

// ── serialize ─────────────────────────────────────────────

describe('serialize', () => {
  it('converts mappings to Extraction[] with body source', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.data.id', targetPath: 'userId' },
      { id: 'm2', sourceId: 'response-body', sourcePath: '$.data.name', targetPath: 'userName' },
    ];

    const result = adapter.serialize(mappings);
    expect(result).toEqual([
      { name: 'userId', source: 'body', expression: '$.data.id' },
      { name: 'userName', source: 'body', expression: '$.data.name' },
    ]);
  });

  it('uses expression when present instead of sourcePath', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourceId: 'response-body',
        sourcePath: '$.data.id',
        targetPath: 'userId',
        expression: '$parseInt($.data.id)',
      },
    ];

    const result = adapter.serialize(mappings);
    expect(result).toEqual([
      { name: 'userId', source: 'body', expression: '$parseInt($.data.id)' },
    ]);
  });

  it('merges non-body extractions back', () => {
    const adapter = createExtractionAdapter({
      nonBodyExtractions: [HEADER_EXTRACTION, STATUS_EXTRACTION],
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.data.id', targetPath: 'userId' },
    ];

    const result = adapter.serialize(mappings);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(HEADER_EXTRACTION);
    expect(result[1]).toEqual(STATUS_EXTRACTION);
    expect(result[2]).toEqual({ name: 'userId', source: 'body', expression: '$.data.id' });
  });

  it('returns only non-body extractions when no mappings', () => {
    const adapter = createExtractionAdapter({
      nonBodyExtractions: [HEADER_EXTRACTION],
    });
    const result = adapter.serialize([]);
    expect(result).toEqual([HEADER_EXTRACTION]);
  });

  it('returns empty array when no mappings and no non-body', () => {
    const adapter = createExtractionAdapter();
    const result = adapter.serialize([]);
    expect(result).toEqual([]);
  });
});

// ── deserialize ───────────────────────────────────────────

describe('deserialize', () => {
  it('converts body Extraction[] to Mapping[]', () => {
    const adapter = createExtractionAdapter();
    const result = adapter.deserialize(BODY_EXTRACTIONS);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'ext-0',
      sourceId: 'response-body',
      sourcePath: '$.data.id',
      targetPath: 'userId',
    });
    expect(result[1]).toEqual({
      id: 'ext-1',
      sourceId: 'response-body',
      sourcePath: '$.data.name',
      targetPath: 'userName',
    });
  });

  it('filters out header/status extractions', () => {
    const adapter = createExtractionAdapter();
    const result = adapter.deserialize(MIXED_EXTRACTIONS);

    expect(result).toHaveLength(2);
    expect(result.every((m) => m.sourceId === 'response-body')).toBe(true);
  });

  it('returns empty array for null/undefined input', () => {
    const adapter = createExtractionAdapter();
    expect(adapter.deserialize(null as unknown as Extraction[])).toEqual([]);
    expect(adapter.deserialize(undefined as unknown as Extraction[])).toEqual([]);
  });

  it('returns empty array for empty extraction list', () => {
    const adapter = createExtractionAdapter();
    expect(adapter.deserialize([])).toEqual([]);
  });

  it('returns empty array when all extractions are non-body', () => {
    const adapter = createExtractionAdapter();
    const result = adapter.deserialize([HEADER_EXTRACTION, STATUS_EXTRACTION]);
    expect(result).toEqual([]);
  });
});

// ── Round-trip ────────────────────────────────────────────

describe('round-trip', () => {
  it('serialize(deserialize(extractions)) preserves body extractions', () => {
    const adapter = createExtractionAdapter();
    const mappings = adapter.deserialize(BODY_EXTRACTIONS);
    const result = adapter.serialize(mappings);

    expect(result).toHaveLength(BODY_EXTRACTIONS.length);
    for (let i = 0; i < BODY_EXTRACTIONS.length; i++) {
      expect(result[i].name).toBe(BODY_EXTRACTIONS[i].name);
      expect(result[i].source).toBe('body');
      expect(result[i].expression).toBe(BODY_EXTRACTIONS[i].expression);
    }
  });

  it('round-trip preserves non-body extractions via merge', () => {
    const adapter = createExtractionAdapter({
      nonBodyExtractions: [HEADER_EXTRACTION, STATUS_EXTRACTION],
    });

    const mappings = adapter.deserialize(MIXED_EXTRACTIONS);
    const result = adapter.serialize(mappings);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual(HEADER_EXTRACTION);
    expect(result[1]).toEqual(STATUS_EXTRACTION);
    expect(result[2].name).toBe('userId');
    expect(result[3].name).toBe('userName');
  });

  it('round-trip with expression-only mappings', () => {
    const expressionExtractions: Extraction[] = [
      { name: 'total', source: 'body', expression: '$toString($.meta.total)' },
    ];
    const adapter = createExtractionAdapter();
    const mappings = adapter.deserialize(expressionExtractions);
    const result = adapter.serialize(mappings);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('total');
    expect(result[0].expression).toBe('$toString($.meta.total)');
  });
});

// ── validate ──────────────────────────────────────────────

describe('validate', () => {
  it('reports empty variable name as error', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.id', targetPath: '' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('required');
  });

  it('reports whitespace-only variable name as error', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.id', targetPath: '   ' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
  });

  it('reports duplicate variable names as error', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.data.id', targetPath: 'userId' },
      { id: 'm2', sourceId: 'response-body', sourcePath: '$.data.name', targetPath: 'userId' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('Duplicate'))).toBe(true);
  });

  it('reports empty expression/sourcePath as error', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '', targetPath: 'myVar' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('expression is empty'))).toBe(true);
  });

  it('does not report empty expression error when expression is set', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '', targetPath: 'myVar', expression: '$toString($.id)' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(0);
  });

  it('warns about braces in variable names', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.id', targetPath: '{{userId}}' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('braces'))).toBe(true);
  });

  it('returns no issues for valid mappings', () => {
    const adapter = createExtractionAdapter();
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: '$.data.id', targetPath: 'userId' },
      { id: 'm2', sourceId: 'response-body', sourcePath: '$.data.name', targetPath: 'userName' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(0);
  });

  it('returns no issues for empty mappings', () => {
    const adapter = createExtractionAdapter();
    const issues = adapter.validate!([]);
    expect(issues).toHaveLength(0);
  });
});

// ── splitExtractions ──────────────────────────────────────

describe('splitExtractions', () => {
  it('separates body from non-body extractions', () => {
    const { body, nonBody } = splitExtractions(MIXED_EXTRACTIONS);
    expect(body).toHaveLength(2);
    expect(nonBody).toHaveLength(2);
    expect(body.every((e) => e.source === 'body')).toBe(true);
    expect(nonBody.every((e) => e.source !== 'body')).toBe(true);
  });

  it('handles all-body extractions', () => {
    const { body, nonBody } = splitExtractions(BODY_EXTRACTIONS);
    expect(body).toHaveLength(2);
    expect(nonBody).toHaveLength(0);
  });

  it('handles all-nonBody extractions', () => {
    const { body, nonBody } = splitExtractions([HEADER_EXTRACTION, STATUS_EXTRACTION]);
    expect(body).toHaveLength(0);
    expect(nonBody).toHaveLength(2);
  });

  it('handles empty array', () => {
    const { body, nonBody } = splitExtractions([]);
    expect(body).toHaveLength(0);
    expect(nonBody).toHaveLength(0);
  });
});

// ── fallback preservation ──────────────────────────────────

describe('extractionAdapter – fallback preservation', () => {
  it('preserves fallback on round-trip', () => {
    const adapter = createExtractionAdapter({ sampleResponseBody: SAMPLE_BODY });
    const withFallback: Extraction[] = [
      { name: 'userId', source: 'body', expression: '$.id', fallback: 'N/A' },
      { name: 'email', source: 'body', expression: '$.email' },
    ];
    const mappings = adapter.deserialize(withFallback);
    const result = adapter.serialize(mappings);
    const bodyOnly = result.filter((e) => e.source === 'body');
    expect(bodyOnly[0].fallback).toBe('N/A');
    expect(bodyOnly[1].fallback).toBeUndefined();
  });
});
