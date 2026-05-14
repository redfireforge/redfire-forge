import type { FailureDetail } from '../../../shared/types';

interface ValidationResultData {
  passed: boolean;
  failures: FailureDetail[];
  httpStatus?: number;
  verifyScope?: string;
}

interface ValidationVerifyPanelProps {
  expectedFieldCount: number;
  assertionCount: number;
  validating: boolean;
  verifyScope: 'assertions' | 'rules' | 'all';
  onVerifyScopeChange: (scope: 'assertions' | 'rules' | 'all') => void;
  onValidate: () => void;
  fetchHostEnabled: boolean;
  onFetchHostEnabledChange: (enabled: boolean) => void;
  fetchHostOverride: string;
  onFetchHostOverrideChange: (value: string) => void;
  resolvedBaseUrl?: string;
  onUseSettingsUrl: () => void;
  validationResult: ValidationResultData | null;
  onDismissResult: () => void;
  unorderedArrays?: boolean;
  onEnableUnorderedAndReVerify: () => void;
}

export default function ValidationVerifyPanel({
  expectedFieldCount,
  assertionCount,
  validating,
  verifyScope,
  onVerifyScopeChange,
  onValidate,
  fetchHostEnabled,
  onFetchHostEnabledChange,
  fetchHostOverride,
  onFetchHostOverrideChange,
  resolvedBaseUrl,
  onUseSettingsUrl,
  validationResult,
  onDismissResult,
  unorderedArrays,
  onEnableUnorderedAndReVerify,
}: ValidationVerifyPanelProps) {
  if (expectedFieldCount === 0 && assertionCount === 0) return null;

  return (
    <div className="validate-response-section">
      <div className="validate-response-row">
        <button
          type="button"
          className="btn btn-sm btn-validate"
          onClick={onValidate}
          disabled={validating}
        >
          {validating ? 'Validating...' : 'Verify'}
        </button>
        <select
          className="assertion-select verify-scope-select"
          value={verifyScope}
          onChange={(e) => onVerifyScopeChange(e.target.value as 'assertions' | 'rules' | 'all')}
        >
          <option value="all">All</option>
          <option value="assertions">Assertions Only</option>
          <option value="rules">Validation Rules Only</option>
        </select>
        <label className="checkbox-label fetch-host-toggle">
          <input
            type="checkbox"
            checked={fetchHostEnabled}
            onChange={(e) => onFetchHostEnabledChange(e.target.checked)}
          />
          Host Override
        </label>
        <input
          className="validate-host-input"
          value={fetchHostOverride}
          onChange={(e) => onFetchHostOverrideChange(e.target.value)}
          placeholder={resolvedBaseUrl || 'Enter base URL'}
          disabled={!fetchHostEnabled}
        />
        {fetchHostEnabled && resolvedBaseUrl && !fetchHostOverride && (
          <button type="button" className="btn btn-sm" onClick={onUseSettingsUrl} title="Use Settings base URL">Use Settings</button>
        )}
      </div>
      {validationResult && (
        <div className={`validate-result ${validationResult.passed ? 'validate-pass' : 'validate-fail'}`}>
          <div className="validate-result-header">
            <span className={`validate-badge ${validationResult.passed ? 'badge-pass' : 'badge-fail'}`}>
              {validationResult.passed ? 'PASSED' : 'FAILED'}
            </span>
            {validationResult.httpStatus && (
              <span className="validate-http-status">HTTP {validationResult.httpStatus}</span>
            )}
            <span className="validate-summary">
              {validationResult.passed
                ? (() => {
                    const scope = validationResult.verifyScope || 'all';
                    if (scope === 'assertions') return `All ${assertionCount} assertion${assertionCount !== 1 ? 's' : ''} passed`;
                    if (scope === 'rules') return `All ${expectedFieldCount} field rule${expectedFieldCount !== 1 ? 's' : ''} passed`;
                    return `All ${expectedFieldCount + assertionCount} rule${expectedFieldCount + assertionCount !== 1 ? 's' : ''} passed (${assertionCount} assertion${assertionCount !== 1 ? 's' : ''}, ${expectedFieldCount} field rule${expectedFieldCount !== 1 ? 's' : ''})`;
                  })()
                : `${validationResult.failures.length} discrepanc${validationResult.failures.length === 1 ? 'y' : 'ies'} found`}
            </span>
            <button className="btn btn-xs" onClick={onDismissResult}>×</button>
          </div>
          {!validationResult.passed && validationResult.failures.length > 0 && (() => {
            const allOrderMismatches = !unorderedArrays
              && validationResult.failures.every((f) => /\[\d+\]/.test(f.path) && typeof f.actual === 'string' && f.actual.includes('matched by'));
            return (
              <>
                {allOrderMismatches && (
                  <div className="validate-order-hint">
                    All failures are array ordering mismatches. The expected values exist but at different indices.
                    <button
                      type="button"
                      className="btn btn-xs btn-accent"
                      style={{ marginLeft: 8 }}
                      onClick={onEnableUnorderedAndReVerify}
                    >
                      Enable unordered matching &amp; re-verify
                    </button>
                  </div>
                )}
                <table className="validate-failures-table">
                  <thead>
                    <tr>
                      <th>Path</th>
                      <th>Expected</th>
                      <th>Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.failures.map((f, i) => (
                      <tr key={i}>
                        <td><code>{f.path}</code></td>
                        <td className="val-expected">{f.expected}</td>
                        <td className="val-actual">{f.actual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
