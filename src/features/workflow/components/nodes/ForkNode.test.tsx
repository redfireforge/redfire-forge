/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ForkNode from './ForkNode';

vi.mock('@xyflow/react', () => ({
  Handle: (props: { type: string; id?: string }) => <div data-testid={`handle-${props.type}${props.id ? `-${props.id}` : ''}`} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

const useNodeBaseMock = vi.hoisted(() => vi.fn(() => ({ rs: { state: 'running' }, stateClass: 'wf-node-running', debugStep: true })));
vi.mock('./useNodeBase', () => ({ useNodeBase: (id: string) => useNodeBaseMock(id) }));
vi.mock('./NodePausedOverlay', () => ({ NodePausedOverlay: (props: { nodeId: string }) => <div data-testid={`paused-${props.nodeId}`} /> }));
vi.mock('./NodeStatusBadge', () => ({ NodeStatusBadge: () => <div data-testid="status-badge" /> }));
vi.mock('./NodeIcon', () => ({
  NodeIcon: () => <div data-testid="node-icon" />,
  getNodeCategory: () => 'Flow',
}));

describe('ForkNode', () => {
  it('renders label, category, handles, and status UI', () => {
    render(
      <ForkNode
        id="fork-1"
        data={{ label: 'My Fork' } as never}
        selected={true}
        dragging={false}
        zIndex={1}
        type="fork"
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        isConnectable={true}
        xPos={0}
        yPos={0}
      />,
    );

    expect(useNodeBaseMock).toHaveBeenCalledWith('fork-1');
    expect(screen.getByText('My Fork')).toBeTruthy();
    expect(screen.getByText('Flow')).toBeTruthy();
    expect(screen.getByTestId('node-icon')).toBeTruthy();
    expect(screen.getByTestId('status-badge')).toBeTruthy();
    expect(screen.getByTestId('paused-fork-1')).toBeTruthy();
    expect(screen.getByTestId('handle-target')).toBeTruthy();
    expect(screen.getByTestId('handle-source-out')).toBeTruthy();
  });

  it('falls back to default label when none is provided', () => {
    render(
      <ForkNode
        id="fork-2"
        data={{} as never}
        selected={false}
        dragging={false}
        zIndex={1}
        type="fork"
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        isConnectable={true}
        xPos={0}
        yPos={0}
      />,
    );

    expect(screen.getByText('Parallel Fork')).toBeTruthy();
  });
});
