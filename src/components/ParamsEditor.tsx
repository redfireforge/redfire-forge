import { useState, useCallback, useMemo } from 'react';
import type { KeyValue } from '../types';

export interface ParamEntry extends KeyValue {
  enabled: boolean;
  description: string;
}

interface ParamsEditorProps {
  params: ParamEntry[];
  onChange: (params: ParamEntry[]) => void;
}

const EMPTY_ROW: ParamEntry = { key: '', value: '', enabled: true, description: '' };

export function toParamEntries(kvs: KeyValue[]): ParamEntry[] {
  if (kvs.length === 0) return [{ ...EMPTY_ROW }];
  return kvs.map((kv) => ({ ...kv, enabled: true, description: '' }));
}

export function fromParamEntries(entries: ParamEntry[]): KeyValue[] {
  return entries.filter((e) => e.enabled && e.key.trim()).map(({ key, value }) => ({ key, value }));
}

export function ParamsEditor({ params, onChange }: ParamsEditorProps) {
  const [bulkEdit, setBulkEdit] = useState(false);
  const [showDesc, setShowDesc] = useState(false);

  const activeCount = useMemo(() => params.filter((p) => p.key.trim() && p.enabled).length, [params]);

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
      onChange(next.length > 0 ? next : [{ ...EMPTY_ROW }]);
    },
    [params, onChange],
  );

  const deleteAll = useCallback(() => {
    onChange([{ ...EMPTY_ROW }]);
  }, [onChange]);

  const importFromUrl = useCallback(() => {
    // Placeholder — parent handles this via the URL field already.
    // This fires onChange with params re-parsed from the URL, but the parent already syncs.
    // Kept as a UX action that clears manual additions and re-imports from URL.
    onChange([{ ...EMPTY_ROW }]);
  }, [onChange]);

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
          <button type="button" className="btn-link-sm" onClick={importFromUrl}>
            Import from URL
          </button>
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

          <div className={`params-grid-header ${showDesc ? 'with-desc' : ''}`}>
            <span />
            <span>name</span>
            <span>value</span>
            {showDesc && <span>description</span>}
            <span />
            <span />
          </div>

          {params.map((p, i) => (
            <div key={i} className={`params-row ${showDesc ? 'with-desc' : ''} ${!p.enabled ? 'disabled' : ''}`}>
              <span className="params-drag-handle" title="Drag to reorder">⠿</span>
              <input
                className="params-input"
                value={p.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="name"
                disabled={!p.enabled}
              />
              <input
                className="params-input"
                value={p.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="value"
                disabled={!p.enabled}
              />
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
          ))}
        </>
      )}
    </div>
  );
}
