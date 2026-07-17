/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GrpcUnaryNode from './GrpcUnaryNode';

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
    id: 'grpc-unary-1',
    data,
    selected,
    type: 'grpcUnary',
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    isConnectable: true,
  };
}

describe('GrpcUnaryNode', () => {
  it('renders service/method and saveAs metadata', () => {
    render(
      <GrpcUnaryNode
        {...baseProps({
          label: 'Unary call',
          service: 'pkg.EchoService',
          method: 'Echo',
          saveAs: 'grpc.echo.result',
        })}
      />,
    );

    expect(screen.getByTestId('grpc-canvas-unary-node')).toBeTruthy();
    expect(screen.getByText('Unary call')).toBeTruthy();
    expect(screen.getByText('Category:grpcUnary')).toBeTruthy();
    expect(screen.getByText('pkg.EchoService/Echo')).toBeTruthy();
    expect(screen.getByText('saves as: grpc.echo.result')).toBeTruthy();
  });

  it('falls back to target when service/method missing and hides saveAs when absent', () => {
    const { container } = render(
      <GrpcUnaryNode
        {...baseProps(
          {
            label: '',
            target: 'fallback.unary',
          },
          true,
        )}
      />,
    );

    expect(screen.getByText('gRPC Unary')).toBeTruthy();
    expect(screen.getByText('fallback.unary')).toBeTruthy();
    expect(screen.queryByText(/saves as:/)).toBeNull();
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('uses not configured fallback when no target and no method', () => {
    render(
      <GrpcUnaryNode
        {...baseProps({
          label: 'Unary default',
        })}
      />,
    );

    expect(screen.getByText('Not configured')).toBeTruthy();
  });

  it('calls configure handler from footer button', () => {
    handleConfigure.mockClear();
    render(
      <GrpcUnaryNode
        {...baseProps({
          label: 'Configure unary',
          target: 'svc/Unary',
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('node-configure'));
    expect(handleConfigure).toHaveBeenCalledTimes(1);
  });
});
