import { describe, it, expect } from 'vitest';
import { ExpectedField } from '../../../types';
import { parseDslLine, parseDsl, serializeToDsl, dslToModel, exportAsJson, importFromJson, importAutoDetect, countDslRuleLines, type ParsedRule } from './validationDsl';

// ─── parseDslLine ─────────────────────────────────────────

describe('dslToModel', () => {
  it('converts field rule to ExpectedField', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'name', operator: 'equals', value: 'Alice', kind: 'field' },
    ];
    const model = dslToModel(rules);
    expect(model.fields).toHaveLength(1);
    expect(model.fields[0].jsonPath).toBe('$.name');
    expect(model.fields[0].expectedValue).toBe('Alice');
    expect(model.fields[0].operator).toBe('equals');
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

  it('converts existence to field with exists operator', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'data', operator: 'exists', kind: 'existence' },
    ];
    const model = dslToModel(rules);
    expect(model.fields).toHaveLength(1);
    expect(model.fields[0].jsonPath).toBe('$.data');
    expect(model.fields[0].operator).toBe('exists');
    expect(model.assertions).toHaveLength(0);
  });

  it('handles path already prefixed with $', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: '$', operator: 'exists', kind: 'existence' },
    ];
    const model = dslToModel(rules);
    expect(model.fields).toHaveLength(1);
    expect(model.fields[0].jsonPath).toBe('$');
    expect(model.fields[0].operator).toBe('exists');
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

  it('uses empty string for arrayContains when parsed contains_item omits value', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'tags', operator: 'contains_item', kind: 'contains_item' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('arrayContains');
    if (model.assertions[0].type === 'arrayContains') {
      expect(model.assertions[0].value).toBe('');
    }
  });

  it('uses {} default for containsSubset expected when parsed subset omits value', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'cfg', operator: 'subset', kind: 'subset' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('containsSubset');
    if (model.assertions[0].type === 'containsSubset') {
      expect(model.assertions[0].expected).toBe('{}');
    }
  });

  it('sets negate on arrayContains, containsSubset, and typeCheck when rule.negate is true', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'tags', operator: 'contains_only', value: '"x"', kind: 'contains_item', negate: true },
      { lineNumber: 2, path: 'cfg', operator: 'subset', value: '{}', kind: 'subset', negate: true },
      { lineNumber: 3, path: 'n', operator: 'is_type', value: 'Number', kind: 'type_check', negate: true },
    ];
    const model = dslToModel(rules);
    expect(model.assertions.map((a) => a.negate)).toEqual([true, true, true]);
    if (model.assertions[2].type === 'typeCheck') {
      expect(model.assertions[2].expectedType).toBe('number');
    }
  });

  it('sets negate on existence-derived ExpectedField when rule.negate is true', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'ghost', operator: 'not_exists', kind: 'existence', negate: true },
    ];
    const model = dslToModel(rules);
    expect(model.fields[0].negate).toBe(true);
  });

  it('maps each rule without [*] segment to jsonPath root with empty fieldPath', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items', operator: 'each >', value: '0', kind: 'each' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('each');
    if (model.assertions[0].type === 'each') {
      expect(model.assertions[0].jsonPath).toBe('$.items');
      expect(model.assertions[0].fieldPath).toBe('');
    }
  });

  it('propagates negate on each assertions', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items[*].x', operator: 'each >', value: '0', kind: 'each', negate: true },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('each');
    expect(model.assertions[0].negate).toBe(true);
  });

  it('skips each rules when operator token does not match each-pattern', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: 'items[*]', operator: 'each', value: '1', kind: 'each' },
    ];
    expect(dslToModel(rules).assertions).toHaveLength(0);
  });

  it('treats custom rule without value as empty expression', () => {
    const rules: ParsedRule[] = [
      { lineNumber: 1, path: '(custom)', operator: 'assert', kind: 'custom' },
    ];
    const model = dslToModel(rules);
    expect(model.assertions[0].type).toBe('custom');
    if (model.assertions[0].type === 'custom') {
      expect(model.assertions[0].expression).toBe('');
      expect(model.assertions[0].description).toBeUndefined();
    }
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
      expect(result.fields).toContainEqual(expect.objectContaining({ jsonPath: '$.a', operator: 'exists' }));
      expect(result.fields).toContainEqual(expect.objectContaining({ jsonPath: '$.b', operator: 'not_exists' }));
      expect(result.assertions.length).toBeGreaterThanOrEqual(5);
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

describe('Expression-based field rules — DSL round-trip', () => {
  it('serializes field with expression using expr: prefix', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.offers[0].rank', expectedValue: '3', operator: 'equals', expression: '$maxBy($.source.offers, x => x.rank)' },
    ];
    const dsl = serializeToDsl(fields, []);
    expect(dsl).toContain('expr:$maxBy($.source.offers, x => x.rank)');
    expect(dsl).not.toContain('"3"');
  });

  it('round-trips expression field through DSL serialize → parse → model', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.price', expectedValue: '49.99', operator: 'equals', expression: '$maxBy($.source.offers, x => x.price)' },
    ];
    const dsl = serializeToDsl(fields, []);
    const { rules, errors } = parseDsl(dsl);
    expect(errors).toHaveLength(0);
    expect(rules).toHaveLength(1);
    expect(rules[0].expression).toBe('$maxBy($.source.offers, x => x.price)');
    expect(rules[0].value).toBeUndefined();

    const model = dslToModel(rules);
    expect(model.fields).toHaveLength(1);
    expect(model.fields[0].expression).toBe('$maxBy($.source.offers, x => x.price)');
    expect(model.fields[0].operator).toBe('equals');
  });

  it('round-trips expression field with negation', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.name', expectedValue: '', operator: 'contains', negate: true, expression: '$filter($.items, x => x.active)' },
    ];
    const dsl = serializeToDsl(fields, []);
    expect(dsl).toContain('NOT contains');
    expect(dsl).toContain('expr:$filter($.items, x => x.active)');

    const { rules, errors } = parseDsl(dsl);
    expect(errors).toHaveLength(0);
    const model = dslToModel(rules);
    expect(model.fields[0].negate).toBe(true);
    expect(model.fields[0].expression).toBe('$filter($.items, x => x.active)');
  });

  it('mixes expression and non-expression fields correctly', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.status', expectedValue: 'active', operator: 'equals' },
      { jsonPath: '$.count', expectedValue: '42', operator: 'equals', expression: '$reduce($.items, (acc, x) => $add(acc, 1), 0)' },
    ];
    const dsl = serializeToDsl(fields, []);
    expect(dsl).toContain('status');
    expect(dsl).toContain('"active"');
    expect(dsl).toContain('expr:$reduce($.items, (acc, x) => $add(acc, 1), 0)');

    const { rules, errors } = parseDsl(dsl);
    expect(errors).toHaveLength(0);
    expect(rules).toHaveLength(2);
    const statusRule = rules.find(r => r.path === 'status');
    const countRule = rules.find(r => r.path === 'count');
    expect(statusRule?.expression).toBeUndefined();
    expect(statusRule?.value).toBe('active');
    expect(countRule?.expression).toBe('$reduce($.items, (acc, x) => $add(acc, 1), 0)');
    expect(countRule?.value).toBeUndefined();
  });

  it('exports and imports expression fields via JSON', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.rank', expectedValue: '3', operator: 'equals', expression: '$maxBy($.offers, x => x.rank)' },
    ];
    const json = exportAsJson(fields, []);
    const parsed = JSON.parse(json);
    expect(parsed[0].expression).toBe('$maxBy($.offers, x => x.rank)');

    const model = importAutoDetect(json);
    expect('fields' in model).toBe(true);
    if ('fields' in model) {
      expect(model.fields[0].expression).toBe('$maxBy($.offers, x => x.rank)');
    }
  });

  it('fields without expression do not emit expr: prefix', () => {
    const fields: ExpectedField[] = [
      { jsonPath: '$.name', expectedValue: 'Alice', operator: 'equals' },
    ];
    const dsl = serializeToDsl(fields, []);
    expect(dsl).not.toContain('expr:');
    expect(dsl).toContain('"Alice"');
  });
});

describe('countDslRuleLines', () => {
  it('counts non-blank non-comment lines', () => {
    expect(countDslRuleLines('$.a equals 1\n$.b greater_than 2')).toBe(2);
  });

  it('excludes blank lines', () => {
    expect(countDslRuleLines('$.a equals 1\n\n$.b greater_than 2\n')).toBe(2);
  });

  it('excludes comment lines', () => {
    expect(countDslRuleLines('# comment\n$.a equals 1\n# another\n$.b greater_than 2')).toBe(2);
  });

  it('returns 0 for empty text', () => {
    expect(countDslRuleLines('')).toBe(0);
  });

  it('returns 0 for comments only', () => {
    expect(countDslRuleLines('# only comments\n# more comments')).toBe(0);
  });
});
