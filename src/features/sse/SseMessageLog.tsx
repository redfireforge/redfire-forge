import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { SseEvent, SseStats } from './sseTypes';
import { SseEventDetail } from './SseEventDetail';
import { saveJsonFile } from '@shared/utils/fileSaver';

const ROW_HEIGHT = 28;
const VIRTUALIZER_OVERSCAN = 15;

interface SseMessageLogProps {
  events: SseEvent[];
  stats: SseStats;
  bookmarkedIds: ReadonlySet<string>;
  onToggleBookmark: (id: string) => void;
  onClear: () => void;
  lastEventId: string;
  uptime: number | null;
}

const SseRow = memo(function SseRow({
  event,
  isSelected,
  isBookmarked,
  onClick,
  onToggleBookmark,
}: {
  event: SseEvent;
  isSelected: boolean;
  isBookmarked: boolean;
  onClick: (id: string) => void;
  onToggleBookmark: (id: string) => void;
}) {
  const preview = event.data.length > 120 ? event.data.slice(0, 120) + '…' : event.data;
  const time = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div
      className={`sse-row ${isSelected ? 'sse-row-selected' : ''}`}
      onClick={() => onClick(event.id)}
      data-testid="sse-event-row"
    >
      <button
        className={`sse-bookmark-btn ${isBookmarked ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleBookmark(event.id); }}
        aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
        data-testid="sse-bookmark-btn"
      >
        {isBookmarked ? '★' : '☆'}
      </button>
      <span className="sse-row-time">{time}</span>
      <span className={`sse-type-badge sse-type-${event.eventType}`}>{event.eventType}</span>
      <span className="sse-row-data" title={event.data}>{preview}</span>
      <span className="sse-row-size">{event.size}B</span>
    </div>
  );
});

export function SseMessageLog({
  events,
  stats,
  bookmarkedIds,
  onToggleBookmark,
  onClear,
  lastEventId,
  uptime,
}: SseMessageLogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [showBookmarked, setShowBookmarked] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    for (const e of events) types.add(e.eventType);
    return Array.from(types).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    let result = events;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (e) => e.data.toLowerCase().includes(lower) || e.eventType.toLowerCase().includes(lower),
      );
    }
    if (eventTypeFilter) {
      result = result.filter((e) => e.eventType === eventTypeFilter);
    }
    if (showBookmarked) {
      result = result.filter((e) => bookmarkedIds.has(e.id));
    }
    return result;
  }, [events, searchText, eventTypeFilter, showBookmarked, bookmarkedIds]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  const handleRowClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const selectedEvent = useMemo(
    () => (selectedId ? events.find((e) => e.id === selectedId) ?? null : null),
    [events, selectedId],
  );

  const handleExport = useCallback(async () => {
    const filename = `sse-events-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    await saveJsonFile(events, filename);
  }, [events]);

  const formatUptime = (ms: number | null) => {
    if (ms === null) return '—';
    const elapsed = Date.now() - ms;
    const sec = Math.floor(elapsed / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    return `${min}m ${sec % 60}s`;
  };

  return (
    <div className="sse-message-log" data-testid="sse-message-log">
      {/* Toolbar */}
      <div className="sse-toolbar">
        <input
          className="sse-search"
          type="text"
          placeholder="Search events…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          data-testid="sse-search"
        />
        <CustomSelect
          className="sse-type-filter"
          value={eventTypeFilter}
          onChange={setEventTypeFilter}
          options={eventTypes.map((t) => ({
            value: t,
            label: `${t} (${stats.eventTypeCounts[t] || 0})`,
          }))}
          placeholder="All types"
          data-testid="sse-type-filter"
        />
        <button
          className={`sse-toolbar-btn ${showBookmarked ? 'active' : ''}`}
          onClick={() => setShowBookmarked((v) => !v)}
          title={showBookmarked ? 'Show all' : 'Show bookmarked'}
          data-testid="sse-bookmark-filter"
        >
          ★ {bookmarkedIds.size}
        </button>
        <div className="sse-toolbar-spacer" />
        <button className="sse-toolbar-btn" onClick={handleExport} title="Export events as JSON" data-testid="sse-export-btn">
          Export
        </button>
        <button className="sse-toolbar-btn" onClick={onClear} title="Clear all events" data-testid="sse-clear-btn">
          Clear
        </button>
      </div>

      {/* Message list */}
      <div className="sse-list-container" ref={parentRef} data-testid="sse-list-container">
        <div
          style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const event = filteredEvents[virtualRow.index];
            return (
              <div
                key={event.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <SseRow
                  event={event}
                  isSelected={event.id === selectedId}
                  isBookmarked={bookmarkedIds.has(event.id)}
                  onClick={handleRowClick}
                  onToggleBookmark={onToggleBookmark}
                />
              </div>
            );
          })}
        </div>
        {filteredEvents.length === 0 && events.length > 0 && (
          <div className="sse-empty-filtered">
            <span className="sse-empty-icon">🔍</span>
            <span className="sse-empty-title">No Matching Events</span>
            <span className="sse-empty-text">No events match the current filters. Try adjusting your search or type filter.</span>
          </div>
        )}
        {events.length === 0 && (
          <div className="sse-empty">
            <span className="sse-empty-icon">📡</span>
            <span className="sse-empty-title">Waiting for Events</span>
            <span className="sse-empty-text">Connect to an SSE endpoint to start receiving server-sent events in real time.</span>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedEvent && (
        <SseEventDetail event={selectedEvent} onClose={() => setSelectedId(null)} />
      )}

      {/* Status bar */}
      <div className="sse-status-bar" data-testid="sse-status-bar">
        <span>Events: {stats.eventCount}</span>
        <span>Showing: {filteredEvents.length}</span>
        {lastEventId && <span>Last-Event-ID: {lastEventId}</span>}
        <span>Uptime: {formatUptime(uptime)}</span>
        {eventTypes.length > 0 && (
          <span className="sse-status-types">
            Types: {eventTypes.map((t) => `${t}(${stats.eventTypeCounts[t] || 0})`).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
