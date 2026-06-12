/**
 * useVerifyEngine — Shared verification engine for DataSourceVerifyModal and DataTableVerifyModal.
 *
 * Extracts common logic: row-by-row HTTP verification, re-fetch failed rows,
 * dynamic pattern expansion, and summary stats computation.
 */
import { useState, useCallback, useRef, useMemo } from 'react';
import type { DataSource, Scenario, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import { proxyFetch, buildHeaders } from '../../../engine/executor';
import { validate as validateResponse } from '../../../engine/validator';
import { extractJsonPath, expandPatternFromResponse } from '../utils/dataSourceImport';
import { toErrorMessage, tryParseJson } from '../../../shared/utils/helpers';

// ─── Types ────────────────────────────────────────────────────

export interface VerifyResult {
  rowId: string;
  status: 'pass' | 'fail' | 'warn' | 'error';
  httpStatus?: number;
  failedCells: Record<string, string>;
  /** Map of columnId → actual value from API (for ALL validate cells). Only populated when trackActualCells is true. */
  actualCells: Record<string, string>;
  error?: string;
  resolvedUrl?: string;
  responseBody?: string;
  requestHeaders?: Record<string, string>;
}

export interface VerifySummary {
  passCount: number;
  warnCount: number;
  failCount: number;
  errorCount: number;
  allDone: boolean;
  allPassed: boolean;
  summaryClass: string;
}

export interface UseVerifyEngineOptions {
  /** When true, tracks actual values for all validate cells and enables warn status for rows with no validate values. */
  trackActualCells?: boolean;
  /** When true, records resolvedUrl, responseBody, requestHeaders on error results. */
  trackRequestDetails?: boolean;
}

export interface UseVerifyEngineReturn {
  results: Map<string, VerifyResult>;
  verifying: boolean;
  progress: { current: number; total: number };
  enabledRows: DataSourceRow[];
  requestCols: DataSourceColumn[];
  validateCols: DataSourceColumn[];
  summary: VerifySummary;
  runVerification: () => Promise<void>;
  refetchFailedRows: () => Promise<void>;
  setResults: React.Dispatch<React.SetStateAction<Map<string, VerifyResult>>>;
  draftRef: React.MutableRefObject<Scenario>;
}

// ─── Shared fetch helper ─────────────────────────────────────

export function executeRowFetch(
  draft: Scenario,
  columns: DataSourceColumn[],
  row: DataSourceRow,
  rowIdx: number,
  fetchFn: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>,
) {
  const resolved = resolveScenarioFromDataRow(draft, columns, row, rowIdx);
  const reqHeaders = buildHeaders(resolved);
  const fetchPromise = fetchFn(resolved.url, resolved.method, reqHeaders, resolved.body || undefined);
  return { resolved, reqHeaders, fetchPromise };
}

// ─── Hook ────────────────────────────────────────────────────

export function useVerifyEngine(
  draft: Scenario,
  dataTable: DataSource,
  onDraftChange: (d: Scenario) => void,
  onFetchRow: ((url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>) | undefined,
  options: UseVerifyEngineOptions = {},
): UseVerifyEngineReturn {
  const { trackActualCells = false, trackRequestDetails = false } = options;

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

  // ─── Core verification loop ────────────────────────────────

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
    const doFetch = onFetchRow ?? proxyFetch;

    for (let i = 0; i < rows.length; i++) {
      if (abortRef.current) break;
      const row = rows[i];
      const rowIdx = currentDt.rows.findIndex(r => r.id === row.id);

      try {
        const { resolved, reqHeaders, fetchPromise } = executeRowFetch(
          currentDraft, currentDt.columns, row, rowIdx, doFetch,
        );
        const result = await fetchPromise;
        const actualHeaders = result.sentHeaders ?? reqHeaders;

        if (result.error) {
          accumulated.set(row.id, {
            rowId: row.id, status: 'error', error: result.error,
            resolvedUrl: trackRequestDetails ? resolved.url : undefined,
            responseBody: trackRequestDetails ? result.body?.slice(0, 2000) : undefined,
            requestHeaders: trackRequestDetails ? actualHeaders : undefined,
            failedCells: {}, actualCells: {},
          });
          setResults(new Map(accumulated));
          setProgress({ current: i + 1, total: rows.length });
          continue;
        }

        if (result.status >= 400) {
          accumulated.set(row.id, {
            rowId: row.id, status: 'error', httpStatus: result.status,
            error: `HTTP ${result.status}: ${result.statusText}`,
            resolvedUrl: trackRequestDetails ? resolved.url : undefined,
            responseBody: trackRequestDetails ? result.body?.slice(0, 2000) : undefined,
            requestHeaders: trackRequestDetails ? actualHeaders : undefined,
            failedCells: {}, actualCells: {},
          });
          setResults(new Map(accumulated));
          setProgress({ current: i + 1, total: rows.length });
          continue;
        }

        const responseObj: unknown = tryParseJson(result.body) ?? null;

        const failedCells: Record<string, string> = {};
        const actualCells: Record<string, string> = {};

        if (responseObj != null) {
          // Extract actual values for ALL validate columns (when tracking)
          if (trackActualCells) {
            for (const col of valCols) {
              const extracted = extractJsonPath(responseObj, col.mapping);
              if (extracted !== '') actualCells[col.id] = extracted;
            }
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
        const rowStatus: VerifyResult['status'] = Object.keys(failedCells).length > 0
          ? 'fail'
          : (trackActualCells && !hasValidateValues) ? 'warn' : 'pass';

        accumulated.set(row.id, {
          rowId: row.id,
          status: rowStatus,
          httpStatus: result.status,
          failedCells,
          actualCells,
        });
      } catch (err) {
        accumulated.set(row.id, {
          rowId: row.id,
          status: 'error',
          error: toErrorMessage(err),
          failedCells: {},
          actualCells: {},
        });
      }

      setResults(new Map(accumulated));
      setProgress({ current: i + 1, total: rows.length });
    }

    setVerifying(false);
  }, [onFetchRow, trackActualCells, trackRequestDetails]);

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
    const doFetch = onFetchRow ?? proxyFetch;

    for (const rowId of failedRowIds) {
      const row = rows.find(r => r.id === rowId);
      if (!row) continue;
      const rowIdx = rows.findIndex(r => r.id === rowId);

      try {
        const { fetchPromise } = executeRowFetch(currentDraft, columns, row, rowIdx, doFetch);
        const result = await fetchPromise;

        if (result.error || result.status >= 400) continue;

        const responseObj: unknown = tryParseJson(result.body) ?? null;
        if (responseObj == null) continue;

        const updatedValues = { ...row.values };
        const valCols = columns.filter(c => c.type === 'validate');

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

  // ─── Summary stats ─────────────────────────────────────────

  const summary = useMemo((): VerifySummary => {
    const vals = [...results.values()];
    const passCount = vals.filter(r => r.status === 'pass').length;
    const warnCount = vals.filter(r => r.status === 'warn').length;
    const failCount = vals.filter(r => r.status === 'fail').length;
    const errorCount = vals.filter(r => r.status === 'error').length;
    const allDone = results.size > 0 && !verifying;
    const allPassed = allDone && failCount === 0 && errorCount === 0;
    const summaryClass = results.size === 0
      ? 'verify-summary-neutral'
      : allPassed ? 'verify-summary-pass'
      : (failCount > 0 || errorCount > 0) ? 'verify-summary-fail'
      : 'verify-summary-neutral';
    return { passCount, warnCount, failCount, errorCount, allDone, allPassed, summaryClass };
  }, [results, verifying]);

  return {
    results, verifying, progress,
    enabledRows, requestCols, validateCols,
    summary,
    runVerification, refetchFailedRows,
    setResults, draftRef,
  };
}
