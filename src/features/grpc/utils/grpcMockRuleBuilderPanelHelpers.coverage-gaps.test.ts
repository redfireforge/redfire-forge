import { beforeEach, describe, expect, it } from 'vitest';
import {
  getGrpcMockStatusOption,
  matchesGrpcMockBuilderPredicateSearch,
  matchesGrpcMockBuilderSearch,
  nextGrpcMockBuilderRulePriority,
  updateGrpcMockBuilderRuleRow,
} from './grpcMockRuleBuilderPanelHelpers';
import {
  createDefaultGrpcMockBuilderRuleRow,
  resetGrpcMockBuilderNodeIdsForTests,
  type GrpcMockBuilderPredicateNode,
} from './grpcMockRuleBuilderModel';

describe('grpcMockRuleBuilderPanelHelpers coverage gaps', () => {
  beforeEach(() => {
    resetGrpcMockBuilderNodeIdsForTests();
  });

  it('matchesGrpcMockBuilderSearch finds rule name and predicate hits', () => {
    const byName = createDefaultGrpcMockBuilderRuleRow();
    byName.name = 'Latency fallback';
    expect(matchesGrpcMockBuilderSearch(byName, 'latency')).toBe(true);

    const byPredicate = createDefaultGrpcMockBuilderRuleRow();
    byPredicate.name = 'Other';
    byPredicate.predicate = {
      nodeId: 'leaf-1',
      type: 'leaf',
      kind: 'method_equals',
      negated: false,
      method: 'EchoUnary',
    };
    expect(matchesGrpcMockBuilderSearch(byPredicate, 'echo')).toBe(true);
    expect(matchesGrpcMockBuilderSearch(byPredicate, 'missing')).toBe(false);
  });

  it('matchesGrpcMockBuilderPredicateSearch covers leaf, group, and expression nodes', () => {
    const leafMethod: GrpcMockBuilderPredicateNode = {
      nodeId: 'leaf-method',
      type: 'leaf',
      kind: 'method_equals',
      negated: false,
      method: 'GetStatus',
    };
    expect(matchesGrpcMockBuilderPredicateSearch(leafMethod, 'status')).toBe(true);

    const leafService: GrpcMockBuilderPredicateNode = {
      nodeId: 'leaf-service',
      type: 'leaf',
      kind: 'service_equals',
      negated: false,
      service: 'echo.EchoService',
    };
    expect(matchesGrpcMockBuilderPredicateSearch(leafService, 'echo')).toBe(true);

    const leafKey: GrpcMockBuilderPredicateNode = {
      nodeId: 'leaf-key',
      type: 'leaf',
      kind: 'metadata_exists',
      negated: false,
      key: 'x-trace-id',
    };
    expect(matchesGrpcMockBuilderPredicateSearch(leafKey, 'trace')).toBe(true);
    expect(
      matchesGrpcMockBuilderPredicateSearch(
        { nodeId: 'leaf-empty', type: 'leaf', kind: 'body_path_exists', negated: false },
        'nope',
      ),
    ).toBe(false);

    const group: GrpcMockBuilderPredicateNode = {
      nodeId: 'group-1',
      type: 'group',
      combinator: 'and',
      children: [leafMethod, leafKey],
    };
    expect(matchesGrpcMockBuilderPredicateSearch(group, 'trace')).toBe(true);
    expect(
      matchesGrpcMockBuilderPredicateSearch(
        { nodeId: 'group-empty', type: 'group', combinator: 'or', children: [] },
        'anything',
      ),
    ).toBe(false);

    const expression: GrpcMockBuilderPredicateNode = {
      nodeId: 'expr-1',
      type: 'expression',
      expression: 'metadata["auth"] == "bearer"',
    };
    expect(matchesGrpcMockBuilderPredicateSearch(expression, 'bearer')).toBe(true);
    expect(matchesGrpcMockBuilderPredicateSearch(expression, 'missing')).toBe(false);
  });

  it('matchesGrpcMockBuilderPredicateSearch returns false for unknown node types', () => {
    const unknown = { type: 'unknown' } as unknown as GrpcMockBuilderPredicateNode;
    expect(matchesGrpcMockBuilderPredicateSearch(unknown, 'query')).toBe(false);
  });

  it('getGrpcMockStatusOption resolves known and unknown status codes', () => {
    expect(getGrpcMockStatusOption(0)?.name).toBe('OK');
    expect(getGrpcMockStatusOption(13)?.description).toContain('Internal');
    expect(getGrpcMockStatusOption(999)).toBeUndefined();
  });

  it('nextGrpcMockBuilderRulePriority returns 1 for empty model or max+1', () => {
    expect(nextGrpcMockBuilderRulePriority({ rules: [] })).toBe(1);

    const rowA = createDefaultGrpcMockBuilderRuleRow(2);
    const rowB = createDefaultGrpcMockBuilderRuleRow(7);
    expect(nextGrpcMockBuilderRulePriority({ rules: [rowA, rowB] })).toBe(8);
  });

  it('updateGrpcMockBuilderRuleRow patches only the matching rule', () => {
    const rowA = createDefaultGrpcMockBuilderRuleRow(1);
    const rowB = createDefaultGrpcMockBuilderRuleRow(2);
    rowB.name = 'Keep me';

    const updated = updateGrpcMockBuilderRuleRow(
      { rules: [rowA, rowB] },
      rowA.id,
      { name: 'Patched', enabled: false },
    );

    expect(updated.rules[0]?.name).toBe('Patched');
    expect(updated.rules[0]?.enabled).toBe(false);
    expect(updated.rules[1]?.name).toBe('Keep me');
  });
});
