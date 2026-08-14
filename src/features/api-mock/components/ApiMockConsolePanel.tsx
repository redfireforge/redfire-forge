import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiMockConsoleLine } from '../useApiMockConsole';
import {
  CONSOLE_EVENT_FILTERS,
  classifyConsoleLine,
  countConsoleEvents,
  filterConsoleLines,
  type ApiMockConsoleEventFilter,
} from '../apiMockConsoleView';

interface Props {
  lines: ApiMockConsoleLine[];
  onClear?: () => void;
}

export function ApiMockConsolePanel({ lines, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [event, setEvent] = useState<ApiMockConsoleEventFilter>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const counts = useMemo(() => countConsoleEvents(lines), [lines]);
  const visible = useMemo(() => filterConsoleLines(lines, query, event), [lines, query, event]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (lines.length === 0) {
    return (
      <div className="am-console am-console--empty" data-testid="api-mock-dock-console-empty">
        <div className="am-console-empty-title">No console output yet</div>
        <div className="am-console-empty-hint">
          Start, stop, or apply the mock server. Lifecycle logs stream in here from the running companion.
        </div>
      </div>
    );
  }

  return (
    <div className="am-console" data-testid="api-mock-dock-console">
      <div className="am-console-toolbar">
        <input
          ref={searchRef}
          className="am-input am-console-search"
          placeholder="Search logs…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search console"
          data-testid="api-mock-console-search"
        />
        {query.trim() && (
          <span className="am-console-count" data-testid="api-mock-console-match-count">
            {visible.length} match{visible.length === 1 ? '' : 'es'}
          </span>
        )}
        <div className="am-segmented am-console-filters" role="group" aria-label="Filter console events">
          {CONSOLE_EVENT_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={event === f.id ? 'active' : ''}
              aria-pressed={event === f.id}
              data-testid={`api-mock-console-filter-${f.id}`}
              onClick={() => setEvent(f.id)}
            >
              {f.label}
              {f.id !== 'all' && counts[f.id] > 0 && (
                <span className="am-count-badge">{counts[f.id]}</span>
              )}
            </button>
          ))}
        </div>
        <span className="am-spacer" />
        {onClear && (
          <button type="button" className="am-btn small ghost" onClick={onClear} data-testid="api-mock-console-clear">
            Clear
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="am-console-empty" data-testid="api-mock-console-filter-empty">
          No logs match this search or filter.
        </div>
      ) : (
        <div className="am-console-body" role="log" aria-live="polite">
          {visible.map((line, i) => {
            const kind = classifyConsoleLine(line);
            return (
              <div key={`${line.ts ?? 't'}-${i}`} className={`am-console-line am-console-line--${kind}`}>
                {line.ts && <span className="am-console-ts">{formatTs(line.ts)}</span>}
                {line.level && <span className={`am-console-level am-console-level--${kind}`}>{line.level}</span>}
                <span className="am-console-msg">{line.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
}
