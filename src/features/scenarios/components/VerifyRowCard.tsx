/**
 * VerifyRowCard — Shared row card component for verify modals.
 * Renders a single data row's verification status, request variables, and validation fields.
 */
import type { DataSourceColumn, DataSourceRow } from '../../../shared/types';
import { prettyJson } from '../../../shared/utils/helpers';
import type { VerifyResult } from '../hooks/useVerifyEngine';

interface VerifyRowCardProps {
  row: DataSourceRow;
  idx: number;
  vr: VerifyResult | undefined;
  verifying: boolean;
  progressCurrent: number;
  requestCols: DataSourceColumn[];
  validateCols: DataSourceColumn[];
  collapsed: boolean;
  /** Show detailed error info (resolved URL, response body, request headers) */
  showErrorDetails?: boolean;
  /** Show warn status message */
  showWarnMessage?: boolean;
  /** Render extra actions in the validation table row */
  onUpdateExpectedCell?: (rowId: string, colId: string, newValue: string) => void;
  /** Render "Accept All for Row" button */
  onAcceptAllForRow?: (rowId: string) => void;
}

export default function VerifyRowCard({
  row, idx, vr, verifying, progressCurrent,
  requestCols, validateCols, collapsed,
  showErrorDetails = false,
  showWarnMessage = false,
  onUpdateExpectedCell,
  onAcceptAllForRow,
}: VerifyRowCardProps) {
  const rowStatus = vr?.status ?? (verifying && progressCurrent === idx ? 'verifying' : 'pending');
  const cardClass = rowStatus === 'pass' ? 'verify-card-pass'
    : rowStatus === 'fail' ? 'verify-card-fail'
    : rowStatus === 'warn' ? 'verify-card-warn'
    : rowStatus === 'error' ? 'verify-card-error'
    : rowStatus === 'verifying' ? 'verify-card-active'
    : '';

  return (
    <div className={`verify-row-card ${cardClass}`}>
      {/* Card Header */}
      <div className="verify-card-header">
        <span className={`verify-card-icon status-${rowStatus}`}>
          {rowStatus === 'pass' ? '✓' : rowStatus === 'fail' ? '✗' : rowStatus === 'warn' ? '🟡' : rowStatus === 'error' ? '⚠' : rowStatus === 'verifying' ? '⟳' : '○'}
        </span>
        <span className="verify-card-name">{row.label || `Row ${idx + 1}`}</span>
        {vr?.httpStatus && (
          <span className={`verify-card-http ${vr.httpStatus >= 400 ? 'http-error' : ''}`}>
            {vr.httpStatus}
          </span>
        )}
        {vr && (
          <span className={`verify-card-badge badge-${vr.status}`}>
            {vr.status.toUpperCase()}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="verify-card-body">
        {/* Request Variables */}
        <div className="verify-vars-section">
          <div className="verify-section-label">Request Variables</div>
          <div className="verify-vars-grid">
            {requestCols.map(col => (
              <div key={col.id} className="verify-var-item">
                <span className="verify-var-key">
                  {col.name}<span className={`verify-var-badge type-${col.type}`}>{col.type}</span>
                </span>
                <span className="verify-var-value">{row.values[col.id] ?? ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Details */}
        {!collapsed && vr?.status === 'error' && (
          showErrorDetails ? (
            <div className="verify-error-detail">
              <div className="verify-error-msg">⚠ {vr.error}</div>
              {vr.resolvedUrl && (
                <div className="verify-error-url">
                  <span className="verify-detail-label">URL:</span>
                  <code className="verify-detail-value">{vr.resolvedUrl}</code>
                </div>
              )}
              {vr.responseBody && (
                <div className="verify-error-body">
                  <span className="verify-detail-label">Response:</span>
                  <pre className="verify-detail-pre">{prettyJson(vr.responseBody)}</pre>
                </div>
              )}
              {vr.requestHeaders && (
                <div className="verify-error-body">
                  <span className="verify-detail-label">Request Headers:</span>
                  <pre className="verify-detail-pre">{Object.entries(vr.requestHeaders).map(([k, v]) => `${k}: ${k.toLowerCase() === 'authorization' ? v.slice(0, 20) + '...' : v}`).join('\n')}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="verify-error-msg">⚠ {vr.error}</div>
          )
        )}

        {/* Warn Message */}
        {!collapsed && vr?.status === 'warn' && showWarnMessage && (
          <div className="verify-warn-msg">🟡 HTTP {vr.httpStatus} OK — no validation columns defined. Add validate columns or use "Run &amp; Capture" to populate them.</div>
        )}

        {/* Validation Fields */}
        {!collapsed && rowStatus !== 'error' && rowStatus !== 'warn' && (
          <div className="verify-validation-section">
            <div className="verify-section-label">
              {vr?.status === 'pass' && 'Validation Fields — All Matched ✓'}
              {vr?.status === 'fail' && (
                <span style={{ color: 'var(--danger)' }}>
                  Validation Fields — {Object.keys(vr.failedCells).length} Mismatch{Object.keys(vr.failedCells).length !== 1 ? 'es' : ''}
                  {onAcceptAllForRow && Object.keys(vr.failedCells).length > 0 && (
                    <button type="button" className="btn btn-xs verify-accept-row-btn" onClick={() => onAcceptAllForRow(row.id)}>
                      Accept All for Row
                    </button>
                  )}
                </span>
              )}
              {!vr && 'Validation Fields'}
            </div>
            <table className="verify-val-table">
              <thead>
                <tr>
                  <th></th><th>Field</th><th>Expected</th><th>Actual</th>
                  {onUpdateExpectedCell && <th></th>}
                </tr>
              </thead>
              <tbody>
                {validateCols.map(col => {
                  const cellValue = row.values[col.id] ?? '';
                  if (!cellValue) return null;
                  const isFailed = vr?.failedCells[col.id] !== undefined;
                  const actualValue = vr?.failedCells[col.id];
                  const cellStatus = !vr ? 'pending' : isFailed ? 'fail' : 'pass';

                  return (
                    <tr key={col.id}>
                      <td className={`verify-val-status val-${cellStatus}`}>
                        {cellStatus === 'pass' ? '✓' : cellStatus === 'fail' ? '✗' : ''}
                      </td>
                      <td className="verify-val-field">{col.mapping}</td>
                      <td className="verify-val-expected">{cellValue}</td>
                      <td className={`verify-val-actual val-${cellStatus}`}>
                        {cellStatus === 'pending' ? '—' : isFailed ? actualValue : cellValue}
                      </td>
                      {onUpdateExpectedCell && (
                        <td className="verify-val-actions">
                          {isFailed && actualValue != null && (
                            <button
                              type="button"
                              className="btn btn-xs verify-update-btn"
                              onClick={() => onUpdateExpectedCell(row.id, col.id, actualValue)}
                              title={`Update expected to "${actualValue}"`}
                            >
                              Update
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
