/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcStreamPendingQueuePanel } from './GrpcStreamPendingQueuePanel';

describe('GrpcStreamPendingQueuePanel', () => {
  it('renders queued items, add-to-queue, and wires footer actions', () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    const onSendAll = vi.fn();
    const onEnd = vi.fn();

    render(
      <GrpcStreamPendingQueuePanel
        pendingBodies={[{ message: 'one' }, { message: 'two' }]}
        streamActive
        clientWritesEnded={false}
        canCompose
        onAddToQueue={onAdd}
        onRemoveAtIndex={onRemove}
        onSendAll={onSendAll}
        onEndStream={onEnd}
      />,
    );

    expect(screen.getByTestId('grpc-stream-pending-chip').textContent).toContain('2 queued');
    fireEvent.click(screen.getByTestId('grpc-stream-add-queue-btn'));
    expect(onAdd).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId('grpc-stream-pending-remove-0'));
    fireEvent.click(screen.getByTestId('grpc-stream-send-all-btn'));
    fireEvent.click(screen.getByTestId('grpc-stream-pending-end-btn'));
    expect(onRemove).toHaveBeenCalledWith(0);
    expect(onSendAll).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('disables queue and send all while drain is in flight', () => {
    render(
      <GrpcStreamPendingQueuePanel
        pendingBodies={[{ message: 'one' }]}
        streamActive
        clientWritesEnded={false}
        sendAllInFlight
        canCompose
        onAddToQueue={vi.fn()}
        onRemoveAtIndex={vi.fn()}
        onSendAll={vi.fn()}
        onEndStream={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-stream-add-queue-btn')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-stream-send-all-btn')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-stream-pending-remove-0')).toHaveProperty('disabled', true);
  });
});
