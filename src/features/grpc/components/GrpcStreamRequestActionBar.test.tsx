/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcStreamRequestActionBar } from './GrpcStreamRequestActionBar';

describe('GrpcStreamRequestActionBar', () => {
  it('renders client-streaming send control below the request composer', () => {
    const onSend = vi.fn();
    render(
      <GrpcStreamRequestActionBar
        callType="client_streaming"
        streamActive
        clientWritesEnded={false}
        canCompose
        onSendMessage={onSend}
        onEndStream={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-request-actions')).toBeTruthy();
    expect(screen.queryByTestId('grpc-stream-end-btn')).toBeNull();
    fireEvent.click(screen.getByTestId('grpc-stream-send-now-btn'));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it('renders bidi send + end stream with clear hierarchy', () => {
    const onSend = vi.fn();
    const onEnd = vi.fn();
    render(
      <GrpcStreamRequestActionBar
        callType="bidi_streaming"
        streamActive
        clientWritesEnded={false}
        canCompose
        onSendMessage={onSend}
        onEndStream={onEnd}
      />,
    );
    expect(screen.getByTestId('grpc-stream-send-message-btn')).toBeTruthy();
    expect(screen.getByTestId('grpc-stream-end-btn')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-stream-send-message-btn'));
    fireEvent.click(screen.getByTestId('grpc-stream-end-btn'));
    expect(onSend).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('disables send while send-all drain is in flight', () => {
    render(
      <GrpcStreamRequestActionBar
        callType="client_streaming"
        streamActive
        clientWritesEnded={false}
        sendAllInFlight
        canCompose
        onSendMessage={vi.fn()}
        onEndStream={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-send-now-btn')).toHaveProperty('disabled', true);
  });

  it('disables bidi actions when stream inactive or half-closed', () => {
    render(
      <GrpcStreamRequestActionBar
        callType="bidi_streaming"
        streamActive={false}
        clientWritesEnded={false}
        onSendMessage={vi.fn()}
        onEndStream={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-send-message-btn')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-stream-end-btn')).toHaveProperty('disabled', true);
  });
});
