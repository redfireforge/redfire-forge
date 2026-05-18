/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WaitForConditionNode from './WaitForConditionNode';
import type { WaitForConditionNodeData } from '../../types/workflow';

vi.mock('@xyflow/react', () => ({
  Handle: ({ id, type, position, className, style }: { id?: string; type: string; position: string; className?: string; style?: object }) => (
    <div data-testid={`handle-${type}${id ? `-${id}` : ''}`} data-position={position} className={className} style={style as Record<string, string | number>} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}));

const mockConfigure = vi.fn();
vi.mock('./useNodeBase', () => ({
  useNodeBase: (_nodeId: string) => ({
    rs: null,
    stateClass: '',
    debugStep: null,
    handleConfigure: mockConfigure,
  }),
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: (type: string) => (type === 'waitForCondition' ? 'Control' : ''),
}));

vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ title, onClick }: { title?: string; onClick: () => void }) => (
    <button type="button" className="node-config-btn" title={title} onClick={onClick}>Cfg</button>
  ),
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: ({ nodeId, state }: { nodeId: string; state?: string }) => (
    <div data-testid="paused-overlay" data-node={nodeId} data-state={state ?? ''} />
  ),
}));

function makeProps(data: Partial<WaitForConditionNodeData> = {}, opts: { selected?: boolean } = {}) {
  const fullData: WaitForConditionNodeData = {
    label: 'Wait',
    conditionExpression: '{{done}} === true',
    pollIntervalMs: 500,
    timeoutMs: 5000,
    maxAttempts: 3,
    ...data,
  };
  return {
    id: 'wfc-1',
    data: fullData,
    selected: opts.selected ?? false,
    type: 'waitForCondition' as const,
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

describe('WaitForConditionNode', () => {
  it('shows shortened condition preview when expression is longer than 35 chars', () => {
    const long = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // 36 chars — no ellipsis in slice; need >35 content
    const expr = `${long}x`; // 37 chars
    const { container } = render(<WaitForConditionNode {...makeProps({ conditionExpression: expr })} />);
    const el = container.querySelector('.wf-waitcond-condition');
    expect(el?.textContent).toContain('…');
    expect((el?.textContent ?? '').length).toBeLessThan(expr.length);
  });

  it('shows full condition when at most 35 characters', () => {
    const expr = '{{status}} === "ok"'; // length < 36
    const { container } = render(<WaitForConditionNode {...makeProps({ conditionExpression: expr })} />);
    expect(container.querySelector('.wf-waitcond-condition')).toHaveTextContent(expr);
  });

  it('shows "No condition" when expression missing or empty', () => {
    const { rerender, container } = render(<WaitForConditionNode {...makeProps({ conditionExpression: '' })} />);
    expect(container.querySelector('.wf-waitcond-condition')).toHaveTextContent('No condition');
    rerender(<WaitForConditionNode {...makeProps({ conditionExpression: undefined as unknown as string })} />);
    expect(container.querySelector('.wf-waitcond-condition')).toHaveTextContent('No condition');
  });

  it('shows millisecond poll and timeout labels when values are below 1000ms', () => {
    const { container } = render(
      <WaitForConditionNode {...makeProps({ pollIntervalMs: 250, timeoutMs: 499, maxAttempts: 0 })} />
    );
    expect(container.querySelector('.wf-waitcond-meta')).toHaveTextContent('250ms poll');
    expect(container.querySelector('.wf-waitcond-meta')).toHaveTextContent('499ms timeout');
  });

  it('shows second-based labels when poll and timeout are at least one second', () => {
    const { container } = render(
      <WaitForConditionNode {...makeProps({ pollIntervalMs: 1000, timeoutMs: 3000 })} />
    );
    expect(container.querySelector('.wf-waitcond-meta')).toHaveTextContent('1s poll');
    expect(container.querySelector('.wf-waitcond-meta')).toHaveTextContent('3s timeout');
  });

  it('shows "No timeout" when timeout is zero', () => {
    const { container } = render(<WaitForConditionNode {...makeProps({ timeoutMs: 0 })} />);
    expect(container.querySelector('.wf-waitcond-meta')).toHaveTextContent('No timeout');
  });

  it('shows max attempts only when maxAttempts is greater than zero', () => {
    const { container, rerender } = render(
      <WaitForConditionNode {...makeProps({ maxAttempts: 12 })} />
    );
    expect(container.querySelector('.wf-waitcond-meta')).toHaveTextContent('max 12');
    rerender(<WaitForConditionNode {...makeProps({ maxAttempts: 0 })} />);
    expect(container.querySelector('.wf-waitcond-meta')?.textContent).not.toMatch(/max/);
  });

  it('falls back to default title when label is empty', () => {
    render(<WaitForConditionNode {...makeProps({ label: '' })} />);
    expect(screen.getByText('Wait for Condition')).toBeInTheDocument();
  });

  it('renders custom label when provided', () => {
    render(<WaitForConditionNode {...makeProps({ label: 'Gate readiness' })} />);
    expect(screen.getByText('Gate readiness')).toBeInTheDocument();
  });

  it('applies selected styling when selected', () => {
    const { container } = render(<WaitForConditionNode {...makeProps({}, { selected: true })} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('renders Poll and Done handles and category', () => {
    const { container, getByTestId } = render(<WaitForConditionNode {...makeProps()} />);
    expect(container.textContent).toContain('Poll');
    expect(container.textContent).toContain('Done');
    expect(container.textContent).toContain('Control');
    expect(getByTestId('handle-target')).toBeInTheDocument();
    expect(getByTestId('handle-source-body')).toBeInTheDocument();
    expect(getByTestId('handle-source-done')).toBeInTheDocument();
    expect(getByTestId('icon-waitForCondition')).toBeInTheDocument();
  });

  it('sets condition element title to full expression for hover', () => {
    const expr = 'a'.repeat(40);
    const { container } = render(<WaitForConditionNode {...makeProps({ conditionExpression: expr })} />);
    const el = container.querySelector('.wf-waitcond-condition');
    expect(el).toHaveAttribute('title', expr);
  });

  it('documents timeout edge at 999ms as milliseconds not seconds', () => {
    const { container } = render(<WaitForConditionNode {...makeProps({ timeoutMs: 999 })} />);
    expect(container.querySelector('.wf-waitcond-meta')).toHaveTextContent('999ms timeout');
    expect(container.querySelector('.wf-waitcond-meta')?.textContent).not.toMatch(/0\.999/);
  });
});
