import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from '../modals/WorkflowVariableInsertModal';
import { useModalDrag } from '../../../../shared/hooks/useModalDrag';
import { useVariableInsertModal } from '../../hooks/useVariableInsertModal';
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
  buildConfigVariableInsertHints,
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import HttpConfig from '../configs/HttpConfig';
import type { HttpTab } from '../configs/HttpConfig';
import ConditionConfig from '../configs/ConditionConfig';
import DelayConfig from '../configs/DelayConfig';
import VariablesSection from './VariablesSection';
import WorkflowModalScrollBody from '../modals/WorkflowModalScrollBody';
import type { ExtractionFetchSampleProps } from '../../../requests/components/ExtractionEditor';
import { useWorkflowValidationFetch } from '../../hooks/useWorkflowValidationFetch';
import type { Environment, Scenario } from '../../../../shared/types';

interface Props {
  node: WorkflowNode | null;
  /** Workflow-wide defaults (saved on the workflow). */
  workflowVariables: Record<string, string>;
  onUpdateWorkflowVariables: (variables: Record<string, string>) => void;
  /** Merged shallowly into the node's current `data` (avoids dropping `initialVariables` when HTTP fields update). */
  onUpdateNode: (id: string, patch: Partial<WorkflowNodeData>) => void;
  onDeleteNode: (id: string) => void;
  /** Final URL from the last Quick Test (success or fail) for debugging. */
  lastQuickTestRequestUrl?: string | null;
  /** HTTP step error line from the last run (kept off node `data` in the designer). */
  lastRunStepError?: string | null;
  /**
   * For the selected HTTP node: resolved base after per-request host override, else harness.
   * Used for Extract → Fetch sample and URL hints.
   */
  effectiveQuickTestBaseUrl: string;
  /** Last successful Fetch Response body for Extract → Pick JSON path. */
  extractionSampleResponseBody?: string;
  /** Fetch handler + loading/error for Extract modal (omit `host`; HttpConfig adds it from scenario). */
  extractionFetchSample?: Pick<ExtractionFetchSampleProps, 'onFetch' | 'fetching' | 'error'>;
  /**
   * When configuring a condition node: workflow vars, upstream HTTP extractions (unscoped + `node:id.name`),
   * and `status`. Used to validate `{{name}}` / `{{node:id.name}}` references.
   */
  conditionVariableHints?: WorkflowVariableHint[];
  /** Upstream + workflow variable templates for the selected HTTP step (URL, params, headers, body). */
  httpVariableHints?: WorkflowVariableHint[];
  /** Workflow-level services from the Service Registry. */
  workflowServices?: WorkflowService[];
  /** Available environments for per-node env override. */
  environments?: Environment[];
  /** Currently selected global environment. */
  selectedEnvId?: string;
  /** Resolved auth from service registry — used when scenario auth is 'inherit'. */
  resolvedAuth?: Scenario['auth'];
}

export default function WorkflowConfigPanel({ node, workflowVariables, onUpdateWorkflowVariables, onUpdateNode, onDeleteNode, lastQuickTestRequestUrl, lastRunStepError, effectiveQuickTestBaseUrl, extractionSampleResponseBody, extractionFetchSample, conditionVariableHints = [], httpVariableHints = [], workflowServices = [], environments = [], selectedEnvId, resolvedAuth }: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>('url');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const {
    variableInsertOpen,
    variableInsertShortRef,
    variableInsertInitialSearch,
    requestVariableInsert,
    handleVariableInsertPicked,
    closeVariableInsert,
  } = useVariableInsertModal();
  const [expanded, setExpanded] = useState(false);
  const { onDragStart: onExpandDragStart, overlayStyle: expandOverlayStyle, modalStyle: expandModalStyle } = useModalDrag(expanded);
  const collapsingRef = useRef(false);

  const collapse = useCallback(() => {
    collapsingRef.current = true;
    setExpanded(false);
    requestAnimationFrame(() => { collapsingRef.current = false; });
  }, []);

  const tryExpand = useCallback(() => {
    if (!collapsingRef.current) setExpanded(true);
  }, []);

  // Reset to inline view when a different node is selected
  useEffect(() => {
     
    setExpanded(false);
  }, [node?.id]);

  /** Always fold in this step's `initialVariables` + workflow defaults; parent graph hints can be empty if type/id desync. */
  const variableInsertHints = useMemo(
    () => buildConfigVariableInsertHints({ node, workflowVariables, httpVariableHints, conditionVariableHints }),
    [node, workflowVariables, httpVariableHints, conditionVariableHints],
  );

  // ── Validation fetch hook for HTTP nodes ──
  const httpScenario = node && isHttpWorkflowNode(node) ? (node.data as HttpNodeData).scenario : null;
  const placeholderScenario = useRef<Scenario>({ id: '', name: '', url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } });
  const validationDraftRef = useRef<Scenario>(httpScenario ?? placeholderScenario.current);
  validationDraftRef.current = httpScenario ?? placeholderScenario.current;
  const handleValidationDraftChange = useCallback((draft: Scenario) => {
    if (node) onUpdateNode(node.id, { scenario: draft });
  }, [node, onUpdateNode]);

  const validationFetch = useWorkflowValidationFetch({
    draftRef: validationDraftRef,
    onDraftChange: handleValidationDraftChange,
    liveVariables: workflowVariables,
    resolvedBaseUrl: effectiveQuickTestBaseUrl,
    resolvedAuth,
    resetKey: node?.id,
  });

  /** Shared config body rendered in both inline and expanded modal views. */
  const configContent = node ? (
    <>
      {isHttpWorkflowNode(node) && (
        <HttpConfig
          data={node.data as HttpNodeData}
          onChange={(patch) => onUpdateNode(node.id, patch)}
          activeTab={httpTab}
          onTabChange={setHttpTab}
          lastRunError={lastRunStepError ?? undefined}
          lastQuickTestRequestUrl={lastQuickTestRequestUrl}
          effectiveQuickTestBaseUrl={effectiveQuickTestBaseUrl}
          extractionSampleResponseBody={extractionSampleResponseBody}
          extractionFetchSample={extractionFetchSample}
          variableHints={httpVariableHints}
          onRequestVariableInsert={requestVariableInsert}
          workflowServices={workflowServices}
          environments={environments}
          selectedEnvId={selectedEnvId}
          validationProps={{
            resolvedBaseUrl: effectiveQuickTestBaseUrl,
            fetchingResponse: validationFetch.fetchingResponse,
            fetchError: validationFetch.fetchError,
            fetchHostOverride: validationFetch.fetchHostOverride,
            setFetchHostOverride: validationFetch.setFetchHostOverride,
            fetchHostEnabled: validationFetch.fetchHostEnabled,
            setFetchHostEnabled: validationFetch.setFetchHostEnabled,
            onFetchSampleResponse: validationFetch.handleFetchSampleResponse,
            fetchSampleDataForMapper: validationFetch.fetchSampleDataForMapper,
            validating: validationFetch.validating,
            validationResult: validationFetch.validationResult,
            setValidationResult: validationFetch.setValidationResult,
            onValidateResponse: validationFetch.handleValidateResponse,
            pendingFetchResponse: validationFetch.pendingFetchResponse,
            onFetchKeepRules: validationFetch.handleFetchKeepRules,
            onFetchReplaceAll: validationFetch.handleFetchReplaceAll,
            onFetchCancel: validationFetch.handleFetchCancel,
          }}
        />
      )}

      {node.type === 'condition' && (
        <ConditionConfig
          key={node.id}
          data={node.data as ConditionNodeData}
          onChange={(data) => onUpdateNode(node.id, data)}
          variableHints={conditionVariableHints}
          onRequestVariableInsert={requestVariableInsert}
        />
      )}

      {node.type === 'delay' && (
        <DelayConfig
          data={node.data as DelayNodeData}
          onChange={(data) => onUpdateNode(node.id, data)}
        />
      )}

      {node.type === 'start' && (
        <VariablesSection
          title="Trigger input variables"
          hint="Variables seeded when the workflow starts. Available as {{name}} in all downstream steps."
          variables={(node.data as StartNodeData).inputVariables ?? {}}
          onUpdateVariables={(vars) => onUpdateNode(node.id, { inputVariables: vars })}
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          workflowVariables={workflowVariables}
        />
      )}

      {(!node || isHttpWorkflowNode(node)) && (
        <VariablesSection
          title={node && isHttpWorkflowNode(node) ? 'Initial variables (this step)' : 'Workflow defaults'}
          hint={
            node && isHttpWorkflowNode(node)
              ? 'Per-step values override upstream for the same name. To target a specific earlier HTTP step, use {{node:<step id>.name}} in Params or the URL (see the list under Params), or remove this row so {{name}} resolves from upstream.'
              : 'Available as {{name}} on every HTTP step unless that step sets its own. Save the workflow to persist.'
          }
          variables={
            node && isHttpWorkflowNode(node)
              ? (node.data as HttpNodeData).initialVariables ?? {}
              : workflowVariables
          }
          onUpdateVariables={
            node && isHttpWorkflowNode(node)
              ? (vars) => onUpdateNode(node.id, { initialVariables: vars })
              : (vars) => onUpdateWorkflowVariables(vars)
          }
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          onRequestVariableInsert={requestVariableInsert}
        />
      )}
    </>
  ) : null;

  return (
    <div className="wf-config-panel wf-node-config-panel">
      {!node && (
        <div className="wf-config-empty">
          <p>Select a node to configure</p>
          <p className="wf-config-hint">Click any step on the canvas, or add one from the palette</p>
        </div>
      )}

      {node && !expanded && (
        <>
          <div className="wf-config-header">
            <span className="wf-config-type">{node.type.toUpperCase()}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-sm" onClick={tryExpand} title="Expand to full screen">⛶</button>
              <button className="btn btn-sm btn-danger" onClick={() => onDeleteNode(node.id)} title="Delete node">×</button>
            </div>
          </div>
          {configContent}
        </>
      )}

      {node && expanded && (
        <>
          <div className="wf-config-header">
            <span className="wf-config-type">{node.type.toUpperCase()}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-sm" onClick={tryExpand} title="Expand to full screen">⛶</button>
              <button className="btn btn-sm btn-danger" onClick={() => onDeleteNode(node.id)} title="Delete node">×</button>
            </div>
          </div>
          <div
            className="modal-overlay wf-expand-modal-overlay"
            role="presentation"
            style={expandOverlayStyle}
          >
            <div
              className="modal ram-modal wf-expand-modal"
              role="dialog"
              aria-labelledby="wf-expand-title"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              style={expandModalStyle}
            >
              <div className="ram-header" style={{ cursor: 'move' }} onMouseDown={onExpandDragStart}>
                <h3 id="wf-expand-title">{node.type.toUpperCase()} — {(node.data as HttpNodeData).label || 'Step Config'}</h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); collapse(); }} title="Shrink back to side panel">⛶</button>
                </div>
              </div>
              <WorkflowModalScrollBody className="wf-expand-modal-body" viewportClassName="wf-config-modal-scroll">
                {configContent}
              </WorkflowModalScrollBody>
              <div className="wf-expand-modal-footer">
                <button type="button" className="btn btn-primary" onClick={(e) => { e.stopPropagation(); collapse(); }}>Close</button>
              </div>
            </div>
          </div>
        </>
      )}

      {!node && (
        <VariablesSection
          title="Workflow defaults"
          hint="Available as {{name}} on every HTTP step unless that step sets its own. Save the workflow to persist."
          variables={workflowVariables}
          onUpdateVariables={(vars) => onUpdateWorkflowVariables(vars)}
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          onRequestVariableInsert={requestVariableInsert}
          deprecatedKeys={workflowServices.length > 0 ? ['baseUrl'] : []}
        />
      )}

      <WorkflowVariableInsertModal
        open={variableInsertOpen}
        hints={variableInsertHints}
        shortRef={variableInsertShortRef}
        initialSearch={variableInsertInitialSearch}
        onClose={closeVariableInsert}
        onPick={handleVariableInsertPicked}
      />
    </div>
  );
}
