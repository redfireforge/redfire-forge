import { describe, expect, it } from 'vitest';
import { formatJsonPathValue, jsonPathFromCursorOffset, jsonPathFromSelection } from './jsonPathFromCursor';
import { resolveSimpleJsonPath } from './predicateEvaluatorHelpers';

const SAMPLE = JSON.stringify({
  customer: { id: 'C-4421', tier: 'gold' },
  items: [{ sku: 'RF-100', qty: 2 }],
  tags: ['a', 'b'],
  nested: [[true]],
  'weird.key': 1,
}, null, 2);

function at(needle: string, fromIndex = 0): number {
  const idx = SAMPLE.indexOf(needle, fromIndex);
  expect(idx).toBeGreaterThanOrEqual(0);
  return idx;
}

describe('resolveSimpleJsonPath array support', () => {
  const obj = JSON.parse(SAMPLE);

  it('resolves dotted object paths', () => {
    expect(resolveSimpleJsonPath(obj, '$.customer.tier')).toBe('gold');
  });

  it('resolves array index paths used by the toolbox', () => {
    expect(resolveSimpleJsonPath(obj, '$.items[0].sku')).toBe('RF-100');
    expect(resolveSimpleJsonPath(obj, '$.items[0].qty')).toBe(2);
    expect(resolveSimpleJsonPath(obj, '$.tags[1]')).toBe('b');
    expect(resolveSimpleJsonPath(obj, '$.nested[0][0]')).toBe(true);
  });

  it('resolves root and missing paths', () => {
    expect(resolveSimpleJsonPath(obj, '$')).toEqual(obj);
    expect(resolveSimpleJsonPath(obj, '$.items[9].sku')).toBeUndefined();
  });
});

describe('jsonPathFromCursorOffset', () => {
  it('detects nested object keys and values', () => {
    expect(jsonPathFromCursorOffset(SAMPLE, at('"tier"'))).toMatchObject({
      path: '$.customer.tier',
      value: 'gold',
    });
    expect(jsonPathFromCursorOffset(SAMPLE, at('"gold"'))).toMatchObject({
      path: '$.customer.tier',
      value: 'gold',
    });
  });

  it('detects keys and values inside array objects', () => {
    expect(jsonPathFromCursorOffset(SAMPLE, at('"sku"'))).toMatchObject({
      path: '$.items[0].sku',
      value: 'RF-100',
    });
    expect(jsonPathFromCursorOffset(SAMPLE, at('"RF-100"'))).toMatchObject({
      path: '$.items[0].sku',
      value: 'RF-100',
    });
    expect(jsonPathFromCursorOffset(SAMPLE, at('"qty"'))).toMatchObject({
      path: '$.items[0].qty',
      value: '2',
    });
  });

  it('detects primitive array elements and nested arrays', () => {
    expect(jsonPathFromCursorOffset(SAMPLE, at('"b"'))).toMatchObject({
      path: '$.tags[1]',
      value: 'b',
    });
    expect(jsonPathFromCursorOffset(SAMPLE, at('true'))).toMatchObject({
      path: '$.nested[0][0]',
      value: 'true',
    });
  });

  it('resolves when caret is on array-item braces or inner whitespace', () => {
    const itemBrace = SAMPLE.indexOf('{', at('"items"'));
    expect(jsonPathFromCursorOffset(SAMPLE, itemBrace)).toMatchObject({
      path: '$.items[0]',
      value: '{"sku":"RF-100","qty":2}',
    });
    expect(jsonPathFromCursorOffset(SAMPLE, at('"sku"') - 1)).toMatchObject({
      path: '$.items[0]',
    });
  });

  it('resolves the array container when caret is on [', () => {
    const bracket = SAMPLE.indexOf('[', at('"items"'));
    expect(jsonPathFromCursorOffset(SAMPLE, bracket)).toMatchObject({
      path: '$.items',
    });
  });

  it('handles non-identifier keys with bracket segments', () => {
    expect(jsonPathFromCursorOffset(SAMPLE, at('"weird.key"'))).toMatchObject({
      path: '$[weird.key]',
      value: '1',
    });
    expect(resolveSimpleJsonPath(JSON.parse(SAMPLE), '$[weird.key]')).toBe(1);
  });

  it('returns null for invalid JSON', () => {
    expect(jsonPathFromCursorOffset('{bad', 1)).toBeNull();
  });

  it('returns null for out-of-range offsets', () => {
    expect(jsonPathFromCursorOffset(SAMPLE, -1)).toBeNull();
    expect(jsonPathFromCursorOffset(SAMPLE, SAMPLE.length + 5)).toBeNull();
    expect(jsonPathFromCursorOffset(SAMPLE, SAMPLE.length)).toBeNull();
  });

  it('resolves scalar and empty collection roots', () => {
    expect(jsonPathFromCursorOffset('42', 0)).toMatchObject({ path: '$', value: '42' });
    expect(jsonPathFromCursorOffset('true', 0)).toMatchObject({ path: '$', value: 'true' });
    expect(jsonPathFromCursorOffset('null', 0)).toMatchObject({ path: '$', value: 'null' });
    expect(jsonPathFromCursorOffset('"hi"', 1)).toMatchObject({ path: '$', value: 'hi' });
    expect(jsonPathFromCursorOffset('{}', 1)).toMatchObject({ path: '$', value: '{}' });
    expect(jsonPathFromCursorOffset('[]', 1)).toMatchObject({ path: '$', value: '[]' });
  });

  it('binds array commas to the preceding element path', () => {
    const arr = '[\n  1,\n  2\n]';
    const comma = arr.indexOf(',', arr.indexOf('1'));
    expect(jsonPathFromCursorOffset(arr, comma)).toMatchObject({ path: '$[0]', value: '1' });
  });

  it('resolves string values with escape sequences in source', () => {
    const esc = '{\n  "text": "line\\nquote\\"slash\\\\tab\\ttab\\rreturn\\/unicode\\u0041\\b\\fx"\n}';
    expect(JSON.parse(esc).text).toBe('line\nquote"slash\\tab\ttab\rreturn/unicodeA\b\fx');
    const needle = esc.indexOf('line');
    expect(jsonPathFromCursorOffset(esc, needle)).toMatchObject({
      path: '$.text',
      value: 'line\nquote"slash\\tab\ttab\rreturn/unicodeA\b\fx',
    });
  });
});

describe('formatJsonPathValue', () => {
  it('formats scalars and structured values', () => {
    expect(formatJsonPathValue(undefined)).toBe('');
    expect(formatJsonPathValue(null)).toBe('null');
    expect(formatJsonPathValue('hi')).toBe('hi');
    expect(formatJsonPathValue(42)).toBe('42');
    expect(formatJsonPathValue(true)).toBe('true');
    expect(formatJsonPathValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe('jsonPathFromSelection', () => {
  it('select-all resolves to root $, not a deep leaf', () => {
    const hit = jsonPathFromSelection(SAMPLE, 0, SAMPLE.length);
    expect(hit?.path).toBe('$');
    expect(hit?.value).toContain('"customer"');
    expect(hit?.value).toContain('"items"');
  });

  it('selecting an array item object resolves to that element, not a leaf field', () => {
    const start = SAMPLE.indexOf('{', at('"items"'));
    const end = SAMPLE.indexOf('}', start) + 1;
    expect(jsonPathFromSelection(SAMPLE, start, end)).toMatchObject({
      path: '$.items[0]',
      value: '{"sku":"RF-100","qty":2}',
    });
  });

  it('selecting the items array resolves to $.items', () => {
    const start = SAMPLE.indexOf('[', at('"items"'));
    const end = SAMPLE.indexOf(']', start) + 1;
    // Pretty-printed array may contain nested `]` — find matching close via span logic.
    // Selection from `[` through the array's closing `]` on its own line:
    const closeLine = SAMPLE.indexOf('\n  ]', start);
    const rangeEnd = closeLine >= 0 ? closeLine + '\n  ]'.length : end;
    expect(jsonPathFromSelection(SAMPLE, start, rangeEnd)?.path).toBe('$.items');
  });

  it('resolves a full "key": "value", line inside an array object', () => {
    const start = at('"sku"');
    const end = SAMPLE.indexOf(',', start) + 1;
    const hit = jsonPathFromSelection(SAMPLE, start, end);
    expect(hit).toMatchObject({ path: '$.items[0].sku', value: 'RF-100' });
  });

  it('maps colon and trailing comma offsets to the property', () => {
    const colon = SAMPLE.indexOf(':', at('"sku"'));
    expect(jsonPathFromCursorOffset(SAMPLE, colon)?.path).toBe('$.items[0].sku');
    const comma = SAMPLE.indexOf(',', at('"RF-100"'));
    expect(jsonPathFromCursorOffset(SAMPLE, comma)?.path).toBe('$.items[0].sku');
  });

  it('still works for a collapsed caret', () => {
    expect(jsonPathFromSelection(SAMPLE, at('"sku"'))?.path).toBe('$.items[0].sku');
  });

  it('falls back when selection is whitespace-only after trim', () => {
    const wsStart = SAMPLE.indexOf('\n');
    expect(jsonPathFromSelection(SAMPLE, wsStart, wsStart + 2)?.path).toBe('$');
  });

  it('falls back to caret resolution when no span fully contains the range', () => {
    const mid = at('"sku"') + 1;
    expect(jsonPathFromSelection(SAMPLE, mid, mid + 500)?.path).toBe('$.items[0].sku');
  });

  it('handles reversed selection bounds', () => {
    const pos = at('"gold"');
    expect(jsonPathFromSelection(SAMPLE, pos + 3, pos)?.path).toBe('$.customer.tier');
  });

  it('returns null for invalid JSON in selection mode', () => {
    expect(jsonPathFromSelection('{bad', 0, 1)).toBeNull();
  });

  it('uses caret fallback when trimmed selection is empty', () => {
    const j = '{\n  "a": 1\n}';
    const keyPos = j.indexOf('"a"');
    expect(jsonPathFromSelection(j, keyPos, keyPos + 1)?.path).toBe('$.a');
  });
});
