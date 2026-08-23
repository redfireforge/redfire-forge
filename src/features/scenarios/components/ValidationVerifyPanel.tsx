import { useState } from 'react';
import type { FailureDetail } from '@shared/types';
import { highlightJsonHtml } from '@shared/utils/jsonHighlightHtml';
import { CustomSelect } from '@shared/components/CustomSelect';
import { prettyJson } from '@shared/utils/helpers';

interface ValidationResultData {
  passed: boolean;
  failures: FailureDetail[];
  httpStatus?: number;
  statusText?: string;
  responseJson?: string;
  responseHeaders?: Record<string, string>;
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
  const [showResponseDetail, setShowResponseDetail] = useState(false);
  const hasResponseData = !!(validationResult && (validationResult.responseJson || validationResult.responseHeaders));

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
        <div style={expectedFieldCount === 0 ? { display: 'none' } : undefined}>
          <CustomSelect
            className="assertion-select verify-scope-select"
            value={verifyScope}
            onChange={(v) => onVerifyScopeChange(v as 'assertions' | 'rules' | 'all')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'assertions', label: 'Assertions Only' },
              { value: 'rules', label: 'Validation Rules Only' },
            ]}
          />
        </div>
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
          <div
            className={`validate-result-header${hasResponseData ? ' validate-result-header--clickable' : ''}`}
            onDoubleClick={hasResponseData ? () => setShowResponseDetail((v) => !v) : undefined}
            title={hasResponseData ? 'Double-click to view response details' : undefined}
          >
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
            {hasResponseData && (
              <button
                type="button"
                className="btn btn-xs validate-detail-toggle"
                onClick={() => setShowResponseDetail((v) => !v)}
                aria-expanded={showResponseDetail}
                aria-label="Toggle response details"
              >
                {showResponseDetail ? '▾ Response' : '▸ Response'}
              </button>
            )}
            <button className="btn btn-xs" onClick={onDismissResult}>×</button>
          </div>
          {showResponseDetail && hasResponseData && (
            <div className="validate-response-detail">
              {validationResult.httpStatus && (
                <div className="validate-response-detail-row">
                  <span className="validate-response-detail-label">Status</span>
                  <span className={`validate-response-detail-status-badge ${validationResult.httpStatus >= 500 ? 'status-5xx' : validationResult.httpStatus >= 400 ? 'status-4xx' : 'status-ok'}`}>
                    {validationResult.httpStatus}
                  </span>
                  <span className="validate-response-detail-value">
                    {validationResult.statusText ?? ''}
                  </span>
                </div>
              )}
              {validationResult.responseHeaders && Object.keys(validationResult.responseHeaders).length > 0 && (
                <details className="validate-response-detail-section">
                  <summary className="validate-response-detail-section-title">
                    Response Headers <span className="validate-response-detail-count">({Object.keys(validationResult.responseHeaders).length})</span>
                  </summary>
                  <div className="validate-response-detail-headers">
                    {Object.entries(validationResult.responseHeaders).map(([k, v]) => (
                      <div key={k} className="validate-response-detail-header-row">
                        <span className="validate-response-detail-header-key">{k}</span>
                        <span className="validate-response-detail-header-sep">:</span>{' '}
                        <span className="validate-response-detail-header-val">{v}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {validationResult.responseJson && (
                <details className="validate-response-detail-section" open>
                  <summary className="validate-response-detail-section-title">Response Body</summary>
                  <pre
                    className="validate-response-detail-body"
                    dangerouslySetInnerHTML={{ __html: highlightJsonHtml(prettyJson(validationResult.responseJson)) }}
                  />
                </details>
              )}
            </div>
          )}
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

