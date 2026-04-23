import { useState, useRef, useEffect, useMemo } from 'react';
import { useWorkflowInspect } from './WorkflowInspectContext';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { buildVariableSourceMap, resolveVariableSource } from '../../utils/workflowSourceMap';

const VAR_NAME_COL_MIN = 100;
const VAR_NAME_COL_MAX = 420;
const VAR_NAME_COL_DEFAULT = 200;
/** Values longer than this use View + modal instead of a cramped single-line input. */
const VAR_VALUE_LONG = 100;

export default function VariablesSection({ title, hint, variables, onUpdateVariables, newVarKey, setNewVarKey, newVarValue, setNewVarValue, onRequestVariableInsert, deprecatedKeys = [], variableHints = [], workflowVariables = {} }: {
  title: string;
  hint: string;
  variables: Record<string, string>;
  onUpdateVariables: (v: Record<string, string>) => void;
  newVarKey: string; setNewVarKey: (s: string) => void;
  newVarValue: string; setNewVarValue: (s: string) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void, shortRef?: boolean, initialSearch?: string) => void;
  deprecatedKeys?: string[];
  variableHints?: WorkflowVariableHint[];
  /** Workflow-level default variables — used to resolve SOURCE for simple refs like {{vin}}. */
  workflowVariables?: Record<string, string>;
}) {
  const { openVariableDetail } = useWorkflowInspect();
  const entries = Object.entries(variables);

  const sourceMap = useMemo(
    () => buildVariableSourceMap(variableHints, workflowVariables),
    [variableHints, workflowVariables],
  );

  const [nameColWidth, setNameColWidth] = useState(VAR_NAME_COL_DEFAULT);
  const resizeDrag = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeDrag.current) return;
      const delta = e.clientX - resizeDrag.current.startX;
      const next = Math.min(VAR_NAME_COL_MAX, Math.max(VAR_NAME_COL_MIN, resizeDrag.current.startW + delta));
      setNameColWidth(next);
    };
    const onUp = () => {
      resizeDrag.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeDrag.current = { startX: e.clientX, startW: nameColWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const addVar = () => {
    const key = newVarKey.trim().replace(/[{}]/g, '');
    if (!key) return;
    onUpdateVariables({ ...variables, [key]: newVarValue });
    setNewVarKey('');
    setNewVarValue('');
  };

  return (
    <div className="wf-config-vars">
      <div className="wf-config-vars-title">{title}</div>
      <p className="wf-config-hint-text" style={{ margin: '0 0 6px' }}>
        {hint} Drag the divider to resize the name column.
      </p>
      <div className="wf-config-kv-row wf-config-kv-row-vars wf-config-kv-header">
        <div className="wf-var-name-cell" style={{ width: nameColWidth }}>
          <span className="wf-var-col-label">name</span>
        </div>
        <div className="wf-var-col-resize wf-var-col-resize-inert" aria-hidden />
        <div className="wf-var-source-cell-header">
          <span className="wf-var-col-label">source</span>
        </div>
        <div className="wf-var-value-with-insert">
          <span className="wf-var-col-label">value</span>
        </div>
        <span className="wf-var-col-label wf-var-actions-label" />
      </div>
      {entries.map(([key, value], index) => {
        const isLong = value.length > VAR_VALUE_LONG || value.includes('\n');
        const isDeprecated = deprecatedKeys.includes(key);
        const { source: varSource, displayValue } = resolveVariableSource(value, sourceMap);
        return (
        /* index key: variable *name* changes while typing during rename; key={key} remounts the row and drops focus */
        <div key={index} className={`wf-config-kv-row wf-config-kv-row-vars${isDeprecated ? ' wf-var-deprecated' : ''}`}>
          <div className="wf-var-name-cell" style={{ width: nameColWidth }}>
            <input
              className="wf-var-key-input"
              value={key}
              onChange={(e) => {
                const newKey = e.target.value.replace(/[{}]/g, '').trim();
                if (!newKey || newKey === key) return;
                const next: Record<string, string> = {};
                for (const [k, v] of Object.entries(variables)) {
                  next[k === key ? newKey : k] = v;
                }
                onUpdateVariables(next);
              }}
              title={isDeprecated ? `"${key}" is managed by the Service Registry and can be removed` : undefined}
            />
          </div>
          <div className="wf-var-col-resize" onMouseDown={onResizeStart} title="Drag to resize name column" role="separator" aria-orientation="vertical" />
          <div className="wf-var-source-cell">
            <input className="wf-var-source-input" readOnly value={varSource} title={varSource} tabIndex={-1} />
          </div>
          {isLong ? (
            <div className="wf-var-value-long-wrap">
              <input
                className="wf-var-value-input wf-var-value-preview"
                readOnly
                value={value.length > 72 ? `${value.slice(0, 72)}…` : value}
                title={value}
                onClick={() => openVariableDetail(key)}
              />
              {onRequestVariableInsert && (
                <button
                  type="button"
                  className="btn btn-sm wf-config-insert-var-btn"
                  title="Insert variable"
                  onClick={() =>
                    onRequestVariableInsert((snippet) => onUpdateVariables({ ...variables, [key]: value + snippet }), false, key)
                  }
                >
                  Insert…
                </button>
              )}
              <button type="button" className="btn btn-sm wf-var-view-btn" onClick={() => openVariableDetail(key)}>
                View…
              </button>
            </div>
          ) : (
            <div className="wf-var-value-with-insert">
              <input
                className="wf-var-value-input"
                value={value}
                onChange={(e) => {
                  onUpdateVariables({ ...variables, [key]: e.target.value });
                }}
              />
              {onRequestVariableInsert && (
                <button
                  type="button"
                  className="btn btn-sm wf-config-insert-var-btn"
                  title="Insert variable from workflow or upstream step"
                  onClick={() =>
                    onRequestVariableInsert((snippet) => onUpdateVariables({ ...variables, [key]: value + snippet }), false, key)
                  }
                >
                  Insert…
                </button>
              )}
            </div>
          )}
          <button type="button" className="btn btn-sm btn-danger" onClick={() => {
            const next = { ...variables }; delete next[key]; onUpdateVariables(next);
          }}>×</button>
        </div>
        );
      })}
      <div className="wf-config-kv-row wf-config-kv-row-vars" style={{ marginTop: 4 }}>
        <div className="wf-var-name-cell" style={{ width: nameColWidth }}>
          <input value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} placeholder="name" onKeyDown={(e) => e.key === 'Enter' && addVar()} onBlur={() => { if (newVarKey.trim() && newVarValue) addVar(); }} className="wf-var-key-input" />
        </div>
        <div className="wf-var-col-resize wf-var-col-resize-inert" aria-hidden />
        <div className="wf-var-source-cell">
          <input className="wf-var-source-input" readOnly value="" tabIndex={-1} />
        </div>
        <div className="wf-var-new-row-value">
          <input
            className="wf-var-value-input"
            value={newVarValue}
            onChange={(e) => setNewVarValue(e.target.value)}
            placeholder="value"
            onKeyDown={(e) => e.key === 'Enter' && addVar()}
            onBlur={() => { if (newVarKey.trim()) addVar(); }}
          />
          {onRequestVariableInsert && (
            <button
              type="button"
              className="btn btn-sm wf-config-insert-var-btn"
              title="Insert variable"
              onClick={() => onRequestVariableInsert((snippet) => setNewVarValue(newVarValue + snippet))}
            >
              Insert…
            </button>
          )}
        </div>
        <button type="button" className="btn btn-sm" onClick={addVar}>+</button>
      </div>
    </div>
  );
}
