import type { WorkflowRunHistoryEntry } from '../../hooks/useWorkflowRunCache';
import type { RunProgress } from './WorkflowToolbar';
import WorkflowRunHistoryDropdown from '../panels/WorkflowRunHistoryDropdown';

interface Props {
  nodeCount: number;
  edgeCount: number;
  variableCount: number;
  lastRunStatus?: 'idle' | 'running' | 'pass' | 'fail' | 'stopped';
  lastRunTime?: number;
  /** First failed step summary — open full text in a modal instead of cramming the status bar. */
  lastRunError?: string | null;
  onOpenRunError?: () => void;
  runHistory?: WorkflowRunHistoryEntry[];
  activeRunHistoryId?: string | null;
  onRestoreRunHistory?: (id: string) => void;
  onDeleteRunHistoryEntry?: (id: string) => void;
  onClearRunHistory?: () => void;
  consoleLineCount?: number;
  consoleOpen?: boolean;
  onToggleConsole?: () => void;
  runProgress?: RunProgress | null;
}

export default function WorkflowStatusBar({
  nodeCount,
  edgeCount,
  variableCount,
  lastRunStatus,
  lastRunTime,
  lastRunError,
  onOpenRunError,
  runHistory = [],
  activeRunHistoryId = null,
  onRestoreRunHistory,
  onDeleteRunHistoryEntry,
  onClearRunHistory,
  consoleLineCount = 0,
  consoleOpen = false,
  onToggleConsole,
  runProgress = null,
}: Props) {
  const borderClass =
    lastRunStatus === 'running' ? 'wf-status-bar-border-running' :
    lastRunStatus === 'pass' ? 'wf-status-bar-border-pass' :
    lastRunStatus === 'fail' ? 'wf-status-bar-border-fail' :
    lastRunStatus === 'stopped' ? 'wf-status-bar-border-stopped' : '';

  return (
    <div className={`wf-status-bar ${borderClass}`}>
      {lastRunStatus === 'running' && runProgress ? (
        <span className="wf-status-run wf-status-run-running">
          <span className="wf-spinner" /> Running step {runProgress.completed}/{runProgress.total}
          <span className="wf-status-sep">·</span>
          {(runProgress.elapsedMs / 1000).toFixed(1)}s elapsed
        </span>
      ) : lastRunStatus === 'pass' && runProgress ? (
        <span className="wf-status-run wf-status-run-pass">
          <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg> {runProgress.completed}/{runProgress.total} passed
          {runProgress.elapsedMs ? <><span className="wf-status-sep">·</span>{(runProgress.elapsedMs / 1000).toFixed(1)}s</> : null}
        </span>
      ) : lastRunStatus === 'fail' && runProgress ? (
        <>
          <span className="wf-status-run wf-status-run-fail">
            <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg> {runProgress.failed} failed
          </span>
          {runProgress.completed - runProgress.failed > 0 && (
            <span style={{ color: '#4ade80', fontSize: '0.7rem' }}>{runProgress.completed - runProgress.failed} passed</span>
          )}
          {runProgress.total - runProgress.completed > 0 && (
            <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{runProgress.total - runProgress.completed} skipped</span>
          )}
          {runProgress.elapsedMs ? <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{(runProgress.elapsedMs / 1000).toFixed(1)}s</span> : null}
        </>
      ) : lastRunStatus === 'stopped' && runProgress ? (
        <span className="wf-status-run wf-status-run-stopped">
          <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stopped by user · {runProgress.completed}/{runProgress.total} completed
          {runProgress.elapsedMs ? <><span className="wf-status-sep">·</span>{(runProgress.elapsedMs / 1000).toFixed(1)}s</> : null}
        </span>
      ) : (
        <>
          {lastRunStatus && lastRunStatus !== 'idle' && (
            <>
              <span className={`wf-status-run wf-status-run-${lastRunStatus}`}>
                {lastRunStatus === 'running' ? 'Running…' :
                  lastRunStatus === 'pass' ? `PASS${lastRunTime ? ` (${(lastRunTime / 1000).toFixed(1)}s)` : ''}` :
                  lastRunStatus === 'stopped' ? `STOPPED${lastRunTime ? ` (${(lastRunTime / 1000).toFixed(1)}s)` : ''}` :
                  `FAIL${lastRunTime ? ` (${(lastRunTime / 1000).toFixed(1)}s)` : ''}`}
              </span>
            </>
          )}
        </>
      )}
      <span className="wf-status-sep">·</span>
      <span>Steps: <strong>{nodeCount}</strong></span>
      <span className="wf-status-sep">·</span>
      <span>Edges: <strong>{edgeCount}</strong></span>
      <span className="wf-status-sep">·</span>
      <span>Variables: <strong>{variableCount}</strong></span>
      {lastRunError && lastRunStatus === 'fail' && (
        <>
          <span className="wf-status-sep">·</span>
          <button
            type="button"
            className="wf-run-error-open-btn"
            title={lastRunError}
            onClick={() => onOpenRunError?.()}
          >
            View full error
          </button>
        </>
      )}
      {onToggleConsole && (
        <button
          type="button"
          className={`wf-console-badge ${consoleOpen ? 'wf-console-badge-active' : ''}`}
          onClick={onToggleConsole}
          title="Toggle console"
        >
          <svg className="wf-inline-icon" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> Console{consoleLineCount > 0 && <span className="wf-console-badge-count">{consoleLineCount}</span>}
        </button>
      )}
      {onRestoreRunHistory && onDeleteRunHistoryEntry && onClearRunHistory && (
        <WorkflowRunHistoryDropdown
          history={runHistory}
          activeEntryId={activeRunHistoryId}
          onRestore={onRestoreRunHistory}
          onDeleteEntry={onDeleteRunHistoryEntry}
          onClearHistory={onClearRunHistory}
        />
      )}
    </div>
  );
}
