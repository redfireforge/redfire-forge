import { useState } from 'react';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface Props {
  hints: WorkflowVariableHint[];
  /** When true, the variable list starts expanded (GraphQL / expression panels). */
  defaultOpen?: boolean;
  /** Pinned footer layout inside GraphQL config tabs — collapsed by default; expands on click. */
  dock?: boolean;
}

/**
 * Read-only collapsible section showing available variables and their source.
 * Used by WaitForConditionConfig, SwitchConfig, LogDebugConfig, GraphQL WF panels.
 */
export default function AvailableVariables({ hints, defaultOpen = false, dock = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (hints.length === 0) return null;

  const showScrollHint = open && hints.length > 2;

  return (
    <div
      className={[
        'wf-avail-vars',
        open ? 'wf-avail-vars--open' : '',
        dock ? 'wf-avail-vars--dock' : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className="wf-avail-vars-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={`wf-avail-vars-chevron${open ? ' open' : ''}`} aria-hidden="true">▸</span>
        <span className="wf-avail-vars-toggle-text">
          Available variables
          {dock && <span className="wf-avail-vars-toggle-hint">Insert {'{{name}}'} in fields above</span>}
        </span>
        <span className="wf-avail-vars-count">{hints.length}</span>
      </button>
      {open && (
        <>
          {showScrollHint && (
            <p className="wf-avail-vars-scroll-hint" aria-hidden="true">
              Scroll inside this panel to see all {hints.length} variables
            </p>
          )}
          <div className="wf-avail-vars-body" role="region" aria-label="Available variables list">
            <table className="wf-avail-vars-table">
              <thead>
                <tr><th>Variable</th><th>Type</th><th>Source</th></tr>
              </thead>
              <tbody>
                {hints.map(h => (
                  <tr key={h.ref} title={h.description || ''}>
                    <td className="wf-avail-vars-ref"><code>{`{{${h.ref}}}`}</code></td>
                    <td className="wf-avail-vars-type">{h.type || '—'}</td>
                    <td className="wf-avail-vars-source">{h.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
