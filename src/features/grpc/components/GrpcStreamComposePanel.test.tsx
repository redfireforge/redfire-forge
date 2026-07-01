/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcStreamComposePanel } from './GrpcStreamComposePanel';

describe('GrpcStreamComposePanel', () => {
  it('returns null for server-streaming call type', () => {
    const { container } = render(
      <GrpcStreamComposePanel
        callType="server_streaming"
        pendingCount={0}
        streamActive
        clientWritesEnded={false}
        onSendMessage={vi.fn()}
        onEndStream={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders client-streaming hint and enables queue actions when active', () => {
    const onAdd = vi.fn();
    const onSend = vi.fn();
    const onEnd = vi.fn();
    render(
      <GrpcStreamComposePanel
        callType="client_streaming"
        pendingCount={2}
        streamActive
        clientWritesEnded={false}
        canCompose
        onAddToQueue={onAdd}
        onSendMessage={onSend}
        onEndStream={onEnd}
      />,
    );
    expect(screen.getByTestId('grpc-stream-compose-panel')).toBeTruthy();
    expect(screen.getByText(/add to the queue/i)).toBeTruthy();
    expect(screen.getByTestId('grpc-stream-pending-count').textContent).toContain('2 queued');

    fireEvent.click(screen.getByTestId('grpc-stream-add-queue-btn'));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.getByTestId('grpc-stream-send-now-btn')).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByTestId('grpc-stream-send-now-btn'));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it('disables client-streaming actions while send-all drain is in flight', () => {
    render(
      <GrpcStreamComposePanel
        callType="client_streaming"
        pendingCount={1}
        streamActive
        clientWritesEnded={false}
        sendAllInFlight
        canCompose
        onAddToQueue={vi.fn()}
        onSendMessage={vi.fn()}
        onEndStream={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-stream-add-queue-btn')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-stream-send-now-btn')).toHaveProperty('disabled', true);
  });

  it('renders bidi hint and disables actions when stream inactive or EOF', () => {
    render(
      <GrpcStreamComposePanel
        callType="bidi_streaming"
        pendingCount={0}
        streamActive={false}
        clientWritesEnded={false}
        onSendMessage={vi.fn()}
        onEndStream={vi.fn()}
      />,
    );
    expect(screen.getByText(/inbound echoes appear/i)).toBeTruthy();
    expect(screen.getByTestId('grpc-stream-send-message-btn')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-stream-end-btn')).toHaveProperty('disabled', true);

    render(
      <GrpcStreamComposePanel
        callType="bidi_streaming"
        pendingCount={0}
        streamActive
        clientWritesEnded
        onSendMessage={vi.fn()}
        onEndStream={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('grpc-stream-send-message-btn').pop()).toHaveProperty('disabled', true);
  });
});
