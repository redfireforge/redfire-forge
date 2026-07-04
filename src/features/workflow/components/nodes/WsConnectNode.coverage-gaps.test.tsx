/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import WsConnectNode from './WsConnectNode';
import type { WsConnectNodeData } from '../../types/workflow';

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

function makeData(overrides?: Partial<WsConnectNodeData>): WsConnectNodeData {
  return {
    label: 'WS Connect',
    url: 'ws://localhost:8765',
    connectionId: 'ws1',
    headers: [],
    ...overrides,
  } as WsConnectNodeData;
}

function makeProps(data: WsConnectNodeData, selected = false) {
  return {
    id: 'wsc-1',
    data,
    selected,
    type: 'wsConnect' as const,
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

describe('WsConnectNode coverage gaps', () => {
  it('renders with label and url', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData())} />);
    expect(container.querySelector('.wf-node-wsConnect')).toBeTruthy();
    expect(container.textContent).toContain('WS Connect');
    expect(container.textContent).toContain('ws://localhost:8765');
  });

  it('falls back to "No URL" when url is empty', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData({ url: '' }))} />);
    expect(container.textContent).toContain('No URL');
  });

  it('falls back to default label "WS Connect" when label is empty', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData({ label: '' }))} />);
    expect(container.textContent).toContain('WS Connect');
  });

  it('falls back to default connectionId "ws1" when connectionId is empty', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData({ connectionId: '' }))} />);
    expect(container.textContent).toContain('ws1');
  });

  it('renders provided connectionId', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData({ connectionId: 'my-ws' }))} />);
    expect(container.textContent).toContain('my-ws');
  });

  it('does not show header count when headers is empty', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData({ headers: [] }))} />);
    expect(container.querySelector('.wf-ws-meta')).toBeNull();
  });

  it('does not show header count when headers is undefined', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData({ headers: undefined }))} />);
    expect(container.querySelector('.wf-ws-meta')).toBeNull();
  });

  it('shows singular "1 header" for a single enabled header', () => {
    const headers = [{ id: 'h1', key: 'x-auth', value: 'token', enabled: true }];
    const { container } = render(<WsConnectNode {...makeProps(makeData({ headers }))} />);
    expect(container.textContent).toContain('1 header');
    expect(container.textContent).not.toContain('1 headers');
  });

  it('shows plural "N headers" for multiple enabled headers', () => {
    const headers = [
      { id: 'h1', key: 'x-auth', value: 'tok', enabled: true },
      { id: 'h2', key: 'x-req-id', value: 'id1', enabled: true },
    ];
    const { container } = render(<WsConnectNode {...makeProps(makeData({ headers }))} />);
    expect(container.textContent).toContain('2 headers');
  });

  it('does not count disabled headers', () => {
    const headers = [
      { id: 'h1', key: 'x-auth', value: 'tok', enabled: false },
      { id: 'h2', key: 'x-req-id', value: 'id1', enabled: true },
    ];
    const { container } = render(<WsConnectNode {...makeProps(makeData({ headers }))} />);
    expect(container.textContent).toContain('1 header');
  });

  it('does not count headers with empty keys', () => {
    const headers = [
      { id: 'h1', key: '   ', value: 'tok', enabled: true },
      { id: 'h2', key: 'x-req-id', value: 'id1', enabled: true },
    ];
    const { container } = render(<WsConnectNode {...makeProps(makeData({ headers }))} />);
    expect(container.textContent).toContain('1 header');
  });

  it('applies selected class when selected=true', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData(), true)} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('does not apply selected class when selected=false', () => {
    const { container } = render(<WsConnectNode {...makeProps(makeData(), false)} />);
    expect(container.querySelector('.wf-node-selected')).toBeNull();
  });

  it('renders target and source handles', () => {
    const { getByTestId } = render(<WsConnectNode {...makeProps(makeData())} />);
    expect(getByTestId('handle-target')).toBeTruthy();
    expect(getByTestId('handle-source')).toBeTruthy();
  });
});
