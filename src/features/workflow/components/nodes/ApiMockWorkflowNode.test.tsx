/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ApiMockWorkflowNode from './ApiMockWorkflowNode';

const handleConfigure = vi.fn();
vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: { state: 'idle' },
    stateClass: 'wf-idle',
    debugStep: false,
    handleConfigure,
  }),
}));

vi.mock('@xyflow/react', () => ({
  Handle: ({ type }: { type: string }) => <div data-testid={`handle-${type}`} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <span data-testid={`icon-${type}`} />,
  getNodeCategory: () => 'API Mock',
}));

vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ onClick }: { onClick: () => void }) => (
    <button type="button" data-testid="configure" onClick={onClick}>Configure</button>
  ),
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: () => null,
}));

vi.mock('./NodeStatusBadge', () => ({
  NodeStatusBadge: () => null,
}));

function renderNode(props: {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  selected?: boolean;
}) {
  const nodeProps = {
    id: props.id,
    type: props.type,
    data: props.data,
    selected: props.selected ?? false,
  };
  return render(<ApiMockWorkflowNode {...(nodeProps as never)} />);
}

describe('ApiMockWorkflowNode', () => {
  it('renders start sublabel and configure action', () => {
    renderNode({
      id: 'n1',
      type: 'apiMockStart',
      data: { label: 'Start Mock', serverId: 'srv-1' },
    });
    expect(screen.getByTestId('api-mock-canvas-apiMockStart')).toBeTruthy();
    expect(screen.getByText('Start · srv-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('configure'));
    expect(handleConfigure).toHaveBeenCalled();
  });

  it('defaults type to apiMockStart and pick-server when serverId missing', () => {
    renderNode({
      id: 'n0',
      data: { label: 'Start' },
    });
    expect(screen.getByTestId('api-mock-canvas-apiMockStart')).toBeTruthy();
    expect(screen.getByText('Start · pick server')).toBeTruthy();
  });

  it('renders pick-server fallback for apply/reset/stop', () => {
    const { rerender } = renderNode({
      id: 'n2',
      type: 'apiMockApply',
      data: { label: 'Apply' },
      selected: true,
    });
    expect(screen.getByText('Apply · pick server')).toBeTruthy();
    expect(screen.getByTestId('api-mock-canvas-apiMockApply').className).toContain('wf-node-selected');

    rerender(
      <ApiMockWorkflowNode
        {...({
          id: 'n3',
          type: 'apiMockResetState',
          data: { label: 'Reset' },
          selected: false,
        } as never)}
      />,
    );
    expect(screen.getByText('Reset · pick server')).toBeTruthy();

    rerender(
      <ApiMockWorkflowNode
        {...({
          id: 'n3b',
          type: 'apiMockResetState',
          data: { serverId: 's' },
          selected: false,
        } as never)}
      />,
    );
    expect(screen.getByText('Reset · s')).toBeTruthy();

    rerender(
      <ApiMockWorkflowNode
        {...({
          id: 'n4',
          type: 'apiMockStop',
          data: { label: 'Stop' },
          selected: false,
        } as never)}
      />,
    );
    expect(screen.getByText('Stop · pick server')).toBeTruthy();
  });

  it('renders assert sublabels for count / min / default', () => {
    const { rerender } = renderNode({
      id: 'a1',
      type: 'apiMockAssertCalls',
      data: { serverId: 'srv', expectedCount: 2 },
    });
    expect(screen.getByText('Assert · srv · count=2')).toBeTruthy();

    rerender(
      <ApiMockWorkflowNode
        {...({
          id: 'a2',
          type: 'apiMockAssertCalls',
          data: { expectedMinCount: 1 },
          selected: false,
        } as never)}
      />,
    );
    expect(screen.getByText('Assert · pick server · min=1')).toBeTruthy();

    rerender(
      <ApiMockWorkflowNode
        {...({
          id: 'a3',
          type: 'apiMockAssertCalls',
          data: { serverId: 'x' },
          selected: false,
        } as never)}
      />,
    );
    expect(screen.getByText('Assert · x · assertions')).toBeTruthy();
  });

  it('falls back to API Mock detail for unknown node type', () => {
    renderNode({
      id: 'u1',
      type: 'apiMockUnknown',
      data: { label: 'X' },
    });
    expect(screen.getByText('API Mock', { selector: '.wf-ws-url' })).toBeTruthy();
  });

  it('renders reset-state sublabel', () => {
    renderNode({
      id: 'r1',
      type: 'apiMockResetState',
      data: { serverId: 'reset-srv' },
    });
    expect(screen.getByText('Reset · reset-srv')).toBeTruthy();
  });
});
