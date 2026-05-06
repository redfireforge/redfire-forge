/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import LoopNode from './LoopNode';
import type { LoopNodeData } from '../../types/workflow';

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, id, className }: { type: string; position: string; id?: string; className?: string }) => (
    <div data-testid={`handle-${type}${id ? `-${id}` : ''}`} data-position={position} className={className} />
  ),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

const handleConfigure = vi.fn();
vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: null,
    stateClass: '',
    debugStep: null,
    handleConfigure,
    openStepDetail: vi.fn(),
  }),
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: () => 'Loop',
}));

vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ onClick, title }: { onClick: () => void; title: string }) => (
    <button type="button" data-testid="configure" title={title} onClick={onClick}>
      cfg
    </button>
  ),
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: () => <div data-testid="paused-overlay" />,
}));

function makeProps(data: LoopNodeData, selected = false) {
  return {
    id: 'loop-1',
    data,
    selected,
    type: 'loop' as const,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    dragHandle: undefined,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
  };
}

describe('LoopNode', () => {
  it('shows count badge from countExpression when set', () => {
    const data: LoopNodeData = {
      label: 'L',
      mode: 'count',
      count: 3,
      countExpression: '{{n}}',
    };
    render(<LoopNode {...makeProps(data)} />);
    expect(screen.getByTitle('×{{n}}')).toBeTruthy();
  });

  it('shows count badge from numeric count when no expression', () => {
    const data: LoopNodeData = { label: 'L', mode: 'count', count: 5 };
    render(<LoopNode {...makeProps(data)} />);
    expect(screen.getByTitle('×5')).toBeTruthy();
  });

  it('defaults count badge to 1 when count missing', () => {
    const data: LoopNodeData = { label: 'L', mode: 'count' };
    render(<LoopNode {...makeProps(data)} />);
    expect(screen.getByTitle('×1')).toBeTruthy();
  });

  it('shows forEach badge with item variable default', () => {
    const data: LoopNodeData = { label: 'L', mode: 'forEach', sourceExpression: '{{x}}' };
    render(<LoopNode {...makeProps(data)} />);
    expect(screen.getByTitle('∀ item')).toBeTruthy();
  });

  it('shows while condition when operands set', () => {
    const data: LoopNodeData = {
      label: 'L',
      mode: 'while',
      whileLeft: '{{a}}',
      whileOperator: '>',
      whileRight: '1',
    };
    render(<LoopNode {...makeProps(data)} />);
    expect(screen.getByTitle('{{a}} > 1')).toBeTruthy();
  });

  it('shows while placeholder when operands incomplete', () => {
    const data: LoopNodeData = { label: 'L', mode: 'while', whileLeft: '{{a}}' };
    render(<LoopNode {...makeProps(data)} />);
    expect(screen.getByTitle('while …')).toBeTruthy();
  });

  it('shows max iterations when not default 100', () => {
    const data: LoopNodeData = { label: 'L', mode: 'count', count: 2, maxIterations: 50 };
    render(<LoopNode {...makeProps(data)} />);
    expect(screen.getByText('max 50')).toBeTruthy();
  });

  it('omits max iterations when default 100', () => {
    const data: LoopNodeData = { label: 'L', mode: 'count', count: 2, maxIterations: 100 };
    render(<LoopNode {...makeProps(data)} />);
    expect(screen.queryByText(/max /)).toBeNull();
  });

  it('uses default label when empty', () => {
    const data: LoopNodeData = { label: '', mode: 'count', count: 1 };
    const { container } = render(<LoopNode {...makeProps(data)} />);
    expect(container.querySelector('.wf-node-label')?.textContent).toBe('Loop');
  });

  it('falls back to empty mode badge for unknown mode', () => {
    const data = { label: 'L', mode: 'count' as const, count: 1 };
    (data as LoopNodeData & { mode: string }).mode = 'unknown';
    const { container } = render(<LoopNode {...makeProps(data as LoopNodeData)} />);
    const badge = container.querySelector('.wf-loop-badge');
    expect(badge?.textContent).toBe('');
  });

  it('applies selected class and calls configure', () => {
    const data: LoopNodeData = { label: 'X', mode: 'count', count: 1 };
    const { container } = render(<LoopNode {...makeProps(data, true)} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
    fireEvent.click(screen.getByTestId('configure'));
    expect(handleConfigure).toHaveBeenCalled();
  });
});
