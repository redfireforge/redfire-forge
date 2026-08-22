import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HTTP_STATUS_CATALOG, type HttpStatusEntry } from './apiMockResponseEditorConstants';

interface Props {
  currentStatus: number;
  onPick: (code: number, reason: string) => void;
  onClose: () => void;
}

interface FlatEntry extends HttpStatusEntry {
  categoryLabel: string;
  range: string;
}

const RANGE_COLORS: Record<string, string> = {
  '1xx': '#60a5fa',
  '2xx': '#34d399',
  '3xx': '#a78bfa',
  '4xx': '#fbbf24',
  '5xx': '#f87171',
};

function statusBadgeClass(code: number): string {
  if (code < 200) return 'am-sp-badge--1xx';
  if (code < 300) return 'am-sp-badge--2xx';
  if (code < 400) return 'am-sp-badge--3xx';
  if (code < 500) return 'am-sp-badge--4xx';
  return 'am-sp-badge--5xx';
}

export function ApiMockStatusPickerModal({ currentStatus, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allEntries = useMemo<FlatEntry[]>(() =>
    HTTP_STATUS_CATALOG.flatMap(cat =>
      cat.entries.map(e => ({ ...e, categoryLabel: cat.label, range: cat.range })),
    ), [],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allEntries;
    const q = query.toLowerCase().trim();
    return allEntries.filter(e =>
      String(e.code).includes(q)
      || e.reason.toLowerCase().includes(q)
      || e.description.toLowerCase().includes(q)
      || e.categoryLabel.toLowerCase().includes(q),
    );
  }, [allEntries, query]);

  const groupedFiltered = useMemo(() => {
    const groups: Array<{ label: string; range: string; entries: FlatEntry[] }> = [];
    for (const entry of filtered) {
      let group = groups.find(g => g.range === entry.range);
      if (!group) {
        group = { label: entry.categoryLabel, range: entry.range, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    }
    return groups;
  }, [filtered]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => { setActiveIndex(-1); }, [query]);

  useEffect(() => {
    if (activeIndex >= 0 && activeIndex < filtered.length) {
      const el = listRef.current?.querySelector(`[data-sp-idx="${activeIndex}"]`);
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, filtered.length]);

  const handleSelect = useCallback((entry: FlatEntry) => {
    onPick(entry.code, entry.reason);
    onClose();
  }, [onPick, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < filtered.length) {
      e.preventDefault();
      handleSelect(filtered[activeIndex]);
    }
  }, [filtered, activeIndex, handleSelect, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  let flatIdx = 0;

  return (
    <div
      className="am-sp-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      data-testid="api-mock-status-picker-modal"
    >
      <div className="am-sp-modal" role="dialog" aria-label="HTTP Status Code Picker">
        <div className="am-sp-header">
          <span className="am-sp-title">HTTP Status Codes</span>
          <span className="am-sp-match-count">
            {filtered.length} / {allEntries.length}
          </span>
        </div>

        <div className="am-sp-search-bar">
          <input
            ref={searchRef}
            className="am-sp-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by code, name, or description..."
            aria-label="Search status codes"
            data-testid="api-mock-status-picker-search"
          />
          {query && (
            <button
              type="button"
              className="am-sp-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >&#215;</button>
          )}
        </div>

        <div className="am-sp-categories">
          {HTTP_STATUS_CATALOG.map(cat => {
            const isActive = groupedFiltered.some(g => g.range === cat.range);
            return (
              <button
                key={cat.range}
                type="button"
                className={`am-sp-cat-btn${isActive ? '' : ' am-sp-cat-btn--dim'}`}
                style={{ borderColor: RANGE_COLORS[cat.range] }}
                onClick={() => setQuery(cat.range.replace('xx', ''))}
                title={`${cat.label} (${cat.range})`}
              >
                <span
                  className="am-sp-cat-dot"
                  style={{ background: RANGE_COLORS[cat.range] }}
                />
                {cat.range}
              </button>
            );
          })}
        </div>

        <div className="am-sp-list" ref={listRef}>
          {groupedFiltered.length === 0 && (
            <div className="am-sp-empty">No matching status codes</div>
          )}
          {groupedFiltered.map(group => {
            const items = group.entries.map(entry => {
              const idx = flatIdx++;
              return (
                <button
                  key={entry.code}
                  type="button"
                  className={
                    'am-sp-row'
                    + (entry.code === currentStatus ? ' am-sp-row--current' : '')
                    + (idx === activeIndex ? ' am-sp-row--active' : '')
                  }
                  data-sp-idx={idx}
                  onClick={() => handleSelect(entry)}
                  data-testid={`api-mock-status-pick-${entry.code}`}
                >
                  <span className={`am-sp-badge ${statusBadgeClass(entry.code)}`}>
                    {entry.code}
                  </span>
                  <span className="am-sp-reason">{entry.reason}</span>
                  <span className="am-sp-desc">{entry.description}</span>
                </button>
              );
            });
            return (
              <div key={group.range} className="am-sp-group">
                <div
                  className="am-sp-group-head"
                  style={{ borderLeftColor: RANGE_COLORS[group.range] }}
                >
                  {group.label}
                  <span className="am-sp-group-range">{group.range}</span>
                </div>
                {items}
              </div>
            );
          })}
        </div>

        <div className="am-sp-footer">
          <span className="am-sp-hint">
            &#8593;&#8595; navigate &middot; Enter select &middot; Esc close
          </span>
          <button
            type="button"
            className="am-sp-close-btn"
            onClick={onClose}
          >Close</button>
        </div>
      </div>
    </div>
  );
}
