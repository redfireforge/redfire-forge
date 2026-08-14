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

  return (
    <div className="am-editor-body am-sim-fill-pane" data-testid="api-mock-sim-rendered">
      {result.renderedResponse ? (
        <>
          <div className="am-row am-sim-rendered-meta">
            <span
              className={`am-badge ${result.preview?.httpCompleted === false ? 'danger' : result.renderedResponse.status < 400 ? 'success' : 'warning'}`}
              data-testid="api-mock-sim-rendered-status"
            >
              {result.preview?.httpCompleted === false ? '—' : result.renderedResponse.status}
            </span>
            <span className="am-badge">{result.renderedResponse.contentType ?? result.renderedResponse.headers?.['content-type']?.[0] ?? '—'}</span>
            {result.preview && (
              <span className="am-badge info" data-testid="api-mock-sim-virtual-delay">
                Virtual delay {result.preview.virtualDelayMs} ms
              </span>
            )}
            {result.preview?.fault && result.preview.fault !== 'none' && (
              <span className="am-badge warning">FAULT: {result.preview.fault}</span>
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
