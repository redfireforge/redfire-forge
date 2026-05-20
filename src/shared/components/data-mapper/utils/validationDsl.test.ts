import { describe, it, expect } from 'vitest';
import { Assertion, ExpectedField } from '../../../types';
import { parseDslLine, parseDsl, serializeToDsl, type ParsedRule, type ParseError } from './validationDsl';

// ─── parseDslLine ─────────────────────────────────────────

describe('parseDslLine', () => {
  it('returns null for empty line', () => {
    expect(parseDslLine('', 1)).toBeNull();
  });

  it('returns null for whitespace-only line', () => {
    expect(parseDslLine('   ', 1)).toBeNull();
  });

  it('returns null for comment line', () => {
    expect(parseDslLine('# this is a comment', 1)).toBeNull();
  });

  it('parses basic equals with quoted value', () => {
    const result = parseDslLine('name equals "hello"', 1) as ParsedRule;
    expect(result.path).toBe('name');
    expect(result.operator).toBe('equals');
    expect(result.value).toBe('hello');
    expect(result.kind).toBe('field');
  });

  it('parses numeric value without quotes', () => {
    const result = parseDslLine('count greater_than 5', 1) as ParsedRule;
    expect(result.path).toBe('count');
    expect(result.operator).toBe('greater_than');
    expect(result.value).toBe('5');
    expect(result.kind).toBe('field');
  });

  it('parses no-value operator (is_true)', () => {
    const result = parseDslLine('active is_true', 1) as ParsedRule;
    expect(result.path).toBe('active');
    expect(result.operator).toBe('is_true');
    expect(result.value).toBeUndefined();
    expect(result.kind).toBe('field');
  });

  it('parses no-value operator (exists)', () => {
    const result = parseDslLine('data.items exists', 1) as ParsedRule;
    expect(result.path).toBe('data.items');
    expect(result.operator).toBe('exists');
    expect(result.kind).toBe('existence');
  });

  it('parses not_exists', () => {
    const result = parseDslLine('error not_exists', 1) as ParsedRule;
    expect(result.operator).toBe('not_exists');
    expect(result.kind).toBe('existence');
  });

  it('parses is_type operator', () => {
    const result = parseDslLine('data.score is_type number', 1) as ParsedRule;
    expect(result.operator).toBe('is_type');
    expect(result.value).toBe('number');
    expect(result.kind).toBe('type_check');
  });

  it('parses between operator', () => {
    const result = parseDslLine('price between 10,100', 1) as ParsedRule;
    expect(result.operator).toBe('between');
    expect(result.value).toBe('10,100');
    expect(result.kind).toBe('field');
  });

  it('parses in operator', () => {
    const result = parseDslLine('status in active,pending,closed', 1) as ParsedRule;
    expect(result.operator).toBe('in');
    expect(result.value).toBe('active,pending,closed');
  });

  it('parses regex operator', () => {
    const result = parseDslLine('email regex "^[a-z]+@.+"', 1) as ParsedRule;
    expect(result.operator).toBe('regex');
    expect(result.value).toBe('^[a-z]+@.+');
  });

  it('parses starts_with operator', () => {
    const result = parseDslLine('url starts_with "https://"', 1) as ParsedRule;
    expect(result.operator).toBe('starts_with');
    expect(result.value).toBe('https://');
  });

  it('parses bracket notation paths', () => {
    const result = parseDslLine('items[0].name equals "first"', 1) as ParsedRule;
    expect(result.path).toBe('items[0].name');
    expect(result.value).toBe('first');
  });

  it('parses wildcard paths as each assertions', () => {
    const result = parseDslLine('items[*].active is_true', 1) as ParsedRule;
    expect(result.path).toBe('items[*].active');
    expect(result.operator).toBe('each is_true');
    expect(result.kind).toBe('each');
  });

  // Collection operators
  it('parses length operator', () => {
    const result = parseDslLine('items length >= 3', 1) as ParsedRule;
    expect(result.kind).toBe('length');
    expect(result.operator).toBe('length >=');
    expect(result.value).toBe('3');
  });

  it('parses length with equals', () => {
    const result = parseDslLine('tags length = 5', 1) as ParsedRule;
    expect(result.kind).toBe('length');
    expect(result.operator).toBe('length =');
    expect(result.value).toBe('5');
  });

  it('parses each operator', () => {
    const result = parseDslLine('items each > 0', 1) as ParsedRule;
    expect(result.kind).toBe('each');
    expect(result.operator).toBe('each >');
    expect(result.value).toBe('0');
  });

  it('parses each with keyword operator', () => {
    const result = parseDslLine('names each starts_with "A"', 1) as ParsedRule;
    expect(result.kind).toBe('each');
    expect(result.operator).toBe('each starts_with');
    expect(result.value).toBe('"A"');
  });

  it('parses contains_item', () => {
    const result = parseDslLine('tags contains_item "featured"', 1) as ParsedRule;
    expect(result.kind).toBe('contains_item');
    expect(result.operator).toBe('contains_item');
    expect(result.value).toBe('"featured"');
  });

  it('parses subset', () => {
    const result = parseDslLine('config subset {"key": "val"}', 1) as ParsedRule;
    expect(result.kind).toBe('subset');
    expect(result.operator).toBe('subset');
    expect(result.value).toBe('{"key": "val"}');
  });

  // Error cases
  it('returns error for missing operator', () => {
    const result = parseDslLine('path_only', 1) as ParseError;
    expect(result.message).toContain('Missing operator');
  });

  it('returns error for unknown operator', () => {
    const result = parseDslLine('field unknown_op value', 1) as ParseError;
    expect(result.message).toContain('Unknown operator');
  });

  it('returns error for operator requiring value but missing it', () => {
    const result = parseDslLine('field equals', 1) as ParseError;
    expect(result.message).toContain('requires a value');
  });

  it('returns error for length without comparison', () => {
    const result = parseDslLine('items length', 1) as ParseError;
    expect(result.message).toContain('Missing comparison');
  });

  it('returns error for each without inner operator', () => {
    const result = parseDslLine('items each', 1) as ParseError;
    expect(result.message).toContain('Missing operator');
  });

  it('returns error for invalid length comparison token', () => {
    const result = parseDslLine('items length blah', 1) as ParseError;
    expect(result.message).toContain('Invalid length comparison');
  });

  it('returns error when contains_* value looks like JSON object/array but JSON.parse fails', () => {
    const malformed = '{"broken": }';
    const result = parseDslLine(`tags contains_any ${malformed}`, 1) as ParseError;
    expect(result.column).toBe(1);
    expect(result.message).toContain('Invalid JSON');
    expect(result.message).toContain('contains_any');
  });

  it('returns error when contains_* value starts with [ but JSON.parse fails', () => {
    const result = parseDslLine('tags contains_any [1,2,', 1) as ParseError;
    expect(result.message).toContain('Invalid JSON');
  });

  it('returns error when subset value starts with [ but JSON.parse fails', () => {
    const result = parseDslLine('cfg subset [not,json', 1) as ParseError;
    expect(result.message).toContain('Invalid JSON');
  });

  it('truncates contains_* invalid JSON message when value exceeds 40 characters', () => {
    const payload = `{${'z'.repeat(55)}}`;
    const result = parseDslLine(`tags contains_all ${payload}`, 1) as ParseError;
    expect(result.message).toContain('…');
  });

  it('returns error when subset value is object/array but JSON.parse fails', () => {
    const result = parseDslLine('cfg subset {bad json}', 1) as ParseError;
    expect(result.column).toBe(1);
    expect(result.message).toContain('Invalid JSON');
    expect(result.message).toContain('subset');
  });

  it('returns error when subset value is neither JSON nor a quoted string', () => {
    const result = parseDslLine('cfg subset bareword', 1) as ParseError;
    expect(result.column).toBe(1);
    expect(result.message).toContain('subset value must be JSON');
    expect(result.message).toContain('bareword');
  });

  it('truncates subset error detail when raw value exceeds 40 characters', () => {
    const longBare = 'x'.repeat(50);
    const result = parseDslLine(`cfg subset ${longBare}`, 1) as ParseError;
    expect(result.message).toContain('…');
  });

  it('returns error when contains_* value is not JSON-shaped', () => {
    const result = parseDslLine('tags contains_none plain-token', 1) as ParseError;
    expect(result.column).toBe(1);
    expect(result.message).toContain('must be JSON');
    expect(result.message).toContain('plain-token');
  });

  it('parses contains_* without a value (skips JSON validation)', () => {
    const result = parseDslLine('tags contains_any', 1) as ParsedRule;
    expect(result.kind).toBe('contains_item');
    expect(result.operator).toBe('contains_any');
    expect(result.value).toBeUndefined();
  });

  it('parses subset without a value (skips JSON validation)', () => {
    const result = parseDslLine('cfg subset', 1) as ParsedRule;
    expect(result.kind).toBe('subset');
    expect(result.value).toBeUndefined();
  });

  it('parses equals shorthand "=" operator keyword', () => {
    const result = parseDslLine('name = "Ada"', 1) as ParsedRule;
    expect(result.operator).toBe('equals');
    expect(result.value).toBe('Ada');
  });

  it('parses not_in operator', () => {
    const result = parseDslLine('role not_in admin,guest', 1) as ParsedRule;
    expect(result.operator).toBe('not_in');
    expect(result.value).toBe('admin,guest');
  });

  it('parses each inner operator with empty right-hand side', () => {
    const result = parseDslLine('nums each >', 1) as ParsedRule;
    expect(result.kind).toBe('each');
    expect(result.operator).toBe('each >');
    expect(result.value).toBeUndefined();
  });

  it('unquotes escaped double-quote inside quoted value', () => {
    const result = parseDslLine('id equals "a\\"b"', 1) as ParsedRule;
    expect(result.value).toBe('a"b');
  });

  it('unquotes single-quoted values and strip escapes like double-quoted', () => {
    const result = parseDslLine(`code equals 'ok'`, 1) as ParsedRule;
    expect(result.value).toBe('ok');
  });

  it('parses shorthand comparison operators', () => {
    expect((parseDslLine('x != 2', 1) as ParsedRule).operator).toBe('not_equals');
    expect((parseDslLine('x >= 1', 1) as ParsedRule).operator).toBe('greater_than_or_equal');
    expect((parseDslLine('x <= 9', 1) as ParsedRule).operator).toBe('less_than_or_equal');
  });

  it('parses contains_any, contains_all, contains_only, and contains_none', () => {
    const modes = ['contains_any', 'contains_all', 'contains_only', 'contains_none'] as const;
    for (const op of modes) {
      const r = parseDslLine(`tags ${op} "a"`, 1) as ParsedRule;
      expect(r.kind).toBe('contains_item');
      expect(r.operator).toBe(op);
    }
  });

  it('parses close_to operator', () => {
    const r = parseDslLine('score close_to 1,0.01', 1) as ParsedRule;
    expect(r.operator).toBe('close_to');
    expect(r.value).toBe('1,0.01');
  });

  it('preserves line number in results', () => {
    const result = parseDslLine('name equals "test"', 42) as ParsedRule;
    expect(result.lineNumber).toBe(42);
  });
});

// ─── parseDsl ─────────────────────────────────────────────

describe('parseDsl', () => {
  it('parses multiple lines', () => {
    const text = `
# Header comment
name equals "test"
count > 5
active is_true
`;
    const { rules, errors } = parseDsl(text);
    expect(rules).toHaveLength(3);
    expect(errors).toHaveLength(0);
  });

  it('handles mixed valid and invalid lines', () => {
    const text = `name equals "ok"
bad_line
count > 5`;
    const { rules, errors } = parseDsl(text);
    expect(rules).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].lineNumber).toBe(2);
  });

  it('ignores blank lines and comments', () => {
    const text = `# comment

name equals "x"

# another comment
age > 18
`;
    const { rules, errors } = parseDsl(text);
    expect(rules).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('returns empty for empty text', () => {
    const { rules, errors } = parseDsl('');
    expect(rules).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('handles all operator types in one block', () => {
    const text = `
name equals "Alice"
items length >= 1
tags contains_item "vip"
config subset {"a":1}
items[*].score each > 0
type is_type string
field exists
`;
    const { rules, errors } = parseDsl(text);
    expect(rules).toHaveLength(7);
    expect(errors).toHaveLength(0);
    expect(rules[0].kind).toBe('field');
    expect(rules[1].kind).toBe('length');
    expect(rules[2].kind).toBe('contains_item');
    expect(rules[3].kind).toBe('subset');
    expect(rules[4].kind).toBe('each');
    expect(rules[5].kind).toBe('type_check');
    expect(rules[6].kind).toBe('existence');
  });
});

// ─── serializeToDsl ───────────────────────────────────────

describe('serializeToDsl', () => {
  it('serializes field with equals operator', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.name', expectedValue: 'Alice', operator: undefined }],
      [],
    );
    expect(result).toContain('name');
    expect(result).toContain('equals');
    expect(result).toContain('"Alice"');
  });

  it('serializes field with no-value operator', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.active', expectedValue: '', operator: 'is_true' }],
      [],
    );
    expect(result).toContain('active');
    expect(result).toContain('is_true');
  });

  it('serializes between operator without quotes', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.price', expectedValue: '', operator: 'between', operatorValue: '10,100' }],
      [],
    );
    expect(result).toContain('between');
    expect(result).toContain('10,100');
  });

  it('serializes field-level is_type without extra quoting', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.t', expectedValue: '', operator: 'is_type', operatorValue: 'boolean' }],
      [],
    );
    expect(result).toContain('is_type');
    expect(result).toContain('boolean');
    expect(result).not.toContain('"boolean"');
  });

  it('serializes not_in field operator values without quoting', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.role', expectedValue: '', operator: 'not_in', operatorValue: 'a,b,c' }],
      [],
    );
    expect(result).toContain('not_in');
    expect(result).toContain('a,b,c');
  });

  it('serializes in field operator values without quoting', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.status', expectedValue: '', operator: 'in', operatorValue: 'open,pending' }],
      [],
    );
    expect(result).toMatch(/status\s+in\s+/);
    expect(result).toContain('open,pending');
  });

  it('serializes close_to field operator values without quoting', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.z', expectedValue: '', operator: 'close_to', operatorValue: '1,0.01' }],
      [],
    );
    expect(result).toContain('close_to');
    expect(result).toContain('1,0.01');
  });

  it('serializes arrayLength assertion', () => {
    const result = serializeToDsl([], [
      { type: 'arrayLength', jsonPath: '$.items', operator: '>=', value: 3 },
    ]);
    expect(result).toContain('items');
    expect(result).toContain('length >=');
    expect(result).toContain('3');
  });

  it('serializes typeCheck assertion', () => {
    const result = serializeToDsl([], [
      { type: 'typeCheck', jsonPath: '$.score', expectedType: 'number' },
    ]);
    expect(result).toContain('score');
    expect(result).toContain('is_type');
    expect(result).toContain('number');
  });

  it('serializes existence assertion', () => {
    const result = serializeToDsl([], [
      { type: 'existence', jsonPath: '$.data', expectExists: true },
    ]);
    expect(result).toContain('data');
    expect(result).toContain('exists');
  });

  it('serializes not-exists assertion', () => {
    const result = serializeToDsl([], [
      { type: 'existence', jsonPath: '$.error', expectExists: false },
    ]);
    expect(result).toContain('error');
    expect(result).toContain('not_exists');
  });

  it('serializes each assertion', () => {
    const result = serializeToDsl([], [
      { type: 'each', jsonPath: '$.items', fieldPath: 'score', operator: 'greater_than' as const, value: '0' },
    ]);
    expect(result).toContain('each >');
    expect(result).toContain('0');
  });

  it('serializes arrayContains assertion', () => {
    const result = serializeToDsl([], [
      { type: 'arrayContains', jsonPath: '$.tags', value: '"featured"', mode: 'any' as const },
    ]);
    expect(result).toContain('contains_any');
    expect(result).toContain('"featured"');
  });

  it('serializes arrayContains all, only, and none modes to distinct keywords', () => {
    const modes = ['all', 'only', 'none'] as const;
    const keywords = ['contains_all', 'contains_only', 'contains_none'] as const;
    modes.forEach((mode, i) => {
      const dsl = serializeToDsl([], [
        { type: 'arrayContains', jsonPath: '$.tags', value: '"x"', mode },
      ]);
      expect(dsl).toContain(keywords[i]);
    });
  });

  it('serializes containsSubset assertion', () => {
    const result = serializeToDsl([], [
      { type: 'containsSubset', jsonPath: '$.config', expected: '{"key":"val"}' },
    ]);
    expect(result).toContain('subset');
    expect(result).toContain('{"key":"val"}');
  });

  it('serializes negated containsSubset with NOT prefix', () => {
    const result = serializeToDsl([], [
      { type: 'containsSubset', jsonPath: '$.cfg', expected: '{}', negate: true },
    ]);
    expect(result).toContain('NOT subset');
    expect(result).toContain('{}');
  });

  it('groups fields and assertions with comments', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.name', expectedValue: 'x' }],
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '>=', value: 1 }],
    );
    expect(result).toContain('# Field assertions');
    expect(result).toContain('# Collection assertions');
  });

  it('returns empty string for no fields/assertions', () => {
    const result = serializeToDsl([], []);
    expect(result).toBe('');
  });

  it('strips $. prefix from paths', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.data.name', expectedValue: 'test' }],
      [],
    );
    expect(result).toContain('data.name');
    expect(result).not.toContain('$.');
  });

  it('falls back to raw operator token when field keyword mapping is missing', () => {
    const result = serializeToDsl(
      [
        {
          jsonPath: '$.n',
          expectedValue: '1',
          operator: 'bogus_field_op' as never,
          operatorValue: '1',
        },
      ],
      [],
    );
    expect(result).toContain('bogus_field_op');
  });

  it('serializes typeCheck when jsonPath is bare root $', () => {
    const result = serializeToDsl([], [{ type: 'typeCheck', jsonPath: '$', expectedType: 'array' }]);
    expect(result).toContain('is_type');
    expect(result).toContain('array');
  });

  it('serializes negated typeCheck when jsonPath is bare root $', () => {
    const result = serializeToDsl([], [{ type: 'typeCheck', jsonPath: '$', expectedType: 'object', negate: true }]);
    expect(result).toContain('NOT is_type');
  });

  it('serializes existence when jsonPath is bare root $', () => {
    const result = serializeToDsl([], [{ type: 'existence', jsonPath: '$', expectExists: true }]);
    expect(result.split('\n').some((l) => l.includes('exists') && !l.startsWith('#'))).toBe(true);
  });

  it('serializes numeric values without quotes', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.count', expectedValue: '42', operator: 'equals' as const }],
      [],
    );
    expect(result).toContain('42');
    expect(result).not.toContain('"42"');
  });

  it('serializes boolean literals without quotes', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.flag', expectedValue: 'true', operator: 'equals' as const }],
      [],
    );
    expect(result).toContain('true');
    expect(result).not.toContain('"true"');
  });

  it('preserves already double-quoted operator values', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.msg', expectedValue: '"raw"', operator: 'equals' as const }],
      [],
    );
    expect(result).toContain('"raw"');
    expect(result).not.toContain('\\"raw\\"');
  });

  it('escapes embedded quotes when wrapping plain strings', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.msg', expectedValue: 'say "hi"', operator: 'equals' as const }],
      [],
    );
    expect(result).toContain('\\"hi\\"');
  });

  it('ignores unknown assertion types in serializer default branch', () => {
    const result = serializeToDsl([], [
      { type: 'status', expected: '200' } as never,
    ]);
    expect(result).toBe('');
  });

  it('serializes valued field operator when operatorValue and expectedValue are both omitted', () => {
    const field = { jsonPath: '$.q', operator: 'contains' as const } as ExpectedField;
    const result = serializeToDsl([field], []);
    expect(result).toContain('contains');
    expect(result).toContain('""');
  });

  it('pads empty operatorValue as empty string for valued operators', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.x', expectedValue: '', operator: 'contains' as const }],
      [],
    );
    expect(result).toContain('contains');
    expect(result).toContain('""');
  });

  it('serializes valued field operator when operatorValue is null', () => {
    const result = serializeToDsl(
      [
        {
          jsonPath: '$.x',
          expectedValue: '',
          operator: 'contains' as const,
          operatorValue: null as unknown as string | undefined,
        },
      ],
      [],
    );
    expect(result).toContain('contains');
    expect(result).toContain('""');
  });

  it('serializes each assertion with NO_VALUE inner operator (no quoted operand)', () => {
    const result = serializeToDsl([], [
      { type: 'each', jsonPath: '$.items', fieldPath: 'ok', operator: 'is_true' as const, value: '' },
    ]);
    expect(result).toContain('items[*].ok');
    expect(result).toMatch(/each\s+is_true\b/);
    expect(result).not.toMatch(/each\s+is_true\s+"/);
  });

  it('uses raw operator token when serializer lacks a keyword mapping', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.x', expectedValue: '1', operator: 'equals' as const, operatorValue: '1' }],
      [
        {
          type: 'each',
          jsonPath: '$.arr',
          operator: 'bogus_each_op' as never,
          value: 'v',
        },
      ],
    );
    expect(result).toContain('each bogus_each_op');
  });

  it('serializes arrayLength with undefined numeric value as 0', () => {
    const result = serializeToDsl([], [
      { type: 'arrayLength', jsonPath: '$.items', operator: '=' as const, value: undefined as unknown as number },
    ]);
    expect(result).toMatch(/length\s*=\s*0\b/);
  });

  it('serializes arrayLength defaulting omitted operator to "="', () => {
    const loose = { type: 'arrayLength' as const, jsonPath: '$.items', value: 4 };
    const result = serializeToDsl([], [loose as Assertion]);
    expect(result).toMatch(/length\s*=\s*4\b/);
  });

  it('serializes arrayLength when jsonPath is bare root $', () => {
    const result = serializeToDsl([], [{ type: 'arrayLength', jsonPath: '$', operator: '>=' as const, value: 2 }]);
    expect(result).toMatch(/\$\s+length >=\s+2\b/);
  });

  it('serializes arrayContains when value is missing at runtime', () => {
    const loose = { type: 'arrayContains' as const, jsonPath: '$.tags', mode: 'any' as const };
    const result = serializeToDsl([], [loose as Assertion]);
    expect(result).toContain('contains_any');
    expect(result).toContain('undefined');
  });

  it('serializes containsSubset when jsonPath is bare root $', () => {
    const result = serializeToDsl([], [{ type: 'containsSubset', jsonPath: '$', expected: '{"a":1}' }]);
    expect(result).toContain('subset');
    expect(result).toContain('{"a":1}');
    expect(result.split('\n').some((l) => l.trimStart().startsWith('$'))).toBe(true);
  });

  it('serializes each assertion defaulting omitted operator to equals branch', () => {
    const loose = { type: 'each' as const, jsonPath: '$.items', fieldPath: 'id', value: '99' };
    const result = serializeToDsl([], [loose as Assertion]);
    expect(result).toContain('each equals');
    expect(result).toContain('99');
    expect(result).not.toMatch(/each equals\s{16}""/);
  });

  it('serializes each with bare $ jsonPath and empty fieldPath using [*] suffix', () => {
    const result = serializeToDsl([], [
      { type: 'each', jsonPath: '$', fieldPath: '', operator: 'equals', value: '7' },
    ]);
    expect(result).toContain('$[*]');
    expect(result).toContain('each equals');
    expect(result).toContain('7');
  });

  it('serializes negated arrayContains line', () => {
    const result = serializeToDsl([], [
      { type: 'arrayContains', jsonPath: '$.tags', value: '"n"', mode: 'any', negate: true },
    ]);
    expect(result).toContain('NOT contains_any');
  });

  it('quotes field values that contain backslashes for escaping', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.p', expectedValue: 'a\\b', operator: 'equals' as const, operatorValue: 'a\\b' }],
      [],
    );
    expect(result).toContain('\\\\');
  });

  it('uses $ as path when jsonPath is only $ after stripping prefix (field)', () => {
    const result = serializeToDsl([{ jsonPath: '$', expectedValue: '1', operator: 'equals' as const, operatorValue: '1' }], []);
    const fieldLine = result.split('\n').find((l) => l.includes('equals') && !l.startsWith('#'))!;
    expect(fieldLine.trimStart().startsWith('$')).toBe(true);
  });

  it('uses $ as path when assertion jsonPath is bare $', () => {
    const result = serializeToDsl([], [{ type: 'existence', jsonPath: '$', expectExists: true }]);
    const line = result.split('\n').find((l) => l.includes('exists') && !l.startsWith('#'))!;
    expect(line.trimStart().startsWith('$')).toBe(true);
  });
});

// ─── dslToModel ───────────────────────────────────────────
