/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import KafkaProduceNode from './KafkaProduceNode';
import type { KafkaProduceNodeData } from '../../types/workflow';

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
  getNodeCategory: (type: string) => type === 'kafkaProduce' ? 'Integration' : '',
}));

// Mock sub-components
vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ onClick, title }: { onClick: () => void; title?: string }) => (
    <button type="button" data-testid="configure" title={title} onClick={onClick}>cfg</button>
  ),
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: () => <div data-testid="paused" />,
}));

vi.mock('./NodeStatusBadge', () => ({
  NodeStatusBadge: () => <div data-testid="status-badge" />,
}));

function makeProps(data: Partial<KafkaProduceNodeData> = {}) {
  const fullData: KafkaProduceNodeData = {
    label: 'Kafka Produce',
    clusterId: 'cluster-a',
    topic: 'orders.events',
    ...data,
  } as KafkaProduceNodeData;
  return {
    id: 'kp-1',
    data: fullData,
    selected: false,
    type: 'kafkaProduce' as const,
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

describe('KafkaProduceNode', () => {
  it('renders with default label', () => {
    const { container } = render(<KafkaProduceNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-kafkaProduce')).toBeTruthy();
    expect(container.textContent).toContain('Kafka Produce');
  });

  it('renders custom label', () => {
    const { container } = render(<KafkaProduceNode {...makeProps({ label: 'Order Publisher' })} />);
    expect(container.textContent).toContain('Order Publisher');
  });

  it('renders fallback label when empty', () => {
    const { container } = render(<KafkaProduceNode {...makeProps({ label: '' })} />);
    expect(container.textContent).toContain('Kafka Produce');
  });

  it('renders topic preview', () => {
    const { container } = render(<KafkaProduceNode {...makeProps({ topic: 'payments.events' })} />);
    expect(container.textContent).toContain('payments.events');
  });

  it('renders "No topic" when topic is empty', () => {
    const { container } = render(<KafkaProduceNode {...makeProps({ topic: '' })} />);
    expect(container.textContent).toContain('No topic');
  });

  it('renders cluster ID when provided', () => {
    const { container } = render(<KafkaProduceNode {...makeProps({ clusterId: 'cluster-prod' })} />);
    expect(container.textContent).toContain('cluster-prod');
  });

  it('does not render cluster row when clusterId is empty', () => {
    const { container } = render(<KafkaProduceNode {...makeProps({ clusterId: '' })} />);
    expect(container.querySelector('.wf-kafka-cluster')).toBeNull();
  });

  it('renders header count when headers are present', () => {
    const props = makeProps({
      headers: [
        { id: 'h1', key: 'x-trace', value: 'abc', enabled: true },
        { id: 'h2', key: 'x-req', value: 'def', enabled: true },
      ],
    });
    const { container } = render(<KafkaProduceNode {...props} />);
    expect(container.textContent).toContain('2 headers');
  });

  it('renders singular "header" when exactly one header', () => {
    const props = makeProps({
      headers: [{ id: 'h1', key: 'x-trace', value: 'abc', enabled: true }],
    });
    const { container } = render(<KafkaProduceNode {...props} />);
    expect(container.textContent).toContain('1 header');
    expect(container.textContent).not.toContain('1 headers');
  });

  it('does not render header count row when no headers', () => {
    const { container } = render(<KafkaProduceNode {...makeProps({ headers: [] })} />);
    expect(container.querySelector('.wf-kafka-meta')).toBeNull();
  });

  it('does not render header count row when headers is undefined', () => {
    const { container } = render(<KafkaProduceNode {...makeProps({ headers: undefined })} />);
    expect(container.querySelector('.wf-kafka-meta')).toBeNull();
  });

  it('renders kafkaProduce icon', () => {
    const { getByTestId } = render(<KafkaProduceNode {...makeProps()} />);
    expect(getByTestId('icon-kafkaProduce')).toBeTruthy();
  });

  it('renders target and source handles', () => {
    const { getByTestId } = render(<KafkaProduceNode {...makeProps()} />);
    expect(getByTestId('handle-target')).toBeTruthy();
    expect(getByTestId('handle-source')).toBeTruthy();
  });

  it('applies selected class when selected', () => {
    const { container } = render(<KafkaProduceNode {...makeProps()} selected={true} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('does not apply selected class when not selected', () => {
    const { container } = render(<KafkaProduceNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-selected')).toBeNull();
  });

  it('renders category sublabel', () => {
    const { container } = render(<KafkaProduceNode {...makeProps()} />);
    expect(container.textContent).toContain('Integration');
  });

  it('renders configure button in footer', () => {
    const { getByTestId } = render(<KafkaProduceNode {...makeProps()} />);
    expect(getByTestId('configure')).toBeTruthy();
  });
});
