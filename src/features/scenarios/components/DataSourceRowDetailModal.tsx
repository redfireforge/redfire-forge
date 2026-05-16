import { useState, useCallback, useMemo } from 'react';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow, ExpectedField } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import { proxyFetch, buildHeaders } from '../../../engine/executor';
import { expandPatternFromResponse } from '../utils/dataSourceImport';
import {
  DataMapperModal,
  createValidationAdapter,
} from '../../../shared/components/data-mapper';
import { prettyJson } from '../../../shared/utils/helpers';
import type { ValidationAdapterOutput } from '../../../shared/components/data-mapper';

interface DataSourceRowDetailModalProps {
  draft: Scenario;
  dataTable: DataSource;
  row: DataSourceRow;
  rowIndex: number;
  onSave: (updatedRow: DataSourceRow, newColumns?: DataSourceColumn[]) => void;
  onClose: () => void;
  /** Auth-aware fetch function provided by parent. */
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
}

export default function DataSourceRowDetailModal({
  draft,
  dataTable,
  row,
  rowIndex,
  onSave,
  onClose,
  onFetchRow,
}: DataSourceRowDetailModalProps) {
  const [editedValues, setEditedValues] = useState<Record<string, string>>({ ...row.values });
  const [editedLabel, setEditedLabel] = useState(row.label ?? '');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [sampleJson, setSampleJson] = useState('');
  const [pendingFetchBody, setPendingFetchBody] = useState<string | null>(null);
  const [expectedFields, setExpectedFields] = useState<ExpectedField[]>(() => {
    return dataTable.columns
      .filter(c => c.type === 'validate')
      .filter(c => row.values[c.id]?.trim())
      .map(c => ({ jsonPath: c.mapping, expectedValue: row.values[c.id] }));
  });
  const [mapperOpen, setMapperOpen] = useState(false);

  const validationAdapter = useMemo(
    () => createValidationAdapter({
      sampleResponseBody: sampleJson || undefined,
      selectiveMode: 'include',
      expectedFields,
    }),
    [sampleJson, expectedFields],
  );

  const mapperInitialData = useMemo<ValidationAdapterOutput>(() => ({
    selectiveMode: 'include',
    expectedFields,
    excludedPaths: [],
  }), [expectedFields]);

  const handleMapperSave = useCallback((output: ValidationAdapterOutput) => {
    setExpectedFields(output.expectedFields);
    setMapperOpen(false);
  }, []);

  const inputColumns = useMemo(
    () => dataTable.columns.filter(c => c.type !== 'validate'),
    [dataTable.columns],
  );
  const validateColumns = useMemo(
    () => dataTable.columns.filter(c => c.type === 'validate'),
    [dataTable.columns],
  );

  const updateValue = useCallback((colId: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [colId]: value }));
  }, []);

  // ─── Fetch ─────────────────────────────────────────────────

  const handleFetch = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    setFetchStatus(null);

    try {
      const currentRow: DataSourceRow = { ...row, values: editedValues };
      const resolved = resolveScenarioFromDataRow(draft, dataTable.columns, currentRow, rowIndex);

      const doFetch = onFetchRow ?? proxyFetch;
      const result = await doFetch(
        resolved.url,
        resolved.method,
        buildHeaders(resolved),
        resolved.body || undefined,
      );

      if (result.error) {
        setFetchError(result.error);
        return;
      }

      const timing = result.timing?.total != null ? `${Math.round(result.timing.total)}ms` : '';

      if (result.status >= 400) {
        setFetchError(`HTTP ${result.status}: ${result.statusText}`);
        setFetchStatus(`${result.status} ${result.statusText}${timing ? ` — ${timing}` : ''}`);
        if (result.body) setSampleJson(result.body);
        return;
      }

      setFetchStatus(`${result.status} ${result.statusText}${timing ? ` — ${timing}` : ''}`);

      // Set the response JSON for validation
      if (result.body) {
        const pretty = prettyJson(result.body);

        // If user already has selections, show confirmation bar instead of auto-applying
        if (expectedFields.length > 0) {
          setPendingFetchBody(pretty);
        } else {
          // No existing selections — apply immediately
          setSampleJson(pretty);

          // Auto-select fields: dynamic patterns expand from response, fixed patterns use existing columns only
          try {
            const parsed = JSON.parse(result.body);
            const autoFields: ExpectedField[] = [];
            const dynamicPatterns = dataTable.validationContract ?? [];

            // 1. Expand dynamic patterns against the actual response
            for (const pattern of dynamicPatterns) {
              const paths = expandPatternFromResponse(parsed, pattern);
              for (const path of paths) {
                const value = getValueAtJsonPath(parsed, path);
                if (value !== undefined) {
                  autoFields.push({ jsonPath: path, expectedValue: JSON.stringify(value) });
                }
              }
            }

            // 2. For fixed (non-contract) validate columns, only select existing mappings
            const dynamicSet = new Set(dynamicPatterns);
            for (const col of validateColumns) {
              const pattern = col.mapping.replace(/\[\d+\]/g, '[*]');
              if (dynamicSet.has(pattern)) continue; // already handled by dynamic expansion
              const value = getValueAtJsonPath(parsed, col.mapping);
              if (value !== undefined) {
                autoFields.push({ jsonPath: col.mapping, expectedValue: JSON.stringify(value) });
              }
            }

            if (autoFields.length > 0) setExpectedFields(autoFields);
          } catch { /* not JSON */ }
        }
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  }, [draft, dataTable.columns, dataTable.validationContract, editedValues, row, rowIndex, validateColumns, expectedFields, onFetchRow]);

  // ─── Fetch confirmation handlers ──────────────────────────

  const handleFetchKeepRules = useCallback(() => {
    if (!pendingFetchBody) return;
    // Update the response JSON but keep existing field selections, updating their values
    setSampleJson(pendingFetchBody);
    try {
      const parsed = JSON.parse(pendingFetchBody);
      setExpectedFields(prev => prev.map(f => {
        const value = getValueAtJsonPath(parsed, f.jsonPath);
        if (value !== undefined) {
          return { ...f, expectedValue: JSON.stringify(value) };
        }
        return f;
      }));
    } catch { /* not JSON */ }
    setPendingFetchBody(null);
  }, [pendingFetchBody]);

  const handleFetchReplaceAll = useCallback(() => {
    if (!pendingFetchBody) return;
    // Replace response AND clear all field selections — user starts fresh
    setSampleJson(pendingFetchBody);
    setExpectedFields([]);
    setPendingFetchBody(null);
  }, [pendingFetchBody]);

  const handleFetchCancel = useCallback(() => {
    setPendingFetchBody(null);
  }, []);

  // ─── Save ──────────────────────────────────────────────────
  // Map selected expectedFields back to validate column values.
  // Uses the stored validationContract to dynamically create columns for ALL array
  // indices found in the response — no fixed length, expands automatically.

  const handleSave = useCallback(() => {
    const updatedValues = { ...editedValues };
    const newColumns: DataSourceColumn[] = [];

    // Only patterns in validationContract are "dynamic" — they can create new columns.
    // Fixed patterns (not in contract) only update existing columns.
    const dynamicPatterns = new Set<string>(dataTable.validationContract ?? []);

    // Map expectedFields back into validate column cell values
    for (const field of expectedFields) {
      // Find existing validate column for this exact jsonPath
      const existingCol = validateColumns.find(c => c.mapping === field.jsonPath);
      if (existingCol) {
        // Update existing column value
        let val = field.expectedValue;
        if (val.startsWith('"') && val.endsWith('"')) {
          try { val = JSON.parse(val); } catch { /* keep as-is */ }
        }
        updatedValues[existingCol.id] = val;
      } else {
        // Only create a new column if this field's pattern is dynamic
        const fieldPattern = field.jsonPath.replace(/\[\d+\]/g, '[*]');
        if (!dynamicPatterns.has(fieldPattern)) {
          // Fixed pattern — don't expand
          continue;
        }
        // Create a new validate column — dynamic expansion for this index
        const colId = crypto.randomUUID();
        const colName = deriveColumnName(field.jsonPath, validateColumns);
        newColumns.push({
          id: colId,
          name: colName,
          type: 'validate',
          mapping: field.jsonPath,
        });
        let val = field.expectedValue;
        if (val.startsWith('"') && val.endsWith('"')) {
          try { val = JSON.parse(val); } catch { /* keep as-is */ }
        }
        updatedValues[colId] = val;
      }
    }

    // Clear validate columns that are no longer selected
    for (const col of validateColumns) {
      if (!expectedFields.find(f => f.jsonPath === col.mapping)) {
        updatedValues[col.id] = '';
      }
    }

    onSave(
      { ...row, label: editedLabel || undefined, values: updatedValues },
      newColumns.length > 0 ? newColumns : undefined,
    );
  }, [row, editedLabel, editedValues, expectedFields, validateColumns, dataTable, onSave]);

  // ─── Column type badge color ───────────────────────────────

  const typeBadgeClass = (type: DataSourceColumn['type']) => {
    switch (type) {
      case 'path': return 'row-detail-type-path';
      case 'param': return 'row-detail-type-param';
      case 'body': return 'row-detail-type-body';
      case 'header': return 'row-detail-type-header';
      case 'validate': return 'row-detail-type-validate';
      default: return '';
    }
  };

  // ─── Resolved URL preview ──────────────────────────────────

  const resolvedUrl = useMemo(() => {
    try {
      const currentRow: DataSourceRow = { ...row, values: editedValues };
      const resolved = resolveScenarioFromDataRow(draft, dataTable.columns, currentRow, rowIndex);
      return resolved.url;
    } catch {
      return draft.url;
    }
  }, [draft, dataTable.columns, editedValues, row, rowIndex]);

  return (
    <WorkflowEditorModalFrame
      title={`Row ${rowIndex + 1}${editedLabel ? ` — ${editedLabel}` : ''}`}
      onClose={onClose}
      overlayClassName="row-detail-modal-overlay"
      dialogClassName="wf-config-modal row-detail-modal"
      initialExpanded={true}
      expandMode="fullscreen"
      minWidth={700}
      minHeight={500}
      footer={
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="button" onClick={handleSave}>Save</button>
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </>
      }
    >
      <div className="row-detail-content">
        {/* URL preview + Fetch */}
        <div className="row-detail-fetch-bar">
          <button
            className="btn btn-accent row-detail-fetch-btn"
            type="button"
            onClick={() => void handleFetch()}
            disabled={fetching}
          >
            {fetching ? '⏳ Fetching…' : 'Fetch Response'}
          </button>
          <div className="row-detail-url-preview">
            <span className="row-detail-method">{draft.method}</span>
            <span className="row-detail-url-text">{resolvedUrl}</span>
          </div>
          {fetchStatus && !fetchError && <span className="row-detail-fetch-status">✓ {fetchStatus}</span>}
          {fetchStatus && fetchError && <span className="row-detail-fetch-status row-detail-fetch-status-error">✗ {fetchStatus}</span>}
        </div>
        {fetchError && <div className="row-detail-fetch-error">✗ {fetchError}</div>}

        {/* Fetch confirmation bar — shown when response arrives but user already has selections */}
        {pendingFetchBody && (
          <div className="fetch-confirm-bar">
            <span className="fetch-confirm-msg">New response fetched. You have <strong>{expectedFields.length}</strong> existing rule(s).</span>
            <div className="fetch-confirm-actions">
              <button type="button" className="btn btn-sm btn-accent" onClick={handleFetchKeepRules}>Keep Rules &amp; Update Response</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={handleFetchReplaceAll}>Replace All</button>
              <button type="button" className="btn btn-sm" onClick={handleFetchCancel}>Cancel</button>
            </div>
          </div>
        )}

        {/* Input columns section */}
        <div className="row-detail-section">
          <h4 className="row-detail-section-title">Input Columns</h4>
          <div className="row-detail-fields-grid">
            {/* Row label */}
            <div className="row-detail-field">
              <label className="row-detail-field-label">
                <span className="row-detail-type-badge row-detail-type-label">label</span>
                Row Name
              </label>
              <input
                className="params-input row-detail-input"
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                placeholder={`Row ${rowIndex + 1}`}
              />
            </div>
            {inputColumns.map(col => (
              <div key={col.id} className="row-detail-field">
                <label className="row-detail-field-label">
                  <span className={`row-detail-type-badge ${typeBadgeClass(col.type)}`}>{col.type}</span>
                  {col.name}
                  {col.mapping && col.mapping !== col.name && (
                    <span className="row-detail-field-mapping">→ {col.mapping}</span>
                  )}
                </label>
                <input
                  className="params-input row-detail-input"
                  value={editedValues[col.id] ?? ''}
                  onChange={(e) => updateValue(col.id, e.target.value)}
                  placeholder={col.name}
                />
              </div>
            ))}
          </div>
        </div>

        {/* JSON Response + Field Selection (like Validation tab) */}
        <div className="row-detail-section row-detail-validation-section">
          <div className="validation-mapper-toggle">
            <button
              type="button"
              className="btn btn-sm btn-accent"
              onClick={() => setMapperOpen(true)}
              disabled={!sampleJson}
              title={sampleJson ? 'Open Data Mapper' : 'Fetch response first'}
            >
              ⚡ Data Mapper
            </button>
          </div>
          {expectedFields.length > 0 && (
            <div className="validation-fields-summary">
              <table className="validation-fields-table">
                <thead>
                  <tr><th>JSON Path</th><th>Expected Value</th><th /></tr>
                </thead>
                <tbody>
                  {expectedFields.map((f: ExpectedField, idx: number) => (
                    <tr key={idx}>
                      <td><code>{f.jsonPath}</code></td>
                      <td><code>{f.expectedValue}</code></td>
                      <td>
                        <button type="button" className="btn-icon-sm" title="Remove" onClick={() => {
                          const next = [...expectedFields];
                          next.splice(idx, 1);
                          setExpectedFields(next);
                        }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {mapperOpen && (
            <DataMapperModal
              adapter={validationAdapter}
              initialData={mapperInitialData}
              onSave={handleMapperSave}
              onCancel={() => setMapperOpen(false)}
            />
          )}
        </div>
      </div>
    </WorkflowEditorModalFrame>
  );
}

/** Resolve a value from a parsed JSON object using dot/bracket path. */
function getValueAtJsonPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Derive a human-readable column name from a JSON path.
 * e.g. "offers[3].associatedOfferingCode" → "offer3_associatedOfferingCode"
 * Ensures uniqueness against existing columns.
 */
function deriveColumnName(jsonPath: string, existingCols: DataSourceColumn[]): string {
  const existingNames = new Set(existingCols.map(c => c.name));
  // Convert path like "offers[2].offerName" to "offer2_offerName"
  let name = jsonPath
    .replace(/\[(\d+)\]/g, '$1')  // offers[2] → offers2
    .replace(/\./g, '_');           // offers2.offerName → offers2_offerName
  // Trim leading/trailing underscores
  name = name.replace(/^_+|_+$/g, '');
  // If already unique, use it
  if (!existingNames.has(name)) return name;
  // Otherwise append a suffix
  let i = 2;
  while (existingNames.has(`${name}_${i}`)) i++;
  return `${name}_${i}`;
}
