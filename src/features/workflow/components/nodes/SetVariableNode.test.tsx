/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SetVariableNode from './SetVariableNode';

vi.mock('@xyflow/react', () => ({
  Handle: (props: { type: string }) => <div data-testid={`handle-${props.type}`} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

const handleConfigure = vi.fn();
const useNodeBaseMock = vi.hoisted(() => vi.fn(() => ({ rs: { state: 'pass' }, stateClass: '', debugStep: true, handleConfigure })));
vi.mock('./useNodeBase', () => ({ useNodeBase: (id: string) => useNodeBaseMock(id) }));
vi.mock('./NodeIcon', () => ({ NodeIcon: () => <div data-testid="node-icon" />, getNodeCategory: () => 'Data' }));
vi.mock('./NodeConfigureButton', () => ({ NodeConfigureButton: (props: { title: string; onClick: (e: React.MouseEvent) => void }) => <button data-testid="configure-btn" title={props.title} onClick={(e) => props.onClick(e as never)}>cfg</button> }));
vi.mock('./NodePausedOverlay', () => ({ NodePausedOverlay: (props: { nodeId: string }) => <div data-testid={`paused-${props.nodeId}`} /> }));
vi.mock('./NodeStatusBadge', () => ({ NodeStatusBadge: () => <div data-testid="status-badge" /> }));

describe('SetVariableNode', () => {
  const baseProps = {
    id: 'set-1',
    data: {
      label: 'Vars',
      assignments: [
        { id: 'a1', name: 'x', expression: '{{y}}' },
        { id: 'a2', name: 'z', expression: '42' },
        { id: 'a3', name: 'more', expression: 'v' },
      ],
    } as never,
    selected: false,
    dragging: false,
    zIndex: 1,
    type: 'setVariable' as const,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
  };

  it('renders label, preview, counts, configure footer, status, overlay, and handles', () => {
    render(<SetVariableNode {...baseProps} />);
    expect(screen.getByText('Vars')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.getByText('3 assignments')).toBeTruthy();
    expect(screen.getByText('x = {{y}}')).toBeTruthy();
    expect(screen.getByText('z = 42')).toBeTruthy();
    expect(screen.getByText('+1 more')).toBeTruthy();
    expect(screen.getByTestId('status-badge')).toBeTruthy();
    expect(screen.getByTestId('paused-set-1')).toBeTruthy();
    expect(screen.getByTestId('handle-target')).toBeTruthy();
    expect(screen.getByTestId('handle-source')).toBeTruthy();
  });

  it('falls back to default label and hides preview when there are no assignments', () => {
    render(<SetVariableNode {...baseProps} data={{ assignments: [] } as never} />);
    expect(screen.getByText('Set Variable')).toBeTruthy();
    expect(screen.queryByText(/assignment/)).toBeNull();
  });

  it('renders a singular assignment badge without overflow preview and applies selected class', () => {
    const { container } = render(
      <SetVariableNode
        {...baseProps}
        selected={true}
        data={{ assignments: [{ id: 'a1', name: 'only', expression: '1' }] } as never}
      />,
    );
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
    expect(screen.getByText('1 assignment')).toBeTruthy();
    expect(screen.getByText('only = 1')).toBeTruthy();
    expect(screen.queryByText(/\+\d+ more/)).toBeNull();
  });

  it('calls configure handler from footer button', () => {
    handleConfigure.mockClear();
    render(<SetVariableNode {...baseProps} />);
    fireEvent.click(screen.getByTestId('configure-btn'));
    expect(handleConfigure).toHaveBeenCalled();
  });
});
