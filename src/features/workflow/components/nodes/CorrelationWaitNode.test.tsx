/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CorrelationWaitNode from './CorrelationWaitNode';
import type { CorrelationWaitNodeData } from '../../types/workflow';

// Mock ReactFlow handles
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, className }: { type: string; position: string; className?: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} className={className} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}));

// Mock useNodeBase
vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: null,
    stateClass: '',
    debugStep: null,
    handleConfigure: vi.fn(),
    openStepDetail: vi.fn(),
  }),
}));

// Mock NodeIcon
vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: (type: string) => type === 'correlationWait' ? 'Action' : '',
}));

function makeProps(data: Partial<CorrelationWaitNodeData> = {}) {
  const fullData: CorrelationWaitNodeData = {
    label: 'Correlation Wait',
    correlationIdExpression: '{{paymentId}}',
    webhookPath: '/webhooks/payment',
    correlationSource: 'body',
    correlationJsonPath: '$.correlationId',
    extractVariables: [],
    timeoutMs: 60000,
    ...data,
  };
  return {
    id: 'cw-1',
    data: fullData,
    selected: false,
    type: 'correlationWait' as const,
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

describe('CorrelationWaitNode', () => {
  it('renders with default label', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-correlationWait')).toBeTruthy();
    expect(container.textContent).toContain('Correlation Wait');
  });

  it('renders custom label', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ label: 'Wait for Payment' })} />);
    expect(container.textContent).toContain('Wait for Payment');
  });

  it('renders fallback label when empty', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ label: '' })} />);
    expect(container.textContent).toContain('Correlation Wait');
  });

  it('renders correlation ID preview', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ correlationIdExpression: '{{paymentId}}' })} />);
    expect(container.textContent).toContain('{{paymentId}}');
  });

  it('truncates long correlation ID expression', () => {
    const longExpr = '{{very.long.nested.correlation.id.expression}}';
    const { container } = render(<CorrelationWaitNode {...makeProps({ correlationIdExpression: longExpr })} />);
    const corrDiv = container.querySelector('.wf-correlation-id');
    expect(corrDiv?.textContent).toContain('…');
  });

  it('shows "Not configured" when correlation ID is empty', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ correlationIdExpression: '' })} />);
    expect(container.textContent).toContain('Not configured');
  });

  it('renders webhook path', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ webhookPath: '/webhooks/payment' })} />);
    expect(container.textContent).toContain('/webhooks/payment');
  });

  it('renders fallback webhook path when empty', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ webhookPath: '' })} />);
    expect(container.textContent).toContain('/webhooks/...');
  });

  it('renders timeout in milliseconds', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ timeoutMs: 500 })} />);
    expect(container.textContent).toContain('500ms');
  });

  it('renders timeout in seconds', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ timeoutMs: 5000 })} />);
    expect(container.textContent).toContain('5s');
  });

  it('renders timeout in minutes', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ timeoutMs: 120000 })} />);
    expect(container.textContent).toContain('2m');
  });

  it('renders "No timeout" when timeoutMs is 0', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps({ timeoutMs: 0 })} />);
    expect(container.textContent).toContain('No timeout');
  });

  it('renders correlationWait icon', () => {
    const { getByTestId } = render(<CorrelationWaitNode {...makeProps()} />);
    expect(getByTestId('icon-correlationWait')).toBeTruthy();
  });

  it('renders target and source handles', () => {
    const { getByTestId } = render(<CorrelationWaitNode {...makeProps()} />);
    expect(getByTestId('handle-target')).toBeTruthy();
    expect(getByTestId('handle-source')).toBeTruthy();
  });

  it('applies selected class when selected', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps()} selected={true} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('does not apply selected class when not selected', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-selected')).toBeNull();
  });

  it('renders category sublabel', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps()} />);
    expect(container.textContent).toContain('Action');
  });

  it('renders configure button', () => {
    const { container } = render(<CorrelationWaitNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-footer')).toBeTruthy();
  });
});
