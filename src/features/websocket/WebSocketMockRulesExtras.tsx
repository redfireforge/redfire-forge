import type { MockUi } from './WebSocketMockServer';

export function MockRuleTester({ ui }: { ui: MockUi }) {
  const { testInput, testResult, config } = ui;
  return (
    <div className="ws-mock-test-section" data-testid="mock-test-section">
      <div className="ws-mock-section-header">
        <div className="ws-mock-section-heading">
          <span className="ws-mock-section-title">Rule Tester</span>
          <span className="ws-mock-section-subtitle">Dry-run a sample message against the rule list</span>
        </div>
      </div>
      <div className="ws-mock-test-card">
        <div className="ws-mock-test-row">
          <label className="ws-mock-test-label" htmlFor="mock-test-input">Sample message</label>
          <input
            id="mock-test-input"
            className="ws-mock-test-input"
            type="text"
            value={testInput}
            onChange={(e) => ui.setTestInput(e.target.value)}
            placeholder="Type a sample message to test rule matching…"
            data-testid="mock-test-input"
          />
        </div>
        {testResult && (
          <div className={`ws-mock-test-result ${testResult.matched ? 'matched' : 'fallback'}`} data-testid="mock-test-result">
            <span className="ws-mock-test-result-dot" aria-hidden="true" />
            {testResult.matched
              ? <>Matched rule: <strong>{testResult.rule?.name}</strong> → {testResult.response?.type}</>
              : <>No rule matched → fallback: <strong>{config.fallback}</strong></>
            }
          </div>
        )}
      </div>
    </div>
  );
}

export function MockActivityLog({ ui }: { ui: MockUi }) {
  const { logs, reversedLogs } = ui;
  return (
    <div className="ws-mock-log-section">
      <div className="ws-mock-section-header">
        <span className="ws-mock-section-title">Activity Log</span>
        {logs.length > 0 && (
          <button className="ws-mock-clear-log-btn" onClick={ui.mock.clearLogs} data-testid="mock-clear-log" title="Clear activity log" aria-label="Clear activity log">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 3h8M5 3V2h2v1M4.5 3v6.5h3V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Clear
          </button>
        )}
      </div>
      <div className="ws-mock-log" data-testid="mock-log">
        {reversedLogs.length === 0 && (
          <div className="ws-mock-log-empty">No activity yet</div>
        )}
        {reversedLogs.map((entry) => (
          <div key={entry.id} className={`ws-mock-log-entry ws-mock-log-${entry.event}`} data-testid={`mock-log-${entry.id}`}>
            <span className="ws-mock-log-ts">
              {new Date(entry.ts).toLocaleTimeString()}
            </span>
            <span className="ws-mock-log-event">{entry.event}</span>
            {entry.clientId && <span className="ws-mock-log-client">[{entry.clientId}]</span>}
            {entry.ruleName && <span className="ws-mock-log-rule">{entry.ruleName}</span>}
            {entry.data && <span className="ws-mock-log-data">{entry.data}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
