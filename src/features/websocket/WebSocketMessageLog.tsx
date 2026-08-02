import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { WsFrame, WsReplaySpeed, WsMessageFormat, WsMessageTemplate } from '../../shared/websocket/types';
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
import { WebSocketStatusBar } from './WebSocketStatusBar';
import { WebSocketReplayBar } from './WebSocketReplayBar';
import { WebSocketMessageToolbar } from './WebSocketMessageToolbar';

const ROW_HEIGHT = 26;
const VIRTUALIZER_OVERSCAN = 15;

type ToolbarDropdownKey = 'direction' | 'validation';

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
  const [openToolbarDropdown, setOpenToolbarDropdown] = useState<ToolbarDropdownKey | null>(null);
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

  useEffect(() => {
    if (!openToolbarDropdown) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.ws-filter-select-dropdown')) {
        setOpenToolbarDropdown(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenToolbarDropdown(null);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [openToolbarDropdown]);

  const directionOptions = useMemo(
    () => [
      { value: 'all' as WsDirectionFilter, label: 'All' },
      { value: 'sent' as WsDirectionFilter, label: 'Sent' },
      { value: 'received' as WsDirectionFilter, label: 'Received' },
      {
        value: 'bookmarked' as WsDirectionFilter,
        label: bookmarkCount > 0 ? `Bookmarked (${bookmarkCount})` : 'Bookmarked',
      },
    ],
    [bookmarkCount],
  );

  const selectedDirectionLabel = useMemo(
    () => directionOptions.find((opt) => opt.value === directionFilter)?.label ?? 'All',
    [directionFilter, directionOptions],
  );

  const validationOptions = useMemo(
    () => [
      { value: 'all' as WsValidationFilter, label: 'Validation: All' },
      { value: 'valid' as WsValidationFilter, label: 'Valid only' },
      { value: 'invalid' as WsValidationFilter, label: 'Invalid only' },
    ],
    [],
  );

  const selectedValidationLabel = useMemo(
    () => validationOptions.find((opt) => opt.value === validationFilter)?.label ?? 'Validation: All',
    [validationFilter, validationOptions],
  );

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

  return (
    <div className="ws-message-log-container">
      {showStatusBar && (
        <WebSocketStatusBar
          isConnected={isConnected}
          connectionUrl={connectionUrl}
          uptime={uptime}
          sentCount={sentCount}
          receivedCount={receivedCount}
        />
      )}

      <WebSocketMessageToolbar
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        isRegexInvalid={isRegexInvalid}
        searchText={searchText}
        onSearchChange={handleSearchChange}
        totalCount={totalCount}
        displayCount={displayMessages.length}
        directionFilter={directionFilter}
        selectedDirectionLabel={selectedDirectionLabel}
        directionDropdownOpen={openToolbarDropdown === 'direction'}
        onToggleDirectionDropdown={() => setOpenToolbarDropdown((current) => (current === 'direction' ? null : 'direction'))}
        directionOptions={directionOptions}
        onDirectionSelect={(value) => {
          setDirectionFilter(value);
          setOpenToolbarDropdown(null);
        }}
        validationEnabled={validationEnabled}
        hasEnabledSchemas={hasEnabledSchemas}
        setValidationFilter={setValidationFilter}
        validationFilter={validationFilter}
        selectedValidationLabel={selectedValidationLabel}
        validationDropdownOpen={openToolbarDropdown === 'validation'}
        onToggleValidationDropdown={() => setOpenToolbarDropdown((current) => (current === 'validation' ? null : 'validation'))}
        validationOptions={validationOptions}
        onValidationSelect={(value) => {
          setValidationFilter?.(value);
          setOpenToolbarDropdown(null);
        }}
        showFilterBar={showFilterBar}
        onToggleFilterBar={() => setShowFilterBar((v) => !v)}
        activeFilterCount={activeFilterCount}
        compareMode={compareMode}
        onToggleCompare={toggleCompare}
        showAuxPanels={showAuxPanels}
        onToggleSchemasVisible={onToggleSchemasVisible}
        schemasVisible={schemasVisible}
        hasSchemaIndicator={hasEnabledSchemas && validationEnabled}
        onClear={onClear}
        onExportMessages={handleExportMessages}
        allMessagesLength={allMessages.length}
        metrics={metrics}
        showStats={showStats}
        onToggleStats={() => setShowStats((v) => !v)}
        onToggleLoadTest={onToggleLoadTest}
        loadTestActive={loadTestActive}
        recordingState={recordingState}
        hasLoadedRecording={hasLoadedRecording}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        recordingFileInputRef={recordingFileInputRef}
        onRecordingFileChange={handleRecordingFileChange}
        importError={importError}
        onStartReplay={onStartReplay}
        isMaxReached={isMaxReached}
        maxMessages={maxMessages}
      />

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
        <WebSocketReplayBar
          recordingState={recordingState}
          replaySpeed={replaySpeed}
          onSetReplaySpeed={onSetReplaySpeed}
          replayProgress={replayProgress}
          onPauseReplay={onPauseReplay}
          onResumeReplay={onResumeReplay}
          onStopReplay={onStopReplay}
        />
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
