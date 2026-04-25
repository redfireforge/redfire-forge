import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface Props {
  hints: WorkflowVariableHint[];
  /** Currently selected variable ref (e.g. "status" or "node:\"Step\".status"), or '' for none. */
  value: string;
  onChange: (ref: string) => void;
  /** Show a "Custom name…" option at the bottom. */
  showCustom?: boolean;
  onCustom?: () => void;
  invalid?: boolean;
  'aria-label'?: string;
}

interface GroupedHints {
  source: string;
  hints: WorkflowVariableHint[];
}

function groupBySource(hints: WorkflowVariableHint[]): GroupedHints[] {
  const map = new Map<string, WorkflowVariableHint[]>();
  const order: string[] = [];
  for (const h of hints) {
    const src = h.source?.nodeLabel ?? 'Workflow';
    if (!map.has(src)) { map.set(src, []); order.push(src); }
    map.get(src)!.push(h);
  }
  return order.map((s) => ({
    source: s,
    hints: map.get(s)!.slice().sort((a, b) => displayName(a).localeCompare(displayName(b))),
  }));
}

/** Extract short display name from a hint. */
function displayName(h: WorkflowVariableHint): string {
  const m = h.ref.match(/^node:"[^"]+"\.(.+)$/) ?? h.ref.match(/^node:[^.]+\.(.+)$/);
  return m ? m[1] : h.ref;
}

export default function SearchableVariableSelect({
  hints,
  value,
  onChange,
  showCustom = false,
  onCustom,
  invalid,
  ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Build flat filtered list for keyboard nav
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return hints;
    return hints.filter(
      (h) =>
        displayName(h).toLowerCase().includes(q) ||
        h.label.toLowerCase().includes(q) ||
        h.ref.toLowerCase().includes(q) ||
        (h.source?.nodeLabel ?? '').toLowerCase().includes(q),
    );
  }, [hints, query]);

  const grouped = useMemo(() => groupBySource(filtered), [filtered]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const items: { kind: 'hint'; hint: WorkflowVariableHint }[] = [];
    for (const g of grouped) {
      for (const h of g.hints) items.push({ kind: 'hint', hint: h });
    }
    return items;
  }, [grouped]);

  // Reset selection when filtered list changes
  useEffect(() => { setSelectedIdx(0); }, [filtered]);

  // Display text for the input when closed
  const selectedHint = hints.find((h) => h.ref === value);
  const displayText = selectedHint ? `${displayName(selectedHint)} ← ${selectedHint.source?.nodeLabel ?? 'Workflow'}` : '';

  const handleSelect = useCallback((ref: string) => {
    onChange(ref);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatList.length - 1 + (showCustom ? 1 : 0)));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIdx < flatList.length) {
          handleSelect(flatList[selectedIdx].hint.ref);
        } else if (showCustom && selectedIdx === flatList.length) {
          onCustom?.();
          setOpen(false);
          setQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setQuery('');
        break;
    }
  }, [open, flatList, selectedIdx, showCustom, handleSelect, onCustom]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll selected into view
  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const el = dropdownRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, selectedIdx]);

  // Dropdown position (portal to body, like ExpressionHintDropdown)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!open || !inputRef.current) { setPos(null); return; }
    const rect = inputRef.current.getBoundingClientRect();
    const dropH = Math.min(flatList.length * 34 + 60, 320);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= dropH || spaceBelow >= rect.top
      ? rect.bottom + 2
      : rect.top - dropH - 2;
    setPos({ top, left: rect.left, width: Math.max(rect.width, 300) });
  }, [open, flatList.length]);

  let itemIdx = 0;

  return (
    <div className="svs-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        className={`svs-input${invalid ? ' wf-input-invalid' : ''}`}
        value={open ? query : displayText}
        placeholder={open ? 'Type to search…' : '— Select variable —'}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        readOnly={false}
        autoComplete="off"
        aria-label={rest['aria-label']}
        aria-expanded={open}
        role="combobox"
        aria-haspopup="listbox"
      />
      <span className="svs-chevron" onClick={() => { setOpen(!open); inputRef.current?.focus(); }}>▾</span>

      {open && pos && createPortal(
        <div
          className="svs-dropdown"
          ref={dropdownRef}
          role="listbox"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            maxWidth: 500,
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 10100,
            background: '#1e1e2e',
            border: '1px solid #3a3a5c',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            padding: '4px 0',
            fontSize: '0.82rem',
          }}
        >
          {grouped.length === 0 && (
            <div className="svs-empty">No variables match</div>
          )}
          {grouped.map((g) => (
            <div key={g.source}>
              <div className="svs-group-header">{g.source}</div>
              {g.hints.map((h) => {
                const idx = itemIdx++;
                const isActive = idx === selectedIdx;
                const isSelected = h.ref === value;
                return (
                  <div
                    key={h.ref}
                    className={`svs-item${isActive ? ' svs-item-active' : ''}${isSelected ? ' svs-item-selected' : ''}`}
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(h.ref); }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <span className="svs-item-name">{displayName(h)}</span>
                    {h.type && <span className="svs-item-type">{h.type}</span>}
                    {isSelected && <span className="svs-item-check">✓</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {showCustom && (
            <div
              className={`svs-item svs-item-custom${selectedIdx === flatList.length ? ' svs-item-active' : ''}`}
              data-active={selectedIdx === flatList.length}
              onMouseDown={(e) => { e.preventDefault(); onCustom?.(); setOpen(false); setQuery(''); }}
              onMouseEnter={() => setSelectedIdx(flatList.length)}
            >
              Custom name…
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
