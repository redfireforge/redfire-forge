import type { GrpcStreamingCallType } from '../../../shared/grpc/contracts';

export interface GrpcStreamComposePanelProps {
  callType: GrpcStreamingCallType;
  pendingCount: number;
  streamActive: boolean;
  clientWritesEnded: boolean;
  disabled?: boolean;
  canCompose?: boolean;
  sendAllInFlight?: boolean;
  onAddToQueue?: () => void;
  onSendMessage: () => void;
  onEndStream: () => void;
}

export function GrpcStreamComposePanel({
  callType,
  pendingCount,
  streamActive,
  clientWritesEnded,
  disabled = false,
  canCompose = true,
  sendAllInFlight = false,
  onAddToQueue,
  onSendMessage,
  onEndStream,
}: GrpcStreamComposePanelProps) {
  if (callType === 'server_streaming') {
    return null;
  }

  const canSend = streamActive && !clientWritesEnded && !disabled && !sendAllInFlight && canCompose;
  const canEnd = streamActive && !clientWritesEnded && !disabled;
  const canQueue = !disabled && !sendAllInFlight && canCompose && !!onAddToQueue;

  return (
    <div className="grpc-stream-compose" data-testid="grpc-stream-compose-panel">
      <div className="grpc-stream-compose-hint">
        {callType === 'client_streaming'
          ? 'Compose a request body, add to the queue, send a message when the stream is open, or Send all from the pending panel.'
          : 'Send outbound messages; inbound echoes appear in the log. End stream when done.'}
      </div>
      {callType === 'client_streaming' && pendingCount > 0 && (
        <div className="grpc-stream-compose-queue" data-testid="grpc-stream-pending-count">
          {pendingCount} queued
        </div>
      )}
      <div className="grpc-stream-compose-actions">
        {callType === 'client_streaming' && onAddToQueue && (
          <button
            type="button"
            className="grpc-stream-add-queue-btn"
            data-testid="grpc-stream-add-queue-btn"
            disabled={!canQueue}
            onClick={onAddToQueue}
            aria-label="Add message to pending queue"
          >
            + Add to queue
          </button>
        )}
        {callType === 'client_streaming' && (
          <button
            type="button"
            className="grpc-stream-send-now-btn"
            data-testid="grpc-stream-send-now-btn"
            disabled={!canSend}
            onClick={onSendMessage}
            aria-label="Send message now"
          >
            Send message
          </button>
        )}
        {callType !== 'client_streaming' && (
          <button
            type="button"
            className="grpc-stream-send-msg-btn"
            data-testid="grpc-stream-send-message-btn"
            disabled={!canSend}
            onClick={onSendMessage}
            aria-label="Send stream message"
          >
            Send message
          </button>
        )}
        {callType === 'bidi_streaming' && (
          <button
            type="button"
            className="grpc-stream-end-btn"
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
