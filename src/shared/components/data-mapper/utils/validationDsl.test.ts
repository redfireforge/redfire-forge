import { describe, it, expect } from 'vitest';
import {
  parseDslLine,
  parseDsl,
  serializeToDsl,
  dslToModel,
  exportAsJson,
  importFromJson,
  importAutoDetect,
  type ParsedRule,
  type ParseError,
} from './validationDsl';

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

  it('parses wildcard paths', () => {
    const result = parseDslLine('items[*].active is_true', 1) as ParsedRule;
    expect(result.path).toBe('items[*].active');
    expect(result.operator).toBe('is_true');
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

  it('serializes containsSubset assertion', () => {
    const result = serializeToDsl([], [
      { type: 'containsSubset', jsonPath: '$.config', expected: '{"key":"val"}' },
    ]);
    expect(result).toContain('subset');
    expect(result).toContain('{"key":"val"}');
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

  it('pads empty operatorValue as empty string for valued operators', () => {
    const result = serializeToDsl(
      [{ jsonPath: '$.x', expectedValue: '', operator: 'contains' as const }],
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

describe('dslToModel', () => {
  it('converts field rule to ExpectedField', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'name', operator: 'equals', value: 'Alice', kind: 'field' },
    ];
    const model = dslToModel(rules);
    expect(model.fields).toHaveLength(1);
    expect(model.fields[0].jsonPath).toBe('$.name');
    expect(model.fields[0].expectedValue).toBe('Alice');
  });

  it('converts no-value field rule', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'active', operator: 'is_true', kind: 'field' },
    ];
    const model = dslToModel(rules);
    expect(model.fields[0].operator).toBe('is_true');
    expect(model.fields[0].operatorValue).toBeUndefined();
  });

  it('converts length rule to arrayLength assertion', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items', operator: 'length >=', value: '5', kind: 'length' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions).toHaveLength(1);
    expect(model.assertions[0].type).toBe('arrayLength');
    if (model.assertions[0].type === 'arrayLength') {
      expect(model.assertions[0].operator).toBe('>=');
      expect(model.assertions[0].value).toBe(5);
    }
  });

  it('converts each rule to each assertion', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items[*].score', operator: 'each greater_than', value: '0', kind: 'each' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions).toHaveLength(1);
    if (model.assertions[0].type === 'each') {
      expect(model.assertions[0].jsonPath).toBe('$.items');
      expect(model.assertions[0].fieldPath).toBe('score');
      expect(model.assertions[0].operator).toBe('greater_than');
    }
  });

  it('converts contains_item to arrayContains assertion', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'tags', operator: 'contains_item', value: 'featured', kind: 'contains_item' },
    ];
    const model = dslToModel(rules);
    if (model.assertions[0].type === 'arrayContains') {
      expect(model.assertions[0].mode).toBe('any');
      expect(model.assertions[0].value).toBe('featured');
    }
  });

  it('converts subset to containsSubset assertion', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'config', operator: 'subset', value: '{"a":1}', kind: 'subset' },
    ];
    const model = dslToModel(rules);
    if (model.assertions[0].type === 'containsSubset') {
      expect(model.assertions[0].expected).toBe('{"a":1}');
    }
  });

  it('converts type_check to typeCheck assertion', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'score', operator: 'is_type', value: 'number', kind: 'type_check' },
    ];
    const model = dslToModel(rules);
    if (model.assertions[0].type === 'typeCheck') {
      expect(model.assertions[0].expectedType).toBe('number');
    }
  });

  it('converts existence to existence assertion', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'data', operator: 'exists', kind: 'existence' },
    ];
    const model = dslToModel(rules);
    if (model.assertions[0].type === 'existence') {
      expect(model.assertions[0].expectExists).toBe(true);
    }
  });

  it('handles path already prefixed with $', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: '$', operator: 'exists', kind: 'existence' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0]).toBeDefined();
    if (model.assertions[0].type === 'existence') {
      expect(model.assertions[0].jsonPath).toBe('$');
    }
  });

  it('handles multiple rules', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'name', operator: 'equals', value: 'test', kind: 'field' },
      { lineNumber: 2, path: 'items', operator: 'length >=', value: '1', kind: 'length' },
      { lineNumber: 3, path: 'type', operator: 'is_type', value: 'string', kind: 'type_check' },
    ];
    const model = dslToModel(rules);
    expect(model.fields).toHaveLength(1);
    expect(model.assertions).toHaveLength(2);
  });

  it('skips length rules when comparison operator is not in map', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items', operator: 'length >>', value: '3', kind: 'length' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions).toHaveLength(0);
  });

  it('skips each rules when inner operator keyword is unknown', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items[*].x', operator: 'each bogus_op', value: '1', kind: 'each' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions).toHaveLength(0);
  });

  it('parses each path without nested field as empty fieldPath', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items[*]', operator: 'each >', value: '0', kind: 'each' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions).toHaveLength(1);
    if (model.assertions[0].type === 'each') {
      expect(model.assertions[0].fieldPath).toBe('');
    }
  });

  it('uses zero when length rule value is not numeric', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items', operator: 'length >=', value: 'nan', kind: 'length' },
    ];
    const model = dslToModel(rules);
    if (model.assertions[0]?.type === 'arrayLength') {
      expect(model.assertions[0].value).toBe(0);
    }
  });

  it('custom rule splits expression and description on first newline', () => {
    const rules: ParsedRule[] = [
      {
        lineNumber: 1,
        path: '(custom)',
        operator: 'assert',
        value: '$eq(1,1)\nline2 desc',
        kind: 'custom',
      },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('custom');
    if (model.assertions[0].type === 'custom') {
      expect(model.assertions[0].expression).toBe('$eq(1,1)');
      expect(model.assertions[0].description).toBe('line2 desc');
    }
  });

  it('custom rule without newline leaves description undefined', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: '(custom)', operator: 'assert', value: '$gt(1,0)', kind: 'custom' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('custom');
    if (model.assertions[0].type === 'custom') {
      expect(model.assertions[0].expression).toBe('$gt(1,0)');
      expect(model.assertions[0].description).toBeUndefined();
    }
  });

  it('type_check defaults missing value to string', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'any', operator: 'is_type', kind: 'type_check' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('typeCheck');
    if (model.assertions[0].type === 'typeCheck') {
      expect(model.assertions[0].expectedType).toBe('string');
    }
  });

  it('drops length assertions when operator token does not match length comparison pattern', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items', operator: 'length', value: '3', kind: 'length' },
    ];
    expect(dslToModel(rules).assertions).toHaveLength(0);
  });

  it('field rule with negate sets negate on ExpectedField', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 's', operator: 'equals', value: 'x', kind: 'field', negate: true },
    ];
    const model = dslToModel(rules);
    expect(model.fields[0].negate).toBe(true);
  });
});

// ─── Round-trip: serialize → parse → model ────────────────

describe('DSL round-trip', () => {
  it('field round-trips through serialize → parse → model', () => {
    const original = [{ jsonPath: '$.name', expectedValue: 'Alice', operator: 'contains' as const, operatorValue: 'lic' }];
    const dsl = serializeToDsl(original, []);
    const { rules } = parseDsl(dsl);
    const model = dslToModel(rules);
    expect(model.fields[0].jsonPath).toBe('$.name');
    expect(model.fields[0].operator).toBe('contains');
    expect(model.fields[0].operatorValue).toBe('lic');
  });

  it('assertion round-trips through serialize → parse → model', () => {
    const original = [
      { type: 'arrayLength' as const, jsonPath: '$.items', operator: '>=' as const, value: 3 },
    ];
    const dsl = serializeToDsl([], original);
    const { rules } = parseDsl(dsl);
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('arrayLength');
    if (model.assertions[0].type === 'arrayLength') {
      expect(model.assertions[0].operator).toBe('>=');
      expect(model.assertions[0].value).toBe(3);
    }
  });

  it('arrayContains mode round-trips correctly', () => {
    const modes = ['any', 'all', 'only', 'none'] as const;
    for (const mode of modes) {
      const original = [
        { type: 'arrayContains' as const, jsonPath: '$.tags', value: '"x"', mode },
      ];
      const dsl = serializeToDsl([], original);
      const { rules } = parseDsl(dsl);
      const model = dslToModel(rules);
      expect(model.assertions[0].type).toBe('arrayContains');
      if (model.assertions[0].type === 'arrayContains') {
        expect(model.assertions[0].mode).toBe(mode);
      }
    }
  });
});

// ─── Export/Import ────────────────────────────────────────

describe('exportAsJson', () => {
  it('produces valid JSON array', () => {
    const result = exportAsJson(
      [{ jsonPath: '$.name', expectedValue: 'test' }],
      [],
    );
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].path).toBeDefined();
    expect(parsed[0].operator).toBeDefined();
  });

  it('omits value property when exported rule has no value and retains negate flags', () => {
    const out = exportAsJson(
      [
        {
          jsonPath: '$.active',
          expectedValue: '',
          operator: 'is_true',
        },
        {
          jsonPath: '$.name',
          expectedValue: '',
          operator: 'contains',
          operatorValue: 'x',
          negate: true,
        },
      ],
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '>=' as const, value: 2, negate: true }],
    );
    const parsed = JSON.parse(out) as Record<string, unknown>[];
    const isTrueRule = parsed.find((r) => r.operator === 'is_true');
    expect(isTrueRule).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(isTrueRule!, 'value')).toBe(false);
    expect(parsed.some((r) => r.negate === true)).toBe(true);
    expect(parsed.some((r) => typeof r.operator === 'string' && String(r.operator).includes('length'))).toBe(true);
  });
});

describe('importFromJson', () => {
  it('imports a valid JSON array', () => {
    const json = JSON.stringify([{ path: 'name', operator: 'equals', value: 'test' }]);
    const result = importFromJson(json);
    expect('fields' in result).toBe(true);
    if ('fields' in result) {
      expect(result.fields[0].jsonPath).toBe('$.name');
    }
  });

  it('assigns detectKind for all operator families', () => {
    const json = JSON.stringify([
      { path: '(custom)', operator: 'assert', value: '$eq(1,1)' },
      { path: 'items', operator: 'length >=', value: '2' },
      { path: 'nums[*]', operator: 'each >', value: '0' },
      { path: 'tags', operator: 'contains_any', value: '"a"' },
      { path: 'cfg', operator: 'subset', value: '{}' },
      { path: 'n', operator: 'is_type', value: 'number' },
      { path: 'a', operator: 'exists' },
      { path: 'b', operator: 'not_exists' },
      { path: 'plain', operator: 'equals', value: 'ok' },
    ]);
    const result = importFromJson(json);
    expect('assertions' in result).toBe(true);
    if ('fields' in result && 'assertions' in result) {
      expect(result.fields).toContainEqual(expect.objectContaining({ jsonPath: '$.plain', expectedValue: 'ok' }));
      expect(result.assertions.length).toBeGreaterThanOrEqual(7);
      expect(result.assertions.some((a) => a.type === 'custom')).toBe(true);
      expect(result.assertions.some((a) => a.type === 'arrayLength')).toBe(true);
      expect(result.assertions.some((a) => a.type === 'each')).toBe(true);
    }
  });

  it('returns error for non-array JSON', () => {
    const result = importFromJson('{"not": "array"}');
    expect('message' in result).toBe(true);
  });

  it('returns error for invalid JSON', () => {
    const result = importFromJson('not json at all');
    expect('message' in result).toBe(true);
  });
});

describe('importAutoDetect', () => {
  it('auto-detects JSON format', () => {
    const json = JSON.stringify([{ path: 'x', operator: 'exists' }]);
    const result = importAutoDetect(json);
    expect('assertions' in result).toBe(true);
  });

  it('trims leading whitespace before JSON array detection', () => {
    const json = `  \n${JSON.stringify([{ path: 'y', operator: 'not_exists' }])}`;
    const result = importAutoDetect(json);
    expect('assertions' in result).toBe(true);
  });

  it('auto-detects DSL format', () => {
    const dsl = 'name equals "test"\nage > 18';
    const result = importAutoDetect(dsl);
    expect('fields' in result).toBe(true);
    if ('fields' in result) {
      expect(result.fields.length).toBeGreaterThan(0);
    }
  });

  it('returns error for completely invalid text', () => {
    const result = importAutoDetect('!@#$%^&*');
    expect('message' in result).toBe(true);
  });

  it('returns first parse error when DSL has semantic errors', () => {
    const result = importAutoDetect('bad unknown_op');
    expect('message' in result).toBe(true);
    if ('message' in result) {
      expect(result.lineNumber).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// NOT prefix (universal negation)
// ---------------------------------------------------------------------------
describe('NOT prefix — parser', () => {
  it('parses NOT before a field operator', () => {
    const result = parseDslLine('offers[0].status NOT contains "expired"', 1);
    expect(result).not.toBeNull();
    expect('operator' in result!).toBe(true);
    if ('operator' in result!) {
      expect(result.negate).toBe(true);
      expect(result.operator).toBe('contains');
      expect(result.value).toBe('expired');
    }
  });

  it('parses NOT (case-insensitive)', () => {
    const result = parseDslLine('price not > 100', 1);
    expect(result && 'operator' in result && result.negate).toBe(true);
  });

  it('parses NOT before no-value operator', () => {
    const result = parseDslLine('name NOT is_null', 1);
    expect(result && 'operator' in result).toBe(true);
    if (result && 'operator' in result) {
      expect(result.negate).toBe(true);
      expect(result.operator).toBe('is_null');
    }
  });

  it('non-negated rules have negate=undefined/false', () => {
    const result = parseDslLine('name equals "Alice"', 1);
    expect(result && 'operator' in result).toBe(true);
    if (result && 'operator' in result) {
      expect(result.negate).toBeFalsy();
    }
  });
});

describe('NOT prefix — serializer round-trip', () => {
  it('field with negate serializes with NOT prefix', () => {
    const dsl = serializeToDsl(
      [{ jsonPath: '$.status', expectedValue: 'expired', operator: 'contains' as const, operatorValue: 'expired', negate: true }],
      [],
    );
    expect(dsl).toContain('NOT contains');
  });

  it('round-trip: negated field → DSL → model preserves negate', () => {
    const fields = [{ jsonPath: '$.status', expectedValue: 'expired', operator: 'contains' as const, operatorValue: 'expired', negate: true }];
    const dsl = serializeToDsl(fields, []);
    const { rules, errors } = parseDsl(dsl);
    expect(errors).toHaveLength(0);
    expect(rules.length).toBeGreaterThan(0);
    const model = dslToModel(rules);
    expect(model.fields[0].negate).toBe(true);
    expect(model.fields[0].operator).toBe('contains');
  });

  it('round-trip: negated assertion → DSL → model preserves negate', () => {
    const assertions = [{ type: 'arrayLength' as const, jsonPath: '$.items', operator: '=' as const, value: 3, negate: true }];
    const dsl = serializeToDsl([], assertions);
    expect(dsl).toContain('NOT length');
    const { rules, errors } = parseDsl(dsl);
    expect(errors).toHaveLength(0);
    const model = dslToModel(rules);
    expect(model.assertions[0].negate).toBe(true);
  });

  it('non-negated items have no NOT in serialized output', () => {
    const dsl = serializeToDsl(
      [{ jsonPath: '$.name', expectedValue: 'Alice', operator: 'equals' as const, operatorValue: 'Alice' }],
      [],
    );
    expect(dsl).not.toContain('NOT');
  });
});

// ─── Custom Predicate (ASSERT keyword) ────────────────────

describe('ASSERT keyword — parseDslLine', () => {
  it('parses basic ASSERT expression', () => {
    const result = parseDslLine('ASSERT $gt($.body.count, 0)', 1) as ParsedRule;
    expect(result.kind).toBe('custom');
    expect(result.operator).toBe('assert');
    expect(result.value).toBe('$gt($.body.count, 0)');
    expect(result.path).toBe('(custom)');
  });

  it('parses ASSERT with description comment', () => {
    const result = parseDslLine('ASSERT $eq($.status, 200) // Status must be OK', 1) as ParsedRule;
    expect(result.kind).toBe('custom');
    expect(result.value).toBe('$eq($.status, 200)\nStatus must be OK');
  });

  it('parses NOT ASSERT (negated custom predicate)', () => {
    const result = parseDslLine('NOT ASSERT $eq($.status, 500)', 1) as ParsedRule;
    expect(result.kind).toBe('custom');
    expect(result.negate).toBe(true);
    expect(result.value).toBe('$eq($.status, 500)');
  });

  it('parses ASSERT case-insensitive', () => {
    const result = parseDslLine('assert $gt($.body.age, 18)', 1) as ParsedRule;
    expect(result.kind).toBe('custom');
    expect(result.value).toBe('$gt($.body.age, 18)');
  });

  it('returns error for empty ASSERT', () => {
    const result = parseDslLine('ASSERT', 1);
    expect(result).not.toBeNull();
    expect(result && 'message' in result).toBe(true);
    if (result && 'message' in result) {
      expect(result.message).toContain('expression');
    }
  });

  it('parses ASSERT with spaces before expression', () => {
    const result = parseDslLine('ASSERT    $length($.body.items)', 1) as ParsedRule;
    expect(result.kind).toBe('custom');
    expect(result.value).toBe('$length($.body.items)');
  });
});

describe('ASSERT keyword — serializeToDsl', () => {
  it('serializes custom assertion with ASSERT keyword', () => {
    const dsl = serializeToDsl([], [
      { type: 'custom', expression: '$gt($.body.count, 0)' },
    ]);
    expect(dsl).toContain('# Custom predicate assertions');
    expect(dsl).toContain('ASSERT $gt($.body.count, 0)');
  });

  it('serializes custom assertion with description as comment', () => {
    const dsl = serializeToDsl([], [
      { type: 'custom', expression: '$eq($.status, 200)', description: 'Status check' },
    ]);
    expect(dsl).toContain('ASSERT $eq($.status, 200) // Status check');
  });

  it('serializes negated custom assertion with NOT prefix', () => {
    const dsl = serializeToDsl([], [
      { type: 'custom', expression: '$eq($.status, 500)', negate: true },
    ]);
    expect(dsl).toContain('NOT ASSERT $eq($.status, 500)');
  });

  it('serializes multiple custom assertions', () => {
    const dsl = serializeToDsl([], [
      { type: 'custom', expression: '$gt($.body.count, 0)' },
      { type: 'custom', expression: '$eq($.status, 200)', description: 'OK' },
    ]);
    const lines = dsl.split('\n').filter(l => l.startsWith('ASSERT') || l.startsWith('NOT ASSERT'));
    expect(lines).toHaveLength(2);
  });

  it('serializes mixed assertions (field + custom) in correct sections', () => {
    const dsl = serializeToDsl(
      [{ jsonPath: '$.name', expectedValue: 'Alice', operator: 'equals' as const, operatorValue: 'Alice' }],
      [
        { type: 'typeCheck', jsonPath: '$.name', expectedType: 'string' },
        { type: 'custom', expression: '$gt($.body.age, 0)' },
      ],
    );
    expect(dsl).toContain('# Field assertions');
    expect(dsl).toContain('# Type & existence assertions');
    expect(dsl).toContain('# Custom predicate assertions');
  });
});

describe('ASSERT keyword — dslToModel round-trip', () => {
  it('round-trips custom assertion through DSL', () => {
    const original = [
      { type: 'custom' as const, expression: '$gt($.body.count, 0)' },
    ];
    const dsl = serializeToDsl([], original);
    const { rules, errors } = parseDsl(dsl);
    expect(errors).toHaveLength(0);
    const model = dslToModel(rules);
    expect(model.assertions).toHaveLength(1);
    expect(model.assertions[0].type).toBe('custom');
    if (model.assertions[0].type === 'custom') {
      expect(model.assertions[0].expression).toBe('$gt($.body.count, 0)');
    }
  });

  it('round-trips custom assertion with description', () => {
    const original = [
      { type: 'custom' as const, expression: '$eq($.status, 200)', description: 'Status check' },
    ];
    const dsl = serializeToDsl([], original);
    const { rules, errors } = parseDsl(dsl);
    expect(errors).toHaveLength(0);
    const model = dslToModel(rules);
    expect(model.assertions).toHaveLength(1);
    if (model.assertions[0].type === 'custom') {
      expect(model.assertions[0].expression).toBe('$eq($.status, 200)');
      expect(model.assertions[0].description).toBe('Status check');
    }
  });

  it('round-trips negated custom assertion', () => {
    const original = [
      { type: 'custom' as const, expression: '$eq($.status, 500)', negate: true },
    ];
    const dsl = serializeToDsl([], original);
    const { rules, errors } = parseDsl(dsl);
    expect(errors).toHaveLength(0);
    const model = dslToModel(rules);
    expect(model.assertions).toHaveLength(1);
    expect(model.assertions[0].negate).toBe(true);
  });
});
