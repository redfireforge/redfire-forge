/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { resetGrpcMockBuilderNodeIdsForTests, createGrpcMockBuilderNodeId, createDefaultGrpcMockBuilderPredicateLeaf } from '../utils/grpcMockRuleBuilderModel';
import * as grpcMockRuleBuilderModel from '../utils/grpcMockRuleBuilderModel';
import { buildAdvancedMock, FIXTURE_DESCRIPTOR } from '../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcMockPredicateEditorForTests, GrpcMockRuleBuilderPanel } from './GrpcMockRuleBuilderPanel';

const VALID_EMPTY_RULES = '{\n  "rules": []\n}';

function rulesJsonWithRule(rule: Record<string, unknown>) {
  return JSON.stringify({ rules: [rule] }, null, 2);
}

function StatefulMockBuilder({
  initialRulesJson,
  onPatch = vi.fn(),
  parseError,
  activeDescriptor,
  toolbarHost,
  mockRunning = false,
}: {
  initialRulesJson: string;
  onPatch?: ReturnType<typeof vi.fn>;
  parseError?: string;
  activeDescriptor?: typeof FIXTURE_DESCRIPTOR;
  toolbarHost?: HTMLElement | null;
  mockRunning?: boolean;
}) {
  const [rulesJson, setRulesJson] = useState(initialRulesJson);
  return (
    <GrpcMockRuleBuilderPanel
      toolbarHost={toolbarHost}
      advanced={buildAdvancedMock({
        mockServer: { rulesJson, parseError },
        mockRunning,
        activeDescriptor: activeDescriptor ?? null,
        patchMockRulesJson: (next) => {
          onPatch(next);
          setRulesJson(next);
        },
      })}
    />
  );
}

function mockRuleDragDataTransfer(_ruleId: string) {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    getData: (type: string) => store.get(type) ?? '',
  };
}

function makeTwoRuleJson() {
  return JSON.stringify({
    rules: [
      {
        id: 'rule-a',
        name: 'Alpha Echo',
        enabled: true,
        priority: 1,
        predicate: { kind: 'method_equals', method: 'Echo' },
        response: { statusCode: 0, body: { ok: true } },
      },
      {
        id: 'rule-b',
        name: 'Beta Ping',
        enabled: true,
        priority: 2,
        predicate: { kind: 'method_equals', method: 'Ping' },
        response: { statusCode: 0 },
      },
    ],
  }, null, 2);
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
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('collapses and expands all rules from the authoring toolbar', () => {
    const rulesJson = JSON.stringify({
      rules: [
        {
          id: 'rule-a',
          name: 'First',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0 },
        },
        {
          id: 'rule-b',
          name: 'Second',
          enabled: true,
          priority: 2,
          predicate: { kind: 'method_equals', method: 'Ping' },
          response: { statusCode: 0 },
        },
      ],
    }, null, 2);

    const { container } = render(
      <StatefulMockBuilder initialRulesJson={rulesJson} />,
    );

    expect(container.querySelector('[data-testid^="grpc-mock-builder-leaf-kind-"]')).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-mock-builder-collapse-all'));
    expect(container.querySelectorAll('[data-testid^="grpc-mock-builder-summary-"]').length).toBe(2);
    expect(container.querySelector('[data-testid^="grpc-mock-builder-leaf-kind-"]')).toBeNull();

    fireEvent.click(screen.getByTestId('grpc-mock-builder-expand-all'));
    expect(container.querySelectorAll('[data-testid^="grpc-mock-builder-leaf-kind-"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid^="grpc-mock-builder-summary-"]')).toBeNull();
  });

  it('collapses proto-generated stub rules by default', () => {
    const patchMockRulesJson = vi.fn();
    const { container } = render(
      <StatefulMockBuilder
        initialRulesJson={VALID_EMPTY_RULES}
        onPatch={patchMockRulesJson}
        activeDescriptor={FIXTURE_DESCRIPTOR}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-generate-stubs'));
    expect(patchMockRulesJson).toHaveBeenCalled();

    const collapseButtons = container.querySelectorAll(
      '[data-testid^="grpc-mock-builder-collapse-"]:not([data-testid="grpc-mock-builder-collapse-all"])',
    );
    expect(collapseButtons.length).toBeGreaterThan(0);
    for (const button of collapseButtons) {
      expect(button.textContent).toBe('▸');
    }
    expect(container.querySelector('[data-testid^="grpc-mock-builder-summary-"]')).toBeTruthy();
    expect(container.querySelector('[data-testid^="grpc-mock-builder-leaf-kind-"]')).toBeNull();
  });

  it('opens the dry-run tester with footer close action', () => {
    render(
      <StatefulMockBuilder
        initialRulesJson={rulesJsonWithRule({
          id: 'rule-a',
          name: 'Echo match',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { ok: true } },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-test-toggle-rule-a'));
    expect(screen.getByText('Dry-Run Tester')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-tester-close')).toBeTruthy();
    expect(screen.queryByLabelText('Close')).toBeNull();

    fireEvent.click(screen.getByTestId('grpc-mock-tester-close'));
    expect(screen.queryByText('Dry-Run Tester')).toBeNull();
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

  it('converts a single-child group back to a leaf predicate', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = rulesJsonWithRule({
      id: 'grouped-single',
      name: 'Ping match',
      enabled: true,
      priority: 1,
      predicate: {
        kind: 'and',
        predicates: [{ kind: 'method_equals', method: 'Echo' }],
      },
      response: { statusCode: 0 },
    });

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-convert-leaf-grouped-single'));
    expect(patchMockRulesJson).toHaveBeenCalled();
    expect(screen.getByTestId('grpc-mock-builder-convert-group-grouped-single')).toBeTruthy();
    expect(screen.queryByTestId('grpc-mock-builder-convert-leaf-grouped-single')).toBeNull();
  });

  it('hides convert-to-leaf when a group has multiple children', () => {
    render(
      <StatefulMockBuilder
        onPatch={vi.fn()}
        initialRulesJson={rulesJsonWithRule({
          id: 'grouped-multi',
          name: 'Multi',
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
        })}
      />,
    );

    expect(screen.queryByTestId('grpc-mock-builder-convert-leaf-grouped-multi')).toBeNull();
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

  it('filters rules with the search input and clears search when adding a rule', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={makeTwoRuleJson()} />,
    );

    fireEvent.change(screen.getByTestId('grpc-mock-builder-search'), { target: { value: 'ping' } });
    expect(screen.queryByTestId('grpc-mock-builder-rule-rule-a')).toBeNull();
    expect(screen.getByTestId('grpc-mock-builder-rule-rule-b')).toBeTruthy();

    patchMockRulesJson.mockClear();
    fireEvent.click(screen.getByTestId('grpc-mock-builder-add-rule'));
    expect(patchMockRulesJson).toHaveBeenCalled();
    expect((screen.getByTestId('grpc-mock-builder-search') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('grpc-mock-builder-rule-rule-a')).toBeTruthy();
  });

  it('renders toolbar in a portal host when toolbarHost is provided', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    render(
      <StatefulMockBuilder initialRulesJson={VALID_EMPTY_RULES} toolbarHost={host} />,
    );

    expect(host.querySelector('[data-testid="grpc-mock-builder-search"]')).toBeTruthy();
    expect(host.contains(screen.getByTestId('grpc-mock-builder-search'))).toBe(true);
    host.remove();
  });

  it('creates the first rule from the empty-state call to action', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={VALID_EMPTY_RULES} />,
    );

    expect(screen.getByTestId('grpc-mock-builder-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-mock-builder-empty-add'));
    expect(patchMockRulesJson).toHaveBeenCalled();
    expect(screen.queryByTestId('grpc-mock-builder-empty')).toBeNull();
  });

  it('disables generate-from-proto when no descriptor is loaded', () => {
    render(<StatefulMockBuilder initialRulesJson={VALID_EMPTY_RULES} />);
    expect((screen.getByTestId('grpc-mock-builder-generate-stubs') as HTMLButtonElement).disabled).toBe(true);
  });

  it('duplicates a rule and patches while the mock server is running', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <StatefulMockBuilder
        onPatch={patchMockRulesJson}
        initialRulesJson={makeTwoRuleJson()}
        mockRunning
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-duplicate-rule-rule-a'));
    expect(patchMockRulesJson).toHaveBeenCalled();
    const parsed = JSON.parse(patchMockRulesJson.mock.calls.at(-1)?.[0] as string) as { rules: Array<{ name: string }> };
    expect(parsed.rules.some((rule) => rule.name.includes('(copy)'))).toBe(true);
  });

  it('reorders rules via drag and drop and applies dragging CSS classes', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={makeTwoRuleJson()} />,
    );

    const sourceCard = screen.getByTestId('grpc-mock-builder-rule-rule-a');
    const targetCard = screen.getByTestId('grpc-mock-builder-rule-rule-b');
    const dataTransfer = mockRuleDragDataTransfer('rule-a');

    fireEvent.dragStart(screen.getByTestId('grpc-mock-builder-drag-rule-a'), { dataTransfer });
    expect(sourceCard.className).toContain('mock-server-rule-card--dragging');

    fireEvent.dragOver(targetCard, { dataTransfer });
    expect(targetCard.className).toContain('mock-server-rule-card--drop-target');

    fireEvent.drop(targetCard, { dataTransfer });
    expect(patchMockRulesJson).toHaveBeenCalled();

    fireEvent.dragEnd(screen.getByTestId('grpc-mock-builder-drag-rule-a'));
    expect(sourceCard.className).not.toContain('mock-server-rule-card--dragging');
  });

  it('ignores drop onto the same rule and invalid dragged rule ids', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={makeTwoRuleJson()} />,
    );

    const sourceCard = screen.getByTestId('grpc-mock-builder-rule-rule-a');
    fireEvent.dragStart(screen.getByTestId('grpc-mock-builder-drag-rule-a'), {
      dataTransfer: mockRuleDragDataTransfer('rule-a'),
    });
    fireEvent.drop(sourceCard, { dataTransfer: mockRuleDragDataTransfer('rule-a') });
    expect(patchMockRulesJson).not.toHaveBeenCalled();

    const unknownTransfer = mockRuleDragDataTransfer('missing-rule');
    fireEvent.drop(screen.getByTestId('grpc-mock-builder-rule-rule-b'), { dataTransfer: unknownTransfer });
    expect(patchMockRulesJson).not.toHaveBeenCalled();
  });

  it('shows conflict warnings and per-rule conflict badges for overlapping rules', () => {
    const rulesJson = JSON.stringify({
      rules: [
        {
          id: 'conflict-a',
          name: 'Echo A',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0 },
        },
        {
          id: 'conflict-b',
          name: 'Echo B',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0 },
        },
      ],
    }, null, 2);

    render(<StatefulMockBuilder initialRulesJson={rulesJson} />);

    expect(screen.getByTestId('grpc-mock-builder-conflicts').textContent).toMatch(/1 potential rule conflict/i);
    expect(screen.getByTestId('grpc-mock-builder-conflict-conflict-a')).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-builder-conflict-conflict-b')).toBeTruthy();
  });

  it('toggles the dry-run tester closed when clicking the same rule test button', () => {
    render(
      <StatefulMockBuilder
        initialRulesJson={rulesJsonWithRule({
          id: 'rule-a',
          name: 'Echo match',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, body: { ok: true } },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-test-toggle-rule-a'));
    expect(screen.getByText('Dry-Run Tester')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-mock-builder-test-toggle-rule-a'));
    expect(screen.queryByText('Dry-Run Tester')).toBeNull();
  });

  it('closes the tester when the tested rule is deleted', () => {
    const patchMockRulesJson = vi.fn();
    render(
      <StatefulMockBuilder
        onPatch={patchMockRulesJson}
        initialRulesJson={rulesJsonWithRule({
          id: 'rule-a',
          name: 'Echo match',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0 },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-builder-test-toggle-rule-a'));
    expect(screen.getByText('Dry-Run Tester')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-mock-builder-delete-rule-rule-a'));
    expect(patchMockRulesJson).toHaveBeenCalled();
    expect(screen.queryByText('Dry-Run Tester')).toBeNull();
  });

  it('expanding a later rule collapses earlier rules and scrolls it into view', () => {
    const rulesJson = JSON.stringify({
      rules: [
        {
          id: 'rule-1',
          name: 'First',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0 },
        },
        {
          id: 'rule-2',
          name: 'Second',
          enabled: true,
          priority: 2,
          predicate: { kind: 'method_equals', method: 'Ping' },
          response: { statusCode: 0 },
        },
        {
          id: 'rule-3',
          name: 'Third',
          enabled: true,
          priority: 3,
          predicate: { kind: 'method_equals', method: 'Pong' },
          response: { statusCode: 0 },
        },
      ],
    }, null, 2);

    const { container } = render(<StatefulMockBuilder initialRulesJson={rulesJson} />);

    fireEvent.click(screen.getByTestId('grpc-mock-builder-collapse-rule-1'));
    fireEvent.click(screen.getByTestId('grpc-mock-builder-collapse-rule-2'));
    fireEvent.click(screen.getByTestId('grpc-mock-builder-collapse-rule-3'));

    fireEvent.click(screen.getByTestId('grpc-mock-builder-collapse-rule-2'));
    expect(container.querySelector('[data-testid="grpc-mock-builder-summary-rule-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid^="grpc-mock-builder-leaf-kind-"]')).toBeTruthy();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('edits custom status, latency, and status message fields', () => {
    const patchMockRulesJson = vi.fn();
    const rulesJson = rulesJsonWithRule({
      id: 'response-fields',
      name: 'Custom response',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'Echo' },
      response: { statusCode: 99, message: 'custom failure', latencyMs: 25, body: { ok: true } },
    });

    render(
      <StatefulMockBuilder onPatch={patchMockRulesJson} initialRulesJson={rulesJson} />,
    );

    fireEvent.change(screen.getByTestId('grpc-mock-builder-status-response-fields'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByTestId('grpc-mock-builder-latency-response-fields'), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByTestId('grpc-mock-builder-latency-response-fields'), {
      target: { value: 'bad' },
    });
    fireEvent.change(screen.getByTestId('grpc-mock-builder-message-response-fields'), {
      target: { value: 'updated message' },
    });
    fireEvent.change(screen.getByTestId('grpc-mock-builder-message-response-fields'), {
      target: { value: '' },
    });
    expect(patchMockRulesJson).toHaveBeenCalled();
  });

  it('shows read-only complex predicate fallback without originalPredicate', () => {
    const modelSpy = vi.spyOn(grpcMockRuleBuilderModel, 'parseGrpcMockRuleSetToBuilderModel')
      .mockReturnValue({
        rules: [{
          id: 'complex-readonly',
          name: 'Complex',
          enabled: true,
          priority: 1,
          fallthrough: false,
          predicateReadOnly: true,
          predicate: {
            nodeId: 'pred:complex-readonly:root',
            type: 'group',
            combinator: 'and',
            children: [{
              nodeId: 'pred:complex-readonly:leaf',
              type: 'group',
              combinator: 'or',
              children: [],
            }],
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

    expect(screen.getByTestId('grpc-mock-builder-readonly-rule-complex-readonly').textContent)
      .toContain('Complex predicate — edit in JSON editor.');
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
