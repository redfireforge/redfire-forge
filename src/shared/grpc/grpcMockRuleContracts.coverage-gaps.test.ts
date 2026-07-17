/**
 * Coverage gaps — grpcMockRuleContracts.ts (Phase 11D).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  GrpcMockRuleValidationError,
  assertGrpcMockRuleSet,
  validateGrpcMockRuleSet,
  type GrpcMockRule,
} from './grpcMockRuleContracts';
import * as predicateSandbox from './grpcMockPredicateSandbox';

function makeRule(overrides: Partial<GrpcMockRule> & Pick<GrpcMockRule, 'id'>): GrpcMockRule {
  return {
    name: overrides.id,
    enabled: true,
    priority: 1,
    predicate: { kind: 'method_equals', method: 'Echo' },
    response: { statusCode: 0 },
    ...overrides,
  };
}

describe('grpcMockRuleContracts coverage gaps', () => {
  it('GrpcMockRuleValidationError falls back when issues array is empty', () => {
    const error = new GrpcMockRuleValidationError([]);
    expect(error.message).toBe('Invalid mock rule configuration');
    expect(error.issues).toEqual([]);
  });

  it('validateGrpcMockRuleSet rejects predicates without kind', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'no-kind',
          predicate: {} as GrpcMockRule['predicate'],
        }),
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({ path: 'rules[0].predicate.kind', message: 'predicate.kind is required.' }),
    ]);
  });

  it('validateGrpcMockRuleSet validates metadata_equals value type', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'metadata-bad-value',
          predicate: { kind: 'metadata_equals', key: 'x-tenant', value: 123 as unknown as string },
        }),
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({
        path: 'rules[0].predicate.value',
        message: 'metadata value must be a string.',
      }),
    ]);
  });

  it('validateGrpcMockRuleSet validates metadata_exists and metadata_equals keys', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'metadata-missing-key',
          predicate: { kind: 'metadata_exists', key: '  ' },
        }),
        makeRule({
          id: 'metadata-equals-missing-key',
          priority: 2,
          predicate: { kind: 'metadata_equals', key: '', value: 'acme' },
        }),
      ],
    });
    expect(issues.some((issue) => issue.path.endsWith('.key') && issue.message.includes('metadata key'))).toBe(true);
  });

  it('validateGrpcMockRuleSet validates body_path_equals path and value', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'body-equals-missing-path',
          predicate: { kind: 'body_path_equals', path: '', value: '123' },
        }),
        makeRule({
          id: 'body-equals-bad-value',
          priority: 2,
          predicate: { kind: 'body_path_equals', path: 'order_id', value: 123 as unknown as string },
        }),
      ],
    });
    expect(issues.some((issue) => issue.path.endsWith('.path'))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith('.value'))).toBe(true);
  });

  it('validateGrpcMockRuleSet validates body_path_exists path', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'body-exists-missing-path',
          predicate: { kind: 'body_path_exists', path: '' },
        }),
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({ path: 'rules[0].predicate.path', message: 'body path is required.' }),
    ]);
  });

  it('validateGrpcMockRuleSet rejects empty expression predicates', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'empty-expression',
          predicate: { kind: 'expression', expression: '   ' },
        }),
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({ path: 'rules[0].predicate.expression', message: 'expression is required.' }),
    ]);
  });

  it('validateGrpcMockRuleSet maps unexpected expression parse failures to generic message', () => {
    vi.spyOn(predicateSandbox, 'parseGrpcMockPredicateExpression').mockImplementation(() => {
      throw new Error('unexpected parser failure');
    });

    const issues = validateGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'expr-generic-failure',
          predicate: { kind: 'expression', expression: 'method == "Echo"' },
        }),
      ],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        path: 'rules[0].predicate.expression',
        message: 'expression failed to parse.',
      }),
    ]);

    vi.restoreAllMocks();
  });

  it('assertGrpcMockRuleSet throws validation error for invalid rule sets', () => {
    expect(() => assertGrpcMockRuleSet({ rules: [makeRule({ id: '', name: '' })] }))
      .toThrow(GrpcMockRuleValidationError);
  });
});
