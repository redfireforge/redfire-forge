/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import WsTriggerNode from './WsTriggerNode';
import type { WsTriggerNodeData } from '../../types/workflow';

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}));

vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: null,
    stateClass: '',
    debugStep: null,
    handleConfigure: vi.fn(),
    openStepDetail: vi.fn(),
  }),
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: () => 'WebSocket',
}));

vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ title }: { title?: string }) => (
    <button type="button" data-testid="configure" title={title}>cfg</button>
  ),
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: () => <div data-testid="paused" />,
}));

vi.mock('./NodeStatusBadge', () => ({
  NodeStatusBadge: () => <div data-testid="status-badge" />,
}));

function makeData(overrides?: Partial<WsTriggerNodeData>): WsTriggerNodeData {
  return {
    label: 'WS Trigger',
    url: 'ws://localhost:8765',
    connectionId: 'ws1',
    ...overrides,
  } as WsTriggerNodeData;
}

function makeProps(data: WsTriggerNodeData, selected = false) {
  return {
    id: 'wst-1',
    data,
    selected,
    type: 'wsTrigger' as const,
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

describe('WsTriggerNode coverage gaps', () => {
  it('renders with label and url', () => {
    const { container } = render(<WsTriggerNode {...makeProps(makeData())} />);
    expect(container.querySelector('.wf-node-wsTrigger')).toBeTruthy();
    expect(container.textContent).toContain('WS Trigger');
    expect(container.textContent).toContain('ws://localhost:8765');
  });

  it('falls back to "No URL" when url is empty', () => {
    const { container } = render(<WsTriggerNode {...makeProps(makeData({ url: '' }))} />);
    expect(container.textContent).toContain('No URL');
  });

  it('falls back to default label "WS Trigger" when label is empty', () => {
    const { container } = render(<WsTriggerNode {...makeProps(makeData({ label: '' }))} />);
    expect(container.textContent).toContain('WS Trigger');
  });

  it('falls back to default connectionId "ws1" when connectionId is empty', () => {
    const { container } = render(<WsTriggerNode {...makeProps(makeData({ connectionId: '' }))} />);
    expect(container.textContent).toContain('ws1');
  });

  it('renders provided connectionId', () => {
    const { container } = render(<WsTriggerNode {...makeProps(makeData({ connectionId: 'my-ws' }))} />);
    expect(container.textContent).toContain('my-ws');
  });

  it('applies selected class when selected=true', () => {
    const { container } = render(<WsTriggerNode {...makeProps(makeData(), true)} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('does not apply selected class when selected=false', () => {
    const { container } = render(<WsTriggerNode {...makeProps(makeData(), false)} />);
    expect(container.querySelector('.wf-node-selected')).toBeNull();
  });

  it('renders only source handle (trigger node has no input)', () => {
    const { getByTestId, queryByTestId } = render(<WsTriggerNode {...makeProps(makeData())} />);
    expect(getByTestId('handle-source')).toBeTruthy();
    expect(queryByTestId('handle-target')).toBeNull();
  });
});
