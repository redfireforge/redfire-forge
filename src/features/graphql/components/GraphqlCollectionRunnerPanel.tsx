/**
 * GraphqlCollectionRunnerPanel — Phase 3A (task 3A-9), Phase 3B console (task 3B-3)
 *
 * Shows in the bottom panel area when a Collection Runner session is active.
 * Displays a mini results table with item name, status, latency, test pass/fail.
 * Phase 3B: adds a "Console" tab showing script log output (rf.log/warn/error).
 * Controls: Pause/Resume, Abort, Export results as JSON.
 */

import { useCallback, useMemo, useState } from 'react';
import type { CollectionRunEvent, GraphqlCollectionItem } from '../../../shared/types/graphql';
import type { UseGraphqlCollectionRunnerResult } from '../hooks/useGraphqlCollectionRunner';
import { saveJsonFile } from '../../../shared/utils/fileSaver';
import {
  buildRunnerConsoleEntries,
  buildRunnerExportPayload,
  isRunnerResultEvent,
  runnerExportFilename,
} from '../utils/runnerPanelUtils';

export interface GraphqlCollectionRunnerPanelProps {
  runner: UseGraphqlCollectionRunnerResult;
  items: GraphqlCollectionItem[];
  collectionName: string;
  /** Called when the user closes/dismisses the runner panel */
  onClose?: () => void;
}

function RunnerCloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 2.5l7 7M9.5 2.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GraphqlCollectionRunnerPanel({
  runner,
  items,
  collectionName,
  onClose,
}: GraphqlCollectionRunnerPanelProps) {
  const { state, pause, resume, abort } = runner;
  const [activeTab, setActiveTab] = useState<'results' | 'console'>('results');
  const [clearBefore, setClearBefore] = useState<number>(0);
  const [exporting, setExporting] = useState(false);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const itemNameById = useMemo(
    () => new Map(items.map((i) => [i.id, i.name])),
    [items],
  );

  const resultEvents = useMemo(
    () => state.events.filter(isRunnerResultEvent),
    [state.events],
  );

  const passCount = resultEvents.filter((e) => e.type === 'result').length;
  const failCount = resultEvents.filter((e) => e.type === 'error').length;
  const skipCount = resultEvents.filter((e) => e.type === 'skip').length;

  const allLogs = useMemo(
    () => buildRunnerConsoleEntries(state.events, itemNameById),
    [state.events, itemNameById],
  );
  const visibleLogs = clearBefore > 0 ? allLogs.filter((l) => l.timestamp > clearBefore) : allLogs;
  const logCount = visibleLogs.length;

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const payload = buildRunnerExportPayload(collectionName, state.events);
      await saveJsonFile(payload, runnerExportFilename(collectionName));
    } catch {
      // User cancelled the save dialog — no action needed.
    } finally {
      setExporting(false);
    }
  }, [collectionName, state.events]);

  const statusBadge = state.running
    ? { label: 'Running', className: 'gql-runner-status-badge--running' }
    : state.aborted
      ? { label: 'Aborted', className: 'gql-runner-status-badge--aborted' }
      : resultEvents.length > 0
        ? { label: 'Complete', className: 'gql-runner-status-badge--complete' }
        : null;

  return (
    <div className="gql-runner-panel" data-testid="gql-runner-panel">
      {/* Header */}
      <div className="gql-runner-header">
        <div className="gql-runner-header-main">
          <span className="gql-runner-title" data-testid="gql-runner-title">{collectionName}</span>
          {statusBadge && (
            <span className={`gql-runner-status-badge ${statusBadge.className}`} data-testid="gql-runner-status-badge">
              {statusBadge.label}
            </span>
          )}
        </div>
        <div className="gql-runner-controls">
          {state.running && !state.paused && (
            <button type="button" className="gql-runner-btn" onClick={pause} data-testid="gql-runner-pause">Pause</button>
          )}
          {state.running && state.paused && (
            <button type="button" className="gql-runner-btn gql-runner-btn--primary" onClick={resume} data-testid="gql-runner-resume">Resume</button>
          )}
          {state.running && (
            <button type="button" className="gql-runner-btn gql-runner-btn--danger" onClick={abort} data-testid="gql-runner-abort">Abort</button>
          )}
          {!state.running && resultEvents.length > 0 && (
            <button
              type="button"
              className="gql-runner-btn gql-runner-btn--export"
              onClick={() => { handleExport().catch(() => {}); }}
              disabled={exporting}
              data-testid="gql-runner-export"
            >
              {exporting ? 'Exporting…' : 'Export JSON'}
            </button>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            className="gql-runner-close-btn"
            onClick={onClose}
            title="Close runner panel"
            aria-label="Close runner panel"
            data-testid="gql-runner-close"
          >
            <RunnerCloseIcon />
          </button>
        )}
      </div>

      {/* Summary row */}
      {resultEvents.length > 0 && (
        <div className="gql-runner-summary">
          <span className="gql-runner-summary-pass">✓ {passCount} passed</span>
          <span className="gql-runner-summary-fail">✗ {failCount} failed</span>
          {skipCount > 0 && <span className="gql-runner-summary-skip">— {skipCount} skipped</span>}
          {state.running && state.currentItemId && (
            <span className="gql-runner-summary-current">Running: {itemMap.get(state.currentItemId)?.name ?? '…'}</span>
          )}
          {!state.running && state.aborted && <span className="gql-runner-summary-aborted">Aborted</span>}
          {!state.running && !state.aborted && resultEvents.length > 0 && <span className="gql-runner-summary-done">Done</span>}
        </div>
      )}

      {/* Tab bar (Results / Console) */}
      <div className="gql-runner-tab-bar">
        <button
          type="button"
          className={`gql-runner-tab${activeTab === 'results' ? ' gql-runner-tab--active' : ''}`}
          onClick={() => setActiveTab('results')}
          data-testid="gql-runner-tab-results"
        >
          Results
        </button>
        <button
          type="button"
          className={`gql-runner-tab${activeTab === 'console' ? ' gql-runner-tab--active' : ''}`}
          onClick={() => setActiveTab('console')}
          data-testid="gql-runner-tab-console"
        >
          Console {logCount > 0 && <span className="gql-runner-log-count">{logCount}</span>}
        </button>
      </div>

      {/* Results table */}
      {activeTab === 'results' && (
        <div className="gql-runner-table-wrap">
          <table className="gql-runner-table" data-testid="gql-runner-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Tests</th>
              </tr>
            </thead>
            <tbody>
              {resultEvents.map((evt) => (
                <RunnerRow key={evt.itemId} event={evt} name={itemMap.get(evt.itemId)?.name ?? evt.itemId} />
              ))}
            </tbody>
          </table>
          {state.running && resultEvents.length === 0 && (
            <div className="gql-runner-waiting">Starting…</div>
          )}
        </div>
      )}

      {/* Console tab */}
      {activeTab === 'console' && (
        <div className="gql-runner-console" data-testid="gql-runner-console">
          <div className="gql-runner-console-toolbar">
            <span className="gql-runner-console-label">Run log</span>
            {visibleLogs.length > 0 && (
              <button
                type="button"
                className="gql-runner-console-clear-btn"
                onClick={() => setClearBefore(Date.now())}
                title="Clear console"
                data-testid="gql-runner-console-clear"
              >
                Clear
              </button>
            )}
          </div>
          {visibleLogs.length === 0 ? (
            <div className="gql-runner-console-empty" data-testid="gql-runner-console-empty">
              {state.running
                ? 'Waiting for run output…'
                : 'No run output yet. Execute a collection to see results here.'}
              {!state.running && (
                <p className="gql-runner-console-hint">
                  Script messages from <code>rf.log()</code>, <code>rf.warn()</code>, and{' '}
                  <code>rf.error()</code> appear here when item scripts are configured.
                </p>
              )}
            </div>
          ) : (
            visibleLogs.map((log, i) => (
              <div key={i} className={`gql-runner-console-line gql-runner-console-line--${log.level}`}>
                <span className="gql-runner-console-time">
                  {log.timestamp > 0 ? new Date(log.timestamp).toLocaleTimeString() : '—'}
                </span>
                <span className="gql-runner-console-item">[{log.itemName}]</span>
                <span className="gql-runner-console-msg">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Table row ─────────────────────────────────────────────────────────────────

interface RunnerRowProps {
  event: CollectionRunEvent;
  name: string;
}

function RunnerRow({ event, name }: RunnerRowProps) {
  const isPass  = event.type === 'result';
  const isSkip  = event.type === 'skip';
  const testPass = event.tests?.filter((t) => t.passed).length ?? 0;
  const testFail = event.tests?.filter((t) => !t.passed).length ?? 0;

  // Detect non-blocking script warnings: post-response failures and generic pre-script
  // runtime errors are logged as 'warn'/'error' but don't change event.type to 'error'.
  // Show a ⚠ alongside the ✓ so the user knows to open the Console tab for details.
  const scriptWarnings = event.logs?.filter((l) => l.level === 'warn' || l.level === 'error') ?? [];
  const hasScriptWarnings = isPass && scriptWarnings.length > 0;

  return (
    <tr className={`gql-runner-row${isPass ? ' gql-runner-row--pass' : isSkip ? ' gql-runner-row--skip' : ' gql-runner-row--fail'}`}>
      <td className="gql-runner-row-name">{name}</td>
      <td className="gql-runner-row-status">
        {isSkip ? '—' : isPass ? <span className="gql-runner-pass-icon">✓</span> : <span className="gql-runner-fail-icon">✗</span>}
        {hasScriptWarnings && (
          <span
            className="gql-runner-script-warn"
            title={`Script warning(s) — open Console tab for details:\n${scriptWarnings.map((w) => w.message).join('\n')}`}
            aria-label="Script warning"
          >
            ⚠
          </span>
        )}
        {event.error && (
          <span
            className="gql-runner-error-msg"
            title={`[${event.error.phase}] ${event.error.message}`}
          >
            {event.error.message.length > 40
              ? `${event.error.message.slice(0, 40)}…`
              : event.error.message}
          </span>
        )}
      </td>
      <td className="gql-runner-row-latency">{event.latencyMs != null ? `${event.latencyMs}ms` : '—'}</td>
      <td className="gql-runner-row-tests">
        {event.tests && event.tests.length > 0
          ? <span>{testPass}/{event.tests.length}</span>
          : '—'}
        {testFail > 0 && <span className="gql-runner-fail-icon"> ({testFail} failed)</span>}
      </td>
    </tr>
  );
}
