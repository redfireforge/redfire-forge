/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import WsConnectNode from './WsConnectNode';
import type { WsConnectNodeData } from '../../types/workflow';

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, className }: { type: string; position: string; className?: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} className={className} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}));

const handleConfigure = vi.fn();

vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: { state: 'success' },
    stateClass: 'wf-state-success',
    debugStep: null,
    handleConfigure,
  }),
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: () => 'WebSocket',
}));

vi.mock('./NodeStatusBadge', () => ({
  NodeStatusBadge: () => <div data-testid="status-badge" />,
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: () => <div data-testid="paused-overlay" />,
}));

function makeProps(data: Partial<WsConnectNodeData> = {}, selected = false) {
  const fullData: WsConnectNodeData = {
    label: 'WS Connect',
    url: 'ws://localhost:8080/chat',
    headers: [],
    queryParams: [],
    subprotocols: [],
    connectionId: 'ws1',
    timeoutMs: 5000,
    outputBindings: [],
    ...data,
  };
  return {
    id: 'ws-connect-1',
    data: fullData,
    selected,
    type: 'wsConnect' as const,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
  };
}

describe('WsConnectNode', () => {
  it('renders label, category, URL, and default connection id', () => {
    const { container } = render(<WsConnectNode {...makeProps()} />);
    expect(container.querySelector('.wf-node-wsConnect')).toBeTruthy();
    expect(container.textContent).toContain('WS Connect');
    expect(container.textContent).toContain('WebSocket');
    expect(container.textContent).toContain('ws://localhost:8080/chat');
    expect(container.textContent).toContain('ws1');
  });

  it('uses fallback label and URL when empty', () => {
    const { container } = render(<WsConnectNode {...makeProps({ label: '', url: '' })} />);
    expect(container.textContent).toContain('WS Connect');
    expect(container.textContent).toContain('No URL');
  });

  it('uses default connection id when connectionId is empty', () => {
    const { container } = render(<WsConnectNode {...makeProps({ connectionId: '' })} />);
    expect(container.textContent).toContain('ws1');
  });

  it('shows singular header count for one enabled header', () => {
    const { container } = render(<WsConnectNode {...makeProps({
      headers: [{ key: 'Authorization', value: 'Bearer x', enabled: true }],
    })} />);
    expect(container.textContent).toContain('1 header');
    expect(container.textContent).not.toContain('1 headers');
  });

  it('shows plural header count for multiple enabled headers', () => {
    const { container } = render(<WsConnectNode {...makeProps({
      headers: [
        { key: 'Authorization', value: 'Bearer x', enabled: true },
        { key: 'X-Trace', value: 'abc', enabled: true },
      ],
    })} />);
    expect(container.textContent).toContain('2 headers');
  });

  it('ignores disabled or blank header rows in the count', () => {
    const { container } = render(<WsConnectNode {...makeProps({
      headers: [
        { key: 'Authorization', value: 'Bearer x', enabled: false },
        { key: '  ', value: 'ignored', enabled: true },
        { key: 'X-Trace', value: 'abc', enabled: true },
      ],
    })} />);
    expect(container.textContent).toContain('1 header');
    expect(container.querySelector('.wf-ws-meta')).toBeTruthy();
  });

  it('hides header meta when no enabled headers', () => {
    const { container } = render(<WsConnectNode {...makeProps({ headers: [] })} />);
    expect(container.querySelector('.wf-ws-meta')).toBeNull();
  });

  it('applies selected class and state class from useNodeBase', () => {
    const { container } = render(<WsConnectNode {...makeProps({}, true)} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
    expect(container.querySelector('.wf-state-success')).toBeTruthy();
  });

  it('renders handles, status badge, and configure button', () => {
    const { getByTestId } = render(<WsConnectNode {...makeProps()} />);
    expect(getByTestId('handle-target')).toBeTruthy();
    expect(getByTestId('handle-source')).toBeTruthy();
    expect(getByTestId('status-badge')).toBeTruthy();
    expect(getByTestId('icon-wsConnect')).toBeTruthy();
  });

  it('invokes handleConfigure when configure button is clicked', () => {
    handleConfigure.mockClear();
    const { container } = render(<WsConnectNode {...makeProps()} />);
    const btn = container.querySelector('.wf-node-configure-badge')!;
    fireEvent.click(btn);
    expect(handleConfigure).toHaveBeenCalledTimes(1);
  });

  it('sets URL title attribute from data.url', () => {
    const { container } = render(<WsConnectNode {...makeProps({ url: 'wss://example.com/ws' })} />);
    const urlEl = container.querySelector('.wf-ws-url')!;
    expect(urlEl.getAttribute('title')).toBe('wss://example.com/ws');
  });
});
