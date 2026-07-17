import { memo, useCallback } from 'react';
import type { WsFrame } from '../../shared/websocket/types';
import { formatBytes } from '../../shared/websocket/types';
import { isValidJson, prettyJson, tokenizeJson, buildBinaryPreview, formatWsTimestamp } from './wsMessageUtils';

export interface MessageRowProps {
  frame: WsFrame;
  isSelected: boolean;
  isBookmarked: boolean;
  compareBadge: 'A' | 'B' | null;
  validationBadge: 'valid' | 'invalid' | null;
  onRowClick: (id: string) => void;
  onToggleBookmark: (id: string) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function renderInlineJson(json: string): React.ReactNode {
  const tokens = tokenizeJson(prettyJson(json));
  return tokens.map((t, i) => {
    const cls = t.type === 'punct' ? undefined : `ws-json-${t.type}`;
    return cls ? <span key={i} className={cls}>{t.text}</span> : t.text;
  });
}

export const MessageRow = memo(function MessageRow({ frame, isSelected, isBookmarked, compareBadge, validationBadge, onRowClick, onToggleBookmark }: MessageRowProps) {
  const meta = frame.protocolMeta;
  const isSystem = frame.type === 'close' || meta?.isSystemPacket || !!(frame as WsFrame & { isSystem?: boolean }).isSystem;
  const isCloseSent = frame.data.startsWith('CLOSE SENT');
  const isCloseAck = frame.data.startsWith('CLOSE ACK');
  const isJson = frame.type !== 'binary' && isValidJson(frame.data);
  const isBinary = frame.type === 'binary';
  const typeLabel = meta ? meta.packetType : isSystem ? 'sys' : isJson ? 'json' : frame.type;

  let contentDisplay: React.ReactNode;
  if (meta?.summary) {
    contentDisplay = meta.summary;
  } else if (isBinary) {
    contentDisplay = buildBinaryPreview(frame.data, frame.size);
  } else if (isJson && frame.data.length <= 500) {
    const pretty = prettyJson(frame.data);
    const display = pretty.length > 500 ? pretty.slice(0, 500) + '\u2026' : pretty;
    contentDisplay = renderInlineJson(display);
  } else {
    const preview = frame.data.length > 500 ? frame.data.slice(0, 500) + '\u2026' : frame.data;
    contentDisplay = preview;
  }

  const rowClasses = [
    'ws-message-row',
    isSystem ? '' : (frame.direction === 'sent' ? 'ws-message-sent' : 'ws-message-received'),
    isSystem ? 'ws-message-system' : '',
    meta ? 'ws-message-protocol' : '',
    isSelected ? 'ws-msg-selected selected' : '',
    isBookmarked ? 'ws-message-bookmarked' : '',
    isCloseSent ? 'ws-message-close-sent' : '',
    isCloseAck ? 'ws-message-close-ack' : '',
  ].filter(Boolean).join(' ');

  const handleClick = useCallback(() => onRowClick(frame.id), [onRowClick, frame.id]);
  const handleBookmark = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleBookmark(frame.id);
  }, [onToggleBookmark, frame.id]);

  return (
    <div
      className={rowClasses}
      onClick={handleClick}
      role="button"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      aria-label={isSystem ? 'system message' : `${frame.direction} message`}
      data-testid={`message-row-${frame.id}`}
    >
      {compareBadge && <span className="ws-compare-badge">{compareBadge}</span>}
      <button
        className={`ws-message-bookmark-btn ${isBookmarked ? 'active' : ''}`}
        onClick={handleBookmark}
        aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
        tabIndex={-1}
        data-testid={`bookmark-btn-${frame.id}`}
      >
        {isBookmarked ? '★' : '☆'}
      </button>
      <span className="ws-message-direction">
        {isSystem ? '◆' : frame.direction === 'sent' ? '↑' : '↓'}
      </span>
      <span className="ws-message-timestamp">
        {formatWsTimestamp(frame.timestamp)}
      </span>
      <span className={`ws-message-type ${meta ? 'ws-message-type-protocol' : ''}`} data-type={typeLabel}>{typeLabel}</span>
      {validationBadge && (
        <span
          className={`ws-validation-badge ws-validation-${validationBadge}`}
          data-testid={`validation-badge-${frame.id}`}
          aria-label={validationBadge === 'valid' ? 'Schema valid' : 'Schema invalid'}
        >
          {validationBadge === 'valid' ? '✓' : '✗'}
        </span>
      )}
      <span className="ws-message-content">{contentDisplay}</span>
      <span className="ws-message-size">{formatBytes(frame.size)}</span>
    </div>
  );
});
