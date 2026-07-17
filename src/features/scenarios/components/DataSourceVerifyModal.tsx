import { useState, useCallback, useMemo } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import type { DataSource, Scenario } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { proxyFetch } from '../../../engine/executor';
import { extractJsonPath, expandPatternFromResponse } from '../utils/dataSourceImport';
import { useVerifyEngine, executeRowFetch } from '../hooks/useVerifyEngine';
import type { VerifyResult } from '../hooks/useVerifyEngine';
import VerifyRowCard from './VerifyRowCard';
import { toErrorMessage, tryParseJson } from '../../../shared/utils/helpers';

export type { VerifyResult };

interface Props {
  draft: Scenario;
  dataTable: DataSource;
  onDraftChange: (d: Scenario) => void;
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────

export default function DataSourceVerifyModal({ draft, dataTable, onDraftChange, onFetchRow, onClose }: Props) {
  const engine = useVerifyEngine(draft, dataTable, onDraftChange, onFetchRow, {
    trackActualCells: true,
    trackRequestDetails: true,
  });

  const {
    results, verifying, progress,
    enabledRows, requestCols, validateCols,
    summary, draftRef, setResults,
    runVerification, refetchFailedRows,
  } = engine;

  const { passCount, warnCount, failCount, errorCount, allDone, allPassed, summaryClass } = summary;
  const dt = draftRef.current.dataSource ?? dataTable;

  // ─── Run & Capture (populate validate columns from API responses) ──

  const runCapture = useCallback(async () => {
    const currentDraft = draftRef.current;
    const currentDt = currentDraft.dataSource;
    if (!currentDt) return;

    const rows = currentDt.rows.filter(r => r.enabled);
    if (rows.length === 0) return;

    // Use the engine's state setters indirectly through the returned setResults
    const doFetch = onFetchRow ?? proxyFetch;
    const dynamicPatterns = new Set(currentDt.validationContract ?? []);
    let columns = [...currentDt.columns];
    let allRows = [...currentDt.rows];
    const accumulated = new Map<string, VerifyResult>();

    // We need to manually manage verifying state for capture
    // The engine doesn't expose setVerifying, so we track it locally
    engine.results.clear(); // Reset

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIdx = allRows.findIndex(r => r.id === row.id);

      try {
        const { resolved, fetchPromise } = executeRowFetch(
          currentDraft, columns, row, rowIdx, doFetch,
        );
        const result = await fetchPromise;

        if (result.error || result.status >= 400) {
          accumulated.set(row.id, {
            rowId: row.id, status: 'error',
            httpStatus: result.status,
            error: result.error || `HTTP ${result.status}: ${result.statusText}`,
            resolvedUrl: resolved.url,
            responseBody: result.body?.slice(0, 2000),
            failedCells: {}, actualCells: {},
          });
          continue;
        }

        const responseObj: unknown = tryParseJson(result.body) ?? null;

        const updatedValues = { ...row.values };
        const actualCells: Record<string, string> = {};

        if (responseObj != null) {
          const dynamicExpandedPaths = new Set<string>();
          if (dynamicPatterns.size > 0) {
            for (const pattern of dynamicPatterns) {
              for (const path of expandPatternFromResponse(responseObj, pattern)) {
                dynamicExpandedPaths.add(path);
              }
            }
          }

          const valCols = columns.filter(c => c.type === 'validate');
          for (const col of valCols) {
            const extracted = extractJsonPath(responseObj, col.mapping);
            if (extracted !== '') {
              updatedValues[col.id] = extracted;
              actualCells[col.id] = extracted;
            } else {
              const matchesDynamic = [...dynamicPatterns].some(p => {
                const regex = new RegExp('^' + p.replace(/\[\*\]/g, '\\[\\d+\\]').replace(/\./g, '\\.') + '$');
                return regex.test(col.mapping);
              });
              if (matchesDynamic) {
                updatedValues[col.id] = '';
                actualCells[col.id] = '';
              }
            }
          }

          if (dynamicPatterns.size > 0) {
            for (const path of dynamicExpandedPaths) {
              const exists = columns.some(c => c.type === 'validate' && c.mapping === path);
              if (!exists) {
                const colId = crypto.randomUUID();
                const name = path.replace(/\[(\d+)\]/g, '$1').replace(/\./g, '_');
                columns = [...columns, { id: colId, name, type: 'validate' as const, mapping: path }];
              }
              const col = columns.find(c => c.type === 'validate' && c.mapping === path)!;
              const val = extractJsonPath(responseObj, path);
              updatedValues[col.id] = val;
              actualCells[col.id] = val;
            }
          }
        }

        allRows = allRows.map(r => r.id === row.id ? { ...r, values: updatedValues } : r);

        accumulated.set(row.id, {
          rowId: row.id, status: 'pass',
          httpStatus: result.status,
          failedCells: {}, actualCells,
        });
      } catch (err) {
        accumulated.set(row.id, {
          rowId: row.id, status: 'error',
          error: toErrorMessage(err),
          failedCells: {}, actualCells: {},
        });
      }

      setResults(new Map(accumulated));
    }

    onDraftChange({ ...currentDraft, dataSource: { ...currentDt, columns, rows: allRows } });
  }, [onFetchRow, onDraftChange, draftRef, setResults, engine.results]);

  // ─── Update Expected value for a single cell ──────────────

  const updateExpectedCell = useCallback((rowId: string, colId: string, newValue: string) => {
    const currentDraft = draftRef.current;
    const currentDt = currentDraft.dataSource;
    if (!currentDt) return;

    const rows = currentDt.rows.map(r =>
      r.id === rowId ? { ...r, values: { ...r.values, [colId]: newValue } } : r,
    );
    onDraftChange({ ...currentDraft, dataSource: { ...currentDt, rows } });

    setResults(prev => {
      const next = new Map(prev);
      const vr = next.get(rowId);
      if (vr) {
        const { [colId]: _, ...remainingFailed } = vr.failedCells;
        const newStatus = Object.keys(remainingFailed).length === 0
          ? (vr.status === 'warn' ? 'warn' : 'pass') : 'fail';
        next.set(rowId, { ...vr, failedCells: remainingFailed, status: newStatus });
      }
      return next;
    });
  }, [onDraftChange, draftRef, setResults]);

  // ─── Accept all changes for a row ─────────────────────────

  const acceptAllChangesForRow = useCallback((rowId: string) => {
    const vr = results.get(rowId);
    if (!vr) return;
    const currentDraft = draftRef.current;
    const currentDt = currentDraft.dataSource;
    if (!currentDt) return;

    const updatedValues: Record<string, string> = {};
    for (const [colId, actual] of Object.entries(vr.failedCells)) {
      updatedValues[colId] = actual;
    }

    const rows = currentDt.rows.map(r =>
      r.id === rowId ? { ...r, values: { ...r.values, ...updatedValues } } : r,
    );
    onDraftChange({ ...currentDraft, dataSource: { ...currentDt, rows } });

    setResults(prev => {
      const next = new Map(prev);
      next.set(rowId, { ...vr, failedCells: {}, status: 'pass' });
      return next;
    });
  }, [results, onDraftChange, draftRef, setResults]);

  // ─── Accept all changes across ALL rows ───────────────────

  const acceptAllChanges = useCallback(() => {
    const currentDraft = draftRef.current;
    const currentDt = currentDraft.dataSource;
    if (!currentDt) return;

    const failedResults = [...results.values()].filter(r => r.status === 'fail');
    if (failedResults.length === 0) return;

    let rows = [...currentDt.rows];
    for (const vr of failedResults) {
      rows = rows.map(r =>
        r.id === vr.rowId ? { ...r, values: { ...r.values, ...vr.failedCells } } : r,
      );
    }
    onDraftChange({ ...currentDraft, dataSource: { ...currentDt, rows } });

    setResults(prev => {
      const next = new Map(prev);
      for (const vr of failedResults) {
        next.set(vr.rowId, { ...vr, failedCells: {}, status: 'pass' });
      }
      return next;
    });
  }, [results, onDraftChange, draftRef, setResults]);

  // ─── Collapse/expand ──────────────────────────────────────

  const [collapsed, setCollapsed] = useState(false);

  // ─── Failure pattern grouping ─────────────────────────────

  const failurePatterns = useMemo(() => {
    const groups = new Map<string, { label: string; rowIds: string[] }>();
    for (const vr of results.values()) {
      if (vr.status === 'pass' || vr.status === 'warn') continue;
      if (vr.status === 'error') {
        const key = `error:${vr.httpStatus ?? 0}:${vr.error ?? 'unknown'}`;
        const label = vr.httpStatus ? `HTTP ${vr.httpStatus}: ${vr.error}` : (vr.error ?? 'Unknown error');
        const g = groups.get(key) ?? { label, rowIds: [] };
        g.rowIds.push(vr.rowId);
        groups.set(key, g);
      } else if (vr.status === 'fail') {
        const failedEntries = Object.entries(vr.failedCells).sort(([a], [b]) => a.localeCompare(b));
        const key = `fail:${failedEntries.map(([colId, actual]) => `${colId}=${actual}`).join('|')}`;
        const parts = failedEntries.map(([colId, actual]) => {
          const col = dt.columns.find(c => c.id === colId);
          const expected = enabledRows.find(r => r.id === vr.rowId)?.values[colId] ?? '?';
          return `${col?.mapping ?? colId}: expected "${expected}" got "${actual}"`;
        });
        const label = parts.join(', ');
        const g = groups.get(key) ?? { label, rowIds: [] };
        g.rowIds.push(vr.rowId);
        groups.set(key, g);
      }
    }
    return [...groups.values()].filter(g => g.rowIds.length >= 2).sort((a, b) => b.rowIds.length - a.rowIds.length);
  }, [results, dt, enabledRows]);

  const [patternsExpanded, setPatternsExpanded] = useState(false);

  // ─── Render ────────────────────────────────────────────────

  return (
    <AppModalFrame
      title="Data Source — Verify & Inspect"
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
            {enabledRows.length} enabled rows • {dt.columns.length} columns ({requestCols.length} request, {validateCols.length} validate)
          </span>
        </div>
      }
      footer={
        <div className="verify-modal-footer">
          {!verifying && !allDone && (
            <>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void runVerification()}>
                ▶ Verify All
              </button>
              <button type="button" className="btn btn-sm" onClick={() => void runCapture()}>
                ⬇ Run &amp; Capture
              </button>
            </>
          )}
          {!verifying && allDone && (
            <>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void runVerification()}>
                ▶ Re-verify
              </button>
              <button type="button" className="btn btn-sm" onClick={() => void runCapture()}>
                ⬇ Re-capture
              </button>
            </>
          )}
          {(failCount > 0 || errorCount > 0) && !verifying && (
            <button type="button" className="btn btn-sm btn-accent" onClick={() => void refetchFailedRows()}>
              ↻ Re-fetch Failed ({failCount + errorCount})
            </button>
          )}
          {failCount > 0 && !verifying && (
            <button type="button" className="btn btn-sm" onClick={acceptAllChanges}>
              ✓ Accept All Changes ({failCount})
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
              {allPassed ? `All ${results.size} rows passed` : `${passCount} passed${warnCount > 0 ? `, ${warnCount} warn` : ''}, ${failCount} failed, ${errorCount} errors`}
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
            {warnCount > 0 && <span className="verify-stat verify-stat-warn">🟡 {warnCount} warn</span>}
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

      {/* Failure Pattern Summary */}
      {failurePatterns.length > 0 && (
        <div className="verify-pattern-summary">
          <button
            type="button"
            className="verify-pattern-toggle"
            onClick={() => setPatternsExpanded(e => !e)}
          >
            {patternsExpanded ? '▾' : '▸'} {failurePatterns.length} failure pattern{failurePatterns.length !== 1 ? 's' : ''} detected
          </button>
          {patternsExpanded && (
            <div className="verify-pattern-list">
              {failurePatterns.map((pat, i) => (
                <div key={i} className="verify-pattern-row">
                  <span className="verify-pattern-count">{pat.rowIds.length} rows</span>
                  <span className="verify-pattern-label">{pat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            showErrorDetails
            showWarnMessage
            onUpdateExpectedCell={updateExpectedCell}
            onAcceptAllForRow={acceptAllChangesForRow}
          />
        ))}
      </div>
    </AppModalFrame>
  );
}
