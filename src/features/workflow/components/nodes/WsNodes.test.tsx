/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import WsConnectNode from './WsConnectNode';
import WsSendNode from './WsSendNode';
import WsReceiveNode from './WsReceiveNode';
import WsTriggerNode from './WsTriggerNode';
import type {
  WsConnectNodeData,
  WsSendNodeData,
  WsReceiveNodeData,
  WsTriggerNodeData,
} from '../../types/workflow';

// ── Shared mocks (same pattern as KafkaProduceNode.test.tsx) ──

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
  getNodeCategory: (type: string) => {
    const cats: Record<string, string> = {
      wsConnect: 'WebSocket', wsSend: 'WebSocket', wsReceive: 'WebSocket', wsTrigger: 'WebSocket',
    };
    return cats[type] ?? '';
  },
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

// ── Helper: build NodeProps shape ──

function nodeProps<T extends Record<string, unknown>>(id: string, type: string, data: T, selected = false) {
  return {
    id,
    data,
    selected,
    type: type as never,
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

// ── WsConnectNode ──

describe('WsConnectNode', () => {
  function makeData(overrides?: Partial<WsConnectNodeData>): WsConnectNodeData {
    return {
      label: 'WS Connect',
      url: 'ws://localhost:8765',
      headers: [],
      queryParams: [],
      subprotocols: [],
      connectionId: 'ws1',
      timeoutMs: 10000,
      outputBindings: [],
      ...overrides,
    } as WsConnectNodeData;
  }

  it('renders default label and URL', () => {
    const { container } = render(<WsConnectNode {...nodeProps('wc-1', 'wsConnect', makeData())} />);
    expect(container.querySelector('.wf-node-wsConnect')).toBeTruthy();
    expect(container.textContent).toContain('WS Connect');
    expect(container.textContent).toContain('ws://localhost:8765');
    expect(container.textContent).toContain('ws1');
  });

  it('renders custom label', () => {
    const { container } = render(<WsConnectNode {...nodeProps('wc-2', 'wsConnect', makeData({ label: 'My WS' }))} />);
    expect(container.textContent).toContain('My WS');
  });

  it('shows "No URL" when url is empty', () => {
    const { container } = render(<WsConnectNode {...nodeProps('wc-3', 'wsConnect', makeData({ url: '' }))} />);
    expect(container.textContent).toContain('No URL');
  });

  it('shows header count when enabled headers exist', () => {
    const headers = [
      { id: 'h1', key: 'Authorization', value: 'Bearer xyz', enabled: true },
      { id: 'h2', key: '', value: '', enabled: true },
      { id: 'h3', key: 'X-Custom', value: 'val', enabled: false },
    ];
    const { container } = render(<WsConnectNode {...nodeProps('wc-4', 'wsConnect', makeData({ headers }))} />);
    expect(container.textContent).toContain('1 header');
  });

  it('shows plural header count', () => {
    const headers = [
      { id: 'h1', key: 'A', value: '1', enabled: true },
      { id: 'h2', key: 'B', value: '2', enabled: true },
    ];
    const { container } = render(<WsConnectNode {...nodeProps('wc-5', 'wsConnect', makeData({ headers }))} />);
    expect(container.textContent).toContain('2 headers');
  });

  it('hides header count when none enabled', () => {
    const { container } = render(<WsConnectNode {...nodeProps('wc-6', 'wsConnect', makeData({ headers: [] }))} />);
    expect(container.textContent).not.toContain('header');
  });

  it('applies selected class', () => {
    const { container } = render(<WsConnectNode {...nodeProps('wc-7', 'wsConnect', makeData(), true)} />);
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('renders icon, configure button, status badge, and handles', () => {
    const { container, getByTestId } = render(<WsConnectNode {...nodeProps('wc-8', 'wsConnect', makeData())} />);
    expect(getByTestId('icon-wsConnect')).toBeTruthy();
    expect(getByTestId('configure')).toBeTruthy();
    expect(getByTestId('status-badge')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid^="handle-"]')).toHaveLength(2);
  });

  it('defaults connectionId to ws1', () => {
    const { container } = render(<WsConnectNode {...nodeProps('wc-9', 'wsConnect', makeData({ connectionId: '' }))} />);
    expect(container.textContent).toContain('ws1');
  });
});

// ── WsSendNode ──

describe('WsSendNode', () => {
  function makeData(overrides?: Partial<WsSendNodeData>): WsSendNodeData {
    return {
      label: 'WS Send',
      connectionId: 'ws1',
      message: '{"action":"ping"}',
      messageType: 'text',
      waitForResponse: false,
      responseTimeoutMs: 5000,
      outputBindings: [],
      ...overrides,
    } as WsSendNodeData;
  }

  it('renders default label and message preview', () => {
    const { container } = render(<WsSendNode {...nodeProps('ws-1', 'wsSend', makeData())} />);
    expect(container.querySelector('.wf-node-wsSend')).toBeTruthy();
    expect(container.textContent).toContain('WS Send');
    expect(container.textContent).toContain('{"action":"ping"}');
  });

  it('truncates long message to 40 chars', () => {
    const longMsg = 'A'.repeat(50);
    const { container } = render(<WsSendNode {...nodeProps('ws-2', 'wsSend', makeData({ message: longMsg }))} />);
    expect(container.textContent).toContain('A'.repeat(40) + '\u2026');
  });

  it('shows "No message" when message is empty', () => {
    const { container } = render(<WsSendNode {...nodeProps('ws-3', 'wsSend', makeData({ message: '' }))} />);
    expect(container.textContent).toContain('No message');
  });

  it('shows wait for response info', () => {
    const { container } = render(<WsSendNode {...nodeProps('ws-4', 'wsSend', makeData({ waitForResponse: true, responseTimeoutMs: 3000 }))} />);
    expect(container.textContent).toContain('Wait for response (3000ms)');
  });

  it('hides wait info when waitForResponse is false', () => {
    const { container } = render(<WsSendNode {...nodeProps('ws-5', 'wsSend', makeData({ waitForResponse: false }))} />);
    expect(container.textContent).not.toContain('Wait for response');
  });

  it('renders icon and handles', () => {
    const { getByTestId, container } = render(<WsSendNode {...nodeProps('ws-6', 'wsSend', makeData())} />);
    expect(getByTestId('icon-wsSend')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid^="handle-"]')).toHaveLength(2);
  });
});

// ── WsReceiveNode ──

describe('WsReceiveNode', () => {
  function makeData(overrides?: Partial<WsReceiveNodeData>): WsReceiveNodeData {
    return {
      label: 'WS Receive',
      connectionId: 'ws1',
      timeoutMs: 5000,
      matchCriteria: {},
      extractionRules: [],
      outputBindings: [],
      ...overrides,
    } as WsReceiveNodeData;
  }

  it('renders default label with "any message" preview', () => {
    const { container } = render(<WsReceiveNode {...nodeProps('wr-1', 'wsReceive', makeData())} />);
    expect(container.querySelector('.wf-node-wsReceive')).toBeTruthy();
    expect(container.textContent).toContain('WS Receive');
    expect(container.textContent).toContain('any message');
  });

  it('shows contentContains filter', () => {
    const { container } = render(<WsReceiveNode {...nodeProps('wr-2', 'wsReceive', makeData({
      matchCriteria: { contentContains: 'hello' },
    }))} />);
    expect(container.textContent).toContain('contains "hello"');
  });

  it('shows contentRegex filter', () => {
    const { container } = render(<WsReceiveNode {...nodeProps('wr-3', 'wsReceive', makeData({
      matchCriteria: { contentRegex: 'foo.*bar' },
    }))} />);
    expect(container.textContent).toContain('/foo.*bar/');
  });

  it('shows jsonPathMatch filter', () => {
    const { container } = render(<WsReceiveNode {...nodeProps('wr-4', 'wsReceive', makeData({
      matchCriteria: { jsonPathMatch: '$.status' },
    }))} />);
    expect(container.textContent).toContain('$.status');
  });

  it('shows messageType-only filter', () => {
    const { container } = render(<WsReceiveNode {...nodeProps('wr-5', 'wsReceive', makeData({
      matchCriteria: { messageType: 'binary' },
    }))} />);
    expect(container.textContent).toContain('binary only');
  });

  it('shows extraction rule count', () => {
    const rules = [
      { variableName: 'v1', jsonPath: '$.a' },
      { variableName: 'v2', jsonPath: '$.b' },
    ];
    const { container } = render(<WsReceiveNode {...nodeProps('wr-6', 'wsReceive', makeData({
      extractionRules: rules,
    }))} />);
    expect(container.textContent).toContain('2 extractions');
  });

  it('shows single extraction (no plural)', () => {
    const { container } = render(<WsReceiveNode {...nodeProps('wr-7', 'wsReceive', makeData({
      extractionRules: [{ variableName: 'v1', jsonPath: '$.a' }],
    }))} />);
    expect(container.textContent).toMatch(/1 extraction[^s]/);
  });

  it('shows timeout', () => {
    const { container } = render(<WsReceiveNode {...nodeProps('wr-8', 'wsReceive', makeData({ timeoutMs: 3000 }))} />);
    expect(container.textContent).toContain('Timeout: 3000ms');
  });

  it('hides timeout when 0', () => {
    const { container } = render(<WsReceiveNode {...nodeProps('wr-9', 'wsReceive', makeData({ timeoutMs: 0 }))} />);
    expect(container.textContent).not.toContain('Timeout');
  });
});

// ── WsTriggerNode ──

describe('WsTriggerNode', () => {
  function makeData(overrides?: Partial<WsTriggerNodeData>): WsTriggerNodeData {
    return {
      label: 'WS Trigger',
      url: 'ws://localhost:8765',
      connectionId: 'ws1',
      matchCriteria: {},
      extractionRules: [],
      ...overrides,
    } as WsTriggerNodeData;
  }

  it('renders default label and URL', () => {
    const { container } = render(<WsTriggerNode {...nodeProps('wt-1', 'wsTrigger', makeData())} />);
    expect(container.querySelector('.wf-node-wsTrigger')).toBeTruthy();
    expect(container.textContent).toContain('WS Trigger');
    expect(container.textContent).toContain('ws://localhost:8765');
  });

  it('shows "No URL" when empty', () => {
    const { container } = render(<WsTriggerNode {...nodeProps('wt-2', 'wsTrigger', makeData({ url: '' }))} />);
    expect(container.textContent).toContain('No URL');
  });

  it('defaults connectionId to ws1', () => {
    const { container } = render(<WsTriggerNode {...nodeProps('wt-3', 'wsTrigger', makeData({ connectionId: '' }))} />);
    expect(container.textContent).toContain('ws1');
  });

  it('has only a source handle (no target)', () => {
    const { container } = render(<WsTriggerNode {...nodeProps('wt-4', 'wsTrigger', makeData())} />);
    expect(container.querySelector('[data-testid="handle-source"]')).toBeTruthy();
    // Trigger nodes have only a source handle — no target
    const handles = container.querySelectorAll('[data-testid^="handle-"]');
    expect(handles).toHaveLength(1);
  });

  it('renders icon and configure button', () => {
    const { getByTestId } = render(<WsTriggerNode {...nodeProps('wt-5', 'wsTrigger', makeData())} />);
    expect(getByTestId('icon-wsTrigger')).toBeTruthy();
    expect(getByTestId('configure')).toBeTruthy();
  });

  it('renders custom label', () => {
    const { container } = render(<WsTriggerNode {...nodeProps('wt-6', 'wsTrigger', makeData({ label: 'My Trigger' }))} />);
    expect(container.textContent).toContain('My Trigger');
  });
});
