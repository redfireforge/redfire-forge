/**
 * Integration tests: validationAdapter serialize + useValidationVerify for ALL 24 operators.
 * Tests the full pipeline: mapping → adapter serialize → verify hook evaluation.
 * Also tests expression + operator combinations.
 */
import { describe, it, expect } from 'vitest';
import { createValidationAdapter } from './validationAdapter';
import type { Mapping } from '../types';
import type { FieldOperator, ExpectedField, ValidationConfig } from '../../../types';
import { evaluateFieldOperator } from '../../../../engine/fieldOperatorEvaluation';
import { getByPath } from '../../../utils/jsonPath';
import { validate } from '../../../../engine/validator';

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

function makeSingleMapping(
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

describe('Integration: equals operator', () => {
  it('passes when actual matches sample value', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name'));
    expect(results[0].passed).toBe(true);
  });

  it('passes for number field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count'));
    expect(results[0].passed).toBe(true);
  });

  it('passes for boolean field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('isActive'));
    expect(results[0].passed).toBe(true);
  });

  it('passes for null field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('nullField'));
    expect(results[0].passed).toBe(true);
  });

  it('fails when response changes', () => {
    const modified = { ...RESPONSE, name: 'Jane' };
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name'));
    const verifyResults = results.map(r => {
      const actual = getByPath(modified, r.path);
      return evaluateFieldOperator(actual, r.operator as FieldOperator, undefined, 'John Doe');
    });
    expect(verifyResults[0].pass).toBe(false);
  });
});

describe('Integration: not_equals operator', () => {
  it('passes when value differs from expected', () => {
    const modified = { ...RESPONSE, name: 'Jane' };
    const mappings = makeSingleMapping('name', 'not_equals');
    const adapter = createValidationAdapter({ sampleResponseBody: RESPONSE, selectiveMode: 'include' });
    const output = adapter.serialize(mappings);
    const actual = getByPath(modified, output.expectedFields[0].jsonPath);
    const r = evaluateFieldOperator(actual, 'not_equals', undefined, output.expectedFields[0].expectedValue);
    expect(r.pass).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// 2. COMPARISON OPERATORS — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: greater_than operator', () => {
  it('passes when actual > operatorValue', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'greater_than', '10'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when actual < operatorValue', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'greater_than', '100'));
    expect(results[0].passed).toBe(false);
  });
  it('works for nested numeric field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('offers[0].duration.value', 'greater_than', '10'));
    expect(results[0].passed).toBe(true);
  });
});

describe('Integration: greater_than_or_equal operator', () => {
  it('passes at boundary', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'greater_than_or_equal', '42'));
    expect(results[0].passed).toBe(true);
  });
  it('fails below', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'greater_than_or_equal', '43'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: less_than operator', () => {
  it('passes when actual < operatorValue', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'less_than', '100'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when actual > operatorValue', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'less_than', '10'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: less_than_or_equal operator', () => {
  it('passes at boundary', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'less_than_or_equal', '42'));
    expect(results[0].passed).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// 3. STRING OPERATORS — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: contains operator', () => {
  it('passes when field contains substring', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'contains', 'John'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when field does not contain substring', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'contains', 'Jane'));
    expect(results[0].passed).toBe(false);
  });
  it('works for nested fields', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('offers[0].planType', 'contains', 'Tri'));
    expect(results[0].passed).toBe(true);
  });
});

describe('Integration: not_contains operator', () => {
  it('passes when field does not contain substring', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'not_contains', 'xyz'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when field contains substring', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'not_contains', 'John'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: starts_with operator', () => {
  it('passes when field starts with prefix', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('email', 'starts_with', 'john'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when field does not start with prefix', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('email', 'starts_with', 'jane'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: ends_with operator', () => {
  it('passes when field ends with suffix', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('email', 'ends_with', '.com'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when field does not end with suffix', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('email', 'ends_with', '.org'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: regex operator', () => {
  it('passes for matching pattern', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('email', 'regex', '^[\\w.]+@'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for non-matching pattern', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'regex', '^\\d+$'));
    expect(results[0].passed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 4. BOOLEAN OPERATORS — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: is_true operator', () => {
  it('passes for true field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('isActive', 'is_true'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for false field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('isPremium', 'is_true'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: is_false operator', () => {
  it('passes for false field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('isPremium', 'is_false'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for true field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('isActive', 'is_false'));
    expect(results[0].passed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 5. EXISTENCE OPERATORS — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: exists operator', () => {
  it('passes for existing field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'exists'));
    expect(results[0].passed).toBe(true);
  });
  it('passes for null field (null exists)', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('nullField', 'exists'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for missing field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('nonExistent', 'exists'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: not_exists operator', () => {
  it('passes for missing field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('nonExistent', 'not_exists'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for existing field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'not_exists'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: is_null operator', () => {
  it('passes for null field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('nullField', 'is_null'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for non-null field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'is_null'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: is_not_null operator', () => {
  it('passes for non-null field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'is_not_null'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for null field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('nullField', 'is_not_null'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: is_empty operator', () => {
  it('passes for empty string field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('emptyStr', 'is_empty'));
    expect(results[0].passed).toBe(true);
  });
  it('passes for empty array field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('emptyArr', 'is_empty'));
    expect(results[0].passed).toBe(true);
  });
  it('passes for empty object field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('emptyObj', 'is_empty'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for non-empty field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'is_empty'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: is_not_empty operator', () => {
  it('passes for non-empty field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'is_not_empty'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for empty string', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('emptyStr', 'is_not_empty'));
    expect(results[0].passed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 6. TYPE CHECK — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: is_type operator', () => {
  it('validates string type', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'is_type', 'string'));
    expect(results[0].passed).toBe(true);
  });
  it('validates number type', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'is_type', 'number'));
    expect(results[0].passed).toBe(true);
  });
  it('validates boolean type', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('isActive', 'is_type', 'boolean'));
    expect(results[0].passed).toBe(true);
  });
  it('validates array type', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('tags', 'is_type', 'array'));
    expect(results[0].passed).toBe(true);
  });
  it('validates object type', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('address', 'is_type', 'object'));
    expect(results[0].passed).toBe(true);
  });
  it('validates null type', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('nullField', 'is_type', 'null'));
    expect(results[0].passed).toBe(true);
  });
  it('fails for wrong type', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'is_type', 'number'));
    expect(results[0].passed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 7. SET OPERATORS — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: in operator', () => {
  it('passes when value is in list', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('planType', 'in', '["Trial","Premium","Free"]'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when value is not in list', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('planType', 'in', '["Premium","Free"]'));
    expect(results[0].passed).toBe(false);
  });
  it('works with number in list', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'in', '[10,42,100]'));
    expect(results[0].passed).toBe(true);
  });
});

describe('Integration: not_in operator', () => {
  it('passes when value is not in list', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('planType', 'not_in', '["Premium","Free"]'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when value is in list', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('planType', 'not_in', '["Trial","Premium"]'));
    expect(results[0].passed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 8. RANGE OPERATORS — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: between operator', () => {
  it('passes when value is within range', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'between', '1, 100'));
    expect(results[0].passed).toBe(true);
  });
  it('fails when value is outside range', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'between', '1, 10'));
    expect(results[0].passed).toBe(false);
  });
  it('works for decimal field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('pi', 'between', '3.0, 3.2'));
    expect(results[0].passed).toBe(true);
  });
  it('passes with space-separated values (DSL format)', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'between', '1 100'));
    expect(results[0].passed).toBe(true);
  });
  it('fails with space-separated values outside range', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('count', 'between', '1 10'));
    expect(results[0].passed).toBe(false);
  });
});

describe('Integration: close_to operator', () => {
  it('passes within tolerance', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('pi', 'close_to', '3.14, 0.01'));
    expect(results[0].passed).toBe(true);
  });
  it('fails outside tolerance', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('pi', 'close_to', '3.0, 0.01'));
    expect(results[0].passed).toBe(false);
  });
  it('passes with space-separated values (DSL format)', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('pi', 'close_to', '3.14 0.01'));
    expect(results[0].passed).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// 9. NEGATE MODIFIER — Full Pipeline
// ────────────────────────────────────────────────────────────

describe('Integration: negate modifier', () => {
  it('inverts equals to fail', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', undefined, undefined, { negate: true }));
    expect(results[0].passed).toBe(false);
  });
  it('inverts exists to fail', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'exists', undefined, { negate: true }));
    expect(results[0].passed).toBe(false);
  });
  it('NOT contains passes when substring is absent', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('name', 'contains', 'xyz', { negate: true }));
    expect(results[0].passed).toBe(true);
  });
  it('NOT is_true passes for false field', () => {
    const { results } = serializeAndVerify(RESPONSE, makeSingleMapping('isPremium', 'is_true', undefined, { negate: true }));
    expect(results[0].passed).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// 10. EXPRESSION + OPERATOR COMBOS
// ────────────────────────────────────────────────────────────

describe('Integration: expression with operator', () => {
  it('boolean expression auto-assigns is_true and passes', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: RESPONSE,
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [{
      id: 'expr-1',
      sourceId: 'response-body',
      sourcePath: 'offers[0].planType',
      targetPath: 'offers[0].planType',
      expression: '$contains($.offers[0].planType, "Tri")',
    }];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].operator).toBe('is_true');
    expect(output.expectedFields[0].expectedValue).toBe('true');
  });

  it('boolean expression auto-assigns is_true and fails for false result', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: RESPONSE,
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [{
      id: 'expr-2',
      sourceId: 'response-body',
      sourcePath: 'offers[0].planType',
      targetPath: 'offers[0].planType',
      expression: '$contains($.offers[0].planType, "xyz")',
    }];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].operator).toBe('is_true');
    expect(output.expectedFields[0].expectedValue).toBe('false');
  });

  it('explicit operator overrides auto-assigned is_true', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: RESPONSE,
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [{
      id: 'expr-3',
      sourceId: 'response-body',
      sourcePath: 'offers[0].planType',
      targetPath: 'offers[0].planType',
      expression: '$contains($.offers[0].planType, "Tri")',
      operator: 'is_false',
    }];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].operator).toBe('is_false');
  });

  it('expression returning string value works with equals', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: RESPONSE,
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [{
      id: 'expr-4',
      sourceId: 'response-body',
      sourcePath: 'name',
      targetPath: 'name',
      expression: '$upper($.name)',
    }];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].expectedValue).toBe('JOHN DOE');
  });

  it('expression returning number works with comparison', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: RESPONSE,
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [{
      id: 'expr-5',
      sourceId: 'response-body',
      sourcePath: 'count',
      targetPath: 'count',
      expression: '$sum([$.count, 10])',
      operator: 'greater_than',
      operatorValue: '50',
    }];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].operator).toBe('greater_than');
    expect(output.expectedFields[0].operatorValue).toBe('50');
    expect(output.expectedFields[0].expectedValue).toBe('52');
  });

  it('auto-mapped field gets autoMapDefaultOperator (equals)', () => {
    const adapter = createValidationAdapter({
      sampleResponseBody: RESPONSE,
      selectiveMode: 'include',
    });
    const mappings: Mapping[] = [{
      id: 'auto-1',
      sourceId: 'response-body',
      sourcePath: 'name',
      targetPath: 'name',
      isAutoMapped: true,
    }];
    const output = adapter.serialize(mappings);
    expect(output.expectedFields[0].operator).toBe('equals');
  });
});

// ────────────────────────────────────────────────────────────
// 11. MULTIPLE OPERATORS IN SAME RESPONSE
// ────────────────────────────────────────────────────────────

describe('Integration: multiple operators on same response', () => {
  it('validates multiple fields with different operators', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'name', targetPath: 'name', operator: 'contains', operatorValue: 'John' },
      { id: 'm2', sourceId: 'response-body', sourcePath: 'count', targetPath: 'count', operator: 'greater_than', operatorValue: '10' },
      { id: 'm3', sourceId: 'response-body', sourcePath: 'isActive', targetPath: 'isActive', operator: 'is_true' },
      { id: 'm4', sourceId: 'response-body', sourcePath: 'planType', targetPath: 'planType', operator: 'in', operatorValue: '["Trial","Premium"]' },
      { id: 'm5', sourceId: 'response-body', sourcePath: 'email', targetPath: 'email', operator: 'regex', operatorValue: '^[\\w.]+@' },
      { id: 'm6', sourceId: 'response-body', sourcePath: 'nullField', targetPath: 'nullField', operator: 'is_null' },
      { id: 'm7', sourceId: 'response-body', sourcePath: 'pi', targetPath: 'pi', operator: 'between', operatorValue: '3.0, 3.2' },
      { id: 'm8', sourceId: 'response-body', sourcePath: 'tags', targetPath: 'tags', operator: 'is_type', operatorValue: 'array' },
    ];
    const { results } = serializeAndVerify(RESPONSE, mappings);
    expect(results).toHaveLength(8);
    for (const r of results) {
      expect(r.passed).toBe(true);
    }
  });

  it('detects failures accurately in mixed batch', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'response-body', sourcePath: 'name', targetPath: 'name', operator: 'contains', operatorValue: 'Jane' },
      { id: 'm2', sourceId: 'response-body', sourcePath: 'count', targetPath: 'count', operator: 'less_than', operatorValue: '10' },
      { id: 'm3', sourceId: 'response-body', sourcePath: 'isActive', targetPath: 'isActive', operator: 'is_false' },
    ];
    const { results } = serializeAndVerify(RESPONSE, mappings);
    expect(results[0].passed).toBe(false);
    expect(results[1].passed).toBe(false);
    expect(results[2].passed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 12. ARRAY/OBJECT NODE FILTERING ($.offers bug reproduction)
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
import type { Assertion } from '../../../types';

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
