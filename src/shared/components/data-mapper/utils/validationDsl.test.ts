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
