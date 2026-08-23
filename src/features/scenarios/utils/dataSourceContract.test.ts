/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  extractTemplateVariables,
  extractQueryKeys,
  buildMappingSummary,
} from './dataSourceContract';
import type { DataSource, SharedDataSourceFetchConfig } from '@shared/types';

describe('extractTemplateVariables', () => {
  it('returns empty for empty string', () => {
    expect(extractTemplateVariables('')).toEqual([]);
  });

  it('extracts unique variables from double-brace syntax', () => {
    expect(extractTemplateVariables('{{ a }} and {{b }} {{ a }}')).toEqual(['a', 'b']);
  });

  it('returns empty when no placeholders', () => {
    expect(extractTemplateVariables('plain')).toEqual([]);
  });
});

describe('extractQueryKeys', () => {
  it('returns empty when no url', () => {
    expect(extractQueryKeys('')).toEqual([]);
  });

  it('returns empty when no query string', () => {
    expect(extractQueryKeys('https://x.com/path')).toEqual([]);
  });

  it('parses keys before hash fragment', () => {
    expect(extractQueryKeys('https://x.com/a?foo=1&bar=2#frag')).toEqual(expect.arrayContaining(['foo', 'bar']));
    expect(extractQueryKeys('https://x.com/a?foo=1&bar=2#frag')).toHaveLength(2);
  });

  it('handles keys without value', () => {
    expect(extractQueryKeys('https://x.com?flag&a=1')).toEqual(expect.arrayContaining(['flag', 'a']));
  });

  it('skips empty query segments', () => {
    expect(extractQueryKeys('https://x.com?a=1&&b=2')).toEqual(['a', 'b']);
  });

  it('returns empty keys when query string is empty after ?', () => {
    expect(extractQueryKeys('https://x.com/path?')).toEqual([]);
  });

  it('decodes encoded keys', () => {
    expect(extractQueryKeys('https://x.com?he%20llo=1')).toEqual(['he llo']);
  });

  it('uses raw key when decodeURIComponent throws', () => {
    const bad = 'https://x.com?%c0%af=1';
    const keys = extractQueryKeys(bad);
    expect(keys.length).toBe(1);
  });
});

describe('buildMappingSummary', () => {
  it('returns zero counts when there are no columns', () => {
    const cfg: SharedDataSourceFetchConfig = { url: 'https://api/{{vin}}/x', headers: [], body: '' };
    const ds: DataSource = { columns: [], rows: [] };
    expect(buildMappingSummary(cfg, ds)).toEqual({ counts: { path: 0, param: 0, header: 0, body: 0, validate: 0 }, warnings: [] });
  });

  it('validates mappings when fetchConfig is undefined', () => {
    const ds: DataSource = {
      columns: [{ id: '1', name: 'n', type: 'path', mapping: 'orphan' }],
      rows: [],
    };
    const r = buildMappingSummary(undefined, ds);
    expect(r.warnings.some(w => w.type === 'path')).toBe(true);
  });

  it('merges pathVariables into path set when URL lacks templates', () => {
    const cfg: SharedDataSourceFetchConfig = {
      url: 'https://api/no-templates',
      headers: [],
      body: '',
      pathVariables: [{ variableName: 'pv' }],
    };
    const ds: DataSource = {
      columns: [{ id: '1', name: 'x', type: 'path', mapping: 'pv' }],
      rows: [],
    };
    expect(buildMappingSummary(cfg, ds).warnings).toHaveLength(0);
  });

  it('increments counts per column type without warnings when mappings match', () => {
    const cfg: SharedDataSourceFetchConfig = {
      url: 'https://api/{{vin}}/x?q={{q}}',
      headers: [{ key: 'X-Token', value: '1' }],
      body: '{"id":{{bodyId}}}',
      pathVariables: [{ variableName: 'altPath' }],
    };
    const ds: DataSource = {
      columns: [
        { id: '1', name: 'VIN', type: 'path', mapping: 'vin' },
        { id: '2', name: '', type: 'path', mapping: 'altPath' },
        { id: '3', name: 'q', type: 'param', mapping: 'q' },
        { id: '4', name: 'tok', type: 'header', mapping: 'x-token' },
        { id: '5', name: 'bid', type: 'body', mapping: 'bodyId' },
        { id: '6', name: 'v', type: 'validate', mapping: 'x' },
      ],
      rows: [],
    };
    const r = buildMappingSummary(cfg, ds);
    expect(r.counts).toEqual({ path: 2, param: 1, header: 1, body: 1, validate: 1 });
    expect(r.warnings).toHaveLength(0);
  });

  it('emits warnings for orphan mappings', () => {
    const cfg: SharedDataSourceFetchConfig = {
      url: 'https://api/plain',
      headers: [{ key: 'Other', value: '1' }],
      body: '',
    };
    const ds: DataSource = {
      columns: [
        { id: '1', name: 'n', type: 'path', mapping: 'missingPath' },
        { id: '2', name: 'p', type: 'param', mapping: 'missingQ' },
        { id: '3', name: 'h', type: 'header', mapping: 'x-ghost' },
        { id: '4', name: 'b', type: 'body', mapping: 'ghostBody' },
      ],
      rows: [],
    };
    const r = buildMappingSummary(cfg, ds);
    expect(r.warnings.map(w => w.type)).toEqual(['path', 'param', 'header', 'body']);
  });

  it('matches path warning against column name as placeholder', () => {
    const cfg: SharedDataSourceFetchConfig = { url: 'https://api/{{byName}}/x', headers: [], body: '' };
    const ds: DataSource = {
      columns: [{ id: '1', name: 'byName', type: 'path', mapping: 'wrongKey' }],
      rows: [],
    };
    const r = buildMappingSummary(cfg, ds);
    expect(r.warnings).toHaveLength(0);
  });

  it('matches param warning against column name as query key', () => {
    const cfg: SharedDataSourceFetchConfig = { url: 'https://api/x?foo=1', headers: [], body: '' };
    const ds: DataSource = {
      columns: [{ id: '1', name: 'foo', type: 'param', mapping: 'wrong' }],
      rows: [],
    };
    expect(buildMappingSummary(cfg, ds).warnings).toHaveLength(0);
  });

  it('ignores query pairs with empty key', () => {
    expect(extractQueryKeys('https://x.com?=v&b=2')).toEqual(['b']);
  });

  it('counts validate column with blank mapping only', () => {
    const ds: DataSource = {
      columns: [{ id: '1', name: 'v', type: 'validate', mapping: '' }],
      rows: [],
    };
    const r = buildMappingSummary({ url: '', headers: [], body: '' }, ds);
    expect(r.counts.validate).toBe(1);
    expect(r.warnings).toHaveLength(0);
  });

  it('skips columns with empty mapping', () => {
    const ds: DataSource = {
      columns: [{ id: '1', name: 'x', type: 'path', mapping: '  ' }],
      rows: [],
    };
    expect(buildMappingSummary({ url: '', headers: [], body: '' }, ds).warnings).toHaveLength(0);
  });

  it('returns empty summary when dataSource is undefined', () => {
    const r = buildMappingSummary({ url: 'https://x.com/{{id}}', headers: [], body: '' }, undefined);
    expect(r.warnings).toHaveLength(0);
    expect(r.counts.path).toBe(0);
  });

  it('handles undefined fetch config and column fields', () => {
    const ds: DataSource = {
      columns: [{ id: '1', name: undefined as unknown as string, type: 'path', mapping: undefined as unknown as string }],
      rows: [],
    };
    const r = buildMappingSummary(undefined, ds);
    expect(r.counts.path).toBe(1);
    expect(r.warnings).toHaveLength(0);
  });
});
