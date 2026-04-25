import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import VariablesSection from './VariablesSection';
import type { WorkflowService, WorkflowErrorConfig, WorkflowErrorMode, WorkflowNode } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { snapshot } from '../../utils/helpers';
import { useVariableInsertModal } from '../../hooks/useVariableInsertModal';

interface Props {
  open: boolean;
  workflowVariables: Record<string, string>;
  onUpdateWorkflowVariables: (variables: Record<string, string>) => void;
  onClose: () => void;
  workflowServices?: WorkflowService[];
  errorConfig?: WorkflowErrorConfig;
  onUpdateErrorConfig?: (config: WorkflowErrorConfig | undefined) => void;
  workflowNodes?: WorkflowNode[];
}

export default function WorkflowDefaultsModal({
  open, workflowVariables, onUpdateWorkflowVariables, onClose, workflowServices = [],
  errorConfig, onUpdateErrorConfig, workflowNodes = [],
}: Props) {
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const {
    variableInsertOpen, variableInsertShortRef, variableInsertInitialSearch,
    requestVariableInsert, handleVariableInsertPicked, closeVariableInsert,
  } = useVariableInsertModal();

  // Snapshot for Cancel rollback
  const originalRef = useRef<Record<string, string>>(snapshot(workflowVariables));
  const [draft, setDraft] = useState<Record<string, string>>(() => snapshot(workflowVariables));
  const [errorDraft, setErrorDraft] = useState<WorkflowErrorConfig | undefined>(() => errorConfig ? snapshot(errorConfig) : undefined);
  const originalErrorRef = useRef<WorkflowErrorConfig | undefined>(errorConfig ? snapshot(errorConfig) : undefined);

  useEffect(() => {
    if (open) {
      originalRef.current = snapshot(workflowVariables);
      setDraft(snapshot(workflowVariables));
      originalErrorRef.current = errorConfig ? snapshot(errorConfig) : undefined;
      setErrorDraft(errorConfig ? snapshot(errorConfig) : undefined);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(() => {
    onUpdateWorkflowVariables(draft);
    onUpdateErrorConfig?.(errorDraft);
    onClose();
  }, [draft, errorDraft, onUpdateWorkflowVariables, onUpdateErrorConfig, onClose]);

  const handleCancel = useCallback(() => {
    onUpdateWorkflowVariables(originalRef.current);
    onUpdateErrorConfig?.(originalErrorRef.current);
    onClose();
  }, [onUpdateWorkflowVariables, onUpdateErrorConfig, onClose]);

  const variableInsertHints = useMemo(
    (): WorkflowVariableHint[] =>
      Object.keys(draft)
        .filter((k) => k.trim().length > 0)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => {
          const t = k.trim();
          return { ref: t, label: `${t} (workflow)` };
        }),
    [draft],
  );

  if (!open) return null;

  return (
    <>
      <div
        className={`modal-overlay wf-config-modal-overlay${expanded ? ' wf-config-modal-expanded' : ''}`}
        role="presentation"
        onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
      >
        <div
          className={`modal ram-modal wf-config-modal${expanded ? ' wf-config-modal-full' : ''}`}
          role="dialog"
          aria-labelledby="wf-defaults-modal-title"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ram-header">
            <h3 id="wf-defaults-modal-title">Workflow Variables</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setExpanded(e => !e)}
                title={expanded ? 'Shrink to default size' : 'Expand to full screen'}
              >
                ⛶
              </button>
              <button type="button" className="ram-modal-close" onClick={handleCancel} aria-label="Close">&times;</button>
            </div>
          </div>
          <div className="wf-config-modal-body">
            <VariablesSection
              title="Workflow variables"
              hint="Available as {{name}} on every HTTP step unless that step sets its own. Save the workflow to persist."
              variables={draft}
              onUpdateVariables={setDraft}
              newVarKey={newVarKey}
              setNewVarKey={setNewVarKey}
              newVarValue={newVarValue}
              setNewVarValue={setNewVarValue}
              onRequestVariableInsert={requestVariableInsert}
              deprecatedKeys={workflowServices.length > 0 ? ['baseUrl'] : []}
            />

            {/* Workflow-level error handling */}
            <div className="wf-config-section" style={{ marginTop: 16 }}>
              <div className="wf-config-field">
                <label style={{ fontWeight: 600 }}>On Unhandled Error</label>
                <select
                  value={errorDraft?.mode ?? 'stop'}
                  onChange={(e) => {
                    const mode = e.target.value as WorkflowErrorMode;
                    if (mode === 'stop') {
                      setErrorDraft(undefined);
                    } else {
                      setErrorDraft({ mode, handlerEntryNodeId: errorDraft?.handlerEntryNodeId });
                    }
                  }}
                >
                  <option value="stop">Stop workflow (default)</option>
                  <option value="continue">Continue (ignore errors)</option>
                  <option value="run-handler">Run error handler subgraph</option>
                </select>
                <span className="wf-config-hint">
                  {(!errorDraft || errorDraft.mode === 'stop')
                    ? 'Workflow stops when any step fails without a node-level Error Handler'
                    : errorDraft.mode === 'continue'
                      ? 'Workflow continues even when steps fail'
                      : 'Executes a handler node when an unhandled error occurs'}
                </span>
              </div>

              {errorDraft?.mode === 'run-handler' && (
                <div className="wf-config-field">
                  <label>Handler Entry Node</label>
                  <select
                    value={errorDraft.handlerEntryNodeId ?? ''}
                    onChange={(e) => setErrorDraft({ ...errorDraft, handlerEntryNodeId: e.target.value || undefined })}
                  >
                    <option value="">Select a node…</option>
                    {workflowNodes
                      .filter(n => n.type !== 'start' && n.type !== 'end')
                      .map(n => (
                        <option key={n.id} value={n.id}>
                          {(n.data as { label?: string }).label || n.type} ({n.type})
                        </option>
                      ))}
                  </select>
                  <span className="wf-config-hint">
                    This node will execute with <code>{'{{error.message}}'}</code> and <code>{'{{error.statusCode}}'}</code> variables set
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="wf-config-modal-footer">
            <button type="button" className="btn btn-sm btn-ghost" onClick={handleCancel}>Cancel</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>

      <WorkflowVariableInsertModal
        open={variableInsertOpen}
        hints={variableInsertHints}
        shortRef={variableInsertShortRef}
        initialSearch={variableInsertInitialSearch}
        onClose={closeVariableInsert}
        onPick={handleVariableInsertPicked}
      />
    </>
  );
}
