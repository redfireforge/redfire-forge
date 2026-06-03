/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import KafkaWaitNode from './KafkaWaitNode';
import type { KafkaWaitNodeData } from '../../types/workflow';

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
  getNodeCategory: (type: string) => (type === 'kafkaWait' ? 'Integrations' : ''),
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

function makeProps(data: Partial<KafkaWaitNodeData> = {}) {
  const fullData: KafkaWaitNodeData = {
    label: 'Kafka Wait',
    clusterId: 'cluster-a',
    topic: 'orders.reply',
    correlationIdExpression: '{{orderId}}',
    correlationSource: 'value',
    correlationJsonPath: '$.correlationId',
    timeoutMs: 60000,
    ...data,
  } as KafkaWaitNodeData;
  return {
    id: 'kw-1',
    data: fullData,
    selected: false,
    type: 'kafkaWait' as const,
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

describe('KafkaWaitNode', () => {
  it('renders with default label when none provided', () => {
    const { container } = render(<KafkaWaitNode {...makeProps({ label: '' })} />);
    expect(container.textContent).toContain('Kafka Wait');
  });

  it('renders the provided label', () => {
    const { container } = render(<KafkaWaitNode {...makeProps({ label: 'Wait for Reply' })} />);
    expect(container.textContent).toContain('Wait for Reply');
  });

  it('applies the wf-node-kafkaWait class', () => {
    const { container } = render(<KafkaWaitNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-kafkaWait')).toBeTruthy();
  });

  it('applies wf-node-selected class when selected', () => {
    const { container } = render(<KafkaWaitNode {...{ ...makeProps(), selected: true }} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('does not apply wf-node-selected when not selected', () => {
    const { container } = render(<KafkaWaitNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-selected')).toBeNull();
  });

  it('shows topic text', () => {
    const { container } = render(<KafkaWaitNode {...makeProps({ topic: 'payments.reply' })} />);
    expect(container.textContent).toContain('payments.reply');
  });

  it('shows "No topic" when topic is empty', () => {
    const { container } = render(<KafkaWaitNode {...makeProps({ topic: '' })} />);
    expect(container.textContent).toContain('No topic');
  });

  it('renders cluster ID when provided', () => {
    const { container } = render(<KafkaWaitNode {...makeProps({ clusterId: 'staging-cluster' })} />);
    expect(container.textContent).toContain('staging-cluster');
  });

  it('does not render cluster row when clusterId is absent', () => {
    const { container } = render(<KafkaWaitNode {...makeProps({ clusterId: undefined })} />);
    expect(container.querySelector('.wf-kafka-cluster')).toBeNull();
  });

  it('shows correlationIdExpression when present', () => {
    const { container } = render(<KafkaWaitNode {...makeProps({ correlationIdExpression: '{{txId}}' })} />);
    expect(container.textContent).toContain('{{txId}}');
  });

  it('does not render correlation row when correlationIdExpression is absent', () => {
    const { container } = render(
      <KafkaWaitNode {...makeProps({ correlationIdExpression: undefined })} />,
    );
    expect(container.querySelector('.wf-kafka-meta')).toBeNull();
  });

  it('renders both target and source handles (wait is mid-graph)', () => {
    const { queryByTestId } = render(<KafkaWaitNode {...makeProps()} />);
    expect(queryByTestId('handle-target')).toBeTruthy();
    expect(queryByTestId('handle-source')).toBeTruthy();
  });

  it('renders NodeIcon with kafkaWait type', () => {
    const { queryByTestId } = render(<KafkaWaitNode {...makeProps()} />);
    expect(queryByTestId('icon-kafkaWait')).toBeTruthy();
  });

  it('renders configure button with correct title', () => {
    const { queryByTestId } = render(<KafkaWaitNode {...makeProps()} />);
    expect(queryByTestId('configure')).toBeTruthy();
    expect(queryByTestId('configure')?.getAttribute('title')).toBe('Configure Kafka wait');
  });

  it('renders status badge and paused overlay', () => {
    const { queryByTestId } = render(<KafkaWaitNode {...makeProps()} />);
    expect(queryByTestId('status-badge')).toBeTruthy();
    expect(queryByTestId('paused')).toBeTruthy();
  });

  it('renders getNodeCategory sublabel', () => {
    const { container } = render(<KafkaWaitNode {...makeProps()} />);
    expect(container.textContent).toContain('Integrations');
  });
});
