import { useState, useCallback, useMemo } from 'react';
import type { KeyValue } from '../../../shared/types';
import type { WorkflowVariableHint } from '../../workflow/utils/workflowVariableHints';
import { buildVariableSourceMap, resolveVariableSource } from '../../workflow/utils/workflowSourceMap';

export interface ParamEntry extends KeyValue {
  enabled: boolean;
  description: string;
}

interface ParamsEditorProps {
  params: ParamEntry[];
  onChange: (params: ParamEntry[]) => void;
  /** Per row: open variable picker; parent appends `{{…}}` to this row’s value. */
  onInsertVariable?: (rowIndex: number, paramKey: string) => void;  /** Variable hints used to display the source of each param value. */
  variableHints?: WorkflowVariableHint[];
  /** Re-import params from the current URL. If not provided, Import from URL button is hidden. */
  onImportFromUrl?: () => void;
}

const EMPTY_ROW: ParamEntry = { key: '', value: '', enabled: true, description: '' };

// eslint-disable-next-line react-refresh/only-export-components
export function toParamEntries(kvs: KeyValue[]): ParamEntry[] {
  if (kvs.length === 0) return [{ ...EMPTY_ROW }];
  return kvs.map((kv) => ({ ...kv, enabled: true, description: '' }));
}

// eslint-disable-next-line react-refresh/only-export-components
export function fromParamEntries(entries: ParamEntry[]): KeyValue[] {
  return entries.filter((e) => e.enabled && e.key.trim()).map(({ key, value }) => ({ key, value }));
}

export function ParamsEditor({ params, onChange, onInsertVariable, variableHints = [], onImportFromUrl }: ParamsEditorProps) {
  const [bulkEdit, setBulkEdit] = useState(false);
  const [showDesc, setShowDesc] = useState(false);

  const activeCount = useMemo(() => params.filter((p) => p.key.trim() && p.enabled).length, [params]);

  const sourceMap = useMemo(() => buildVariableSourceMap(variableHints), [variableHints]);
  const showSource = variableHints.length > 0;

  const update = useCallback(
    (idx: number, patch: Partial<ParamEntry>) => {
      const next = [...params];
      next[idx] = { ...next[idx], ...patch };
      onChange(next);
    },
    [params, onChange],
  );

  const addRow = useCallback(() => {
    onChange([...params, { ...EMPTY_ROW }]);
  }, [params, onChange]);

  const removeRow = useCallback(
    (idx: number) => {
      const next = params.filter((_, i) => i !== idx);
      onChange(next);
    },
    [params, onChange],
  );

  const deleteAll = useCallback(() => {
    onChange([{ ...EMPTY_ROW }]);
  }, [onChange]);

  const importFromUrl = useCallback(() => {
    if (onImportFromUrl) {
      onImportFromUrl();
    }
  }, [onImportFromUrl]);

  const bulkText = useMemo(() => {
    return params
      .filter((p) => p.key.trim())
      .map((p) => `${p.key}=${p.value}`)
      .join('\n');
  }, [params]);

  const handleBulkChange = useCallback(
    (text: string) => {
      const lines = text.split('\n');
      const entries: ParamEntry[] = lines.map((line) => {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return { key: line.trim(), value: '', enabled: true, description: '' };
        return { key: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 1), enabled: true, description: '' };
      });
      if (entries.length === 0) entries.push({ ...EMPTY_ROW });
      onChange(entries);
    },
    [onChange],
  );

  return (
    <div className="params-editor">
      <div className="params-toolbar">
        <div className="params-toolbar-left">
          <span className="params-section-label">QUERY PARAMETERS</span>
          {activeCount > 0 && <span className="tab-badge">{activeCount}</span>}
        </div>
        <div className="params-toolbar-right">
          {onImportFromUrl && (
            <button type="button" className="btn-link-sm" onClick={importFromUrl}>
              Import from URL
            </button>
          )}
          <button
            type="button"
            className={`btn-link-sm ${bulkEdit ? 'active' : ''}`}
            onClick={() => setBulkEdit(!bulkEdit)}
          >
            Bulk Edit
          </button>
        </div>
      </div>

      {bulkEdit ? (
        <textarea
          className="params-bulk-editor"
          rows={10}
          value={bulkText}
          onChange={(e) => handleBulkChange(e.target.value)}
          placeholder={'key=value\nanotherKey=anotherValue'}
        />
      ) : (
        <>
          <div className="params-actions">
            <button type="button" className="btn btn-sm" onClick={addRow}>
              + Add
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={deleteAll} title="Delete all">
              Delete all
            </button>
            <button
              type="button"
              className={`btn btn-sm btn-ghost ${showDesc ? 'active' : ''}`}
              onClick={() => setShowDesc(!showDesc)}
              title="Toggle descriptions"
            >
              Description
            </button>
          </div>

          <div className={`params-grid-header ${showDesc ? 'with-desc' : ''} ${!showSource ? 'no-source' : ''}`}>
            <span />
            <span>name</span>
            {showSource && <span>source</span>}
            <span>value</span>
            {showDesc && <span>description</span>}
            <span />
            <span />
          </div>

          {params.map((p, i) => {
            const { source, displayValue } = resolveVariableSource(p.value, sourceMap);
            return (
            <div key={i} className={`params-row ${showDesc ? 'with-desc' : ''} ${!showSource ? 'no-source' : ''} ${!p.enabled ? 'disabled' : ''}`}>
              <span className="params-drag-handle" title="Drag to reorder">⠿</span>
              <input
                className="params-input"
                value={p.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="name"
                disabled={!p.enabled}
              />
              {showSource && (
                <input
                  className="params-input params-source-cell"
                  readOnly
                  value={source}
                  title={source}
                  tabIndex={-1}
                />
              )}
              <div className="params-value-with-insert">
                <input
                  className="params-input"
                  value={displayValue}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="value"
                  disabled={!p.enabled}
                />
                {onInsertVariable && (
                  <button
                    type="button"
                    className="btn btn-sm params-insert-var-btn"
                    disabled={!p.enabled}
                    title="Insert variable from workflow or upstream step"
                    onClick={() => onInsertVariable(i, p.key)}
                  >
                    Insert…
                  </button>
                )}
              </div>
              {showDesc && (
                <input
                  className="params-input params-desc-input"
                  value={p.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  placeholder="description"
                  disabled={!p.enabled}
                />
              )}
              <label className="params-toggle" title={p.enabled ? 'Disable parameter' : 'Enable parameter'}>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                />
              </label>
              <button
                type="button"
                className="params-delete"
                onClick={() => removeRow(i)}
                title="Delete"
              >
                ×
              </button>
            </div>
            );
          })}
        </>
      )}
    </div>
  );
}
