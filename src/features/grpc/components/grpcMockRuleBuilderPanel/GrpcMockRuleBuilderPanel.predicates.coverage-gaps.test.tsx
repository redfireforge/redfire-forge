/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { selectOption } from '../../../../test-utils/customSelectHelper';
import { resetGrpcMockBuilderNodeIdsForTests, createGrpcMockBuilderNodeId, createDefaultGrpcMockBuilderPredicateLeaf } from '../../utils/grpcMockRuleBuilderModel';
import * as grpcMockRuleBuilderModel from '../../utils/grpcMockRuleBuilderModel';
import { buildAdvancedMock } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcMockPredicateEditorForTests, GrpcMockRuleBuilderPanel } from '../GrpcMockRuleBuilderPanel';
import {
  leafField,
  makeTwoRuleJson,
  mockRuleDragDataTransfer,
  rulesJsonWithRule,
  StatefulMockBuilder,
  VALID_EMPTY_RULES,
} from './grpcMockRuleBuilderPanelCoverageGaps.testHelpers';

describe('GrpcMockRuleBuilderPanel coverage gaps — predicates and drag-drop', () => {
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

    selectOption(screen.getByTestId('grpc-mock-builder-status-response-fields'), '5 - NOT_FOUND');
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
