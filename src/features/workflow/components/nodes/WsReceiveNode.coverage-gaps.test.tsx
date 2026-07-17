/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import WsReceiveNode from './WsReceiveNode';
import type { WsReceiveNodeData } from '../../types/workflow';

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

function makeData(overrides?: Partial<WsReceiveNodeData>): WsReceiveNodeData {
  return {
    label: 'WS Receive',
    connectionId: 'ws1',
    matchCriteria: undefined,
    extractionRules: [],
    timeoutMs: 0,
    ...overrides,
  } as WsReceiveNodeData;
}

function makeProps(data: WsReceiveNodeData, selected = false) {
  return {
    id: 'ws-recv-1',
    data,
    selected,
    type: 'wsReceive' as const,
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

describe('WsReceiveNode coverage gaps', () => {
  it('renders defaults and fallback match preview', () => {
    const { container, getByTestId } = render(<WsReceiveNode {...makeProps(makeData())} />);
    expect(container.querySelector('.wf-node-wsReceive')).toBeTruthy();
    expect(container.textContent).toContain('WS Receive');
    expect(container.textContent).toContain('Conn: ws1');
    expect(container.textContent).toContain('Match: any message');
    expect(getByTestId('icon-wsReceive')).toBeTruthy();
    expect(getByTestId('configure').getAttribute('title')).toBe('Configure WebSocket receive');
  });

  it('uses messageType-only preview and selected style', () => {
    const { container } = render(
      <WsReceiveNode
        {...makeProps(
          makeData({ matchCriteria: { messageType: 'binary' } as WsReceiveNodeData['matchCriteria'] }),
          true,
        )}
      />,
    );
    expect(container.textContent).toContain('Match: binary only');
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('prioritizes contentContains, then contentRegex, then jsonPathMatch', () => {
    const containsView = render(
      <WsReceiveNode
        {...makeProps(makeData({ matchCriteria: { contentContains: 'heartbeat' } as WsReceiveNodeData['matchCriteria'] }))}
      />,
    );
    expect(containsView.container.textContent).toContain('Match: contains "heartbeat"');

    const regexView = render(
      <WsReceiveNode
        {...makeProps(makeData({ matchCriteria: { contentRegex: '^ok$' } as WsReceiveNodeData['matchCriteria'] }))}
      />,
    );
    expect(regexView.container.textContent).toContain('Match: /^ok$/');

    const pathView = render(
      <WsReceiveNode
        {...makeProps(makeData({ matchCriteria: { jsonPathMatch: '$.event' } as WsReceiveNodeData['matchCriteria'] }))}
      />,
    );
    expect(pathView.container.textContent).toContain('Match: $.event');
  });

  it('renders extraction metadata singular/plural and timeout metadata', () => {
    const oneRule = render(
      <WsReceiveNode
        {...makeProps(
          makeData({ extractionRules: [{ id: 'r1' } as unknown as WsReceiveNodeData['extractionRules'][number]] }),
        )}
      />,
    );
    expect(oneRule.container.textContent).toContain('1 extraction');

    const manyRules = render(
      <WsReceiveNode
        {...makeProps(
          makeData({
            extractionRules: [
              { id: 'r1' } as unknown as WsReceiveNodeData['extractionRules'][number],
              { id: 'r2' } as unknown as WsReceiveNodeData['extractionRules'][number],
            ],
            timeoutMs: 1500,
          }),
        )}
      />,
    );
    expect(manyRules.container.textContent).toContain('2 extractions');
    expect(manyRules.container.textContent).toContain('Timeout: 1500ms');
  });

  it('falls back when label/connection are empty', () => {
    const { container } = render(
      <WsReceiveNode {...makeProps(makeData({ label: '', connectionId: '' }))} />,
    );
    expect(container.textContent).toContain('WS Receive');
    expect(container.textContent).toContain('Conn: ws1');
  });

  it('handles undefined extractionRules via ?? [] fallback without rendering extraction meta', () => {
    const { container } = render(
      <WsReceiveNode {...makeProps(makeData({ extractionRules: undefined }))} />,
    );
    expect(container.querySelector('.wf-ws-meta')).toBeNull();
  });
});
