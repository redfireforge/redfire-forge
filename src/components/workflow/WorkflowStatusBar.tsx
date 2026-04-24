import type { WorkflowRunHistoryEntry } from '../../hooks/useWorkflowRunCache';
import type { RunProgress } from './WorkflowToolbar';
import WorkflowRunHistoryDropdown from './WorkflowRunHistoryDropdown';

interface Props {
  nodeCount: number;
  edgeCount: number;
  variableCount: number;
  lastRunStatus?: 'idle' | 'running' | 'pass' | 'fail';
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
    lastRunStatus === 'fail' ? 'wf-status-bar-border-fail' : '';

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
          ● {runProgress.completed}/{runProgress.total} passed
          {runProgress.elapsedMs ? <><span className="wf-status-sep">·</span>{(runProgress.elapsedMs / 1000).toFixed(1)}s</> : null}
        </span>
      ) : lastRunStatus === 'fail' && runProgress ? (
        <>
          <span className="wf-status-run wf-status-run-fail">
            ● {runProgress.failed} failed
          </span>
          {runProgress.completed - runProgress.failed > 0 && (
            <span style={{ color: '#4ade80', fontSize: '0.7rem' }}>{runProgress.completed - runProgress.failed} passed</span>
          )}
          {runProgress.total - runProgress.completed > 0 && (
            <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{runProgress.total - runProgress.completed} skipped</span>
          )}
          {runProgress.elapsedMs ? <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{(runProgress.elapsedMs / 1000).toFixed(1)}s</span> : null}
        </>
      ) : (
        <>
          {lastRunStatus && lastRunStatus !== 'idle' && (
            <>
              <span className={`wf-status-run wf-status-run-${lastRunStatus}`}>
                {lastRunStatus === 'running' ? 'Running…' :
                  lastRunStatus === 'pass' ? `PASS${lastRunTime ? ` (${(lastRunTime / 1000).toFixed(1)}s)` : ''}` :
                  `FAIL${lastRunTime ? ` (${(lastRunTime / 1000).toFixed(1)}s)` : ''}`}
              </span>
            </>
          )}
        </>
      )}
      <span className="wf-status-sep">·</span>
      <span>Steps: <strong>{nodeCount}</strong></span>
      <span className="wf-status-sep">·</span>
      <span>Connections: <strong>{edgeCount}</strong></span>
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
          🖥 Console{consoleLineCount > 0 && <span className="wf-console-badge-count">{consoleLineCount}</span>}
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
