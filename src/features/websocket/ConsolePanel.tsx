/**
 * Phase 9 — shared Console panel (WS + SSE). Renders a structured severity log
 * (default) and a Raw curl-verbose timeline toggle over the SAME entries.
 *
 * Phase 10 — an optional command line (`.ws-console-cmd`) renders at the bottom
 * when `onCommand` is provided. It owns its input + ↑↓ history (UI-only); the
 * parse/dispatch logic lives in `useConsoleCommands`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  WsConsoleCategoryFilter,
  WsConsoleEntry,
  WsConsoleLevelFilter,
  WsConsoleSettings,
  WsConsoleView,
} from './wsConsoleTypes';
import {
  WS_CONSOLE_CATEGORIES,
  WS_CONSOLE_CATEGORY_LABELS,
} from './wsConsoleTypes';
import {
  consoleEntriesToText,
  filterConsoleEntries,
  formatConsoleTime,
  parseRawConsoleLines,
} from './wsConsoleEntries';
import { navigateHistory } from './wsConsoleCommands';
import { saveFile } from '../../shared/utils/fileSaver';
import '../../styles/console-panel.css';

export interface ConsolePanelProps {
  entries: WsConsoleEntry[];
  settings: WsConsoleSettings;
  onSettingsChange: (next: WsConsoleSettings) => void;
  onClear: () => void;
  /** Used for test ids and export filenames, e.g. `ws` / `sse`. */
  variant: string;
  /**
   * Phase 10 — when provided, renders the bottom command line and invokes this
   * with each submitted (non-empty, trimmed) command. Omit to hide the line.
   */
  onCommand?: (input: string) => void;
  /** Hint text shown beside the command prompt (e.g. from `buildCommandHint`). */
  commandHint?: string;
}

const LEVEL_SEGMENTS: { value: WsConsoleLevelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
];

const LEVEL_BADGE_LABELS: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERR',
  debug: 'DBG',
};

export function ConsolePanel(props: ConsolePanelProps): React.ReactElement {
  const { entries, settings, onSettingsChange, onClear, variant, onCommand, commandHint } = props;
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterConsoleEntries(entries, settings, search),
    [entries, settings, search],
  );

  // Auto-scroll to bottom on new entries when enabled.
  useEffect(() => {
    if (!settings.autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length, settings.autoScroll]);

  const patch = useCallback(
    (p: Partial<WsConsoleSettings>) => onSettingsChange({ ...settings, ...p }),
    [onSettingsChange, settings],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCopy = useCallback(() => {
    const text = consoleEntriesToText(filtered);
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(text);
  }, [filtered]);

  const handleExport = useCallback(() => {
    const text = consoleEntriesToText(filtered);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    void saveFile(new Blob([text], { type: 'text/plain;charset=utf-8' }), {
      filename: `${variant}-console-${stamp}.log`,
      mimeType: 'text/plain',
      description: 'Console log',
    });
  }, [filtered, variant]);

  const setView = (view: WsConsoleView) => patch({ view });
  const isRaw = settings.view === 'raw';

  return (
    <div className="ws-console" data-testid={`${variant}-console`}>
      <div className="ws-console-toolbar">
        <div className="ws-console-seg" role="group" aria-label="View">
          {(['structured', 'raw'] as WsConsoleView[]).map((v) => (
            <button
              key={v}
              type="button"
              className={settings.view === v ? 'active' : ''}
              onClick={() => setView(v)}
              data-testid={`${variant}-console-view-${v}`}
            >
              {v === 'structured' ? 'Structured' : 'Raw'}
            </button>
          ))}
        </div>

        <div className="ws-console-seg" role="group" aria-label="Severity">
          {LEVEL_SEGMENTS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={settings.levelFilter === s.value ? 'active' : ''}
              onClick={() => patch({ levelFilter: s.value })}
              data-testid={`${variant}-console-level-${s.value}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <select
          className="ws-console-category-filter"
          value={settings.categoryFilter}
          onChange={(e) =>
            patch({ categoryFilter: e.target.value as WsConsoleCategoryFilter })
          }
          aria-label="Category"
          data-testid={`${variant}-console-category`}
        >
          <option value="all">All categories</option>
          {WS_CONSOLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {WS_CONSOLE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        <input
          className="ws-console-search"
          placeholder="Search console…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          spellCheck={false}
          data-testid={`${variant}-console-search`}
        />
        <span className="ws-console-count" data-testid={`${variant}-console-count`}>
          {filtered.length}/{entries.length}
        </span>

        <span className="ws-console-spacer" />

        <button
          type="button"
          className={`ws-console-btn${settings.autoScroll ? ' active' : ''}`}
          onClick={() => patch({ autoScroll: !settings.autoScroll })}
          data-testid={`${variant}-console-autoscroll`}
        >
          Auto-scroll {settings.autoScroll ? '✓' : ''}
        </button>
        <button
          type="button"
          className="ws-console-btn"
          onClick={handleCopy}
          disabled={filtered.length === 0}
        >
          Copy
        </button>
        <button
          type="button"
          className="ws-console-btn"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          Export
        </button>
        <button
          type="button"
          className="ws-console-btn"
          onClick={onClear}
          disabled={entries.length === 0}
          data-testid={`${variant}-console-clear`}
        >
          Clear
        </button>
      </div>

      <div className="ws-console-body" ref={scrollRef}>
        {filtered.length === 0 ? (
          <div className="ws-console-empty" data-testid={`${variant}-console-empty`}>
            <span className="ws-console-empty-icon">{entries.length === 0 ? '📋' : '🔍'}</span>
            <span className="ws-console-empty-title">
              {entries.length === 0 ? 'No Console Activity' : 'No Matching Entries'}
            </span>
            <span className="ws-console-empty-text">
              {entries.length === 0
                ? 'Connect to start logging lifecycle events, protocol frames, and system messages.'
                : 'No entries match the current filters. Try adjusting severity, category, or search text.'}
            </span>
          </div>
        ) : isRaw ? (
          <RawView entries={filtered} />
        ) : (
          <StructuredView
            entries={filtered}
            expandedIds={expandedIds}
            onToggle={toggleExpanded}
          />
        )}
      </div>

      {onCommand && (
        <CommandLine variant={variant} hint={commandHint} onCommand={onCommand} />
      )}
    </div>
  );
}

function CommandLine(props: {
  variant: string;
  hint?: string;
  onCommand: (input: string) => void;
}): React.ReactElement {
  const { variant, hint, onCommand } = props;
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  // null = the live (editable) line; a number = recalling history[index].
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onCommand(trimmed);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(null);
    setValue('');
  }, [value, onCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (history.length === 0) return;
        e.preventDefault();
        const dir = e.key === 'ArrowUp' ? 'up' : 'down';
        const next = navigateHistory(dir, historyIdx, history.length);
        setHistoryIdx(next);
        setValue(next === null ? '' : history[next]);
      }
    },
    [submit, history, historyIdx],
  );

  return (
    <div className="ws-console-cmd" data-testid={`${variant}-console-cmd`}>
      <span className="ws-console-prompt" aria-hidden="true">
        ›
      </span>
      <input
        className="ws-console-cmd-input"
        type="text"
        value={value}
        placeholder="Type a command, e.g. /help"
        spellCheck={false}
        autoComplete="off"
        aria-label="Console command line"
        onChange={(e) => {
          setValue(e.target.value);
          setHistoryIdx(null);
        }}
        onKeyDown={handleKeyDown}
        data-testid={`${variant}-console-cmd-input`}
      />
      {hint && <span className="ws-console-cmd-hint">{hint}</span>}
    </div>
  );
}

function StructuredView(props: {
  entries: WsConsoleEntry[];
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
}): React.ReactElement {
  const { entries, expandedIds, onToggle } = props;
  return (
    <div className="ws-console-list">
      {entries.map((e) => {
        const hasDetail = !!e.detail;
        const expanded = expandedIds.has(e.id);
        return (
          <div key={e.id} className="ws-console-row-group">
            <div
              className={`ws-console-row ws-console-${e.level}${
                hasDetail ? ' ws-console-expandable' : ''
              }${expanded ? ' ws-console-expanded' : ''}`}
              onClick={hasDetail ? () => onToggle(e.id) : undefined}
              role={hasDetail ? 'button' : undefined}
              tabIndex={hasDetail ? 0 : undefined}
              onKeyDown={
                hasDetail
                  ? (ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        onToggle(e.id);
                      }
                    }
                  : undefined
              }
              data-testid={`ws-console-entry-${e.id}`}
            >
              <span className="ws-console-time">{formatConsoleTime(e.timestamp)}</span>
              <span className={`ws-console-level-badge ws-console-level-${e.level}`}>
                {LEVEL_BADGE_LABELS[e.level] ?? e.level.toUpperCase()}
              </span>
              <span className="ws-console-cat">{e.category}</span>
              <span className="ws-console-msg">{e.message}</span>
              {hasDetail && (
                <span className="ws-console-chev">{expanded ? '⌄' : '›'}</span>
              )}
            </div>
            {hasDetail && expanded && (
              <pre className="ws-console-detail">{e.detail}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RawView(props: { entries: WsConsoleEntry[] }): React.ReactElement {
  const { entries } = props;
  return (
    <div className="ws-console-list ws-console-raw">
      {entries.map((e) => {
        const lines = parseRawConsoleLines(e);
        const time = formatConsoleTime(e.timestamp);
        return lines.map((line, idx) => (
          <div
            key={`${e.id}-${idx}`}
            className={`ws-console-raw-row ws-console-raw-${line.kind}${
              idx > 0 ? ' ws-console-raw-grouped' : ''
            }`}
          >
            <span className="ws-console-raw-pfx">{line.glyph}</span>
            <span className="ws-console-time">{idx === 0 ? time : ''}</span>
            <span className="ws-console-msg">{line.text}</span>
          </div>
        ));
      })}
    </div>
  );
}
