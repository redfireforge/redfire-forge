import { useState, useMemo, useCallback } from 'react';

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
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function parseValue(data: unknown): JsonValue {
  if (data === null || data === undefined) return null;
  if (typeof data === 'string') {
    try { return JSON.parse(data); }
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
}: Props) {
  const parsed = useMemo(() => parseValue(data), [data]);
  const rawString = useMemo(() => {
    if (typeof data === 'string') {
      try { return JSON.stringify(JSON.parse(data), null, 2); }
      catch { return data; }
    }
    return JSON.stringify(data, null, 2);
  }, [data]);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(rawString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [rawString]);

  if (parsed === null || parsed === undefined) {
    return <div className="jtv-empty">null</div>;
  }

  if (typeof parsed !== 'object') {
    return (
      <div className={`jtv-root ${compact ? 'jtv-compact' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
        <span className={`jtv-${typeof parsed}`}>{JSON.stringify(parsed)}</span>
      </div>
    );
  }

  return (
    <div className={`jtv-root ${compact ? 'jtv-compact' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
      {copyable && (
        <button className="jtv-copy" onClick={handleCopy} title="Copy JSON">
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </button>
      )}
      <JsonNode value={parsed} depth={0} expandDepth={defaultExpandDepth} isRoot />
    </div>
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
  const [expanded, setExpanded] = useState(depth < expandDepth);

  if (value === null) {
    return (
      <div className="jtv-line">
        {keyName !== undefined && <><span className="jtv-key">{keyName}</span><span className="jtv-colon">: </span></>}
        <span className="jtv-null">null</span>
        {!isLast && <span className="jtv-comma">,</span>}
      </div>
    );
  }

  if (typeof value !== 'object') {
    return (
      <div className="jtv-line">
        {keyName !== undefined && <><span className="jtv-key">{keyName}</span><span className="jtv-colon">: </span></>}
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
        {keyName !== undefined && <><span className="jtv-key">{keyName}</span><span className="jtv-colon">: </span></>}
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
  if (typeof value === 'string') {
    const isUrl = /^https?:\/\//.test(value);
    const isLong = value.length > 120;
    return (
      <span className={`jtv-string ${isLong ? 'jtv-string-long' : ''}`} title={isLong ? value : undefined}>
        &quot;{isUrl ? <a href={value} target="_blank" rel="noopener noreferrer" className="jtv-url">{value}</a> : value}&quot;
      </span>
    );
  }
  if (typeof value === 'number') return <span className="jtv-number">{value}</span>;
  return <span className="jtv-boolean">{String(value)}</span>;
}
