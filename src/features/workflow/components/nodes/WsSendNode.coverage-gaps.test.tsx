/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import WsSendNode from './WsSendNode';
import type { WsSendNodeData } from '../../types/workflow';

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}));

vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: null,
    stateClass: 'wf-state-idle',
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

function makeData(overrides?: Partial<WsSendNodeData>): WsSendNodeData {
  return {
    label: 'WS Send',
    connectionId: 'ws1',
    message: '{"ping":true}',
    messageType: 'text',
    waitForResponse: false,
    responseTimeoutMs: 5000,
    outputBindings: [],
    ...overrides,
  } as WsSendNodeData;
}

function makeProps(data: WsSendNodeData, selected = false) {
  return {
    id: 'ws-send-1',
    data,
    selected,
    type: 'wsSend' as const,
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

describe('WsSendNode coverage gaps', () => {
  it('renders message preview, defaults, and wait-for-response meta', () => {
    const { container, getByTestId } = render(
      <WsSendNode {...makeProps(makeData())} />,
    );
    expect(container.querySelector('.wf-node-wsSend')).toBeTruthy();
    expect(container.textContent).toContain('{"ping":true}');
    expect(getByTestId('icon-wsSend')).toBeTruthy();
    expect(getByTestId('configure').getAttribute('title')).toBe('Configure WebSocket send');
  });

  it('truncates long messages and shows empty-state label', () => {
    const long = 'Z'.repeat(50);
    const { container: longView } = render(
      <WsSendNode {...makeProps(makeData({ message: long }))} />,
    );
    expect(longView.textContent).toContain('Z'.repeat(40) + '\u2026');

    const { container: emptyView } = render(
      <WsSendNode {...makeProps(makeData({ message: '' }))} />,
    );
    expect(emptyView.textContent).toContain('No message');
  });

  it('shows wait-for-response row and selected styling', () => {
    const { container } = render(
      <WsSendNode {...makeProps(makeData({ waitForResponse: true, responseTimeoutMs: 1200 }), true)} />,
    );
    expect(container.textContent).toContain('Wait for response (1200ms)');
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('falls back to default label and connection id', () => {
    const { container } = render(
      <WsSendNode {...makeProps(makeData({ label: '', connectionId: '' }))} />,
    );
    expect(container.textContent).toContain('WS Send');
    expect(container.textContent).toContain('ws1');
  });
});
