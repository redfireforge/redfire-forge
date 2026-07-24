import type { RefObject } from 'react';
import { CustomSelect } from '../../shared/components/CustomSelect';
import type { WsMetricsSnapshot } from './useWebSocketMetrics';
import type { WsDirectionFilter, WsSearchMode } from './useWebSocketStudioTypes';
import type { WsValidationFilter } from './wsSchemaTypes';

export interface WebSocketMessageLogToolbarProps {
  searchMode: WsSearchMode;
  setSearchMode: (v: WsSearchMode) => void;
  searchText: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRegexInvalid: boolean;
  totalCount: number;
  displayMessageCount: number;
  directionFilter: WsDirectionFilter;
  setDirectionFilter: (v: WsDirectionFilter) => void;
  bookmarkCount: number;
  validationEnabled: boolean;
  hasEnabledSchemas: boolean;
  validationFilter: WsValidationFilter;
  setValidationFilter?: (filter: WsValidationFilter) => void;
  showFilterBar: boolean;
  onToggleFilterBar: () => void;
  activeFilterCount: number;
  compareMode: boolean;
  onToggleCompare: () => void;
  showAuxPanels: boolean;
  onToggleSchemasVisible?: () => void;
  schemasVisible: boolean;
  onClear: () => void;
  onExportMessages: () => void;
  allMessagesCount: number;
  showStats: boolean;
  onToggleStats: () => void;
  metrics?: WsMetricsSnapshot;
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

export function WebSocketMessageLogToolbar({
  searchMode,
  setSearchMode,
  searchText,
  onSearchChange,
  isRegexInvalid,
  totalCount,
  displayMessageCount,
  directionFilter,
  setDirectionFilter,
  bookmarkCount,
  validationEnabled,
  hasEnabledSchemas,
  validationFilter,
  setValidationFilter,
  showFilterBar,
  onToggleFilterBar,
  activeFilterCount,
  compareMode,
  onToggleCompare,
  showAuxPanels,
  onToggleSchemasVisible,
  schemasVisible,
  onClear,
  onExportMessages,
  allMessagesCount,
  showStats,
  onToggleStats,
  metrics,
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
}: WebSocketMessageLogToolbarProps) {
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
        {totalCount > 0 && displayMessageCount < totalCount && (
          <span className="ws-filter-match-counter" data-testid="match-counter">
            {displayMessageCount} of {totalCount}
          </span>
        )}
        <CustomSelect
          className="ws-message-direction-filter"
          value={directionFilter}
          onChange={(v) => setDirectionFilter(v as WsDirectionFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'sent', label: 'Sent' },
            { value: 'received', label: 'Received' },
            {
              value: 'bookmarked',
              label: bookmarkCount > 0 ? `Bookmarked (${bookmarkCount})` : 'Bookmarked',
            },
          ]}
          aria-label="Direction filter"
        />
        {validationEnabled && hasEnabledSchemas && setValidationFilter && (
          <CustomSelect
            className="ws-validation-filter"
            value={validationFilter}
            onChange={(v) => setValidationFilter(v as WsValidationFilter)}
            options={[
              { value: 'all', label: 'Validation: All' },
              { value: 'valid', label: 'Valid only' },
              { value: 'invalid', label: 'Invalid only' },
            ]}
            aria-label="Validation filter"
            data-testid="validation-filter"
          />
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
            Schema{hasEnabledSchemas && validationEnabled ? ' ●' : ''}
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
          disabled={allMessagesCount === 0}
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
