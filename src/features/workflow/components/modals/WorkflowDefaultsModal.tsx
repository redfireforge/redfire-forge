import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import VariablesSection from '../panels/VariablesSection';
import type { WorkflowService, WorkflowErrorConfig, WorkflowErrorMode, WorkflowNode } from '../../types/workflow';
import { buildWorkflowOnlyHints } from '../../utils/workflowVariableHints';
import { snapshot } from '../../../../shared/utils/helpers';
import { useVariableInsertModal } from '../../hooks/useVariableInsertModal';
import WorkflowEditorModalFrame from './WorkflowEditorModalFrame';
import WfDarkSelect from './WfDarkSelect';

const ERROR_MODE_OPTIONS: { value: WorkflowErrorMode; label: string }[] = [
  { value: 'stop', label: 'Stop workflow (default)' },
  { value: 'continue', label: 'Continue (ignore errors)' },
  { value: 'run-handler', label: 'Run error handler subgraph' },
];

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

  const variableInsertHints = useMemo(() => buildWorkflowOnlyHints(draft), [draft]);

  if (!open) return null;

  return (
    <>
      <WorkflowEditorModalFrame
        open={open}
        title={<span id="wf-defaults-modal-title">Workflow Variables</span>}
        titleId="wf-defaults-modal-title"
        onClose={handleCancel}
        hideExpandButton
        hideCloseButton
        minWidth={360}
        minHeight={280}
        dialogClassName="wf-config-modal wf-defaults-modal"
        footer={(
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={handleCancel}>Cancel</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
          </>
        )}
      >
        <div className="wf-defaults-body">
          <section className="wf-defaults-card">
            <header className="wf-defaults-card-header">
              <h4 className="wf-defaults-card-title">Variables</h4>
              <p className="wf-defaults-card-hint">
                Available as <code>{'{{name}}'}</code> on every HTTP step unless that step overrides it.
                Save the workflow to persist changes.
              </p>
            </header>
            <div className="wf-defaults-card-body wf-defaults-vars-section">
              <VariablesSection
                title=""
                hint=""
                variables={draft}
                onUpdateVariables={setDraft}
                newVarKey={newVarKey}
                setNewVarKey={setNewVarKey}
                newVarValue={newVarValue}
                setNewVarValue={setNewVarValue}
                onRequestVariableInsert={requestVariableInsert}
                deprecatedKeys={workflowServices.length > 0 ? ['baseUrl'] : []}
                showSourceColumn={false}
              />
            </div>
          </section>

          <section className="wf-defaults-card">
            <header className="wf-defaults-card-header">
              <h4 className="wf-defaults-card-title">Error Handling</h4>
              <p className="wf-defaults-card-hint">
                What happens when a step fails without a node-level Error Handler.
              </p>
            </header>
            <div className="wf-defaults-card-body wf-defaults-error-section">
              <div className="wf-defaults-form-row">
                <div className="wf-defaults-form-label">On unhandled error</div>
                <div className="wf-defaults-form-ctrl">
                  <WfDarkSelect
                    aria-label="On Unhandled Error"
                    testId="wf-defaults-error-mode"
                    value={errorDraft?.mode ?? 'stop'}
                    options={ERROR_MODE_OPTIONS}
                    onChange={(next) => {
                      const mode = next as WorkflowErrorMode;
                      if (mode === 'stop') {
                        setErrorDraft(undefined);
                      } else {
                        setErrorDraft({ mode, handlerEntryNodeId: errorDraft?.handlerEntryNodeId });
                      }
                    }}
                  />
                </div>
              </div>
              <p className="wf-defaults-form-hint">
                {(!errorDraft || errorDraft.mode === 'stop')
                  ? 'Workflow stops when any step fails without a node-level Error Handler.'
                  : errorDraft.mode === 'continue'
                    ? 'Workflow continues even when steps fail.'
                    : 'Executes a handler node when an unhandled error occurs.'}
              </p>

              {errorDraft?.mode === 'run-handler' && (
                <>
                  <div className="wf-defaults-form-row">
                    <div className="wf-defaults-form-label">Handler entry node</div>
                    <div className="wf-defaults-form-ctrl">
                      <WfDarkSelect
                        aria-label="Handler Entry Node"
                        testId="wf-defaults-handler-node"
                        value={errorDraft.handlerEntryNodeId ?? ''}
                        options={[
                          { value: '', label: 'Select a node…' },
                          ...workflowNodes
                            .filter((n) => n.type !== 'start' && n.type !== 'end')
                            .map((n) => ({
                              value: n.id,
                              label: `${(n.data as { label?: string }).label || n.type} (${n.type})`,
                            })),
                        ]}
                        onChange={(next) => setErrorDraft({ ...errorDraft, handlerEntryNodeId: next || undefined })}
                      />
                    </div>
                  </div>
                  <p className="wf-defaults-form-hint">
                    This node runs with <code>{'{{error.message}}'}</code> and <code>{'{{error.statusCode}}'}</code> set.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </WorkflowEditorModalFrame>

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
