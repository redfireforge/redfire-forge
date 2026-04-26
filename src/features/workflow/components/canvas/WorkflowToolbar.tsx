import { useMemo } from 'react';
import type { Environment } from '../../../../shared/types';
import type { Workflow, WorkflowService } from '../../types/workflow';
import { checkAllEnvReadiness } from '../../utils/workflowEnvReadiness';

export interface RunProgress {
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
  lastRunStatus?: 'idle' | 'running' | 'pass' | 'fail';
}

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
  runProgress?: RunProgress | null;
  onReset?: () => void;
}

export default function WorkflowToolbar({
  workflows, selected, isRunning, saveAcknowledged, serviceCount = 0, variableCount = 0,
  environments = [], selectedEnvId = '', onEnvSelect, workflowServices = [], isPreview = false,
  onNew, onSelect, onSave, onQuickTest, onDebugTest, isDebugMode, onOpenServices, onOpenDefaults,
  runProgress = null, onReset,
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
        <button className="btn btn-sm btn-primary" onClick={onNew} disabled={isRunning}>
              <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>

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
              <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Services
              {serviceCount > 0 && <span className="wf-toolbar-services-badge">{serviceCount}</span>}
            </button>

            <button
              className="btn btn-sm wf-toolbar-btn wf-toolbar-variables-btn"
              onClick={onOpenDefaults}
              disabled={isRunning}
              title="Manage workflow-level default variables"
            >
              <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Workflow Variables
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
                <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
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
              {isRunning && !isDebugMode ? (
                <><svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop</>
              ) : (
                <><svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Quick Test</>
              )}
            </button>
            {onDebugTest && (
              <button
                className={`btn btn-sm ${isRunning && isDebugMode ? 'btn-danger' : 'btn-outline'}`}
                onClick={onDebugTest}
                title="Run workflow step-by-step"
              >
                {isRunning && isDebugMode ? (
                  <><svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop Debug</>
                ) : (
                  <><svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Debug</>
                )}
              </button>
            )}

            {runProgress && runProgress.lastRunStatus === 'running' && (
              <span className="wf-run-progress wf-run-progress-running">
                <span className="wf-spinner" />
                Step {runProgress.completed}/{runProgress.total} · {(runProgress.elapsedMs / 1000).toFixed(1)}s
                <span className="wf-run-progress-bar-wrap">
                  <span className="wf-run-progress-bar wf-run-progress-bar-running" style={{ width: `${runProgress.total > 0 ? (runProgress.completed / runProgress.total) * 100 : 0}%` }} />
                </span>
              </span>
            )}
            {runProgress && runProgress.lastRunStatus === 'pass' && (
              <span className="wf-run-progress wf-run-progress-pass">
                ● {runProgress.completed}/{runProgress.total} passed · {(runProgress.elapsedMs / 1000).toFixed(1)}s
              </span>
            )}
            {runProgress && runProgress.lastRunStatus === 'fail' && (
              <span className="wf-run-progress wf-run-progress-fail">
                ● {runProgress.completed - runProgress.failed}/{runProgress.total}{runProgress.failed > 0 ? ` · ${runProgress.failed} failed` : ''} · {(runProgress.elapsedMs / 1000).toFixed(1)}s
              </span>
            )}
            {runProgress && !isRunning && (runProgress.lastRunStatus === 'pass' || runProgress.lastRunStatus === 'fail') && onReset && (
              <button
                className="btn btn-sm btn-ghost wf-toolbar-reset-btn"
                onClick={onReset}
                title="Clear previous run status from all nodes"
              >
                <svg className="wf-toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Clear
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
