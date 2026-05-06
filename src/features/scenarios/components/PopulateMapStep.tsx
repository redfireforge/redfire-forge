/**
 * PopulateMapStep — Mapping step UI for PopulateFromApiModal.
 * Shows array selector, field mappings, and row preview with selection.
 */
import type { DataSourceColumn } from '../../../shared/types';
import type { DetectedArray, FieldMapping } from '../utils/populateFromApiUtils';
import { formatCellValue } from '../utils/populateFromApiUtils';

interface PopulateMapStepProps {
  detectedArrays: DetectedArray[];
  selectedArray: string;
  onArrayChange: (path: string) => void;
  arrayItems: Record<string, unknown>[];
  fieldMappings: FieldMapping[];
  onToggleField: (field: string) => void;
  onChangeFieldType: (field: string, colType: DataSourceColumn['type']) => void;
  enabledMappings: FieldMapping[];
  insertMode: 'append' | 'replace';
  duplicateFlags: boolean[];
  duplicateCount: number;
  effectiveSelections: boolean[];
  onRowSelectionChange: (selections: boolean[]) => void;
}

export default function PopulateMapStep({
  detectedArrays,
  selectedArray,
  onArrayChange,
  arrayItems,
  fieldMappings,
  onToggleField,
  onChangeFieldType,
  enabledMappings,
  insertMode,
  duplicateFlags,
  duplicateCount,
  effectiveSelections,
  onRowSelectionChange,
}: PopulateMapStepProps) {
  return (
    <div className="populate-api-map">
      {detectedArrays.length > 1 && (
        <div className="populate-api-array-selector">
          <label>Array source:</label>
          <select
            value={selectedArray}
            onChange={e => onArrayChange(e.target.value)}
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

      <div className="populate-api-fields">
        <div className="populate-api-fields-header">
          <span>Include</span>
          <span>Response Field</span>
          <span>Column Type</span>
          <span>Sample Value</span>
        </div>
        {fieldMappings.map(m => {
          const sampleVal = arrayItems[0]?.[m.field];
          const displayVal = formatCellValue(sampleVal);
          return (
            <div key={m.field} className={`populate-api-field-row ${m.enabled ? '' : 'disabled'}`}>
              <input
                type="checkbox"
                checked={m.enabled}
                onChange={() => onToggleField(m.field)}
              />
              <code className="populate-api-field-name">{m.field}</code>
              <select
                value={m.colType}
                onChange={e => onChangeFieldType(m.field, e.target.value as DataSourceColumn['type'])}
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

      {arrayItems.length > 0 && enabledMappings.length > 0 && (
        <div className="populate-api-preview">
          <div className="populate-api-preview-title">
            {duplicateCount > 0
              ? `${arrayItems.length} rows — ${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} found`
              : `Preview (${arrayItems.length} rows)`
            }
            {insertMode === 'append' && duplicateCount > 0 && (
              <span className="populate-api-preview-actions">
                <button type="button" className="btn-link" onClick={() => onRowSelectionChange(arrayItems.map(() => true))}>Select All</button>
                <button type="button" className="btn-link" onClick={() => onRowSelectionChange(duplicateFlags.map(d => !d))}>New Only</button>
                <button type="button" className="btn-link" onClick={() => onRowSelectionChange(arrayItems.map(() => false))}>None</button>
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
                            onChange={() => {
                              const next = [...effectiveSelections];
                              next[i] = !next[i];
                              onRowSelectionChange(next);
                            }}
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
                        const display = formatCellValue(val, 40);
                        return <td key={m.field} title={String(val ?? '')}>{display}</td>;
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
  );
}
