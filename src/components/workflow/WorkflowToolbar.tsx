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
  /** Number of workflow-level default variables. */
  variableCount?: number;
  environments?: Environment[];
  selectedEnvId?: string;
  onEnvSelect?: (id: string) => void;
  workflowServices?: WorkflowService[];
  isPreview?: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onSave: () => void;
  onQuickTest: () => void;
  onDebugTest?: () => void;
  isDebugMode?: boolean;
  onOpenServices?: () => void;
  onOpenDefaults?: () => void;
}

export default function WorkflowToolbar({
  workflows, selected, isRunning, saveAcknowledged, serviceCount = 0, variableCount = 0,
  environments = [], selectedEnvId = '', onEnvSelect, workflowServices = [], isPreview = false,
  onNew, onSelect, onSave, onQuickTest, onDebugTest, isDebugMode, onOpenServices, onOpenDefaults,
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

        {(workflows.length > 0 || isPreview) && (
          <select
            className="wf-toolbar-select"
            value={selected?.id ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            disabled={isRunning || isPreview}
          >
            <option value="" disabled>Open workflow…</option>
            {isPreview && selected && !workflows.some(wf => wf.id === selected.id) && (
              <option key={selected.id} value={selected.id}>
                {selected.name}
              </option>
            )}
            {workflows.map(wf => (
              <option key={wf.id} value={wf.id}>{wf.name}</option>
            ))}
          </select>
        )}

        {selected && (
          <>
            <span className="wf-toolbar-divider" />

            <button
              className="btn btn-sm wf-toolbar-btn wf-toolbar-services-btn"
              onClick={onOpenServices}
              disabled={isRunning}
              title="Manage external service hostnames and auth for this workflow"
            >
              🔗 Services
              {serviceCount > 0 && <span className="wf-toolbar-services-badge">{serviceCount}</span>}
            </button>

            <button
              className="btn btn-sm wf-toolbar-btn wf-toolbar-variables-btn"
              onClick={onOpenDefaults}
              disabled={isRunning}
              title="Manage workflow-level default variables"
            >
              📋 Workflow Variables
              {variableCount > 0 && <span className="wf-toolbar-services-badge">{variableCount}</span>}
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
              <button className="btn btn-sm" onClick={onSave} disabled={isRunning || isPreview} title={isPreview ? "Preview mode - click 'Use as Template' to save" : "Save canvas and variables to this workflow"}>
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
          <>
            <button
              className={`btn btn-sm ${isRunning && !isDebugMode ? 'btn-danger' : 'btn-primary'}`}
              onClick={onQuickTest}
            >
              {isRunning && !isDebugMode ? '■ Stop' : '▶ Quick Test'}
            </button>
            {onDebugTest && (
              <button
                className={`btn btn-sm ${isRunning && isDebugMode ? 'btn-danger' : 'btn-outline'}`}
                onClick={onDebugTest}
                title="Run workflow step-by-step"
              >
                {isRunning && isDebugMode ? '■ Stop Debug' : '🔍 Debug'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
