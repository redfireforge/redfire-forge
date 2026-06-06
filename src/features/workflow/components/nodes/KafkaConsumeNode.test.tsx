/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import KafkaConsumeNode from './KafkaConsumeNode';
import type { KafkaConsumeNodeData } from '../../types/workflow';

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
  getNodeCategory: (type: string) => type === 'kafkaConsume' ? 'Integration' : '',
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

function makeProps(data: Partial<KafkaConsumeNodeData> = {}) {
  const fullData: KafkaConsumeNodeData = {
    label: 'Kafka Consume',
    clusterId: 'cluster-a',
    topic: 'orders.events',
    ...data,
  } as KafkaConsumeNodeData;
  return {
    id: 'kc-1',
    data: fullData,
    selected: false,
    type: 'kafkaConsume' as const,
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

describe('KafkaConsumeNode', () => {
  it('renders with default label', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-kafkaConsume')).toBeTruthy();
    expect(container.textContent).toContain('Kafka Consume');
  });

  it('renders custom label', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ label: 'Order Events' })} />);
    expect(container.textContent).toContain('Order Events');
  });

  it('renders fallback label when empty', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ label: '' })} />);
    expect(container.textContent).toContain('Kafka Consume');
  });

  it('renders topic preview', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ topic: 'payments.events' })} />);
    expect(container.textContent).toContain('payments.events');
  });

  it('renders "No topic" when topic is empty', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ topic: '' })} />);
    expect(container.textContent).toContain('No topic');
  });

  it('renders cluster ID when provided', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ clusterId: 'cluster-prod' })} />);
    expect(container.textContent).toContain('cluster-prod');
  });

  it('does not render cluster row when clusterId is empty', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ clusterId: '' })} />);
    expect(container.querySelector('.wf-kafka-cluster')).toBeNull();
  });

  it('renders filter count when filters are present', () => {
    const props = makeProps({
      headerFilters: [{ id: 'h1', key: 'x', value: 'y', enabled: true }],
      jsonPathFilters: [{ id: 'j1', jsonPath: '$.id', expectedValue: '1', enabled: true }],
    });
    const { container } = render(<KafkaConsumeNode {...props} />);
    expect(container.textContent).toContain('2 filters');
  });

  it('renders singular "filter" when exactly one filter', () => {
    const props = makeProps({
      headerFilters: [{ id: 'h1', key: 'x', value: 'y', enabled: true }],
    });
    const { container } = render(<KafkaConsumeNode {...props} />);
    expect(container.textContent).toContain('1 filter');
    expect(container.textContent).not.toContain('1 filters');
  });

  it('does not render filter row when no filters', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ headerFilters: [], jsonPathFilters: [] })} />);
    expect(container.querySelector('.wf-kafka-meta')).toBeNull();
  });

  it('renders maxMessages when provided and > 0', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ maxMessages: 5 })} />);
    expect(container.textContent).toContain('Max: 5');
  });

  it('does not render maxMessages row when not set', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ maxMessages: undefined })} />);
    expect(container.textContent).not.toContain('Max:');
  });

  it('does not render maxMessages row when 0', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps({ maxMessages: 0 })} />);
    expect(container.textContent).not.toContain('Max:');
  });

  it('renders kafkaConsume icon', () => {
    const { getByTestId } = render(<KafkaConsumeNode {...makeProps()} />);
    expect(getByTestId('icon-kafkaConsume')).toBeTruthy();
  });

  it('renders target and source handles', () => {
    const { getByTestId } = render(<KafkaConsumeNode {...makeProps()} />);
    expect(getByTestId('handle-target')).toBeTruthy();
    expect(getByTestId('handle-source')).toBeTruthy();
  });

  it('applies selected class when selected', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps()} selected={true} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('does not apply selected class when not selected', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-selected')).toBeNull();
  });

  it('renders category sublabel', () => {
    const { container } = render(<KafkaConsumeNode {...makeProps()} />);
    expect(container.textContent).toContain('Integration');
  });

  it('renders configure button in footer', () => {
    const { getByTestId } = render(<KafkaConsumeNode {...makeProps()} />);
    expect(getByTestId('configure')).toBeTruthy();
  });
});
