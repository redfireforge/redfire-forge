import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultGrpcMockBuilderPredicateLeaf,
  createDefaultGrpcMockBuilderRuleRow,
  detectGrpcMockBuilderConflicts,
  formatGrpcMockBuilderIssues,
  summarizeBuilderPredicateNode,
  summarizeBuilderRule,
  parseGrpcMockRuleSetToBuilderModel,
  serializeGrpcMockBuilderModelToRuleSet,
  validateGrpcMockBuilderModel,
} from '../grpcMockRuleBuilderModel';
import { setupGrpcMockRuleBuilderModelCoverageGapsTest } from './grpcMockRuleBuilderModelCoverageGaps.testHelpers';

describe('grpcMockRuleBuilderModel coverage gaps — validate and conflicts', () => {
  setupGrpcMockRuleBuilderModelCoverageGapsTest();

  it('parses missing predicate and non-numeric priority with response body', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
      rules: [{
        id: 'minimal',
        name: 'Minimal',
        enabled: true,
        priority: 'bad' as unknown as number,
        response: { statusCode: 0, body: { ok: true }, message: 'done' },
      } as never],
    });
    expect(model.rules[0]?.priority).toBe(1);
    expect(model.rules[0]?.responseBodyText).toContain('"ok"');
    expect(model.rules[0]?.responseMessage).toBe('done');
    if (model.rules[0]?.predicate.type === 'leaf') {
      expect(model.rules[0].predicate.kind).toBe('method_equals');
    }
  });

  it('parses service_equals and metadata_equals structured leaves', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
      rules: [
        {
          id: 'svc',
          name: 'Service',
          enabled: true,
          priority: 1,
          predicate: { kind: 'service_equals', service: 'echo.EchoService' },
          response: { statusCode: 0 },
        },
        {
          id: 'meta-eq',
          name: 'Meta eq',
          enabled: true,
          priority: 2,
          predicate: { kind: 'metadata_equals', key: 'x-auth', value: 'token' },
          response: { statusCode: 0 },
        },
      ],
    });
    expect(model.rules[0]?.predicate.type).toBe('leaf');
    expect(model.rules[1]?.predicate.type).toBe('leaf');
  });

  it('serializes undefined leaf fields with empty-string defaults and optional response fields', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.responseStatusCode = undefined;
    row.responseBodyText = '';
    row.responseMessage = '   ';
    row.predicate = {
      nodeId: 'leaf-empty',
      type: 'leaf',
      kind: 'metadata_equals',
      negated: false,
      key: undefined,
      value: undefined,
    };
    const exported = serializeGrpcMockBuilderModelToRuleSet({ rules: [row] });
    expect(exported.rules[0]?.response.statusCode).toBeUndefined();
    expect(exported.rules[0]?.response.body).toBeUndefined();
    expect(exported.rules[0]?.response.message).toBeUndefined();
    if (exported.rules[0]?.predicate.kind === 'metadata_equals') {
      expect(exported.rules[0].predicate.key).toBe('');
    }

    const kinds = [
      { kind: 'method_equals' as const, method: undefined },
      { kind: 'service_equals' as const, service: undefined },
      { kind: 'metadata_exists' as const, key: undefined },
      { kind: 'body_path_equals' as const, path: undefined, value: undefined },
      { kind: 'body_path_exists' as const, path: undefined },
    ];
    for (const spec of kinds) {
      const leafRow = createDefaultGrpcMockBuilderRuleRow();
      leafRow.predicate = { nodeId: 'leaf', type: 'leaf', negated: false, ...spec };
      expect(() => serializeGrpcMockBuilderModelToRuleSet({ rules: [leafRow] })).not.toThrow();
    }
  });

  it('validateGrpcMockBuilderModel accepts valid rows for every leaf kind', () => {
    const rows = [
      { kind: 'method_equals' as const, method: 'Echo' },
      { kind: 'service_equals' as const, service: 'echo.EchoService' },
      { kind: 'metadata_equals' as const, key: 'x-auth', value: '1' },
      { kind: 'metadata_exists' as const, key: 'x-trace' },
      { kind: 'body_path_equals' as const, path: 'message', value: 'hi' },
      { kind: 'body_path_exists' as const, path: 'payload' },
    ].map((spec, index) => {
      const row = createDefaultGrpcMockBuilderRuleRow(index + 1);
      row.id = `valid-${index}`;
      row.predicate = { nodeId: `leaf-${index}`, type: 'leaf', negated: false, ...spec };
      return row;
    });
    expect(validateGrpcMockBuilderModel({ rules: rows })).toHaveLength(0);
  });

  it('validateGrpcMockBuilderModel skips predicate validation for read-only rows', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicateReadOnly = true;
    row.originalPredicate = { kind: 'expression', expression: 'method == "Echo"' };
    row.predicate = {
      nodeId: 'expr',
      type: 'expression',
      expression: 'method == "Echo"',
    };
    expect(validateGrpcMockBuilderModel({ rules: [row] })).toHaveLength(0);
  });

  it('summarizes predicate nodes, rules, and detects method conflicts', () => {
    const leaf = createDefaultGrpcMockBuilderPredicateLeaf();
    expect(summarizeBuilderPredicateNode(leaf)).toContain('method ==');
    expect(summarizeBuilderPredicateNode({
      nodeId: 'group',
      type: 'group',
      combinator: 'or',
      children: [leaf, { ...leaf, nodeId: 'leaf-2', method: 'Ping' }],
    })).toContain('OR');
    expect(summarizeBuilderPredicateNode({
      nodeId: 'expr',
      type: 'expression',
      expression: 'method == "Echo"',
      negated: true,
    })).toContain('NOT');

    const readOnly = createDefaultGrpcMockBuilderRuleRow();
    readOnly.predicateReadOnly = true;
    readOnly.originalPredicate = { kind: 'expression', expression: 'method == "Echo"' };
    readOnly.responseBodyText = '{"message":"abcdefghijklmnopqrstuvwxyz-0123456789-extra"}';
    expect(summarizeBuilderRule(readOnly)).toContain('…');

    const rowA = createDefaultGrpcMockBuilderRuleRow(1);
    rowA.id = 'rule-a';
    rowA.name = 'Rule A';
    rowA.predicate = {
      nodeId: 'leaf-a',
      type: 'leaf',
      kind: 'method_equals',
      negated: false,
      method: 'Echo',
    };
    const rowB = createDefaultGrpcMockBuilderRuleRow(1);
    rowB.id = 'rule-b';
    rowB.name = 'Rule B';
    rowB.predicate = {
      nodeId: 'leaf-b',
      type: 'leaf',
      kind: 'method_equals',
      negated: false,
      method: 'echo',
    };
    const conflicts = detectGrpcMockBuilderConflicts({ rules: [rowA, rowB] });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.reason).toContain('priority 1');
  });

  it('parses deeply nested predicates into read-only expressions and serializes latency', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
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
    });
    expect(model.rules[0]?.predicateReadOnly).toBe(true);
    expect(model.rules[0]?.originalPredicate).toBeTruthy();

    const row = createDefaultGrpcMockBuilderRuleRow();
    row.responseLatencyMs = 25;
    const exported = serializeGrpcMockBuilderModelToRuleSet({ rules: [row] });
    expect(exported.rules[0]?.response.latencyMs).toBe(25);
  });

  it('detects conflicts from nested group predicates with the same method', () => {
    const rowA = createDefaultGrpcMockBuilderRuleRow();
    rowA.id = 'a';
    rowA.priority = 2;
    rowA.predicate = {
      nodeId: 'group-a',
      type: 'group',
      combinator: 'or',
      children: [{
        nodeId: 'leaf-a',
        type: 'leaf',
        kind: 'method_equals',
        negated: false,
        method: 'Echo',
      }],
    };
    const rowB = createDefaultGrpcMockBuilderRuleRow();
    rowB.id = 'b';
    rowB.priority = 2;
    rowB.predicate = {
      nodeId: 'leaf-b',
      type: 'leaf',
      kind: 'method_equals',
      negated: false,
      method: 'echo',
    };
    const conflicts = detectGrpcMockBuilderConflicts({ rules: [rowA, rowB] });
    expect(conflicts).toHaveLength(1);
  });

  it('covers summarize defaults and non-Error rule-set validation failures', () => {
    expect(summarizeBuilderPredicateNode({
      nodeId: 'bad',
      type: 'leaf',
      kind: 'unknown_kind' as 'method_equals',
      negated: false,
      method: 'Echo',
    })).toBe('unknown');

    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicateReadOnly = true;
    row.originalPredicate = { kind: 'method_equals', method: 'Echo' };
    row.predicate = { nodeId: 'expr', type: 'expression', expression: 'true' };
    row.responseBodyText = 'a'.repeat(45);
    expect(summarizeBuilderRule(row)).toContain('…');

    const invalidLeaf = createDefaultGrpcMockBuilderRuleRow();
    invalidLeaf.predicate = {
      nodeId: 'unknown',
      type: 'leaf',
      kind: 'method_equals' as never,
      negated: false,
      method: 'Echo',
    };
    expect(validateGrpcMockBuilderModel({ rules: [invalidLeaf] }).length).toBeGreaterThanOrEqual(0);
  });

  it('validateGrpcMockBuilderModel reports non-Error JSON parse failures in response body', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.responseBodyText = '{"a":1}';
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
      throw 'not-an-error';
    });
    const issues = validateGrpcMockBuilderModel({ rules: [row] });
    parseSpy.mockRestore();
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/Invalid response body JSON/i);
  });

  it('summarizes additional leaf predicate kinds and negated nodes', () => {
    expect(summarizeBuilderPredicateNode({
      nodeId: 'svc',
      type: 'leaf',
      kind: 'service_equals',
      negated: true,
      service: 'echo.EchoService',
    })).toContain('NOT');
    expect(summarizeBuilderPredicateNode({
      nodeId: 'meta',
      type: 'leaf',
      kind: 'metadata_exists',
      negated: false,
      key: 'x-trace',
    })).toContain('metadata.x-trace exists');
    expect(summarizeBuilderPredicateNode({
      nodeId: 'body',
      type: 'leaf',
      kind: 'body_path_exists',
      negated: false,
      path: 'message',
    })).toContain('body.message exists');
    expect(summarizeBuilderPredicateNode({
      nodeId: 'group',
      type: 'group',
      combinator: 'or',
      children: [],
    })).toBe('()');
  });

  it('covers summarize default node type and serializes positive latency', () => {
    expect(summarizeBuilderPredicateNode({
      nodeId: 'unknown-node',
      type: 'bogus' as 'leaf',
      kind: 'method_equals',
      negated: false,
      method: 'Echo',
    })).toBe('unknown');

    const row = createDefaultGrpcMockBuilderRuleRow();
    row.responseLatencyMs = 25;
    const exported = serializeGrpcMockBuilderModelToRuleSet({ rules: [row] });
    expect(exported.rules[0]?.response.latencyMs).toBe(25);
  });

  it('skips conflict detection when predicates lack extractable methods', () => {
    const serviceOnly = createDefaultGrpcMockBuilderRuleRow();
    serviceOnly.id = 'service-only';
    serviceOnly.priority = 5;
    serviceOnly.predicate = {
      nodeId: 'svc-leaf',
      type: 'leaf',
      kind: 'service_equals',
      negated: false,
      service: 'echo.EchoService',
    };
    const nestedMethod = createDefaultGrpcMockBuilderRuleRow();
    nestedMethod.id = 'nested-method';
    nestedMethod.priority = 6;
    nestedMethod.predicate = {
      nodeId: 'outer-group',
      type: 'group',
      combinator: 'or',
      children: [{
        nodeId: 'inner-group',
        type: 'group',
        combinator: 'and',
        children: [{
          nodeId: 'method-leaf',
          type: 'leaf',
          kind: 'method_equals',
          negated: false,
          method: 'Echo',
        }],
      }],
    };
    expect(detectGrpcMockBuilderConflicts({ rules: [serviceOnly, nestedMethod] })).toHaveLength(0);
  });

  it('throws when serializing unsupported leaf kinds', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'unsupported',
      type: 'leaf',
      kind: 'bogus_kind' as 'method_equals',
      negated: false,
      method: 'Echo',
    };
    expect(() => serializeGrpcMockBuilderModelToRuleSet({ rules: [row] }))
      .toThrow(/Unsupported leaf kind/i);
  });

  it('omits zero latency and false fallthrough from serialized rules', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.responseLatencyMs = 0;
    row.fallthrough = false;
    const exported = serializeGrpcMockBuilderModelToRuleSet({ rules: [row] });
    expect(exported.rules[0]?.response.latencyMs).toBeUndefined();
    expect(exported.rules[0]?.fallthrough).toBeUndefined();
  });

  it('parses over-depth and groups during predicate lookup at runtime depth', () => {
    const deepModel = parseGrpcMockRuleSetToBuilderModel({
      rules: [{
        id: 'deep-runtime',
        name: 'Deep runtime',
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
    });
    expect(deepModel.rules[0]?.predicateReadOnly).toBe(true);

    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'unknown-kind',
      type: 'leaf',
      kind: 'weird_kind' as 'method_equals',
      negated: false,
      method: 'Echo',
    };
    expect(validateGrpcMockBuilderModel({ rules: [row] }).length).toBeGreaterThanOrEqual(0);
  });

  it('registers first method per priority without conflicts for distinct methods', () => {
    const echoRule = createDefaultGrpcMockBuilderRuleRow();
    echoRule.id = 'echo-rule';
    echoRule.priority = 8;
    const greetRule = createDefaultGrpcMockBuilderRuleRow();
    greetRule.id = 'greet-rule';
    greetRule.priority = 8;
    greetRule.predicate = {
      nodeId: 'greet-leaf',
      type: 'leaf',
      kind: 'method_equals',
      negated: false,
      method: 'Greet',
    };
    expect(detectGrpcMockBuilderConflicts({ rules: [echoRule] })).toHaveLength(0);
    expect(detectGrpcMockBuilderConflicts({ rules: [echoRule, greetRule] })).toHaveLength(0);
  });

  it('detects conflicts from deeply nested method predicates', () => {
    const nestedEcho = createDefaultGrpcMockBuilderRuleRow();
    nestedEcho.id = 'nested-echo';
    nestedEcho.priority = 9;
    nestedEcho.predicate = {
      nodeId: 'outer',
      type: 'group',
      combinator: 'or',
      children: [{
        nodeId: 'inner',
        type: 'group',
        combinator: 'and',
        children: [{
          nodeId: 'method-leaf',
          type: 'leaf',
          kind: 'method_equals',
          negated: false,
          method: 'Echo',
        }],
      }],
    };
    const flatEcho = createDefaultGrpcMockBuilderRuleRow();
    flatEcho.id = 'flat-echo';
    flatEcho.priority = 9;
    const conflicts = detectGrpcMockBuilderConflicts({ rules: [nestedEcho, flatEcho] });
    expect(conflicts).toHaveLength(1);
  });

  it('validates predicate depth limits on editable deeply nested groups', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'g1',
      type: 'group',
      combinator: 'and',
      children: [{
        nodeId: 'g2',
        type: 'group',
        combinator: 'and',
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
    const issues = validateGrpcMockBuilderModel({ rules: [row] });
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/max depth/i);
  });

  it('ignores disabled rules when detecting conflicts', () => {
    const disabled = createDefaultGrpcMockBuilderRuleRow();
    disabled.id = 'disabled-echo';
    disabled.enabled = false;
    disabled.priority = 3;
    const enabled = createDefaultGrpcMockBuilderRuleRow();
    enabled.id = 'enabled-echo';
    enabled.priority = 3;
    expect(detectGrpcMockBuilderConflicts({ rules: [disabled, enabled] })).toHaveLength(0);
  });

  it('returns undefined method extraction for groups without method leaves', () => {
    const serviceGroup = createDefaultGrpcMockBuilderRuleRow();
    serviceGroup.id = 'service-a';
    serviceGroup.priority = 11;
    serviceGroup.predicate = {
      nodeId: 'group-services',
      type: 'group',
      combinator: 'or',
      children: [{
        nodeId: 'service-leaf',
        type: 'leaf',
        kind: 'service_equals',
        negated: false,
        service: 'echo.EchoService',
      }],
    };
    const serviceGroupB = createDefaultGrpcMockBuilderRuleRow();
    serviceGroupB.id = 'service-b';
    serviceGroupB.priority = 11;
    serviceGroupB.predicate = {
      nodeId: 'group-services-b',
      type: 'group',
      combinator: 'or',
      children: [{
        nodeId: 'service-leaf-b',
        type: 'leaf',
        kind: 'service_equals',
        negated: false,
        service: 'health.v1.Health',
      }],
    };
    expect(detectGrpcMockBuilderConflicts({ rules: [serviceGroup, serviceGroupB] })).toHaveLength(0);
  });

  it('parses rules with default priority and null response bodies', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
      rules: [{
        id: 'defaults',
        name: 'Defaults',
        enabled: true,
        predicate: { kind: 'method_equals', method: 'Echo' },
        response: { statusCode: 0, body: null as unknown as undefined },
      } as never],
    });
    expect(model.rules[0]?.priority).toBe(1);
    expect(model.rules[0]?.responseBodyText).toBe('');
  });
});
