import { CustomSelect } from '../../shared/components/CustomSelect';
import type { WsFilterPreset } from '../../shared/websocket/types';
import type { WsSizeFilter, WsTimeFilter, WsContentTypeFilter } from './useWebSocketStudioTypes';

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
  return (
    <div className="ws-filter-bar" data-testid="filter-bar">
      <CustomSelect
        className="ws-filter-select"
        value={sizeFilter}
        onChange={(v) => setSizeFilter(v as WsSizeFilter)}
        options={[
          { value: 'all', label: 'Size: All' },
          { value: 'lt1k', label: '< 1KB' },
          { value: '1k-10k', label: '1–10KB' },
          { value: 'gt10k', label: '> 10KB' },
        ]}
        aria-label="Size filter"
        data-testid="size-filter"
      />
      <CustomSelect
        className="ws-filter-select"
        value={timeFilter}
        onChange={(v) => setTimeFilter(v as WsTimeFilter)}
        options={[
          { value: 'all', label: 'Time: All' },
          { value: 'last30s', label: 'Last 30s' },
          { value: 'last5m', label: 'Last 5m' },
          { value: 'last30m', label: 'Last 30m' },
        ]}
        aria-label="Time filter"
        data-testid="time-filter"
      />
      <CustomSelect
        className="ws-filter-select"
        value={contentTypeFilter}
        onChange={(v) => setContentTypeFilter(v as WsContentTypeFilter)}
        options={[
          { value: 'all', label: 'Type: All' },
          { value: 'json', label: 'JSON' },
          { value: 'text', label: 'Text' },
          { value: 'binary', label: 'Binary' },
          { value: 'control', label: 'Control' },
        ]}
        aria-label="Content type filter"
        data-testid="content-type-filter"
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
