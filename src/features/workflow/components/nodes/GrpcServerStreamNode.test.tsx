/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GrpcServerStreamNode from './GrpcServerStreamNode';

const handleConfigure = vi.fn();

vi.mock('@xyflow/react', () => ({
  Handle: ({ type }: { type: string }) => <div data-testid={`handle-${type}`} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

vi.mock('./useNodeBase', () => ({
  useNodeBase: () => ({
    rs: { state: 'idle' },
    stateClass: 'wf-node-idle',
    debugStep: null,
    handleConfigure,
  }),
}));

vi.mock('./NodeIcon', () => ({
  NodeIcon: ({ type }: { type: string }) => <div data-testid={`icon-${type}`} />,
  getNodeCategory: (type: string) => `Category:${type}`,
}));

vi.mock('./NodeConfigureButton', () => ({
  NodeConfigureButton: ({ title, onClick }: { title: string; onClick: () => void }) => (
    <button type="button" data-testid="node-configure" title={title} onClick={onClick}>configure</button>
  ),
}));

vi.mock('./NodePausedOverlay', () => ({
  NodePausedOverlay: ({ nodeId }: { nodeId: string }) => <div data-testid={`paused-${nodeId}`} />,
}));

vi.mock('./NodeStatusBadge', () => ({
  NodeStatusBadge: () => <div data-testid="node-status-badge" />,
}));

function baseProps(data: Record<string, unknown>, selected = false) {
  return {
    id: 'grpc-stream-1',
    data,
    selected,
    type: 'grpcServerStream',
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    isConnectable: true,
  };
}

describe('GrpcServerStreamNode', () => {
  it('renders service/method and max messages', () => {
    render(
      <GrpcServerStreamNode
        {...baseProps({
          label: 'Server stream',
          service: 'pkg.ChatService',
          method: 'Watch',
          collect: { maxMessages: 3 },
        })}
      />,
    );

    expect(screen.getByTestId('grpc-canvas-server-stream-node')).toBeTruthy();
    expect(screen.getByText('Server stream')).toBeTruthy();
    expect(screen.getByText('Category:grpcServerStream')).toBeTruthy();
    expect(screen.getByText('pkg.ChatService/Watch')).toBeTruthy();
    expect(screen.getByText('max 3 messages')).toBeTruthy();
    expect(screen.getByTestId('handle-target')).toBeTruthy();
    expect(screen.getByTestId('handle-source')).toBeTruthy();
  });

  it('falls back to target and default label and renders singular max message', () => {
    const { container } = render(
      <GrpcServerStreamNode
        {...baseProps(
          {
            label: '',
            target: 'fallback.target',
            collect: { maxMessages: 1 },
          },
          true,
        )}
      />,
    );

    expect(screen.getByText('gRPC Server Stream')).toBeTruthy();
    expect(screen.getByText('fallback.target')).toBeTruthy();
    expect(screen.getByText('max 1 message')).toBeTruthy();
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('uses not configured fallback and hides max messages when unset', () => {
    render(
      <GrpcServerStreamNode
        {...baseProps({
          label: 'No target',
        })}
      />,
    );

    expect(screen.getByText('Not configured')).toBeTruthy();
    expect(screen.queryByText(/^max /)).toBeNull();
  });

  it('calls configure handler from footer button', () => {
    handleConfigure.mockClear();
    render(
      <GrpcServerStreamNode
        {...baseProps({
          label: 'Config me',
          target: 'svc/method',
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('node-configure'));
    expect(handleConfigure).toHaveBeenCalledTimes(1);
  });
});
