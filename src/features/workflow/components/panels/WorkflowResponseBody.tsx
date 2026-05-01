import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import JsonPreview, { buildJTree, collectMatchNodes } from '../../../requests/components/JsonTreePreview';
import { useDebounce } from '../../../../shared/hooks/useDebounce';
import { escapeRegExp } from '../../../../shared/utils/helpers';

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
function collectAllPaths(node: { key: string; children?: { key: string; children?: unknown[] }[] }, prefix: string): string[] {
  const paths: string[] = [];
  if (node.children) {
    for (const child of node.children) {
      const p = `${prefix}/${child.key}`;
      paths.push(p);
      paths.push(...collectAllPaths(child as Parameters<typeof collectAllPaths>[0], p));
    }
  }
  return paths;
}

interface Props {
  body: string;
  subtitle?: string;
}

export default function WorkflowResponseBody({ body, subtitle }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
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

  // Sync searchMatchIdx to the JsonTreePreview's currentMatchIdx (tree-only portion)
  // Meta matches come first (0..metaMatchCount-1), then tree matches (metaMatchCount..)
  const treeCurrentIdx = searchMatchIdx - metaMatchCount;

  const handleTreeMatchCountChange = useCallback((count: number) => {
    setSearchMatchCount(metaMatchCount + count);
  }, [metaMatchCount]);

  // For non-tree mode: keep searchMatchCount in sync
  useEffect(() => {
    if (!jTree) {
      setSearchMatchCount(totalMatchCount); // eslint-disable-line react-hooks/set-state-in-effect
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

  const effectiveCount = jTree ? searchMatchCount : totalMatchCount;

  const searchToolbarContent = (
    <>
      <input
        type="search"
        className="results-search wf-resp-search-input"
        placeholder="Search response, keys, paths, values…"
        value={searchTerm}
        onChange={(e) => { setSearchTerm(e.target.value); setSearchMatchIdx(0); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setSearchTerm(''); setSearchMatchIdx(0); }
          if (e.key === 'Enter' && effectiveCount > 0) {
            e.preventDefault();
            if (e.shiftKey) {
              setSearchMatchIdx(prev => prev > 0 ? prev - 1 : effectiveCount - 1);
            } else {
              setSearchMatchIdx(prev => prev < effectiveCount - 1 ? prev + 1 : 0);
            }
          }
        }}
        aria-label="Search response"
      />
      {debouncedSearch.trim() ? (
        <>
          <span className="wf-resp-search-count" aria-live="polite">
            {effectiveCount > 0
              ? `${searchMatchIdx + 1}/${effectiveCount}`
              : 'No match'}
          </span>
          <button
            type="button"
            className="wf-resp-search-nav"
            title="Previous (Shift+Enter)"
            disabled={effectiveCount === 0}
            onClick={() => setSearchMatchIdx(prev => prev > 0 ? prev - 1 : effectiveCount - 1)}
          ><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" width="10" height="10"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg></button>
          <button
            type="button"
            className="wf-resp-search-nav"
            title="Next (Enter)"
            disabled={effectiveCount === 0}
            onClick={() => setSearchMatchIdx(prev => prev < effectiveCount - 1 ? prev + 1 : 0)}
          ><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" width="10" height="10"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg></button>
          <button
            type="button"
            className="wf-resp-search-clear"
            onClick={() => { setSearchTerm(''); setSearchMatchIdx(0); }}
          >&times;</button>
        </>
      ) : (
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
                    <span className="wf-resp-parse-icon" aria-hidden>⚠</span>
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
