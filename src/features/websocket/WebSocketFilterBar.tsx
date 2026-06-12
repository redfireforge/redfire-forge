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
      <select
        className="ws-filter-select"
        value={sizeFilter}
        onChange={(e) => setSizeFilter(e.target.value as WsSizeFilter)}
        aria-label="Size filter"
        data-testid="size-filter"
      >
        <option value="all">Size: All</option>
        <option value="lt1k">&lt; 1KB</option>
        <option value="1k-10k">1–10KB</option>
        <option value="gt10k">&gt; 10KB</option>
      </select>
      <select
        className="ws-filter-select"
        value={timeFilter}
        onChange={(e) => setTimeFilter(e.target.value as WsTimeFilter)}
        aria-label="Time filter"
        data-testid="time-filter"
      >
        <option value="all">Time: All</option>
        <option value="last30s">Last 30s</option>
        <option value="last5m">Last 5m</option>
        <option value="last30m">Last 30m</option>
      </select>
      <select
        className="ws-filter-select"
        value={contentTypeFilter}
        onChange={(e) => setContentTypeFilter(e.target.value as WsContentTypeFilter)}
        aria-label="Content type filter"
        data-testid="content-type-filter"
      >
        <option value="all">Type: All</option>
        <option value="json">JSON</option>
        <option value="text">Text</option>
        <option value="binary">Binary</option>
        <option value="control">Control</option>
      </select>
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
