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
import HttpConfig from './HttpConfig';
import type { HttpTab } from './HttpConfig';
import ConditionConfig from './ConditionConfig';
import DelayConfig from './DelayConfig';
import VariablesSection from './VariablesSection';
import type { ExtractionFetchSampleProps } from '../ExtractionPathPickerModal';

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
}

export default function WorkflowConfigPanel({ node, workflowVariables, onUpdateWorkflowVariables, onUpdateNode, onDeleteNode, lastQuickTestRequestUrl, lastRunStepError, effectiveQuickTestBaseUrl, extractionSampleResponseBody, extractionFetchSample, conditionVariableHints = [], httpVariableHints = [], workflowServices = [] }: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>('url');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [variableInsertOpen, setVariableInsertOpen] = useState(false);
  const [variableInsertShortRef, setVariableInsertShortRef] = useState(false);
  const [variableInsertInitialSearch, setVariableInsertInitialSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const collapsingRef = useRef(false);
  const insertApplyRef = useRef<(snippet: string) => void>(() => {});

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

  /** Always fold in this step's `initialVariables` + workflow defaults; parent graph hints can be empty if type/id desync. */
  const variableInsertHints = useMemo((): WorkflowVariableHint[] => {
    if (!node || !isHttpWorkflowNode(node)) return workflowOnlyPickerHints;
    const data = node.data as HttpNodeData;
    const withStep = mergeHttpVariableHintsWithStepInitialVars(httpVariableHints, data);
    const byRef = new Map<string, WorkflowVariableHint>(withStep.map((h) => [h.ref, h]));
    for (const h of workflowOnlyPickerHints) {
      if (!byRef.has(h.ref)) byRef.set(h.ref, h);
    }
    return Array.from(byRef.values()).sort((a, b) => a.ref.localeCompare(b.ref));
  }, [node, httpVariableHints, workflowOnlyPickerHints]);

  const requestVariableInsert = useCallback((apply: (snippet: string) => void, shortRef = false, initialSearch = '') => {
    insertApplyRef.current = apply;
    setVariableInsertShortRef(shortRef);
    setVariableInsertInitialSearch(initialSearch);
    setVariableInsertOpen(true);
  }, []);

  const handleVariableInsertPicked = useCallback((template: string) => {
    insertApplyRef.current(template);
    setVariableInsertOpen(false);
  }, []);

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
        />
      )}

      {node.type === 'condition' && (
        <ConditionConfig
          key={node.id}
          data={node.data as ConditionNodeData}
          onChange={(data) => onUpdateNode(node.id, data)}
          variableHints={conditionVariableHints}
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
            onClick={(e) => { if (e.target === e.currentTarget) collapse(); }}
          >
            <div
              className="modal ram-modal wf-expand-modal"
              role="dialog"
              aria-labelledby="wf-expand-title"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ram-header">
                <h3 id="wf-expand-title">{node.type.toUpperCase()} — {(node.data as HttpNodeData).label || 'Step Config'}</h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); collapse(); }} title="Shrink back to side panel">⛶</button>
                  <button type="button" className="ram-modal-close" onClick={(e) => { e.stopPropagation(); collapse(); }} aria-label="Close">&times;</button>
                </div>
              </div>
              <div className="wf-expand-modal-body">
                {configContent}
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
        onClose={() => setVariableInsertOpen(false)}
        onPick={handleVariableInsertPicked}
      />
    </div>
  );
}
