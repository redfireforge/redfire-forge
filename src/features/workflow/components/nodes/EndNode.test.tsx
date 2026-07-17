/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EndNode from './EndNode';

vi.mock('@xyflow/react', () => ({
  Handle: (props: { type: string }) => <div data-testid={`handle-${props.type}`} />,
  Position: { Top: 'top' },
}));

const useNodeBaseMock = vi.hoisted(() => vi.fn(() => ({ rs: { state: 'pass' }, stateClass: 'wf-node-pass', debugStep: true })));
vi.mock('./useNodeBase', () => ({ useNodeBase: (id: string) => useNodeBaseMock(id) }));
vi.mock('./NodeIcon', () => ({ NodeIcon: () => <div data-testid="node-icon" />, getNodeCategory: () => 'Terminal' }));
vi.mock('./NodePausedOverlay', () => ({ NodePausedOverlay: (props: { nodeId: string }) => <div data-testid={`paused-${props.nodeId}`} /> }));

describe('EndNode', () => {
  const baseProps = {
    id: 'end-1',
    data: { label: 'Finished' } as never,
    selected: false,
    dragging: false,
    zIndex: 1,
    type: 'end' as const,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
  };

  it('renders label, category, icon, paused overlay, and target handle', () => {
    render(<EndNode {...baseProps} />);
    expect(useNodeBaseMock).toHaveBeenCalledWith('end-1');
    expect(screen.getByText('Finished')).toBeTruthy();
    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.getByTestId('node-icon')).toBeTruthy();
    expect(screen.getByTestId('paused-end-1')).toBeTruthy();
    expect(screen.getByTestId('handle-target')).toBeTruthy();
    expect(screen.getByText('✓ Completed')).toBeTruthy();
  });

  it('falls back to default label and renders fail state details', () => {
    useNodeBaseMock.mockReturnValueOnce({ rs: { state: 'fail', error: 'boom', responseDetail: 'Bad response' }, stateClass: '', debugStep: null });
    render(<EndNode {...baseProps} data={{} as never} />);
    expect(screen.getByText('End')).toBeTruthy();
    expect(screen.getByText('✗ Failed')).toBeTruthy();
    expect(screen.getByText('Bad response')).toBeTruthy();
  });
});
