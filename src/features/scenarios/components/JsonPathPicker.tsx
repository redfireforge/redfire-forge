import { useState, useRef, useEffect, useMemo } from 'react';

interface PathEntry {
  path: string;
  type: string;
  preview: string;
}

/** Recursively collect all JSON paths from a parsed value. */
function collectPaths(value: unknown, prefix: string, out: PathEntry[]): void {
  if (value === null || value === undefined) {
    out.push({ path: prefix, type: 'null', preview: 'null' });
    return;
  }
  if (Array.isArray(value)) {
    out.push({ path: prefix, type: 'array', preview: `[${value.length} items]` });
    if (value.length > 0) {
      collectPaths(value[0], `${prefix}[0]`, out);
    }
    return;
  }
  if (typeof value === 'object') {
    out.push({ path: prefix, type: 'object', preview: `{${Object.keys(value).length} keys}` });
    for (const key of Object.keys(value)) {
      collectPaths((value as Record<string, unknown>)[key], `${prefix}.${key}`, out);
    }
    return;
  }
  const t = typeof value;
  const preview = t === 'string'
    ? `"${String(value).length > 30 ? String(value).slice(0, 30) + '…' : value}"`
    : String(value);
  out.push({ path: prefix, type: t, preview });
}

export function extractJsonPaths(json: string): PathEntry[] {
  try {
    const parsed = JSON.parse(json);
    const out: PathEntry[] = [];
    collectPaths(parsed, '$', out);
    return out;
  } catch {
    return [];
  }
}

interface Props {
  sampleJson: string;
  onSelect: (path: string) => void;
}

export default function JsonPathPicker({ sampleJson, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const paths = useMemo(() => extractJsonPaths(sampleJson), [sampleJson]);

  const filtered = useMemo(() => {
    if (!search) return paths;
    const q = search.toLowerCase();
    return paths.filter(p => p.path.toLowerCase().includes(q) || p.type.includes(q));
  }, [paths, search]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasSample = paths.length > 0;

  return (
    <div className="jpp-wrap" ref={menuRef}>
      <button
        type="button"
        className="jpp-btn"
        onClick={() => { if (hasSample) setOpen(!open); }}
        title={hasSample ? 'Pick JSON path from sample response' : 'Fetch a sample response first'}
        disabled={!hasSample}
      >
        ⎆
      </button>
      {open && (
        <div className="jpp-menu">
          <input
            ref={searchRef}
            type="text"
            className="jpp-search"
            placeholder="Filter paths…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="jpp-list">
            {filtered.length === 0 && (
              <div className="jpp-empty">No matching paths</div>
            )}
            {filtered.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className="jpp-item"
                onClick={() => { onSelect(entry.path); setOpen(false); setSearch(''); }}
              >
                <span className="jpp-path">{entry.path}</span>
                <span className={`jpp-type jpp-type-${entry.type}`}>{entry.type}</span>
                <span className="jpp-preview">{entry.preview}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
