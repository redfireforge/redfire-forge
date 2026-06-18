/**
 * GqlPollingPopoverContent — the schema-polling config dialog rendered inside
 * a position:fixed portal-like div. Shared between the "schema loaded" and
 * "schema not loaded but polling active" sections of GraphqlConnectionBar.
 */

const MIN_POLL_SECONDS = 10;
const MAX_POLL_SECONDS = 3600;

export interface GqlPollingPopoverContentProps {
  pollingEnabled:         boolean;
  /** Retained for external access (e.g. aria labels on the trigger button). Not used inside this component. */
  pollingIntervalSeconds?: number;
  localIntervalSeconds:  number;
  setLocalIntervalSeconds: (s: number) => void;
  onPollingChange:       (enabled: boolean, intervalSeconds: number) => void;
  onClose:               () => void;
  commitPollingInterval: () => number;
  intervalInputId:       string;
  pollingSwitchRef:      React.RefObject<HTMLButtonElement>;
  popoverRef:            React.RefObject<HTMLDivElement>;
  popoverPos:            { top: number; right: number } | null;
  'data-testid'?:        string;
}

export function GqlPollingPopoverContent({
  pollingEnabled,
  pollingIntervalSeconds: _pollingIntervalSeconds,
  localIntervalSeconds,
  setLocalIntervalSeconds,
  onPollingChange,
  onClose,
  commitPollingInterval,
  intervalInputId,
  pollingSwitchRef,
  popoverRef,
  popoverPos,
  'data-testid': testId = 'gql-polling-popover',
}: GqlPollingPopoverContentProps) {
  return (
    <div
      ref={popoverRef}
      className="gql-polling-popover"
      style={popoverPos ? { top: popoverPos.top, right: popoverPos.right } : { visibility: 'hidden' }}
      role="dialog"
      aria-modal="true"
      aria-label="Schema polling configuration"
      data-testid={testId}
    >
      <div className="gql-polling-popover-header">
        <span>Auto-refresh schema</span>
        <button
          type="button"
          className="gql-polling-popover-close"
          onClick={onClose}
          aria-label="Close polling config"
        >×</button>
      </div>

      <div className="gql-polling-popover-body">
        <div
          className="gql-polling-toggle-row"
          onClick={() => {
            const clamped = Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, localIntervalSeconds || 30));
            setLocalIntervalSeconds(clamped);
            onPollingChange(!pollingEnabled, clamped);
          }}
          role="none"
        >
          <span className="gql-polling-toggle-label">Enable polling</span>
          <button
            ref={pollingSwitchRef}
            type="button"
            role="switch"
            aria-checked={pollingEnabled}
            className={`gql-polling-switch${pollingEnabled ? ' gql-polling-switch--on' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              const clamped = Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, localIntervalSeconds || 30));
              setLocalIntervalSeconds(clamped);
              onPollingChange(!pollingEnabled, clamped);
            }}
            data-testid="gql-polling-toggle"
            aria-label="Enable schema polling"
          >
            <span className="gql-polling-switch-thumb" />
          </button>
        </div>

        {pollingEnabled && (
          <div className="gql-polling-interval-row">
            <label className="gql-polling-interval-label" htmlFor={intervalInputId}>
              Refresh every
            </label>
            <input
              id={intervalInputId}
              type="number"
              className="gql-input gql-polling-interval-input"
              value={localIntervalSeconds}
              min={MIN_POLL_SECONDS}
              max={MAX_POLL_SECONDS}
              onChange={(e) => setLocalIntervalSeconds(Math.max(0, parseInt(e.target.value, 10) || 0))}
              onBlur={commitPollingInterval}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { commitPollingInterval(); }
              }}
              data-testid="gql-polling-interval-input"
            />
            <span className="gql-polling-interval-unit">s</span>
          </div>
        )}

        <p className="gql-polling-hint">
          {pollingEnabled
            ? `Schema re-introspected every ${Math.max(MIN_POLL_SECONDS, localIntervalSeconds)}s. Only updated when SDL changes.`
            : 'Automatically re-introspect the schema on a timer.'}
        </p>
      </div>
    </div>
  );
}
