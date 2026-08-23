/**
 * GraphqlComplexityGateModal — Phase 3F (task 3F-8)
 *
 * Confirmation modal shown when a query's estimated complexity exceeds the
 * user-configured "Block threshold". Displays the score, per-field breakdown
 * table, and a "Remember for this session" checkbox.
 *
 * The user can:
 *   - "Send anyway"  — proceed with execution despite the high cost
 *   - "Cancel"       — abort the execution attempt
 */

import { useState } from 'react';
import { useModalEscapeClose } from '@shared/hooks/useModalEscapeClose';
import type { ComplexityResult } from '../utils/complexityEstimator';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphqlComplexityGateModalProps {
  /** The computed complexity result for the current query */
  complexityResult: ComplexityResult;
  /** The user-configured block threshold */
  blockThreshold: number;
  /** Called when user chooses to send anyway (rememberSession = skip gate for the rest of the session) */
  onSendAnyway: (rememberSession: boolean) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphqlComplexityGateModal({
  complexityResult,
  blockThreshold,
  onSendAnyway,
  onCancel,
}: GraphqlComplexityGateModalProps) {
  const { score, fieldBreakdown } = complexityResult;
  const overPercent = Math.round((score / blockThreshold) * 100);
  const [rememberSession, setRememberSession] = useState(false);

  useModalEscapeClose(onCancel, { capture: true });

  return (
    <div
      className="gql-gate-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gql-gate-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="gql-gate-modal">
        <div className="gql-gate-icon-row">
          <svg
            className="gql-gate-warning-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 id="gql-gate-title" className="gql-gate-title">
          Query complexity {score.toLocaleString()} exceeds limit {blockThreshold.toLocaleString()}
        </h2>

        <p className="gql-gate-message">
          This query has an estimated complexity of{' '}
          <strong>{score.toLocaleString()}</strong>, which exceeds your block
          threshold of <strong>{blockThreshold.toLocaleString()}</strong> ({overPercent}% of
          limit).
        </p>

        <div className="gql-gate-score-bar">
          <div className="gql-gate-score-track">
            <div
              className="gql-gate-score-fill"
              style={{ width: `${Math.min(100, overPercent)}%` }}
              aria-label={`Query complexity: ${score}`}
            />
          </div>
          <span className="gql-gate-score-label">{score.toLocaleString()} / {blockThreshold.toLocaleString()}</span>
        </div>

        {/* Field breakdown table (3F-8) */}
        {fieldBreakdown.length > 0 && (
          <div className="gql-gate-breakdown">
            <div className="gql-gate-breakdown-title">Field cost breakdown</div>
            <table className="gql-gate-breakdown-table" aria-label="Field cost breakdown">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th className="gql-gate-breakdown-cost-col">Cost</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {fieldBreakdown.map((entry, i) => (
                  <tr key={i}>
                    <td className="gql-gate-breakdown-field">{entry.fieldName}</td>
                    <td className="gql-gate-breakdown-type">{entry.typeName}</td>
                    <td className="gql-gate-breakdown-cost">{entry.cost.toLocaleString()}</td>
                    <td className="gql-gate-breakdown-notes">
                      {entry.isList && <span className="gql-gate-breakdown-list-badge">list ×10</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="gql-gate-note">
          High-complexity queries can cause significant server load. Consider
          reducing nesting depth or removing list fields.
        </p>

        {/* "Remember for this session" checkbox (3F-8) */}
        <label className="gql-gate-remember">
          <input
            type="checkbox"
            checked={rememberSession}
            onChange={(e) => setRememberSession(e.target.checked)}
            aria-label="Remember for this session — skip complexity gate for the rest of this session"
          />
          <span>Remember for this session</span>
        </label>

        <div className="gql-gate-actions">
          <button
            type="button"
            className="gql-gate-btn-cancel"
            onClick={onCancel}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className="gql-gate-btn-send"
            onClick={() => onSendAnyway(rememberSession)}
          >
            Send anyway
          </button>
        </div>
      </div>
    </div>
  );
}
