import { useEffect, useState } from 'react';
import type { ApiMockSimulationResultV1 } from '../../../shared/api-mock/contracts';
import { simulateRenderedBodyViews } from './apiMockSimulateModalHelpers';

interface Props {
  result: ApiMockSimulationResultV1;
}

export function ApiMockSimulateRenderedPane({ result }: Props) {
  const rawBody = result.renderedResponse?.body ?? '';
  const { pretty, canFormat } = simulateRenderedBodyViews(rawBody);
  const [showPretty, setShowPretty] = useState(false);

  useEffect(() => {
    setShowPretty(false);
  }, [rawBody]);

  const displayBody = showPretty ? pretty : rawBody;
  const faultKind = result.preview?.fault;
  const hasFault = Boolean(faultKind && faultKind !== 'none');
  const wireBody = result.preview?.wireBody;
  const dribbleIncomplete = faultKind === 'dribble' && wireBody != null && wireBody !== rawBody;
  const statusClass = result.preview?.httpCompleted === false
    ? 'danger'
    : hasFault
      ? 'warning'
      : result.renderedResponse && result.renderedResponse.status < 400 ? 'success' : 'warning';

  return (
    <div className="am-editor-body am-sim-fill-pane" data-testid="api-mock-sim-rendered">
      {result.renderedResponse ? (
        <>
          <div className="am-row am-sim-rendered-meta">
            <span
              className={`am-badge ${statusClass}`}
              data-testid="api-mock-sim-rendered-status"
            >
              {result.preview?.httpCompleted === false ? '—' : result.renderedResponse.status}
            </span>
            {hasFault && result.preview?.httpCompleted !== false && (
              <span className="am-hint">in headers</span>
            )}
            <span className="am-badge">{result.renderedResponse.contentType ?? result.renderedResponse.headers?.['content-type']?.[0] ?? '—'}</span>
            {result.preview && (
              <span className="am-badge info" data-testid="api-mock-sim-virtual-delay">
                Virtual delay {result.preview.virtualDelayMs} ms
              </span>
            )}
            {hasFault && (
              <span className="am-badge warning">FAULT: {faultKind}</span>
            )}
            <span className="am-spacer" />
            <button
              type="button"
              className="am-btn small ghost"
              onClick={() => setShowPretty(true)}
              disabled={!canFormat || showPretty}
              title="Pretty-print JSON"
              data-testid="api-mock-sim-rendered-format"
            >Format</button>
          </div>
          {result.preview?.httpCompleted === false ? (
            <div className="am-notice warning" style={{ marginTop: 10 }}>
              <span>No HTTP body would reach the client — connection-level fault ({result.preview.fault}).</span>
            </div>
          ) : dribbleIncomplete ? (
            <>
              <div className="am-notice warning" style={{ marginTop: 10 }} data-testid="api-mock-sim-dribble-notice">
                <span>
                  Headers went out as {result.renderedResponse.status}. FAIL is the dribble fault,
                  not an HTTP error. The client only received the chunks on the wire — not the
                  intended body.
                </span>
              </div>
              <div data-testid="api-mock-sim-wire-section">
                <div className="am-section-heading">On the wire</div>
                <pre className="am-code-block am-sim-fill-code" data-testid="api-mock-sim-wire-body">
                  {wireBody || '(no bytes)'}
                </pre>
              </div>
              <div data-testid="api-mock-sim-intended-section">
                <div className="am-section-heading">Intended body</div>
                <pre className="am-code-block am-sim-fill-code" data-testid="api-mock-sim-rendered-body">
                  {displayBody}
                </pre>
              </div>
            </>
          ) : (
            <pre className="am-code-block am-sim-fill-code" data-testid="api-mock-sim-rendered-body">
              {displayBody}
            </pre>
          )}
          {result.preview?.faultTimeline && result.preview.faultTimeline.length > 0 && result.preview.fault !== 'none' && (
            <div style={{ marginTop: 12 }} data-testid="api-mock-sim-fault-timeline">
              <div className="am-section-heading">Fault timeline (virtual)</div>
              {result.preview.faultTimeline.map((step, i) => (
                <div key={`${step.atMs}-${i}`} className="am-hint am-mono">t+{step.atMs}ms — {step.label}</div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="am-muted">No response rendered for this outcome.</div>
      )}
    </div>
  );
}
