import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { WsFrame } from '../../shared/websocket/types';
import { formatBytes } from '../../shared/websocket/types';
import { formatWsTimestamp } from './wsMessageUtils';
import { computeDiff, formatUnifiedDiff, formatDiffValue } from './wsMessageDiffEngine';
import type { DiffResult } from './wsMessageDiffEngine';

interface WebSocketMessageDiffProps {
  left: WsFrame;
  right: WsFrame;
  onClose: () => void;
  onSwap: () => void;
}

export function WebSocketMessageDiff({ left, right, onClose, onSwap }: WebSocketMessageDiffProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

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
  const leftDir = left.direction === 'sent' ? '↑' : '↓';
  const rightDir = right.direction === 'sent' ? '↑' : '↓';

  return (
    <div className="ws-diff-overlay" ref={overlayRef} onKeyDown={handleKeyDown} tabIndex={-1} data-testid="diff-overlay">
      <div className="ws-diff-modal" data-testid="diff-modal">
        <div className="ws-diff-header">
          <span className="ws-diff-title">Message Diff</span>
          <div className="ws-diff-header-actions">
            <button className="ws-diff-action-btn" onClick={onSwap} title="Swap sides" data-testid="diff-swap">
              ⇄
            </button>
            <button className="ws-diff-action-btn" onClick={handleCopy} title="Copy as unified diff" data-testid="diff-copy">
              Copy
            </button>
            <button className="ws-diff-action-btn" onClick={onClose} title="Close" data-testid="diff-close">
              ×
            </button>
          </div>
        </div>

        <div className="ws-diff-meta">
          <div className="ws-diff-meta-side" data-testid="diff-meta-left">
            <span className="ws-diff-meta-badge">A</span>
            {leftDir} {left.direction} — {formatWsTimestamp(left.timestamp)} — {formatBytes(left.size)}
          </div>
          <div className="ws-diff-meta-side" data-testid="diff-meta-right">
            <span className="ws-diff-meta-badge">B</span>
            {rightDir} {right.direction} — {formatWsTimestamp(right.timestamp)} — {formatBytes(right.size)}
            <span className="ws-diff-size-delta">({sizeDeltaLabel})</span>
          </div>
        </div>

        {diff.isJsonDiff && diff.jsonEntries.length > 0 && (
          <div className="ws-diff-summary" data-testid="diff-summary">
            <span className="ws-diff-summary-title">
              {diff.jsonEntries.length} structural change{diff.jsonEntries.length !== 1 ? 's' : ''}:
            </span>
            {addedCount > 0 && <span className="ws-diff-badge ws-diff-badge-added">{addedCount} added</span>}
            {removedCount > 0 && <span className="ws-diff-badge ws-diff-badge-removed">{removedCount} removed</span>}
            {changedCount > 0 && <span className="ws-diff-badge ws-diff-badge-changed">{changedCount} changed</span>}
          </div>
        )}

        {diff.isJsonDiff && diff.jsonEntries.length > 0 && (
          <div className="ws-diff-entries" data-testid="diff-entries">
            {diff.jsonEntries.map((entry, i) => (
              <div key={i} className={`ws-diff-entry ws-diff-entry-${entry.type}`} data-testid={`diff-entry-${i}`}>
                <span className="ws-diff-entry-path">{entry.path}</span>
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
          {!hasChanges ? (
            <div className="ws-diff-identical" data-testid="diff-identical">Messages are identical</div>
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
                    {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
                  </span>
                  <span className="ws-diff-line-content">{line.content || ' '}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
