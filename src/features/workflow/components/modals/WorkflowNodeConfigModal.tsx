import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import type {
  WorkflowNode,
  HttpNodeData,
  ConditionNodeData,
  DelayNodeData,
  StartNodeData,
  WebhookTriggerNodeData,
  ScheduleTriggerNodeData,
  SwitchNodeData,
  LoopNodeData,
  SetVariableNodeData,
  AggregateNodeData,
  ErrorHandlerNodeData,
  LogDebugNodeData,
  WaitForConditionNodeData,
  SubWorkflowNodeData,
  ScriptNodeData,
  WorkflowNodeData,
  WorkflowService,
} from '../../types/workflow';
import {
  isHttpWorkflowNode,
  buildConfigVariableInsertHints,
  mergeHttpVariableHintsWithStepInitialVars,
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import { snapshot } from '../../../../shared/utils/helpers';
import { useVariableInsertModal } from '../../hooks/useVariableInsertModal';
import HttpConfig from '../configs/HttpConfig';
import type { HttpTab } from '../configs/HttpConfig';
import ConditionConfig from '../configs/ConditionConfig';
import DelayConfig from '../configs/DelayConfig';
import SwitchConfig from '../configs/SwitchConfig';
import LoopConfig from '../configs/LoopConfig';
import SetVariableConfig from '../configs/SetVariableConfig';
import AggregateConfig from '../configs/AggregateConfig';
import ErrorHandlerConfig from '../configs/ErrorHandlerConfig';
import LogDebugConfig from '../configs/LogDebugConfig';
import WaitForConditionConfig from '../configs/WaitForConditionConfig';
import SubWorkflowConfig from '../configs/SubWorkflowConfig';
import type { WorkflowPickerItem } from '../configs/SubWorkflowConfig';
import ScriptConfig from '../configs/ScriptConfig';
import WebhookConfig from '../configs/WebhookConfig';
import ScheduleConfig from '../configs/ScheduleConfig';
import VariablesSection from '../panels/VariablesSection';
import NodeConfigInputTab from '../configs/NodeConfigInputTab';
import NodeConfigOutputTab from '../configs/NodeConfigOutputTab';
import NodeConfigLogsTab from '../configs/NodeConfigLogsTab';
import WorkflowEditorModalFrame from './WorkflowEditorModalFrame';
import type { ExtractionFetchSampleProps } from '../../../requests/components/ExtractionPathPickerModal';

type ConfigPanelTab = 'config' | 'input' | 'output' | 'logs';

interface Props {
  node: WorkflowNode;
  workflowVariables: Record<string, string>;
  onUpdateNode: (id: string, patch: Partial<WorkflowNodeData>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
  workflowId?: string;
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
  /** Last execution status for this node (for Output/Logs tabs). */
  nodeRunStatus?: import('../../types/workflow').NodeRunStatus | null;
  /** All saved workflows for sub-workflow picker. */
  workflows?: WorkflowPickerItem[];
}

export default function WorkflowNodeConfigModal({
  node, workflowVariables, onUpdateNode, onDeleteNode, onClose, workflowId,
  lastQuickTestRequestUrl, lastRunStepError, effectiveQuickTestBaseUrl,
  resolveBaseUrl, fallbackBaseUrl = '',
  extractionSampleResponseBody, extractionFetchSample,
  conditionVariableHints = [], httpVariableHints = [], workflowServices = [],
  nodeRunStatus,
  workflows = [],
}: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>('url');
  const [panelTab, setPanelTab] = useState<ConfigPanelTab>('config');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
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
    setDraft(snapshot(node.data)); // eslint-disable-line react-hooks/set-state-in-effect -- reset draft when switching nodes
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

  const draftVariableHints = useMemo((): WorkflowVariableHint[] => {
    if (!isHttpWorkflowNode(draftNode)) return httpVariableHints;
    return mergeHttpVariableHintsWithStepInitialVars(httpVariableHints, draftNode.data as HttpNodeData);
  }, [draftNode, httpVariableHints]);

  // Recompute variable hints from draft so SOURCE column stays in sync with draft initial variables.
  const variableInsertHints = useMemo(
    () => buildConfigVariableInsertHints({
      node: draftNode,
      workflowVariables,
      httpVariableHints,
      conditionVariableHints,
    }),
    [draftNode, workflowVariables, httpVariableHints, conditionVariableHints],
  );

  // Deduplicated hints for the Input tab — hide scoped refs when only one source exists
  const inputTabHints = useMemo(() => {
    const scopedCountMap = new Map<string, number>();
    for (const h of variableInsertHints) {
      const m = h.ref.match(/^node:"[^"]+"\.(.+)$/);
      if (m) scopedCountMap.set(m[1], (scopedCountMap.get(m[1]) ?? 0) + 1);
    }
    const latestBaseNames = new Set(
      variableInsertHints.filter(h => h.label.endsWith('(latest)')).map(h => h.ref)
    );
    return variableInsertHints.filter(h => {
      const m = h.ref.match(/^node:"[^"]+"\.(.+)$/);
      if (!m) return true;
      return !latestBaseNames.has(m[1]) || (scopedCountMap.get(m[1]) ?? 0) > 1;
    });
  }, [variableInsertHints]);

  const title = `${node.type.toUpperCase()} — ${(draft as HttpNodeData).label || 'Step Config'}`;

  return (
    <>
      <WorkflowEditorModalFrame
        title={<span id="wf-config-modal-title">{title}</span>}
        titleId="wf-config-modal-title"
        onClose={handleCancel}
        expandMode="fullscreen"
        headerActions={(
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => { onDeleteNode(node.id); onClose(); }}
            title="Delete node"
          >
            Delete
          </button>
        )}
        footer={(
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={handleCancel}>Cancel</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
          </>
        )}
      >
          {isHttpWorkflowNode(draftNode) && (
          <div className="wf-config-modal-tabs">
            <button className={`wf-config-modal-tab${panelTab === 'config' ? ' active' : ''}`} onClick={() => setPanelTab('config')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Config
            </button>
            <button className={`wf-config-modal-tab${panelTab === 'input' ? ' active' : ''}`} onClick={() => setPanelTab('input')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12"/><polyline points="22 12 18 8"/><polyline points="22 12 18 16"/><rect x="2" y="4" width="12" height="16" rx="2"/></svg>
              Input
              {inputTabHints.length > 0 && <span className="wf-config-modal-tab-badge">{inputTabHints.length}</span>}
            </button>
            <button className={`wf-config-modal-tab${panelTab === 'output' ? ' active' : ''}`} onClick={() => setPanelTab('output')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="2 12 8 12"/><polyline points="2 12 6 8"/><polyline points="2 12 6 16"/><rect x="10" y="4" width="12" height="16" rx="2"/></svg>
              Output
            </button>
            <button className={`wf-config-modal-tab${panelTab === 'logs' ? ' active' : ''}`} onClick={() => setPanelTab('logs')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Logs
            </button>
          </div>
          )}
          <div>
            {(panelTab === 'config' || !isHttpWorkflowNode(draftNode)) && (<>
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
                onRequestVariableInsert={requestVariableInsert}
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

            {draftNode.type === 'webhook' && (
              <WebhookConfig
                data={draftNode.data as WebhookTriggerNodeData}
                onChange={updateDraft}
                workflowId={workflowId}
                nodeId={node.id}
              />
            )}

            {draftNode.type === 'schedule' && (
              <ScheduleConfig
                data={draftNode.data as ScheduleTriggerNodeData}
                onChange={updateDraft}
                newVarKey={newVarKey}
                setNewVarKey={setNewVarKey}
                newVarValue={newVarValue}
                setNewVarValue={setNewVarValue}
                workflowVariables={workflowVariables}
              />
            )}

            {draftNode.type === 'switch' && (
              <SwitchConfig
                data={draftNode.data as SwitchNodeData}
                onChange={(data) => updateDraft(data)}
                onRequestVariableInsert={requestVariableInsert}
                variableHints={conditionVariableHints}
              />
            )}

            {draftNode.type === 'loop' && (
              <LoopConfig
                data={draftNode.data as LoopNodeData}
                onChange={(data) => updateDraft(data)}
                onRequestVariableInsert={requestVariableInsert}
                variableHints={conditionVariableHints}
              />
            )}

            {draftNode.type === 'setVariable' && (
              <SetVariableConfig
                data={draftNode.data as SetVariableNodeData}
                onChange={(data) => updateDraft(data)}
                onRequestVariableInsert={requestVariableInsert}
                variableHints={conditionVariableHints}
              />
            )}

            {draftNode.type === 'aggregate' && (
              <AggregateConfig
                data={draftNode.data as AggregateNodeData}
                onChange={(data) => updateDraft(data)}
                onRequestVariableInsert={requestVariableInsert}
                variableHints={conditionVariableHints}
              />
            )}

            {draftNode.type === 'errorHandler' && (
              <ErrorHandlerConfig
                data={draftNode.data as ErrorHandlerNodeData}
                onChange={(data) => updateDraft(data)}
              />
            )}

            {draftNode.type === 'logDebug' && (
              <LogDebugConfig
                data={draftNode.data as LogDebugNodeData}
                onChange={(data) => updateDraft(data)}
                onRequestVariableInsert={requestVariableInsert}
                variableHints={conditionVariableHints}
              />
            )}

            {draftNode.type === 'waitForCondition' && (
              <WaitForConditionConfig
                data={draftNode.data as WaitForConditionNodeData}
                onChange={(data) => updateDraft(data)}
                onRequestVariableInsert={requestVariableInsert}
                variableHints={conditionVariableHints}
              />
            )}

            {draftNode.type === 'subWorkflow' && (
              <SubWorkflowConfig
                data={draftNode.data as SubWorkflowNodeData}
                onChange={(data) => updateDraft(data)}
                workflows={workflows}
                currentWorkflowId={workflowId}
              />
            )}

            {draftNode.type === 'script' && (
              <ScriptConfig
                data={draftNode.data as ScriptNodeData}
                onChange={(data) => updateDraft(data)}
                onRequestVariableInsert={requestVariableInsert}
                variableHints={conditionVariableHints}
              />
            )}

            {/* Generic label editor for fork, join, end nodes */}
            {(draftNode.type === 'fork' || draftNode.type === 'join' || draftNode.type === 'end') && (
              <div className="wf-config-section">
                <label className="wf-config-label">
                  Label
                  <input
                    type="text"
                    className="wf-config-input"
                    value={draft.label || ''}
                    onChange={(e) => updateDraft({ label: e.target.value })}
                    placeholder={`${draftNode.type.charAt(0).toUpperCase() + draftNode.type.slice(1)} node`}
                  />
                  <span className="wf-config-hint">Display name for this {draftNode.type} node</span>
                </label>
              </div>
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
            </>)}

            {panelTab === 'input' && (
              <NodeConfigInputTab hints={inputTabHints} />
            )}

            {panelTab === 'output' && (
              <NodeConfigOutputTab nodeRunStatus={nodeRunStatus} />
            )}

            {panelTab === 'logs' && (
              <NodeConfigLogsTab nodeRunStatus={nodeRunStatus} />
            )}
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
