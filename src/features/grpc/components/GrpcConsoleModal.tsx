import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useFloatingPanel } from '@shared/hooks/useFloatingPanel';
import { useModalExpand } from '@shared/hooks/useModalExpand';
import ModalExpandButton from '@shared/components/ModalExpandButton';
import { CustomSelect } from '@shared/components/CustomSelect';

export interface GrpcConsoleWireEvent {
  id: string;
  timestamp: string;
  direction: 'send' | 'recv' | 'event';
  service?: string;
  method?: string;
  summary: string;
  payload?: unknown;
}

export interface GrpcConsoleModalProps {
  events: GrpcConsoleWireEvent[];
  onClearEvents: () => void;
  onClose: () => void;
}

export function GrpcConsoleModal({
  events,
  onClearEvents,
  onClose,
}: GrpcConsoleModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedSelection, setPinnedSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const { expanded, toggleExpand, expandClass } = useModalExpand(false, 'fullscreen');
  const initializedRef = useRef(false);
  const {
    floatPos,
    floatSize,
    setFloatPos,
    onFloatDragStart,
    onFloatResizeStart,
    onRightEdgeResizeStart,
  } = useFloatingPanel({
    floatWidthRatio: 0.52,
    floatHeightRatio: 0.58,
    minFloatLeft: 0,
  });

  useEffect(() => {
    if (initializedRef.current || typeof window === 'undefined') return;
    initializedRef.current = true;
    const margin = 18;
    const launcherOffset = 62;
    const x = Math.max(20, window.innerWidth - floatSize.w - margin);
    const y = Math.max(0, window.innerHeight - floatSize.h - launcherOffset);
    setFloatPos({ x, y });
  }, [floatSize.h, floatSize.w, setFloatPos]);

  const modalStyle = useMemo<CSSProperties>(
    () => {
      if (expanded) {
        return {
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
        };
      }
      return {
        left: floatPos.x,
        top: floatPos.y,
        width: floatSize.w,
        height: floatSize.h,
      };
    },
    [expanded, floatPos.x, floatPos.y, floatSize.h, floatSize.w],
  );

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query
      ? events.filter((entry) => {
        const haystack = [
          entry.summary,
          entry.service,
          entry.method,
          entry.direction,
          entry.timestamp,
          (() => {
            try {
              return JSON.stringify(entry.payload ?? '');
            } catch {
              return '';
            }
          })(),
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      : events;
  }, [events, searchQuery]);

  const visibleEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aTs = Date.parse(a.timestamp);
      const bTs = Date.parse(b.timestamp);
      const delta = (Number.isFinite(aTs) ? aTs : 0) - (Number.isFinite(bTs) ? bTs : 0);
      return sortOrder === 'asc' ? delta : -delta;
    });
  }, [filteredEvents, sortOrder]);

  const liveFeedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aTs = Date.parse(a.timestamp);
      const bTs = Date.parse(b.timestamp);
      const aSafe = Number.isFinite(aTs) ? aTs : 0;
      const bSafe = Number.isFinite(bTs) ? bTs : 0;
      return bSafe - aSafe;
    });
  }, [filteredEvents]);

  useEffect(() => {
    if (visibleEvents.length === 0) {
      setSelectedId(null);
      return;
    }
    if (pinnedSelection && selectedId && visibleEvents.some((entry) => entry.id === selectedId)) {
      return;
    }
    if (!selectedId || !visibleEvents.some((entry) => entry.id === selectedId) || !pinnedSelection) {
      setSelectedId(visibleEvents[0]!.id);
    }
  }, [pinnedSelection, selectedId, visibleEvents]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((entry) => entry.id === selectedId) ?? null,
    [filteredEvents, selectedId],
  );

  return (
    <div
      className={`grpc-console-modal ${expandClass}`.trim()}
      data-testid="grpc-console-modal"
      style={modalStyle}
    >
      <div
        className="grpc-console-modal__header"
        data-testid="grpc-console-modal-header"
        onMouseDown={expanded ? undefined : onFloatDragStart}
      >
        <span className="grpc-console-modal__title">Console</span>
        <span className="grpc-console-modal__count">
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
        <div className="grpc-console-modal__actions">
          <ModalExpandButton expanded={expanded} onToggle={toggleExpand} />
          <button
            type="button"
            className="grpc-btn grpc-btn--ghost grpc-btn--xs"
            data-testid="grpc-console-modal-clear"
            onClick={onClearEvents}
            disabled={events.length === 0}
            title="Clear live console events"
          >
            Clear
          </button>
          <button
            type="button"
            className="grpc-btn grpc-btn--ghost grpc-btn--xs"
            data-testid="grpc-console-modal-close"
            onClick={onClose}
            title="Close console"
          >
            Close
          </button>
        </div>
      </div>
      <div className="grpc-console-modal__body">
        <div className="grpc-console-wire-layout" data-testid="grpc-console-wire-panel">
          <aside className="grpc-console-wire-sidebar">
            <div className="grpc-console-wire-controls">
              <input
                type="search"
                className="grpc-console-wire-controls__search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search events..."
                aria-label="Search console events"
                data-testid="grpc-console-search"
              />
              <CustomSelect
                className="grpc-console-wire-controls__sort"
                value={sortOrder}
                onChange={(v) => setSortOrder(v as 'asc' | 'desc')}
                aria-label="Sort console events by time"
                data-testid="grpc-console-sort-order"
                options={[
                  { value: 'desc', label: 'Time: Desc' },
                  { value: 'asc', label: 'Time: Asc' },
                ]}
              />
            </div>
            <div className="grpc-console-wire-list" data-testid="grpc-console-wire-list">
            {visibleEvents.length === 0 ? (
              <p className="grpc-console-list__empty" data-testid="grpc-console-wire-empty">
                {events.length === 0
                  ? 'Open Console, then run calls to capture raw send/receive events in real time.'
                  : 'No events match your current search filter.'}
              </p>
            ) : (
              visibleEvents.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`grpc-console-wire-row${selectedId === entry.id ? ' grpc-console-wire-row--active' : ''}`}
                  data-testid={`grpc-console-wire-row-${entry.id}`}
                  onClick={() => {
                    setPinnedSelection(true);
                    setSelectedId(entry.id);
                  }}
                >
                  <span className={`grpc-console-wire-row__dir grpc-console-wire-row__dir--${entry.direction}`}>
                    {entry.direction.toUpperCase()}
                  </span>
                  <span className="grpc-console-wire-row__summary">{entry.summary}</span>
                  <span className="grpc-console-wire-row__meta">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                    {entry.service && entry.method ? ` · ${entry.service}/${entry.method}` : ''}
                  </span>
                </button>
              ))
            )}
            </div>
          </aside>
          <section className="grpc-console-wire-detail" data-testid="grpc-console-wire-detail">
            {!pinnedSelection ? (
              <>
                <header className="grpc-console-detail__header">
                  <div>
                    <h2 className="grpc-console-detail__title">Live Log (Auto-follow)</h2>
                    <p className="grpc-console-detail__subtitle">
                      Newest first (Desc). Click a row on the left to pause and inspect a single event.
                    </p>
                  </div>
                </header>
                <div className="grpc-console-detail__body">
                  {liveFeedEvents.length === 0 ? (
                    <p className="grpc-console-detail__empty" data-testid="grpc-console-wire-live-empty">
                      No live events yet. Keep Console open and run a call to see incoming logs.
                    </p>
                  ) : (
                    <div className="grpc-console-wire-live-feed" data-testid="grpc-console-wire-live-feed">
                      {liveFeedEvents.map((entry) => (
                        <div key={entry.id} className="grpc-console-wire-live-item" data-testid={`grpc-console-wire-live-${entry.id}`}>
                          <div className="grpc-console-wire-live-item__head">
                            <span className={`grpc-console-wire-row__dir grpc-console-wire-row__dir--${entry.direction}`}>
                              {entry.direction.toUpperCase()}
                            </span>
                            <strong className="grpc-console-wire-live-item__summary">{entry.summary}</strong>
                            <span className="grpc-console-wire-live-item__meta">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <pre className="grpc-info-card__pre grpc-console-wire-live-item__payload">
                            {JSON.stringify(entry.payload ?? null, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : !selectedEvent ? (
              <p className="grpc-console-detail__empty" data-testid="grpc-console-wire-detail-empty">
                Select an event to inspect raw payload/metadata for troubleshooting.
              </p>
            ) : (
              <>
                <header className="grpc-console-detail__header">
                  <div>
                    <h2 className="grpc-console-detail__title">{selectedEvent.summary}</h2>
                    <p className="grpc-console-detail__subtitle">
                      {selectedEvent.direction.toUpperCase()} · {new Date(selectedEvent.timestamp).toLocaleString()}
                      {selectedEvent.service && selectedEvent.method
                        ? ` · ${selectedEvent.service}/${selectedEvent.method}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="grpc-btn grpc-btn--ghost grpc-btn--xs"
                    data-testid="grpc-console-back-to-live"
                    onClick={() => setPinnedSelection(false)}
                    title="Return to auto-follow live log"
                  >
                    Back to Live
                  </button>
                </header>
                <div className="grpc-console-detail__body">
                  <div className="grpc-info-card">
                    <div className="grpc-info-card__header">Raw payload</div>
                    <pre className="grpc-info-card__pre">
                      {JSON.stringify(selectedEvent.payload ?? null, null, 2)}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
      {!expanded && (
        <>
          <div
            className="grpc-console-modal__edge-right"
            onMouseDown={onRightEdgeResizeStart}
          />
          <div
            className="grpc-console-modal__grip"
            onMouseDown={onFloatResizeStart}
          />
        </>
      )}
    </div>
  );
}