import { useState, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { bestEffortFormat } from './jsonTreeShared';
import { prettyJson } from '../utils/helpers';

interface Props {
  data: string | Record<string, unknown> | unknown[] | unknown;
  /** Max nesting depth to auto-expand (default 2) */
  defaultExpandDepth?: number;
  /** Max height before scrolling (default 400px, 0 = no limit) */
  maxHeight?: number;
  /** Show copy-to-clipboard button */
  copyable?: boolean;
  /** Compact mode with smaller font */
  compact?: boolean;
  /** Show search bar */
  searchable?: boolean;
}

const SearchContext = createContext<string>('');

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function parseValue(data: unknown): JsonValue {
  if (data === null || data === undefined) return null;
  if (typeof data === 'string') {
    try {
      const first = JSON.parse(data);
      // If the result is still a string that looks like JSON, parse one more level
      if (typeof first === 'string' && (first.startsWith('{') || first.startsWith('['))) {
        try { return JSON.parse(first); }
        catch { return first; }
      }
      return first;
    }
    catch { return data; }
  }
  return data as JsonValue;
}

export default function JsonTreeViewer({
  data,
  defaultExpandDepth = 2,
  maxHeight = 400,
  copyable = true,
  compact = false,
  searchable = false,
}: Props) {
  const parsed = useMemo(() => parseValue(data), [data]);
  const rawString = useMemo(() => {
    if (typeof data === 'string') {
      return prettyJson(data);
    }
    return JSON.stringify(data, null, 2);
  }, [data]);

  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandOverride, setExpandOverride] = useState<boolean | null>(null);
  const expandKey = useRef(0);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(rawString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [rawString]);

  const handleExpandAll = useCallback(() => {
    expandKey.current++;
    setExpandOverride(true);
  }, []);

  const handleCollapseAll = useCallback(() => {
    expandKey.current++;
    setExpandOverride(false);
  }, []);

  const effectiveExpandDepth = expandOverride === true ? 999 : expandOverride === false ? 0 : defaultExpandDepth;

  if (parsed === null || parsed === undefined) {
    return <div className="jtv-empty">null</div>;
  }

  if (typeof parsed !== 'object') {
    // If the original data was a string that looks like JSON but failed to parse
    // (e.g. truncated), show it as formatted text rather than an escaped string literal
    const isUnparsedJsonString = typeof data === 'string' && typeof parsed === 'string'
      && (parsed.trimStart().startsWith('{') || parsed.trimStart().startsWith('['));

    if (isUnparsedJsonString) {
      return (
        <div className={`jtv-root ${compact ? 'jtv-compact' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
          {(searchable || copyable) && (
            <div className="jtv-toolbar">
              {searchable && (
                <div className="jtv-search">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="jtv-search-input"
                  />
                </div>
              )}
              <div className="jtv-toolbar-actions">
                {copyable && (
                  <button className="jtv-toolbar-btn" onClick={handleCopy} title="Copy JSON">
                    {copied ? '✓' : 'Copy'}
                  </button>
                )}
              </div>
            </div>
          )}
          <pre className="jtv-raw-body">{bestEffortFormat(parsed)}</pre>
        </div>
      );
    }

    return (
      <div className={`jtv-root ${compact ? 'jtv-compact' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
        <span className={`jtv-${typeof parsed}`}>{JSON.stringify(parsed)}</span>
      </div>
    );
  }

  const searchLower = searchTerm.toLowerCase();
  const matchCount = searchTerm ? countMatches(parsed, searchLower) : 0;

  return (
    <SearchContext.Provider value={searchLower}>
      <div className={`jtv-root ${compact ? 'jtv-compact' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
        {(searchable || copyable) && (
          <div className="jtv-toolbar">
            {searchable && (
              <div className="jtv-search">
                <input
                  type="text"
                  placeholder="Search keys or values..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); if (e.target.value) { expandKey.current++; setExpandOverride(true); } }}
                  className="jtv-search-input"
                />
                {searchTerm && <span className="jtv-search-count">{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>}
              </div>
            )}
            <div className="jtv-toolbar-actions">
              <button className="jtv-toolbar-btn" onClick={handleExpandAll} title="Expand all">+</button>
              <button className="jtv-toolbar-btn" onClick={handleCollapseAll} title="Collapse all">−</button>
              {copyable && (
                <button className="jtv-toolbar-btn" onClick={handleCopy} title="Copy JSON">
                  {copied ? '✓' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        )}
        <JsonNode key={expandKey.current} value={parsed} depth={0} expandDepth={effectiveExpandDepth} isRoot />
      </div>
    </SearchContext.Provider>
  );
}

function countMatches(value: JsonValue, term: string): number {
  if (!term) return 0;
  if (value === null) return 'null'.includes(term) ? 1 : 0;
  if (typeof value !== 'object') {
    return String(value).toLowerCase().includes(term) ? 1 : 0;
  }
  let count = 0;
  const entries: [string, JsonValue][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  for (const [k, v] of entries) {
    if (k.toLowerCase().includes(term)) count++;
    count += countMatches(v as JsonValue, term);
  }
  return count;
}

function subtreeContainsMatch(value: JsonValue, term: string): boolean {
  if (!term) return false;
  if (value === null) return 'null'.includes(term);
  if (typeof value !== 'object') return String(value).toLowerCase().includes(term);
  const entries: [string, JsonValue][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  for (const [k, v] of entries) {
    if (k.toLowerCase().includes(term)) return true;
    if (subtreeContainsMatch(v as JsonValue, term)) return true;
  }
  return false;
}

function HighlightText({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(term);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="jtv-highlight">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function JsonNode({
  value,
  depth,
  expandDepth,
  keyName,
  isLast = true,
  isRoot = false,
}: {
  value: JsonValue;
  depth: number;
  expandDepth: number;
  keyName?: string;
  isLast?: boolean;
  isRoot?: boolean;
}) {
  const searchTerm = useContext(SearchContext);
  const hasMatch = searchTerm ? subtreeContainsMatch(value, searchTerm) : false;
  const forceExpand = searchTerm ? hasMatch : false;
  const [expanded, setExpanded] = useState(depth < expandDepth || forceExpand);

  const keyLabel = keyName !== undefined
    ? <><span className="jtv-key"><HighlightText text={keyName} term={searchTerm} /></span><span className="jtv-colon">: </span></>
    : null;

  if (value === null) {
    return (
      <div className="jtv-line">
        {keyLabel}
        <span className="jtv-null">null</span>
        {!isLast && <span className="jtv-comma">,</span>}
      </div>
    );
  }

  if (typeof value !== 'object') {
    return (
      <div className="jtv-line">
        {keyLabel}
        <ValueSpan value={value} />
        {!isLast && <span className="jtv-comma">,</span>}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v, i) => [i, v] as const) : Object.entries(value);
  const count = entries.length;
  const openBrace = isArray ? '[' : '{';
  const closeBrace = isArray ? ']' : '}';

  if (count === 0) {
    return (
      <div className="jtv-line">
        {keyName !== undefined && <><span className="jtv-key">{keyName}</span><span className="jtv-colon">: </span></>}
        <span className="jtv-brace">{openBrace}{closeBrace}</span>
        {!isLast && <span className="jtv-comma">,</span>}
      </div>
    );
  }

  return (
    <div className={`jtv-node ${isRoot ? 'jtv-node-root' : ''}`}>
      <div className="jtv-line jtv-line-toggle" onClick={() => setExpanded(!expanded)}>
        <span className={`jtv-arrow ${expanded ? 'open' : ''}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
        {keyLabel}
        <span className="jtv-brace">{openBrace}</span>
        {!expanded && (
          <>
            <span className="jtv-ellipsis">{count} {isArray ? 'items' : 'keys'}</span>
            <span className="jtv-brace">{closeBrace}</span>
            {!isLast && <span className="jtv-comma">,</span>}
          </>
        )}
      </div>
      {expanded && (
        <>
          <div className="jtv-children">
            {entries.map(([k, v], i) => (
              <JsonNode
                key={String(k)}
                keyName={isArray ? undefined : String(k)}
                value={v as JsonValue}
                depth={depth + 1}
                expandDepth={expandDepth}
                isLast={i === count - 1}
              />
            ))}
          </div>
          <div className="jtv-line">
            <span className="jtv-brace">{closeBrace}</span>
            {!isLast && <span className="jtv-comma">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

function ValueSpan({ value }: { value: string | number | boolean }) {
  const searchTerm = useContext(SearchContext);
  if (typeof value === 'string') {
    const isUrl = /^https?:\/\//.test(value);
    const isLong = value.length > 120;
    return (
      <span className={`jtv-string ${isLong ? 'jtv-string-long' : ''}`} title={isLong ? value : undefined}>
        &quot;{isUrl
          ? <a href={value} target="_blank" rel="noopener noreferrer" className="jtv-url"><HighlightText text={value} term={searchTerm} /></a>
          : <HighlightText text={value} term={searchTerm} />
        }&quot;
      </span>
    );
  }
  if (typeof value === 'number') return <span className="jtv-number"><HighlightText text={String(value)} term={searchTerm} /></span>;
  return <span className="jtv-boolean"><HighlightText text={String(value)} term={searchTerm} /></span>;
}
