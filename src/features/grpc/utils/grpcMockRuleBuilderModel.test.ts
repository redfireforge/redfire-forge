import { describe, expect, it, beforeEach } from 'vitest';
import type { GrpcMockRuleSet } from '@shared/grpc/grpcMockRuleContracts';
import {
  createDefaultGrpcMockBuilderRuleRow,
  formatGrpcMockBuilderIssues,
  measureGrpcMockBuilderPredicateDepth,
  parseGrpcMockRuleSetToBuilderModel,
  resetGrpcMockBuilderNodeIdsForTests,
  scanGrpcMockBuilderValueForForbiddenTokens,
  serializeGrpcMockBuilderModelToRuleSet,
  serializeGrpcMockBuilderModelToStableJson,
  serializeGrpcMockRuleSetToStableJson,
  validateGrpcMockBuilderModel,
} from './grpcMockRuleBuilderModel';

function structuredRuleSet(): GrpcMockRuleSet {
  return {
    rules: [
      {
        id: 'rule-echo',
        name: 'Echo ok',
        enabled: true,
        priority: 2,
        predicate: {
          kind: 'and',
          predicates: [
            { kind: 'method_equals', method: 'Echo' },
            { kind: 'not', predicate: { kind: 'metadata_exists', key: 'x-debug' } },
          ],
        },
        response: { statusCode: 0, body: { message: 'ok' } },
      },
      {
        id: 'rule-b',
        name: 'Second',
        enabled: true,
        priority: 1,
        fallthrough: true,
        predicate: { kind: 'service_equals', service: 'echo.EchoService' },
        response: { statusCode: 0, body: {} },
      },
    ],
  };
}

describe('grpcMockRuleBuilderModel', () => {
  beforeEach(() => {
    resetGrpcMockBuilderNodeIdsForTests();
  });

  it('round-trips structured predicates through stable JSON', () => {
    const source = structuredRuleSet();
    const model = parseGrpcMockRuleSetToBuilderModel(source);
    const json = serializeGrpcMockBuilderModelToStableJson(model);
    const reparsed = parseGrpcMockRuleSetToBuilderModel(JSON.parse(json) as GrpcMockRuleSet);
    const jsonAgain = serializeGrpcMockBuilderModelToStableJson(reparsed);
    expect(jsonAgain).toBe(json);
    expect(reparsed.rules).toHaveLength(2);
    const echoRule = reparsed.rules.find((rule) => rule.id === 'rule-echo');
    const secondRule = reparsed.rules.find((rule) => rule.id === 'rule-b');
    expect(echoRule?.predicateReadOnly).toBe(false);
    expect(echoRule?.fallthrough).toBe(false);
    expect(secondRule?.fallthrough).toBe(true);
  });

  it('marks expression predicates as read-only and preserves originalPredicate', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [{
        id: 'expr-1',
        name: 'Expr',
        enabled: true,
        priority: 1,
        predicate: { kind: 'expression', expression: 'method == "Echo"' },
        response: { statusCode: 0 },
      }],
    };
    const model = parseGrpcMockRuleSetToBuilderModel(ruleSet);
    expect(model.rules[0].predicateReadOnly).toBe(true);
    expect(model.rules[0].originalPredicate).toEqual(ruleSet.rules[0].predicate);
    const exported = serializeGrpcMockBuilderModelToRuleSet(model);
    expect(exported.rules[0].predicate).toEqual(ruleSet.rules[0].predicate);
  });

  it('marks deep predicate trees as read-only', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [{
        id: 'deep',
        name: 'Deep',
        enabled: true,
        priority: 1,
        predicate: {
          kind: 'and',
          predicates: [{
            kind: 'and',
            predicates: [{
              kind: 'and',
              predicates: [{ kind: 'method_equals', method: 'Echo' }],
            }],
          }],
        },
        response: { statusCode: 0 },
      }],
    };
    const model = parseGrpcMockRuleSetToBuilderModel(ruleSet);
    expect(model.rules[0].predicateReadOnly).toBe(true);
    expect(model.rules[0].predicate.type === 'expression' || model.rules[0].predicate.type === 'group').toBe(true);
  });

  it('rejects forbidden tokens in builder leaf values', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'leaf-1',
      type: 'leaf',
      kind: 'metadata_equals',
      negated: false,
      key: 'authorization',
      value: 'eval("x")',
    };
    const issues = validateGrpcMockBuilderModel({ rules: [row] });
    expect(issues.some((issue) => issue.message.includes('Forbidden pattern'))).toBe(true);
    expect(scanGrpcMockBuilderValueForForbiddenTokens('eval("x")')).toBeTruthy();
    expect(scanGrpcMockBuilderValueForForbiddenTokens('method == "eval"')).toBeUndefined();
  });

  it('blocks predicate nesting deeper than max depth in editable model', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'g1',
      type: 'group',
      combinator: 'and',
      children: [{
        nodeId: 'g2',
        type: 'group',
        combinator: 'or',
        children: [{
          nodeId: 'g3',
          type: 'group',
          combinator: 'and',
          children: [{
            nodeId: 'leaf',
            type: 'leaf',
            kind: 'method_equals',
            negated: false,
            method: 'Echo',
          }],
        }],
      }],
    };
    expect(measureGrpcMockBuilderPredicateDepth(row.predicate)).toBe(3);
    const issues = validateGrpcMockBuilderModel({ rules: [row] });
    expect(formatGrpcMockBuilderIssues(issues)).toContain('max depth');
  });

  it('preserves stable predicate node ids across serialize and re-parse', () => {
    const source = structuredRuleSet();
    const first = parseGrpcMockRuleSetToBuilderModel(source);
    const echoRule = first.rules.find((rule) => rule.id === 'rule-echo');
    expect(echoRule?.predicate.nodeId).toBe('pred:rule-echo:root');
    if (echoRule?.predicate.type === 'group') {
      expect(echoRule.predicate.children[0]?.nodeId).toBe('pred:rule-echo:root.0');
      expect(echoRule.predicate.children[1]?.nodeId).toBe('pred:rule-echo:root.1');
    }

    const second = parseGrpcMockRuleSetToBuilderModel(
      JSON.parse(serializeGrpcMockBuilderModelToStableJson(first)) as GrpcMockRuleSet,
    );
    const echoAgain = second.rules.find((rule) => rule.id === 'rule-echo');
    expect(echoAgain?.predicate.nodeId).toBe(echoRule?.predicate.nodeId);
    if (echoAgain?.predicate.type === 'group' && echoRule?.predicate.type === 'group') {
      expect(echoAgain.predicate.children.map((child) => child.nodeId))
        .toEqual(echoRule.predicate.children.map((child) => child.nodeId));
    }
  });

  it('marks imported group nesting beyond max depth as read-only', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [{
        id: 'nested',
        name: 'Nested',
        enabled: true,
        priority: 1,
        predicate: {
          kind: 'and',
          predicates: [{
            kind: 'and',
            predicates: [{
              kind: 'and',
              predicates: [{ kind: 'method_equals', method: 'Echo' }],
            }],
          }],
        },
        response: { statusCode: 0 },
      }],
    };
    const model = parseGrpcMockRuleSetToBuilderModel(ruleSet);
    expect(model.rules[0].predicateReadOnly).toBe(true);
    expect(model.rules[0].originalPredicate).toEqual(ruleSet.rules[0].predicate);
    if (model.rules[0].predicate.type === 'group') {
      const nested = model.rules[0].predicate.children[0];
      expect(nested?.type === 'group' || nested?.type === 'expression').toBe(true);
    }
  });

  it('allows root group with one nested group and leaf', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [{
        id: 'nested-ok',
        name: 'Nested ok',
        enabled: true,
        priority: 1,
        predicate: {
          kind: 'and',
          predicates: [{
            kind: 'and',
            predicates: [{ kind: 'method_equals', method: 'Echo' }],
          }],
        },
        response: { statusCode: 0 },
      }],
    };
    const model = parseGrpcMockRuleSetToBuilderModel(ruleSet);
    expect(model.rules[0].predicateReadOnly).toBe(false);
    expect(model.rules[0].predicate.type).toBe('group');
    expect(measureGrpcMockBuilderPredicateDepth(model.rules[0].predicate)).toBe(2);
    expect(validateGrpcMockBuilderModel(model)).toHaveLength(0);
    const json = serializeGrpcMockBuilderModelToStableJson(model);
    const reparsed = parseGrpcMockRuleSetToBuilderModel(JSON.parse(json) as GrpcMockRuleSet);
    expect(reparsed.rules[0].predicateReadOnly).toBe(false);
  });

  it('allows flat group of leaves at max measured depth', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.id = 'rule-group';
    row.name = 'Grouped';
    row.predicate = {
      nodeId: 'pred:rule-group:root',
      type: 'group',
      combinator: 'and',
      children: [
        {
          nodeId: 'pred:rule-group:root.0',
          type: 'leaf',
          kind: 'method_equals',
          negated: false,
          method: 'Echo',
        },
        {
          nodeId: 'pred:rule-group:root.1',
          type: 'leaf',
          kind: 'service_equals',
          negated: false,
          service: 'echo.EchoService',
        },
      ],
    };
    expect(measureGrpcMockBuilderPredicateDepth(row.predicate)).toBe(1);
    expect(validateGrpcMockBuilderModel({ rules: [row] })).toHaveLength(0);
  });

  it('skips malformed lenient rules without throwing', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
      rules: [
        null as unknown as GrpcMockRule,
        { id: 'ok', name: 'Ok', enabled: true, priority: 1, predicate: { kind: 'method_equals', method: 'Echo' }, response: { statusCode: 0 } },
      ],
    });
    expect(model.rules).toHaveLength(1);
    expect(model.rules[0].id).toBe('ok');
  });

  it('sorts rules by priority then id in stable JSON export', () => {
    const json = serializeGrpcMockRuleSetToStableJson(structuredRuleSet());
    const parsed = JSON.parse(json) as GrpcMockRuleSet;
    expect(parsed.rules.map((rule) => rule.id)).toEqual(['rule-b', 'rule-echo']);
  });
});
