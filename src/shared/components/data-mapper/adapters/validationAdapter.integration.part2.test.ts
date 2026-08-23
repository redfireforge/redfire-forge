/**
 * Integration tests: validationAdapter serialize + useValidationVerify for ALL 24 operators.
 * Tests the full pipeline: mapping → adapter serialize → verify hook evaluation.
 * Also tests expression + operator combinations.
 */
import { describe, it, expect } from 'vitest';
import { createValidationAdapter } from './validationAdapter';
import { Mapping } from '../types';
import { FieldOperator, ExpectedField, ValidationConfig } from '../../../types';
import { evaluateFieldOperator } from '@engine/fieldOperatorEvaluation';
import { getByPath } from '../../../utils/jsonPath';
import { validate } from '@engine/validator';

// ─── Sample response data ────────────────────────────────
const RESPONSE = {
  status: 'ok',
  count: 42,
  score: 95.5,
  name: 'John Doe',
  email: 'john@example.com',
  isActive: true,
  isPremium: false,
  tags: ['admin', 'user'],
  address: { city: 'NYC', zip: '10001' },
  planType: 'Trial',
  emptyStr: '',
  emptyArr: [] as unknown[],
  emptyObj: {},
  nullField: null,
  pi: 3.14159,
  negative: -10,
  offers: [
    { planType: 'Trial', duration: { value: 30 }, price: 0 },
    { planType: 'Premium', duration: { value: 365 }, price: 99.99 },
  ],
};

// ─── Helper: simulate full adapter serialize → verify pipeline ─────
function serializeAndVerify(
  sampleBody: unknown,
  mappings: Mapping[],
): { expectedFields: ExpectedField[]; results: { path: string; passed: boolean; operator: string; actual: string; expected: string }[] } {
  const adapter = createValidationAdapter({
    sampleResponseBody: sampleBody,
    selectiveMode: 'include',
  });

  const output = adapter.serialize(mappings);
  const expectedFields = output.expectedFields ?? [];
  const responseBody = typeof sampleBody === 'string' ? JSON.parse(sampleBody) : sampleBody;

  const results = expectedFields.map(field => {
    const actualValue = getByPath(responseBody, field.jsonPath);
    const operator = field.operator ?? 'equals';
    const evalResult = evaluateFieldOperator(actualValue, operator, field.operatorValue, field.expectedValue);
    const effectivePass = field.negate ? !evalResult.pass : evalResult.pass;
    return { path: field.jsonPath, passed: effectivePass, operator, actual: evalResult.actual, expected: evalResult.expected };
  });

  return { expectedFields, results };
}

function _makeSingleMapping(
  path: string,
  operator?: FieldOperator,
  operatorValue?: string,
  opts?: Partial<Mapping>,
): Mapping[] {
  return [{
    id: 'test-1',
    sourceId: 'response-body',
    sourcePath: path,
    targetPath: path,
    operator,
    operatorValue,
    ...opts,
  }];
}

// ────────────────────────────────────────────────────────────
// 1. EQUALITY OPERATORS — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: array/object node filtering', () => {
  it('serialize() filters out array node with equals operator', () => {
    const mappings: Mapping[] = [
      { id: 'a1', sourceId: 'response-body', sourcePath: 'offers', targetPath: 'offers' },
      { id: 'a2', sourceId: 'response-body', sourcePath: 'name', targetPath: 'name' },
    ];
    const { expectedFields } = serializeAndVerify(RESPONSE, mappings);
    const paths = expectedFields.map(f => f.jsonPath);
    expect(paths).toContain('name');
    expect(paths).not.toContain('offers');
  });

  it('serialize() preserves array node with exists operator', () => {
    const mappings: Mapping[] = [
      { id: 'a1', sourceId: 'response-body', sourcePath: 'offers', targetPath: 'offers', operator: 'exists' },
      { id: 'a2', sourceId: 'response-body', sourcePath: 'name', targetPath: 'name' },
    ];
    const { expectedFields } = serializeAndVerify(RESPONSE, mappings);
    const paths = expectedFields.map(f => f.jsonPath);
    expect(paths).toContain('name');
    expect(paths).toContain('offers');
  });

  it('serialize() keeps array node with is_empty operator', () => {
    const mappings: Mapping[] = [
      { id: 'a1', sourceId: 'response-body', sourcePath: 'offers', targetPath: 'offers', operator: 'is_empty' },
    ];
    const { expectedFields } = serializeAndVerify(RESPONSE, mappings);
    expect(expectedFields).toHaveLength(1);
    expect(expectedFields[0].jsonPath).toBe('offers');
  });

  it('serialize() keeps array node with is_type operator', () => {
    const mappings: Mapping[] = [
      { id: 'a1', sourceId: 'response-body', sourcePath: 'offers', targetPath: 'offers', operator: 'is_type', operatorValue: 'array' },
    ];
    const { expectedFields } = serializeAndVerify(RESPONSE, mappings);
    expect(expectedFields).toHaveLength(1);
    expect(expectedFields[0].operator).toBe('is_type');
  });

  it('serialize() filters out object node with auto-mapped equals', () => {
    const mappings: Mapping[] = [
      { id: 'a1', sourceId: 'response-body', sourcePath: 'address', targetPath: 'address', isAutoMapped: true },
      { id: 'a2', sourceId: 'response-body', sourcePath: 'address.city', targetPath: 'address.city', isAutoMapped: true },
    ];
    const { expectedFields } = serializeAndVerify(RESPONSE, mappings);
    const paths = expectedFields.map(f => f.jsonPath);
    expect(paths).not.toContain('address');
    expect(paths).toContain('address.city');
  });

  it('deserialize() preserves offers entry with exists operator', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: RESPONSE,
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: 'offers', expectedValue: '', operator: 'exists' },
        { jsonPath: 'name', expectedValue: '"John Doe"', operator: 'equals' },
        { jsonPath: 'count', expectedValue: '42', operator: 'equals' },
      ],
    });
    const output: ValidationAdapterOutput = {
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: 'offers', expectedValue: '', operator: 'exists' },
        { jsonPath: 'name', expectedValue: '"John Doe"', operator: 'equals' },
        { jsonPath: 'count', expectedValue: '42', operator: 'equals' },
      ],
      excludedPaths: [],
    };
    const mappings = adapter.deserialize(output);
    const paths = mappings.map(m => m.targetPath);
    expect(paths).toContain('offers');
    expect(paths).toContain('name');
    expect(paths).toContain('count');
  });

  it('deserialize() filters out stale offers entry with equals operator', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: RESPONSE,
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: 'offers', expectedValue: '[{"planType":"Trial"}]', operator: 'equals' },
        { jsonPath: 'name', expectedValue: '"John Doe"', operator: 'equals' },
      ],
    });
    const output: ValidationAdapterOutput = {
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: 'offers', expectedValue: '[{"planType":"Trial"}]', operator: 'equals' },
        { jsonPath: 'name', expectedValue: '"John Doe"', operator: 'equals' },
      ],
      excludedPaths: [],
    };
    const mappings = adapter.deserialize(output);
    const paths = mappings.map(m => m.targetPath);
    expect(paths).not.toContain('offers');
    expect(paths).toContain('name');
  });

  it('full pipeline: auto-map with offers array does NOT produce offers in expectedFields', () => {
    const allLeafMappings: Mapping[] = [
      { id: 'l1', sourceId: 'response-body', sourcePath: 'offers', targetPath: 'offers', isAutoMapped: true },
      { id: 'l2', sourceId: 'response-body', sourcePath: 'offers[0].planType', targetPath: 'offers[0].planType', isAutoMapped: true },
      { id: 'l3', sourceId: 'response-body', sourcePath: 'offers[0].price', targetPath: 'offers[0].price', isAutoMapped: true },
      { id: 'l4', sourceId: 'response-body', sourcePath: 'name', targetPath: 'name', isAutoMapped: true },
    ];
    const { expectedFields, results } = serializeAndVerify(RESPONSE, allLeafMappings);
    const paths = expectedFields.map(f => f.jsonPath);
    expect(paths).not.toContain('offers');
    expect(paths).toContain('offers[0].planType');
    expect(paths).toContain('offers[0].price');
    expect(paths).toContain('name');
    for (const r of results) {
      expect(r.passed).toBe(true);
    }
  });

  it('validate() with exists on offers array PASSES (array exists)', () => {
    const config: ValidationConfig = {
      mode: 'selective',
      expectedFields: [
        { jsonPath: 'offers', expectedValue: '', operator: 'exists' },
        { jsonPath: 'name', expectedValue: '"John Doe"', operator: 'equals' },
      ],
    };
    const failures = validate(config, RESPONSE);
    expect(failures).toHaveLength(0);
  });

  it('validate() fails for offers with no operator (raw equals comparison)', () => {
    const config: ValidationConfig = {
      mode: 'selective',
      expectedFields: [
        { jsonPath: 'offers', expectedValue: '[object Object]' },
      ],
    };
    const failures = validate(config, RESPONSE);
    expect(failures.length).toBeGreaterThan(0);
  });

  it('validate() fails for offers with equals and wrong expected value', () => {
    const config: ValidationConfig = {
      mode: 'selective',
      expectedFields: [
        { jsonPath: 'offers', expectedValue: '{"wrong": true}', operator: 'equals' },
      ],
    };
    const failures = validate(config, RESPONSE);
    expect(failures.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
// COMPREHENSIVE ROUND-TRIP: DSL → Model → Mapping → Serialize → Save → Deserialize → Serialize → DSL
// Tests the full save/reopen cycle for data loss
// ────────────────────────────────────────────────────────────

import { parseDsl, dslToModel, serializeToDsl } from '../utils/validationDsl';
import { normalizeMapperPath } from '../utils/pathNormalization';
import { v4 as uuidv4 } from 'uuid';
import { Assertion } from '../../../types';

function simulateFullRoundTrip(
  dslInput: string,
  sampleBody: unknown = RESPONSE,
): { inputRules: number; outputRules: number; inputDsl: string; outputDsl: string; savedFields: ExpectedField[]; savedAssertions: Assertion[] } {
  const adapter = createValidationAdapter({
    sampleResponseBody: sampleBody,
    selectiveMode: 'include',
  });

  // Step 1: Parse DSL (simulates handleCodeChange debounce)
  const { rules } = parseDsl(dslInput);
  const model = dslToModel(rules);

  // Step 2: handleUpdateValidationFields — create mappings from model.fields
  const _pm = (a: string, b: string) => normalizeMapperPath(a) === normalizeMapperPath(b);
  const newMappings: Mapping[] = model.fields.map((f) => ({
    id: uuidv4(),
    sourcePath: f.jsonPath,
    sourceId: 'response-body',
    targetPath: f.jsonPath,
    operator: f.operator as FieldOperator | undefined,
    operatorValue: f.operatorValue ?? f.expectedValue,
    ...(f.negate && { negate: true }),
    ...(f.expression && { expression: f.expression }),
  }));

  // Step 3: adapter.serialize(mappings) → output with expectedFields
  const output = adapter.serialize(newMappings);

  // Step 4: Save: output.expectedFields + model.assertions stored to draft
  const savedFields = output.expectedFields;
  const savedAssertions = model.assertions;

  // Step 5: Reopen — adapter.deserialize(savedOutput)
  const reopenAdapter = createValidationAdapter({
    sampleResponseBody: sampleBody,
    selectiveMode: 'include',
  });
  const restoredMappings = reopenAdapter.deserialize({
    selectiveMode: 'include',
    expectedFields: savedFields,
    excludedPaths: [],
    assertions: savedAssertions,
  });

  // Step 6: validationFields = adapter.serialize(restoredMappings)
  const restoredOutput = reopenAdapter.serialize(restoredMappings);
  const restoredFields = restoredOutput.expectedFields;

  // Step 7: serializeToDsl(restoredFields, savedAssertions)
  const dslAssertions = savedAssertions.filter(
    (a) => ['typeCheck', 'existence', 'arrayLength', 'each', 'arrayContains', 'containsSubset', 'custom'].includes(a.type),
  );
  const outputDsl = serializeToDsl(restoredFields, dslAssertions);

  // Re-parse to count output rules
  const { rules: outputRules } = parseDsl(outputDsl);

  return { inputRules: rules.length, outputRules: outputRules.length, inputDsl: dslInput, outputDsl, savedFields, savedAssertions };
}

describe('Full round-trip: DSL → save → reopen → DSL (data loss audit)', () => {
  describe('field operators', () => {
    it.each([
      ['name equals "John Doe"'],
      ['name not_equals "Jane"'],
      ['count > 5'],
      ['count >= 42'],
      ['count < 100'],
      ['count <= 50'],
      ['name contains "John"'],
      ['name not_contains "xyz"'],
      ['name starts_with "John"'],
      ['name ends_with "Doe"'],
      ['name regex "^John.*"'],
      ['isActive is_true'],
      ['isPremium is_false'],
      ['nullField is_null'],
      ['name is_not_null'],
      ['emptyStr is_empty'],
      ['name is_not_empty'],
      ['name exists'],
      ['nullField not_exists'],
      ['name is_type string'],
      ['count between 1,100'],
      ['count between 1 100'],
      ['pi close_to 3.14,0.01'],
      ['pi close_to 3.14 0.01'],
      ['tags in ["admin", "user"]'],
      ['tags not_in ["banned"]'],
    ])('preserves: %s', (dsl) => {
      const result = simulateFullRoundTrip(dsl);
      expect(result.outputRules).toBe(result.inputRules);
      expect(result.savedFields.length + result.savedAssertions.length).toBeGreaterThan(0);
    });
  });

  describe('negated field operators', () => {
    it.each([
      ['name NOT equals "Jane"'],
      ['count NOT > 100'],
      ['isActive NOT is_false'],
      ['name NOT exists'],
      ['count NOT between 1000,2000'],
    ])('preserves negate: %s', (dsl) => {
      const result = simulateFullRoundTrip(dsl);
      expect(result.outputRules).toBe(result.inputRules);
      const { rules } = parseDsl(result.outputDsl);
      expect(rules[0].negate).toBe(true);
    });
  });

  describe('collection assertions', () => {
    it('preserves array length', () => {
      const result = simulateFullRoundTrip('tags length >= 1');
      expect(result.outputRules).toBe(1);
      expect(result.savedAssertions.some(a => a.type === 'arrayLength')).toBe(true);
    });

    it('preserves each operator', () => {
      const result = simulateFullRoundTrip('offers[*].rank each >= 0');
      expect(result.outputRules).toBe(1);
      expect(result.savedAssertions.some(a => a.type === 'each')).toBe(true);
    });

    it('preserves each between (comma)', () => {
      const result = simulateFullRoundTrip('offers[*].rank each between 3,15');
      expect(result.outputRules).toBe(1);
    });

    it('preserves each between (space)', () => {
      const result = simulateFullRoundTrip('offers[*].rank each between 3 15');
      expect(result.outputRules).toBe(1);
    });

    it('preserves each exists', () => {
      const result = simulateFullRoundTrip('offers[*] each exists');
      expect(result.outputRules).toBe(1);
    });

    it('preserves contains_any', () => {
      const result = simulateFullRoundTrip('tags contains_any ["admin"]');
      expect(result.outputRules).toBe(1);
    });

    it('preserves contains_all', () => {
      const result = simulateFullRoundTrip('tags contains_all ["admin", "user"]');
      expect(result.outputRules).toBe(1);
    });

    it('preserves subset', () => {
      const result = simulateFullRoundTrip('address subset {"city": "NYC"}');
      expect(result.outputRules).toBe(1);
    });

    it('preserves negated length', () => {
      const result = simulateFullRoundTrip('tags NOT length >= 100');
      expect(result.outputRules).toBe(1);
      const { rules } = parseDsl(result.outputDsl);
      expect(rules[0].negate).toBe(true);
    });
  });

  describe('custom assertions', () => {
    it('preserves ASSERT expression', () => {
      const result = simulateFullRoundTrip('ASSERT $gt($count($.body.offers), 0)');
      expect(result.outputRules).toBe(1);
    });

    it('preserves ASSERT with description', () => {
      const result = simulateFullRoundTrip('ASSERT $gt($.count, 0) // count check');
      expect(result.outputRules).toBe(1);
      const { rules } = parseDsl(result.outputDsl);
      expect(rules[0].value).toContain('count check');
    });

    it('preserves NOT ASSERT', () => {
      const result = simulateFullRoundTrip('NOT ASSERT $eq(1, 2)');
      expect(result.outputRules).toBe(1);
      const { rules } = parseDsl(result.outputDsl);
      expect(rules[0].negate).toBe(true);
    });
  });

  describe('multi-rule round-trip', () => {
    it('preserves all rules from a complex DSL', () => {
      const dsl = [
        'name equals "John Doe"',
        'count > 5',
        'isActive is_true',
        'name NOT contains "xyz"',
        'tags length >= 1',
        'offers[*].rank each >= 0',
        'offers[*].rank each between 3 15',
        'ASSERT $gt($count($.body.offers), 0) // count check',
        'NOT ASSERT $eq(1, 2)',
      ].join('\n');
      const result = simulateFullRoundTrip(dsl);
      expect(result.outputRules).toBe(result.inputRules);
    });
  });

  describe('edge cases', () => {
    it('preserves rules when sample body is null', () => {
      const result = simulateFullRoundTrip('name equals "hello"', null);
      expect(result.outputRules).toBe(1);
    });

    it('preserves rules when path does not exist in sample', () => {
      const result = simulateFullRoundTrip('nonexistent.path equals "hello"');
      expect(result.outputRules).toBe(1);
    });

    it('preserves string with spaces', () => {
      const result = simulateFullRoundTrip('name equals "hello world"');
      expect(result.outputRules).toBe(1);
      const { rules } = parseDsl(result.outputDsl);
      expect(rules[0].value).toBe('hello world');
    });

    it('preserves numeric value', () => {
      const result = simulateFullRoundTrip('count equals 42');
      expect(result.outputRules).toBe(1);
    });

    it('preserves boolean value', () => {
      const result = simulateFullRoundTrip('isActive equals true');
      expect(result.outputRules).toBe(1);
    });

    it('preserves indexed array path', () => {
      const result = simulateFullRoundTrip('offers[0].rank between 3 15');
      expect(result.outputRules).toBe(1);
    });

    it('preserves wildcard array path auto-promotion to each', () => {
      const result = simulateFullRoundTrip('offers[*].rank >= 0');
      expect(result.outputRules).toBe(1);
      const { rules } = parseDsl(result.outputDsl);
      expect(rules[0].operator).toMatch(/each/);
    });

    it('comments are excluded from rule count', () => {
      const dsl = '# comment\nname equals "John Doe"\n// another comment';
      const result = simulateFullRoundTrip(dsl);
      expect(result.outputRules).toBe(1);
    });
  });
});
