import { describe, it, expect } from 'vitest';
import type { DragEvent } from 'react';
import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import type { Assertion } from '../../../types';
import {
  SOURCE_TEXT_PREFIX,
  TARGET_FIELD_TEXT_PREFIX,
  REMAP_TEXT_PREFIX,
  TYPE_LABELS,
  ARRAY_ASSERTION_LABELS,
  COMPARISON_OPS,
  parseEachInput,
  getAssertionJsonPath,
  formatAssertionLine,
  matchesSearchTerm,
  matchesFilter,
  matchesNodeVisibility,
  formatNodeDisplayKey,
  formatAssertionSummary,
  extractDragPayload,
} from './targetTreeHelpers';

function mockDragEvent(mime: string, plain: string): DragEvent {
  return {
    dataTransfer: {
      getData: (type: string) => {
        if (type === 'application/mapper-source') return mime;
        if (type === 'text/plain') return plain;
        return '';
      },
    },
  } as unknown as DragEvent;
}

function leaf(key: string, path: string, type: JsonTreeNode['type'] = 'string', value?: unknown): JsonTreeNode {
  return { key, path, type, value };
}
function branch(key: string, path: string, children: JsonTreeNode[], type: JsonTreeNode['type'] = 'object'): JsonTreeNode {
  return { key, path, type, children };
}

describe('targetTreeHelpers constants', () => {
  it('exposes drag/drop text prefixes', () => {
    expect(SOURCE_TEXT_PREFIX).toBe('mapper-source:');
    expect(TARGET_FIELD_TEXT_PREFIX).toBe('mapper-target-field:');
    expect(REMAP_TEXT_PREFIX).toBe('mapper-remap:');
  });

  it('maps JSON types to compact labels', () => {
    expect(TYPE_LABELS.object).toBe('obj');
    expect(TYPE_LABELS.array).toBe('arr');
    expect(TYPE_LABELS.string).toBe('str');
    expect(TYPE_LABELS.number).toBe('num');
    expect(TYPE_LABELS.boolean).toBe('bool');
    expect(TYPE_LABELS.null).toBe('null');
  });

  it('declares the array-assertion presentation metadata', () => {
    expect(ARRAY_ASSERTION_LABELS.arrayLength.label).toBe('LENGTH');
    expect(ARRAY_ASSERTION_LABELS.arrayContains.label).toBe('CONTAINS');
    expect(ARRAY_ASSERTION_LABELS.each.label).toBe('EACH');
    expect(ARRAY_ASSERTION_LABELS.containsSubset.label).toBe('SUBSET');
    expect(ARRAY_ASSERTION_LABELS.custom.label).toBe('CUSTOM');
  });

  it('lists the six comparison operators', () => {
    expect(COMPARISON_OPS).toEqual(['=', '!=', '>', '>=', '<', '<=']);
  });
});

describe('extractDragPayload', () => {
  it('returns null when dataTransfer is missing', () => {
    expect(extractDragPayload({} as unknown as DragEvent)).toBeNull();
  });

  it('parses application/mapper-source JSON', () => {
    const payload = JSON.stringify({ path: 'a.b', sourceId: 'src', type: 'number' });
    expect(extractDragPayload(mockDragEvent(payload, ''))).toEqual({
      path: 'a.b',
      sourceId: 'src',
      type: 'number',
    });
  });

  it('falls back to text/plain with SOURCE_TEXT_PREFIX', () => {
    const inner = JSON.stringify({ path: 'x', sourceId: 'y' });
    expect(extractDragPayload(mockDragEvent('', `${SOURCE_TEXT_PREFIX}${inner}`))).toEqual({
      path: 'x',
      sourceId: 'y',
      type: undefined,
    });
  });

  it('prefers application/mapper-source over text/plain', () => {
    expect(
      extractDragPayload(
        mockDragEvent(
          JSON.stringify({ path: 'mime', sourceId: '1' }),
          `${SOURCE_TEXT_PREFIX}${JSON.stringify({ path: 'plain', sourceId: '2' })}`,
        ),
      ),
    ).toEqual({ path: 'mime', sourceId: '1', type: undefined });
  });

  it('returns null for invalid JSON', () => {
    expect(extractDragPayload(mockDragEvent('not-json', '{'))).toBeNull();
  });

  it('returns null when path or sourceId is not a string', () => {
    expect(extractDragPayload(mockDragEvent(JSON.stringify({ path: 1, sourceId: 'a' }), ''))).toBeNull();
    expect(extractDragPayload(mockDragEvent(JSON.stringify({ path: 'a', sourceId: null }), ''))).toBeNull();
  });
});

describe('matchesSearchTerm', () => {
  it('matches when search is empty', () => {
    expect(matchesSearchTerm(leaf('foo', 'a.foo'), '')).toBe(true);
  });
  it('matches by key (case-insensitive)', () => {
    expect(matchesSearchTerm(leaf('UserName', 'a.UserName'), 'user')).toBe(true);
  });
  it('matches by path (case-insensitive)', () => {
    expect(matchesSearchTerm(leaf('id', 'data.user.id'), 'user')).toBe(true);
  });
  it('matches scalar value for leaf nodes', () => {
    expect(matchesSearchTerm(leaf('x', 'x', 'string', 'HelloWorld'), 'world')).toBe(true);
    expect(matchesSearchTerm(leaf('x', 'x', 'number', 42), '42')).toBe(true);
  });
  it('does NOT match scalar value on object/array nodes', () => {
    expect(matchesSearchTerm({ key: 'o', path: 'o', type: 'object', value: 'hidden' } as JsonTreeNode, 'hidden')).toBe(false);
  });
  it('returns false on no match', () => {
    expect(matchesSearchTerm(leaf('foo', 'a.foo'), 'baz')).toBe(false);
  });
  it('treats null/undefined scalar value as empty string', () => {
    expect(matchesSearchTerm(leaf('x', 'x', 'string', null), 'null')).toBe(false);
    expect(matchesSearchTerm(leaf('x', 'x', 'string', undefined), '')).toBe(true);
  });
});

describe('matchesFilter', () => {
  const mapped = new Set(['data.id', 'data.name']);

  it('returns true for "all" regardless of map status', () => {
    expect(matchesFilter('data.id', 'all', mapped)).toBe(true);
    expect(matchesFilter('any.path', 'all', mapped)).toBe(true);
  });
  it('returns true for "mapped" only when path is mapped', () => {
    expect(matchesFilter('data.id', 'mapped', mapped)).toBe(true);
    expect(matchesFilter('data.other', 'mapped', mapped)).toBe(false);
  });
  it('returns true for "unmapped" only when path is NOT mapped', () => {
    expect(matchesFilter('data.id', 'unmapped', mapped)).toBe(false);
    expect(matchesFilter('data.other', 'unmapped', mapped)).toBe(true);
  });
  it('treats missing mappedTargetPaths as unmapped', () => {
    expect(matchesFilter('a.b', 'mapped')).toBe(false);
    expect(matchesFilter('a.b', 'unmapped')).toBe(true);
  });
});

describe('matchesNodeVisibility', () => {
  const tree = branch('root', '', [
    branch('user', 'user', [
      leaf('id', 'user.id', 'number', 7),
      leaf('name', 'user.name', 'string', 'Alice'),
    ]),
    branch('order', 'order', [leaf('total', 'order.total', 'number', 99)]),
  ]);

  it('returns true for leaf when search empty and filter "all"', () => {
    expect(matchesNodeVisibility(leaf('a', 'a'), '', 'all')).toBe(true);
  });

  it('returns true for branch when any descendant matches search', () => {
    expect(matchesNodeVisibility(tree, 'alice', 'all')).toBe(true);
  });

  it('returns false when neither node nor descendants match search', () => {
    expect(matchesNodeVisibility(tree, 'xyzzy', 'all')).toBe(false);
  });

  it('respects mapped filter against descendants', () => {
    const mapped = new Set(['user.id']);
    expect(matchesNodeVisibility(tree, '', 'mapped', mapped)).toBe(true);
  });

  it('returns false when filter is "mapped" and no descendant is mapped', () => {
    expect(matchesNodeVisibility(tree, '', 'mapped', new Set())).toBe(false);
  });

  it('returns true for unmapped leaf without mapped set', () => {
    expect(matchesNodeVisibility(leaf('a', 'a'), '', 'unmapped')).toBe(true);
  });

  it('leaf with both search match and unmapped filter must be unmapped to qualify', () => {
    expect(matchesNodeVisibility(leaf('id', 'id', 'number', 5), 'id', 'unmapped', new Set(['id']))).toBe(false);
    expect(matchesNodeVisibility(leaf('id', 'id', 'number', 5), 'id', 'unmapped', new Set())).toBe(true);
  });
});

describe('formatNodeDisplayKey', () => {
  it('returns key as-is for plain keys', () => {
    expect(formatNodeDisplayKey(leaf('foo', 'a.foo'))).toBe('foo');
  });
  it('returns "(root)" when key is empty', () => {
    expect(formatNodeDisplayKey(leaf('', ''))).toBe('(root)');
  });
  it('extracts parent[N] form for numeric index keys', () => {
    expect(formatNodeDisplayKey(leaf('[0]', 'offers[0]'))).toBe('offers[0]');
  });
  it('extracts parent[*] form for wildcard index keys', () => {
    expect(formatNodeDisplayKey(leaf('[*]', 'items[*]'))).toBe('items[*]');
  });
  it('falls back to raw key when path normalization fails', () => {
    expect(formatNodeDisplayKey(leaf('[5]', ''))).toBe('[5]');
  });
});

describe('formatAssertionSummary', () => {
  it('formats arrayLength', () => {
    const a: Assertion = { type: 'arrayLength', jsonPath: '$.x', operator: '>=', value: 3 };
    expect(formatAssertionSummary(a)).toBe('3');
  });
  it('formats arrayContains with mode + value', () => {
    const a: Assertion = { type: 'arrayContains', jsonPath: '$.x', mode: 'any', value: 'foo' };
    expect(formatAssertionSummary(a)).toBe('any: foo');
  });
  it('formats arrayContains with empty value', () => {
    const a: Assertion = { type: 'arrayContains', jsonPath: '$.x', mode: 'all', value: '' };
    expect(formatAssertionSummary(a)).toBe('all: (empty)');
  });
  it('formats each with fieldPath/op/value', () => {
    const a: Assertion = { type: 'each', jsonPath: '$.x', fieldPath: 'name', operator: 'equals', value: 'Bob' };
    expect(formatAssertionSummary(a)).toBe('name = Bob');
  });
  it('formats each with default field path "*"', () => {
    const a: Assertion = { type: 'each', jsonPath: '$.x', fieldPath: '', operator: 'is_true' };
    expect(formatAssertionSummary(a)).toBe('* is_true');
  });
  it('formats containsSubset short string verbatim', () => {
    const a: Assertion = { type: 'containsSubset', jsonPath: '$.x', expected: '{"a":1}' };
    expect(formatAssertionSummary(a)).toBe('{"a":1}');
  });
  it('truncates long containsSubset to 27 chars + ellipsis', () => {
    const long = 'x'.repeat(40);
    const a: Assertion = { type: 'containsSubset', jsonPath: '$.x', expected: long };
    expect(formatAssertionSummary(a)).toBe('x'.repeat(27) + '…');
  });
  it('formats custom expression', () => {
    const a: Assertion = { type: 'custom', expression: 'x > 5' };
    expect(formatAssertionSummary(a)).toBe('x > 5');
  });
  it('truncates long custom expression', () => {
    const long = 'a'.repeat(40);
    const a: Assertion = { type: 'custom', expression: long };
    expect(formatAssertionSummary(a)).toBe('a'.repeat(27) + '…');
  });
  it('returns empty string for unsupported types', () => {
    const a = { type: 'status', expected: '200' } as Assertion;
    expect(formatAssertionSummary(a)).toBe('');
  });
});

describe('parseEachInput', () => {
  it('parses "rank >= 0" into fieldPath, operator, value', () => {
    const result = parseEachInput('rank >= 0');
    expect(result).toEqual({ fieldPath: 'rank', operator: 'greater_than_or_equal', value: '0' });
  });

  it('parses "* exists" into empty fieldPath + exists operator', () => {
    const result = parseEachInput('* exists');
    expect(result).toEqual({ fieldPath: '', operator: 'exists', value: '' });
  });

  it('parses "name = foo" with display symbol', () => {
    const result = parseEachInput('name = foo');
    expect(result).toEqual({ fieldPath: 'name', operator: 'equals', value: 'foo' });
  });

  it('parses "* is_true" with no value', () => {
    const result = parseEachInput('* is_true');
    expect(result).toEqual({ fieldPath: '', operator: 'is_true', value: '' });
  });

  it('parses "score > 10" with internal operator name', () => {
    const result = parseEachInput('score > 10');
    expect(result).toEqual({ fieldPath: 'score', operator: 'greater_than', value: '10' });
  });

  it('parses multi-word value like "name contains hello world"', () => {
    const result = parseEachInput('name contains hello world');
    expect(result).toEqual({ fieldPath: 'name', operator: 'contains', value: 'hello world' });
  });

  it('returns null for empty string', () => {
    expect(parseEachInput('')).toBeNull();
  });

  it('returns null for single token', () => {
    expect(parseEachInput('rank')).toBeNull();
  });
});

describe('getAssertionJsonPath', () => {
  it('extracts jsonPath from arrayLength assertion', () => {
    const a: Assertion = { type: 'arrayLength', jsonPath: 'offers', operator: '>=', value: 1 };
    expect(getAssertionJsonPath(a)).toBe('offers');
  });

  it('returns empty string for assertions without jsonPath', () => {
    const a: Assertion = { type: 'custom', expression: 'x > 0' };
    expect(getAssertionJsonPath(a)).toBe('');
  });

  it('extracts jsonPath from each assertion', () => {
    const a: Assertion = { type: 'each', jsonPath: 'items[*]', fieldPath: 'rank', operator: 'exists' };
    expect(getAssertionJsonPath(a)).toBe('items[*]');
  });
});

describe('formatAssertionLine', () => {
  it('formats arrayLength assertion', () => {
    const a: Assertion = { type: 'arrayLength', jsonPath: 'offers', operator: '>=', value: 3 };
    expect(formatAssertionLine(a)).toBe('offers  LENGTH  3');
  });

  it('formats each assertion with operator symbol', () => {
    const a: Assertion = { type: 'each', jsonPath: 'offers[*]', fieldPath: 'rank', operator: 'greater_than_or_equal', value: '0' };
    const line = formatAssertionLine(a);
    expect(line).toContain('EACH');
    expect(line).toContain('rank');
  });

  it('formats arrayContains assertion', () => {
    const a: Assertion = { type: 'arrayContains', jsonPath: 'items', value: '"foo"', mode: 'any' };
    expect(formatAssertionLine(a)).toBe('items  CONTAINS  any: "foo"');
  });

  it('strips leading $. from jsonPath', () => {
    const a: Assertion = { type: 'arrayLength', jsonPath: '$.offers', operator: '=', value: 1 };
    expect(formatAssertionLine(a)).toBe('offers  LENGTH  1');
  });
});
