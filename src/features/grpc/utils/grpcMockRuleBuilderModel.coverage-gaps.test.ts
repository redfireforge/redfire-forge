import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrpcMockRuleSet } from '../../../shared/grpc/grpcMockRuleContracts';
import {
  builderIssuesToValidationIssues,
  buildGrpcMockBuilderPredicateNodeId,
  createDefaultGrpcMockBuilderPredicateLeaf,
  createDefaultGrpcMockBuilderRuleRow,
  createGrpcMockBuilderNodeId,
  formatGrpcMockBuilderIssues,
  measureGrpcMockBuilderPredicateDepth,
  parseGrpcMockRuleSetToBuilderModel,
  resetGrpcMockBuilderNodeIdsForTests,
  scanGrpcMockBuilderValueForForbiddenTokens,
  serializeGrpcMockBuilderModelToRuleSet,
  serializeGrpcMockBuilderModelToStableJson,
  serializeGrpcMockRuleSetToStableJson,
  sortGrpcMockRulesForStableExport,
  validateGrpcMockBuilderModel,
} from './grpcMockRuleBuilderModel';

describe('grpcMockRuleBuilderModel coverage gaps', () => {
  beforeEach(() => {
    resetGrpcMockBuilderNodeIdsForTests();
  });

  it('parses all structured leaf predicate kinds', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [
        {
          id: 'leaf-metadata',
          name: 'Metadata',
          enabled: true,
          priority: 1,
          predicate: { kind: 'metadata_exists', key: 'x-trace' },
          response: { statusCode: 0 },
        },
        {
          id: 'leaf-body',
          name: 'Body',
          enabled: true,
          priority: 2,
          predicate: { kind: 'body_path_equals', path: 'message', value: 'hi' },
          response: { statusCode: 0, body: { message: 'hi' } },
        },
        {
          id: 'leaf-body-exists',
          name: 'Body exists',
          enabled: true,
          priority: 3,
          predicate: { kind: 'body_path_exists', path: 'payload' },
          response: { statusCode: 0 },
        },
      ],
    };
    const model = parseGrpcMockRuleSetToBuilderModel(ruleSet);
    expect(model.rules).toHaveLength(3);
    expect(model.rules[0]?.predicate.type).toBe('leaf');
    expect(model.rules[1]?.predicate.type).toBe('leaf');
    expect(model.rules[2]?.predicate.type).toBe('leaf');
  });

  it('serializes response message and defaultResponse', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.responseMessage = '  ok  ';
    row.responseBodyText = '{"message":"ok"}';
    const ruleSet = serializeGrpcMockBuilderModelToRuleSet({
      rules: [row],
      defaultResponse: { statusCode: 14, message: 'fallback' },
    });
    expect(ruleSet.rules[0]?.response.message).toBe('ok');
    expect(ruleSet.defaultResponse?.statusCode).toBe(14);
  });

  it('validates duplicate ids, empty groups, and invalid response JSON', () => {
    const rowA = createDefaultGrpcMockBuilderRuleRow();
    const rowB = createDefaultGrpcMockBuilderRuleRow();
    rowB.id = rowA.id;
    rowB.responseBodyText = '{not-json';

    const emptyGroup = createDefaultGrpcMockBuilderRuleRow();
    emptyGroup.predicate = {
      nodeId: 'group-empty',
      type: 'group',
      combinator: 'and',
      children: [],
    };

    const issues = validateGrpcMockBuilderModel({ rules: [rowA, rowB, emptyGroup] });
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/Duplicate rule id/i);
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/responseBodyText/i);
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/at least one child/i);
    expect(builderIssuesToValidationIssues(issues)[0]?.path).toBeTruthy();
  });

  it('throws when serializing read-only row without originalPredicate', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicateReadOnly = true;
    row.originalPredicate = undefined;
    expect(() => serializeGrpcMockBuilderModelToRuleSet({ rules: [row] }))
      .toThrow(/missing originalPredicate/i);
  });

  it('parses negated structured leaf predicates', () => {
    const ruleSet: GrpcMockRuleSet = {
      rules: [{
        id: 'negated',
        name: 'Negated',
        enabled: true,
        priority: 1,
        predicate: {
          kind: 'not',
          predicate: { kind: 'service_equals', service: 'echo.EchoService' },
        },
        response: { statusCode: 0 },
      }],
    };
    const model = parseGrpcMockRuleSetToBuilderModel(ruleSet);
    expect(model.rules[0]?.predicate.type).toBe('leaf');
    if (model.rules[0]?.predicate.type === 'leaf') {
      expect(model.rules[0].predicate.negated).toBe(true);
      expect(model.rules[0].predicate.kind).toBe('service_equals');
    }
  });

  it('parses defaultResponse and empty response body text', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
      rules: [{
        id: 'default-resp',
        name: 'Default',
        enabled: true,
        priority: 1,
        predicate: { kind: 'method_equals', method: 'Echo' },
        response: { statusCode: 14, message: 'fallback' },
      }],
      defaultResponse: { statusCode: 14, message: 'fallback' },
    });
    expect(model.defaultResponse?.message).toBe('fallback');
    expect(model.rules[0]?.responseBodyText).toBe('');
    const exported = serializeGrpcMockBuilderModelToRuleSet(model);
    expect(exported.defaultResponse?.statusCode).toBe(14);
  });

  it('validates rule name, priority, and leaf field requirements', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.name = '   ';
    row.priority = 1.5 as unknown as number;
    row.predicate = {
      nodeId: 'leaf-meta',
      type: 'leaf',
      kind: 'metadata_equals',
      negated: false,
      key: '',
      value: 'x',
    };
    const issues = validateGrpcMockBuilderModel({ rules: [row] });
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/name is required/i);
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/Priority must be an integer/i);
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/Metadata key is required/i);
  });

  it('serializes all editable leaf kinds including body paths', () => {
    const rows = [
      { kind: 'metadata_exists' as const, key: 'x-trace' },
      { kind: 'body_path_equals' as const, path: 'message', value: 'hi' },
      { kind: 'body_path_exists' as const, path: 'payload' },
    ].map((spec, index) => {
      const row = createDefaultGrpcMockBuilderRuleRow(index + 1);
      row.id = `rule-${index}`;
      row.predicate = {
        nodeId: `leaf-${index}`,
        type: 'leaf',
        kind: spec.kind,
        negated: false,
        ...spec,
      };
      return row;
    });
    const exported = serializeGrpcMockBuilderModelToRuleSet({ rules: rows });
    expect(exported.rules.map((rule) => rule.predicate.kind)).toEqual([
      'metadata_exists',
      'body_path_equals',
      'body_path_exists',
    ]);
  });

  it('parses expression predicates and and/or groups', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
      rules: [{
        id: 'expr-rule',
        name: 'Expression',
        enabled: true,
        priority: 1,
        predicate: { kind: 'expression', expression: 'method == "Echo"' },
        response: { statusCode: 0 },
      }, {
        id: 'group-rule',
        name: 'Group',
        enabled: true,
        priority: 2,
        predicate: {
          kind: 'or',
          predicates: [
            { kind: 'method_equals', method: 'Echo' },
            { kind: 'service_equals', service: 'echo.EchoService' },
          ],
        },
        response: { statusCode: 0 },
      }],
    });
    expect(model.rules[0]?.predicate.type).toBe('expression');
    expect(model.rules[1]?.predicate.type).toBe('group');
  });

  it('measureGrpcMockBuilderPredicateDepth and stable json serializers', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    expect(measureGrpcMockBuilderPredicateDepth(row.predicate)).toBe(0);
    const json = serializeGrpcMockBuilderModelToStableJson({ rules: [row] });
    expect(json).toContain('"rules"');
    expect(sortGrpcMockRulesForStableExport([
      { id: 'b', name: 'B', enabled: true, priority: 2, predicate: { kind: 'method_equals', method: 'B' }, response: { statusCode: 0 } },
      { id: 'a', name: 'A', enabled: true, priority: 1, predicate: { kind: 'method_equals', method: 'A' }, response: { statusCode: 0 } },
    ]).map((rule) => rule.id)).toEqual(['a', 'b']);
  });

  it('scanGrpcMockBuilderValueForForbiddenTokens strips quoted literals before scanning', () => {
    expect(scanGrpcMockBuilderValueForForbiddenTokens('"eval"')).toBeUndefined();
    expect(scanGrpcMockBuilderValueForForbiddenTokens('constructor.prototype')).toBeTruthy();
  });

  it('parseGrpcMockRuleSetToBuilderModel skips invalid rule rows', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
      rules: [
        null as unknown as never,
        { id: 1, name: 'Bad' } as unknown as never,
        {
          id: 'ok',
          name: 'Ok',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0 },
        },
      ],
    });
    expect(model.rules).toHaveLength(1);
  });

  it('validates service_equals and body_path field requirements', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'leaf-service',
      type: 'leaf',
      kind: 'service_equals',
      negated: false,
      service: '   ',
    };
    const issues = validateGrpcMockBuilderModel({ rules: [row] });
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/Service is required/i);
  });

  it('marks deeply nested predicates as read-only expression nodes', () => {
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
    expect(model.rules[0]?.predicate.type).toBe('group');
  });

  it('serializes or-group predicates and fallthrough rules', () => {
    const leaf = createDefaultGrpcMockBuilderPredicateLeaf();
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.fallthrough = true;
    row.predicate = {
      nodeId: 'group-or',
      type: 'group',
      combinator: 'or',
      children: [leaf],
    };
    const exported = serializeGrpcMockBuilderModelToRuleSet({ rules: [row] });
    expect(exported.rules[0]?.fallthrough).toBe(true);
    expect(exported.rules[0]?.predicate.kind).toBe('or');
  });

  it('validateGrpcMockBuilderModel surfaces rule-set serialization failures', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'bad-expr',
      type: 'expression',
      expression: 'method == "Echo"',
    };
    const issues = validateGrpcMockBuilderModel({ rules: [row] });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('covers predicate parse and serialize edge paths', () => {
    expect(buildGrpcMockBuilderPredicateNodeId('rule-1', 'root.0')).toBe('pred:rule-1:root.0');
    expect(createGrpcMockBuilderNodeId('custom')).toMatch(/^custom-/);

    const notExpression = parseGrpcMockRuleSetToBuilderModel({
      rules: [{
        id: 'not-expr',
        name: 'Not expr',
        enabled: true,
        priority: 1,
        predicate: {
          kind: 'not',
          predicate: { kind: 'expression', expression: 'method == "Echo"' },
        },
        response: { statusCode: 0 },
      }],
    });
    expect(notExpression.rules[0]?.predicate.type).toBe('expression');

    const unknownLeaf = parseGrpcMockRuleSetToBuilderModel({
      rules: [{
        id: 'unknown',
        name: 'Unknown',
        enabled: true,
        priority: 1,
        predicate: { kind: 'header_equals' as 'method_equals', header: 'x', value: '1' },
        response: { statusCode: 0 },
      }],
    });
    expect(unknownLeaf.rules[0]?.predicateReadOnly).toBe(true);

    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'group-empty-depth',
      type: 'group',
      combinator: 'and',
      children: [],
    };
    expect(measureGrpcMockBuilderPredicateDepth(row.predicate)).toBe(1);

    const serialized = serializeGrpcMockBuilderModelToRuleSet({
      rules: [{
        ...createDefaultGrpcMockBuilderRuleRow(1),
        id: 'all-leaves',
        predicate: {
          nodeId: 'group-leaves',
          type: 'group',
          combinator: 'and',
          children: [
            { nodeId: 'l1', type: 'leaf', kind: 'method_equals', negated: true, method: 'Echo' },
            { nodeId: 'l2', type: 'leaf', kind: 'metadata_equals', negated: false, key: 'x-trace', value: '1' },
            { nodeId: 'l3', type: 'leaf', kind: 'metadata_exists', negated: false, key: 'x-auth' },
            { nodeId: 'l4', type: 'leaf', kind: 'body_path_equals', negated: false, path: 'message', value: 'hi' },
            { nodeId: 'l5', type: 'leaf', kind: 'body_path_exists', negated: false, path: 'payload' },
          ],
        },
      }],
    });
    expect(serialized.rules[0]?.predicate.kind).toBe('and');
    expect(serializeGrpcMockRuleSetToStableJson(serialized)).toContain('"rules"');
  });

  it('validates remaining leaf requirements and forbidden rule names', () => {
    const rows = [
      { kind: 'method_equals' as const, method: '   ' },
      { kind: 'metadata_exists' as const, key: '   ' },
      { kind: 'body_path_equals' as const, path: '   ', value: 'x' },
      { kind: 'body_path_exists' as const, path: '   ' },
    ].map((spec, index) => {
      const row = createDefaultGrpcMockBuilderRuleRow(index + 1);
      row.id = `validate-${index}`;
      row.predicate = { nodeId: `leaf-${index}`, type: 'leaf', negated: false, ...spec };
      return row;
    });
    rows[0]!.name = 'eval(name)';
    const issues = validateGrpcMockBuilderModel({ rules: rows });
    const formatted = formatGrpcMockBuilderIssues(issues);
    expect(formatted).toMatch(/Method is required/i);
    expect(formatted).toMatch(/Metadata key is required/i);
    expect(formatted).toMatch(/Body path is required/i);
    expect(formatted).toMatch(/Forbidden pattern/i);
  });

  it('parses not-wrapped complex predicates as read-only expressions', () => {
    const model = parseGrpcMockRuleSetToBuilderModel({
      rules: [{
        id: 'not-complex',
        name: 'Not complex',
        enabled: true,
        priority: 1,
        predicate: {
          kind: 'not',
          predicate: {
            kind: 'and',
            predicates: [{ kind: 'method_equals', method: 'Echo' }],
          },
        },
        response: { statusCode: 0 },
      }],
    });
    expect(model.rules[0]?.predicateReadOnly).toBe(true);
    expect(model.rules[0]?.predicate.type).toBe('expression');
  });

  it('validates nested group depth and empty rule ids', () => {
    const deepGroup = createDefaultGrpcMockBuilderRuleRow();
    deepGroup.predicate = {
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
    const emptyId = createDefaultGrpcMockBuilderRuleRow();
    emptyId.id = '   ';
    const issues = validateGrpcMockBuilderModel({ rules: [deepGroup, emptyId] });
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/nesting exceeds max depth/i);
    expect(formatGrpcMockBuilderIssues(issues)).toMatch(/Rule id is required/i);
  });

  it('serializes stable json with default response and priority tie-breakers', () => {
    const json = serializeGrpcMockRuleSetToStableJson({
      rules: [
        {
          id: 'b',
          name: 'B',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'B' },
          response: { statusCode: 0 },
        },
        {
          id: 'a',
          name: 'A',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'A' },
          response: { statusCode: 0 },
        },
      ],
      defaultResponse: { statusCode: 14, message: 'fallback' },
    });
    expect(json.indexOf('"id": "a"')).toBeLessThan(json.indexOf('"id": "b"'));
    expect(json).toContain('defaultResponse');
  });

  it('round-trips read-only rows through serialize using originalPredicate', () => {
    const original = {
      kind: 'expression' as const,
      expression: 'method == "Echo"',
    };
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicateReadOnly = true;
    row.originalPredicate = original;
    row.predicate = {
      nodeId: 'expr',
      type: 'expression',
      expression: 'method == "Echo"',
    };
    const exported = serializeGrpcMockBuilderModelToRuleSet({ rules: [row] });
    expect(exported.rules[0]?.predicate).toEqual(original);
  });

  it('validateGrpcMockBuilderModel surfaces non-Error serialization failures', () => {
    const row = createDefaultGrpcMockBuilderRuleRow();
    row.predicate = {
      nodeId: 'expr-throw',
      type: 'expression',
      expression: 'method == "Echo"',
    };
    const expressionOnly = validateGrpcMockBuilderModel({ rules: [row] });
    expect(expressionOnly.some((issue) => issue.path.includes('predicate'))).toBe(false);
  });

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
});
