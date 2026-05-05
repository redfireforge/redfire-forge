import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import type { DataSource, DataSourceColumn, DataSourceRow, Scenario } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import { proxyFetch, buildHeaders } from '../../../engine/executor';
import { validate as validateResponse } from '../../../engine/validator';
import { extractJsonPath, expandPatternFromResponse } from '../utils/dataSourceImport';

// ─── Types ────────────────────────────────────────────────────

export interface VerifyResult {
  rowId: string;
  status: 'pass' | 'fail' | 'warn' | 'error';
  httpStatus?: number;
  /** Map of columnId → actual value from API (for failed cells) */
  failedCells: Record<string, string>;
  /** Map of columnId → actual value from API (for ALL validate cells, used by "Accept All") */
  actualCells: Record<string, string>;
  error?: string;
  /** The resolved URL that was actually sent */
  resolvedUrl?: string;
  /** Response body (truncated for display) */
  responseBody?: string;
  /** Request headers that were sent (for debugging) */
  requestHeaders?: Record<string, string>;
}

interface Props {
  draft: Scenario;
  dataTable: DataSource;
  onDraftChange: (d: Scenario) => void;
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────

export default function DataSourceVerifyModal({ draft, dataTable, onDraftChange, onFetchRow, onClose }: Props) {
  const [results, setResults] = useState<Map<string, VerifyResult>>(new Map());
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const abortRef = useRef(false);

  const dt = draftRef.current.dataSource ?? dataTable;
  const enabledRows = useMemo(() => dt.rows.filter(r => r.enabled), [dt.rows]);
  const requestCols = useMemo(() => dt.columns.filter(c => c.type !== 'validate'), [dt.columns]);
  const validateCols = useMemo(() => dt.columns.filter(c => c.type === 'validate'), [dt.columns]);

  // ─── Verify logic ───────────────────────────────────────────

  const runVerification = useCallback(async () => {
    const currentDraft = draftRef.current;
    const currentDt = currentDraft.dataSource;
    if (!currentDt) return;

    const rows = currentDt.rows.filter(r => r.enabled);
    if (rows.length === 0) return;

    setVerifying(true);
    setResults(new Map());
    setProgress({ current: 0, total: rows.length });
    abortRef.current = false;

    const valCols = currentDt.columns.filter(c => c.type === 'validate');
    const accumulated = new Map<string, VerifyResult>();

    for (let i = 0; i < rows.length; i++) {
      if (abortRef.current) break;
      const row = rows[i];
      const rowIdx = currentDt.rows.findIndex(r => r.id === row.id);

      try {
        const resolved = resolveScenarioFromDataRow(currentDraft, currentDt.columns, row, rowIdx);
        const doFetch = onFetchRow ?? proxyFetch;
        const reqHeaders = buildHeaders(resolved);
        const result = await doFetch(
          resolved.url, resolved.method,
          reqHeaders,
          resolved.body || undefined,
        );
        const actualHeaders = result.sentHeaders ?? reqHeaders;

        if (result.error) {
          accumulated.set(row.id, { rowId: row.id, status: 'error', error: result.error, resolvedUrl: resolved.url, responseBody: result.body?.slice(0, 2000), requestHeaders: actualHeaders, failedCells: {}, actualCells: {} });
          setResults(new Map(accumulated));
          setProgress({ current: i + 1, total: rows.length });
          continue;
        }

        if (result.status >= 400) {
          accumulated.set(row.id, { rowId: row.id, status: 'error', httpStatus: result.status, error: `HTTP ${result.status}: ${result.statusText}`, resolvedUrl: resolved.url, responseBody: result.body?.slice(0, 2000), requestHeaders: actualHeaders, failedCells: {}, actualCells: {} });
          setResults(new Map(accumulated));
          setProgress({ current: i + 1, total: rows.length });
          continue;
        }

        let responseObj: unknown = null;
        try { responseObj = JSON.parse(result.body); } catch { /* not JSON */ }

        const failedCells: Record<string, string> = {};
        const actualCells: Record<string, string> = {};

        if (responseObj != null) {
          // Extract actual values for ALL validate columns
          for (const col of valCols) {
            const extracted = extractJsonPath(responseObj, col.mapping);
            if (extracted !== '') actualCells[col.id] = extracted;
          }

          const arrayModes = currentDt.arrayValidationMode ?? {};
          const hasUnordered = Object.values(arrayModes).some(m => m === 'unordered');

          const expectedFields = valCols
            .filter(col => row.values[col.id]?.trim())
            .map(col => ({
              jsonPath: col.mapping,
              expectedValue: row.values[col.id].trim(),
            }));

          if (expectedFields.length > 0) {
            const validationFailures = validateResponse(
              { mode: 'selective', expectedFields, unorderedArrays: hasUnordered },
              responseObj,
            );
            for (const f of validationFailures) {
              const col = valCols.find(c => c.mapping === f.path);
              if (col) failedCells[col.id] = f.actual ?? '(missing)';
            }
          }
        }

        const hasValidateValues = valCols.some(col => row.values[col.id]?.trim());
        const rowStatus = Object.keys(failedCells).length > 0 ? 'fail'
          : !hasValidateValues ? 'warn' : 'pass';

        accumulated.set(row.id, {
          rowId: row.id,
          status: rowStatus as VerifyResult['status'],
          httpStatus: result.status,
          failedCells,
          actualCells,
        });
      } catch (err) {
        accumulated.set(row.id, {
          rowId: row.id,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          failedCells: {},
          actualCells: {},
        });
      }

      setResults(new Map(accumulated));
      setProgress({ current: i + 1, total: rows.length });
    }

    setVerifying(false);
  }, [onFetchRow]);

  // ─── Re-fetch failed rows ──────────────────────────────────

  const refetchFailedRows = useCallback(async () => {
    const currentDraft = draftRef.current;
    const currentDt = currentDraft.dataSource;
    if (!currentDt) return;

    const failedRowIds = new Set(
      [...results.values()].filter(r => r.status !== 'pass').map(r => r.rowId),
    );
    if (failedRowIds.size === 0) return;

    setVerifying(true);
    let columns = [...currentDt.columns];
    let rows = [...currentDt.rows];
    const dynamicPatterns = new Set(currentDt.validationContract ?? []);

    for (const rowId of failedRowIds) {
      const row = rows.find(r => r.id === rowId);
      if (!row) continue;
      const rowIdx = rows.findIndex(r => r.id === rowId);

      try {
        const resolved = resolveScenarioFromDataRow(currentDraft, columns, row, rowIdx);
        const doFetch = onFetchRow ?? proxyFetch;
        const result = await doFetch(
          resolved.url, resolved.method,
          buildHeaders(resolved),
          resolved.body || undefined,
        );

        if (result.error || result.status >= 400) continue;

        let responseObj: unknown = null;
        try { responseObj = JSON.parse(result.body); } catch { /* not JSON */ }
        if (responseObj == null) continue;

        const updatedValues = { ...row.values };
        const valCols = columns.filter(c => c.type === 'validate');

        // Build set of paths that actually exist in the response for dynamic patterns
        const dynamicExpandedPaths = new Set<string>();
        if (dynamicPatterns.size > 0) {
          for (const pattern of dynamicPatterns) {
            for (const path of expandPatternFromResponse(responseObj, pattern)) {
              dynamicExpandedPaths.add(path);
            }
          }
        }

        for (const col of valCols) {
          const extracted = extractJsonPath(responseObj, col.mapping);
          if (extracted !== '') {
            updatedValues[col.id] = extracted;
          } else {
            // Clear stale values for dynamic pattern columns whose array index
            // no longer exists in the response
            const matchesDynamic = [...dynamicPatterns].some(p => {
              const regex = new RegExp('^' + p.replace(/\[\*\]/g, '\\[\\d+\\]').replace(/\./g, '\\.') + '$');
              return regex.test(col.mapping);
            });
            if (matchesDynamic) updatedValues[col.id] = '';
          }
        }

        if (dynamicPatterns.size > 0) {
          for (const path of dynamicExpandedPaths) {
            const exists = columns.some(c => c.type === 'validate' && c.mapping === path);
            if (!exists) {
              const colId = crypto.randomUUID();
              const name = path.replace(/\[(\d+)\]/g, '$1').replace(/\./g, '_');
              columns = [...columns, { id: colId, name, type: 'validate' as const, mapping: path }];
              updatedValues[colId] = extractJsonPath(responseObj, path);
            }
          }
        }

        rows = rows.map(r => r.id === rowId ? { ...r, values: updatedValues } : r);
      } catch { /* skip */ }
    }

    onDraftChange({ ...currentDraft, dataSource: { ...currentDt, columns, rows } });
    setVerifying(false);
    setTimeout(() => void runVerification(), 100);
  }, [results, onFetchRow, onDraftChange, runVerification]);

  // ─── Run & Capture (populate validate columns from API responses) ──

  const runCapture = useCallback(async () => {
    const currentDraft = draftRef.current;
    const currentDt = currentDraft.dataSource;
    if (!currentDt) return;

    const rows = currentDt.rows.filter(r => r.enabled);
    if (rows.length === 0) return;

    setVerifying(true);
    setResults(new Map());
    setProgress({ current: 0, total: rows.length });
    abortRef.current = false;

    let columns = [...currentDt.columns];
    let allRows = [...currentDt.rows];
    const dynamicPatterns = new Set(currentDt.validationContract ?? []);
    const accumulated = new Map<string, VerifyResult>();

    for (let i = 0; i < rows.length; i++) {
      if (abortRef.current) break;
      const row = rows[i];
      const rowIdx = allRows.findIndex(r => r.id === row.id);

      try {
        const resolved = resolveScenarioFromDataRow(currentDraft, columns, row, rowIdx);
        const doFetch = onFetchRow ?? proxyFetch;
        const result = await doFetch(
          resolved.url, resolved.method,
          buildHeaders(resolved),
          resolved.body || undefined,
        );

        if (result.error || result.status >= 400) {
          accumulated.set(row.id, {
            rowId: row.id, status: 'error',
            httpStatus: result.status,
            error: result.error || `HTTP ${result.status}: ${result.statusText}`,
            resolvedUrl: resolved.url,
            responseBody: result.body?.slice(0, 2000),
            failedCells: {}, actualCells: {},
          });
          setResults(new Map(accumulated));
          setProgress({ current: i + 1, total: rows.length });
          continue;
        }

        let responseObj: unknown = null;
        try { responseObj = JSON.parse(result.body); } catch { /* not JSON */ }

        const updatedValues = { ...row.values };
        const actualCells: Record<string, string> = {};

        if (responseObj != null) {
          // Build set of paths that exist in the response for dynamic patterns
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
              // Clear stale values for dynamic pattern columns whose array index
              // no longer exists in the response
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
          error: err instanceof Error ? err.message : String(err),
          failedCells: {}, actualCells: {},
        });
      }

      setResults(new Map(accumulated));
      setProgress({ current: i + 1, total: rows.length });
    }

    onDraftChange({ ...currentDraft, dataSource: { ...currentDt, columns, rows: allRows } });
    setVerifying(false);
  }, [onFetchRow, onDraftChange]);

  // ─── Update Expected value for a single cell ──────────────

  const updateExpectedCell = useCallback((rowId: string, colId: string, newValue: string) => {
    const currentDraft = draftRef.current;
    const currentDt = currentDraft.dataSource;
    if (!currentDt) return;

    const rows = currentDt.rows.map(r =>
      r.id === rowId ? { ...r, values: { ...r.values, [colId]: newValue } } : r,
    );
    onDraftChange({ ...currentDraft, dataSource: { ...currentDt, rows } });

    // Update the result to reflect the fix
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
  }, [onDraftChange]);

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
  }, [results, onDraftChange]);

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
  }, [results, onDraftChange]);

  // ─── Summary stats ─────────────────────────────────────────

  const passCount = [...results.values()].filter(r => r.status === 'pass').length;
  const warnCount = [...results.values()].filter(r => r.status === 'warn').length;
  const failCount = [...results.values()].filter(r => r.status === 'fail').length;
  const errorCount = [...results.values()].filter(r => r.status === 'error').length;
  const allDone = results.size > 0 && !verifying;
  const allPassed = allDone && failCount === 0 && errorCount === 0;
  const summaryClass = results.size === 0
    ? 'verify-summary-neutral'
    : allPassed ? 'verify-summary-pass' : failCount > 0 || errorCount > 0 ? 'verify-summary-fail' : 'verify-summary-neutral';

  // ─── Collapse/expand validation sections ───────────────────

  const [collapsed, setCollapsed] = useState(false);

  // ─── Failure pattern grouping ──────────────────────────────

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
        // Group by the set of failed column mappings + actual values
        const failedEntries = Object.entries(vr.failedCells).sort(([a], [b]) => a.localeCompare(b));
        const key = `fail:${failedEntries.map(([colId, actual]) => `${colId}=${actual}`).join('|')}`;
        // Build label using column names from dt
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
    // Only show patterns that affect 2+ rows
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
        {enabledRows.map((row, idx) => {
          const vr = results.get(row.id);
          const rowStatus = vr?.status ?? (verifying && progress.current === idx ? 'verifying' : 'pending');
          const cardClass = rowStatus === 'pass' ? 'verify-card-pass'
            : rowStatus === 'fail' ? 'verify-card-fail'
            : rowStatus === 'warn' ? 'verify-card-warn'
            : rowStatus === 'error' ? 'verify-card-error'
            : rowStatus === 'verifying' ? 'verify-card-active'
            : '';

          return (
            <div key={row.id} className={`verify-row-card ${cardClass}`}>
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

                {!collapsed && vr?.status === 'error' && (
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
                        <pre className="verify-detail-pre">{(() => { try { return JSON.stringify(JSON.parse(vr.responseBody), null, 2); } catch { return vr.responseBody; } })()}</pre>
                      </div>
                    )}
                    {vr.requestHeaders && (
                      <div className="verify-error-body">
                        <span className="verify-detail-label">Request Headers:</span>
                        <pre className="verify-detail-pre">{Object.entries(vr.requestHeaders).map(([k, v]) => `${k}: ${k.toLowerCase() === 'authorization' ? v.slice(0, 20) + '...' : v}`).join('\n')}</pre>
                      </div>
                    )}
                  </div>
                )}
                {!collapsed && vr?.status === 'warn' && (
                  <div className="verify-warn-msg">🟡 HTTP {vr.httpStatus} OK — no validation columns defined. Add validate columns or use "Run &amp; Capture" to populate them.</div>
                )}
                {!collapsed && rowStatus !== 'error' && rowStatus !== 'warn' && (
                  <div className="verify-validation-section">
                    <div className="verify-section-label">
                      {vr?.status === 'pass' && 'Validation Fields — All Matched ✓'}
                      {vr?.status === 'fail' && (
                        <span style={{ color: 'var(--danger)' }}>
                          Validation Fields — {Object.keys(vr.failedCells).length} Mismatch{Object.keys(vr.failedCells).length !== 1 ? 'es' : ''}
                          {Object.keys(vr.failedCells).length > 0 && (
                            <button type="button" className="btn btn-xs verify-accept-row-btn" onClick={() => acceptAllChangesForRow(row.id)}>
                              Accept All for Row
                            </button>
                          )}
                        </span>
                      )}
                      {!vr && 'Validation Fields'}
                    </div>
                    <table className="verify-val-table">
                      <thead>
                        <tr><th></th><th>Field</th><th>Expected</th><th>Actual</th><th></th></tr>
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
                              <td className="verify-val-actions">
                                {isFailed && actualValue != null && (
                                  <button
                                    type="button"
                                    className="btn btn-xs verify-update-btn"
                                    onClick={() => updateExpectedCell(row.id, col.id, actualValue)}
                                    title={`Update expected to "${actualValue}"`}
                                  >
                                    Update
                                  </button>
                                )}
                              </td>
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
        })}
      </div>
    </AppModalFrame>
  );
}
