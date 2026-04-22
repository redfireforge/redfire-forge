import { useMemo } from 'react';
import type { Environment } from '../../types';
import type { Workflow, WorkflowService } from '../../types/workflow';
import { checkAllEnvReadiness } from '../../utils/workflowEnvReadiness';

interface Props {
  workflows: Workflow[];
  selected: Workflow | null;
  isRunning: boolean;
  /** Brief confirmation after Save persisted (cleared by parent). */
  saveAcknowledged?: boolean;
  /** Number of services configured in the Service Registry. */
  serviceCount?: number;
  environments?: Environment[];
  selectedEnvId?: string;
  onEnvSelect?: (id: string) => void;
  workflowServices?: WorkflowService[];
  onNew: () => void;
  onSelect: (id: string) => void;
  onSave: () => void;
  onQuickTest: () => void;
  onOpenServices?: () => void;
}

export default function WorkflowToolbar({
  workflows, selected, isRunning, saveAcknowledged, serviceCount = 0,
  environments = [], selectedEnvId = '', onEnvSelect, workflowServices = [],
  onNew, onSelect, onSave, onQuickTest, onOpenServices,
}: Props) {
  const envReadinessMap = useMemo(
    () => workflowServices.length > 0
      ? checkAllEnvReadiness(environments.map((e) => e.id), workflowServices)
      : new Map(),
    [environments, workflowServices],
  );

  const currentReadiness = selectedEnvId ? envReadinessMap.get(selectedEnvId) : undefined;

  return (
    <div className="wf-toolbar">
      <div className="wf-toolbar-left">
        <button className="btn btn-sm btn-primary" onClick={onNew} disabled={isRunning}>+ New</button>

        {workflows.length > 0 && (
          <select
            className="wf-toolbar-select"
            value={selected?.id ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            disabled={isRunning}
          >
            <option value="" disabled>Open workflow…</option>
            {workflows.map(wf => (
              <option key={wf.id} value={wf.id}>{wf.name}</option>
            ))}
          </select>
        )}

        {selected && (
          <>
            <span className="wf-toolbar-divider" />

            <button
              className="btn btn-sm wf-toolbar-services-btn"
              onClick={onOpenServices}
              disabled={isRunning}
              title="Manage external service hostnames and auth for this workflow"
            >
              🔗 Services
              {serviceCount > 0 && <span className="wf-toolbar-services-badge">{serviceCount}</span>}
            </button>

            <span className="wf-toolbar-env-wrap">
              <select
                className="wf-toolbar-env-select"
                value={selectedEnvId}
                onChange={(e) => onEnvSelect?.(e.target.value)}
                disabled={isRunning}
                title="Select target environment for Quick Test"
              >
                <option value="">Env…</option>
                {environments.map((e) => {
                  const r = envReadinessMap.get(e.id);
                  const warn = r && !r.ready ? ` ⚠ ${r.issues.length} missing` : '';
                  return <option key={e.id} value={e.id}>{e.name}{warn}</option>;
                })}
              </select>
              {currentReadiness && !currentReadiness.ready && (
                <span
                  className="wf-toolbar-env-warn"
                  title={`Missing config: ${currentReadiness.issues.map((i: { serviceName: string }) => i.serviceName).join(', ')}`}
                >⚠</span>
              )}
            </span>

            <span className="wf-toolbar-divider" />

            <span className="wf-toolbar-save-wrap">
              <button className="btn btn-sm" onClick={onSave} disabled={isRunning} title="Save canvas and variables to this workflow">
                Save
              </button>
              {saveAcknowledged && (
                <span className="wf-toolbar-saved-msg" role="status">
                  Saved
                </span>
              )}
            </span>
          </>
        )}
      </div>

      <div className="wf-toolbar-right">
        {selected && (
          <button
            className={`btn btn-sm ${isRunning ? 'btn-danger' : 'btn-primary'}`}
            onClick={onQuickTest}
          >
            {isRunning ? '■ Stop' : '▶ Quick Test'}
          </button>
        )}
      </div>
    </div>
  );
}
