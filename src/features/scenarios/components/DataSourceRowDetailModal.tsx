import { useState, useCallback, useMemo } from 'react';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow, ExpectedField } from '@shared/types';
import type { HttpResponse } from '@shared/utils/httpClient';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import { proxyFetch, buildHeaders } from '../../../engine/executor';
import { expandPatternFromResponse } from '../utils/dataSourceImport';
import {
  DataMapperModal,
  createValidationAdapter,
} from '@shared/components/data-mapper';
import { prettyJson, toErrorMessage, tryParseJson } from '@shared/utils/helpers';
import { getByPath, setByPath } from '@shared/utils/jsonPath';
import type { ValidationAdapterOutput } from '@shared/components/data-mapper';

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

function normalizeExpectedFieldValue(raw: string): string {
  if (!raw.startsWith('"') || !raw.endsWith('"')) return raw;
  const parsed = tryParseJson(raw);
  if (typeof parsed === 'string') return parsed;
  return raw;
}

/** Build a minimal sample JSON tree from expected fields so Data Mapper can open without a live fetch. */
function buildSampleFromExpectedFields(fields: ExpectedField[]): string {
  if (fields.length === 0) return '';
  const root: Record<string, unknown> = {};
  for (const f of fields) {
    const path = f.jsonPath?.trim();
    if (!path) continue;
    let value: unknown = f.expectedValue;
    const asText = typeof value === 'string' ? value : String(value ?? '');
    const parsed = tryParseJson(asText);
    if (parsed !== undefined) {
      value = parsed;
    } else if (typeof value === 'string') {
      value = normalizeExpectedFieldValue(value);
    }
    try {
      const normalizedPath = (path.startsWith('$.') || path.startsWith('$[')) ? path : `$.${path}`;
      setByPath(root, normalizedPath, value);
    } catch {
      // Skip malformed paths
    }
  }
  if (Object.keys(root).length === 0) return '';
  return JSON.stringify(root, null, 2);
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
      .map(c => ({ jsonPath: c.mapping, expectedValue: row.values[c.id]! }));
  });
  const [mapperOpen, setMapperOpen] = useState(false);

  /** Prefer live fetch sample; fall back to a tree built from existing expected fields. */
  const effectiveSampleJson = useMemo(
    () => sampleJson || buildSampleFromExpectedFields(expectedFields),
    [sampleJson, expectedFields],
  );
  const canOpenMapper = effectiveSampleJson.length > 0;

  const validationAdapter = useMemo(
    () => createValidationAdapter({
      sampleResponseBody: effectiveSampleJson || undefined,
      selectiveMode: 'include',
    }),
    [effectiveSampleJson],
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
          const parsed = tryParseJson(result.body);
          if (parsed !== undefined) {
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
          }
        }
      }
    } catch (err) {
      setFetchError(toErrorMessage(err));
    } finally {
      setFetching(false);
    }
  }, [draft, dataTable.columns, dataTable.validationContract, editedValues, row, rowIndex, validateColumns, expectedFields, onFetchRow]);

  // ─── Fetch confirmation handlers ──────────────────────────

  const handleFetchKeepRules = useCallback(() => {
    if (!pendingFetchBody) return;
    // Update the response JSON but keep existing field selections, updating their values
    setSampleJson(pendingFetchBody);
    const parsed = tryParseJson(pendingFetchBody);
    if (parsed !== undefined) {
      setExpectedFields(prev => prev.map(f => {
        const value = getValueAtJsonPath(parsed, f.jsonPath);
        if (value !== undefined) {
          return { ...f, expectedValue: JSON.stringify(value) };
        }
        return f;
      }));
    }
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
        const val = normalizeExpectedFieldValue(field.expectedValue);
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
        const val = normalizeExpectedFieldValue(field.expectedValue);
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
    }
    return '';
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
      initialExpanded={false}
      expandMode="fullscreen"
      minWidth={480}
      minHeight={280}
      constrainDragToViewport
      dragViewportPadding={12}
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
          <div className="row-detail-url-preview" title={resolvedUrl}>
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
            <span className="fetch-confirm-msg">New response fetched. You have <strong>{expectedFields.length}</strong> existing validation rule(s).</span>
            <div className="fetch-confirm-actions">
              <button
                type="button"
                className="btn btn-sm btn-accent"
                data-testid="row-detail-keep-rules"
                onClick={handleFetchKeepRules}
                title="Keep the same JSON paths and refresh expected values from this response"
              >
                Keep Rules &amp; Update Values
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={handleFetchReplaceAll} title="Discard existing validation rules and start fresh with the new response">Clear Rules</button>
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
                  value={editedValues[col.id]}
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
              disabled={!canOpenMapper}
              title={canOpenMapper ? 'Open Data Mapper' : 'Fetch response or add expected fields first'}
            >
              ⚡ Data Mapper
            </button>
          </div>
          {expectedFields.length > 0 && (
            <div className="validation-fields-summary">
              <table className="validation-fields-table">
                <thead>
                  <tr>
                    <th>JSON Path</th>
                    <th>Expected Value</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {expectedFields.map((f: ExpectedField, idx: number) => (
                    <tr key={idx}>
                      <td><code>{f.jsonPath}</code></td>
                      <td><code>{f.expectedValue}</code></td>
                      <td className="validation-fields-actions-cell">
                        <button
                          type="button"
                          className="validation-fields-remove-btn"
                          title={`Remove ${f.jsonPath}`}
                          aria-label={`Remove ${f.jsonPath}`}
                          onClick={() => {
                            const next = [...expectedFields];
                            next.splice(idx, 1);
                            setExpectedFields(next);
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
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
              contextScope={`row:${draft.id}:${row.id}`}
            />
          )}
        </div>
      </div>
    </WorkflowEditorModalFrame>
  );
}

/** Resolve a value from a parsed JSON object using JSONPath (supports $.name, name, a.b[0]). */
function getValueAtJsonPath(obj: unknown, path: string): unknown {
  return getByPath(obj, path);
}

/**
 * Derive a human-readable column name from a JSON path.
 * e.g. "$.name" → "name", "offers[3].code" → "offers3_code"
 */
function deriveColumnName(jsonPath: string, existingCols: DataSourceColumn[]): string {
  const existingNames = new Set(existingCols.map(c => c.name));
  let name = jsonPath
    .replace(/^\$\.?/, '')          // $.name → name
    .replace(/\[(\d+)\]/g, '$1')    // offers[2] → offers2
    .replace(/\./g, '_');             // a.b → a_b
  name = name.replace(/^_+|_+$/g, '');
  if (!name) name = 'field';
  if (!existingNames.has(name)) return name;
  let i = 2;
  while (existingNames.has(`${name}_${i}`)) i++;
  return `${name}_${i}`;
}
