import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import JsonPreview, { buildJTree, collectMatchNodes, collectJTreePaths } from '../../../requests/components/JsonTreePreview';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { escapeRegExp } from '../../../../shared/utils/helpers';
import { SearchMatchBar } from '../../../../shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '../../../../shared/hooks/useSearchMatchNavigation';

/** Best-effort pretty-format for JSON-like text that may be truncated / invalid. */
function prettyFormatRawJson(raw: string): string {
  let out = '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  const indent = () => '  '.repeat(depth);

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      out += ch;
      continue;
    }

    if (ch === '{' || ch === '[') {
      out += ch;
      depth++;
      out += '\n' + indent();
    } else if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      out += '\n' + indent() + ch;
    } else if (ch === ',') {
      out += ',\n' + indent();
    } else if (ch === ':') {
      out += ': ';
    } else if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      // skip original whitespace (we re-indent)
    } else {
      out += ch;
    }
  }
  return out;
}

/** Escape HTML then highlight case-insensitive matches, wrapping the Nth match with a special class. */
function highlightPlainText(text: string, term: string, activeIdx?: number): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const t = term.trim();
  if (!t) return esc;
  try {
    const re = new RegExp(`(${escapeRegExp(t)})`, 'gi');
    let matchCounter = 0;
    return esc.replace(re, (_match, p1) => {
      const idx = matchCounter++;
      const cls = idx === activeIdx
        ? 'wf-resp-search-hit wf-resp-search-hit--active'
        : 'wf-resp-search-hit';
      return `<mark class="${cls}">${p1}</mark>`;
    });
  } catch {
    return esc;
  }
}

/** Count regex matches in plain text. */
function countTextMatches(text: string, term: string): number {
  if (!term.trim()) return 0;
  try {
    const re = new RegExp(escapeRegExp(term), 'gi');
    return (text.match(re) ?? []).length;
  } catch {
    return 0;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function splitWorkflowResponseDetail(body: string): { meta: string; jsonText: string | null } {
  const marker = '\nResponse body:\n';
  const i = body.indexOf(marker);
  if (i === -1) return { meta: body, jsonText: null };
  return {
    meta: body.slice(0, i).trimEnd(),
    jsonText: body.slice(i + marker.length).trim(),
  };
}

/** Collect all paths in a JTree for expand/collapse-all. */
const collectAllPaths = collectJTreePaths;

interface Props {
  body: string;
  subtitle?: string;
}

export default function WorkflowResponseBody({ body, subtitle }: Props) {
  const [searchTerm, setSearchTermState] = useState('');
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(() => new Set());
  const rawFallbackRef = useRef<HTMLPreElement>(null);
  const debouncedSearch = useDebounce(searchTerm, 200);

  const { meta, jsonText } = useMemo(() => splitWorkflowResponseDetail(body), [body]);

  // Build the same JTree used by Requests' JsonTreePreview
  const jTree = useMemo(() => {
    if (!jsonText?.trim()) return null;
    try {
      return buildJTree(JSON.parse(jsonText), '');
    } catch {
      return null;
    }
  }, [jsonText]);

  const parseError = useMemo(() => {
    if (!jsonText?.trim()) return null;
    try {
      JSON.parse(jsonText);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON';
    }
  }, [jsonText]);

  // Count matches in meta text
  const metaMatchCount = useMemo(
    () => countTextMatches(meta, debouncedSearch),
    [meta, debouncedSearch],
  );

  // Count matches in JSON tree (via collectMatchNodes) or raw fallback text
  const jsonMatchCount = useMemo(() => {
    const t = debouncedSearch.trim();
    if (!t) return 0;
    if (jTree) {
      const results: unknown[] = [];
      collectMatchNodes(jTree, t, results as never[]);
      return results.length;
    }
    if (jsonText) {
      return countTextMatches(jsonText, t);
    }
    return 0;
  }, [debouncedSearch, jTree, jsonText]);

  const totalMatchCount = metaMatchCount + jsonMatchCount;
  const effectiveCount = jTree ? searchMatchCount : totalMatchCount;

  const {
    currentMatchIndex: searchMatchIdx,
    setCurrentMatchIndex: setSearchMatchIdx,
    goNext,
    goPrev,
    clear: clearSearchNav,
  } = useSearchMatchNavigation(effectiveCount);

  const setSearchTerm = useCallback((value: string) => {
    setSearchTermState(value);
    setSearchMatchIdx(0);
  }, [setSearchMatchIdx]);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
    clearSearchNav();
  }, [clearSearchNav]);

  // Sync searchMatchIdx to the JsonTreePreview's currentMatchIdx (tree-only portion)
  // Meta matches come first (0..metaMatchCount-1), then tree matches (metaMatchCount..)
  const treeCurrentIdx = searchMatchIdx - metaMatchCount;

  const handleTreeMatchCountChange = useCallback((count: number) => {
    setSearchMatchCount(metaMatchCount + count);
  }, [metaMatchCount]);

  // For non-tree mode: keep searchMatchCount in sync
  useEffect(() => {
    if (!jTree) {
      setSearchMatchCount(totalMatchCount);  
    }
  }, [jTree, totalMatchCount]);

  // Scroll to active match in raw fallback mode
  useEffect(() => {
    if (!rawFallbackRef.current) return;
    const marks = rawFallbackRef.current.querySelectorAll('mark.wf-resp-search-hit--active');
    marks[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [searchMatchIdx, debouncedSearch]);

  // Scroll to active match in meta section
  useEffect(() => {
    if (searchMatchIdx >= metaMatchCount) return;
    const container = rawFallbackRef.current?.closest('.wf-resp-body');
    if (!container) return;
    const metaEl = container.querySelector('.wf-resp-meta');
    if (!metaEl) return;
    const marks = metaEl.querySelectorAll('mark.wf-resp-search-hit--active');
    marks[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [searchMatchIdx, metaMatchCount, debouncedSearch]);

  const handleToggle = useCallback((path: string) => {
    setCollapsedSet(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const allPaths = useMemo(() => (jTree ? collectAllPaths(jTree, '') : []), [jTree]);
  const handleCollapseAll = useCallback(() => setCollapsedSet(new Set(allPaths)), [allPaths]);
  const handleExpandAll = useCallback(() => setCollapsedSet(new Set()), []);

  // Active index within meta matches (for highlight)
  const metaActiveIdx = searchMatchIdx < metaMatchCount ? searchMatchIdx : undefined;
  // Active index within raw JSON text (offset by metaMatchCount)
  const rawActiveIdx = !jTree && searchMatchIdx >= metaMatchCount ? searchMatchIdx - metaMatchCount : undefined;

  const metaHtml = useMemo(
    () => ({ __html: highlightPlainText(meta, debouncedSearch, metaActiveIdx) }),
    [meta, debouncedSearch, metaActiveIdx],
  );

  const fallbackBodyHtml = useMemo(
    () => ({ __html: highlightPlainText(body, debouncedSearch, searchMatchIdx) }),
    [body, debouncedSearch, searchMatchIdx],
  );

  const formattedRawJson = useMemo(
    () => (jsonText && parseError ? prettyFormatRawJson(jsonText) : null),
    [jsonText, parseError],
  );

  const rawJsonHighlighted = useMemo(() => {
    if (!formattedRawJson) return null;
    return { __html: highlightPlainText(formattedRawJson, debouncedSearch, rawActiveIdx) };
  }, [formattedRawJson, debouncedSearch, rawActiveIdx]);

  const searchToolbarContent = (
    <>
      <SearchMatchBar
        value={searchTerm}
        onChange={setSearchTerm}
        currentMatch={searchMatchIdx + 1}
        totalMatches={effectiveCount}
        onPrev={goPrev}
        onNext={goNext}
        onClear={clearSearch}
        inputType="search"
        placeholder="Search response, keys, paths, values…"
        inputClassName="results-search wf-resp-search-input"
        countClassName="wf-resp-search-count"
        navClassName="wf-resp-search-nav"
        clearClassName="wf-resp-search-clear"
        controlsVisible={!!debouncedSearch.trim()}
        prevTitle="Previous (Shift+Enter)"
        nextTitle="Next (Enter)"
        ariaLabel="Search response"
        onKeyDown={(e) => {
          if (e.key === 'Escape') clearSearch();
          if (e.key === 'Enter' && effectiveCount > 0) {
            e.preventDefault();
            if (e.shiftKey) goPrev();
            else goNext();
          }
        }}
      />
      {!debouncedSearch.trim() && (
        <span className="wf-resp-search-hint">Search keys, paths, values. Enter / Shift+Enter to navigate.</span>
      )}
      {jTree && (
        <>
          <button
            type="button"
            className="jt-expand-collapse-btn"
            onClick={handleExpandAll}
          >Expand All</button>
          <button
            type="button"
            className="jt-expand-collapse-btn"
            onClick={handleCollapseAll}
          >Collapse All</button>
        </>
      )}
    </>
  );

  return (
    <div className="wf-resp-body">

      {jsonText === null ? (
        <>
          <div className="wf-resp-toolbar">
            {searchToolbarContent}
          </div>
          <div
            className="wf-resp-meta wf-resp-meta--only"
            dangerouslySetInnerHTML={fallbackBodyHtml}
          />
        </>
      ) : (
        <>
          <div className="wf-resp-section">
            <div className="wf-resp-section-label">Request &amp; validation</div>
            <div className="wf-resp-meta" dangerouslySetInnerHTML={metaHtml} />
          </div>
          {subtitle && <p className="wf-resp-section-label" style={{ marginTop: 10 }}>{subtitle}</p>}
          <div className="wf-resp-toolbar">
            {searchToolbarContent}
          </div>
          <div className="wf-resp-section">
            <div className="wf-resp-section-label">Response body</div>
            {jTree ? (
              <div className="wf-resp-json-tree">
                <JsonPreview
                  body={jsonText}
                  search={debouncedSearch}
                  currentMatchIdx={treeCurrentIdx >= 0 ? treeCurrentIdx : 0}
                  onMatchCountChange={handleTreeMatchCountChange}
                  collapsedSet={collapsedSet}
                  onToggle={handleToggle}
                  prebuiltTree={jTree}
                />
              </div>
            ) : (
              <>
                {rawJsonHighlighted ? (
                  <pre ref={rawFallbackRef} className="wf-resp-raw-fallback" dangerouslySetInnerHTML={rawJsonHighlighted} />
                ) : (
                  <pre ref={rawFallbackRef} className="wf-resp-raw-fallback">{formattedRawJson ?? jsonText}</pre>
                )}
                {parseError && (
                  <div className="wf-resp-parse-note" role="note">
                    <span className="wf-resp-parse-icon" aria-hidden><svg className="wf-inline-icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                    Could not parse as JSON — {parseError}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
