import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SearchMatchBar } from '../../shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '../../shared/hooks/useSearchMatchNavigation';
import { useModalDrag } from '../../shared/hooks/useModalDrag';
import { useModalResize } from '../../shared/hooks/useModalResize';
import ModalResizeHandles from '../../shared/components/ModalResizeHandles';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  format: string;
}

export default function KafkaBodyEditorModal({ value, onChange, onClose, format }: Props) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isJson = format === 'json' || !format;
  const formatLabel = (format || 'json').toUpperCase();

  // Drag & resize
  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(true, {
    modalRef,
    constrainToViewport: true,
    viewportPadding: 12,
  });
  const { resizeStyle, onRightEdge, onCorner, onBottomEdge } = useModalResize(720, 520);

  const handlePretty = useCallback(() => {
    try {
      const parsed = JSON.parse(draft);
      setDraft(JSON.stringify(parsed, null, 2));
    } catch { /* leave as-is */ }
  }, [draft]);

  const handleMinify = useCallback(() => {
    try {
      const parsed = JSON.parse(draft);
      setDraft(JSON.stringify(parsed));
    } catch { /* leave as-is */ }
  }, [draft]);

  const handleSave = useCallback(() => {
    onChange(draft);
    onClose();
  }, [draft, onChange, onClose]);

  const validJson = useMemo(() => {
    if (!isJson) return true;
    try { JSON.parse(draft); return true; } catch { return false; }
  }, [draft, isJson]);

  const lineCount = useMemo(() => draft.split('\n').length, [draft]);
  const charCount = draft.length;

  // Search
  const [searchTerm, setSearchTermRaw] = useState('');

  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    try {
      const re = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return (draft.match(re) ?? []).length;
    } catch { return 0; }
  }, [draft, searchTerm]);

  const {
    currentMatchIndex,
    setCurrentMatchIndex,
    goNext,
    goPrev,
    clear: clearSearch,
  } = useSearchMatchNavigation(matchCount);

  const setSearchTerm = useCallback((v: string) => {
    setSearchTermRaw(v);
    if (!v.trim()) { clearSearch(); setCurrentMatchIndex(0); }
  }, [clearSearch, setCurrentMatchIndex]);

  // Cmd+F to focus search
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const lineNumbers = useMemo(() => {
    const lines = draft.split('\n');
    return lines.map((_, i) => i + 1);
  }, [draft]);

  const combinedModalStyle: React.CSSProperties = {
    ...modalStyle,
    ...resizeStyle,
  };

  return createPortal(
    <div
      className="kbe-overlay"
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="kbe-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Message Body Editor"
        data-testid="kafka-body-editor-modal"
        ref={modalRef}
        style={combinedModalStyle}
      >
        {/* Header — drag handle (no close icon; Cancel/Apply live in footer) */}
        <div className="kbe-header" onMouseDown={onDragStart}>
          <div className="kbe-header-left">
            <div className="kbe-title-row">
              <span className="kbe-title">Message body</span>
              <span className="kbe-format-pill">{formatLabel}</span>
              {isJson && (
                <span
                  className={`kbe-json-badge ${validJson ? 'kbe-json-badge--ok' : 'kbe-json-badge--err'}`}
                >
                  {validJson ? 'Valid JSON' : 'Invalid JSON'}
                </span>
              )}
            </div>
            <span className="kbe-stats">
              {lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'}
              {' · '}
              {charCount.toLocaleString()} chars
            </span>
          </div>
          <div className="kbe-header-right" onMouseDown={(e) => e.stopPropagation()}>
            <SearchMatchBar
              value={searchTerm}
              onChange={setSearchTerm}
              currentMatch={currentMatchIndex}
              totalMatches={matchCount}
              onPrev={goPrev}
              onNext={goNext}
              onClear={() => setSearchTerm('')}
              placeholder="Search body…"
              className="kbe-search"
              inputRef={searchInputRef}
              ariaLabel="Search body content"
            />
          </div>
        </div>

        {/* Toolbar */}
        {isJson && (
          <div className="kbe-toolbar">
            <div className="kbe-toolbar-actions">
              <button
                type="button"
                className="kbe-action-btn"
                onClick={handlePretty}
                title="Pretty-print JSON"
              >
                Pretty
              </button>
              <button
                type="button"
                className="kbe-action-btn"
                onClick={handleMinify}
                title="Minify JSON"
              >
                Minify
              </button>
            </div>
            <span className="kbe-toolbar-hint">Drag the header to reposition</span>
          </div>
        )}

        {/* Editor */}
        <div className="kbe-body">
          <div className="kbe-editor-wrap">
            <div className="kbe-line-numbers" aria-hidden="true">
              {lineNumbers.map((n) => (
                <span key={n} className="kbe-line-num">{n}</span>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="kbe-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              autoFocus
              aria-label="Message body content"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="kbe-footer">
          <span className="kbe-footer-hint">⌘F search · Esc close</span>
          <div className="kbe-footer-actions">
            <button type="button" className="kbe-btn kbe-btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="kbe-btn kbe-btn--primary" onClick={handleSave}>
              Apply
            </button>
          </div>
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
