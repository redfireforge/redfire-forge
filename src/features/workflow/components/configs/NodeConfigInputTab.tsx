import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface Props {
  hints: WorkflowVariableHint[];
}

/**
 * Input tab for WorkflowNodeConfigModal — shows resolved variables
 * available to the step at execution time.
 */
export default function NodeConfigInputTab({ hints }: Props) {
  return (
    <div className="wf-config-tab-content">
      <div className="wf-config-tab-hint">Resolved variables available to this step at execution time:</div>
      {hints.length > 0 ? (
        <table className="wf-config-var-table">
          <thead><tr><th>Variable</th><th>Source</th></tr></thead>
          <tbody>
            {hints.map(h => (
              <tr key={h.ref}>
                <td className="wf-config-var-ref">{`{{${h.ref}}}`}</td>
                <td className="wf-config-var-source">{h.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="wf-config-tab-empty">No variables available for this step</div>
      )}
    </div>
  );
}
