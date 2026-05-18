import { useState, useRef, useEffect, useMemo } from 'react';
import { extractJsonPaths } from './jsonPathPickerUtils';

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
