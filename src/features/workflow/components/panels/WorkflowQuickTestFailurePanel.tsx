import type { QuickTestFailureReport } from '../../utils/workflowRunErrors';

interface Props {
  report: QuickTestFailureReport;
}

function formatStepTiming(ms?: number): string | null {
  if (ms == null || ms <= 0) return null;
  return `${ms}ms`;
}

function formatRunDuration(ms?: number): string | null {
  if (ms == null || ms <= 0) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

/** Human-readable headline for common GraphQL assert errors. */
function formatFailureHeadline(summary: string): { title: string; detail?: string } {
  const lessThan = summary.match(/\$ less_than\s+\S+\s+—\s+got\s+(\S+)\s+\(expected\s+<\s+(\S+)\)/i);
  if (lessThan) {
    return {
      title: 'Assertion did not pass',
      detail: `Actual value ${lessThan[1]} — threshold requires less than ${lessThan[2]}`,
    };
  }
  return { title: summary };
}

export default function WorkflowQuickTestFailurePanel({ report }: Props) {
  const vars = report.variableSnapshot ?? {};
  const varEntries = Object.entries(vars).filter(([, v]) => v.trim().length > 0);
  const headline = formatFailureHeadline(report.summary);
  const durationLabel = formatRunDuration(report.durationMs);
  const failCount = report.failedSteps.length;
  const passCount = report.passedSteps.length;

  return (
    <div className="wf-qt-fail-panel">
      <div className="wf-qt-fail-hero">
        <div className="wf-qt-fail-hero-icon" aria-hidden>
          <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="wf-qt-fail-hero-body">
          <div className="wf-qt-fail-hero-title">{headline.title}</div>
          {headline.detail && <div className="wf-qt-fail-hero-detail">{headline.detail}</div>}
          <code className="wf-qt-fail-hero-raw">{report.summary}</code>
        </div>
      </div>

      {(failCount > 0 || passCount > 0 || durationLabel) && (
        <div className="wf-qt-fail-stats" aria-label="Run summary">
          {failCount > 0 && (
            <span className="wf-qt-fail-stat wf-qt-fail-stat--fail">
              {failCount} failed
            </span>
          )}
          {passCount > 0 && (
            <span className="wf-qt-fail-stat wf-qt-fail-stat--pass">
              {passCount} passed
            </span>
          )}
          {durationLabel && (
            <span className="wf-qt-fail-stat wf-qt-fail-stat--neutral">
              {durationLabel}
            </span>
          )}
        </div>
      )}

      {report.failedSteps.length > 0 && (
        <section className="wf-qt-fail-section">
          <h3 className="wf-qt-fail-section-title">Failed steps</h3>
          <ul className="wf-qt-fail-step-list">
            {report.failedSteps.map((step) => (
              <li key={step.nodeId} className="wf-qt-fail-step wf-qt-fail-step--fail">
                <div className="wf-qt-fail-step-head">
                  <span className="wf-qt-fail-status-pill wf-qt-fail-status-pill--fail">Fail</span>
                  <span className="wf-qt-fail-step-label">{step.label}</span>
                  <span className="wf-qt-fail-step-meta-group">
                    {formatStepTiming(step.responseTimeMs) && (
                      <span className="wf-qt-fail-step-meta">{formatStepTiming(step.responseTimeMs)}</span>
                    )}
                    {step.statusCode != null && step.statusCode > 0 && (
                      <span className="wf-qt-fail-step-meta">HTTP {step.statusCode}</span>
                    )}
                  </span>
                </div>
                {step.error && (
                  <pre className="wf-qt-fail-step-error">{step.error}</pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.passedSteps.length > 0 && (
        <section className="wf-qt-fail-section">
          <h3 className="wf-qt-fail-section-title">Passed steps</h3>
          <ul className="wf-qt-fail-step-list wf-qt-fail-step-list--compact">
            {report.passedSteps.map((step) => (
              <li key={step.nodeId} className="wf-qt-fail-step wf-qt-fail-step--pass">
                <span className="wf-qt-fail-status-pill wf-qt-fail-status-pill--pass">Pass</span>
                <span className="wf-qt-fail-step-label">{step.label}</span>
                {formatStepTiming(step.responseTimeMs) && (
                  <span className="wf-qt-fail-step-meta">{formatStepTiming(step.responseTimeMs)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {varEntries.length > 0 && (
        <section className="wf-qt-fail-section">
          <h3 className="wf-qt-fail-section-title">Variables at failure</h3>
          <p className="wf-qt-fail-section-hint">
            Values bound or referenced when the assert step ran — not global environment defaults.
          </p>
          <dl className="wf-qt-fail-vars">
            {varEntries.map(([key, value]) => (
              <div key={key} className="wf-qt-fail-var-row">
                <dt className="wf-qt-fail-var-key">{`{{${key}}}`}</dt>
                <dd className="wf-qt-fail-var-val" title={value.length > 80 ? value : undefined}>
                  {value.length > 120 ? `${value.slice(0, 120)}…` : value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {report.hints.length > 0 && (
        <section className="wf-qt-fail-section wf-qt-fail-hints">
          <h3 className="wf-qt-fail-section-title">What to try</h3>
          <ul className="wf-qt-fail-hint-list">
            {report.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
