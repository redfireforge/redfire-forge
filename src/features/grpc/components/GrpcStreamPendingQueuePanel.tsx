import { previewGrpcStreamPendingBody } from '../utils/grpcStreamPendingQueue';

export interface GrpcStreamPendingQueuePanelProps {
  pendingBodies: Record<string, unknown>[];
  streamActive: boolean;
  clientWritesEnded: boolean;
  sendAllInFlight?: boolean;
  disabled?: boolean;
  onRemoveAtIndex: (index: number) => void;
  onSendAll: () => void | Promise<void>;
  onEndStream: () => void;
}

export function GrpcStreamPendingQueuePanel({
  pendingBodies,
  streamActive,
  clientWritesEnded,
  sendAllInFlight = false,
  disabled = false,
  onRemoveAtIndex,
  onSendAll,
  onEndStream,
}: GrpcStreamPendingQueuePanelProps) {
  const canSendAll = streamActive && !clientWritesEnded && !disabled && !sendAllInFlight && pendingBodies.length > 0;
  const canEnd = streamActive && !clientWritesEnded && !disabled;

  return (
    <aside className="grpc-stream-pending-panel" data-testid="grpc-stream-pending-panel">
      <div className="grpc-stream-pending-panel__header">
        <span className="grpc-stream-pending-panel__title">Pending messages</span>
        {pendingBodies.length > 0 && (
          <span className="grpc-stream-pending-panel__chip" data-testid="grpc-stream-pending-chip">
            {pendingBodies.length} queued
          </span>
        )}
      </div>
      <div className="grpc-stream-pending-panel__list" data-testid="grpc-stream-pending-list">
        {pendingBodies.length === 0 && (
          <p className="grpc-stream-pending-panel__empty" data-testid="grpc-stream-pending-empty">
            Queue is empty — compose a body and click Add to queue.
          </p>
        )}
        {pendingBodies.map((body, index) => (
          <div
            className="grpc-stream-pending-item"
            key={`pending-${index}`}
            data-testid={`grpc-stream-pending-item-${index}`}
          >
            <span className="grpc-stream-pending-item__index">#{index + 1}</span>
            <span className="grpc-stream-pending-item__body">
              {previewGrpcStreamPendingBody(body)}
            </span>
            <button
              type="button"
              className="grpc-stream-pending-item__remove"
              data-testid={`grpc-stream-pending-remove-${index}`}
              disabled={disabled || sendAllInFlight}
              aria-label={`Remove pending message ${index + 1}`}
              onClick={() => onRemoveAtIndex(index)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="grpc-stream-pending-panel__footer">
        <button
          type="button"
          className="grpc-stream-pending-send-all-btn"
          data-testid="grpc-stream-send-all-btn"
          disabled={!canSendAll}
          onClick={onSendAll}
          aria-label={`Send all ${pendingBodies.length} pending messages`}
        >
          ▶ Send all ({pendingBodies.length})
        </button>
        <button
          type="button"
          className="grpc-stream-end-btn"
          data-testid="grpc-stream-pending-end-btn"
          disabled={!canEnd}
          onClick={onEndStream}
          aria-label="End stream"
        >
          End stream
        </button>
      </div>
    </aside>
  );
}
