/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { resetGrpcMockBuilderNodeIdsForTests} from '../../utils/grpcMockRuleBuilderModel';
import { buildAdvancedMock, FIXTURE_DESCRIPTOR } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import {GrpcMockRuleBuilderPanel } from '../GrpcMockRuleBuilderPanel';
import {
  leafField,
  rulesJsonWithRule,
  StatefulMockBuilder,
  VALID_EMPTY_RULES,
} from './grpcMockRuleBuilderPanelCoverageGaps.testHelpers';

describe('GrpcMockRuleBuilderPanel coverage gaps — authoring', () => {
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

});
