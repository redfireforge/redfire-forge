export interface GrpcStreamRequestActionBarProps {
  callType: 'client_streaming' | 'bidi_streaming';
  streamActive: boolean;
  clientWritesEnded: boolean;
  disabled?: boolean;
  canCompose?: boolean;
  sendAllInFlight?: boolean;
  onSendMessage: () => void;
  onEndStream: () => void;
}

/**
 * Stream send controls anchored to the request composer (left pane).
 * Keeps "compose → send" on one side; the log panel stays read-only on the right.
 */
export function GrpcStreamRequestActionBar({
  callType,
  streamActive,
  clientWritesEnded,
  disabled = false,
  canCompose = true,
  sendAllInFlight = false,
  onSendMessage,
  onEndStream,
}: GrpcStreamRequestActionBarProps) {
  const canSend = streamActive && !clientWritesEnded && !disabled && !sendAllInFlight && canCompose;
  const canEnd = callType === 'bidi_streaming' && streamActive && !clientWritesEnded && !disabled;

  const sendTestId = callType === 'client_streaming'
    ? 'grpc-stream-send-now-btn'
    : 'grpc-stream-send-message-btn';

  return (
    <div
      className={`grpc-stream-request-actions grpc-stream-request-actions--${callType.replace('_', '-')}`}
      data-testid="grpc-stream-request-actions"
    >
      <p className="grpc-stream-request-actions__hint">
        {callType === 'client_streaming'
          ? 'Send the current form body on the open stream, or stage messages in the pending panel.'
          : 'Compose a message above, then send. Inbound echoes appear in the stream log.'}
      </p>
      <div className="grpc-stream-request-actions__row">
        <button
          type="button"
          className="grpc-stream-request-actions__send"
          data-testid={sendTestId}
          disabled={!canSend}
          onClick={onSendMessage}
          aria-label={callType === 'client_streaming' ? 'Send message now' : 'Send stream message'}
        >
          ↑ Send message
        </button>
        {callType === 'bidi_streaming' && (
          <button
            type="button"
            className="grpc-stream-request-actions__end"
            data-testid="grpc-stream-end-btn"
            disabled={!canEnd}
            onClick={onEndStream}
            aria-label="End stream"
          >
            End stream
          </button>
        )}
      </div>
    </div>
  );
}
