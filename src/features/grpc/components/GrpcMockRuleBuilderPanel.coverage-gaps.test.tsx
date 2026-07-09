/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { resetGrpcMockBuilderNodeIdsForTests, createGrpcMockBuilderNodeId, createDefaultGrpcMockBuilderPredicateLeaf } from '../utils/grpcMockRuleBuilderModel';
import * as grpcMockRuleBuilderModel from '../utils/grpcMockRuleBuilderModel';
import { buildAdvancedMock } from '../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcMockPredicateEditorForTests, GrpcMockRuleBuilderPanel } from './GrpcMockRuleBuilderPanel';

const VALID_EMPTY_RULES = '{\n  "rules": []\n}';

function rulesJsonWithRule(rule: Record<string, unknown>) {
  return JSON.stringify({ rules: [rule] }, null, 2);
}

function StatefulMockBuilder({
  initialRulesJson,
  onPatch = vi.fn(),
  parseError,
}: {
  initialRulesJson: string;
  onPatch?: ReturnType<typeof vi.fn>;
  parseError?: string;
}) {
  const [rulesJson, setRulesJson] = useState(initialRulesJson);
  return (
    <GrpcMockRuleBuilderPanel
      advanced={buildAdvancedMock({
        mockServer: { rulesJson, parseError },
        patchMockRulesJson: (next) => {
          onPatch(next);
          setRulesJson(next);
        },
      })}
    />
  );
}

function leafField(prefix: string) {
  const el = document.querySelector(`[data-testid^="${prefix}"]`);
  if (!el) {
    throw new Error(`Missing element with data-testid prefix ${prefix}`);
  }
  return el;
}

describe('GrpcMockRuleBuilderPanel coverage gaps', () => {
  beforeEach(() => {
    resetGrpcMockBuilderNodeIdsForTests();
  });

  it('shows parse error when rules JSON is invalid', () => {
    render(
      <GrpcMockRuleBuilderPanel
        advanced={buildAdvancedMock({
          mockServer: { rulesJson: '{' },
        })}
      />,
    );
    expect(screen.getByTestId('grpc-mock-builder-parse-error')).toBeTruthy();
  });

  it('adds rules and edits header fields', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <StatefulMockBuilder initialRulesJson={VALID_EMPTY_RULES} onPatch={patchMockRulesJson} />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-add-rule'));
    expect(patchMockRulesJson).toHaveBeenCalled();

    patchMockRulesJson.mockClear();
    render(
      <StatefulMockBuilder
        onPatch={patchMockRulesJson}
        initialRulesJson={rulesJsonWithRule({
          id: 'rule-a',
          name: 'Echo match',
          enabled: true,
          priority: 1,
          fallthrough: false,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { ok: true } },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-enabled-rule-a'));
    fireEvent.change(screen.getByTestId('grpc-mock-builder-name-rule-a'), { target: { value: 'Renamed' } });
    fireEvent.change(screen.getByTestId('grpc-mock-builder-priority-rule-a'), { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('grpc-mock-builder-priority-rule-a'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('grpc-mock-builder-fallthrough-rule-a'));
    fireEvent.change(screen.getByTestId('grpc-mock-builder-status-rule-a'), { target: { value: '7' } });
    fireEvent.change(screen.getByTestId('grpc-mock-builder-status-rule-a'), { target: { value: 'bad' } });
    fireEvent.change(screen.getByTestId('grpc-mock-builder-body-rule-a'), { target: { value: '{"x":1}' } });
    expect(patchMockRulesJson).toHaveBeenCalled();
  });

  it('deletes a rule and assigns priority when adding to non-empty model', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = JSON.stringify({
      rules: [
        {
          id: 'rule-1',
          name: 'First',
          enabled: true,
          priority: 3,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0 },
        },
        {
          id: 'rule-2',
          name: 'Second',
          enabled: false,
          priority: 7,
          predicate: { kind: 'service_equals', service: 'echo.EchoService' },
          response: { statusCode: 0 },
        },
      ],
    }, null, 2);

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-delete-rule-rule-1'));
    fireEvent.click(screen.getByTestId('grpc-mock-builder-add-rule'));
    expect(patchMockRulesJson).toHaveBeenCalledTimes(2);
  });

  it('converts a leaf predicate to a group and edits group combinator', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = rulesJsonWithRule({
      id: 'leaf-rule',
      name: 'Leaf',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'Echo' },
      response: { statusCode: 0 },
    });

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-convert-group-leaf-rule'));
    expect(patchMockRulesJson).toHaveBeenCalled();

    const groupRulesJson = rulesJsonWithRule({
      id: 'group-rule',
      name: 'Group',
      enabled: true,
      priority: 1,
      predicate: {
        kind: 'and',
        predicates: [
          { kind: 'method_equals', method: 'Echo' },
          { kind: 'service_equals', service: 'echo.EchoService' },
        ],
      },
      response: { statusCode: 0 },
    });

    patchMockRulesJson.mockClear();
    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={groupRulesJson} />,
    );

    fireEvent.change(leafField('grpc-mock-builder-group-combinator-') as HTMLSelectElement, { target: { value: 'or' } });
    fireEvent.click(leafField('grpc-mock-builder-add-leaf-') as HTMLButtonElement);
    expect(patchMockRulesJson).toHaveBeenCalled();
  });

  it('edits all leaf predicate kinds and toggles negation', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = rulesJsonWithRule({
      id: 'kinds',
      name: 'Kinds',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'Echo' },
      response: { statusCode: 0 },
    });

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    const kindSelect = leafField('grpc-mock-builder-leaf-kind-') as HTMLSelectElement;

    fireEvent.change(kindSelect, { target: { value: 'service_equals' } });
    fireEvent.change(leafField('grpc-mock-builder-leaf-service-') as HTMLInputElement, {
      target: { value: 'echo.EchoService' },
    });

    fireEvent.change(kindSelect, { target: { value: 'metadata_equals' } });
    fireEvent.change(leafField('grpc-mock-builder-leaf-key-') as HTMLInputElement, {
      target: { value: 'x-token' },
    });
    fireEvent.change(leafField('grpc-mock-builder-leaf-value-') as HTMLInputElement, {
      target: { value: 'secret' },
    });

    fireEvent.change(kindSelect, { target: { value: 'metadata_exists' } });
    fireEvent.change(leafField('grpc-mock-builder-leaf-key-') as HTMLInputElement, {
      target: { value: 'trace-id' },
    });

    fireEvent.change(kindSelect, { target: { value: 'body_path_equals' } });
    fireEvent.change(leafField('grpc-mock-builder-leaf-path-') as HTMLInputElement, {
      target: { value: 'message' },
    });
    fireEvent.change(leafField('grpc-mock-builder-leaf-body-value-') as HTMLInputElement, {
      target: { value: 'hello' },
    });

    fireEvent.change(kindSelect, { target: { value: 'body_path_exists' } });
    fireEvent.change(leafField('grpc-mock-builder-leaf-path-') as HTMLInputElement, {
      target: { value: 'payload' },
    });

    fireEvent.change(kindSelect, { target: { value: 'method_equals' } });
    fireEvent.change(leafField('grpc-mock-builder-leaf-method-') as HTMLInputElement, {
      target: { value: 'Ping' },
    });
    fireEvent.click(leafField('grpc-mock-builder-leaf-not-') as HTMLInputElement);

    expect(patchMockRulesJson).toHaveBeenCalled();
  });

  it('removes nested predicate leaves from a group', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = rulesJsonWithRule({
      id: 'nested',
      name: 'Nested',
      enabled: true,
      priority: 1,
      predicate: {
        kind: 'and',
        predicates: [
          { kind: 'method_equals', method: 'Echo' },
          { kind: 'method_equals', method: 'Ping' },
        ],
      },
      response: { statusCode: 0 },
    });

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[0]!);
    expect(patchMockRulesJson).toHaveBeenCalled();
  });

  it('shows validation issues and start-blocked hint from mock server', () => {
    render(
      <GrpcMockRuleBuilderPanel
        advanced={buildAdvancedMock({
          mockServer: {
            rulesJson: rulesJsonWithRule({
              id: 'invalid',
              name: 'Invalid',
              enabled: true,
              priority: 1,
              predicate: { kind: 'method_equals', method: '' },
              response: { statusCode: 0 },
            }),
            parseError: 'rules[0].predicate.method: method is required.',
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-mock-builder-validation')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-builder-start-blocked')).toBeTruthy();
  });

  it('renders read-only expression and deep predicate summaries', () => {
    render(
      <GrpcMockRuleBuilderPanel
        advanced={buildAdvancedMock({
          mockServer: {
            rulesJson: JSON.stringify({
              rules: [
                {
                  id: 'expr',
                  name: 'Expression',
                  enabled: true,
                  priority: 1,
                  predicate: { kind: 'expression', expression: 'method == "Echo"' },
                  response: { statusCode: 0 },
                },
                {
                  id: 'deep',
                  name: 'Deep',
                  enabled: true,
                  priority: 2,
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
                },
              ],
            }),
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-mock-builder-readonly-rule-expr')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-builder-readonly-rule-deep')).toBeTruthy();
    expect(screen.getAllByText(/Edit this predicate in the JSON editor/i).length).toBeGreaterThan(0);
  });

  it('edits multiple rules without cross-contamination and covers optional leaf defaults', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = JSON.stringify({
      rules: [
        {
          id: 'rule-a',
          name: 'First',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { ok: true } },
        },
        {
          id: 'rule-b',
          name: 'Second',
          enabled: true,
          priority: 2,
          predicate: { kind: 'service_equals', service: '' },
          response: { statusCode: 0 },
        },
      ],
    }, null, 2);

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    fireEvent.change(screen.getByTestId('grpc-mock-builder-name-rule-b'), { target: { value: 'Renamed B' } });
    fireEvent.change(leafField('grpc-mock-builder-leaf-service-') as HTMLInputElement, {
      target: { value: 'echo.EchoService' },
    });
    expect(patchMockRulesJson).toHaveBeenCalled();
  });

  it('edits grouped predicates and nested leaves through the builder UI', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = rulesJsonWithRule({
      id: 'grouped',
      name: 'Grouped',
      enabled: true,
      priority: 1,
      predicate: {
        kind: 'and',
        predicates: [
          { kind: 'method_equals', method: 'Echo' },
          { kind: 'service_equals', service: 'echo.EchoService' },
        ],
      },
      response: { statusCode: 0 },
    });

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    fireEvent.change(leafField('grpc-mock-builder-leaf-service-') as HTMLInputElement, {
      target: { value: 'other.Service' },
    });
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[0]!);
    expect(patchMockRulesJson).toHaveBeenCalled();
  });

  it('renders read-only predicate summaries for each leaf kind via PredicateEditor', () => {
    const leafKinds = [
      { kind: 'method_equals' as const, method: 'Echo' },
      { kind: 'service_equals' as const, service: 'echo.EchoService' },
      { kind: 'metadata_equals' as const, key: 'token', value: 'abc' },
      { kind: 'metadata_exists' as const, key: 'trace-id' },
      { kind: 'body_path_equals' as const, path: 'message', value: 'hello' },
      { kind: 'body_path_exists' as const, path: 'payload' },
    ];

    for (const kind of leafKinds) {
      const nodeId = createGrpcMockBuilderNodeId('leaf');
      render(
        <GrpcMockPredicateEditorForTests
          node={{ nodeId, type: 'leaf', negated: false, ...kind }}
          readOnly
          disabled={false}
          depth={1}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId(`grpc-mock-builder-readonly-${nodeId}`)).toBeTruthy();
    }
  });

  it('renders read-only summaries with undefined optional leaf fields', () => {
    const undefinedLeafKinds = [
      { kind: 'method_equals' as const },
      { kind: 'service_equals' as const },
      { kind: 'metadata_equals' as const },
      { kind: 'metadata_exists' as const },
      { kind: 'body_path_equals' as const },
      { kind: 'body_path_exists' as const },
    ] as const;

    for (const kind of undefinedLeafKinds) {
      const nodeId = createGrpcMockBuilderNodeId('leaf');
      render(
        <GrpcMockPredicateEditorForTests
          node={{ nodeId, type: 'leaf', negated: false, ...kind }}
          readOnly
          disabled={false}
          depth={1}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId(`grpc-mock-builder-readonly-${nodeId}`)).toBeTruthy();
    }
  });

  it('renders editable leaves with undefined optional fields using empty defaults', () => {
    const editableKinds = [
      { kind: 'method_equals' as const, field: 'method', testIdPrefix: 'grpc-mock-builder-leaf-method-' },
      { kind: 'service_equals' as const, field: 'service', testIdPrefix: 'grpc-mock-builder-leaf-service-' },
      { kind: 'metadata_equals' as const, field: 'key', testIdPrefix: 'grpc-mock-builder-leaf-key-' },
      { kind: 'metadata_exists' as const, field: 'key', testIdPrefix: 'grpc-mock-builder-leaf-key-' },
      { kind: 'body_path_equals' as const, field: 'path', testIdPrefix: 'grpc-mock-builder-leaf-path-' },
      { kind: 'body_path_exists' as const, field: 'path', testIdPrefix: 'grpc-mock-builder-leaf-path-' },
    ] as const;

    for (const entry of editableKinds) {
      const nodeId = createGrpcMockBuilderNodeId('leaf');
      const onChange = vi.fn();
      render(
        <GrpcMockPredicateEditorForTests
          node={{ nodeId, type: 'leaf', kind: entry.kind, negated: false }}
          readOnly={false}
          disabled={false}
          depth={1}
          onChange={onChange}
        />,
      );

      fireEvent.change(screen.getByTestId(`${entry.testIdPrefix}${nodeId}`), {
        target: { value: 'filled' },
      });
      expect(onChange).toHaveBeenCalled();
    }
  });

  it('renders read-only expression nodes and skips editable expression nodes', () => {
    const expressionId = createGrpcMockBuilderNodeId('expr');
    render(
      <GrpcMockPredicateEditorForTests
        node={{ nodeId: expressionId, type: 'expression', expression: 'method == "Echo"' }}
        readOnly
        disabled={false}
        depth={1}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId(`grpc-mock-builder-readonly-${expressionId}`)).toBeTruthy();

    const editableExpressionId = createGrpcMockBuilderNodeId('expr-edit');
    const { container } = render(
      <GrpcMockPredicateEditorForTests
        node={{ nodeId: editableExpressionId, type: 'expression', expression: 'method == "Ping"' }}
        readOnly={false}
        disabled={false}
        depth={1}
        onChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders read-only group summaries for nested predicate editors', () => {
    const groupId = createGrpcMockBuilderNodeId('group');
    render(
      <GrpcMockPredicateEditorForTests
        node={{
          nodeId: groupId,
          type: 'group',
          combinator: 'and',
          children: [{
            nodeId: createGrpcMockBuilderNodeId('leaf'),
            type: 'leaf',
            kind: 'method_equals',
            negated: false,
            method: 'Echo',
          }],
        }}
        readOnly
        disabled={false}
        depth={1}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId(`grpc-mock-builder-readonly-${groupId}`).textContent)
      .toMatch(/Complex predicate/i);
  });

  it('supports nested group editing through PredicateEditor test export', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    const groupId = createGrpcMockBuilderNodeId('group');
    const leaf = createDefaultGrpcMockBuilderPredicateLeaf();

    render(
      <GrpcMockPredicateEditorForTests
        node={{
          nodeId: groupId,
          type: 'group',
          combinator: 'and',
          children: [leaf],
        }}
        readOnly={false}
        disabled={false}
        depth={0}
        onChange={onChange}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByTestId(`grpc-mock-builder-add-group-${groupId}`));
    fireEvent.click(screen.getByTestId(`grpc-mock-builder-add-leaf-${groupId}`));
    fireEvent.click(screen.getByTestId(`grpc-mock-builder-remove-group-${groupId}`));
    expect(onChange).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  it('shows read-only expression text at the rule level', () => {
    render(
      <GrpcMockRuleBuilderPanel
        advanced={buildAdvancedMock({
          mockServer: {
            rulesJson: rulesJsonWithRule({
              id: 'expr-only',
              name: 'Expression only',
              enabled: true,
              priority: 1,
              predicate: { kind: 'expression', expression: 'metadata["x"] == "1"' },
              response: { statusCode: 0 },
            }),
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-mock-builder-readonly-rule-expr-only').textContent)
      .toContain('metadata["x"] == "1"');
  });

  it('skips convert-to-group for read-only and already-group predicates', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <StatefulMockBuilder
        onPatch={patchMockRulesJson}
        initialRulesJson={JSON.stringify({
          rules: [
            {
              id: 'expr',
              name: 'Expression',
              enabled: true,
              priority: 1,
              predicate: { kind: 'expression', expression: 'method == "Echo"' },
              response: { statusCode: 0 },
            },
            {
              id: 'grouped',
              name: 'Grouped',
              enabled: true,
              priority: 2,
              predicate: {
                kind: 'and',
                predicates: [{ kind: 'method_equals', method: 'Echo' }],
              },
              response: { statusCode: 0 },
            },
          ],
        }, null, 2)}
      />,
    );

    expect(screen.queryByTestId('grpc-mock-builder-convert-group-expr')).toBeNull();
    expect(screen.queryByTestId('grpc-mock-builder-convert-group-grouped')).toBeNull();
    expect(patchMockRulesJson).not.toHaveBeenCalled();
  });

  it('shows originalPredicate summary for read-only rules without expression text', () => {
    render(
      <GrpcMockRuleBuilderPanel
        advanced={buildAdvancedMock({
          mockServer: {
            rulesJson: JSON.stringify({
              rules: [{
                id: 'deep-readonly',
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
            }),
          },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-mock-builder-readonly-rule-deep-readonly')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-builder-readonly-rule-deep-readonly').textContent)
      .toMatch(/method == "Echo"/i);
  });

  it('shows expression fallback when read-only rule lacks originalPredicate', () => {
    const modelSpy = vi.spyOn(grpcMockRuleBuilderModel, 'parseGrpcMockRuleSetToBuilderModel')
      .mockReturnValue({
        rules: [{
          id: 'expr-fallback',
          name: 'Expression fallback',
          enabled: true,
          priority: 1,
          fallthrough: false,
          predicateReadOnly: true,
          predicate: {
            nodeId: 'pred:expr-fallback:root',
            type: 'expression',
            expression: 'metadata["x"] == "1"',
          },
          responseStatusCode: 0,
          responseBodyText: '{}',
        }],
      });

    render(
      <GrpcMockRuleBuilderPanel
        advanced={buildAdvancedMock({
          mockServer: { rulesJson: VALID_EMPTY_RULES },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-mock-builder-readonly-rule-expr-fallback').textContent)
      .toContain('metadata["x"] == "1"');
    modelSpy.mockRestore();
  });

  it('returns null when builder model parsing yields no model', () => {
    const modelSpy = vi.spyOn(grpcMockRuleBuilderModel, 'parseGrpcMockRuleSetToBuilderModel')
      .mockReturnValue(undefined);

    const { container } = render(
      <GrpcMockRuleBuilderPanel
        advanced={buildAdvancedMock({
          mockServer: { rulesJson: VALID_EMPTY_RULES },
        })}
      />,
    );

    expect(container.firstChild).toBeNull();
    modelSpy.mockRestore();
  });

  it('ignores predicate updates that exceed max nesting depth on the rule panel', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = rulesJsonWithRule({
      id: 'depth-guard',
      name: 'Depth',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'Echo' },
      response: { statusCode: 0 },
    });

    const depthSpy = vi.spyOn(grpcMockRuleBuilderModel, 'measureGrpcMockBuilderPredicateDepth')
      .mockReturnValue(3);

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    patchMockRulesJson.mockClear();
    fireEvent.change(leafField('grpc-mock-builder-leaf-method-') as HTMLInputElement, {
      target: { value: 'Ping' },
    });
    expect(patchMockRulesJson).not.toHaveBeenCalled();
    depthSpy.mockRestore();
  });
});
