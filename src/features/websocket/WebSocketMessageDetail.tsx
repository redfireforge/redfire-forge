import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WsFrame } from '../../shared/websocket/types';
import { formatBytes } from '../../shared/websocket/types';
import { isValidJson, prettyJson, tokenizeJson, buildHexDumpLines, formatWsTimestamp } from './wsMessageUtils';

type DetailTab = 'json' | 'raw' | 'hex';

interface WebSocketMessageDetailProps {
  frame: WsFrame;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}



const MIN_PANEL_HEIGHT = 100;
const DEFAULT_PANEL_HEIGHT = 250;

export function WebSocketMessageDetail({
  frame,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: WebSocketMessageDetailProps) {
  const jsonAvailable = useMemo(() => isValidJson(frame.data), [frame.data]);
  const isBinary = frame.type === 'binary';
  const defaultTab: DetailTab = jsonAvailable ? 'json' : isBinary ? 'hex' : 'raw';

  const [activeTab, setActiveTab] = useState<DetailTab>(defaultTab);
  const [wordWrap, setWordWrap] = useState(true);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  useEffect(() => {
    const tab = jsonAvailable ? 'json' : isBinary ? 'hex' : 'raw';
    setActiveTab(tab);
  }, [frame.id, jsonAvailable, isBinary]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(frame.data).catch(() => {});
  }, [frame.data]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hasPrev) onPrev();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hasNext) onNext();
      }
    },
    [onClose, onPrev, onNext, hasPrev, hasNext],
  );

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - ev.clientY;
      const newHeight = Math.max(MIN_PANEL_HEIGHT, startHeightRef.current + delta);
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelHeight]);

  const renderedContent = useMemo(() => {
    if (activeTab === 'json' && jsonAvailable) {
      const pretty = prettyJson(frame.data);
      const tokens = tokenizeJson(pretty);
      return (
        <pre className={`ws-detail-body ${wordWrap ? 'wrap' : ''}`} data-testid="detail-content">
          {tokens.map((t, i) => {
            const cls = t.type === 'punct' ? undefined : `ws-json-${t.type}`;
            return cls ? <span key={i} className={cls}>{t.text}</span> : t.text;
          })}
        </pre>
      );
    }
    if (activeTab === 'hex') {
      const lines = buildHexDumpLines(frame.data);
      return (
        <pre className={`ws-detail-body ws-detail-hex ${wordWrap ? 'wrap' : ''}`} data-testid="detail-content">
          {lines.length === 0 ? (
            '(empty)'
          ) : (
            lines.map((line, i) => (
              <span key={i} className="ws-hex-line">
                <span className="hex-offset">{line.offset}</span>
                {'  '}
                <span className="hex-bytes">{line.hexLeft}</span>
                {'  '}
                <span className="hex-bytes">{line.hexRight}</span>
                {'  '}
                <span className="hex-ascii">|{line.ascii}|</span>
                {'\n'}
              </span>
            ))
          )}
        </pre>
      );
    }
    return (
      <pre className={`ws-detail-body ${wordWrap ? 'wrap' : ''}`} data-testid="detail-content">
        {frame.data}
      </pre>
    );
  }, [activeTab, frame.data, jsonAvailable, wordWrap]);

  const dirLabel = frame.direction === 'sent' ? '↑ Sent' : '↓ Received';
  const timeLabel = formatWsTimestamp(frame.timestamp);

  return (
    <div
      className="ws-detail-panel"
      style={{ height: panelHeight }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      data-testid="detail-panel"
    >
      <div
        className="ws-detail-resize"
        onMouseDown={handleResizeStart}
        data-testid="detail-resize"
        aria-label="Resize detail panel"
      />
      <div className="ws-detail-header">
        <span className="ws-detail-meta">
          {dirLabel} — {timeLabel} — {formatBytes(frame.size)}
        </span>
        <div className="ws-detail-tabs">
          {jsonAvailable && (
            <button
              className={`ws-detail-tab ${activeTab === 'json' ? 'active' : ''}`}
              onClick={() => setActiveTab('json')}
              data-testid="tab-json"
            >
              JSON
            </button>
          )}
          <button
            className={`ws-detail-tab ${activeTab === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw')}
            data-testid="tab-raw"
          >
            Raw
          </button>
          <button
            className={`ws-detail-tab ${activeTab === 'hex' ? 'active' : ''}`}
            onClick={() => setActiveTab('hex')}
            data-testid="tab-hex"
          >
            Hex
          </button>
        </div>
        <div className="ws-detail-actions">
          <button
            className="ws-detail-action-btn"
            onClick={onPrev}
            disabled={!hasPrev}
            title="Previous message (↑)"
            data-testid="detail-prev"
          >
            ▲
          </button>
          <button
            className="ws-detail-action-btn"
            onClick={onNext}
            disabled={!hasNext}
            title="Next message (↓)"
            data-testid="detail-next"
          >
            ▼
          </button>
          <button
            className={`ws-detail-action-btn ${wordWrap ? 'active' : ''}`}
            onClick={() => setWordWrap((v) => !v)}
            title="Toggle word wrap"
            data-testid="detail-wrap"
          >
            Wrap
          </button>
          <button
            className="ws-detail-action-btn"
            onClick={handleCopy}
            title="Copy raw content"
            data-testid="detail-copy"
          >
            Copy
          </button>
          <button
            className="ws-detail-action-btn"
            onClick={onClose}
            title="Close detail panel"
            data-testid="detail-close"
          >
            ×
          </button>
        </div>
      </div>
      {renderedContent}
    </div>
  );
}
