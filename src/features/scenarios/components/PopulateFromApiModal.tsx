/**
 * PopulateFromApiModal — Sends a request to the test's URL, detects arrays in the
 * JSON response, lets the user map response fields to data source columns, and
 * populates the data source with extracted rows.
 */
import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { proxyFetch, buildHeaders } from '../../../engine/executor';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import AppModalFrame from '../../../shared/components/AppModalFrame';

// ─── Types ───────────────────────────────────────────────────

interface DetectedArray {
  path: string;
  length: number;
  sampleKeys: string[];
}

interface FieldMapping {
  field: string;
  colType: DataSourceColumn['type'];
  enabled: boolean;
}

interface RequestDebugInfo {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

interface ResponseDebugInfo {
  status: number;
  statusText: string;
  error?: string;
  body?: string;
}

interface ExtendedHttpResponse extends HttpResponse {
  sentHeaders?: Record<string, string>;
  sentUrl?: string;
  sentMethod?: string;
  sentBody?: string;
}

interface Props {
  draft: Scenario;
  dataTable: DataSource;
  onApply: (columns: DataSourceColumn[], rows: DataSourceRow[], mode: 'append' | 'replace') => void;
  onClose: () => void;
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<ExtendedHttpResponse>;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Walk a JSON object to find all arrays and their paths */
function detectArrays(obj: unknown, prefix = ''): DetectedArray[] {
  const results: DetectedArray[] = [];
  if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
    const keys = Object.keys(obj[0] as Record<string, unknown>);
    results.push({ path: prefix || '$', length: obj.length, sampleKeys: keys });
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${key}` : key;
      results.push(...detectArrays(val, p));
    }
  }
  return results;
}

/** Resolve a JSONPath-like string to a value in an object */
function resolvePath(obj: unknown, path: string): unknown {
  if (path === '$') return obj;
  const segments = path.split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** Guess a column type from the field name */
function guessColType(field: string): DataSourceColumn['type'] {
  const lower = field.toLowerCase();
  if (lower === 'id' || lower.endsWith('_id') || lower.endsWith('Id')) return 'path';
  // Populate-from-response fields are typically validation/output fields, not request inputs.
  return 'validate';
}

function collectTemplateTokens(value: string | undefined): string[] {
  if (!value) return [];
  const source = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  const matches = source.match(/\{\{\s*[^{}\s]+\s*\}\}/g) ?? [];
  return Array.from(new Set(matches.map(m => m.replace(/\s+/g, ''))));
}

// ─── Component ───────────────────────────────────────────────

export default function PopulateFromApiModal({ draft, dataTable, onApply, onClose, onFetchRow }: Props) {
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

  // Detect arrays in the response
  const detectedArrays = useMemo<DetectedArray[]>(() => {
    if (!responseObj) return [];
    return detectArrays(responseObj);
  }, [responseObj]);

  // Items from the selected array
  const arrayItems = useMemo<Record<string, unknown>[]>(() => {
    if (!responseObj || !selectedArray) return [];
    const arr = resolvePath(responseObj, selectedArray);
    if (!Array.isArray(arr)) return [];
    return arr.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object');
  }, [responseObj, selectedArray]);

  // ─── Step 1: Fetch ─────────────────────────────────────────

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastResponse(null);
    try {
      // Resolve template variables using the first enabled data row (if any)
      const firstRow = dataTable.rows.find(r => r.enabled);
      const resolved = firstRow
        ? resolveScenarioFromDataRow(draft, dataTable.columns, firstRow, 0)
        : draft;

      const baseHeaders = buildHeaders(resolved);
      const baseBody = resolved.body || undefined;

      const unresolved = new Set<string>();
      for (const token of collectTemplateTokens(resolved.url)) unresolved.add(token);
      for (const token of collectTemplateTokens(baseBody)) unresolved.add(token);
      for (const v of Object.values(baseHeaders)) {
        for (const token of collectTemplateTokens(v)) unresolved.add(token);
      }
      if (unresolved.size > 0) {
        const tokens = Array.from(unresolved).join(', ');
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
      const result = await doFetch(
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

      // Auto-select the first (or largest) array
      const best = arrays.reduce((a, b) => b.length > a.length ? b : a, arrays[0]);
      setSelectedArray(best.path);

      // Auto-create field mappings from the selected array's keys
      // If there are existing validate columns, only pre-enable fields that match them
      const existingValidateMappings = new Set(
        (dataTable?.columns ?? [])
          .filter(c => c.type === 'validate')
          .map(c => c.mapping.replace(/.*\./, '')),  // strip JSONPath prefix to get leaf name
      );
      const hasExistingValidate = existingValidateMappings.size > 0;
      setFieldMappings(best.sampleKeys.map(field => ({
        field,
        colType: guessColType(field),
        enabled: hasExistingValidate ? existingValidateMappings.has(field) : true,
      })));

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
  }, [draft, onFetchRow]);

  // When user changes the selected array
  const handleArrayChange = useCallback((path: string) => {
    setSelectedArray(path);
    const arr = resolvePath(responseObj, path);
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
      const keys = Object.keys(arr[0] as Record<string, unknown>);
      const existingValidateMappings = new Set(
        (dataTable?.columns ?? [])
          .filter(c => c.type === 'validate')
          .map(c => c.mapping.replace(/.*\./, '')),
      );
      const hasExistingValidate = existingValidateMappings.size > 0;
      setFieldMappings(keys.map(field => ({
        field,
        colType: guessColType(field),
        enabled: hasExistingValidate ? existingValidateMappings.has(field) : true,
      })));
    }
  }, [responseObj, dataTable]);

  // Toggle a field mapping
  const toggleField = useCallback((field: string) => {
    setFieldMappings(prev => prev.map(m =>
      m.field === field ? { ...m, enabled: !m.enabled } : m,
    ));
  }, []);

  // Change column type for a field
  const changeFieldType = useCallback((field: string, colType: DataSourceColumn['type']) => {
    setFieldMappings(prev => prev.map(m =>
      m.field === field ? { ...m, colType } : m,
    ));
  }, []);

  // ─── Step 2: Populate ──────────────────────────────────────

  // ─── Preview rows & dedup ──────────────────────────────────

  const enabledMappings = useMemo(() => fieldMappings.filter(m => m.enabled), [fieldMappings]);

  // Compute per-row duplicate flags against existing data
  const duplicateFlags = useMemo<boolean[]>(() => {
    if (insertMode !== 'append' || dataTable.rows.length === 0 || enabledMappings.length === 0) {
      return arrayItems.map(() => false);
    }
    const normalize = (v: string) => v.trim().toLowerCase();
    const colIdByField: Record<string, string> = {};
    for (const mapping of enabledMappings) {
      const fieldNorm = normalize(mapping.field);
      const existing = dataTable.columns.find(c => c.type === mapping.colType && normalize(c.mapping ?? '') === fieldNorm)
        || dataTable.columns.find(c => c.type === mapping.colType && normalize(c.name) === fieldNorm)
        || dataTable.columns.find(c => normalize(c.name) === fieldNorm);
      if (existing) colIdByField[mapping.field] = existing.id;
    }
    const colIds = enabledMappings.map(m => colIdByField[m.field]).filter(Boolean);
    if (colIds.length === 0) return arrayItems.map(() => false);
    const fingerprint = (row: DataSourceRow) =>
      colIds.map(cid => (row.values[cid] ?? '').trim().toLowerCase()).join('\x00');
    const existingFps = new Set(dataTable.rows.map(fingerprint));
    return arrayItems.map(item => {
      const vals: Record<string, string> = {};
      for (const mapping of enabledMappings) {
        const cid = colIdByField[mapping.field];
        if (!cid) continue;
        const val = item[mapping.field];
        vals[cid] = val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
      }
      const fp = colIds.map(cid => (vals[cid] ?? '').trim().toLowerCase()).join('\x00');
      return existingFps.has(fp);
    });
  }, [insertMode, dataTable.rows, dataTable.columns, enabledMappings, arrayItems]);

  const duplicateCount = duplicateFlags.filter(Boolean).length;

  // Effective selections: use rowSelections when initialized, otherwise derive from duplicateFlags
  const effectiveSelections = useMemo(() => {
    if (rowSelections.length === arrayItems.length && arrayItems.length > 0) {
      return rowSelections;
    }
    return duplicateFlags.map(isDup => !isDup);
  }, [rowSelections, arrayItems.length, duplicateFlags]);
  const selectedCount = effectiveSelections.filter(Boolean).length;

  const handlePopulate = useCallback(() => {
    const enabledMappings = fieldMappings.filter(m => m.enabled);
    if (enabledMappings.length === 0 || arrayItems.length === 0) return;

    // Build columns — reuse existing columns when name+type match, else create new
    const columns: DataSourceColumn[] = [...dataTable.columns];
    const fieldToColId: Record<string, string> = {};

    const normalize = (value: string): string => value.trim().toLowerCase();

    // Detect indexed array columns: e.g. "offers[0].associatedOfferingCode", "offers[1].offerName"
    // Pattern: selectedArray[<index>].<fieldName>
    const arrayPrefix = selectedArray === '$' ? '' : selectedArray;
    const indexedColMap: Map<string, Map<number, DataSourceColumn>> = new Map(); // field -> { index -> col }
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

    // Check if the enabled fields have indexed columns — if so, flatten into one row
    const hasIndexedColumns = enabledMappings.some(m => indexedColMap.has(m.field));

    if (hasIndexedColumns) {
      // ── Flattened mode: all array items go into a single row across indexed columns ──
      // Map each field+index to its column ID
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
          // Non-indexed field — find or create a single column
          const fieldNorm = normalize(mapping.field);
          const existing = columns.find(c => c.type === mapping.colType && normalize(c.mapping ?? '') === fieldNorm)
            || columns.find(c => c.type === mapping.colType && normalize(c.name) === fieldNorm)
            || columns.find(c => normalize(c.name) === fieldNorm);
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
      // Fill indexed fields from each array item
      for (let i = 0; i < arrayItems.length; i++) {
        const item = arrayItems[i];
        for (const mapping of enabledMappings) {
          const byIndex = indexedFieldToColIds.get(mapping.field);
          if (byIndex) {
            const colId = byIndex.get(i);
            if (colId) {
              const val = item[mapping.field];
              values[colId] = val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
            }
          } else if (i === 0 && fieldToColId[mapping.field]) {
            // Non-indexed field: take value from first item only
            const val = item[mapping.field];
            values[fieldToColId[mapping.field]] = val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
          }
        }
      }

      const newRows: DataSourceRow[] = [{ id: uuidv4(), values, enabled: true }];
      onApply(columns, newRows, insertMode);
    } else {
      // ── Standard mode: one row per array item ──
      for (const mapping of enabledMappings) {
        const fieldNorm = normalize(mapping.field);
        const existing = columns.find(c =>
          c.type === mapping.colType && normalize(c.mapping ?? '') === fieldNorm,
        )
          || columns.find(c =>
            c.type === mapping.colType && normalize(c.name) === fieldNorm,
          )
          || (mapping.colType === 'validate'
            ? columns.find(c => {
                if (c.type !== 'validate') return false;
                const m = normalize(c.mapping ?? '');
                return m.endsWith(`.${fieldNorm}`) || m.endsWith(`[${fieldNorm}]`) || m === fieldNorm;
              })
            : undefined)
          || columns.find(c => normalize(c.name) === fieldNorm);

        if (existing) {
          fieldToColId[mapping.field] = existing.id;
        } else {
          const id = uuidv4();
          columns.push({ id, name: mapping.field, type: mapping.colType, mapping: mapping.field });
          fieldToColId[mapping.field] = id;
        }
      }

      const baselineRow = dataTable.rows.find(r => r.enabled) ?? dataTable.rows[0];
      // Only include rows the user has selected
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
          const val = item[mapping.field];
          values[colId] = val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
        }
        return { id: uuidv4(), values, enabled: true };
      });

      onApply(columns, newRows, insertMode);
    }
    onClose();
  }, [fieldMappings, arrayItems, selectedArray, dataTable.columns, dataTable.rows, insertMode, effectiveSelections, onApply, onClose]);

  // ─── Render ────────────────────────────────────────────────

  return createPortal(
    <AppModalFrame
      title="Populate from API Response"
      onClose={onClose}
      overlayClassName="populate-api-overlay modal-overlay"
      dialogClassName="populate-api-modal modal"
      bodyClassName="populate-api-body"
      showExpandButton={false}
      closeButtonKind="none"
      closeOnOverlayClick={false}
      footer={
        step === 'map' ? (
          <div className="populate-api-footer">
            <div className="populate-api-footer-top">
              <div className="populate-api-footer-info">
                {insertMode === 'append'
                  ? <>{selectedCount} of {arrayItems.length} rows selected{duplicateCount > 0 && <span className="populate-api-dedup-info"> · {duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''}</span>} · {enabledMappings.length} fields mapped</>
                  : <>{arrayItems.length} rows from <code>{selectedArray}</code> · {enabledMappings.length} fields mapped</>
                }
              </div>
              <div className="populate-api-footer-controls">
                <select
                  className="populate-api-mode-select"
                  value={insertMode}
                  onChange={e => setInsertMode(e.target.value as 'append' | 'replace')}
                >
                  <option value="append">Append to existing rows</option>
                  <option value="replace">Replace all rows</option>
                </select>
              </div>
            </div>
            <div className="populate-api-footer-actions">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={enabledMappings.length === 0 || (insertMode === 'append' ? selectedCount === 0 : arrayItems.length === 0)}
                onClick={handlePopulate}
              >
                {insertMode === 'append'
                  ? `Populate ${selectedCount} Row${selectedCount !== 1 ? 's' : ''}`
                  : `Populate ${arrayItems.length} Rows`
                }
              </button>
            </div>
          </div>
        ) : (
          <div className="populate-api-footer-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        )
      }
    >
      {step === 'fetch' && (
        <div className="populate-api-fetch">
          <p className="populate-api-description">
            Send a request to this test's URL, then extract an array from the response to populate data rows.
            {dataTable.rows.some(r => r.enabled) && ' Variables will be resolved using the first enabled data row.'}
          </p>
          <div className="populate-api-hint">
            <strong>💡 Best for cross-API testing:</strong> Call a "list" API (e.g. <code>GET /users</code>) and use the
            returned array as input rows for a "detail" API (e.g. <code>GET /users/{'{{id}}'}</code>).
            Not useful when populating from the same endpoint — response fields are outputs, not inputs.
            <br /><em>See the "Populate from API" sample in Gallery Samples for a step-by-step example.</em>
          </div>
          <div className="populate-api-request-info">
            <span className={`method-badge method-${draft.method.toLowerCase()}`}>{draft.method}</span>
            <code className="populate-api-url">{(() => {
              const firstRow = dataTable.rows.find(r => r.enabled);
              if (!firstRow) return draft.url;
              return resolveScenarioFromDataRow(draft, dataTable.columns, firstRow, 0).url;
            })()}</code>
          </div>
          {error && <div className="populate-api-error">⚠️ {error}</div>}
          <button
            className="btn btn-primary"
            disabled={loading}
            onClick={() => void handleFetch()}
          >
            {loading ? '⏳ Sending…' : '▶ Send Request'}
          </button>

          {(lastRequest || lastResponse) && (
            <div className="populate-api-debug">
              <div className="populate-api-debug-title">Request / Response Details</div>

              {lastRequest && (
                <div className="populate-api-debug-block">
                  <div className="populate-api-debug-subtitle">Request</div>
                  <div className="populate-api-debug-line"><strong>Method:</strong> {lastRequest.method}</div>
                  <div className="populate-api-debug-line"><strong>URL:</strong> {lastRequest.url}</div>
                  <div className="populate-api-debug-line"><strong>Headers:</strong></div>
                  <pre className="populate-api-debug-pre">
                    {Object.keys(lastRequest.headers).length > 0
                      ? JSON.stringify(lastRequest.headers, null, 2)
                      : '{}'}
                  </pre>
                  <div className="populate-api-debug-line"><strong>Body:</strong></div>
                  <pre className="populate-api-debug-pre">{lastRequest.body || '(empty)'}</pre>
                </div>
              )}

              {lastResponse && (
                <div className="populate-api-debug-block">
                  <div className="populate-api-debug-subtitle">Response</div>
                  <div className="populate-api-debug-line"><strong>Status:</strong> {lastResponse.status} {lastResponse.statusText}</div>
                  {lastResponse.error && (
                    <div className="populate-api-debug-line"><strong>Error:</strong> {lastResponse.error}</div>
                  )}
                  <div className="populate-api-debug-line"><strong>Body:</strong></div>
                  <pre className="populate-api-debug-pre">{lastResponse.body || '(empty)'}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'map' && (
        <div className="populate-api-map">
          {/* Array selector */}
          {detectedArrays.length > 1 && (
            <div className="populate-api-array-selector">
              <label>Array source:</label>
              <select
                value={selectedArray}
                onChange={e => handleArrayChange(e.target.value)}
              >
                {detectedArrays.map(a => (
                  <option key={a.path} value={a.path}>
                    {a.path === '$' ? '$ (root)' : a.path} — {a.length} items
                  </option>
                ))}
              </select>
            </div>
          )}
          {detectedArrays.length === 1 && (
            <div className="populate-api-array-info">
              Array: <code>{selectedArray === '$' ? '$ (root)' : selectedArray}</code> — {arrayItems.length} items
            </div>
          )}

          {/* Field mapping table */}
          <div className="populate-api-fields">
            <div className="populate-api-fields-header">
              <span>Include</span>
              <span>Response Field</span>
              <span>Column Type</span>
              <span>Sample Value</span>
            </div>
            {fieldMappings.map(m => {
              const sampleVal = arrayItems[0]?.[m.field];
              const displayVal = sampleVal == null ? '' : (typeof sampleVal === 'object' ? JSON.stringify(sampleVal) : String(sampleVal));
              return (
                <div key={m.field} className={`populate-api-field-row ${m.enabled ? '' : 'disabled'}`}>
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={() => toggleField(m.field)}
                  />
                  <code className="populate-api-field-name">{m.field}</code>
                  <select
                    value={m.colType}
                    onChange={e => changeFieldType(m.field, e.target.value as DataSourceColumn['type'])}
                    disabled={!m.enabled}
                  >
                    <option value="path">Path</option>
                    <option value="param">Param</option>
                    <option value="body">Body</option>
                    <option value="header">Header</option>
                    <option value="validate">Validate</option>
                  </select>
                  <span className="populate-api-sample-val" title={displayVal}>
                    {displayVal.length > 50 ? displayVal.slice(0, 50) + '…' : displayVal}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Preview with per-row selection */}
          {arrayItems.length > 0 && enabledMappings.length > 0 && (
            <div className="populate-api-preview">
              <div className="populate-api-preview-title">
                {duplicateCount > 0
                  ? `${arrayItems.length} rows — ${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} found`
                  : `Preview (${arrayItems.length} rows)`
                }
                {insertMode === 'append' && duplicateCount > 0 && (
                  <span className="populate-api-preview-actions">
                    <button type="button" className="btn-link" onClick={() => setRowSelections(arrayItems.map(() => true))}>Select All</button>
                    <button type="button" className="btn-link" onClick={() => setRowSelections(duplicateFlags.map(d => !d))}>New Only</button>
                    <button type="button" className="btn-link" onClick={() => setRowSelections(arrayItems.map(() => false))}>None</button>
                  </span>
                )}
              </div>
              <div className="populate-api-preview-table-wrap">
                <table className="populate-api-preview-table">
                  <thead>
                    <tr>
                      {insertMode === 'append' && <th className="populate-api-preview-th-check" />}
                      {insertMode === 'append' && duplicateCount > 0 && <th>Status</th>}
                      {enabledMappings.map(m => (
                        <th key={m.field}>{m.field}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arrayItems.map((item, i) => {
                      const isDup = duplicateFlags[i];
                      const isSelected = effectiveSelections[i] ?? true;
                      return (
                        <tr key={i} className={!isSelected && insertMode === 'append' ? 'populate-api-row-excluded' : ''}>
                          {insertMode === 'append' && (
                            <td className="populate-api-preview-td-check">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => setRowSelections(() => {
                                  const next = [...effectiveSelections];
                                  next[i] = !next[i];
                                  return next;
                                })}
                              />
                            </td>
                          )}
                          {insertMode === 'append' && duplicateCount > 0 && (
                            <td>
                              <span className={`populate-api-row-badge ${isDup ? 'populate-api-row-badge-dup' : 'populate-api-row-badge-new'}`}>
                                {isDup ? 'Duplicate' : 'New'}
                              </span>
                            </td>
                          )}
                          {enabledMappings.map(m => {
                            const val = item[m.field];
                            const display = val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
                            return <td key={m.field} title={display}>{display.length > 40 ? display.slice(0, 40) + '…' : display}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AppModalFrame>,
    document.body,
  );
}
