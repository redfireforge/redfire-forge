import { useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import type { DataSource, Scenario } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { useVerifyEngine } from '../hooks/useVerifyEngine';
import VerifyRowCard from './VerifyRowCard';

// ─── Types ────────────────────────────────────────────────────

export type { VerifyResult } from '../hooks/useVerifyEngine';

interface Props {
  draft: Scenario;
  dataTable: DataSource;
  onDraftChange: (d: Scenario) => void;
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────

export default function DataSourceVerifyModal({ draft, dataTable, onDraftChange, onFetchRow, onClose }: Props) {
  const {
    results, verifying, progress,
    enabledRows, requestCols, validateCols,
    summary,
    runVerification, refetchFailedRows,
  } = useVerifyEngine(draft, dataTable, onDraftChange, onFetchRow);

  const { passCount, failCount, errorCount, allDone, allPassed, summaryClass } = summary;

  const [collapsed, setCollapsed] = useState(false);

  return (
    <AppModalFrame
      title="Data Table — Verify & Inspect"
      onClose={onClose}
      overlayClassName="verify-modal-overlay"
      dialogClassName="verify-modal"
      headerClassName="verify-modal-header"
      bodyClassName="verify-modal-body"
      initialExpanded={false}
      closeButtonKind="none"
      showExpandButton={false}
      headerActions={
        <div className="verify-modal-header-actions">
          <span className="verify-modal-subtitle">
            {enabledRows.length} enabled rows • {validateCols.length + requestCols.length} columns ({requestCols.length} request, {validateCols.length} validate)
          </span>
        </div>
      }
      footer={
        <div className="verify-modal-footer">
          {!verifying && !allDone && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void runVerification()}>
              ▶ Verify All
            </button>
          )}
          {!verifying && allDone && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void runVerification()}>
              ▶ Re-verify
            </button>
          )}
          {(failCount > 0 || errorCount > 0) && !verifying && (
            <button type="button" className="btn btn-sm btn-accent" onClick={() => void refetchFailedRows()}>
              ↻ Re-fetch Failed ({failCount + errorCount})
            </button>
          )}
          {verifying && (
            <button type="button" className="btn btn-sm" disabled>
              ⏳ Verifying {progress.current}/{progress.total}...
            </button>
          )}
          <div className="verify-footer-spacer" />
          {allDone && (
            <span className="verify-footer-info">
              {allPassed ? `All ${results.size} rows passed` : `${passCount} passed, ${failCount} failed, ${errorCount} errors`}
            </span>
          )}
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
        </div>
      }
    >
      {/* Summary Bar */}
      <div className={`verify-summary-bar ${summaryClass}`}>
        {results.size === 0 && !verifying && (
          <span className="verify-summary-hint">Click "▶ Verify All" to validate rows against the API</span>
        )}
        {verifying && results.size === 0 && (
          <span className="verify-summary-hint verify-progress">Verifying rows...</span>
        )}
        {results.size > 0 && (
          <>
            <span className="verify-stat verify-stat-pass">✓ {passCount} passed</span>
            <span className="verify-stat verify-stat-fail">✗ {failCount} failed</span>
            <span className="verify-stat verify-stat-error">⚠ {errorCount} errors</span>
            <span className="verify-stat verify-stat-total">{results.size} rows</span>
          </>
        )}
        {verifying && results.size > 0 && (
          <span className="verify-progress-bar">
            <span className="verify-progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </span>
        )}
        <button
          type="button"
          className="btn btn-sm verify-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand validation sections' : 'Collapse validation sections'}
        >
          {collapsed ? '▸ Show Validation' : '▾ Hide Validation'}
        </button>
      </div>

      {/* Row Cards */}
      <div className="verify-row-cards">
        {enabledRows.map((row, idx) => (
          <VerifyRowCard
            key={row.id}
            row={row}
            idx={idx}
            vr={results.get(row.id)}
            verifying={verifying}
            progressCurrent={progress.current}
            requestCols={requestCols}
            validateCols={validateCols}
            collapsed={collapsed}
          />
        ))}
      </div>
    </AppModalFrame>
  );
}
