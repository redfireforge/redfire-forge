import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { prettyJson } from '../../../shared/utils/helpers';
import { SearchMatchBar } from '../../../shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '../../../shared/hooks/useSearchMatchNavigation';
import { useCopyToClipboard } from '../../../shared/hooks/useCopyToClipboard';
import { useModalFrame } from '../../../shared/hooks/useModalFrame';
import ModalResizeHandles from '../../../shared/components/ModalResizeHandles';

interface Props {
  title: string;
  subtitle?: string;
  tags?: { label: string; color?: string }[];
  content: string;
  language: 'json' | 'dsl';
  onClose: () => void;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightJson(text: string): string {
  const MKey = '\uE000K\uE001';
  const MEndK = '\uE000Kend\uE001';
  const MStr = '\uE000S\uE001';
  const MEndS = '\uE000Send\uE001';
  const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reKey = new RegExp(`${reEsc(MKey)}([\\s\\S]*?)${reEsc(MEndK)}(\\s*:)`, 'g');
  const reStr = new RegExp(`${reEsc(MStr)}([\\s\\S]*?)${reEsc(MEndS)}`, 'g');
  const escaped = escapeHtml(text);
  const keysMarked = escaped.replace(
    /"([^"\\]*(\\.[^"\\]*)*)"(\s*:)/g,
    (_, inner: string, __: string, colon: string) => `${MKey}${inner}${MEndK}${colon}`,
  );
  const stringsMarked = keysMarked.replace(
    /"([^"\\]*(\\.[^"\\]*)*)"/g,
    (_, inner: string) => `${MStr}${inner}${MEndS}`,
  );
  return stringsMarked
    .replace(reKey, '<span class="vp-key">"$1"</span>$2')
    .replace(reStr, '<span class="vp-string">"$1"</span>')
    .replace(/\b(true|false)\b/g, '<span class="vp-bool">$1</span>')
    .replace(/\b(null)\b/g, '<span class="vp-null">$1</span>')
    .replace(/\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, '<span class="vp-number">$1</span>');
}

function highlightDsl(text: string): string {
  return text.split('\n').map(line => {
    const escaped = escapeHtml(line);
    if (/^\s*#/.test(line)) return `<span class="vp-comment">${escaped}</span>`;
    return escaped
      .replace(/^(\S+)/, '<span class="vp-path">$1</span>')
      .replace(
        /\b(equals|not_equals|contains|not_contains|starts_with|ends_with|regex|exists|not_exists|is_true|is_false|is_null|is_not_null|is_string|is_number|is_boolean|is_array|is_object|length|each|contains_any|contains_all|contains_only|contains_none|contains_item|subset)\b/g,
        '<span class="vp-operator">$1</span>',
      )
      .replace(/(&gt;=|&lt;=)/g, '<span class="vp-operator">$1</span>')
      .replace(/\b!=\b/g, '<span class="vp-operator">!=</span>')
      .replace(/(&gt;|&lt;)/g, '<span class="vp-operator">$1</span>')
      .replace(/(\s)=(\s)/g, '$1<span class="vp-operator">=</span>$2');
  }).join('\n');
}

export default function VersionPreviewModal({ title, subtitle, tags, content: rawContent, language, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [copied, copyToClipboard] = useCopyToClipboard(2000);
  const [searchQuery, setSearchQueryRaw] = useState('');

  const {
    isDragged,
    overlayStyle,
    dialogStyle,
    headerDragStyle,
    onHeaderMouseDown,
    onHeaderPointerDown,
    dialogRef,
    onRightEdge,
    onCorner,
    onBottomEdge,
  } = useModalFrame({
    minWidth: 480,
    minHeight: 280,
    constrainDragToViewport: true,
    dragViewportPadding: 12,
  });

  const content = language === 'json' ? prettyJson(rawContent) : rawContent;

  const lines = useMemo(() => content.split('\n'), [content]);

  const matchLineIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const indices: number[] = [];
    lines.forEach((line, i) => { if (line.toLowerCase().includes(q)) indices.push(i); });
    return indices;
  }, [searchQuery, lines]);

  const matchCount = matchLineIndices.length;

  const {
    currentMatchIndex,
    setCurrentMatchIndex,
    clear: clearSearchNav,
  } = useSearchMatchNavigation(matchCount);

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryRaw(value);
    setCurrentMatchIndex(0);
  }, [setCurrentMatchIndex]);

  const clearSearch = useCallback(() => {
    setSearchQueryRaw('');
    clearSearchNav();
  }, [clearSearchNav]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchQuery) clearSearch();
        else onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, searchQuery, clearSearch]);

  const scrollToMatch = useCallback((idx: number) => {
    if (!bodyRef.current || matchLineIndices.length === 0) return;
    const lineIdx = matchLineIndices[idx];
    const gutterLines = bodyRef.current.querySelectorAll('.vp-line-number');
    if (gutterLines[lineIdx]) {
      gutterLines[lineIdx].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [matchLineIndices]);

  const goNextMatch = useCallback(() => {
    if (matchCount === 0) return;
    const next = (currentMatchIndex + 1) % matchCount;
    setCurrentMatchIndex(next);
    scrollToMatch(next);
  }, [currentMatchIndex, matchCount, scrollToMatch, setCurrentMatchIndex]);

  const goPrevMatch = useCallback(() => {
    if (matchCount === 0) return;
    const prev = (currentMatchIndex - 1 + matchCount) % matchCount;
    setCurrentMatchIndex(prev);
    scrollToMatch(prev);
  }, [currentMatchIndex, matchCount, scrollToMatch, setCurrentMatchIndex]);

  const highlighted = useMemo(() => {
    const base = language === 'json' ? highlightJson(content) : highlightDsl(content);
    if (!searchQuery.trim()) return base;
    const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${q})`, 'gi');
    return base.split('\n').map((line, i) => {
      if (!matchLineIndices.includes(i)) return line;
      const isActive = matchLineIndices[currentMatchIndex] === i;
      return line.replace(re, isActive
        ? '<mark class="vp-search-hit vp-search-hit--active">$1</mark>'
        : '<mark class="vp-search-hit">$1</mark>');
    }).join('\n');
  }, [content, language, searchQuery, matchLineIndices, currentMatchIndex]);

  const handleCopy = useCallback(() => {
    void copyToClipboard(content);
  }, [content, copyToClipboard]);

  return (
    <div
      className="vp-overlay"
      ref={overlayRef}
      style={overlayStyle}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={`vp-modal${isDragged ? ' vp-modal--dragged' : ''}`}
        ref={dialogRef}
        role="dialog"
        aria-label={title}
        style={dialogStyle}
      >
        {/* Header: title + tags + search — also the drag handle */}
        <div
          className="vp-header"
          style={headerDragStyle}
          onMouseDown={onHeaderMouseDown}
          onPointerDown={onHeaderPointerDown}
        >
          <div className="vp-header-left">
            <h3 className="vp-title">{title}</h3>
            {subtitle && <span className="vp-subtitle">{subtitle}</span>}
            {tags && tags.length > 0 && (
              <div className="vp-tags">
                {tags.map((t, i) => (
                  <span key={i} className="vp-tag" style={t.color ? { background: t.color } : undefined}>
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <SearchMatchBar
            className="vp-search-bar"
            value={searchQuery}
            onChange={setSearchQuery}
            currentMatch={currentMatchIndex + 1}
            totalMatches={matchCount}
            onPrev={goPrevMatch}
            onNext={goNextMatch}
            onClear={clearSearch}
            placeholder="Search… (Cmd+F)"
            inputClassName="vp-search-input"
            countClassName="vp-search-count"
            navClassName="vp-search-nav"
            controlsVisible={!!searchQuery}
            showNavWhenEmpty
            hideClear
            navStyle="text"
            inputRef={searchInputRef}
            prevTitle="Previous match (Shift+Enter)"
            nextTitle="Next match (Enter)"
            onKeyDown={(e) => {
              if (e.key === 'Escape') clearSearch();
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); goNextMatch(); }
              if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrevMatch(); }
            }}
          />
        </div>

        {/* Body: gutter + code */}
        <div className="vp-body" ref={bodyRef}>
          <div className="vp-gutter" aria-hidden="true">
            {lines.map((_, i) => (
              <div
                key={i}
                className={`vp-line-number${matchLineIndices.includes(i) ? ' vp-line-number--match' : ''}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <pre className="vp-code" dangerouslySetInnerHTML={{ __html: highlighted }} />
        </div>

        {/* Footer: line count + Copy + Close */}
        <div className="vp-footer">
          <span className="vp-line-count">{lines.length} lines</span>
          <div className="vp-footer-actions">
            <button type="button" className="vp-btn vp-btn--copy" onClick={handleCopy} title="Copy to clipboard">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button type="button" className="vp-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Must stay a direct child of the role="dialog" box — the resize hook
            measures the handle's parent to compute the drag origin. */}
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} onBottomEdge={onBottomEdge} />
      </div>
    </div>
  );
}
