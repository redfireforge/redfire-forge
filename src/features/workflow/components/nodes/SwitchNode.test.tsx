/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SwitchNode from './SwitchNode';

vi.mock('@xyflow/react', () => ({
  Handle: (props: { type: string; id?: string; style?: React.CSSProperties }) => <div data-testid={`handle-${props.type}${props.id ? `-${props.id}` : ''}`} data-left={props.style?.left as string | undefined} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

const handleConfigure = vi.fn();
const useNodeBaseMock = vi.hoisted(() => vi.fn(() => ({ rs: { state: 'idle' }, stateClass: '', debugStep: true, handleConfigure })));
vi.mock('./useNodeBase', () => ({ useNodeBase: (id: string) => useNodeBaseMock(id) }));
vi.mock('./NodeIcon', () => ({ NodeIcon: () => <div data-testid="node-icon" />, getNodeCategory: () => 'Logic' }));
vi.mock('./NodeConfigureButton', () => ({ NodeConfigureButton: (props: { title: string; onClick: (e: React.MouseEvent) => void }) => <button data-testid="configure-btn" title={props.title} onClick={(e) => props.onClick(e as never)}>cfg</button> }));
vi.mock('./NodePausedOverlay', () => ({ NodePausedOverlay: (props: { nodeId: string }) => <div data-testid={`paused-${props.nodeId}`} /> }));
vi.mock('./NodeStatusBadge', () => ({ NodeStatusBadge: () => <div data-testid="status-badge" /> }));

describe('SwitchNode', () => {
  const baseProps = {
    id: 'switch-1',
    data: {
      label: 'Switch It',
      expression: '{{status}}',
      cases: [
        { id: 'c1', label: 'OK', value: '200' },
        { id: 'c2', label: 'Bad', value: '500' },
      ],
    } as never,
    selected: false,
    dragging: false,
    zIndex: 1,
    type: 'switch' as const,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
  };

  it('renders expression, case badge, labels, footer button, status, overlay, and handles', () => {
    render(<SwitchNode {...baseProps} />);
    expect(screen.getByText('Switch It')).toBeTruthy();
    expect(screen.getByText('Logic')).toBeTruthy();
    expect(screen.getByText('{{status}}')).toBeTruthy();
    expect(screen.getByText('2 cases')).toBeTruthy();
    expect(screen.getByText('OK')).toBeTruthy();
    expect(screen.getByText('Bad')).toBeTruthy();
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByTestId('status-badge')).toBeTruthy();
    expect(screen.getByTestId('paused-switch-1')).toBeTruthy();
    expect(screen.getByTestId('handle-target')).toBeTruthy();
    expect(screen.getByTestId('handle-source-case-c1')).toBeTruthy();
    expect(screen.getByTestId('handle-source-case-c2')).toBeTruthy();
    expect(screen.getByTestId('handle-source-default')).toBeTruthy();
  });

  it('falls back to default label and placeholder expression with no cases', () => {
    render(<SwitchNode {...baseProps} data={{ cases: [] } as never} />);
    expect(screen.getByText('Switch')).toBeTruthy();
    expect(screen.getByText('Configure expression…')).toBeTruthy();
    expect(screen.queryByText(/cases/)).toBeNull();
  });

  it('renders a singular case badge and falls back to case value when label is missing', () => {
    render(
      <SwitchNode
        {...baseProps}
        data={{ expression: '{{status}}', cases: [{ id: 'c1', value: '201' }] } as never}
      />,
    );
    expect(screen.getByText('1 case')).toBeTruthy();
    expect(screen.getByText('201')).toBeTruthy();
  });

  it('applies selected class and calls configure handler', () => {
    handleConfigure.mockClear();
    const { container } = render(<SwitchNode {...baseProps} selected={true} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
    fireEvent.click(screen.getByTestId('configure-btn'));
    expect(handleConfigure).toHaveBeenCalled();
  });
});
