import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import type {
  WorkflowNode,
  HttpNodeData,
  ConditionNodeData,
  DelayNodeData,
  StartNodeData,
  WorkflowNodeData,
  WorkflowService,
} from '../../types/workflow';
import {
  isHttpWorkflowNode,
  mergeHttpVariableHintsWithStepInitialVars,
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import { snapshot } from '../../utils/helpers';
import { useVariableInsertModal } from '../../hooks/useVariableInsertModal';
import HttpConfig from './HttpConfig';
import type { HttpTab } from './HttpConfig';
import ConditionConfig from './ConditionConfig';
import DelayConfig from './DelayConfig';
import VariablesSection from './VariablesSection';
import type { ExtractionFetchSampleProps } from '../ExtractionPathPickerModal';

interface Props {
  node: WorkflowNode;
  workflowVariables: Record<string, string>;
  onUpdateNode: (id: string, patch: Partial<WorkflowNodeData>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
  lastQuickTestRequestUrl?: string | null;
  lastRunStepError?: string | null;
  effectiveQuickTestBaseUrl: string;
  /** Resolve the base URL for an HTTP node — uses draft data so the preview stays in sync with the Service dropdown. */
  resolveBaseUrl?: (data: HttpNodeData) => string | undefined;
  /** Fallback base URL when resolveBaseUrl returns undefined. */
  fallbackBaseUrl?: string;
  extractionSampleResponseBody?: string;
  extractionFetchSample?: Pick<ExtractionFetchSampleProps, 'onFetch' | 'fetching' | 'error'>;
  conditionVariableHints?: WorkflowVariableHint[];
  httpVariableHints?: WorkflowVariableHint[];
  workflowServices?: WorkflowService[];
}

export default function WorkflowNodeConfigModal({
  node, workflowVariables, onUpdateNode, onDeleteNode, onClose,
  lastQuickTestRequestUrl, lastRunStepError, effectiveQuickTestBaseUrl,
  resolveBaseUrl, fallbackBaseUrl = '',
  extractionSampleResponseBody, extractionFetchSample,
  conditionVariableHints = [], httpVariableHints = [], workflowServices = [],
}: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>('url');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const {
    variableInsertOpen, variableInsertShortRef, variableInsertInitialSearch,
    requestVariableInsert, handleVariableInsertPicked, closeVariableInsert,
  } = useVariableInsertModal();

  // Snapshot original data on open for Cancel rollback
  const originalDataRef = useRef<WorkflowNodeData>(snapshot(node.data));
  // Local draft state — all edits go here, committed only on Save
  const [draft, setDraft] = useState<WorkflowNodeData>(() => snapshot(node.data));

  // Reset draft if the modal is opened for a different node
  useEffect(() => {
    originalDataRef.current = snapshot(node.data);
    setDraft(snapshot(node.data));
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftNode = useMemo((): WorkflowNode => ({ ...node, data: draft }), [node, draft]);

  // Compute effective base URL from draft so it updates live when Service changes
  const draftEffectiveBaseUrl = useMemo(() => {
    if (resolveBaseUrl && isHttpWorkflowNode(draftNode)) {
      const resolved = resolveBaseUrl(draftNode.data as HttpNodeData);
      if (resolved) return resolved;
    }
    return fallbackBaseUrl || effectiveQuickTestBaseUrl;
  }, [resolveBaseUrl, draftNode, fallbackBaseUrl, effectiveQuickTestBaseUrl]);

  const updateDraft = useCallback((patch: Partial<WorkflowNodeData>) => {
    setDraft(prev => ({ ...prev, ...patch }));
  }, []);

  const handleSave = useCallback(() => {
    onUpdateNode(node.id, draft);
    onClose();
  }, [node.id, draft, onUpdateNode, onClose]);

  const handleCancel = useCallback(() => {
    // Rollback: restore original data
    onUpdateNode(node.id, originalDataRef.current);
    onClose();
  }, [node.id, onUpdateNode, onClose]);

  const workflowOnlyPickerHints = useMemo(
    (): WorkflowVariableHint[] =>
      Object.keys(workflowVariables)
        .filter((k) => k.trim().length > 0)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => {
          const t = k.trim();
          return { ref: t, label: `${t} (workflow)` };
        }),
    [workflowVariables],
  );

  // Recompute variable hints from draft so SOURCE column stays in sync with draft initial variables
  const draftVariableHints = useMemo((): WorkflowVariableHint[] => {
    if (!isHttpWorkflowNode(draftNode)) return httpVariableHints;
    const data = draftNode.data as HttpNodeData;
    return mergeHttpVariableHintsWithStepInitialVars(httpVariableHints, data);
  }, [draftNode, httpVariableHints]);

  const variableInsertHints = useMemo((): WorkflowVariableHint[] => {
    if (!isHttpWorkflowNode(draftNode)) return workflowOnlyPickerHints;
    const byRef = new Map<string, WorkflowVariableHint>(draftVariableHints.map((h) => [h.ref, h]));
    for (const h of workflowOnlyPickerHints) {
      if (!byRef.has(h.ref)) byRef.set(h.ref, h);
    }
    return Array.from(byRef.values()).sort((a, b) => a.ref.localeCompare(b.ref));
  }, [draftNode, draftVariableHints, workflowOnlyPickerHints]);

  const title = `${node.type.toUpperCase()} — ${(draft as HttpNodeData).label || 'Step Config'}`;

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
          aria-labelledby="wf-config-modal-title"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ram-header">
            <h3 id="wf-config-modal-title">{title}</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => { onDeleteNode(node.id); onClose(); }}
                title="Delete node"
              >
                Delete
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setExpanded(e => !e)}
                title={expanded ? 'Shrink to default size' : 'Expand to full screen'}
              >
                {expanded ? '⛶' : '⛶'}
              </button>
              <button type="button" className="ram-modal-close" onClick={handleCancel} aria-label="Close">&times;</button>
            </div>
          </div>
          <div className="wf-config-modal-body">
            {isHttpWorkflowNode(draftNode) && (
              <HttpConfig
                data={draftNode.data as HttpNodeData}
                onChange={(patch) => updateDraft(patch)}
                activeTab={httpTab}
                onTabChange={setHttpTab}
                lastRunError={lastRunStepError ?? undefined}
                lastQuickTestRequestUrl={lastQuickTestRequestUrl}
                effectiveQuickTestBaseUrl={draftEffectiveBaseUrl}
                extractionSampleResponseBody={extractionSampleResponseBody}
                extractionFetchSample={extractionFetchSample}
                variableHints={draftVariableHints}
                onRequestVariableInsert={requestVariableInsert}
                workflowServices={workflowServices}
              />
            )}

            {draftNode.type === 'condition' && (
              <ConditionConfig
                key={draftNode.id}
                data={draftNode.data as ConditionNodeData}
                onChange={(data) => updateDraft(data)}
                variableHints={conditionVariableHints}
              />
            )}

            {draftNode.type === 'delay' && (
              <DelayConfig
                data={draftNode.data as DelayNodeData}
                onChange={(data) => updateDraft(data)}
              />
            )}

            {draftNode.type === 'start' && (
              <VariablesSection
                title="Trigger input variables"
                hint="Variables seeded when the workflow starts. Available as {{name}} in all downstream steps."
                variables={(draftNode.data as StartNodeData).inputVariables ?? {}}
                onUpdateVariables={(vars) => updateDraft({ inputVariables: vars })}
                newVarKey={newVarKey}
                setNewVarKey={setNewVarKey}
                newVarValue={newVarValue}
                setNewVarValue={setNewVarValue}
                workflowVariables={workflowVariables}
              />
            )}

            {isHttpWorkflowNode(draftNode) && (
              <VariablesSection
                title="Initial variables (this step)"
                hint="Per-step values override upstream for the same name."
                variables={(draftNode.data as HttpNodeData).initialVariables ?? {}}
                onUpdateVariables={(vars) => updateDraft({ initialVariables: vars })}
                newVarKey={newVarKey}
                setNewVarKey={setNewVarKey}
                newVarValue={newVarValue}
                setNewVarValue={setNewVarValue}
                onRequestVariableInsert={requestVariableInsert}
                variableHints={draftVariableHints}
                workflowVariables={workflowVariables}
              />
            )}
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
