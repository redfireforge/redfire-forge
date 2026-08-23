/**
 * Integration test: DSL Rules ↔ Data Mapper sync + failure display
 *
 * Exercises every DSL rule kind through the full pipeline:
 *   DSL text → parseDsl → dslToModel → assertions/fields
 *     → useValidationVerify (evaluateAssertions + evaluateFieldOperator)
 *       → assertionResults + fieldResults
 *         → nodeStatusMap (visual tree badges)
 *         → mergedFieldResults (visual tree tooltips)
 *         → verifyFailuresList (toolbar nav)
 *
 * And the reverse:
 *   fields + assertions → serializeToDsl → DSL text (round-trip)
 */
import { describe, it, expect } from 'vitest';
import { parseDsl, dslToModel, serializeToDsl, DSL_ASSERTION_TYPES } from '../utils/validationDsl';
import { evaluateAssertions } from '@engine/core/validator';
import { evaluateFieldOperator } from '@engine/core/fieldOperatorEvaluation';
import type { Assertion } from '../../../types';
import { stripJsonPathPrefix } from '../../../utils/jsonPath';

const SAMPLE_RESPONSE = {
  name: 'Alice',
  age: 30,
  active: true,
  email: null,
  role: 'admin',
  score: 95.5,
  tags: ['a', 'b', 'c'],
  items: [
    { id: 1, label: 'one' },
    { id: 2, label: 'two' },
    { id: 3, label: 'three' },
  ],
  nested: { deep: { value: 42 } },
  missing: undefined,
};

const CTX = {
  httpStatus: 200,
  responseTimeMs: 50,
  responseHeaders: { 'content-type': 'application/json' },
  responseBody: SAMPLE_RESPONSE,
};

function buildMergedFieldResults(
  fieldResults: Map<string, { passed: boolean; actual?: string; expected?: string }>,
  assertionResults: { assertion: Assertion; passed: boolean; actual?: string; expected?: string }[],
) {
  const map = new Map<string, { passed: boolean; actual?: string; expected?: string }>();
  for (const [path, r] of fieldResults) {
    map.set(path, r);
  }
  for (const ar of assertionResults) {
    if (!('jsonPath' in ar.assertion)) continue;
    const aPath = (ar.assertion as { jsonPath: string }).jsonPath;
    const entry = { passed: ar.passed, actual: ar.actual, expected: ar.expected };
    const existing = map.get(aPath);
    if (!existing || (!ar.passed && existing.passed)) map.set(aPath, entry);
    const stripped = aPath.replace(/^\$\.?/, '');
    if (stripped) {
      const existingStripped = map.get(stripped);
      if (!existingStripped || (!ar.passed && existingStripped.passed)) map.set(stripped, entry);
    }
  }
  return map;
}

function buildNodeStatusMap(
  fieldResults: Map<string, { passed: boolean }>,
  assertionResults: { assertion: Assertion; passed: boolean }[],
) {
  const map = new Map<string, 'pass' | 'fail'>();
  for (const [path, r] of fieldResults) {
    const status = r.passed ? 'pass' : 'fail';
    map.set(path, status);
    const stripped = path.replace(/^\$\.?/, '');
    if (stripped) map.set(stripped, status);
  }
  for (const ar of assertionResults) {
    if (!('jsonPath' in ar.assertion)) continue;
    const aPath = (ar.assertion as { jsonPath: string }).jsonPath;
    const status = ar.passed ? 'pass' : 'fail';
    if (!map.has(aPath) || status === 'fail') map.set(aPath, status);
    const stripped = aPath.replace(/^\$\.?/, '');
    if (stripped && (!map.has(stripped) || status === 'fail')) map.set(stripped, status);
  }
  return map;
}

function buildFailuresList(
  fieldResults: Map<string, { passed: boolean; actual?: string; expected?: string }>,
  assertionResults: { assertion: Assertion; passed: boolean; actual?: string; expected?: string }[],
) {
  const list: { path: string; expected?: string; actual?: string }[] = [];
  for (const [path, r] of fieldResults) {
    if (!r.passed) list.push({ path, expected: r.expected, actual: r.actual });
  }
  for (const ar of assertionResults) {
    if (!ar.passed) {
      const aPath = 'jsonPath' in ar.assertion ? (ar.assertion as { jsonPath: string }).jsonPath : ar.assertion.type;
      list.push({ path: aPath, expected: ar.expected, actual: ar.actual });
    }
  }
  return list;
}

function runFullPipeline(dslText: string) {
  const { rules, errors } = parseDsl(dslText);
  expect(errors).toHaveLength(0);

  const model = dslToModel(rules);
  const { fields, assertions } = model;

  // Evaluate field-kind rules
  const fieldResults = new Map<string, { passed: boolean; actual?: string; expected?: string; operator?: string }>();
  let passedCount = 0;
  let failedCount = 0;

  for (const field of fields) {
    const actualValue = getByJsonPath(SAMPLE_RESPONSE, field.jsonPath);
    const operator = field.operator ?? 'equals';
    const evalResult = evaluateFieldOperator(actualValue, operator, field.operatorValue, field.expectedValue);
    const effectivePass = field.negate ? !evalResult.pass : evalResult.pass;
    const negPrefix = field.negate ? 'NOT ' : '';
    fieldResults.set(field.jsonPath, {
      passed: effectivePass,
      actual: evalResult.actual,
      expected: `${negPrefix}${evalResult.expected}`,
      operator,
    });
    if (effectivePass) passedCount++;
    else failedCount++;
  }

  // Evaluate assertion-kind rules
  const dslAssertions = assertions.filter(a => DSL_ASSERTION_TYPES.has(a.type));
  const assertionResults: { assertion: Assertion; passed: boolean; actual?: string; expected?: string }[] = [];

  for (const a of dslAssertions) {
    const { failures } = evaluateAssertions([a], CTX);
    const passed = failures.length === 0;
    assertionResults.push({
      assertion: a,
      passed,
      actual: failures[0]?.actual,
      expected: failures[0]?.expected,
    });
    if (passed) passedCount++;
    else failedCount++;
  }

  const nodeStatusMap = buildNodeStatusMap(fieldResults, assertionResults);
  const mergedFieldResults = buildMergedFieldResults(fieldResults, assertionResults);
  const failuresList = buildFailuresList(fieldResults, assertionResults);

  // Round-trip: serialize back to DSL
  const roundTripped = serializeToDsl(fields, dslAssertions);

  return {
    fields,
    assertions: dslAssertions,
    fieldResults,
    assertionResults,
    nodeStatusMap,
    mergedFieldResults,
    failuresList,
    passedCount,
    failedCount,
    roundTripped,
  };
}

function getByJsonPath(obj: unknown, jsonPath: string): unknown {
  const path = stripJsonPathPrefix(jsonPath);
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

// ────────────────────────────────────────────────────────────

describe('DSL ↔ Data Mapper full pipeline sync', () => {

  describe('field-kind rules (go through fieldResults)', () => {
    it('equals — pass', () => {
      const r = runFullPipeline('name  equals  "Alice"');
      expect(r.fields).toHaveLength(1);
      expect(r.assertions).toHaveLength(0);
      expect(r.fieldResults.get('$.name')?.passed).toBe(true);
      expect(r.nodeStatusMap.get('$.name')).toBe('pass');
      expect(r.nodeStatusMap.get('name')).toBe('pass');
      expect(r.mergedFieldResults.get('$.name')?.passed).toBe(true);
      expect(r.failuresList).toHaveLength(0);
      expect(r.passedCount).toBe(1);
    });

    it('equals — fail', () => {
      const r = runFullPipeline('name  equals  "Bob"');
      expect(r.fieldResults.get('$.name')?.passed).toBe(false);
      expect(r.nodeStatusMap.get('$.name')).toBe('fail');
      expect(r.nodeStatusMap.get('name')).toBe('fail');
      expect(r.mergedFieldResults.get('$.name')?.passed).toBe(false);
      expect(r.mergedFieldResults.get('$.name')?.actual).toBeDefined();
      expect(r.mergedFieldResults.get('$.name')?.expected).toBeDefined();
      expect(r.failuresList).toHaveLength(1);
      expect(r.failuresList[0].path).toBe('$.name');
      expect(r.failuresList[0].expected).toBeDefined();
      expect(r.failuresList[0].actual).toBeDefined();
    });

    it('contains — pass', () => {
      const r = runFullPipeline('name  contains  "lic"');
      expect(r.fieldResults.get('$.name')?.passed).toBe(true);
      expect(r.nodeStatusMap.get('name')).toBe('pass');
    });

    it('contains — fail', () => {
      const r = runFullPipeline('name  contains  "xyz"');
      expect(r.fieldResults.get('$.name')?.passed).toBe(false);
      expect(r.nodeStatusMap.get('name')).toBe('fail');
      expect(r.failuresList).toHaveLength(1);
    });

    it('greater_than — pass', () => {
      const r = runFullPipeline('age  greater_than  20');
      expect(r.fieldResults.get('$.age')?.passed).toBe(true);
      expect(r.nodeStatusMap.get('age')).toBe('pass');
    });

    it('greater_than — fail', () => {
      const r = runFullPipeline('age  greater_than  50');
      expect(r.fieldResults.get('$.age')?.passed).toBe(false);
      expect(r.failuresList).toHaveLength(1);
    });

    it('regex — pass', () => {
      const r = runFullPipeline('role  regex  "^adm"');
      expect(r.fieldResults.get('$.role')?.passed).toBe(true);
      expect(r.nodeStatusMap.get('role')).toBe('pass');
    });

    it('NOT modifier — inverts pass', () => {
      const r = runFullPipeline('name  NOT equals  "Bob"');
      expect(r.fieldResults.get('$.name')?.passed).toBe(true);
      expect(r.nodeStatusMap.get('name')).toBe('pass');
    });

    it('NOT modifier — inverts fail', () => {
      const r = runFullPipeline('name  NOT equals  "Alice"');
      expect(r.fieldResults.get('$.name')?.passed).toBe(false);
      expect(r.nodeStatusMap.get('name')).toBe('fail');
      expect(r.failuresList).toHaveLength(1);
    });

    it('in operator — pass', () => {
      const r = runFullPipeline('role  in  ["admin","user"]');
      expect(r.fieldResults.get('$.role')?.passed).toBe(true);
    });

    it('between operator — pass', () => {
      const r = runFullPipeline('age  between  20,40');
      expect(r.fieldResults.get('$.age')?.passed).toBe(true);
    });

    it('is_true operator — pass', () => {
      const r = runFullPipeline('active  is_true');
      expect(r.fieldResults.get('$.active')?.passed).toBe(true);
    });

    it('is_empty on null — pass', () => {
      const r = runFullPipeline('email  is_null');
      expect(r.fieldResults.get('$.email')?.passed).toBe(true);
    });

    it('nested path — pass', () => {
      const r = runFullPipeline('nested.deep.value  equals  42');
      expect(r.fieldResults.get('$.nested.deep.value')?.passed).toBe(true);
      expect(r.nodeStatusMap.get('nested.deep.value')).toBe('pass');
    });
  });

  describe('existence-kind rules (go through fieldResults)', () => {
    it('exists — pass', () => {
      const r = runFullPipeline('name  exists');
      expect(r.fields).toHaveLength(1);
      expect(r.fields[0].operator).toBe('exists');
      expect(r.fieldResults.get('$.name')?.passed).toBe(true);
      expect(r.nodeStatusMap.get('$.name')).toBe('pass');
      expect(r.nodeStatusMap.get('name')).toBe('pass');
      expect(r.mergedFieldResults.get('$.name')?.passed).toBe(true);
      expect(r.failuresList).toHaveLength(0);
    });

    it('not_exists on missing field — pass', () => {
      const r = runFullPipeline('nonExistent  not_exists');
      expect(r.fieldResults.get('$.nonExistent')?.passed).toBe(true);
      expect(r.nodeStatusMap.get('$.nonExistent')).toBe('pass');
      expect(r.nodeStatusMap.get('nonExistent')).toBe('pass');
      expect(r.mergedFieldResults.get('$.nonExistent')?.passed).toBe(true);
    });

    it('not_exists on existing field — fail', () => {
      const r = runFullPipeline('name  not_exists');
      expect(r.fieldResults.get('$.name')?.passed).toBe(false);
      expect(r.nodeStatusMap.get('$.name')).toBe('fail');
      expect(r.nodeStatusMap.get('name')).toBe('fail');
      expect(r.mergedFieldResults.get('$.name')?.passed).toBe(false);
      expect(r.mergedFieldResults.get('$.name')?.expected).toContain('not exists');
      expect(r.mergedFieldResults.get('$.name')?.actual).toBeDefined();
      expect(r.failuresList).toHaveLength(1);
      expect(r.failuresList[0].path).toBe('$.name');
      expect(r.failuresList[0].expected).toContain('not exists');
    });

    it('exists on missing field — fail', () => {
      const r = runFullPipeline('nonExistent  exists');
      expect(r.fieldResults.get('$.nonExistent')?.passed).toBe(false);
      expect(r.nodeStatusMap.get('nonExistent')).toBe('fail');
      expect(r.mergedFieldResults.get('$.nonExistent')?.passed).toBe(false);
      expect(r.mergedFieldResults.get('$.nonExistent')?.expected).toContain('exists');
      expect(r.failuresList).toHaveLength(1);
    });
  });

  describe('type_check-kind rules (go through assertionResults)', () => {
    it('is_type string — pass', () => {
      const r = runFullPipeline('name  is_type  string');
      expect(r.assertions[0].type).toBe('typeCheck');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('name')).toBe('pass');
      expect(r.mergedFieldResults.get('name')?.passed).toBe(true);
    });

    it('is_type number — pass', () => {
      const r = runFullPipeline('age  is_type  number');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('age')).toBe('pass');
    });

    it('is_type object — fail on string', () => {
      const r = runFullPipeline('name  is_type  object');
      expect(r.assertionResults[0].passed).toBe(false);
      expect(r.nodeStatusMap.get('name')).toBe('fail');
      expect(r.mergedFieldResults.get('name')?.expected).toContain('type object');
      expect(r.mergedFieldResults.get('name')?.actual).toContain('type string');
      expect(r.failuresList).toHaveLength(1);
    });

    it('is_type boolean — pass', () => {
      const r = runFullPipeline('active  is_type  boolean');
      expect(r.assertionResults[0].passed).toBe(true);
    });

    it('is_type array — pass on tags', () => {
      const r = runFullPipeline('tags  is_type  array');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('tags')).toBe('pass');
    });

    it('is_type null — pass on email', () => {
      const r = runFullPipeline('email  is_type  null');
      expect(r.assertionResults[0].passed).toBe(true);
    });
  });

  describe('arrayLength-kind rules (go through assertionResults)', () => {
    it('length = 3 — pass', () => {
      const r = runFullPipeline('tags  length =  3');
      expect(r.assertions[0].type).toBe('arrayLength');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('tags')).toBe('pass');
      expect(r.mergedFieldResults.get('tags')?.passed).toBe(true);
    });

    it('length > 10 — fail', () => {
      const r = runFullPipeline('tags  length >  10');
      expect(r.assertionResults[0].passed).toBe(false);
      expect(r.nodeStatusMap.get('tags')).toBe('fail');
      expect(r.mergedFieldResults.get('tags')?.expected).toContain('length');
      expect(r.mergedFieldResults.get('tags')?.actual).toContain('3');
      expect(r.failuresList).toHaveLength(1);
    });

    it('length >= 3 — pass', () => {
      const r = runFullPipeline('items  length >=  3');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('items')).toBe('pass');
    });
  });

  describe('each-kind rules (go through assertionResults)', () => {
    it('each exists — pass', () => {
      const r = runFullPipeline('items[*].id  each exists');
      expect(r.assertions[0].type).toBe('each');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('items')).toBe('pass');
      expect(r.mergedFieldResults.get('items')?.passed).toBe(true);
    });

    it('each equals — fail (not all equal)', () => {
      const r = runFullPipeline('items[*].label  each equals  "one"');
      expect(r.assertionResults[0].passed).toBe(false);
      expect(r.nodeStatusMap.get('items')).toBe('fail');
      expect(r.mergedFieldResults.get('items')?.passed).toBe(false);
      expect(r.mergedFieldResults.get('items')?.expected).toBeDefined();
      expect(r.failuresList).toHaveLength(1);
    });
  });

  describe('arrayContains-kind rules (go through assertionResults)', () => {
    it('contains_any — pass', () => {
      const r = runFullPipeline('tags  contains_any  "a"');
      expect(r.assertions[0].type).toBe('arrayContains');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('tags')).toBe('pass');
      expect(r.mergedFieldResults.get('tags')?.passed).toBe(true);
    });

    it('contains_any — fail', () => {
      const r = runFullPipeline('tags  contains_any  "z"');
      expect(r.assertionResults[0].passed).toBe(false);
      expect(r.nodeStatusMap.get('tags')).toBe('fail');
      expect(r.mergedFieldResults.get('tags')?.passed).toBe(false);
      expect(r.failuresList).toHaveLength(1);
      expect(r.failuresList[0].expected).toContain('contains');
    });

    it('contains_all — fail when not all match', () => {
      const r = runFullPipeline('tags  contains_all  "a"');
      // tags = ['a','b','c'], 'a' is only one of three — contains_all means all items match
      expect(r.assertionResults[0].passed).toBe(false);
      expect(r.nodeStatusMap.get('tags')).toBe('fail');
      expect(r.failuresList).toHaveLength(1);
    });

    it('contains_none — pass', () => {
      const r = runFullPipeline('tags  contains_none  "z"');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('tags')).toBe('pass');
    });
  });

  describe('containsSubset-kind rules (go through assertionResults)', () => {
    it('subset pass — nested match', () => {
      const r = runFullPipeline('nested  subset  {"deep":{"value":42}}');
      expect(r.assertions[0].type).toBe('containsSubset');
      expect(r.assertionResults[0].passed).toBe(true);
      expect(r.nodeStatusMap.get('nested')).toBe('pass');
      expect(r.mergedFieldResults.get('nested')?.passed).toBe(true);
    });

    it('subset fail — wrong value', () => {
      const r = runFullPipeline('nested  subset  {"deep":{"value":99}}');
      expect(r.assertionResults[0].passed).toBe(false);
      expect(r.nodeStatusMap.get('nested')).toBe('fail');
      expect(r.mergedFieldResults.get('nested')?.passed).toBe(false);
      expect(r.failuresList).toHaveLength(1);
    });
  });

  describe('custom-kind rules (go through assertionResults, no jsonPath)', () => {
    it('ASSERT pass — truthy expression', () => {
      const r = runFullPipeline('ASSERT $.name');
      expect(r.assertions[0].type).toBe('custom');
      expect(r.assertionResults[0].passed).toBe(true);
      // custom has no jsonPath, so it should NOT be in nodeStatusMap
      expect(r.nodeStatusMap.size).toBe(0);
      expect(r.mergedFieldResults.size).toBe(0);
      expect(r.failuresList).toHaveLength(0);
    });

    it('ASSERT fail — false literal', () => {
      const r = runFullPipeline('ASSERT false');
      expect(r.assertionResults[0].passed).toBe(false);
      expect(r.failuresList).toHaveLength(1);
      expect(r.failuresList[0].path).toBe('custom');
      expect(r.failuresList[0].expected).toBeDefined();
    });
  });

  describe('mixed rules — all kinds together', () => {
    it('mixed pass/fail across all kinds produces correct maps', () => {
      const dsl = [
        'name  equals  "Alice"',           // field: pass
        'age  greater_than  50',            // field: fail
        'active  exists',                   // existence: pass
        'nonExistent  not_exists',          // existence: pass
        'name  is_type  string',            // typeCheck: pass
        'tags  length =  3',               // arrayLength: pass
        'items[*].id  each exists',         // each: pass
        'tags  contains_any  "a"',          // arrayContains: pass
        'nested  subset  {"deep":{"value":42}}',  // containsSubset: pass
      ].join('\n');

      const r = runFullPipeline(dsl);

      // 4 fields + 5 assertions = 9 total
      expect(r.fields).toHaveLength(4);   // name equals, age greater_than, active exists, nonExistent not_exists
      expect(r.assertions).toHaveLength(5); // typeCheck, arrayLength, each, arrayContains, containsSubset

      expect(r.passedCount).toBe(8);
      expect(r.failedCount).toBe(1);

      // age failed
      expect(r.nodeStatusMap.get('age')).toBe('fail');
      expect(r.mergedFieldResults.get('$.age')?.passed).toBe(false);
      expect(r.failuresList).toHaveLength(1);
      expect(r.failuresList[0].path).toBe('$.age');

      // All others passed
      expect(r.nodeStatusMap.get('name')).toBe('pass');
      expect(r.nodeStatusMap.get('active')).toBe('pass');
      expect(r.nodeStatusMap.get('tags')).toBe('pass');
      expect(r.nodeStatusMap.get('items')).toBe('pass');
      expect(r.nodeStatusMap.get('nested')).toBe('pass');
      expect(r.nodeStatusMap.get('nonExistent')).toBe('pass');
    });

    it('fail overrides pass when both a mapping and assertion target the same path', () => {
      const dsl = [
        'name  equals  "Alice"',   // field: pass
        'name  is_type  number',   // typeCheck: fail (name is string)
      ].join('\n');

      const r = runFullPipeline(dsl);
      // nodeStatusMap should show fail because assertion failed
      expect(r.nodeStatusMap.get('name')).toBe('fail');
      expect(r.mergedFieldResults.get('name')?.passed).toBe(false);
    });
  });

  describe('DSL round-trip (visual → DSL → visual)', () => {
    it('field rules survive round-trip', () => {
      const dsl = 'name  equals  "Alice"';
      const r = runFullPipeline(dsl);
      const re = parseDsl(r.roundTripped);
      expect(re.errors).toHaveLength(0);
      const model2 = dslToModel(re.rules);
      expect(model2.fields).toHaveLength(1);
      expect(model2.fields[0].jsonPath).toBe('$.name');
      expect(model2.fields[0].expectedValue).toBe('Alice');
    });

    it('existence rules survive round-trip', () => {
      const dsl = 'name  exists';
      const r = runFullPipeline(dsl);
      expect(r.roundTripped).toContain('exists');
      const re = parseDsl(r.roundTripped);
      const model2 = dslToModel(re.rules);
      expect(model2.fields).toHaveLength(1);
      expect(model2.fields[0].operator).toBe('exists');
      expect(model2.fields[0].jsonPath).toBe('$.name');
    });

    it('typeCheck rules survive round-trip', () => {
      const dsl = 'name  is_type  string';
      const r = runFullPipeline(dsl);
      const re = parseDsl(r.roundTripped);
      const model2 = dslToModel(re.rules);
      expect(model2.assertions).toHaveLength(1);
      expect(model2.assertions[0].type).toBe('typeCheck');
      expect((model2.assertions[0] as { expectedType: string }).expectedType).toBe('string');
    });

    it('arrayLength rules survive round-trip', () => {
      const dsl = 'tags  length >=  3';
      const r = runFullPipeline(dsl);
      const re = parseDsl(r.roundTripped);
      const model2 = dslToModel(re.rules);
      expect(model2.assertions).toHaveLength(1);
      expect(model2.assertions[0].type).toBe('arrayLength');
    });

    it('each rules survive round-trip', () => {
      const dsl = 'items[*].id  each exists';
      const r = runFullPipeline(dsl);
      const re = parseDsl(r.roundTripped);
      const model2 = dslToModel(re.rules);
      expect(model2.assertions).toHaveLength(1);
      expect(model2.assertions[0].type).toBe('each');
    });

    it('arrayContains rules survive round-trip', () => {
      const dsl = 'tags  contains_any  "a"';
      const r = runFullPipeline(dsl);
      const re = parseDsl(r.roundTripped);
      const model2 = dslToModel(re.rules);
      expect(model2.assertions).toHaveLength(1);
      expect(model2.assertions[0].type).toBe('arrayContains');
    });

    it('containsSubset rules survive round-trip', () => {
      const dsl = 'nested  subset  {"deep":{"value":42}}';
      const r = runFullPipeline(dsl);
      const re = parseDsl(r.roundTripped);
      const model2 = dslToModel(re.rules);
      expect(model2.assertions).toHaveLength(1);
      expect(model2.assertions[0].type).toBe('containsSubset');
    });

    it('custom rules survive round-trip', () => {
      const dsl = 'ASSERT $.age > 0';
      const r = runFullPipeline(dsl);
      expect(r.roundTripped).toContain('ASSERT');
      const re = parseDsl(r.roundTripped);
      const model2 = dslToModel(re.rules);
      expect(model2.assertions).toHaveLength(1);
      expect(model2.assertions[0].type).toBe('custom');
    });
  });
});
