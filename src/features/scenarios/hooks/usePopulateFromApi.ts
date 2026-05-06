/**
 * Hook for PopulateFromApiModal logic.
 * Handles fetching, array detection, field mapping, and row population.
 */
import { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { proxyFetch, buildHeaders } from '../../../engine/executor';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import {
  detectArrays,
  resolvePath,
  findUnresolvedTokens,
  createFieldMappings,
  selectBestArray,
  findMatchingColumn,
  detectDuplicateRows,
  stringifyValue,
  type DetectedArray,
  type FieldMapping,
  type RequestDebugInfo,
  type ResponseDebugInfo,
} from '../utils/populateFromApiUtils';

export interface ExtendedHttpResponse extends HttpResponse {
  sentHeaders?: Record<string, string>;
  sentUrl?: string;
  sentMethod?: string;
  sentBody?: string;
}

export interface UsePopulateFromApiOptions {
  draft: Scenario;
  dataTable: DataSource;
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<ExtendedHttpResponse>;
}

export interface UsePopulateFromApiResult {
  step: 'fetch' | 'map';
  setStep: (step: 'fetch' | 'map') => void;
  loading: boolean;
  error: string | null;
  responseObj: unknown;
  selectedArray: string;
  fieldMappings: FieldMapping[];
  insertMode: 'append' | 'replace';
  setInsertMode: (mode: 'append' | 'replace') => void;
  rowSelections: boolean[];
  setRowSelections: React.Dispatch<React.SetStateAction<boolean[]>>;
  lastRequest: RequestDebugInfo | null;
  lastResponse: ResponseDebugInfo | null;
  detectedArrays: DetectedArray[];
  arrayItems: Record<string, unknown>[];
  enabledMappings: FieldMapping[];
  duplicateFlags: boolean[];
  duplicateCount: number;
  effectiveSelections: boolean[];
  selectedCount: number;
  handleFetch: () => Promise<void>;
  handleArrayChange: (path: string) => void;
  toggleField: (field: string) => void;
  changeFieldType: (field: string, colType: DataSourceColumn['type']) => void;
  buildPopulatedData: () => { columns: DataSourceColumn[]; rows: DataSourceRow[] } | null;
}

export function usePopulateFromApi({ draft, dataTable, onFetchRow }: UsePopulateFromApiOptions): UsePopulateFromApiResult {
  const [step, setStep] = useState<'fetch' | 'map'>('fetch');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseObj, setResponseObj] = useState<unknown>(null);
  const [selectedArray, setSelectedArray] = useState<string>('');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [insertMode, setInsertMode] = useState<'append' | 'replace'>('append');
  const [rowSelections, setRowSelections] = useState<boolean[]>([]);
  const [lastRequest, setLastRequest] = useState<RequestDebugInfo | null>(null);
  const [lastResponse, setLastResponse] = useState<ResponseDebugInfo | null>(null);

  const detectedArrays = useMemo<DetectedArray[]>(() => {
    if (!responseObj) return [];
    return detectArrays(responseObj);
  }, [responseObj]);

  const arrayItems = useMemo<Record<string, unknown>[]>(() => {
    if (!responseObj || !selectedArray) return [];
    const arr = resolvePath(responseObj, selectedArray);
    if (!Array.isArray(arr)) return [];
    return arr.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object');
  }, [responseObj, selectedArray]);

  const enabledMappings = useMemo(() => fieldMappings.filter(m => m.enabled), [fieldMappings]);

  const duplicateFlags = useMemo<boolean[]>(() => {
    if (insertMode !== 'append' || dataTable.rows.length === 0 || enabledMappings.length === 0) {
      return arrayItems.map(() => false);
    }
    return detectDuplicateRows(arrayItems, enabledMappings, dataTable.columns, dataTable.rows);
  }, [insertMode, dataTable.rows, dataTable.columns, enabledMappings, arrayItems]);

  const duplicateCount = duplicateFlags.filter(Boolean).length;

  const effectiveSelections = useMemo(() => {
    if (rowSelections.length === arrayItems.length && arrayItems.length > 0) {
      return rowSelections;
    }
    return duplicateFlags.map(isDup => !isDup);
  }, [rowSelections, arrayItems.length, duplicateFlags]);

  const selectedCount = effectiveSelections.filter(Boolean).length;

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastResponse(null);
    try {
      const firstRow = dataTable.rows.find(r => r.enabled);
      const resolved = firstRow
        ? resolveScenarioFromDataRow(draft, dataTable.columns, firstRow, 0)
        : draft;

      const baseHeaders = buildHeaders(resolved);
      const baseBody = resolved.body || undefined;

      const unresolved = findUnresolvedTokens(resolved.url, baseBody, baseHeaders);
      if (unresolved.length > 0) {
        const tokens = unresolved.join(', ');
        setError(`Unresolved variables in request: ${tokens}. Fill the first enabled row values before sending.`);
        setLastRequest({
          method: resolved.method,
          url: resolved.url,
          headers: baseHeaders,
          body: baseBody,
        });
        setLastResponse(null);
        return;
      }

      setLastRequest({
        method: resolved.method,
        url: resolved.url,
        headers: baseHeaders,
        body: baseBody,
      });

      const doFetch = onFetchRow ?? proxyFetch;
      const result: Partial<ExtendedHttpResponse> & HttpResponse = await doFetch(
        resolved.url,
        resolved.method,
        baseHeaders,
        baseBody,
      );

      const effectiveHeaders = result.sentHeaders ?? baseHeaders;
      const effectiveUrl = result.sentUrl ?? resolved.url;
      const effectiveMethod = result.sentMethod ?? resolved.method;
      const effectiveBody = result.sentBody ?? baseBody;

      setLastRequest({
        method: effectiveMethod,
        url: effectiveUrl,
        headers: effectiveHeaders,
        body: effectiveBody,
      });
      setLastResponse({
        status: result.status,
        statusText: result.statusText,
        error: result.error,
        body: result.body,
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.status >= 400) {
        setError(`HTTP ${result.status}: ${result.statusText}`);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.body);
      } catch {
        setError('Response is not valid JSON');
        return;
      }

      setResponseObj(parsed);
      const arrays = detectArrays(parsed);
      if (arrays.length === 0) {
        setError('No arrays of objects found in the response');
        return;
      }

      const best = selectBestArray(arrays);
      if (best) {
        setSelectedArray(best.path);
        setFieldMappings(createFieldMappings(best.sampleKeys, dataTable.columns));
      }

      setStep('map');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLastResponse({
        status: 0,
        statusText: 'Unhandled Error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [draft, dataTable.rows, dataTable.columns, onFetchRow]);

  const handleArrayChange = useCallback((path: string) => {
    setSelectedArray(path);
    const arr = resolvePath(responseObj, path);
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
      const keys = Object.keys(arr[0] as Record<string, unknown>);
      setFieldMappings(createFieldMappings(keys, dataTable.columns));
    }
  }, [responseObj, dataTable.columns]);

  const toggleField = useCallback((field: string) => {
    setFieldMappings(prev => prev.map(m =>
      m.field === field ? { ...m, enabled: !m.enabled } : m,
    ));
  }, []);

  const changeFieldType = useCallback((field: string, colType: DataSourceColumn['type']) => {
    setFieldMappings(prev => prev.map(m =>
      m.field === field ? { ...m, colType } : m,
    ));
  }, []);

  const buildPopulatedData = useCallback((): { columns: DataSourceColumn[]; rows: DataSourceRow[] } | null => {
    const enabledMappings = fieldMappings.filter(m => m.enabled);
    if (enabledMappings.length === 0 || arrayItems.length === 0) return null;

    const columns: DataSourceColumn[] = [...dataTable.columns];
    const fieldToColId: Record<string, string> = {};

    const arrayPrefix = selectedArray === '$' ? '' : selectedArray;
    const indexedColMap: Map<string, Map<number, DataSourceColumn>> = new Map();
    if (arrayPrefix) {
      for (const col of columns) {
        const m = col.mapping ?? '';
        const regex = new RegExp(`^${arrayPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[(\\d+)\\]\\.(.+)$`);
        const match = m.match(regex);
        if (match) {
          const idx = parseInt(match[1], 10);
          const field = match[2];
          if (!indexedColMap.has(field)) indexedColMap.set(field, new Map());
          indexedColMap.get(field)!.set(idx, col);
        }
      }
    }

    const hasIndexedColumns = enabledMappings.some(m => indexedColMap.has(m.field));

    if (hasIndexedColumns) {
      const indexedFieldToColIds: Map<string, Map<number, string>> = new Map();
      for (const mapping of enabledMappings) {
        const byIndex = indexedColMap.get(mapping.field);
        if (byIndex) {
          const idMap = new Map<number, string>();
          for (const [idx, col] of byIndex) {
            idMap.set(idx, col.id);
          }
          indexedFieldToColIds.set(mapping.field, idMap);
        } else {
          const existing = findMatchingColumn(columns, mapping.field, mapping.colType);
          if (existing) {
            fieldToColId[mapping.field] = existing.id;
          } else {
            const id = uuidv4();
            columns.push({ id, name: mapping.field, type: mapping.colType, mapping: mapping.field });
            fieldToColId[mapping.field] = id;
          }
        }
      }

      const baselineRow = dataTable.rows.find(r => r.enabled) ?? dataTable.rows[0];
      const values: Record<string, string> = {};
      for (const col of columns) {
        values[col.id] = baselineRow?.values[col.id] ?? '';
      }
      for (let i = 0; i < arrayItems.length; i++) {
        const item = arrayItems[i];
        for (const mapping of enabledMappings) {
          const byIndex = indexedFieldToColIds.get(mapping.field);
          if (byIndex) {
            const colId = byIndex.get(i);
            if (colId) {
              values[colId] = stringifyValue(item[mapping.field]);
            }
          } else if (i === 0 && fieldToColId[mapping.field]) {
            values[fieldToColId[mapping.field]] = stringifyValue(item[mapping.field]);
          }
        }
      }

      return { columns, rows: [{ id: uuidv4(), values, enabled: true }] };
    } else {
      for (const mapping of enabledMappings) {
        const existing = findMatchingColumn(columns, mapping.field, mapping.colType);
        if (existing) {
          fieldToColId[mapping.field] = existing.id;
        } else {
          const id = uuidv4();
          columns.push({ id, name: mapping.field, type: mapping.colType, mapping: mapping.field });
          fieldToColId[mapping.field] = id;
        }
      }

      const baselineRow = dataTable.rows.find(r => r.enabled) ?? dataTable.rows[0];
      const selectedItems = insertMode === 'append'
        ? arrayItems.filter((_, i) => effectiveSelections[i] !== false)
        : arrayItems;

      const newRows: DataSourceRow[] = selectedItems.map(item => {
        const values: Record<string, string> = {};
        for (const col of columns) {
          values[col.id] = baselineRow?.values[col.id] ?? '';
        }
        for (const mapping of enabledMappings) {
          const colId = fieldToColId[mapping.field];
          values[colId] = stringifyValue(item[mapping.field]);
        }
        return { id: uuidv4(), values, enabled: true };
      });

      return { columns, rows: newRows };
    }
  }, [fieldMappings, arrayItems, selectedArray, dataTable.columns, dataTable.rows, insertMode, effectiveSelections]);

  return {
    step,
    setStep,
    loading,
    error,
    responseObj,
    selectedArray,
    fieldMappings,
    insertMode,
    setInsertMode,
    rowSelections,
    setRowSelections,
    lastRequest,
    lastResponse,
    detectedArrays,
    arrayItems,
    enabledMappings,
    duplicateFlags,
    duplicateCount,
    effectiveSelections,
    selectedCount,
    handleFetch,
    handleArrayChange,
    toggleField,
    changeFieldType,
    buildPopulatedData,
  };
}
