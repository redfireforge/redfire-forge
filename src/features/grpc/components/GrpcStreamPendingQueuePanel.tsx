import { previewGrpcStreamPendingBody } from '../utils/grpcStreamPendingQueue';

export interface GrpcStreamPendingQueuePanelProps {
  pendingBodies: Record<string, unknown>[];
  streamActive: boolean;
  clientWritesEnded: boolean;
  sendAllInFlight?: boolean;
  disabled?: boolean;
  canCompose?: boolean;
  onAddToQueue?: () => void;
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
  canCompose = true,
  onAddToQueue,
  onRemoveAtIndex,
  onSendAll,
  onEndStream,
}: GrpcStreamPendingQueuePanelProps) {
  const canSendAll = streamActive && !clientWritesEnded && !disabled && !sendAllInFlight && pendingBodies.length > 0;
  const canEnd = streamActive && !clientWritesEnded && !disabled;
  const canQueue = !disabled && !sendAllInFlight && canCompose && Boolean(onAddToQueue);

  return (
    <aside className="grpc-stream-pending-panel" data-testid="grpc-stream-pending-panel">
      <div className="grpc-stream-pending-panel__header">
        <span className="grpc-stream-pending-panel__title">Pending messages</span>
        {pendingBodies.length > 0 && (
          <span
            className="grpc-stream-pending-panel__chip"
            data-testid="grpc-stream-pending-chip"
            data-grpc-pending-count={pendingBodies.length}
          >
            {pendingBodies.length} queued
          </span>
        )}
      </div>
      <div className="grpc-stream-pending-panel__list" data-testid="grpc-stream-pending-list">
        {pendingBodies.length === 0 && (
          <p className="grpc-stream-pending-panel__empty" data-testid="grpc-stream-pending-empty">
            Compose a body in the form, then click <strong>Add to queue</strong> below.
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
        {onAddToQueue && (
          <button
            type="button"
            className="grpc-stream-pending-add-btn"
            data-testid="grpc-stream-add-queue-btn"
            disabled={!canQueue}
            onClick={onAddToQueue}
            aria-label="Add message to pending queue"
          >
            + Add to queue
          </button>
        )}
        <div className="grpc-stream-pending-panel__stream-actions">
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
            className="grpc-stream-pending-end-btn"
            data-testid="grpc-stream-pending-end-btn"
            disabled={!canEnd}
            onClick={onEndStream}
            aria-label="End stream"
          >
            End stream
          </button>
        </div>
      </div>
    </aside>
  );
}
