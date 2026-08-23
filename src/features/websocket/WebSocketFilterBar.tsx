import { useEffect, useMemo, useState } from 'react';
import type { WsFilterPreset } from '@shared/websocket/types';
import type { WsSizeFilter, WsTimeFilter, WsContentTypeFilter } from './useWebSocketStudioTypes';

type FilterDropdownKey = 'size' | 'time' | 'type';

interface FilterDropdownOption<T extends string> {
  value: T;
  label: string;
}

interface FilterDropdownProps<T extends string> {
  id: FilterDropdownKey;
  value: T;
  options: FilterDropdownOption<T>[];
  isOpen: boolean;
  onToggle: (id: FilterDropdownKey) => void;
  onSelect: (value: T) => void;
  ariaLabel: string;
  testId: string;
}

function FilterDropdown<T extends string>({
  id,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  ariaLabel,
  testId,
}: FilterDropdownProps<T>) {
  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? options[0],
    [options, value],
  );

  return (
    <div className="ws-filter-select-dropdown">
      <button
        type="button"
        className="ws-filter-select"
        onClick={() => onToggle(id)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        <span>{selected?.label ?? value}</span>
        <span className="ws-filter-select-chevron" aria-hidden>▾</span>
      </button>

      {isOpen && (
        <div className="ws-filter-select-menu" role="listbox" aria-label={`${ariaLabel} options`}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`ws-filter-select-option${opt.value === value ? ' active' : ''}`}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => onSelect(opt.value)}
              data-testid={`${testId}-opt-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface WebSocketFilterBarProps {
  sizeFilter: WsSizeFilter;
  setSizeFilter: (v: WsSizeFilter) => void;
  timeFilter: WsTimeFilter;
  setTimeFilter: (v: WsTimeFilter) => void;
  contentTypeFilter: WsContentTypeFilter;
  setContentTypeFilter: (v: WsContentTypeFilter) => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  filterPresets: WsFilterPreset[];
  presetDropdownOpen: boolean;
  setPresetDropdownOpen: (fn: (v: boolean) => boolean) => void;
  presetDropdownRef: React.RefObject<HTMLDivElement | null>;
  onSavePreset: () => void;
  onApplyPreset: (preset: WsFilterPreset) => void;
  onDeletePreset: (id: string) => void;
}

export function WebSocketFilterBar({
  sizeFilter, setSizeFilter,
  timeFilter, setTimeFilter,
  contentTypeFilter, setContentTypeFilter,
  activeFilterCount, onClearFilters,
  filterPresets, presetDropdownOpen, setPresetDropdownOpen,
  presetDropdownRef, onSavePreset, onApplyPreset, onDeletePreset,
}: WebSocketFilterBarProps) {
  const [openFilter, setOpenFilter] = useState<FilterDropdownKey | null>(null);

  useEffect(() => {
    if (!openFilter) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.ws-filter-select-dropdown')) {
        setOpenFilter(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenFilter(null);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [openFilter]);

  const sizeOptions: FilterDropdownOption<WsSizeFilter>[] = [
    { value: 'all', label: 'Size: All' },
    { value: 'lt1k', label: '< 1KB' },
    { value: '1k-10k', label: '1–10KB' },
    { value: 'gt10k', label: '> 10KB' },
  ];

  const timeOptions: FilterDropdownOption<WsTimeFilter>[] = [
    { value: 'all', label: 'Time: All' },
    { value: 'last30s', label: 'Last 30s' },
    { value: 'last5m', label: 'Last 5m' },
    { value: 'last30m', label: 'Last 30m' },
  ];

  const typeOptions: FilterDropdownOption<WsContentTypeFilter>[] = [
    { value: 'all', label: 'Type: All' },
    { value: 'json', label: 'JSON' },
    { value: 'text', label: 'Text' },
    { value: 'binary', label: 'Binary' },
    { value: 'control', label: 'Control' },
  ];

  return (
    <div className="ws-filter-bar" data-testid="filter-bar">
      <FilterDropdown
        id="size"
        value={sizeFilter}
        options={sizeOptions}
        isOpen={openFilter === 'size'}
        onToggle={(id) => setOpenFilter((current) => (current === id ? null : id))}
        onSelect={(next) => {
          setSizeFilter(next);
          setOpenFilter(null);
        }}
        ariaLabel="Size filter"
        testId="size-filter"
      />
      <FilterDropdown
        id="time"
        value={timeFilter}
        options={timeOptions}
        isOpen={openFilter === 'time'}
        onToggle={(id) => setOpenFilter((current) => (current === id ? null : id))}
        onSelect={(next) => {
          setTimeFilter(next);
          setOpenFilter(null);
        }}
        ariaLabel="Time filter"
        testId="time-filter"
      />
      <FilterDropdown
        id="type"
        value={contentTypeFilter}
        options={typeOptions}
        isOpen={openFilter === 'type'}
        onToggle={(id) => setOpenFilter((current) => (current === id ? null : id))}
        onSelect={(next) => {
          setContentTypeFilter(next);
          setOpenFilter(null);
        }}
        ariaLabel="Content type filter"
        testId="content-type-filter"
      />
      {activeFilterCount > 0 && (
        <button
          className="ws-filter-clear-btn"
          onClick={onClearFilters}
          data-testid="clear-filters-btn"
        >
          Clear
        </button>
      )}
      <div className="ws-filter-presets-area" ref={presetDropdownRef as React.RefObject<HTMLDivElement>}>
        <button
          className="ws-filter-preset-btn"
          onClick={() => setPresetDropdownOpen((v) => !v)}
          data-testid="presets-btn"
          title="Filter presets"
        >
          Presets
        </button>
        {presetDropdownOpen && (
          <div className="ws-filter-preset-dropdown" data-testid="presets-dropdown">
            <button className="ws-filter-preset-save" onClick={onSavePreset} data-testid="save-preset-btn">
              Save current
            </button>
            {filterPresets.length === 0 && (
              <div className="ws-filter-preset-empty">No saved presets</div>
            )}
            {filterPresets.map((p) => (
              <div key={p.id} className="ws-filter-preset-row">
                <button
                  className="ws-filter-preset-apply"
                  onClick={() => onApplyPreset(p)}
                  data-testid={`preset-apply-${p.id}`}
                  title={`${p.searchMode}: ${p.searchQuery || '(empty)'}`}
                >
                  {p.name}
                </button>
                <button
                  className="ws-filter-preset-delete"
                  onClick={() => onDeletePreset(p.id)}
                  data-testid={`preset-delete-${p.id}`}
                  title="Delete preset"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
