import { useState } from 'react';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface Props {
  hints: WorkflowVariableHint[];
}

/**
 * Read-only collapsible section showing available variables and their source.
 * Used by WaitForConditionConfig, SwitchConfig, LogDebugConfig.
 */
export default function AvailableVariables({ hints }: Props) {
  const [open, setOpen] = useState(false);

  if (hints.length === 0) return null;

  return (
    <div className="wf-avail-vars">
      <button
        type="button"
        className="wf-avail-vars-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={`wf-avail-vars-chevron${open ? ' open' : ''}`}>▸</span>
        Available variables
        <span className="wf-avail-vars-count">{hints.length}</span>
      </button>
      {open && (
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
      )}
    </div>
  );
}
