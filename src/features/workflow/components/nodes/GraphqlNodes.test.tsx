/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GraphqlQueryNode from './GraphqlQueryNode';
import GraphqlMutationNode from './GraphqlMutationNode';
import GraphqlSubscriptionNode from './GraphqlSubscriptionNode';
import GraphqlIntrospectNode from './GraphqlIntrospectNode';
import GraphqlAssertNode from './GraphqlAssertNode';

const handleConfigure = vi.fn();

vi.mock('@xyflow/react', () => ({
  Handle: ({ type }: { type: string }) => <div data-testid={`handle-${type}`} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: { state: 'idle' },
    stateClass: 'wf-node-idle',
    debugStep: null,
    handleConfigure,
  }),
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: (type: string) => `Category:${type}`,
}));

vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ title, onClick }: { title: string; onClick: () => void }) => (
    <button type="button" data-testid="node-configure" title={title} onClick={onClick}>configure</button>
  ),
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: ({ nodeId }: { nodeId: string }) => <div data-testid={`paused-${nodeId}`} />,
}));

vi.mock('./NodeStatusBadge', () => ({
  NodeStatusBadge: () => <div data-testid="node-status-badge" />,
}));

function baseProps(data: Record<string, unknown>, selected = false) {
  return {
    id: 'node-1',
    data,
    selected,
    type: 'graphqlQuery',
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    isConnectable: true,
  };
}

describe('Graphql workflow nodes', () => {
  it('GraphqlQueryNode renders endpoint host and extraction count', () => {
    render(
      <GraphqlQueryNode
        {...baseProps({
          label: 'Q1',
          endpoint: 'https://api.example.com/graphql',
          extractionRules: [{ jsonPath: '$.id', variableName: 'id' }],
        })}
      />,
    );

    expect(screen.getByTestId('gql-canvas-query-node')).toBeTruthy();
    expect(screen.getByText('Q1')).toBeTruthy();
    expect(screen.getByText('api.example.com')).toBeTruthy();
    expect(screen.getByText('1 extraction')).toBeTruthy();
  });

  it('GraphqlQueryNode falls back for invalid endpoint and empty label', () => {
    render(
      <GraphqlQueryNode
        {...baseProps({ label: '', endpoint: 'not-a-url', extractionRules: [] }, true)}
      />,
    );

    expect(screen.getByText('GraphQL Query')).toBeTruthy();
    expect(screen.getByText('not-a-url')).toBeTruthy();
    expect(screen.queryByText(/extraction/)).toBeNull();
  });

  it('GraphqlQueryNode uses raw endpoint when URL host is empty', () => {
    render(
      <GraphqlQueryNode
        {...baseProps({ label: 'Q2', endpoint: 'mailto:test@example.com', extractionRules: [] })}
      />,
    );

    expect(screen.getByText('mailto:test@example.com')).toBeTruthy();
  });

  it('GraphqlMutationNode renders label and fallback endpoint', () => {
    render(
      <GraphqlMutationNode
        {...baseProps({ label: '', endpoint: '', extractionRules: [{}, {}] })}
      />,
    );

    expect(screen.getByTestId('gql-canvas-mutation-node')).toBeTruthy();
    expect(screen.getByText('GraphQL Mutation')).toBeTruthy();
    expect(screen.getByText('No endpoint')).toBeTruthy();
    expect(screen.getByText('2 extractions')).toBeTruthy();
  });

  it('GraphqlMutationNode renders host and selected class with singular extraction text', () => {
    const { container } = render(
      <GraphqlMutationNode
        {...baseProps({
          label: 'Mut',
          endpoint: 'https://mut.example.com/graphql',
          extractionRules: [{ id: 'x' }],
        }, true)}
      />,
    );

    expect(screen.getByText('mut.example.com')).toBeTruthy();
    expect(screen.getByText('1 extraction')).toBeTruthy();
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('GraphqlMutationNode uses raw endpoint when URL host is empty and omits extraction meta when rules absent', () => {
    render(
      <GraphqlMutationNode
        {...baseProps({ label: 'Mut3', endpoint: 'mailto:test@example.com' })}
      />,
    );

    expect(screen.getByText('mailto:test@example.com')).toBeTruthy();
    expect(screen.queryByText(/extraction/)).toBeNull();
  });

  it('GraphqlMutationNode shows plural extraction label', () => {
    render(
      <GraphqlMutationNode
        {...baseProps({
          label: 'Mut4',
          endpoint: 'https://mut.example.com/graphql',
          extractionRules: [{ id: 'a' }, { id: 'b' }],
        })}
      />,
    );

    expect(screen.getByText('2 extractions')).toBeTruthy();
  });

  it('GraphqlSubscriptionNode renders stop condition variants', () => {
    const { rerender } = render(
      <GraphqlSubscriptionNode
        {...baseProps({
          label: 'Sub',
          endpoint: 'wss://example.com/graphql',
          stopAfterMessages: 1,
        })}
      />,
    );

    expect(screen.getByText('Stop after 1 msg')).toBeTruthy();

    rerender(
      <GraphqlSubscriptionNode
        {...baseProps({
          label: 'Sub',
          endpoint: 'wss://example.com/graphql',
          stopAfterMs: 2500,
        })}
      />,
    );
    expect(screen.getByText('Stop after 2500ms')).toBeTruthy();

    rerender(
      <GraphqlSubscriptionNode
        {...baseProps({
          label: 'Sub',
          endpoint: 'wss://example.com/graphql',
          stopCondition: '$.done',
        })}
      />,
    );
    expect(screen.getByText('Conditional stop')).toBeTruthy();

    rerender(
      <GraphqlSubscriptionNode
        {...baseProps({ label: 'Sub', endpoint: '' })}
      />,
    );
    expect(screen.getByText('No stop condition')).toBeTruthy();
  });

  it('GraphqlSubscriptionNode renders plural stop message and selected class', () => {
    const { container } = render(
      <GraphqlSubscriptionNode
        {...baseProps({
          label: '',
          endpoint: 'https://sub.example.com/graphql',
          stopAfterMessages: 3,
        }, true)}
      />,
    );

    expect(screen.getByText('GraphQL Subscription')).toBeTruthy();
    expect(screen.getByText('sub.example.com')).toBeTruthy();
    expect(screen.getByText('Stop after 3 msgs')).toBeTruthy();
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('GraphqlIntrospectNode toggles validation badge text', () => {
    const { rerender } = render(
      <GraphqlIntrospectNode
        {...baseProps({
          label: 'Introspect',
          endpoint: 'https://api.example.com/graphql',
          minTypeCount: 1,
        })}
      />,
    );
    expect(screen.getByText('Schema validation enabled')).toBeTruthy();

    rerender(
      <GraphqlIntrospectNode
        {...baseProps({ label: 'Introspect', endpoint: 'https://api.example.com/graphql' })}
      />,
    );
    expect(screen.queryByText('Schema validation enabled')).toBeNull();
  });

  it('GraphqlIntrospectNode falls back for invalid endpoint and supports selected class', () => {
    const { container } = render(
      <GraphqlIntrospectNode
        {...baseProps(
          {
            label: '',
            endpoint: '',
            requiredTypes: ['User'],
            requiredFields: [{ typeName: 'User', fieldName: 'id' }],
          },
          true,
        )}
      />,
    );

    expect(screen.getByText('GraphQL Introspect')).toBeTruthy();
    expect(screen.getByText('No endpoint')).toBeTruthy();
    expect(screen.getByText('Schema validation enabled')).toBeTruthy();
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('GraphqlAssertNode renders source fallback and fail behavior copy', () => {
    const { rerender } = render(
      <GraphqlAssertNode
        {...baseProps({
          label: 'Assert',
          sourceVariable: 'gql.data',
          assertions: [{ jsonPath: '$.ok', operator: '=', expected: true }],
          failBehavior: 'warn',
        })}
      />,
    );

    expect(screen.getByText('gql.data')).toBeTruthy();
    expect(screen.getByText(/1 assertion/)).toBeTruthy();
    expect(screen.getByText(/warn on fail/)).toBeTruthy();

    rerender(
      <GraphqlAssertNode
        {...baseProps({ label: '', sourceVariable: '', assertions: [], failBehavior: 'error' })}
      />,
    );

    expect(screen.getByText('GraphQL Assert')).toBeTruthy();
    expect(screen.getByText('No source variable')).toBeTruthy();
    expect(screen.getByText(/0 assertions/)).toBeTruthy();
    expect(screen.getByText(/halt on fail/)).toBeTruthy();
  });

  it('GraphqlQueryNode shows plural extractions when count is not 1', () => {
    render(
      <GraphqlQueryNode
        {...baseProps({
          label: 'Q3',
          endpoint: 'https://api.example.com/graphql',
          extractionRules: [{ jsonPath: '$.a' }, { jsonPath: '$.b' }],
        })}
      />,
    );

    expect(screen.getByText('2 extractions')).toBeTruthy();
  });

  it('GraphqlMutationNode renders host from valid endpoint URL', () => {
    render(
      <GraphqlMutationNode
        {...baseProps({
          label: 'Mut2',
          endpoint: 'https://mut.example.com/graphql',
          extractionRules: [],
        })}
      />,
    );

    expect(screen.getByText('mut.example.com')).toBeTruthy();
  });

  it('GraphqlAssertNode uses singular assertion text and selected class', () => {
    const { container } = render(
      <GraphqlAssertNode
        {...baseProps({
          label: 'Assert2',
          sourceVariable: 'payload',
          assertions: [{ jsonPath: '$.ok' }],
          failBehavior: 'warn',
        }, true)}
      />,
    );

    expect(screen.getByText(/1 assertion/)).toBeTruthy();
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('GraphqlAssertNode treats undefined assertions as zero count', () => {
    render(
      <GraphqlAssertNode
        {...baseProps({
          label: 'Assert3',
          sourceVariable: 'payload',
          failBehavior: 'error',
        })}
      />,
    );

    expect(screen.getByText(/0 assertions/)).toBeTruthy();
  });

  it('renders handles/status/overlay and configure callback', () => {
    render(<GraphqlQueryNode {...baseProps({ label: 'Q', endpoint: '', extractionRules: [] })} />);

    expect(screen.getByTestId('handle-target')).toBeTruthy();
    expect(screen.getByTestId('handle-source')).toBeTruthy();
    expect(screen.getByTestId('node-status-badge')).toBeTruthy();
    expect(screen.getByTestId('paused-node-1')).toBeTruthy();

    fireEvent.click(screen.getByTestId('node-configure'));
    expect(handleConfigure).toHaveBeenCalled();
  });
});
