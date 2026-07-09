/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GrpcAssertNode from './GrpcAssertNode';

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
    id: 'grpc-assert-1',
    data,
    selected,
    type: 'grpcAssert',
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    isConnectable: true,
  };
}

describe('GrpcAssertNode', () => {
  it('renders defaults and plural assertion label', () => {
    render(
      <GrpcAssertNode
        {...baseProps({
          label: '',
          source: '',
          assertions: [{ id: 'a' }, { id: 'b' }],
          onError: 'stop',
        })}
      />,
    );

    expect(screen.getByTestId('grpc-canvas-assert-node')).toBeTruthy();
    expect(screen.getByText('gRPC Assert')).toBeTruthy();
    expect(screen.getByText('Category:grpcAssert')).toBeTruthy();
    expect(screen.getByText(/Source:/)).toBeTruthy();
    expect(screen.getByText('No source')).toBeTruthy();
    expect(screen.getByText(/2 assertions/)).toBeTruthy();
    expect(screen.getByText(/halt on fail/)).toBeTruthy();
    expect(screen.getByTestId('handle-target')).toBeTruthy();
    expect(screen.getByTestId('handle-source')).toBeTruthy();
  });

  it('renders singular assertion text, warn behavior, and selected class', () => {
    const { container } = render(
      <GrpcAssertNode
        {...baseProps(
          {
            label: 'Validate payload',
            source: 'grpc.response',
            assertions: [{ id: 'only' }],
            onError: 'continue',
          },
          true,
        )}
      />,
    );

    expect(screen.getByText('Validate payload')).toBeTruthy();
    expect(screen.getByText('grpc.response')).toBeTruthy();
    expect(screen.getByText(/1 assertion/)).toBeTruthy();
    expect(screen.getByText(/warn on fail/)).toBeTruthy();
    expect(container.querySelector('.wf-node-selected')).toBeTruthy();
  });

  it('calls configure handler from footer button', () => {
    handleConfigure.mockClear();
    render(
      <GrpcAssertNode
        {...baseProps({
          label: 'Assert',
          source: 'payload',
          assertions: [],
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('node-configure'));
    expect(handleConfigure).toHaveBeenCalledTimes(1);
  });
});
