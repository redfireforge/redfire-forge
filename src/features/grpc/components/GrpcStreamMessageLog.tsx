import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GRPC_STREAM_MESSAGE_CAP, type GrpcStreamLogEntry } from '@shared/grpc/contracts';

const ROW_HEIGHT = 28;
const VIRTUALIZER_OVERSCAN = 12;

export interface GrpcStreamMessageLogProps {
  messages: GrpcStreamLogEntry[];
  disabled?: boolean;
}

function formatPreview(data: Record<string, unknown>): string {
  try {
    const text = JSON.stringify(data);
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  } catch {
    return String(data);
  }
}

function directionSymbol(direction: GrpcStreamLogEntry['direction']): string {
  return direction === 'inbound' ? '↓' : '↑';
}

export function GrpcStreamMessageLog({
  messages,
  disabled = false,
}: GrpcStreamMessageLogProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  const rows = useMemo(() => messages, [messages]);

  return (
    <div className="grpc-stream-log" data-testid="grpc-stream-message-log">
      <div className="grpc-stream-log-header">
        <div className="grpc-stream-log-header-main">
          <span className="grpc-stream-log-title">Stream messages</span>
          {messages.length > 0 && (
            <span className="grpc-stream-log-count" data-testid="grpc-stream-log-count">
              {messages.length >= GRPC_STREAM_MESSAGE_CAP
                ? `Showing ${messages.length.toLocaleString()} messages (cap reached) · cap: ${GRPC_STREAM_MESSAGE_CAP.toLocaleString()}`
                : `${messages.length.toLocaleString()} message${messages.length === 1 ? '' : 's'} · cap: ${GRPC_STREAM_MESSAGE_CAP.toLocaleString()}`}
            </span>
          )}
        </div>
        <span className="grpc-stream-log-legend" data-testid="grpc-stream-direction-legend">
          <span>↓ inbound</span>
          <span>↑ outbound</span>
        </span>
      </div>
      <div
        ref={parentRef}
        className="grpc-stream-log-list"
        data-testid="grpc-stream-log-list"
        aria-disabled={disabled}
      >
        {rows.length === 0 && (
          <p className="grpc-stream-log-empty" data-testid="grpc-stream-log-empty">
            No stream messages yet.
          </p>
        )}
        {rows.length > 0 && (
          <div
            className="grpc-stream-log-inner"
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = rows[virtualRow.index]!;
              return (
                <div
                  key={entry.sequence}
                  data-index={virtualRow.index}
                  data-testid={`grpc-stream-log-row-${entry.sequence}`}
                  className={`grpc-stream-log-row grpc-stream-log-row--${entry.direction}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <span className="grpc-stream-log-seq">#{entry.sequence}</span>
                  <span
                    className="grpc-stream-log-direction"
                    aria-label={entry.direction}
                  >
                    {directionSymbol(entry.direction)}
                  </span>
                  <span className="grpc-stream-log-preview">{formatPreview(entry.data)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
