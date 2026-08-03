import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDrag } from '../../shared/hooks/useModalDrag';
import { useModalResize } from '../../shared/hooks/useModalResize';
import ModalResizeHandles from '../../shared/components/ModalResizeHandles';
import type { KafkaConsumeResultRow } from './types';
import { parseKafkaTimestamp, formatTimestampTooltip, formatRelativeAge } from './kafkaTimestamp';

interface KafkaMessageDetailModalProps {
  message: KafkaConsumeResultRow;
  onClose: () => void;
  onUseAsWorkflowInput?: () => void;
}

export default function KafkaMessageDetailModal({
  message,
  onClose,
  onUseAsWorkflowInput,
}: KafkaMessageDetailModalProps) {
  const [copied, setCopied] = useState<'key' | 'payload' | null>(null);

  const { onDragStart, modalStyle, overlayStyle } = useModalDrag(true);
  const { resizeStyle, onRightEdge, onCorner, onBottomEdge } = useModalResize(420, 300);

  const combinedModalStyle: React.CSSProperties = {
    ...modalStyle,
    ...resizeStyle,
  };

  const prettyValue = useMemo(() => {
    try { return JSON.stringify(JSON.parse(message.value), null, 2); }
    catch { return message.value; }
  }, [message.value]);

  const headers = message.headers && Object.keys(message.headers).length > 0
    ? Object.entries(message.headers)
    : null;

  const tsDate = parseKafkaTimestamp(message.timestamp);
  const tsFormatted = tsDate ? formatTimestampTooltip(tsDate) : '—';
  const tsRelative = tsDate ? formatRelativeAge(tsDate) : null;

  const handleCopyKey = useCallback(() => {
    if (message.key) {
      void navigator.clipboard.writeText(message.key);
      setCopied('key');
      setTimeout(() => setCopied(null), 1500);
    }
  }, [message.key]);

  const handleCopyPayload = useCallback(() => {
    void navigator.clipboard.writeText(prettyValue);
    setCopied('payload');
    setTimeout(() => setCopied(null), 1500);
  }, [prettyValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return createPortal(
    <div
      className="kmd-overlay"
      style={overlayStyle}
      onKeyDown={handleKeyDown}
    >
      <div
        className="kmd-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Message Detail"
        data-testid="kafka-message-detail-modal"
        style={combinedModalStyle}
      >
        {/* ── Header (drag handle) ── */}
        <div className="kmd-header" onMouseDown={onDragStart}>
          <div className="kmd-header-left">
            <span className="kmd-title">Message Detail</span>
            <span className="kmd-subtitle">
              Partition {message.partition}
              <span aria-hidden="true"> · </span>
              Offset {message.offset}
            </span>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="kmd-body">
          {/* Metadata grid */}
          <div className="kmd-meta-grid">
            <div className="kmd-meta-item">
              <span className="kmd-meta-label">Offset</span>
              <span className="kmd-meta-value" data-testid="kmd-offset">{message.offset}</span>
            </div>
            <div className="kmd-meta-item">
              <span className="kmd-meta-label">Partition</span>
              <span className="kmd-meta-value" data-testid="kmd-partition">{message.partition}</span>
            </div>
            <div className="kmd-meta-item">
              <span className="kmd-meta-label">Timestamp</span>
              <span className="kmd-meta-value" data-testid="kmd-timestamp" title={tsFormatted}>
                {tsRelative ? <>{tsRelative} <span className="kmd-meta-dim">({tsFormatted})</span></> : tsFormatted}
              </span>
            </div>
            <div className="kmd-meta-item">
              <span className="kmd-meta-label">Topic</span>
              <span className="kmd-meta-value kmd-meta-mono" data-testid="kmd-topic">{message.topic}</span>
            </div>
          </div>

          {/* Key */}
          <div className="kmd-section">
            <div className="kmd-section-header">
              <span className="kmd-section-title">Key</span>
              <button
                className="kmd-copy-btn"
                onClick={handleCopyKey}
                disabled={!message.key}
                data-testid="kmd-copy-key"
              >
                {copied === 'key' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="kmd-pre kmd-pre--key" data-testid="kmd-key">
              {message.key ?? '—'}
            </pre>
          </div>

          {/* Headers */}
          {headers && (
            <div className="kmd-section">
              <div className="kmd-section-header">
                <span className="kmd-section-title">
                  Headers <span className="kmd-badge">{headers.length}</span>
                </span>
              </div>
              <table className="kmd-headers-table" data-testid="kmd-headers">
                <thead>
                  <tr><th>Key</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {headers.map(([k, v]) => (
                    <tr key={k}><td className="kmd-header-key">{k}</td><td>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Message Body */}
          <div className="kmd-section kmd-section--body">
            <div className="kmd-section-header">
              <span className="kmd-section-title">Message Body</span>
              <button
                className="kmd-copy-btn"
                onClick={handleCopyPayload}
                data-testid="kmd-copy-payload"
              >
                {copied === 'payload' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="kmd-pre kmd-pre--body" data-testid="kmd-body">
              {prettyValue}
            </pre>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="kmd-footer">
          {onUseAsWorkflowInput && (
            <button
              className="kmd-workflow-btn"
              onClick={onUseAsWorkflowInput}
              data-testid="kmd-workflow-btn"
            >
              Use as Workflow Input
            </button>
          )}
          <button
            className="kmd-close-btn"
            onClick={onClose}
            data-testid="kmd-close-btn"
          >
            Close
          </button>
        </div>

        <ModalResizeHandles
          onRightEdge={onRightEdge}
          onCorner={onCorner}
          onBottomEdge={onBottomEdge}
        />
      </div>
    </div>,
    document.body,
  );
}
