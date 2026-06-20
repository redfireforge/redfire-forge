import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { WsFrame, WsReplaySpeed, WsMessageFormat, WsMessageTemplate } from '../../shared/websocket/types';
import { formatUptime } from '../../shared/websocket/types';
import type { WsDirectionFilter, WsSearchMode, WsSizeFilter, WsTimeFilter, WsContentTypeFilter } from './useWebSocketStudioTypes';
import { WebSocketMessageDetail } from './WebSocketMessageDetail';
import { useDropdownClose } from './useDropdownClose';
import type { WsProtocolMode } from '../../shared/websocket/protocols/protocolTypes';
import { useWebSocketSend } from './useWebSocketSend';
import { useWebSocketMessageDiff } from './useWebSocketMessageDiff';
import { saveJsonFile } from '../../shared/utils/fileSaver';
import type { WsMetricsSnapshot } from './useWebSocketMetrics';
import { WebSocketStatsPanel } from './WebSocketStatsPanel';
import { WebSocketMessageDiff } from './WebSocketMessageDiff';
import type { WsValidationResult, WsValidationFilter, WsSchemaDefinition, WsSchemaDirection } from './wsSchemaTypes';
import { WebSocketSchemaPanel } from './WebSocketSchemaPanel';
import { MessageRow } from './WebSocketMessageRow';
import { useWebSocketFilterPresets } from './useWebSocketFilterPresets';
import { WebSocketFilterBar } from './WebSocketFilterBar';

const ROW_HEIGHT = 26;
const VIRTUALIZER_OVERSCAN = 15;

interface WebSocketMessageLogProps {
  messages: WsFrame[];
  totalCount: number;
  maxMessages: number;
  isMaxReached: boolean;
  searchText: string;
  setSearchText: (v: string) => void;
  searchMode: WsSearchMode;
  setSearchMode: (v: WsSearchMode) => void;
  directionFilter: WsDirectionFilter;
  setDirectionFilter: (v: WsDirectionFilter) => void;
  sizeFilter: WsSizeFilter;
  setSizeFilter: (v: WsSizeFilter) => void;
  timeFilter: WsTimeFilter;
  setTimeFilter: (v: WsTimeFilter) => void;
  contentTypeFilter: WsContentTypeFilter;
  setContentTypeFilter: (v: WsContentTypeFilter) => void;
  onClear: () => void;
  onSend: (data: string, format?: WsMessageFormat) => void;
  onPing?: () => void;
  isConnected: boolean;
  templates: WsMessageTemplate[];
  onSaveTemplate: (name: string, body: string, format: WsMessageFormat) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onLoadTemplate: (id: string) => { body: string; format: WsMessageFormat } | null;
  effectiveProtocol?: Exclude<WsProtocolMode, 'auto'>;
  allMessages?: WsFrame[];
  transportMode?: 'direct' | 'proxy' | 'native';
  showStatusBar?: boolean;
  /** When false, the inline composer is suppressed (the composer is rendered
   * separately in the left Compose tab). Defaults to true so the uncontrolled
   * / flag-off path renders the composer inline exactly as before. */
  showComposer?: boolean;
  /** When false, the Stats / Load Test / Schema toolbar toggle buttons and their
   * inline drawer panels are suppressed because they are rendered as dedicated
   * right-pane tabs in shell-v2 (Phase 5). Defaults to true so the legacy flat
   * layout keeps the inline toggles exactly as before. */
  showAuxPanels?: boolean;
  connectionUrl?: string;
  uptime?: number | null;
  sentCount?: number;
  receivedCount?: number;
  bookmarkedIds?: ReadonlySet<string>;
  onToggleBookmark?: (id: string) => void;
  bookmarkCount?: number;
  recordingState?: 'idle' | 'recording' | 'replaying' | 'paused';
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onLoadRecordingFile?: (file: File) => Promise<boolean>;
  onStartReplay?: () => void;
  onPauseReplay?: () => void;
  onResumeReplay?: () => void;
  onStopReplay?: () => void;
  replaySpeed?: WsReplaySpeed;
  onSetReplaySpeed?: (speed: WsReplaySpeed) => void;
  replayProgress?: { current: number; total: number; elapsedMs: number; durationMs: number } | null;
  hasLoadedRecording?: boolean;
  metrics?: WsMetricsSnapshot;
  onToggleLoadTest?: () => void;
  loadTestActive?: boolean;
  // Schema validation (Phase 19)
  getValidation?: (frame: WsFrame) => WsValidationResult[] | null;
  validationFilter?: WsValidationFilter;
  setValidationFilter?: (filter: WsValidationFilter) => void;
  validationEnabled?: boolean;
  setValidationEnabled?: (enabled: boolean) => void;
  schemas?: WsSchemaDefinition[];
  onAddSchema?: (name: string, schema: string, direction: WsSchemaDirection) => { ok: boolean; error?: string };
  onUpdateSchema?: (id: string, patch: Partial<Pick<WsSchemaDefinition, 'name' | 'schema' | 'direction' | 'enabled'>>) => { ok: boolean; error?: string };
  onRemoveSchema?: (id: string) => void;
  onToggleSchema?: (id: string) => void;
  onGenerateSchema?: (messages: WsFrame[], direction: WsSchemaDirection) => string | null;
  schemasVisible?: boolean;
  onToggleSchemasVisible?: () => void;
  hasEnabledSchemas?: boolean;
}




export function WebSocketMessageLog({
  messages,
  totalCount,
  maxMessages,
  isMaxReached,
  searchText,
  setSearchText,
  searchMode,
  setSearchMode,
  directionFilter,
  setDirectionFilter,
  sizeFilter,
  setSizeFilter,
  timeFilter,
  setTimeFilter,
  contentTypeFilter,
  setContentTypeFilter,
  onClear,
  onSend,
  onPing,
  isConnected,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onLoadTemplate,
  effectiveProtocol = 'raw',
  allMessages = messages,
  transportMode = 'direct',
  showStatusBar = false,
  showComposer = true,
  showAuxPanels = true,
  connectionUrl,
  uptime = null,
  sentCount = 0,
  receivedCount = 0,
  bookmarkedIds,
  onToggleBookmark,
  bookmarkCount = 0,
  recordingState = 'idle',
  onStartRecording,
  onStopRecording,
  onLoadRecordingFile,
  onStartReplay,
  onPauseReplay,
  onResumeReplay,
  onStopReplay,
  replaySpeed = 1,
  onSetReplaySpeed,
  replayProgress = null,
  hasLoadedRecording = false,
  metrics,
  onToggleLoadTest,
  loadTestActive = false,
  getValidation,
  validationFilter = 'all',
  setValidationFilter,
  validationEnabled = false,
  setValidationEnabled,
  schemas = [],
  onAddSchema,
  onUpdateSchema,
  onRemoveSchema,
  onToggleSchema,
  onGenerateSchema,
  schemasVisible = false,
  onToggleSchemasVisible,
  hasEnabledSchemas = false,
}: WebSocketMessageLogProps) {
  const { composeBar } = useWebSocketSend({
    isConnected,
    effectiveProtocol,
    onSend,
    onPing,
    templates,
    onSaveTemplate,
    onDeleteTemplate,
    onLoadTemplate,
    transportMode,
    totalCount,
    maxMessages,
  });

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const presetDropdownRef = useDropdownClose(
    presetDropdownOpen,
    useCallback(() => setPresetDropdownOpen(false), []),
  );
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const recordingFileInputRef = useRef<HTMLInputElement>(null);
  const allMessagesRef = useRef(allMessages);
  allMessagesRef.current = allMessages;

  const {
    compareMode,
    compareIds,
    diffPair,
    toggleCompare,
    closeDiff,
    swapDiff,
    quickDiff,
    selectCompareRow,
    exitCompareMode,
  } = useWebSocketMessageDiff({ allMessages, allMessagesRef });

  const isReplaying = recordingState === 'replaying' || recordingState === 'paused';

  const { filterPresets, handleSavePreset, handleDeletePreset, handleApplyPreset } = useWebSocketFilterPresets({
    searchMode, searchText, sizeFilter, timeFilter, contentTypeFilter,
    setSearchMode, setSearchText, setSizeFilter, setTimeFilter, setContentTypeFilter,
    setShowFilterBar, setPresetDropdownOpen,
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sizeFilter !== 'all') count++;
    if (timeFilter !== 'all') count++;
    if (contentTypeFilter !== 'all') count++;
    return count;
  }, [sizeFilter, timeFilter, contentTypeFilter]);

  const handleClearFilters = useCallback(() => {
    setSizeFilter('all');
    setTimeFilter('all');
    setContentTypeFilter('all');
  }, [setSizeFilter, setTimeFilter, setContentTypeFilter]);

  const validationCacheRef = useRef(new Map<string, WsValidationResult[]>());
  const prevSchemasRef = useRef(schemas);
  const prevValidationEnabledRef = useRef(validationEnabled);
  if (prevSchemasRef.current !== schemas || prevValidationEnabledRef.current !== validationEnabled) {
    validationCacheRef.current.clear();
    prevSchemasRef.current = schemas;
    prevValidationEnabledRef.current = validationEnabled;
  }
  const cache = validationCacheRef.current;
  if (cache.size > messages.length + 50) {
    const liveIds = new Set(messages.map((m) => m.id));
    for (const k of cache.keys()) {
      if (!liveIds.has(k)) cache.delete(k);
    }
  }

  const getCachedValidation = useCallback(
    (frame: WsFrame): WsValidationResult[] | null => {
      if (!getValidation) return null;
      const cached = validationCacheRef.current.get(frame.id);
      if (cached !== undefined) return cached;
      const result = getValidation(frame);
      if (result !== null) validationCacheRef.current.set(frame.id, result);
      return result;
    },
    // schemas + validationEnabled trigger function recreation to invalidate displayMessages memo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getValidation, schemas, validationEnabled],
  );

  const displayMessages = useMemo(() => {
    if (validationFilter === 'all' || !validationEnabled || !hasEnabledSchemas) return messages;
    return messages.filter((msg) => {
      const results = getCachedValidation(msg);
      if (!results || results.length === 0) return false;
      const allValid = results.every((r) => r.valid);
      return validationFilter === 'valid' ? allValid : !allValid;
    });
  }, [messages, validationFilter, validationEnabled, hasEnabledSchemas, getCachedValidation]);

  const isRegexInvalid = useMemo(() => {
    if (searchMode !== 'regex' || searchText.trim().length === 0) return false;
    try {
      new RegExp(searchText.trim(), 'i');
      return false;
    } catch {
      return true;
    }
  }, [searchMode, searchText]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUpRef.current = !isAtBottom;
  }, []);

  const handleRowClick = useCallback((id: string) => {
    if (selectCompareRow(id)) return;
    setSelectedMessageId((prev) => (prev === id ? null : id));
  }, [selectCompareRow]);

  const handleToggleBookmark = useCallback((id: string) => {
    onToggleBookmark?.(id);
  }, [onToggleBookmark]);

  const handleRecordingFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onLoadRecordingFile) return;
    const ok = await onLoadRecordingFile(file);
    e.target.value = '';
    if (!ok) {
      setImportError('Invalid recording file — expected ws-recording-v1 format');
      setTimeout(() => setImportError(null), 4000);
    }
  }, [onLoadRecordingFile]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value),
    [setSearchText],
  );

  const virtualizer = useVirtualizer({
    count: displayMessages.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  const lastVisibleId = displayMessages.length > 0 ? displayMessages[displayMessages.length - 1].id : '';

  useEffect(() => {
    if (displayMessages.length === 0) {
      userScrolledUpRef.current = false;
      return;
    }
    if (!userScrolledUpRef.current) {
      virtualizerRef.current.scrollToIndex(displayMessages.length - 1, { align: 'end' });
    }
  }, [lastVisibleId, displayMessages.length]);

  const handleExportMessages = useCallback(() => {
    const exportData = allMessages.map((f) => ({
      id: f.id,
      direction: f.direction,
      type: f.type,
      data: f.data,
      size: f.size,
      timestamp: f.timestamp,
      protocolMeta: f.protocolMeta ?? undefined,
      ...(bookmarkedIds?.has(f.id) ? { bookmarked: true as const } : {}),
    }));
    const filename = `ws-messages-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    saveJsonFile(exportData, filename).catch(() => { /* save dialog cancelled or write failed */ });
  }, [allMessages, bookmarkedIds]);

  // Detail panel navigation
  const selectedFrame = useMemo(
    () => (selectedMessageId ? displayMessages.find((m) => m.id === selectedMessageId) ?? null : null),
    [selectedMessageId, displayMessages],
  );

  const selectedIndex = useMemo(
    () => (selectedMessageId ? displayMessages.findIndex((m) => m.id === selectedMessageId) : -1),
    [selectedMessageId, displayMessages],
  );

  const handleDetailClose = useCallback(() => {
    setSelectedMessageId(null);
  }, []);

  const handleDetailPrev = useCallback(() => {
    if (selectedIndex > 0) {
      const prevId = displayMessages[selectedIndex - 1].id;
      setSelectedMessageId(prevId);
      const visIdx = displayMessages.findIndex((m) => m.id === prevId);
      if (visIdx >= 0) virtualizerRef.current.scrollToIndex(visIdx, { align: 'auto' });
    }
  }, [selectedIndex, displayMessages]);

  const handleDetailNext = useCallback(() => {
    if (selectedIndex < displayMessages.length - 1) {
      const nextId = displayMessages[selectedIndex + 1].id;
      setSelectedMessageId(nextId);
      const visIdx = displayMessages.findIndex((m) => m.id === nextId);
      if (visIdx >= 0) virtualizerRef.current.scrollToIndex(visIdx, { align: 'auto' });
    }
  }, [selectedIndex, displayMessages]);

  const scrollToMessageId = useCallback((id: string) => {
    const visIdx = displayMessages.findIndex((m) => m.id === id);
    if (visIdx >= 0) virtualizerRef.current.scrollToIndex(visIdx, { align: 'auto' });
  }, [displayMessages]);

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIndex < displayMessages.length - 1) {
          const nextId = displayMessages[selectedIndex + 1].id;
          setSelectedMessageId(nextId);
          scrollToMessageId(nextId);
        } else if (selectedIndex === -1 && displayMessages.length > 0) {
          const firstId = displayMessages[0].id;
          setSelectedMessageId(firstId);
          scrollToMessageId(firstId);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex > 0) {
          const prevId = displayMessages[selectedIndex - 1].id;
          setSelectedMessageId(prevId);
          scrollToMessageId(prevId);
        }
      } else if (e.key === 'Escape') {
        if (diffPair) {
          closeDiff();
        } else if (compareMode) {
          exitCompareMode();
        } else {
          setSelectedMessageId(null);
        }
      } else if (e.key === 'd' || e.key === 'D') {
        if (selectedFrame && selectedFrame.type === 'text') {
          quickDiff(selectedFrame, 'prev');
        }
      }
    },
    [selectedIndex, displayMessages, scrollToMessageId, compareMode, diffPair, closeDiff, exitCompareMode, selectedFrame, quickDiff],
  );

  const hasDiffPrev = useMemo(() => {
    if (!selectedFrame || selectedFrame.type !== 'text') return false;
    const idx = allMessages.findIndex((m) => m.id === selectedFrame.id);
    if (idx <= 0) return false;
    for (let i = idx - 1; i >= 0; i--) {
      if (allMessages[i].direction === selectedFrame.direction && allMessages[i].type === 'text') return true;
    }
    return false;
  }, [selectedFrame, allMessages]);

  const hasDiffNext = useMemo(() => {
    if (!selectedFrame || selectedFrame.type !== 'text') return false;
    const idx = allMessages.findIndex((m) => m.id === selectedFrame.id);
    if (idx < 0 || idx >= allMessages.length - 1) return false;
    for (let i = idx + 1; i < allMessages.length; i++) {
      if (allMessages[i].direction === selectedFrame.direction && allMessages[i].type === 'text') return true;
    }
    return false;
  }, [selectedFrame, allMessages]);

  const statusDotClass = isConnected ? 'connected' : 'disconnected';

  return (
    <div className="ws-message-log-container">
      {showStatusBar && (
        <div className="ws-messages-status-bar" data-testid="messages-status-bar">
          <span className={`ws-status-dot ${statusDotClass}`} aria-hidden="true" />
          <span className="ws-messages-status-label">{isConnected ? 'Connected' : 'Disconnected'}</span>
          {connectionUrl && (
            <span className="ws-messages-status-url" title={connectionUrl}>{connectionUrl}</span>
          )}
          {uptime != null && (
            <span className="ws-messages-status-metric">Uptime: {formatUptime(uptime)}</span>
          )}
          <span className="ws-messages-status-metric">↑ {sentCount} &nbsp; ↓ {receivedCount}</span>
          <span className="ws-messages-status-hints">↑↓ navigate · Esc close detail</span>
        </div>
      )}

      {/* Toolbar */}
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
          onChange={handleSearchChange}
          placeholder={searchMode === 'jsonpath' ? '$.path or $.path=value' : searchMode === 'regex' ? 'regex pattern\u2026' : 'Search messages\u2026'}
          aria-label="Search messages"
          data-testid="search-input"
          title={isRegexInvalid ? 'Invalid regex' : undefined}
        />
        {totalCount > 0 && displayMessages.length < totalCount && (
          <span className="ws-filter-match-counter" data-testid="match-counter">
            {displayMessages.length} of {totalCount}
          </span>
        )}
        <select
          className="ws-message-direction-filter"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value as WsDirectionFilter)}
          aria-label="Direction filter"
        >
          <option value="all">All</option>
          <option value="sent">Sent</option>
          <option value="received">Received</option>
          <option value="bookmarked">
            {bookmarkCount > 0 ? `Bookmarked (${bookmarkCount})` : 'Bookmarked'}
          </option>
        </select>
        {validationEnabled && hasEnabledSchemas && setValidationFilter && (
          <select
            className="ws-validation-filter"
            value={validationFilter}
            onChange={(e) => setValidationFilter(e.target.value as WsValidationFilter)}
            aria-label="Validation filter"
            data-testid="validation-filter"
          >
            <option value="all">Validation: All</option>
            <option value="valid">Valid only</option>
            <option value="invalid">Invalid only</option>
          </select>
        )}
        </div>
        <div className="ws-message-log-toolbar-row ws-message-log-toolbar-row-actions">
        <button
          className={`ws-filter-toggle-btn ${showFilterBar ? 'ws-filter-toggle-active' : ''}`}
          onClick={() => setShowFilterBar((v) => !v)}
          data-testid="filter-toggle-btn"
          title={showFilterBar ? 'Hide filters' : 'Show filters'}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <button
          className={`ws-filter-toggle-btn ${compareMode ? 'ws-filter-toggle-active' : ''}`}
          onClick={toggleCompare}
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
          onClick={handleExportMessages}
          disabled={allMessages.length === 0}
          data-testid="export-messages-btn"
        >
          Export
        </button>
        {showAuxPanels && metrics && (
          <button
            className={`ws-stats-toggle-btn ${showStats ? 'ws-stats-toggle-active' : ''}`}
            onClick={() => setShowStats((v) => !v)}
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
              onChange={handleRecordingFileChange}
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

      {/* Filter Bar */}
      {showFilterBar && (
        <WebSocketFilterBar
          sizeFilter={sizeFilter}
          setSizeFilter={setSizeFilter}
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
          contentTypeFilter={contentTypeFilter}
          setContentTypeFilter={setContentTypeFilter}
          activeFilterCount={activeFilterCount}
          onClearFilters={handleClearFilters}
          filterPresets={filterPresets}
          presetDropdownOpen={presetDropdownOpen}
          setPresetDropdownOpen={setPresetDropdownOpen}
          presetDropdownRef={presetDropdownRef}
          onSavePreset={handleSavePreset}
          onApplyPreset={handleApplyPreset}
          onDeletePreset={handleDeletePreset}
        />
      )}

      {isReplaying && (
        <div className="ws-replay-bar" data-testid="replay-bar">
          {/* Left: mode badge + playback controls */}
          <div className="ws-replay-bar-left">
            <span className="ws-replay-badge">
              <span className="ws-replay-dot" />
              REPLAY
            </span>
            <button
              className="ws-replay-playpause"
              onClick={recordingState === 'paused' ? onResumeReplay : onPauseReplay}
              data-testid="replay-playpause-btn"
              title={recordingState === 'paused' ? 'Resume replay' : 'Pause replay'}
              aria-label={recordingState === 'paused' ? 'Resume replay' : 'Pause replay'}
            >
              {recordingState === 'paused' ? '▶' : '⏸'}
            </button>
            <div className="ws-replay-speed-group">
              <span className="ws-replay-speed-label">Speed</span>
              <select
                className="ws-replay-speed"
                value={replaySpeed}
                onChange={(e) => onSetReplaySpeed?.(Number(e.target.value) as WsReplaySpeed)}
                data-testid="replay-speed-select"
                aria-label="Replay speed"
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={5}>5×</option>
                <option value={10}>10×</option>
                <option value={0}>Max</option>
              </select>
            </div>
          </div>

          {/* Center: progress track + counter */}
          {replayProgress && (
            <div className="ws-replay-center" data-testid="replay-progress">
              <div className="ws-replay-track">
                <div
                  className="ws-replay-fill"
                  style={{ width: `${Math.min(100, (replayProgress.current / Math.max(replayProgress.total, 1)) * 100)}%` }}
                />
              </div>
              <span className="ws-replay-counter">
                <span className="ws-replay-counter-current">{replayProgress.current}</span>
                <span className="ws-replay-counter-sep">/</span>
                <span className="ws-replay-counter-total">{replayProgress.total}</span>
                <span className="ws-replay-counter-label">events</span>
              </span>
            </div>
          )}

          {/* Right: exit */}
          <button
            className="ws-replay-exit-btn"
            onClick={onStopReplay}
            data-testid="replay-exit-btn"
            title="Stop replay and return to live view"
            aria-label="Exit replay"
          >
            <span className="ws-replay-exit-icon">✕</span>
            Exit Replay
          </button>
        </div>
      )}

      {/* Compare mode banner */}
      {compareMode && (
        <div className="ws-compare-banner" data-testid="compare-banner">
          <span>
            {compareIds[0] === null
              ? 'Click a message to select it for comparison'
              : compareIds[1] === null
                ? 'Click a second message to compare'
                : 'Comparison ready'}
          </span>
          <button className="ws-compare-banner-cancel" onClick={toggleCompare} data-testid="compare-cancel">
            Cancel
          </button>
        </div>
      )}

      {/* Virtualized message list */}
      <div
        className="ws-message-list"
        ref={listRef}
        onScroll={handleScroll}
        onKeyDown={handleListKeyDown}
        tabIndex={0}
        data-testid="message-list"
      >
        {displayMessages.length === 0 && (
          <div className="ws-message-empty" data-testid="empty-state">
            <span className="ws-message-empty-icon">{totalCount === 0 ? '💬' : '🔍'}</span>
            <span className="ws-message-empty-title">
              {totalCount === 0 ? 'No Messages Yet' : 'No Results'}
            </span>
            <span className="ws-message-empty-text">
              {totalCount === 0
                ? 'Connect to a WebSocket endpoint and start sending messages to see them here.'
                : 'No messages match the current filters. Try adjusting your search or filter criteria.'}
            </span>
          </div>
        )}
        {displayMessages.length > 0 && (
          <div
            className="ws-message-list-inner"
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const frame = displayMessages[virtualRow.index];
              return (
                <div
                  key={frame.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <MessageRow
                    frame={frame}
                    isSelected={selectedMessageId === frame.id}
                    isBookmarked={bookmarkedIds?.has(frame.id) ?? false}
                    compareBadge={compareIds[0] === frame.id ? 'A' : compareIds[1] === frame.id ? 'B' : null}
                    validationBadge={(() => {
                      const r = getCachedValidation(frame);
                      if (!r || r.length === 0) return null;
                      return r.every((v) => v.valid) ? 'valid' : 'invalid';
                    })()}
                    onRowClick={handleRowClick}
                    onToggleBookmark={handleToggleBookmark}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schema panel */}
      {showAuxPanels && schemasVisible && onAddSchema && onUpdateSchema && onRemoveSchema && onToggleSchema && onGenerateSchema && setValidationEnabled && (
        <WebSocketSchemaPanel
          schemas={schemas}
          validationEnabled={validationEnabled}
          onSetValidationEnabled={setValidationEnabled}
          onAddSchema={onAddSchema}
          onUpdateSchema={onUpdateSchema}
          onRemoveSchema={onRemoveSchema}
          onToggleSchema={onToggleSchema}
          onGenerateSchema={onGenerateSchema}
          messages={allMessages}
        />
      )}

      {/* Detail panel */}
      {selectedFrame && (
        <WebSocketMessageDetail
          frame={selectedFrame}
          onClose={handleDetailClose}
          onPrev={handleDetailPrev}
          onNext={handleDetailNext}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < displayMessages.length - 1}
          onDiffPrev={hasDiffPrev ? () => quickDiff(selectedFrame, 'prev') : undefined}
          onDiffNext={hasDiffNext ? () => quickDiff(selectedFrame, 'next') : undefined}
          validationResults={getCachedValidation(selectedFrame)}
        />
      )}

      {showAuxPanels && showStats && metrics && (
        <WebSocketStatsPanel metrics={metrics} />
      )}

      {!isReplaying && showComposer && composeBar}

      {diffPair && (
        <WebSocketMessageDiff
          left={diffPair[0]}
          right={diffPair[1]}
          onClose={closeDiff}
          onSwap={swapDiff}
        />
      )}
    </div>
  );
}
