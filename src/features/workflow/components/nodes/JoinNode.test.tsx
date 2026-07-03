/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import JoinNode from './JoinNode';

vi.mock('@xyflow/react', () => ({
  Handle: (props: { type: string; id?: string }) => <div data-testid={`handle-${props.type}${props.id ? `-${props.id}` : ''}`} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

const useNodeBaseMock = vi.hoisted(() => vi.fn(() => ({ rs: { state: 'running', responseDetail: 'Waiting for branches' }, stateClass: 'wf-node-running', debugStep: true })));
vi.mock('./useNodeBase', () => ({ useNodeBase: (id: string) => useNodeBaseMock(id) }));
vi.mock('./NodeIcon', () => ({ NodeIcon: () => <div data-testid="node-icon" />, getNodeCategory: () => 'Flow' }));
vi.mock('./NodePausedOverlay', () => ({ NodePausedOverlay: (props: { nodeId: string }) => <div data-testid={`paused-${props.nodeId}`} /> }));

describe('JoinNode', () => {
  const baseProps = {
    id: 'join-1',
    data: { label: 'My Join' } as never,
    selected: false,
    dragging: false,
    zIndex: 1,
    type: 'join' as const,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
  };

  it('renders waiting detail, icon, category, overlay, and handles', () => {
    render(<JoinNode {...baseProps} />);
    expect(screen.getByText('My Join')).toBeTruthy();
    expect(screen.getByText('Flow')).toBeTruthy();
    expect(screen.getByText('Waiting for branches')).toBeTruthy();
    expect(screen.getByTestId('node-icon')).toBeTruthy();
    expect(screen.getByTestId('paused-join-1')).toBeTruthy();
    expect(screen.getByTestId('handle-target')).toBeTruthy();
    expect(screen.getByTestId('handle-source-out')).toBeTruthy();
  });

  it('shows joined badge on pass and hides waiting text otherwise', () => {
    useNodeBaseMock.mockReturnValueOnce({ rs: { state: 'pass' }, stateClass: '', debugStep: null });
    render(<JoinNode {...baseProps} data={{} as never} />);
    expect(screen.getByText('Join')).toBeTruthy();
    expect(screen.getByText('✓ Joined')).toBeTruthy();
  });

  it('shows waiting detail for pending state and applies selected class', () => {
    useNodeBaseMock.mockReturnValueOnce({ rs: { state: 'pending', responseDetail: 'Still pending' }, stateClass: '', debugStep: null });
    const { container } = render(<JoinNode {...baseProps} selected={true} />);
    expect(screen.getByText('Still pending')).toBeTruthy();
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });
});
