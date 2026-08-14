/**
 * Slim Studio footer — live awareness + deep links into Runtime / Conflicts.
 */
interface Props {
  transactionCount: number;
  conflictCount: number;
  variableCount: number;
  running: boolean;
  onOpenRuntime: (tab?: 'transactions' | 'state' | 'variables' | 'settings' | 'console') => void;
  onOpenConflicts: () => void;
}

export function ApiMockLiveStrip({
  transactionCount,
  conflictCount,
  variableCount,
  running,
  onOpenRuntime,
  onOpenConflicts,
}: Props) {
  return (
    <div className="am-live-strip" data-testid="api-mock-live-strip" role="region" aria-label="Runtime summary">
      <span className={`am-status-dot ${running ? 'running' : ''}`} title={running ? 'Running' : 'Stopped'} />
      <span className="am-live-strip-label">{running ? 'Live' : 'Stopped'}</span>
      <button type="button" className="am-live-strip-link" onClick={() => onOpenRuntime('transactions')} data-testid="api-mock-live-transactions">
        Transactions <span className="am-count-badge">{transactionCount}</span>
      </button>
      <button type="button" className="am-live-strip-link" onClick={onOpenConflicts} data-testid="api-mock-live-conflicts">
        Conflicts
        {conflictCount > 0 && <span className="am-count-badge warning">{conflictCount}</span>}
      </button>
      <button type="button" className="am-live-strip-link" onClick={() => onOpenRuntime('variables')} data-testid="api-mock-live-variables">
        Variables <span className="am-count-badge">{variableCount}</span>
      </button>
      <button type="button" className="am-live-strip-link" onClick={() => onOpenRuntime('settings')} data-testid="api-mock-live-settings">
        Settings
      </button>
      <button type="button" className="am-live-strip-link" onClick={() => onOpenRuntime('console')} data-testid="api-mock-live-console">
        Console
      </button>
      <span className="am-spacer" />
      <button type="button" className="am-btn small" onClick={() => onOpenRuntime()} data-testid="api-mock-open-runtime">
        Open Runtime
      </button>
    </div>
  );
}
