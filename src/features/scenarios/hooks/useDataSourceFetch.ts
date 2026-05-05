/**
 * useDataSourceFetch — Fetch row response, re-fetch all, populate validate columns.
 *
 * Extracted from DataSourceEditor to enable reuse in SharedDataSourceModal.
 */
import { useState, useCallback, useRef } from 'react';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import { proxyFetch, buildHeaders } from '../../../engine/executor';
import { extractJsonPath, expandPatternFromResponse, inferPatternsFromColumns } from '../utils/dataSourceImport';
import { v4 as uuidv4 } from 'uuid';

/** Populate validate columns from a parsed response, expanding dynamic patterns as needed. */
function populateValidateColumns(
  responseObj: unknown,
  columns: DataSourceColumn[],
  rowValues: Record<string, string>,
  dynamicPatterns: Set<string>,
): { columns: DataSourceColumn[]; updatedValues: Record<string, string>; newColumns: DataSourceColumn[] } {
  let cols = [...columns];
  const updatedValues = { ...rowValues };
  const newColumns: DataSourceColumn[] = [];

  // Build set of paths that actually exist in the response for dynamic patterns
  const dynamicExpandedPaths = new Set<string>();
  if (dynamicPatterns.size > 0) {
    for (const pattern of dynamicPatterns) {
      const paths = expandPatternFromResponse(responseObj, pattern);
      for (const path of paths) {
        dynamicExpandedPaths.add(path);
      }
    }
  }

  // Fill existing validate columns
  const validateCols = cols.filter(c => c.type === 'validate');
  for (const col of validateCols) {
    const extracted = extractJsonPath(responseObj, col.mapping);
    if (extracted !== '') {
      updatedValues[col.id] = extracted;
    } else {
      // If this column matches a dynamic pattern and the path is NOT in the response,
      // clear the value so stale data from a different-length array doesn't persist.
      const matchesDynamic = [...dynamicPatterns].some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\[\*\]/g, '\\[\\d+\\]').replace(/\./g, '\\.') + '$');
        return regex.test(col.mapping);
      });
      if (matchesDynamic) {
        updatedValues[col.id] = '';
      }
    }
  }

  // Expand dynamic patterns — add new columns for paths not yet covered
  if (dynamicPatterns.size > 0) {
    for (const path of dynamicExpandedPaths) {
      const exists = cols.some(c => c.type === 'validate' && c.mapping === path);
      if (!exists) {
        const colId = uuidv4();
        const name = path.replace(/\[(\d+)\]/g, '$1').replace(/\./g, '_');
        const newCol: DataSourceColumn = { id: colId, name, type: 'validate', mapping: path };
        cols = [...cols, newCol];
        newColumns.push(newCol);
        updatedValues[colId] = extractJsonPath(responseObj, path);
      }
    }
  }

  return { columns: cols, updatedValues, newColumns };
}

/** Add empty values for new columns to rows that aren't the current row. */
function backfillNewColumns(rows: DataSourceRow[], currentRowId: string, newColumns: DataSourceColumn[]): DataSourceRow[] {
  if (newColumns.length === 0) return rows;
  return rows.map(r => {
    if (r.id === currentRowId) return r;
    const values = { ...r.values };
    for (const col of newColumns) {
      if (!values[col.id]) values[col.id] = '';
    }
    return { ...r, values };
  });
}

export interface UseDataSourceFetchOptions {
  /** The scenario (or effective scenario when shared DS is linked) */
  scenario: Scenario;
  dataSource: DataSource | undefined;
  onChange: (ds: DataSource) => void;
  /** Auth-aware fetch: resolves effective auth, acquires tokens, fires request. */
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
}

export interface UseDataSourceFetchReturn {
  fetchRowResponse: (rowId: string) => Promise<void>;
  refetchAllRows: () => Promise<void>;
  fetchingRowId: string | null;
  refetchingAll: boolean;
  fetchRowError: string | null;
  fetchRowErrorDetail: { url?: string; body?: string } | null;
  clearFetchError: () => void;
}

export function useDataSourceFetch({ scenario, dataSource: dt, onChange, onFetchRow }: UseDataSourceFetchOptions): UseDataSourceFetchReturn {
  const [fetchingRowId, setFetchingRowId] = useState<string | null>(null);
  const [fetchRowError, setFetchRowError] = useState<string | null>(null);
  const [fetchRowErrorDetail, setFetchRowErrorDetail] = useState<{ url?: string; body?: string } | null>(null);
  const [refetchingAll, setRefetchingAll] = useState(false);

  // Keep refs to latest values for async callbacks
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  const dtRef = useRef(dt);
  dtRef.current = dt;

  const fetchRowResponse = useCallback(
    async (rowId: string) => {
      const currentScenario = scenarioRef.current;
      const currentDt = dtRef.current;
      if (!currentDt) return;
      const row = currentDt.rows.find(r => r.id === rowId);
      if (!row) return;
      const rowIdx = currentDt.rows.findIndex(r => r.id === rowId);

      setFetchingRowId(rowId);
      setFetchRowError(null);
      setFetchRowErrorDetail(null);

      try {
        const resolved = resolveScenarioFromDataRow(currentScenario, currentDt.columns, row, rowIdx);
        const doFetch = onFetchRow ?? proxyFetch;
        const result = await doFetch(resolved.url, resolved.method, buildHeaders(resolved), resolved.body || undefined);

        if (result.error) {
          setFetchRowError(result.error);
          setFetchRowErrorDetail({ url: resolved.url, body: result.body?.slice(0, 2000) });
          return;
        }
        if (result.status >= 400) {
          setFetchRowError(`HTTP ${result.status}: ${result.statusText}`);
          setFetchRowErrorDetail({ url: resolved.url, body: result.body?.slice(0, 2000) });
          return;
        }

        let responseObj: unknown = null;
        try { responseObj = JSON.parse(result.body); } catch { /* not JSON */ }

        if (responseObj != null) {
          const dynamicPatterns = new Set(currentDt.validationContract ?? []);
          for (const p of inferPatternsFromColumns(currentDt.columns, dynamicPatterns)) dynamicPatterns.add(p);

          const { columns, updatedValues, newColumns } = populateValidateColumns(
            responseObj, currentDt.columns, row.values, dynamicPatterns,
          );

          const hasValidateData = columns.some(c => c.type === 'validate' && updatedValues[c.id]);
          let rows = currentDt.rows.map(r =>
            r.id === rowId ? { ...r, values: updatedValues, ...(hasValidateData ? { isSample: true } : {}) } : r,
          );
          rows = backfillNewColumns(rows, rowId, newColumns);
          onChange({ ...currentDt, columns, rows });
        }
      } catch (err) {
        setFetchRowError(err instanceof Error ? err.message : String(err));
      } finally {
        setFetchingRowId(null);
      }
    },
    [onChange, onFetchRow],
  );

  const refetchAllRows = useCallback(async () => {
    const currentScenario = scenarioRef.current;
    const currentDt = dtRef.current;
    if (!currentDt) return;
    const enabledRows = currentDt.rows.filter(r => r.enabled);
    if (enabledRows.length === 0) return;

    setRefetchingAll(true);
    setFetchRowError(null);

    let columns = [...currentDt.columns];
    let rows = [...currentDt.rows];
    const dynamicPatterns = new Set(currentDt.validationContract ?? []);
    // Auto-infer patterns from existing indexed validate columns
    for (const p of inferPatternsFromColumns(columns, dynamicPatterns)) dynamicPatterns.add(p);
    const errors: string[] = [];

    try {
      for (const row of enabledRows) {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        try {
          const resolved = resolveScenarioFromDataRow(currentScenario, columns, row, rowIdx);
          const doFetch = onFetchRow ?? proxyFetch;
          const result = await doFetch(resolved.url, resolved.method, buildHeaders(resolved), resolved.body || undefined);

          if (result.error) { errors.push(`Row ${rowIdx + 1}: ${result.error}`); continue; }
          if (result.status >= 400) { errors.push(`Row ${rowIdx + 1}: HTTP ${result.status}`); continue; }

          let responseObj: unknown = null;
          try { responseObj = JSON.parse(result.body); } catch { /* not JSON */ }
          if (responseObj == null) continue;

          const result2 = populateValidateColumns(responseObj, columns, rows[rowIdx].values, dynamicPatterns);
          columns = result2.columns;

          rows = rows.map(r => r.id === row.id ? { ...r, values: result2.updatedValues } : r);
          rows = backfillNewColumns(rows, row.id, result2.newColumns);
        } catch (err) {
          errors.push(`Row ${rowIdx + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      onChange({ ...currentDt, columns, rows });
      if (errors.length > 0) setFetchRowError(errors.join('; '));
    } finally {
      setRefetchingAll(false);
    }
  }, [onChange, onFetchRow]);

  const clearFetchError = useCallback(() => {
    setFetchRowError(null);
    setFetchRowErrorDetail(null);
  }, []);

  return {
    fetchRowResponse,
    refetchAllRows,
    fetchingRowId,
    refetchingAll,
    fetchRowError,
    fetchRowErrorDetail,
    clearFetchError,
  };
}
