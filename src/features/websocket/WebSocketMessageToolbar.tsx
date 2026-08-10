import type { RefObject } from 'react';
import type { WsMetricsSnapshot } from './useWebSocketMetrics';
import type { WsDirectionFilter, WsSearchMode } from './useWebSocketStudioTypes';
import type { WsValidationFilter } from './wsSchemaTypes';

interface WebSocketMessageToolbarProps {
  searchMode: WsSearchMode;
  setSearchMode: (mode: WsSearchMode) => void;
  isRegexInvalid: boolean;
  searchText: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  totalCount: number;
  displayCount: number;
  directionFilter: WsDirectionFilter;
  selectedDirectionLabel: string;
  directionDropdownOpen: boolean;
  onToggleDirectionDropdown: () => void;
  directionOptions: ReadonlyArray<{ value: WsDirectionFilter; label: string }>;
  onDirectionSelect: (value: WsDirectionFilter) => void;
  validationEnabled: boolean;
  hasEnabledSchemas: boolean;
  setValidationFilter?: (filter: WsValidationFilter) => void;
  validationFilter: WsValidationFilter;
  selectedValidationLabel: string;
  validationDropdownOpen: boolean;
  onToggleValidationDropdown: () => void;
  validationOptions: ReadonlyArray<{ value: WsValidationFilter; label: string }>;
  onValidationSelect: (value: WsValidationFilter) => void;
  showFilterBar: boolean;
  onToggleFilterBar: () => void;
  activeFilterCount: number;
  compareMode: boolean;
  onToggleCompare: () => void;
  showAuxPanels: boolean;
  onToggleSchemasVisible?: () => void;
  schemasVisible: boolean;
  hasSchemaIndicator: boolean;
  onClear: () => void;
  onExportMessages: () => void;
  allMessagesLength: number;
  metrics?: WsMetricsSnapshot;
  showStats: boolean;
  onToggleStats: () => void;
  onToggleLoadTest?: () => void;
  loadTestActive: boolean;
  recordingState: 'idle' | 'recording' | 'replaying' | 'paused';
  hasLoadedRecording: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  recordingFileInputRef: RefObject<HTMLInputElement | null>;
  onRecordingFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
  onStartReplay?: () => void;
  isMaxReached: boolean;
  maxMessages: number;
}

export function WebSocketMessageToolbar({
  searchMode,
  setSearchMode,
  isRegexInvalid,
  searchText,
  onSearchChange,
  totalCount,
  displayCount,
  directionFilter,
  selectedDirectionLabel,
  directionDropdownOpen,
  onToggleDirectionDropdown,
  directionOptions,
  onDirectionSelect,
  validationEnabled,
  hasEnabledSchemas,
  setValidationFilter,
  validationFilter,
  selectedValidationLabel,
  validationDropdownOpen,
  onToggleValidationDropdown,
  validationOptions,
  onValidationSelect,
  showFilterBar,
  onToggleFilterBar,
  activeFilterCount,
  compareMode,
  onToggleCompare,
  showAuxPanels,
  onToggleSchemasVisible,
  schemasVisible,
  hasSchemaIndicator,
  onClear,
  onExportMessages,
  allMessagesLength,
  metrics,
  showStats,
  onToggleStats,
  onToggleLoadTest,
  loadTestActive,
  recordingState,
  hasLoadedRecording,
  onStartRecording,
  onStopRecording,
  recordingFileInputRef,
  onRecordingFileChange,
  importError,
  onStartReplay,
  isMaxReached,
  maxMessages,
}: WebSocketMessageToolbarProps) {
  return (
    <div className="ws-message-log-toolbar">
      <div className="ws-message-log-toolbar-row ws-message-log-toolbar-row-search">
        <div className="ws-search-mode-pills" data-testid="search-mode-pills">
          {(['text', 'regex', 'jsonpath'] as const).map((mode) => (
            <button
              key={mode}
              className={`ws-search-mode-pill ${searchMode === mode ? 'ws-search-mode-pill-active' : ''}`}
              onClick={() => setSearchMode(mode)}
              data-testid={`search-mode-${mode}`}
              title={mode === 'text' ? 'Text search' : mode === 'regex' ? 'Regex search' : 'JSONPath query'}
            >
              {mode === 'text' ? 'Text' : mode === 'regex' ? 'Regex' : 'JSONPath'}
            </button>
          ))}
        </div>
        <input
          className={`ws-message-search ${isRegexInvalid ? 'ws-search-invalid' : ''}`}
          type="text"
          value={searchText}
          onChange={onSearchChange}
          placeholder={searchMode === 'jsonpath' ? '$.path or $.path=value' : searchMode === 'regex' ? 'regex pattern\u2026' : 'Search messages\u2026'}
          aria-label="Search messages"
          data-testid="search-input"
          title={isRegexInvalid ? 'Invalid regex' : undefined}
        />
        {totalCount > 0 && displayCount < totalCount && (
          <span className="ws-filter-match-counter" data-testid="match-counter">
            {displayCount} of {totalCount}
          </span>
        )}
        <div className="ws-filter-select-dropdown ws-message-direction-dropdown">
          <button
            type="button"
            className="ws-filter-select ws-message-direction-filter"
            aria-label="Direction filter"
            aria-haspopup="listbox"
            aria-expanded={directionDropdownOpen}
            onClick={onToggleDirectionDropdown}
            data-testid="direction-filter"
          >
            <span>{selectedDirectionLabel}</span>
            <span className="ws-filter-select-chevron" aria-hidden>▾</span>
          </button>
          {directionDropdownOpen && (
            <div className="ws-filter-select-menu" role="listbox" aria-label="Direction filter options">
              {directionOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`ws-filter-select-option${opt.value === directionFilter ? ' active' : ''}`}
                  role="option"
                  aria-selected={opt.value === directionFilter}
                  onClick={() => onDirectionSelect(opt.value)}
                  data-testid={`direction-filter-opt-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {validationEnabled && hasEnabledSchemas && setValidationFilter && (
          <div className="ws-filter-select-dropdown ws-validation-filter-dropdown">
            <button
              type="button"
              className="ws-filter-select ws-validation-filter"
              aria-label="Validation filter"
              aria-haspopup="listbox"
              aria-expanded={validationDropdownOpen}
              onClick={onToggleValidationDropdown}
              data-testid="validation-filter"
            >
              <span>{selectedValidationLabel}</span>
              <span className="ws-filter-select-chevron" aria-hidden>▾</span>
            </button>
            {validationDropdownOpen && (
              <div className="ws-filter-select-menu" role="listbox" aria-label="Validation filter options">
                {validationOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ws-filter-select-option${opt.value === validationFilter ? ' active' : ''}`}
                    role="option"
                    aria-selected={opt.value === validationFilter}
                    onClick={() => onValidationSelect(opt.value)}
                    data-testid={`validation-filter-opt-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="ws-message-log-toolbar-row ws-message-log-toolbar-row-actions">
        <button
          className={`ws-filter-toggle-btn ${showFilterBar ? 'ws-filter-toggle-active' : ''}`}
          onClick={onToggleFilterBar}
          data-testid="filter-toggle-btn"
          title={showFilterBar ? 'Hide filters' : 'Show filters'}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <button
          className={`ws-filter-toggle-btn ${compareMode ? 'ws-filter-toggle-active' : ''}`}
          onClick={onToggleCompare}
          disabled={totalCount < 2}
          data-testid="compare-btn"
          title={compareMode ? 'Exit compare mode' : 'Compare two messages'}
        >
          Compare
        </button>
        {showAuxPanels && onToggleSchemasVisible && (
          <button
            className={`ws-filter-toggle-btn ${schemasVisible ? 'ws-filter-toggle-active' : ''}`}
            onClick={onToggleSchemasVisible}
            data-testid="schema-toggle-btn"
            title={schemasVisible ? 'Hide schema panel' : 'Show schema panel'}
          >
            Schema{hasSchemaIndicator ? ' ●' : ''}
          </button>
        )}
        <button
          className="ws-message-clear-btn"
          onClick={onClear}
          disabled={totalCount === 0}
          data-testid="clear-btn"
        >
          Clear
        </button>
        <button
          className="ws-message-export-btn"
          onClick={onExportMessages}
          disabled={allMessagesLength === 0}
          data-testid="export-messages-btn"
        >
          Export
        </button>
        {showAuxPanels && metrics && (
          <button
            className={`ws-stats-toggle-btn ${showStats ? 'ws-stats-toggle-active' : ''}`}
            onClick={onToggleStats}
            data-testid="stats-toggle-btn"
            title={showStats ? 'Hide stats' : 'Show stats'}
          >
            Stats
          </button>
        )}
        {showAuxPanels && onToggleLoadTest && (
          <button
            className={`ws-stats-toggle-btn ${loadTestActive ? 'ws-stats-toggle-active' : ''}`}
            onClick={onToggleLoadTest}
            data-testid="load-test-toggle-btn"
            title={loadTestActive ? 'Hide load test' : 'Show load test'}
          >
            Load Test
          </button>
        )}
        {recordingState === 'idle' && !hasLoadedRecording && (
          <button
            className="ws-recording-btn"
            onClick={onStartRecording}
            data-testid="start-recording-btn"
            title="Start recording session"
          >
            ● Rec
          </button>
        )}
        {recordingState === 'recording' && (
          <button
            className="ws-recording-btn ws-recording-active"
            onClick={onStopRecording}
            data-testid="stop-recording-btn"
            title="Stop recording and save"
          >
            ■ Stop
          </button>
        )}
        {recordingState === 'idle' && !hasLoadedRecording && (
          <>
            <button
              className="ws-recording-import-btn"
              onClick={() => recordingFileInputRef.current?.click()}
              data-testid="import-recording-btn"
              title="Import recording"
            >
              Import
            </button>
            <input
              ref={recordingFileInputRef}
              type="file"
              accept=".json,.wsrecording.json"
              style={{ display: 'none' }}
              onChange={onRecordingFileChange}
              data-testid="recording-file-input"
            />
            {importError && (
              <span className="ws-import-error" data-testid="import-error">{importError}</span>
            )}
          </>
        )}
        {hasLoadedRecording && recordingState === 'idle' && (
          <button
            className="ws-replay-start-btn"
            onClick={onStartReplay}
            data-testid="start-replay-btn"
            title="Start replay"
          >
            ▶ Play
          </button>
        )}
        {isMaxReached && (
          <span className="ws-message-max-reached" data-testid="max-reached">
            {totalCount}/{maxMessages} — max reached
          </span>
        )}
      </div>
    </div>
  );
}
