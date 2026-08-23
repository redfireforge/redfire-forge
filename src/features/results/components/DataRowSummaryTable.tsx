import { useState } from 'react';
import type { RequestResult } from '@shared/types';
import { formatTransportStatus } from '../utils/transportStatus';

interface Props {
  results: RequestResult[];
  scenarioName: string;
  onResultClick: (r: RequestResult) => void;
  /** Total expected rows from the data source (for executed vs expected display) */
  expectedRowCount?: number;
}

type ViewMode = 'split' | 'flat' | 'failures';

export function DataRowSummaryTable({ results, scenarioName, onResultClick, expectedRowCount }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [passedExpanded, setPassedExpanded] = useState(false);

  const dataRowResults = results.filter(r => r.dataRowId);
  if (dataRowResults.length === 0) return null;

  const failed = dataRowResults.filter(r => !r.passed);
  const passed = dataRowResults.filter(r => r.passed);

  const times = dataRowResults.map(r => r.responseTimeMs).sort((a, b) => a - b);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const passRate = Math.round((passed.length / dataRowResults.length) * 100);

  const renderRow = (r: RequestResult) => {
    const errorSnippet = r.errorMessage
      || (r.failureDetails.length > 0 ? `${r.failureDetails.length} validation failure${r.failureDetails.length > 1 ? 's' : ''}` : '');
    const validated = r.validationMode !== 'none';
    return (
      <tr
        key={r.id}
        className={`data-row-summary-row ${r.passed ? '' : 'row-failed'} clickable-row`}
        onClick={() => onResultClick(r)}
      >
        <td className="data-row-label-cell">{r.dataRowLabel || r.dataRowId}</td>
        <td>{formatTransportStatus(r)}</td>
        <td><span className={`tag ${validated ? 'tag-info' : 'tag-dim'}`}>{validated ? '✓ Yes' : '— No'}</span></td>
        <td>{r.responseTimeMs}ms</td>
        <td>{r.passed ? '✓' : '✗'}</td>
        <td className="failure-cell">{!r.passed && errorSnippet}</td>
      </tr>
    );
  };

  return (
    <div className="data-row-summary">
      <div className="data-row-summary-header">
        <span className="data-row-summary-title">
          {scenarioName} — {dataRowResults.length}{expectedRowCount != null && expectedRowCount !== dataRowResults.length ? ` / ${expectedRowCount}` : ''} rows
        </span>
        <div className="data-row-summary-modes">
          <button className={`btn btn-xs ${viewMode === 'split' ? 'btn-primary' : ''}`} onClick={() => setViewMode('split')}>Split</button>
          <button className={`btn btn-xs ${viewMode === 'flat' ? 'btn-primary' : ''}`} onClick={() => setViewMode('flat')}>Flat</button>
          <button className={`btn btn-xs ${viewMode === 'failures' ? 'btn-primary' : ''}`} onClick={() => setViewMode('failures')}>Failures Only</button>
        </div>
      </div>

      {viewMode === 'split' && (
        <>
          {failed.length > 0 && (
            <div className="data-row-batch data-row-batch-failed">
              <div className="data-row-batch-header">✗ {failed.length} failed</div>
              <table className="data-row-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Status</th>
                    <th>Validated</th>
                    <th>Time</th>
                    <th>Passed</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>{failed.map(renderRow)}</tbody>
              </table>
            </div>
          )}
          {passed.length > 0 && (
            <div className="data-row-batch data-row-batch-passed">
              <div
                className="data-row-batch-header data-row-batch-collapsible"
                onClick={() => setPassedExpanded(!passedExpanded)}
              >
                {passedExpanded ? '▼' : '▶'} ✓ {passed.length} passed
              </div>
              {passedExpanded && (
                <table className="data-row-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Status</th>
                    <th>Validated</th>
                      <th>Time</th>
                      <th>Passed</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>{passed.map(renderRow)}</tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {viewMode === 'flat' && (
        <table className="data-row-table">
          <thead>
            <tr>
              <th>Row</th>
              <th>Status</th>
                    <th>Validated</th>
              <th>Time</th>
              <th>Passed</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>{dataRowResults.map(renderRow)}</tbody>
        </table>
      )}

      {viewMode === 'failures' && (
        <>
          {failed.length === 0 ? (
            <div className="data-row-no-failures">All rows passed</div>
          ) : (
            <table className="data-row-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                    <th>Validated</th>
                  <th>Time</th>
                  <th>Passed</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>{failed.map(renderRow)}</tbody>
            </table>
          )}
        </>
      )}

      <div className="data-row-summary-stats">
        Pass {passed.length}/{dataRowResults.length} ({passRate}%)
        {' │ '}Avg: {avg}ms
        {' │ '}P95: {p95}ms
        {' │ '}P99: {p99}ms
      </div>
    </div>
  );
}
