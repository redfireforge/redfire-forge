import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseCsvLine,
  parseColumnHeader,
  parseClipboardText,
  parseJsonImport,
  buildColumnsAndRowsFromParseResult,
  extractJsonPath,
  expandPatternFromResponse,
  inferPatternsFromColumns,
  normalizeForCompare,
  parseExcelSimple,
} from './dataSourceImport';
import type { DataSourceColumn } from '../../../shared/types';

// ─── parseCsvLine ────────────────────────────────────────────

describe('parseCsvLine', () => {
  it('parses simple comma-separated values', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace from fields', () => {
    expect(parseCsvLine(' hello , world ')).toEqual(['hello', 'world']);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsvLine('"hello, world",foo')).toEqual(['hello, world', 'foo']);
  });

  it('handles escaped double quotes inside quoted fields', () => {
    expect(parseCsvLine('"say ""hi""",bar')).toEqual(['say "hi"', 'bar']);
  });

  it('toggles quotes when a quote is not part of an escape sequence', () => {
    expect(parseCsvLine('"a"b')).toEqual(['ab']);
  });

  it('returns single element for line with no commas', () => {
    expect(parseCsvLine('single')).toEqual(['single']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles empty input', () => {
    expect(parseCsvLine('')).toEqual(['']);
  });
});

// ─── parseColumnHeader ───────────────────────────────────────

describe('parseColumnHeader', () => {
  it('parses path: prefix', () => {
    expect(parseColumnHeader('path:userId')).toEqual({ type: 'path', name: 'userId' });
  });

  it('parses param: prefix', () => {
    expect(parseColumnHeader('param:channel')).toEqual({ type: 'param', name: 'channel' });
  });

  it('parses validate: prefix', () => {
    expect(parseColumnHeader('validate:$.status')).toEqual({ type: 'validate', name: '$.status' });
  });

  it('parses expect: prefix (alias for validate)', () => {
    expect(parseColumnHeader('expect:$.name')).toEqual({ type: 'validate', name: '$.name' });
  });

  it('parses header: prefix', () => {
    expect(parseColumnHeader('header:X-Custom')).toEqual({ type: 'header', name: 'X-Custom' });
  });

  it('parses body: prefix', () => {
    expect(parseColumnHeader('body:$.data')).toEqual({ type: 'body', name: '$.data' });
  });

  it('defaults to param type for unprefixed headers', () => {
    expect(parseColumnHeader('myColumn')).toEqual({ type: 'param', name: 'myColumn' });
  });

  it('is case-insensitive for prefix matching', () => {
    expect(parseColumnHeader('PATH:userId')).toEqual({ type: 'path', name: 'userId' });
    expect(parseColumnHeader('Validate:$.status')).toEqual({ type: 'validate', name: '$.status' });
  });
});

// ─── parseClipboardText ──────────────────────────────────────

describe('parseClipboardText', () => {
  it('parses TSV clipboard data', () => {
    const text = 'name\tage\nAlice\t30\nBob\t25';
    const result = parseClipboardText(text);
    expect(result.headers).toEqual(['name', 'age']);
    expect(result.rows).toEqual([['Alice', '30'], ['Bob', '25']]);
  });

  it('parses CSV clipboard data', () => {
    const text = 'name,age\nAlice,30\nBob,25';
    const result = parseClipboardText(text);
    expect(result.headers).toEqual(['name', 'age']);
    expect(result.rows).toEqual([['Alice', '30'], ['Bob', '25']]);
  });

  it('handles empty input', () => {
    const result = parseClipboardText('');
    expect(result.headers).toEqual(['']);
    expect(result.rows).toEqual([]);
  });

  it('skips empty data lines', () => {
    const text = 'name\tage\nAlice\t30\n\nBob\t25\n';
    const result = parseClipboardText(text);
    expect(result.rows.length).toBe(2);
  });
});

// ─── parseJsonImport ─────────────────────────────────────────

describe('parseJsonImport', () => {
  it('parses simple array-of-objects format', () => {
    const json = [
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ];
    const result = parseJsonImport(json, []);
    expect(result.columns.length).toBe(2);
    expect(result.columns[0].name).toBe('name');
    expect(result.columns[1].name).toBe('age');
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].enabled).toBe(true);
  });

  it('parses schema v1 format with version and rows', () => {
    const json = {
      version: 1,
      columns: [
        { name: 'vin', type: 'path', mapping: 'vin' },
        { name: 'expected', type: 'validate', mapping: '$.status' },
      ],
      rows: [
        { values: { vin: 'VIN123', expected: '200' } },
        { values: { vin: 'VIN456', expected: '200' }, enabled: false },
      ],
    };
    const result = parseJsonImport(json, []);
    expect(result.columns.length).toBe(2);
    expect(result.columns[0].type).toBe('path');
    expect(result.rows.length).toBe(2);
    expect(result.rows[1].enabled).toBe(false);
  });

  it('reuses existing columns when names match', () => {
    const existing: DataSourceColumn[] = [
      { id: 'col-1', name: 'name', type: 'path', mapping: 'name' },
    ];
    const json = [{ name: 'Alice', status: '200' }];
    const result = parseJsonImport(json, existing);
    expect(result.columns[0]).toBe(existing[0]); // same reference
    expect(result.columns[1].type).toBe('param'); // new col defaults to param
  });

  it('stringifies non-string values', () => {
    const json = [{ data: { nested: true }, count: 42 }];
    const result = parseJsonImport(json, []);
    const firstRow = result.rows[0];
    const dataCol = result.columns.find(c => c.name === 'data')!;
    const countCol = result.columns.find(c => c.name === 'count')!;
    expect(firstRow.values[dataCol.id]).toBe('{"nested":true}');
    expect(firstRow.values[countCol.id]).toBe('42');
  });

  it('throws on unrecognized format', () => {
    expect(() => parseJsonImport('not-json', [])).toThrow('Unrecognized JSON format');
    expect(() => parseJsonImport({}, [])).toThrow('Unrecognized JSON format');
    expect(() => parseJsonImport([], [])).toThrow('Unrecognized JSON format');
  });

  it('detects column type from header prefix in array-of-objects', () => {
    const json = [{ 'validate:$.status': '200', 'path:userId': '1' }];
    const result = parseJsonImport(json, []);
    expect(result.columns.find(c => c.name === '$.status')?.type).toBe('validate');
    expect(result.columns.find(c => c.name === 'userId')?.type).toBe('path');
  });

  it('parses schema without columns array using inferred defaults', () => {
    const json = {
      version: 1,
      rows: [{ values: { a: '1' } }],
    };
    const result = parseJsonImport(json, []);
    expect(result.columns).toEqual([]);
    expect(result.rows[0].values).toEqual({});
  });

  it('preserves explicit column id and reads values via mapping when name differs', () => {
    const json = {
      version: 1,
      columns: [{ id: 'fixed-col', name: 'Display', type: 'param', mapping: 'vinRef' }],
      rows: [{ values: { vinRef: 'V1' } }],
    };
    const result = parseJsonImport(json, []);
    expect(result.columns[0].id).toBe('fixed-col');
    expect(result.columns[0].mapping).toBe('vinRef');
    expect(result.rows[0].values['fixed-col']).toBe('V1');
  });

  it('maps schema row values by column name and attaches optional row fields', () => {
    const json = {
      version: 2,
      columns: [{ name: 'k', type: 'param', mapping: 'alias' }],
      rows: [
        {
          id: 'row-1',
          label: 'L1',
          tags: ['t1'],
          note: 'n1',
          isSample: true,
          values: { k: 'by-name', extra: 99 },
        },
      ],
    };
    const result = parseJsonImport(json, []);
    const col = result.columns[0];
    expect(result.rows[0].values[col.id]).toBe('by-name');
    expect(result.rows[0].label).toBe('L1');
    expect(result.rows[0].tags).toEqual(['t1']);
    expect(result.rows[0].note).toBe('n1');
    expect(result.rows[0].isSample).toBe(true);
  });

  it('stringifies non-string values in schema rows', () => {
    const json = {
      version: 1,
      columns: [{ name: 'x', type: 'param', mapping: 'x' }],
      rows: [{ values: { x: { y: 1 } } }],
    };
    const result = parseJsonImport(json, []);
    const col = result.columns[0];
    expect(result.rows[0].values[col.id]).toBe('{"y":1}');
  });

  it('falls back to mapping key when the name key is absent in array rows', () => {
    const existing: DataSourceColumn[] = [{ id: 'n1', name: 'n', type: 'param', mapping: 'm' }];
    const first: Record<string, unknown> = { m: 'mapped' };
    first.n = undefined;
    const result = parseJsonImport([first], existing);
    const col = result.columns.find(c => c.name === 'n')!;
    expect(result.rows[0].values[col.id]).toBe('mapped');
  });
});

// ─── buildColumnsAndRowsFromParseResult ──────────────────────

describe('buildColumnsAndRowsFromParseResult', () => {
  it('builds columns from CsvParseResult, skipping metadata fields', () => {
    const result = {
      columns: ['name', 'method', 'url', 'param:channel', 'validate:$.status'],
      rows: [
        {
          scenario: { name: 'Test', url: 'http://example.com', method: 'GET' as const },
          raw: { 'param:channel': 'WEB', 'validate:$.status': '200' },
        },
      ],
      fileErrors: [],
    };
    const { columns, rows } = buildColumnsAndRowsFromParseResult(result, []);
    // name, method, url should be skipped
    expect(columns.length).toBe(2);
    expect(columns[0].type).toBe('param');
    expect(columns[0].name).toBe('channel');
    expect(columns[1].type).toBe('validate');
    expect(columns[1].name).toBe('$.status');
    expect(rows.length).toBe(1);
    expect(rows[0].values[columns[0].id]).toBe('WEB');
  });

  it('skips rows without scenario', () => {
    const result = {
      columns: ['param:x'],
      rows: [
        { scenario: undefined, raw: { 'param:x': '1' } },
        { scenario: { name: 'T', url: 'http://x', method: 'GET' as const }, raw: { 'param:x': '2' } },
      ],
      fileErrors: [],
    };
    const { rows } = buildColumnsAndRowsFromParseResult(result, []);
    expect(rows.length).toBe(1);
  });

  it('uses columnTypes map when present', () => {
    const result = {
      columns: ['customField'],
      rows: [
        { scenario: { name: 'T', url: 'http://x', method: 'GET' as const }, raw: { customField: 'val' } },
      ],
      fileErrors: [],
      columnTypes: new Map([['customField', { type: 'header', mapping: 'X-Custom' }]]),
    };
    const { columns } = buildColumnsAndRowsFromParseResult(result, []);
    expect(columns[0].type).toBe('header');
    expect(columns[0].mapping).toBe('X-Custom');
  });

  it('falls back to existing columns when no columnTypes', () => {
    const existing: DataSourceColumn[] = [
      { id: 'ex-1', name: 'myField', type: 'path', mapping: 'myField' },
    ];
    const result = {
      columns: ['myField'],
      rows: [
        { scenario: { name: 'T', url: 'http://x', method: 'GET' as const }, raw: { myField: 'v' } },
      ],
      fileErrors: [],
    };
    const { columns } = buildColumnsAndRowsFromParseResult(result, existing);
    expect(columns[0].type).toBe('path');
    expect(columns[0].mapping).toBe('myField');
  });

  it('handles header: and body: prefixed columns', () => {
    const result = {
      columns: ['header:Authorization', 'body:payload'],
      rows: [
        { scenario: { name: 'T', url: 'http://x', method: 'POST' as const }, raw: { 'header:Authorization': 'Bearer xyz', 'body:payload': '{}' } },
      ],
      fileErrors: [],
    };
    const { columns } = buildColumnsAndRowsFromParseResult(result, []);
    expect(columns[0].type).toBe('header');
    expect(columns[0].name).toBe('Authorization');
    expect(columns[1].type).toBe('body');
    expect(columns[1].name).toBe('payload');
  });

  it('skips columnTypes row when inferred type is name', () => {
    const result = {
      columns: ['colA'],
      rows: [],
      fileErrors: [],
      columnTypes: new Map([['colA', { type: 'name', mapping: 'n' }]]),
    };
    const { columns, rows } = buildColumnsAndRowsFromParseResult(result, []);
    expect(columns.length).toBe(0);
    expect(rows.length).toBe(0);
  });

  it('handles path: and expect: prefixed columns', () => {
    const result = {
      columns: ['path:userId', 'expect:$.ok'],
      rows: [
        {
          scenario: { name: 'T', url: 'http://x', method: 'GET' as const },
          raw: { 'path:userId': 'u1', 'expect:$.ok': 'true' },
        },
      ],
      fileErrors: [],
    };
    const { columns, rows } = buildColumnsAndRowsFromParseResult(result, []);
    expect(columns.map(c => ({ type: c.type, name: c.name }))).toEqual([
      { type: 'path', name: 'userId' },
      { type: 'validate', name: '$.ok' },
    ]);
    expect(rows[0].values[columns[0].id]).toBe('u1');
    expect(rows[0].values[columns[1].id]).toBe('true');
  });

  it('uses column name when columnTypes omits mapping', () => {
    const result = {
      columns: ['misc'],
      rows: [
        { scenario: { name: 'T', url: 'http://x', method: 'GET' as const }, raw: { misc: 'v' } },
      ],
      fileErrors: [],
      columnTypes: new Map([['misc', { type: 'param' }]]),
    };
    const { columns } = buildColumnsAndRowsFromParseResult(result, []);
    expect(columns[0].mapping).toBe('misc');
  });

  it('leaves defaults when no columnTypes and no existing match', () => {
    const result = {
      columns: ['solo'],
      rows: [
        { scenario: { name: 'T', url: 'http://x', method: 'GET' as const }, raw: { solo: 'solo-val' } },
      ],
      fileErrors: [],
    };
    const { columns } = buildColumnsAndRowsFromParseResult(result, []);
    expect(columns[0].type).toBe('param');
    expect(columns[0].mapping).toBe('solo');
  });

  it('uses empty cell when raw has no matching key for a column', () => {
    const result = {
      columns: ['param:p'],
      rows: [
        { scenario: { name: 'T', url: 'http://x', method: 'GET' as const }, raw: {} },
      ],
      fileErrors: [],
    };
    const { columns, rows } = buildColumnsAndRowsFromParseResult(result, []);
    expect(rows[0].values[columns[0].id]).toBe('');
  });

  it('skips metadata-like columns auth_type and body when unprefixed', () => {
    const result = {
      columns: ['auth_type', 'body', 'param:x'],
      rows: [
        {
          scenario: { name: 'T', url: 'http://x', method: 'POST' as const },
          raw: { auth_type: 'bearer', body: '{}', 'param:x': '1' },
        },
      ],
      fileErrors: [],
    };
    const { columns, rows } = buildColumnsAndRowsFromParseResult(result, []);
    expect(columns.map(c => c.name)).toEqual(['x']);
    expect(rows[0].values[columns[0].id]).toBe('1');
  });
});

// ─── extractJsonPath ─────────────────────────────────────────

describe('extractJsonPath', () => {
  it('extracts nested value', () => {
    const obj = { user: { name: 'Alice' } };
    expect(extractJsonPath(obj, 'user.name')).toBe('Alice');
  });

  it('extracts array element', () => {
    const obj = { items: ['a', 'b', 'c'] };
    expect(extractJsonPath(obj, 'items[1]')).toBe('b');
  });

  it('returns empty string for missing path', () => {
    expect(extractJsonPath({ a: 1 }, 'b.c')).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(extractJsonPath(null, 'a')).toBe('');
  });

  it('returns empty when intermediate value is null', () => {
    expect(extractJsonPath({ a: { b: null } }, 'a.b.c')).toBe('');
  });

  it('returns JSON string for object values', () => {
    const obj = { data: { x: 1 } };
    expect(extractJsonPath(obj, 'data')).toBe('{"x":1}');
  });

  it('handles deeply nested arrays', () => {
    const obj = { a: [{ b: [{ c: 'found' }] }] };
    expect(extractJsonPath(obj, 'a[0].b[0].c')).toBe('found');
  });
});

// ─── inferPatternsFromColumns ────────────────────────────────

describe('inferPatternsFromColumns', () => {
  it('infers one [*] pattern per indexed validate mapping', () => {
    expect(
      inferPatternsFromColumns(
        [{ type: 'validate', mapping: 'offers[0].code' }, { type: 'path', mapping: 'x' }],
        new Set(),
      ),
    ).toEqual(['offers[*].code']);
  });

  it('dedupes identical patterns and skips contract entries', () => {
    const cols = [
      { type: 'validate', mapping: 'items[0].id' },
      { type: 'validate', mapping: 'items[1].id' },
    ];
    expect(inferPatternsFromColumns(cols, new Set())).toEqual(['items[*].id']);
    expect(inferPatternsFromColumns(cols, new Set(['items[*].id']))).toEqual([]);
  });

  it('ignores non-validate and non-indexed columns', () => {
    expect(
      inferPatternsFromColumns(
        [{ type: 'param', mapping: 'offers[0].x' }, { type: 'validate', mapping: 'plain' }],
        new Set(),
      ),
    ).toEqual([]);
  });

  it('treats missing mapping like an empty validate path', () => {
    expect(inferPatternsFromColumns([{ type: 'validate' }], new Set())).toEqual([]);
  });
});

describe('expandPatternFromResponse', () => {
  it('expands [*] pattern against array', () => {
    const obj = { items: [{ name: 'a' }, { name: 'b' }] };
    const paths = expandPatternFromResponse(obj, 'items[*].name');
    expect(paths).toEqual(['items[0].name', 'items[1].name']);
  });

  it('returns no paths when target is not an array', () => {
    const obj = { items: 'not-array' };
    const paths = expandPatternFromResponse(obj, 'items[*].name');
    expect(paths).toEqual([]);
  });

  it('handles nested [*] patterns', () => {
    const obj = { a: [{ b: [{ c: 1 }, { c: 2 }] }] };
    const paths = expandPatternFromResponse(obj, 'a[*].b[*].c');
    expect(paths).toEqual(['a[0].b[0].c', 'a[0].b[1].c']);
  });

  it('does not recurse into wildcard when intermediate path is missing', () => {
    expect(expandPatternFromResponse({}, 'missing[*].x')).toEqual([]);
  });

  it('handles trailing wildcard segments', () => {
    const tree = { offers: [{ id: '1' }, { id: '2' }] };
    expect(expandPatternFromResponse(tree, 'offers[*]')).toEqual(['offers[0]', 'offers[1]']);
  });

  it('handles pattern without [*]', () => {
    const obj = { foo: { bar: 1 } };
    const paths = expandPatternFromResponse(obj, 'foo.bar');
    expect(paths).toEqual(['foo.bar']);
  });

  it('walks multiple static segments before a wildcard segment', () => {
    const obj = { a: { b: { items: [{ z: 1 }, { z: 2 }] } } };
    expect(expandPatternFromResponse(obj, 'a.b.items[*].z')).toEqual(['a.b.items[0].z', 'a.b.items[1].z']);
  });

  it('stops when static segment path hits a missing object', () => {
    expect(expandPatternFromResponse({ a: {} }, 'a.b.c')).toEqual([]);
  });
});

// ─── normalizeForCompare ─────────────────────────────────────

describe('normalizeForCompare', () => {
  it('trims whitespace', () => {
    expect(normalizeForCompare('  hello  ')).toBe('hello');
  });

  it('returns empty for empty input', () => {
    expect(normalizeForCompare('')).toBe('');
  });

  it('unwraps JSON-stringified strings', () => {
    expect(normalizeForCompare('"hello"')).toBe('hello');
  });

  it('parses JSON objects to string', () => {
    expect(normalizeForCompare('{"a":1}')).toBe('[object Object]');
  });

  it('handles arrays', () => {
    expect(normalizeForCompare('[1,2,3]')).toBe('1,2,3');
  });

  it('keeps non-JSON strings as-is', () => {
    expect(normalizeForCompare('plain text')).toBe('plain text');
  });

  it('handles malformed JSON gracefully', () => {
    expect(normalizeForCompare('{broken')).toBe('{broken');
  });
});

// ─── parseExcelSimple ────────────────────────────────────────

const xlsxFixture = {
  variant: 'grid' as 'grid' | 'missing_sheet' | 'header_only' | 'short_row',
};

vi.mock('xlsx-js-style', () => ({
  read: (_buf: ArrayBuffer, _opts: unknown) => {
    if (xlsxFixture.variant === 'missing_sheet') {
      return { SheetNames: ['Sheet1'], Sheets: {} };
    }
    return {
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: { __mockSheet: true },
      },
    };
  },
  utils: {
    sheet_to_json: (_sheet: unknown, _opts: unknown) => {
      if (xlsxFixture.variant === 'header_only') {
        return [['a', 'b']];
      }
      if (xlsxFixture.variant === 'short_row') {
        return [
          ['userId', 'channel', 'status'],
          ['42'],
        ];
      }
      return [
        ['userId', 'channel', 'status'],
        ['42', 'WEB', 'active'],
        ['99', 'APP', 'pending'],
        ['', '', ''],
      ];
    },
  },
}));

describe('parseExcelSimple', () => {
  afterEach(() => {
    xlsxFixture.variant = 'grid';
  });

  it('parses Excel buffer into columns and rows', async () => {
    xlsxFixture.variant = 'grid';
    const buffer = new ArrayBuffer(8);
    const result = await parseExcelSimple(buffer, []);
    expect(result.columns.length).toBe(3);
    expect(result.columns[0].name).toBe('userId');
    expect(result.columns[1].name).toBe('channel');
    expect(result.columns[2].name).toBe('status');
    expect(result.rows.length).toBe(2); // empty row skipped
    expect(result.rows[0].values[result.columns[0].id]).toBe('42');
    expect(result.rows[1].values[result.columns[1].id]).toBe('APP');
  });

  it('reuses existing columns when names match', async () => {
    xlsxFixture.variant = 'grid';
    const existing: DataSourceColumn[] = [
      { id: 'existing-1', name: 'userId', type: 'path', mapping: 'userId' },
    ];
    const buffer = new ArrayBuffer(8);
    const result = await parseExcelSimple(buffer, existing);
    // Should reuse the existing column's type and mapping
    expect(result.columns[0].name).toBe('userId');
    expect(result.columns[0].type).toBe('path');
    expect(result.columns[0].mapping).toBe('userId');
  });

  it('returns empty columns and rows when the sheet is missing', async () => {
    xlsxFixture.variant = 'missing_sheet';
    const result = await parseExcelSimple(new ArrayBuffer(0), []);
    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('returns empty columns and rows when only a header row is present', async () => {
    xlsxFixture.variant = 'header_only';
    const result = await parseExcelSimple(new ArrayBuffer(0), []);
    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('pads short data rows with empty strings for missing cells', async () => {
    xlsxFixture.variant = 'short_row';
    const result = await parseExcelSimple(new ArrayBuffer(0), []);
    expect(result.columns.map(c => c.name)).toEqual(['userId', 'channel', 'status']);
    expect(result.rows[0].values[result.columns[0].id]).toBe('42');
    expect(result.rows[0].values[result.columns[1].id]).toBe('');
    expect(result.rows[0].values[result.columns[2].id]).toBe('');
  });
});
