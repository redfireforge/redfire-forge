import type { ScriptResult } from '@workflow/engine/scriptSandbox';

interface Props {
  result: ScriptResult;
  /** Max chars to display for output values (default 200). */
  maxOutputLength?: number;
}

/** Shared test-result display used by both ScriptConfig and ScriptCodeModal. */
export default function ScriptTestResult({ result, maxOutputLength = 200 }: Props) {
  return (
    <div className={`wf-script-test-result ${result.success ? 'wf-script-test-pass' : 'wf-script-test-fail'}`}>
      <div className="wf-script-test-header">
        {result.success ? '✅ Passed' : '❌ Failed'} ({result.durationMs.toFixed(1)}ms)
      </div>
      {result.error && (
        <div className="wf-script-test-error">{result.error}</div>
      )}
      {Object.keys(result.outputs).length > 0 && (
        <div className="wf-script-test-outputs">
          <strong>Outputs:</strong>
          {Object.entries(result.outputs).map(([k, v]) => (
            <div key={k} className="wf-script-test-output-row">
              <code>{k}</code> = <code>{v.length > maxOutputLength ? v.slice(0, maxOutputLength - 3) + '…' : v}</code>
            </div>
          ))}
        </div>
      )}
      {result.consoleLogs.length > 0 && (
        <div className="wf-script-test-console">
          <strong>Console:</strong>
          {result.consoleLogs.map((line, i) => (
            <div key={i} className="wf-script-test-console-line">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
