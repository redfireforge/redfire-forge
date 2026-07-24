import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import { SearchMatchBar } from '../../../shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '../../../shared/hooks/useSearchMatchNavigation';

interface Props {
  yaml: string;
  title: string;
  onClose: () => void;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLine(rawLine: string, re: RegExp, active: boolean): string {
  const cls = active ? 'cat-yaml-hit cat-yaml-hit--active' : 'cat-yaml-hit';
  let html = '';
  let last = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawLine)) !== null) {
    html += escapeHtml(rawLine.slice(last, m.index));
    html += `<mark class="${cls}">${escapeHtml(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  html += escapeHtml(rawLine.slice(last));
  return html;
}

export default function CatalogYamlViewerModal({ yaml, title, onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => yaml.split('\n'), [yaml]);

  const matchLineIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const found: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) found.push(i);
    }
    return found;
  }, [lines, searchQuery]);

  const matchCount = matchLineIndices.length;
  const { currentMatchIndex, setCurrentMatchIndex, clear: clearNav } = useSearchMatchNavigation(matchCount);

  const scrollToMatch = useCallback((i: number) => {
    if (!bodyRef.current || matchLineIndices.length === 0) return;
    const lineIdx = matchLineIndices[i];
    const gutter = bodyRef.current.querySelectorAll('.cat-yaml-lineno');
    const el = gutter[lineIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [matchLineIndices]);

  const goNext = useCallback(() => {
    if (matchCount === 0) return;
    const n = (currentMatchIndex + 1) % matchCount;
    setCurrentMatchIndex(n);
    scrollToMatch(n);
  }, [matchCount, currentMatchIndex, setCurrentMatchIndex, scrollToMatch]);

  const goPrev = useCallback(() => {
    if (matchCount === 0) return;
    const p = (currentMatchIndex - 1 + matchCount) % matchCount;
    setCurrentMatchIndex(p);
    scrollToMatch(p);
  }, [matchCount, currentMatchIndex, setCurrentMatchIndex, scrollToMatch]);

  const highlighted = useMemo(() => {
    if (!searchQuery.trim()) return escapeHtml(yaml);
    const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(q, 'gi');
    return lines.map((line, i) => {
      if (!matchLineIndices.includes(i)) return escapeHtml(line);
      const active = matchLineIndices[currentMatchIndex] === i;
      return highlightLine(line, re, active);
    }).join('\n');
  }, [yaml, lines, searchQuery, matchLineIndices, currentMatchIndex]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    clearNav();
  }, [clearNav]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(yaml).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [yaml]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (searchQuery) clearSearch();
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, searchQuery, clearSearch]);

  const specFormat = useMemo(() => {
    if (yaml.startsWith('openapi:')) {
      const m = yaml.match(/^openapi:\s*['"]?(\S+?)['"]?\s*$/m);
      return m ? `OpenAPI ${m[1]}` : 'OpenAPI';
    }
    if (yaml.startsWith('swagger:')) {
      const m = yaml.match(/^swagger:\s*['"]?(\S+?)['"]?\s*$/m);
      return m ? `Swagger ${m[1]}` : 'Swagger 2.0';
    }
    return 'YAML';
  }, [yaml]);

  const endpointCount = useMemo(() => {
    let count = 0;
    const pathBlock = /^paths:/m.test(yaml);
    if (pathBlock) {
      const methods = yaml.match(/^\s{4,6}(get|post|put|patch|delete|options|head):/gm);
      if (methods) count = methods.length;
    }
    return count;
  }, [yaml]);

  return (
    <FullPanelModal
      title={`${title} — YAML Spec`}
      onClose={onClose}
      movable
      resizable
      minWidth={500}
      minHeight={350}
      dialogClassName="cat-yaml-viewer-dialog"
      footer={
        <div className="cat-yaml-footer">
          <span className="cat-yaml-footer-hint">{lines.length} lines</span>
          <div className="cat-yaml-footer-actions">
            <button className="cat-btn cat-btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      }
    >
      {/* ── Info badges ── */}
      <div className="cat-yaml-badges">
        <span className="cat-yaml-badge cat-yaml-badge--format">{specFormat}</span>
        {endpointCount > 0 && (
          <span className="cat-yaml-badge">{endpointCount} endpoint{endpointCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* ── Toolbar: label + copy + search ── */}
      <div className="cat-yaml-toolbar">
        <div className="cat-yaml-toolbar-left">
          <span className="cat-yaml-preview-label">YAML Spec</span>
          <button
            type="button"
            className={`cat-yaml-copy-btn${copied ? ' copied' : ''}`}
            onClick={handleCopy}
            title="Copy the full YAML spec to the clipboard"
          >
            {copied ? '✓ Copied' : 'Copy YAML'}
          </button>
        </div>
        <SearchMatchBar
          className="cat-yaml-search-bar"
          value={searchQuery}
          onChange={setSearchQuery}
          currentMatch={currentMatchIndex + 1}
          totalMatches={matchCount}
          onPrev={goPrev}
          onNext={goNext}
          onClear={clearSearch}
          placeholder="Search… (Cmd+F)"
          inputClassName="cat-yaml-search-input"
          countClassName="cat-yaml-search-count"
          navClassName="cat-yaml-search-nav"
          controlsVisible={!!searchQuery}
          showNavWhenEmpty
          hideClear
          navStyle="text"
          inputRef={searchInputRef}
          prevTitle="Previous match (Shift+Enter)"
          nextTitle="Next match (Enter)"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Escape') clearSearch();
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); goNext(); }
            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrev(); }
          }}
        />
      </div>

      {/* ── Code preview ── */}
      <div className="cat-yaml-preview" ref={bodyRef}>
        <div className="cat-yaml-gutter" aria-hidden="true">
          {lines.map((_, i) => (
            <div
              key={i}
              className={`cat-yaml-lineno${matchLineIndices.includes(i) ? ' cat-yaml-lineno--match' : ''}`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <pre className="cat-yaml-code" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </FullPanelModal>
  );
}
