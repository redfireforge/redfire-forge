/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import KafkaTriggerNode from './KafkaTriggerNode';
import type { KafkaTriggerNodeData } from '../../types/workflow';

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, className }: { type: string; position: string; className?: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} className={className} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}));

vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: null,
    stateClass: '',
    debugStep: null,
    handleConfigure: vi.fn(),
  }),
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: (type: string) => (type === 'kafkaTrigger' ? 'Triggers' : ''),
}));

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

function makeProps(data: Partial<KafkaTriggerNodeData> = {}) {
  const fullData: KafkaTriggerNodeData = {
    label: 'Kafka Trigger',
    clusterId: 'cluster-a',
    topic: 'orders.created',
    ...data,
  } as KafkaTriggerNodeData;
  return {
    id: 'kt-1',
    data: fullData,
    selected: false,
    type: 'kafkaTrigger' as const,
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

describe('KafkaTriggerNode', () => {
  it('renders with default label when none provided', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps({ label: '' })} />);
    expect(container.textContent).toContain('Kafka Trigger');
  });

  it('renders the provided label', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps({ label: 'Order Arrived' })} />);
    expect(container.textContent).toContain('Order Arrived');
  });

  it('applies the wf-node-kafkaTrigger class', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-kafkaTrigger')).toBeTruthy();
  });

  it('applies wf-node-selected class when selected', () => {
    const { container } = render(<KafkaTriggerNode {...{ ...makeProps(), selected: true }} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('does not apply wf-node-selected when not selected', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-selected')).toBeNull();
  });

  it('shows topic text', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps({ topic: 'payments.events' })} />);
    expect(container.textContent).toContain('payments.events');
  });

  it('shows "No topic" when topic is empty', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps({ topic: '' })} />);
    expect(container.textContent).toContain('No topic');
  });

  it('renders cluster ID when provided', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps({ clusterId: 'prod-cluster' })} />);
    expect(container.textContent).toContain('prod-cluster');
  });

  it('does not render cluster row when clusterId is absent', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps({ clusterId: undefined })} />);
    expect(container.querySelector('.wf-kafka-cluster')).toBeNull();
  });

  it('shows startPosition when not "latest"', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps({ startPosition: 'earliest' })} />);
    expect(container.textContent).toContain('earliest');
  });

  it('does not show startPosition row when value is "latest"', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps({ startPosition: 'latest' })} />);
    expect(container.querySelector('.wf-kafka-meta')).toBeNull();
  });

  it('renders only a source handle (trigger has no incoming connection)', () => {
    const { queryByTestId } = render(<KafkaTriggerNode {...makeProps()} />);
    expect(queryByTestId('handle-source')).toBeTruthy();
    expect(queryByTestId('handle-target')).toBeNull();
  });

  it('renders NodeIcon with kafkaTrigger type', () => {
    const { queryByTestId } = render(<KafkaTriggerNode {...makeProps()} />);
    expect(queryByTestId('icon-kafkaTrigger')).toBeTruthy();
  });

  it('renders configure button', () => {
    const { queryByTestId } = render(<KafkaTriggerNode {...makeProps()} />);
    expect(queryByTestId('configure')).toBeTruthy();
    expect(queryByTestId('configure')?.getAttribute('title')).toBe('Configure Kafka trigger');
  });

  it('renders status badge and paused overlay', () => {
    const { queryByTestId } = render(<KafkaTriggerNode {...makeProps()} />);
    expect(queryByTestId('status-badge')).toBeTruthy();
    expect(queryByTestId('paused')).toBeTruthy();
  });

  it('renders getNodeCategory sublabel', () => {
    const { container } = render(<KafkaTriggerNode {...makeProps()} />);
    expect(container.textContent).toContain('Triggers');
  });
});
