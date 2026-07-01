/**
 * Phase 11D - Mock rule model and evaluator engine acceptance tests.
 *
 * Validates:
 *   11D-A Rule ordering and first-match behavior
 *   11D-B Fallthrough chain semantics
 *   11D-C Default response path
 *   11D-D Sandboxed predicate parsing and evaluation
 *   11D-E Security boundary for expression parsing
 *   11D-F Config validation
 *   11D-G Source-scan traceability
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  GRPC_MOCK_DEFAULT_STATUS_CODE,
  GRPC_MOCK_DEFAULT_STATUS_MESSAGE,
  GrpcMockRuleValidationError,
  assertGrpcMockRuleSet,
  createDefaultGrpcMockResponse,
  validateGrpcMockRuleSet,
  type GrpcMockEvaluationContext,
  type GrpcMockRule,
  type GrpcMockRuleSet,
} from './grpcMockRuleContracts';
import {
  GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS,
  GrpcMockPredicateParseError,
  GrpcMockPredicateSecurityError,
  evaluateGrpcMockPredicate,
  parseGrpcMockPredicateExpression,
} from './grpcMockPredicateSandbox';
import {
  compareGrpcMockRules,
  createGrpcMockNoMatchResult,
  evaluateGrpcMockRuleSet,
  evaluateGrpcMockRules,
  sortGrpcMockRules,
} from './grpcMockRuleEvaluatorCore';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function makeContext(overrides: Partial<GrpcMockEvaluationContext> = {}): GrpcMockEvaluationContext {
  return {
    service: 'order.OrderService',
    method: 'GetOrder',
    callType: 'unary',
    metadata: { 'x-tenant': 'acme' },
    requestBody: { order_id: '123', status: 'OPEN' },
    ...overrides,
  };
}

function makeRule(overrides: Partial<GrpcMockRule> & Pick<GrpcMockRule, 'id'>): GrpcMockRule {
  return {
    name: overrides.id,
    enabled: true,
    priority: 100,
    predicate: { kind: 'method_equals', method: 'GetOrder' },
    response: { statusCode: 0, body: { ok: true } },
    ...overrides,
  };
}

describe('Phase 11D-A - rule ordering and first-match behavior', () => {
  it('sorts rules by priority asc then createdAt then input index', () => {
    const rules: GrpcMockRule[] = [
      makeRule({ id: 'late', priority: 20, createdAt: '2026-07-01T00:00:02.000Z' }),
      makeRule({ id: 'early', priority: 10, createdAt: '2026-07-01T00:00:01.000Z' }),
      makeRule({ id: 'same-priority-a', priority: 10, createdAt: '2026-07-01T00:00:01.000Z' }),
    ];

    const sorted = sortGrpcMockRules(rules).map((entry) => entry.rule.id);
    expect(sorted).toEqual(['early', 'same-priority-a', 'late']);
    expect(compareGrpcMockRules({ rule: rules[1]!, index: 1 }, { rule: rules[2]!, index: 2 })).toBeLessThan(0);
  });

  it('orders negative priorities before higher values', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'zero',
          priority: 0,
          response: { statusCode: 0, body: { winner: 'zero' } },
        }),
        makeRule({
          id: 'negative',
          priority: -5,
          response: { statusCode: 0, body: { winner: 'negative' } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(result.ruleId).toBe('negative');
    expect(result.response.body).toEqual({ winner: 'negative' });
  });

  it('returns the first matching enabled rule when fallthrough is disabled', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'low-priority',
          priority: 50,
          predicate: { kind: 'method_equals', method: 'GetOrder' },
          response: { statusCode: 0, body: { source: 'low' } },
        }),
        makeRule({
          id: 'high-priority',
          priority: 10,
          predicate: { kind: 'method_equals', method: 'GetOrder' },
          response: { statusCode: 0, body: { source: 'high' } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(result.matched).toBe(true);
    expect(result.usedDefault).toBe(false);
    expect(result.ruleId).toBe('high-priority');
    expect(result.response.body).toEqual({ source: 'high' });
  });

  it('skips disabled rules and continues evaluation', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'disabled',
          enabled: false,
          priority: 1,
          response: { statusCode: 0, body: { source: 'disabled' } },
        }),
        makeRule({
          id: 'enabled',
          priority: 2,
          response: { statusCode: 0, body: { source: 'enabled' } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(result.ruleId).toBe('enabled');
  });

  it('matches metadata and request body structured predicates', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'metadata-and-body',
          predicate: {
            kind: 'and',
            predicates: [
              { kind: 'metadata_equals', key: 'x-tenant', value: 'acme' },
              { kind: 'body_path_equals', path: 'order_id', value: '123' },
            ],
          },
          response: { statusCode: 0, body: { matched: true } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(result.ruleId).toBe('metadata-and-body');
    expect(result.response.body).toEqual({ matched: true });
  });

  it('matches service_equals and metadata_exists predicates', () => {
    const predicate = {
      kind: 'and' as const,
      predicates: [
        { kind: 'service_equals' as const, service: 'order.OrderService' },
        { kind: 'metadata_exists' as const, key: 'x-tenant' },
        { kind: 'body_path_exists' as const, path: 'status' },
      ],
    };
    expect(evaluateGrpcMockPredicate(predicate, makeContext())).toBe(true);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ metadata: {} }))).toBe(false);
  });
});

describe('Phase 11D-B - fallthrough chain semantics', () => {
  it('continues on fallthrough matches and returns the last fallthrough candidate', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'rule-1',
          priority: 1,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 1 } },
        }),
        makeRule({
          id: 'rule-2',
          priority: 2,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 2 } },
        }),
        makeRule({
          id: 'rule-3',
          priority: 3,
          predicate: { kind: 'method_equals', method: 'MissingMethod' },
          response: { statusCode: 0, body: { step: 3 } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(result.ruleId).toBe('rule-2');
    expect(result.fallthroughChain).toEqual(['rule-1', 'rule-2']);
    expect(result.response.body).toEqual({ step: 2 });
  });

  it('stops immediately on first non-fallthrough match', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'fallthrough-rule',
          priority: 1,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 1 } },
        }),
        makeRule({
          id: 'terminal-rule',
          priority: 2,
          response: { statusCode: 0, body: { step: 2 } },
        }),
        makeRule({
          id: 'never-used',
          priority: 3,
          response: { statusCode: 0, body: { step: 3 } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(result.ruleId).toBe('terminal-rule');
    expect(result.fallthroughChain).toEqual(['fallthrough-rule']);
    expect(result.response.body).toEqual({ step: 2 });
  });

  it('skips non-matching rules between fallthrough candidates', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'ft-1',
          priority: 1,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 1 } },
        }),
        makeRule({
          id: 'miss',
          priority: 2,
          predicate: { kind: 'method_equals', method: 'NoMatch' },
          response: { statusCode: 0, body: { step: 'miss' } },
        }),
        makeRule({
          id: 'ft-2',
          priority: 3,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 2 } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(result.ruleId).toBe('ft-2');
    expect(result.fallthroughChain).toEqual(['ft-1', 'ft-2']);
    expect(result.response.body).toEqual({ step: 2 });
  });

  it('returns default when every enabled rule is disabled or non-matching', () => {
    const result = evaluateGrpcMockRuleSet(
      {
        rules: [
          makeRule({ id: 'off', enabled: false }),
          makeRule({
            id: 'miss',
            predicate: { kind: 'method_equals', method: 'Other' },
          }),
        ],
      },
      makeContext(),
    );
    expect(result.usedDefault).toBe(true);
    expect(result.matched).toBe(false);
  });

  it('skips disabled fallthrough rules when building the chain', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'ft-1',
          priority: 1,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 1 } },
        }),
        makeRule({
          id: 'ft-disabled',
          priority: 2,
          enabled: false,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 'disabled' } },
        }),
        makeRule({
          id: 'ft-2',
          priority: 3,
          fallthrough: true,
          response: { statusCode: 0, body: { step: 2 } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(result.ruleId).toBe('ft-2');
    expect(result.fallthroughChain).toEqual(['ft-1', 'ft-2']);
  });

  it('returns a single fallthrough-only match as the winning candidate', () => {
    const result = evaluateGrpcMockRuleSet(
      {
        rules: [
          makeRule({
            id: 'only-ft',
            fallthrough: true,
            response: { statusCode: 0, body: { only: true } },
          }),
        ],
      },
      makeContext(),
    );

    expect(result.ruleId).toBe('only-ft');
    expect(result.fallthroughChain).toEqual(['only-ft']);
    expect(result.response.body).toEqual({ only: true });
  });
});

describe('Phase 11D-C - default response path', () => {
  it('returns UNIMPLEMENTED default when no rules match', () => {
    const result = evaluateGrpcMockRuleSet(
      {
        rules: [
          makeRule({
            id: 'no-match',
            predicate: { kind: 'method_equals', method: 'CreateOrder' },
          }),
        ],
      },
      makeContext(),
    );

    expect(result.matched).toBe(false);
    expect(result.usedDefault).toBe(true);
    expect(result.response.statusCode).toBe(GRPC_MOCK_DEFAULT_STATUS_CODE);
    expect(result.response.message).toBe(GRPC_MOCK_DEFAULT_STATUS_MESSAGE);
  });

  it('honors custom defaultResponse when configured', () => {
    const result = evaluateGrpcMockRuleSet(
      {
        rules: [],
        defaultResponse: {
          statusCode: 5,
          message: 'Not found',
          body: { reason: 'missing' },
        },
      },
      makeContext(),
    );

    expect(result.usedDefault).toBe(true);
    expect(result.response.statusCode).toBe(5);
    expect(result.response.message).toBe('Not found');
    expect(result.response.body).toEqual({ reason: 'missing' });
  });

  it('isolates defaultResponse body from later mutation', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'no-match',
          predicate: { kind: 'method_equals', method: 'Other' },
        }),
      ],
      defaultResponse: {
        statusCode: 5,
        message: 'Not found',
        body: { reason: 'missing' },
      },
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    (result.response.body as { reason: string }).reason = 'mutated';

    const again = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(again.response.body).toEqual({ reason: 'missing' });
  });
});

describe('Phase 11D-D - sandboxed predicate parsing and evaluation', () => {
  it('parses and evaluates compound expression from plan example', () => {
    const predicate = parseGrpcMockPredicateExpression(
      'method == "GetOrder" AND request.order_id == "123"',
    );
    expect(predicate.kind).toBe('and');
    expect(evaluateGrpcMockPredicate(predicate, makeContext())).toBe(true);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: { order_id: '999' } }))).toBe(false);
  });

  it('parses dotted request paths as a single identifier token', () => {
    const predicate = parseGrpcMockPredicateExpression('request.order_id == "123"');
    expect(predicate).toEqual({ kind: 'body_path_equals', path: 'order_id', value: '123' });
  });

  it('parses metadata comparisons with dotted keys', () => {
    const predicate = parseGrpcMockPredicateExpression('metadata.x-tenant == "acme"');
    expect(predicate).toEqual({ kind: 'metadata_equals', key: 'x-tenant', value: 'acme' });
    expect(evaluateGrpcMockPredicate(predicate, makeContext())).toBe(true);
  });

  it('supports OR and NOT operators', () => {
    const predicate = parseGrpcMockPredicateExpression(
      'method == "CreateOrder" OR NOT request.status == "OPEN"',
    );
    expect(evaluateGrpcMockPredicate(predicate, makeContext())).toBe(false);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ method: 'CreateOrder' }))).toBe(true);
  });

  it('evaluates expression predicates via sandbox parser', () => {
    const result = evaluateGrpcMockRuleSet(
      {
        rules: [
          makeRule({
            id: 'expr-rule',
            predicate: {
              kind: 'expression',
              expression: 'method == "GetOrder" AND metadata.x-tenant == "acme"',
            },
            response: { statusCode: 0, body: { via: 'expression' } },
          }),
        ],
      },
      makeContext(),
    );
    expect(result.ruleId).toBe('expr-rule');
  });

  it('supports parentheses and not-equal operators in expressions', () => {
    const predicate = parseGrpcMockPredicateExpression('(method == "GetOrder") AND request.status != "CLOSED"');
    expect(evaluateGrpcMockPredicate(predicate, makeContext())).toBe(true);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: { order_id: '123', status: 'CLOSED' } }))).toBe(false);
  });

  it('compares boolean request values using literal true/false', () => {
    const predicate = parseGrpcMockPredicateExpression('request.active == true');
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: { active: true } }))).toBe(true);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: { active: false } }))).toBe(false);
  });

  it('parses bracketed request paths and numeric literals', () => {
    const predicate = parseGrpcMockPredicateExpression('request.items[0].id == "a"');
    expect(evaluateGrpcMockPredicate(predicate, makeContext({
      requestBody: { items: [{ id: 'a' }] },
    }))).toBe(true);
    expect(evaluateGrpcMockPredicate(
      parseGrpcMockPredicateExpression('request.count == 123'),
      makeContext({ requestBody: { count: 123 } }),
    )).toBe(true);
  });

  it('binds AND tighter than OR without parentheses', () => {
    const predicate = parseGrpcMockPredicateExpression('method == "Other" OR method == "GetOrder" AND request.status == "OPEN"');
    expect(evaluateGrpcMockPredicate(predicate, makeContext())).toBe(true);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: { order_id: '123', status: 'CLOSED' } }))).toBe(false);
  });

  it('supports request path existence checks without equality', () => {
    const predicate = parseGrpcMockPredicateExpression('request.order_id AND method == "GetOrder"');
    expect(evaluateGrpcMockPredicate(predicate, makeContext())).toBe(true);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: {} }))).toBe(false);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: null }))).toBe(false);
  });

  it('accepts case-insensitive AND, OR, and NOT operators', () => {
    const predicate = parseGrpcMockPredicateExpression('method == "GetOrder" and not request.status == "CLOSED"');
    expect(evaluateGrpcMockPredicate(predicate, makeContext())).toBe(true);
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: { order_id: '123', status: 'CLOSED' } }))).toBe(false);
  });

  it('compares object request fields via JSON serialization', () => {
    const predicate = parseGrpcMockPredicateExpression('request.nested == "{\\"n\\":1}"');
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ requestBody: { nested: { n: 1 } } }))).toBe(true);
  });
});

describe('Phase 11D-E - security boundary', () => {
  it('rejects eval-based expressions', () => {
    expect(() => parseGrpcMockPredicateExpression('eval("1")')).toThrow(GrpcMockPredicateSecurityError);
  });

  it('rejects Function constructor expressions', () => {
    expect(() => parseGrpcMockPredicateExpression('Function("return 1")()')).toThrow(GrpcMockPredicateSecurityError);
  });

  it('rejects arrow functions and import/require tokens', () => {
    expect(() => parseGrpcMockPredicateExpression('() => 1')).toThrow(GrpcMockPredicateSecurityError);
    expect(() => parseGrpcMockPredicateExpression('import("fs")')).toThrow(GrpcMockPredicateSecurityError);
    expect(() => parseGrpcMockPredicateExpression('require("fs")')).toThrow(GrpcMockPredicateSecurityError);
  });

  it('rejects prototype pollution path segments', () => {
    expect(() => parseGrpcMockPredicateExpression('request.__proto__ == "x"')).toThrow(GrpcMockPredicateSecurityError);
  });

  it('allows reserved words inside string literals while still blocking code execution tokens', () => {
    const predicate = parseGrpcMockPredicateExpression('method == "eval"');
    expect(evaluateGrpcMockPredicate(predicate, makeContext({ method: 'eval' }))).toBe(true);
    expect(() => parseGrpcMockPredicateExpression('eval("1")')).toThrow(GrpcMockPredicateSecurityError);
  });

  it('documents forbidden expression patterns for source-scan traceability', () => {
    expect(GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS.length).toBeGreaterThanOrEqual(8);
  });
});

describe('Phase 11D-F - config validation', () => {
  it('throws GrpcMockRuleValidationError for duplicate rule ids', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({ id: 'dup' }),
        makeRule({ id: 'dup', priority: 200 }),
      ],
    };
    expect(() => assertGrpcMockRuleSet(ruleSet)).toThrow(GrpcMockRuleValidationError);
    const issues = validateGrpcMockRuleSet(ruleSet);
    expect(issues.some((issue) => issue.message.includes('duplicate rule id'))).toBe(true);
  });

  it('rejects invalid priority and missing predicate fields', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        {
          id: 'bad',
          name: 'bad',
          enabled: true,
          priority: 1.5,
          predicate: { kind: 'metadata_equals', key: '', value: 'x' },
          response: { statusCode: 0 },
        },
      ],
    });
    expect(issues.some((issue) => issue.path.endsWith('.priority'))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith('.key'))).toBe(true);
  });

  it('isolates messages[] in exported rule responses from later mutation', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'stream-ish',
          response: { statusCode: 0, messages: [{ seq: 1 }] },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    (result.response.messages as Array<{ seq: number }>)[0]!.seq = 99;

    const again = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(again.response.messages).toEqual([{ seq: 1 }]);
  });

  it('isolates exported rule responses from later mutation', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        makeRule({
          id: 'mutable',
          response: { statusCode: 0, body: { count: 1 } },
        }),
      ],
    };

    const result = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    (result.response.body as { count: number }).count = 99;
    ruleSet.rules[0]!.response.body = { count: 0 };

    const again = evaluateGrpcMockRuleSet(ruleSet, makeContext());
    expect(again.response.body).toEqual({ count: 0 });
  });

  it('validates non-array rules and invalid default status codes', () => {
    expect(validateGrpcMockRuleSet({ rules: null as unknown as GrpcMockRule[] })).toEqual([
      { path: 'rules', message: 'rules must be an array.' },
    ]);
    expect(validateGrpcMockRuleSet({
      rules: [],
      defaultResponse: { statusCode: -1 },
    }).some((issue) => issue.path === 'defaultResponse.statusCode')).toBe(true);
  });

  it('validates nested predicate shapes and invalid response status codes', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        {
          id: 'nested',
          name: '',
          enabled: true,
          priority: 1,
          predicate: {
            kind: 'or',
            predicates: [],
          },
          response: { statusCode: 1.2 },
        },
        {
          id: 'unsupported',
          name: 'unsupported',
          enabled: true,
          priority: 2,
          predicate: { kind: 'unknown' } as unknown as GrpcMockRule['predicate'],
          response: { statusCode: 0 },
        },
      ],
    });
    expect(issues.some((issue) => issue.path.endsWith('.name'))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith('.predicates'))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith('.response.statusCode'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('unsupported predicate kind'))).toBe(true);
  });

  it('exposes default mock response constants', () => {
    const defaults = createDefaultGrpcMockResponse();
    expect(defaults.statusCode).toBe(GRPC_MOCK_DEFAULT_STATUS_CODE);
    expect(defaults.message).toBe(GRPC_MOCK_DEFAULT_STATUS_MESSAGE);
  });

  it('validates atomic predicate required fields', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        {
          id: 'atomic',
          name: 'atomic',
          enabled: true,
          priority: 1,
          predicate: { kind: 'not', predicate: null } as unknown as GrpcMockRule['predicate'],
          response: { statusCode: 0 },
        },
        {
          id: 'atomic-2',
          name: 'atomic-2',
          enabled: true,
          priority: 2,
          predicate: { kind: 'service_equals', service: '' },
          response: { statusCode: 0 },
        },
        {
          id: 'atomic-3',
          name: 'atomic-3',
          enabled: true,
          priority: 3,
          predicate: { kind: 'body_path_exists', path: '' },
          response: { statusCode: 0 },
        },
      ],
    });
    expect(issues.some((issue) => issue.path.endsWith('.predicate'))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith('.service'))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith('.path'))).toBe(true);
  });

  it('validates top-level rule identity and response requirements', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        {
          id: '',
          name: 'no-id',
          enabled: 'yes' as unknown as boolean,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: null as unknown as GrpcMockRule['response'],
        },
      ],
    });
    expect(issues.some((issue) => issue.path.endsWith('.id'))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith('.enabled'))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith('.response'))).toBe(true);
  });

  it('rejects syntactically invalid expression predicates at validation time', () => {
    const issues = validateGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'bad-expr',
          predicate: { kind: 'expression', expression: 'method ==' },
        }),
      ],
    });
    expect(issues.some((issue) => issue.path.endsWith('.expression'))).toBe(true);
    expect(() => assertGrpcMockRuleSet({
      rules: [
        makeRule({
          id: 'bad-expr',
          predicate: { kind: 'expression', expression: 'eval("1")' },
        }),
      ],
    })).toThrow(GrpcMockRuleValidationError);
  });
});

describe('Phase 11D-G - evaluator helpers', () => {
  it('evaluateGrpcMockRules delegates to rule-set evaluation', () => {
    const result = evaluateGrpcMockRules(
      [makeRule({ id: 'helper', response: { statusCode: 0, body: { helper: true } } })],
      makeContext(),
      { statusCode: 7, message: 'fallback' },
    );
    expect(result.ruleId).toBe('helper');
  });

  it('createGrpcMockNoMatchResult returns configured default response', () => {
    const defaults = { statusCode: 3, message: 'invalid', body: { code: 'x' } };
    const result = createGrpcMockNoMatchResult(defaults);
    expect(result.usedDefault).toBe(true);
    expect(result.response.statusCode).toBe(3);
    expect(result.response.message).toBe('invalid');
    (result.response.body as { code: string }).code = 'mutated';
    expect(defaults.body).toEqual({ code: 'x' });
  });
});

describe('Phase 11D-H - source-scan traceability', () => {
  it('contracts module exports validation and default constants', () => {
    const src = readSrc('src/shared/grpc/grpcMockRuleContracts.ts');
    expect(src.includes('validateGrpcMockRuleSet')).toBe(true);
    expect(src.includes('GRPC_MOCK_DEFAULT_STATUS_CODE')).toBe(true);
    expect(src.includes('GrpcMockRuleValidationError')).toBe(true);
  });

  it('sandbox module exports parser and evaluator without eval usage', () => {
    const src = readSrc('src/shared/grpc/grpcMockPredicateSandbox.ts');
    expect(src.includes('parseGrpcMockPredicateExpression')).toBe(true);
    expect(src.includes('evaluateGrpcMockPredicate')).toBe(true);
    expect(src.includes('GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS')).toBe(true);
    expect(src.includes('eval(')).toBe(false);
    expect(src.includes('new Function')).toBe(false);
  });

  it('evaluator core exports ordering and fallthrough evaluation', () => {
    const src = readSrc('src/shared/grpc/grpcMockRuleEvaluatorCore.ts');
    expect(src.includes('sortGrpcMockRules')).toBe(true);
    expect(src.includes('evaluateGrpcMockRuleSet')).toBe(true);
    expect(src.includes('fallthroughChain')).toBe(true);
    expect(src.includes('assertGrpcMockRuleSet')).toBe(true);
  });
});

describe('Phase 11D-I - parse error handling', () => {
  it('throws parse errors for malformed expressions', () => {
    expect(() => parseGrpcMockPredicateExpression('')).toThrow(GrpcMockPredicateParseError);
    expect(() => parseGrpcMockPredicateExpression('method ==')).toThrow(GrpcMockPredicateParseError);
    expect(() => parseGrpcMockPredicateExpression('unknown.field == "x"')).toThrow(GrpcMockPredicateParseError);
    expect(() => parseGrpcMockPredicateExpression('"unterminated')).toThrow(GrpcMockPredicateParseError);
    expect(() => parseGrpcMockPredicateExpression('@invalid')).toThrow(GrpcMockPredicateParseError);
  });

  it('returns false for unknown structured predicate kinds at evaluation time', () => {
    expect(evaluateGrpcMockPredicate(
      { kind: 'unsupported' } as unknown as GrpcMockRule['predicate'],
      makeContext(),
    )).toBe(false);
  });
});
