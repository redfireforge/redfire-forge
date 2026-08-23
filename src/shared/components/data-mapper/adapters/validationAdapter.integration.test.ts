/**
 * Integration tests: validationAdapter serialize + useValidationVerify for ALL 24 operators.
 * Tests the full pipeline: mapping → adapter serialize → verify hook evaluation.
 * Also tests expression + operator combinations.
 */
import { describe, it, expect } from 'vitest';
import { createValidationAdapter } from './validationAdapter';
import type { Mapping } from '../types';
import type { FieldOperator, ExpectedField } from '../../../types';
import { evaluateFieldOperator } from '@engine/fieldOperatorEvaluation';
import { getByPath } from '../../../utils/jsonPath';
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
