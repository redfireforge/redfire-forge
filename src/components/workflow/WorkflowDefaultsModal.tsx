import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import VariablesSection from './VariablesSection';
import type { WorkflowService } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { snapshot } from '../../utils/helpers';
import { useVariableInsertModal } from '../../hooks/useVariableInsertModal';

interface Props {
  open: boolean;
  workflowVariables: Record<string, string>;
  onUpdateWorkflowVariables: (variables: Record<string, string>) => void;
  onClose: () => void;
  workflowServices?: WorkflowService[];
}

export default function WorkflowDefaultsModal({
  open, workflowVariables, onUpdateWorkflowVariables, onClose, workflowServices = [],
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

  // Reset draft when modal opens
  useEffect(() => {
    if (open) {
      originalRef.current = snapshot(workflowVariables);
      setDraft(snapshot(workflowVariables));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(() => {
    onUpdateWorkflowVariables(draft);
    onClose();
  }, [draft, onUpdateWorkflowVariables, onClose]);

  const handleCancel = useCallback(() => {
    onUpdateWorkflowVariables(originalRef.current);
    onClose();
  }, [onUpdateWorkflowVariables, onClose]);

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
            <h3 id="wf-defaults-modal-title">Workflow Defaults</h3>
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
              title="Workflow defaults"
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
