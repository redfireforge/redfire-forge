/**
 * GraphqlSubscriptionLog — Live subscription message stream component.
 *
 * Phase 2.0 Sprint 2: central log for all subscription transports (WS modern, legacy, SSE).
 *
 * Layout:
 *   ┌─ stats bar ──────────────────────────────────────────────────────────────┐
 *   │ ● Live  17 msgs  2 errors  3.4 msg/s  00:02:14                           │
 *   ├─ toolbar ────────────────────────────────────────────────────────────────┤
 *   │ [Pause] [Clear] [Export ↓] [Filter ▼]                                   │
 *   ├─ filter bar (hidden by default) ────────────────────────────────────────┤
 *   │ 🔍 Filter… [Text ▾]  Showing 4/17                                        │
 *   ├─ message list ───────────────────────────────────────────────────────────┤
 *   │ #1  IN  +0.12s  { "order": { "status": "PENDING" } }    ▼               │
 *   │ #2  IN  +3.40s  { "order": { "status": "SHIPPED" } }    ▼               │
 *   └──────────────────────────────────────────────────────────────────────────┘
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphqlSubscriptionAssertion, GraphqlSubscriptionMessage, SubscriptionState, SubscriptionStats } from '../../../shared/types/graphql';
import { getByPath } from '../../../shared/utils/jsonPath';
import type { MessageAssertionResults } from '../utils/subscriptionAssertions';
import { aggregateAssertionResults } from '../utils/subscriptionAssertions';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GraphqlSubscriptionLogProps {
  state: SubscriptionState;
  messages: GraphqlSubscriptionMessage[];
  stats: SubscriptionStats;
  /** Unix ms when subscribe() was called — used for accurate live duration display. */
  connectedSince?: number;
  isPaused: boolean;
  pausedBufferCount: number;
  errorMessage?: string | null;
  reconnectAttempt?: number;
  transport?: 'graphql-transport-ws' | 'graphql-ws' | 'sse' | null;
  operationName?: string;
  /** Sprint 8 (2C-5): Assertions to evaluate against each message. */
  assertions?: GraphqlSubscriptionAssertion[];
  /** Sprint 8 (2C-5): Pre-computed assertion results keyed by message ID. */
  assertionResultMap?: Map<string, MessageAssertionResults>;
  onPause(): void;
  onResume(): void;
  onClear(): void;
  onExport(): void;
  onStop(): void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatOffset(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  const s = (ms / 1000).toFixed(2);
  return `+${s}s`;
}

function truncateJson(obj: unknown, maxLen = 120): string {
  const s = JSON.stringify(obj, null, 0);
  return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
}

// ─── Message row ──────────────────────────────────────────────────────────────

interface MessageRowProps {
  message: GraphqlSubscriptionMessage;
  assertionResult?: MessageAssertionResults;
}

function MessageRow({ message, assertionResult }: MessageRowProps) {
  const [expanded, setExpanded] = useState(false);
  const prettyBody = JSON.stringify(message.data, null, 2);
  const snippet = truncateJson(message.data);
  const hasErrors = !!(message.errors?.length);

  // Assertion badge: compact pass/fail summary
  const assertionBadge = useMemo(() => {
    if (!assertionResult || assertionResult.total === 0) return null;
    const allPass = assertionResult.passCount === assertionResult.total;
    const label = `${assertionResult.passCount}/${assertionResult.total}`;
    return (
      <span
        className={`gql-assert-badge${allPass ? ' gql-assert-badge--pass' : ' gql-assert-badge--fail'}`}
        title={allPass
          ? `All ${assertionResult.total} assertion${assertionResult.total !== 1 ? 's' : ''} passed`
          : `${assertionResult.passCount}/${assertionResult.total} assertions passed`}
        aria-label={`${label} assertions ${allPass ? 'passed' : 'failed'}`}
        data-testid="gql-assertion-badge"
      >
        {allPass ? '✓' : '✗'} {label}
      </span>
    );
  }, [assertionResult]);

  return (
    <div
      className={`gql-sub-row${hasErrors ? ' gql-sub-row--error' : ''}`}
      data-testid="gql-sub-row"
    >
      <span className="gql-sub-row-idx">#{message.index}</span>

      <span className={`gql-sub-direction gql-sub-direction--${message.direction}`}>
        {message.direction.toUpperCase()}
      </span>

      <span className="gql-sub-row-offset">{formatOffset(message.offsetMs)}</span>

      {hasErrors && (
        <span className="gql-sub-row-error-badge" title={message.errors!.map((e) => e.message).join('; ')}>
          ERR
        </span>
      )}

      {assertionBadge}

      <button
        type="button"
        className={`gql-sub-row-body${expanded ? ' gql-sub-row-body--expanded' : ''}`}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse message' : 'Expand message'}
      >
        {expanded ? (
          <pre className="gql-sub-row-json">{prettyBody}</pre>
        ) : (
          <span className="gql-sub-row-snippet">{snippet}</span>
        )}
        <span className="gql-sub-row-chevron" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GraphqlSubscriptionLog({
  state,
  messages,
  stats,
  connectedSince = 0,
  isPaused,
  pausedBufferCount,
  errorMessage,
  reconnectAttempt = 0,
  transport,
  operationName,
  assertions = [],
  assertionResultMap,
  onPause,
  onResume,
  onClear,
  onExport,
  onStop,
}: GraphqlSubscriptionLogProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterMode, setFilterMode] = useState<'text' | 'jsonpath'>('text');
  const listRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive (unless paused)
  useEffect(() => {
    if (!isPaused && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isPaused]);

  // Focus filter input when filter bar opens
  useEffect(() => {
    if (filterOpen) filterRef.current?.focus();
  }, [filterOpen]);

  // Rolling duration stopwatch (updates every second while connecting, active, or reconnecting).
  // 'connecting' is included so the elapsed time is live during slow connection establishment,
  // not frozen at the moment subscribe() was called.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (state !== 'active' && state !== 'reconnecting' && state !== 'connecting') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  // Live connected duration: computed from connectedSince on each tick for accuracy.
  // stats.connectedDurationMs only updates when messages arrive, so we compute
  // the live value from the wall clock when the subscription is still running.
  const liveDurationMs = useMemo(() => {
    if (state === 'active' || state === 'reconnecting' || state === 'connecting') {
      return connectedSince > 0 ? Date.now() - connectedSince : stats.connectedDurationMs;
    }
    return stats.connectedDurationMs;
  // tick intentionally included: re-computes every second while active
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, connectedSince, stats.connectedDurationMs, tick]);

  // Filtered messages — text mode: substring on JSON body; jsonpath mode: path/comparison evaluation
  const visibleMessages = useMemo(() => {
    if (!filterText.trim()) return messages;
    if (filterMode === 'text') {
      const q = filterText.toLowerCase();
      return messages.filter((m) => JSON.stringify(m.data, null, 0).toLowerCase().includes(q));
    }
    // JSONPath mode: evaluate expression against message data
    // Supports: path existence (`$.order.id`), comparison (`$.order.status == "SHIPPED"`),
    //           numeric (`$.total > 0`).
    const expr = filterText.trim();
    const compMatch = expr.match(/^(.+?)\s*(===?|!==?|>=?|<=?)\s*(.+)$/);
    return messages.filter((m) => {
      try {
        if (compMatch) {
          const [, pathStr, op, rhsRaw] = compMatch;
          const lhs = getByPath(m.data, pathStr.trim());
          let rhs: unknown;
          try { rhs = JSON.parse(rhsRaw.trim()); } catch { rhs = rhsRaw.trim(); }
          switch (op) {
            case '===': return lhs === rhs;
            case '!==': return lhs !== rhs;
            case '==':  return lhs == rhs;  // intentional loose equality for JSON comparison
            case '!=':  return lhs != rhs; // intentional loose inequality for JSON comparison
            case '>':  return typeof lhs === 'number' && lhs > Number(rhs);
            case '>=': return typeof lhs === 'number' && lhs >= Number(rhs);
            case '<':  return typeof lhs === 'number' && lhs < Number(rhs);
            case '<=': return typeof lhs === 'number' && lhs <= Number(rhs);
            default:   return false;
          }
        }
        const result = getByPath(m.data, expr);
        return result !== null && result !== undefined && result !== false && result !== '';
      } catch {
        return false;
      }
    });
  }, [messages, filterText, filterMode]);

  const hiddenCount = messages.length - visibleMessages.length;

  // ── State badge ────────────────────────────────────────────────────────────

  const stateBadge = useMemo(() => {
    switch (state) {
      case 'connecting':
        return <span className="gql-sub-state gql-sub-state--connecting" data-testid="gql-sub-state">Connecting…</span>;
      case 'active':
        return <span className="gql-sub-state gql-sub-state--active" data-testid="gql-sub-state">● Live</span>;
      case 'reconnecting':
        return (
          <span className="gql-sub-state gql-sub-state--reconnecting" data-testid="gql-sub-state">
            ↻ Reconnecting ({reconnectAttempt}/5)…
          </span>
        );
      case 'error':
        return <span className="gql-sub-state gql-sub-state--error" data-testid="gql-sub-state">● Error</span>;
      case 'closing':
        return <span className="gql-sub-state gql-sub-state--closing" data-testid="gql-sub-state">Closing…</span>;
      case 'closed':
        return (
          <span className="gql-sub-state gql-sub-state--closed" data-testid="gql-sub-state">
            Completed ({messages.length} events)
          </span>
        );
      default:
        return null;
    }
  }, [state, reconnectAttempt, messages.length]);

  const isTerminal = state === 'error' || state === 'closed';
  const isLive = state === 'active' || state === 'reconnecting' || state === 'connecting';

  // ── Assertion aggregate ─────────────────────────────────────────────────────

  const assertionAggregate = useMemo(() => {
    if (!assertionResultMap || assertions.length === 0) return null;
    // Use visibleMessages when filtered so aggregate matches what user sees
    const relevantMessages = filterText.trim() ? visibleMessages : messages;
    const filteredMap = new Map(
      relevantMessages
        .map((m) => assertionResultMap.get(m.id))
        .filter((r): r is MessageAssertionResults => r !== undefined)
        .map((r) => [r.messageId, r]),
    );
    return aggregateAssertionResults(filteredMap);
  }, [assertionResultMap, assertions.length, visibleMessages, messages, filterText]);

  // ── Transport badge ────────────────────────────────────────────────────────

  const transportLabel = transport === 'graphql-ws' ? 'WS legacy' :
                         transport === 'sse'         ? 'SSE'       :
                                                       'WS';
  const transportBadgeVariant = transport === 'sse'        ? ' gql-sub-transport-badge--sse' :
                                 transport === 'graphql-ws' ? ' gql-sub-transport-badge--legacy' :
                                                               '';
  const transportTitle = transport === 'graphql-transport-ws' ? 'WebSocket — graphql-transport-ws (modern subprotocol)' :
                         transport === 'graphql-ws'            ? 'WebSocket — graphql-ws (legacy subprotocol)' :
                         transport === 'sse'                   ? 'Server-Sent Events — graphql-sse' :
                                                                  'Transport: unknown';

  return (
    <div className="gql-sub-log" data-testid="gql-sub-log">

      {/* Stats bar */}
      <div className="gql-sub-stats-bar" data-testid="gql-sub-stats-bar">
        <div className="gql-sub-stats-left">
          {stateBadge}
          {operationName && (
            <span className="gql-sub-operation-name" title={operationName}>{operationName}</span>
          )}
          <span className={`gql-sub-transport-badge${transportBadgeVariant}`} title={transportTitle}>
            {transportLabel}
          </span>
        </div>
        <div className="gql-sub-stats-right">
          <span className="gql-sub-stat" title="Total messages received">
            <strong>{stats.totalMessages}</strong> msgs
          </span>
          {stats.errorCount > 0 && (
            <span className="gql-sub-stat gql-sub-stat--error" title="Messages with errors">
              <strong>{stats.errorCount}</strong> err
            </span>
          )}
          <span className="gql-sub-stat" title="Rolling 5-second messages/sec">
            <strong>{stats.msgsPerSec.toFixed(1)}</strong>/s
          </span>
          <span className="gql-sub-stat gql-sub-stat--duration" title="Connected duration">
            {formatDuration(liveDurationMs)}
          </span>
          {assertionAggregate && assertionAggregate.totalMessages > 0 && (
            <span
              className={`gql-sub-stat gql-sub-assertion-agg${assertionAggregate.messagesAllPass === assertionAggregate.totalMessages ? ' gql-sub-assertion-agg--pass' : ' gql-sub-assertion-agg--fail'}`}
              title={`Assertion results across ${assertionAggregate.totalMessages} message${assertionAggregate.totalMessages !== 1 ? 's' : ''}: ${assertionAggregate.totalPassed}/${assertionAggregate.totalRuns} passed`}
              data-testid="gql-assertion-aggregate"
            >
              {assertionAggregate.messagesAllPass === assertionAggregate.totalMessages ? '✓' : '✗'}
              {' '}{assertionAggregate.messagesAllPass}/{assertionAggregate.totalMessages} msgs
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {state === 'error' && errorMessage && (
        <div className="gql-sub-error-banner" data-testid="gql-sub-error-banner" role="alert">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="gql-sub-toolbar" data-testid="gql-sub-toolbar">
        {isLive && (
          isPaused ? (
            <button
              type="button"
              className="gql-sub-toolbar-btn gql-sub-toolbar-btn--resume"
              onClick={onResume}
              data-testid="gql-sub-resume-btn"
              title={`Resume — ${pausedBufferCount} buffered message${pausedBufferCount !== 1 ? 's' : ''}`}
              aria-label={`Resume (${pausedBufferCount} buffered)`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Resume
              {pausedBufferCount > 0 && (
                <span className="gql-sub-pause-badge">{pausedBufferCount}</span>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="gql-sub-toolbar-btn gql-sub-toolbar-btn--pause"
              onClick={onPause}
              data-testid="gql-sub-pause-btn"
              title="Pause — buffer incoming messages without displaying them"
              aria-label="Pause"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              Pause
            </button>
          )
        )}

        <button
          type="button"
          className="gql-sub-toolbar-btn"
          onClick={onClear}
          data-testid="gql-sub-clear-btn"
          title="Clear message log (connection stays active)"
          aria-label="Clear"
          disabled={messages.length === 0}
        >
          Clear
        </button>

        <button
          type="button"
          className="gql-sub-toolbar-btn"
          onClick={onExport}
          data-testid="gql-sub-export-btn"
          title="Download all messages as JSON"
          aria-label="Export JSON"
          disabled={messages.length === 0}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>

        <button
          type="button"
          className={`gql-sub-toolbar-btn${filterOpen ? ' gql-sub-toolbar-btn--active' : ''}`}
          onClick={() => {
            const next = !filterOpen;
            setFilterOpen(next);
            if (!next) { setFilterText(''); setFilterMode('text'); }
          }}
          data-testid="gql-sub-filter-btn"
          title={filterOpen ? 'Close filter' : 'Filter messages'}
          aria-expanded={filterOpen}
          aria-label="Filter messages"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filter
          {filterText && <span className="gql-sub-filter-dot" aria-hidden="true" />}
        </button>

        {/* Stop / Reconnect button (right-aligned) */}
        {isLive && (
          <button
            type="button"
            className="gql-sub-toolbar-btn gql-sub-toolbar-btn--stop"
            onClick={onStop}
            data-testid="gql-sub-stop-btn"
            title="Stop subscription"
            aria-label="Stop subscription"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            Stop
          </button>
        )}

        {isTerminal && (
          <span className="gql-sub-toolbar-status">
            {state === 'error' ? 'Subscription failed' : `${messages.length} events logged`}
          </span>
        )}
      </div>

      {/* Filter bar */}
      {filterOpen && (
        <div className="gql-sub-filter-bar" data-testid="gql-sub-filter-bar" role="search">
          {/* Mode toggle: Text / JSONPath */}
          <div className="gql-sub-filter-mode" role="group" aria-label="Filter mode">
            <button
              type="button"
              className={`gql-sub-filter-mode-btn${filterMode === 'text' ? ' gql-sub-filter-mode-btn--active' : ''}`}
              onClick={() => { setFilterMode('text'); setFilterText(''); filterRef.current?.focus(); }}
              data-testid="gql-sub-filter-mode-text"
              title="Text mode — substring match across JSON message body"
              aria-pressed={filterMode === 'text'}
            >
              Text
            </button>
            <button
              type="button"
              className={`gql-sub-filter-mode-btn${filterMode === 'jsonpath' ? ' gql-sub-filter-mode-btn--active' : ''}`}
              onClick={() => { setFilterMode('jsonpath'); setFilterText(''); filterRef.current?.focus(); }}
              data-testid="gql-sub-filter-mode-jsonpath"
              title="JSONPath mode — path existence ($.order.id) or comparison ($.status == &quot;SHIPPED&quot;)"
              aria-pressed={filterMode === 'jsonpath'}
            >
              JSONPath
            </button>
          </div>

          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={filterRef}
            type="text"
            className={`gql-sub-filter-input${filterMode === 'jsonpath' ? ' gql-sub-filter-input--jsonpath' : ''}`}
            placeholder={
              filterMode === 'jsonpath'
                ? 'JSONPath: $.order.status == "SHIPPED" or $.total > 0'
                : 'Text search across message body…'
            }
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setFilterOpen(false); setFilterText(''); setFilterMode('text'); } }}
            data-testid="gql-sub-filter-input"
            aria-label={filterMode === 'jsonpath' ? 'JSONPath filter expression' : 'Filter messages text'}
            spellCheck={false}
            autoComplete="off"
          />
          {filterText && (
            <button
              type="button"
              className="gql-sub-filter-clear"
              onClick={() => { setFilterText(''); filterRef.current?.focus(); }}
              aria-label="Clear filter"
              data-testid="gql-sub-filter-clear"
              title="Clear filter (Esc)"
            >
              ×
            </button>
          )}
          {filterText && (
            <span className="gql-sub-filter-count" data-testid="gql-sub-filter-count">
              {hiddenCount === 0
                ? `All ${messages.length} match`
                : `Showing ${visibleMessages.length}/${messages.length}`}
            </span>
          )}
        </div>
      )}

      {/* Message list */}
      <div
        ref={listRef}
        className="gql-sub-message-list"
        data-testid="gql-sub-message-list"
        aria-label="Subscription messages"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.length === 0 && (state === 'connecting' || state === 'active' || state === 'reconnecting') && (
          <div className="gql-sub-empty-hint" data-testid="gql-sub-empty-hint">
            <div className="gql-sub-empty-spinner" aria-hidden="true" />
            <span>Waiting for messages…</span>
          </div>
        )}

        {messages.length === 0 && state === 'closed' && (
          <div className="gql-sub-empty-hint" data-testid="gql-sub-empty-hint">
            <span>Subscription completed with no messages.</span>
          </div>
        )}

        {messages.length === 0 && state === 'error' && (
          <div className="gql-sub-empty-hint" data-testid="gql-sub-empty-hint">
            <span>No messages were received before the error.</span>
          </div>
        )}

        {visibleMessages.map((msg) => (
          <MessageRow
            key={msg.id}
            message={msg}
            assertionResult={assertionResultMap?.get(msg.id)}
          />
        ))}

        {/* Buffer-capped warning */}
        {messages.length >= 5000 && (
          <div className="gql-sub-buffer-warn" data-testid="gql-sub-buffer-warn" role="status">
            ⚠ Buffer capped at 5,000 messages — oldest removed
          </div>
        )}
      </div>
    </div>
  );
}
