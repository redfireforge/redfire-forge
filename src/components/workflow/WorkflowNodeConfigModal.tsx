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
import SwitchConfig from './SwitchConfig';
import LoopConfig from './LoopConfig';
import SetVariableConfig from './SetVariableConfig';
import AggregateConfig from './AggregateConfig';
import WebhookConfig from './WebhookConfig';
import ScheduleConfig from './ScheduleConfig';
import VariablesSection from './VariablesSection';
import type { ExtractionFetchSampleProps } from '../ExtractionPathPickerModal';

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
}

export default function WorkflowNodeConfigModal({
  node, workflowVariables, onUpdateNode, onDeleteNode, onClose, workflowId,
  lastQuickTestRequestUrl, lastRunStepError, effectiveQuickTestBaseUrl,
  resolveBaseUrl, fallbackBaseUrl = '',
  extractionSampleResponseBody, extractionFetchSample,
  conditionVariableHints = [], httpVariableHints = [], workflowServices = [],
  nodeRunStatus,
}: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>('url');
  const [panelTab, setPanelTab] = useState<ConfigPanelTab>('config');
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
          <div className="wf-config-modal-tabs">
            <button className={`wf-config-modal-tab${panelTab === 'config' ? ' active' : ''}`} onClick={() => setPanelTab('config')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Config
            </button>
            <button className={`wf-config-modal-tab${panelTab === 'input' ? ' active' : ''}`} onClick={() => setPanelTab('input')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12"/><polyline points="22 12 18 8"/><polyline points="22 12 18 16"/><rect x="2" y="4" width="12" height="16" rx="2"/></svg>
              Input
              {variableInsertHints.length > 0 && <span className="wf-config-modal-tab-badge">{variableInsertHints.length}</span>}
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
          <div className="wf-config-modal-body">
            {panelTab === 'config' && (<>
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
              />
            )}

            {draftNode.type === 'loop' && (
              <LoopConfig
                data={draftNode.data as LoopNodeData}
                onChange={(data) => updateDraft(data)}
              />
            )}

            {draftNode.type === 'setVariable' && (
              <SetVariableConfig
                data={draftNode.data as SetVariableNodeData}
                onChange={(data) => updateDraft(data)}
              />
            )}

            {draftNode.type === 'aggregate' && (
              <AggregateConfig
                data={draftNode.data as AggregateNodeData}
                onChange={(data) => updateDraft(data)}
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
              <div className="wf-config-tab-content">
                <div className="wf-config-tab-hint">Resolved variables available to this step at execution time:</div>
                {variableInsertHints.length > 0 ? (
                  <table className="wf-config-var-table">
                    <thead><tr><th>Variable</th><th>Source</th></tr></thead>
                    <tbody>
                      {variableInsertHints.map(h => (
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
            )}

            {panelTab === 'output' && (
              <div className="wf-config-tab-content">
                {nodeRunStatus && nodeRunStatus.state !== 'idle' && nodeRunStatus.state !== 'pending' ? (
                  <>
                    <div className="wf-output-header">
                      <span className="wf-output-label">Last Quick Test</span>
                      <span className={`wf-output-status wf-output-status-${nodeRunStatus.state}`}>
                        {nodeRunStatus.state === 'pass' ? '●' : nodeRunStatus.state === 'fail' ? '●' : '●'}{' '}
                        {nodeRunStatus.statusCode ? `${nodeRunStatus.statusCode}` : nodeRunStatus.state}
                      </span>
                    </div>
                    <div className="wf-output-meta">
                      {nodeRunStatus.statusCode != null && (
                        <div className="wf-output-meta-item">
                          <div className="wf-output-meta-label">Status</div>
                          <div className={`wf-output-meta-value ${nodeRunStatus.statusCode < 400 ? 'wf-output-meta-ok' : 'wf-output-meta-err'}`}>{nodeRunStatus.statusCode}</div>
                        </div>
                      )}
                      {nodeRunStatus.responseTimeMs != null && (
                        <div className="wf-output-meta-item">
                          <div className="wf-output-meta-label">Duration</div>
                          <div className="wf-output-meta-value wf-output-meta-info">{nodeRunStatus.responseTimeMs}ms</div>
                        </div>
                      )}
                    </div>
                    {nodeRunStatus.extracted && Object.keys(nodeRunStatus.extracted).length > 0 && (
                      <div className="wf-output-section">
                        <div className="wf-output-section-title">Extracted Variables</div>
                        <table className="wf-config-var-table">
                          <thead><tr><th>Name</th><th>Value</th></tr></thead>
                          <tbody>
                            {Object.entries(nodeRunStatus.extracted).map(([k, v]) => (
                              <tr key={k}>
                                <td className="wf-config-var-ref">{k}</td>
                                <td className="wf-config-var-source wf-config-var-mono">{v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {nodeRunStatus.responseDetail && (
                      <div className="wf-output-section">
                        <div className="wf-output-section-title">Response</div>
                        <pre className="wf-output-body">{nodeRunStatus.responseDetail}</pre>
                      </div>
                    )}
                    {nodeRunStatus.error && (
                      <div className="wf-output-section">
                        <div className="wf-output-section-title">Error</div>
                        <pre className="wf-output-body wf-output-body-err">{nodeRunStatus.error}</pre>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="wf-config-tab-empty">No execution data yet. Run a Quick Test to see results here.</div>
                )}
              </div>
            )}

            {panelTab === 'logs' && (
              <div className="wf-config-tab-content">
                {nodeRunStatus && nodeRunStatus.state !== 'idle' && nodeRunStatus.state !== 'pending' ? (
                  <div className="wf-logs-list">
                    {nodeRunStatus.statusCode != null && (
                      <div className="wf-log-entry">
                        <span className={`wf-log-level wf-log-level-${nodeRunStatus.state === 'pass' ? 'ok' : nodeRunStatus.state === 'fail' ? 'err' : 'info'}`}>
                          {nodeRunStatus.state === 'pass' ? 'OK' : nodeRunStatus.state === 'fail' ? 'ERR' : 'INFO'}
                        </span>
                        <span className="wf-log-msg">
                          HTTP {nodeRunStatus.statusCode}
                          {nodeRunStatus.responseTimeMs != null && ` (${nodeRunStatus.responseTimeMs}ms)`}
                        </span>
                      </div>
                    )}
                    {nodeRunStatus.extracted && Object.entries(nodeRunStatus.extracted).map(([k, v]) => (
                      <div key={k} className="wf-log-entry">
                        <span className="wf-log-level wf-log-level-info">INFO</span>
                        <span className="wf-log-msg">Extracted: {k} = &quot;{v}&quot;</span>
                      </div>
                    ))}
                    {nodeRunStatus.error && (
                      <div className="wf-log-entry">
                        <span className="wf-log-level wf-log-level-err">ERR</span>
                        <span className="wf-log-msg">{nodeRunStatus.error}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="wf-config-tab-empty">No logs yet. Run a Quick Test to see step logs here.</div>
                )}
              </div>
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
