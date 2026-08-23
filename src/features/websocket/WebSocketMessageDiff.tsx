import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WsFrame } from '@shared/websocket/types';
import { formatBytes } from '@shared/websocket/types';
import { formatWsTimestamp } from './wsMessageUtils';
import { computeDiff, formatUnifiedDiff, formatDiffValue } from './wsMessageDiffEngine';
import type { DiffResult } from './wsMessageDiffEngine';

interface WebSocketMessageDiffProps {
  left: WsFrame;
  right: WsFrame;
  onClose: () => void;
  onSwap: () => void;
}

function SideMeta({
  side,
  frame,
  sizeDeltaLabel,
  testId,
}: {
  side: 'A' | 'B';
  frame: WsFrame;
  sizeDeltaLabel?: string;
  testId: string;
}) {
  const dirLabel = frame.direction === 'sent' ? 'Sent' : 'Received';
  const dirIcon = frame.direction === 'sent' ? '↑' : '↓';
  return (
    <div className={`ws-diff-side ws-diff-side--${side.toLowerCase()}`} data-testid={testId}>
      <div className="ws-diff-side-top">
        <span className="ws-diff-side-badge" aria-hidden="true">{side}</span>
        <span className={`ws-diff-dir-chip ws-diff-dir-chip--${frame.direction}`}>
          {dirIcon} {dirLabel}
        </span>
      </div>
      <div className="ws-diff-side-meta">
        <span className="ws-diff-side-time">{formatWsTimestamp(frame.timestamp)}</span>
        <span className="ws-diff-side-size">
          {formatBytes(frame.size)}
          {sizeDeltaLabel != null && (
            <span className="ws-diff-size-delta"> ({sizeDeltaLabel})</span>
          )}
        </span>
      </div>
    </div>
  );
}

export function WebSocketMessageDiff({ left, right, onClose, onSwap }: WebSocketMessageDiffProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Drag state: null = use CSS centering; { x, y } = pinned position
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag on direct header clicks, not on buttons inside it
    if ((e.target as HTMLElement).closest('button')) return;
    const modal = modalRef.current;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    dragOrigin.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };
    setIsDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragOrigin.current) return;
      setPos({
        x: dragOrigin.current.origX + (e.clientX - dragOrigin.current.startX),
        y: dragOrigin.current.origY + (e.clientY - dragOrigin.current.startY),
      });
    };
    const onUp = () => {
      dragOrigin.current = null;
      setIsDragging(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const diff: DiffResult = useMemo(
    () => computeDiff(left.data, right.data),
    [left.data, right.data],
  );

  const sizeDelta = right.size - left.size;
  const sizeDeltaLabel = sizeDelta === 0 ? '±0' : sizeDelta > 0 ? `+${formatBytes(sizeDelta)}` : `-${formatBytes(-sizeDelta)}`;

  const handleCopy = useCallback(() => {
    const leftLabel = `${left.direction} ${formatWsTimestamp(left.timestamp)}`;
    const rightLabel = `${right.direction} ${formatWsTimestamp(right.timestamp)}`;
    const text = formatUnifiedDiff(diff.lines, leftLabel, rightLabel);
    navigator.clipboard.writeText(text).catch(() => {});
  }, [diff.lines, left, right]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const { addedCount, removedCount, changedCount } = useMemo(() => {
    let added = 0, removed = 0, changed = 0;
    for (const entry of diff.jsonEntries) {
      if (entry.type === 'added') added++;
      else if (entry.type === 'removed') removed++;
      else changed++;
    }
    return { addedCount: added, removedCount: removed, changedCount: changed };
  }, [diff.jsonEntries]);

  const hasChanges = diff.lines.some((l) => l.type !== 'same');
  const totalStructural = diff.jsonEntries.length;

  const modalStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : {};

  return (
    <div className="ws-diff-overlay" ref={overlayRef} data-testid="diff-overlay">
      <div
        className="ws-diff-modal"
        ref={modalRef}
        style={modalStyle}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Message Diff"
        data-testid="diff-modal"
      >
        <div
          className="ws-diff-header"
          onMouseDown={handleHeaderMouseDown}
          data-dragging={isDragging ? 'true' : undefined}
        >
          <div className="ws-diff-header-text">
            <span className="ws-diff-title">Message Diff</span>
            <span className="ws-diff-subtitle">Compare two WebSocket payloads</span>
          </div>
          <div className="ws-diff-header-actions">
            <button
              type="button"
              className="ws-diff-action-btn"
              onClick={onSwap}
              title="Swap sides"
              aria-label="Swap sides"
              data-testid="diff-swap"
            >
              ⇄ Swap
            </button>
            <button
              type="button"
              className="ws-diff-action-btn"
              onClick={handleCopy}
              title="Copy as unified diff"
              aria-label="Copy as unified diff"
              data-testid="diff-copy"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="ws-diff-meta" data-testid="diff-meta">
          <SideMeta side="A" frame={left} testId="diff-meta-left" />
          <div className="ws-diff-meta-vs" aria-hidden="true">vs</div>
          <SideMeta side="B" frame={right} sizeDeltaLabel={sizeDeltaLabel} testId="diff-meta-right" />
        </div>

        <div className="ws-diff-body">
          {diff.isJsonDiff && totalStructural > 0 && (
            <div className="ws-diff-summary" data-testid="diff-summary">
              <span className="ws-diff-summary-title">
                {totalStructural} structural change{totalStructural !== 1 ? 's' : ''}
              </span>
              <div className="ws-diff-summary-badges">
                {addedCount > 0 && (
                  <span className="ws-diff-badge ws-diff-badge-added">{addedCount} added</span>
                )}
                {removedCount > 0 && (
                  <span className="ws-diff-badge ws-diff-badge-removed">{removedCount} removed</span>
                )}
                {changedCount > 0 && (
                  <span className="ws-diff-badge ws-diff-badge-changed">{changedCount} changed</span>
                )}
              </div>
            </div>
          )}

          {diff.isJsonDiff && totalStructural > 0 && (
            <div className="ws-diff-entries" data-testid="diff-entries">
              {diff.jsonEntries.map((entry, i) => (
                <div
                  key={i}
                  className={`ws-diff-entry ws-diff-entry-${entry.type}`}
                  data-testid={`diff-entry-${i}`}
                >
                  <code className="ws-diff-entry-path">{entry.path}</code>
                  <span className={`ws-diff-entry-type ws-diff-type-${entry.type}`}>{entry.type}</span>
                  {entry.type === 'changed' && (
                    <span className="ws-diff-entry-values">
                      <span className="ws-diff-val-old">{formatDiffValue(entry.oldValue)}</span>
                      <span className="ws-diff-val-arrow">→</span>
                      <span className="ws-diff-val-new">{formatDiffValue(entry.newValue)}</span>
                    </span>
                  )}
                  {entry.type === 'added' && (
                    <span className="ws-diff-entry-values">
                      <span className="ws-diff-val-new">{formatDiffValue(entry.newValue)}</span>
                    </span>
                  )}
                  {entry.type === 'removed' && (
                    <span className="ws-diff-entry-values">
                      <span className="ws-diff-val-old">{formatDiffValue(entry.oldValue)}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="ws-diff-content" data-testid="diff-content">
            <div className="ws-diff-content-label">Unified diff</div>
            {!hasChanges ? (
              <div className="ws-diff-identical" data-testid="diff-identical">
                Messages are identical
              </div>
            ) : (
              <div className="ws-diff-lines">
                {diff.lines.map((line, i) => (
                  <div key={i} className={`ws-diff-line ws-diff-line-${line.type}`}>
                    <span className="ws-diff-linenum ws-diff-linenum-left">
                      {line.leftNum ?? ''}
                    </span>
                    <span className="ws-diff-linenum ws-diff-linenum-right">
                      {line.rightNum ?? ''}
                    </span>
                    <span className="ws-diff-line-marker">
                      {line.type === 'removed' ? '−' : line.type === 'added' ? '+' : ' '}
                    </span>
                    <span className="ws-diff-line-content">{line.content || ' '}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ws-diff-footer">
          <button
            type="button"
            className="ws-diff-close-btn"
            onClick={onClose}
            data-testid="diff-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
