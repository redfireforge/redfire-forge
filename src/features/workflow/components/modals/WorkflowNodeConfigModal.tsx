import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import type {
  WorkflowNode,
  HttpNodeData,
  WsConnectNodeData,
  GraphqlQueryNodeData,
  GraphqlSubscriptionNodeData,
  GraphqlIntrospectNodeData,
  GraphqlAssertNodeData,
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
import type { HttpTab } from '../configs/HttpConfig';
import type { WorkflowPickerItem } from '../configs/SubWorkflowConfig';
import {
  hasGraphqlNodeConfigErrors,
  isGraphqlWorkflowNodeType,
} from '../../../graphql/utils/graphqlPanelHelpers';
import NodeConfigInputTab from '../configs/NodeConfigInputTab';
import NodeConfigOutputTab from '../configs/NodeConfigOutputTab';
import NodeConfigLogsTab from '../configs/NodeConfigLogsTab';
import WorkflowEditorModalFrame from './WorkflowEditorModalFrame';
import WorkflowNodeConfigTypePanels from './WorkflowNodeConfigTypePanels';
import type { ExtractionFetchSampleProps } from '../../../requests/components/ExtractionEditor';
import { useWorkflowValidationFetch } from '../../hooks/useWorkflowValidationFetch';
import type { Environment, Scenario, GlobalAuthProfile } from '../../../../shared/types';

type ConfigPanelTab = 'config' | 'input' | 'output' | 'logs';

/**
 * Remember the last HTTP Request-details sub-tab (Params/Body/Extract/…) per node.
 * Reopening the same node restores Extract (etc.) so configured rules stay visible
 * instead of always landing on Params.
 */
const lastHttpTabByNodeId = new Map<string, HttpTab>();

const NODE_TYPE_LABELS: Record<string, string> = {
  http: 'HTTP', wsConnect: 'WS Connect', wsSend: 'WS Send',
  wsReceive: 'WS Receive', wsTrigger: 'WS Trigger',
  kafkaProduce: 'Kafka Produce', kafkaConsume: 'Kafka Consume',
  kafkaTrigger: 'Kafka Trigger', kafkaWait: 'Kafka Wait',
  graphqlQuery: 'GraphQL Query', graphqlMutation: 'GraphQL Mutation',
  graphqlSubscription: 'GraphQL Subscription', graphqlIntrospect: 'GraphQL Introspect',
  graphqlAssert: 'GraphQL Assert',
  grpcUnary: 'gRPC Unary', grpcServerStream: 'gRPC Server Stream',
  grpcAssert: 'gRPC Assert',
  grpcLoadTest: 'gRPC Load Test', grpcSchemaDiff: 'gRPC Schema Diff',
  grpcMockAssert: 'gRPC Mock Assert',
  apiMockStart: 'Start Mock Server', apiMockApply: 'Apply Definition',
  apiMockResetState: 'Reset Mock State', apiMockStop: 'Stop Mock Server',
  apiMockAssertCalls: 'Assert Mock Calls',
  condition: 'Condition', delay: 'Delay', start: 'Start',
  webhook: 'Webhook', schedule: 'Schedule', switch: 'Switch',
  loop: 'Loop', setVariable: 'Set Variable', aggregate: 'Aggregate',
  errorHandler: 'Error Handler', logDebug: 'Log Debug',
  waitForCondition: 'Wait For Condition', subWorkflow: 'Sub-Workflow',
  script: 'Script', correlationWait: 'Correlation Wait',
  fork: 'Fork', join: 'Join', end: 'End',
};

function formatNodeTypeLabel(type: string): string {
  return NODE_TYPE_LABELS[type] ?? type.replace(/([A-Z])/g, ' $1').trim();
}

// Per-node-type modal height modifier. Applied to the dialog frame (not the tab body)
// so the modal keeps a constant, content-snug height across all four tabs.
const COMPACT_MODAL_HEIGHT_CLASS: Record<string, string> = {
  logDebug: 'wf-config-modal--h-logdebug',
  loop: 'wf-config-modal--h-loop',
  condition: 'wf-config-modal--h-condition',
  fork: 'wf-config-modal--h-forkjoin',
  join: 'wf-config-modal--h-forkjoin',
  end: 'wf-config-modal--h-forkjoin',
};

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
  /** Resolve auth for an HTTP node — replaces 'inherit' with actual service credentials. */
  resolveAuth?: (data: HttpNodeData) => Scenario['auth'] | undefined;
  /** Fallback base URL when resolveBaseUrl returns undefined. */
  fallbackBaseUrl?: string;
  extractionSampleResponseBody?: string;
  extractionFetchSample?: Pick<ExtractionFetchSampleProps, 'onFetch' | 'fetching' | 'error'>;
  conditionVariableHints?: WorkflowVariableHint[];
  httpVariableHints?: WorkflowVariableHint[];
  workflowServices?: WorkflowService[];
  /** Available environments for per-node env override. */
  environments?: Environment[];
  /** Currently selected global environment. */
  selectedEnvId?: string;
  /** Last execution status for this node (for Output/Logs tabs). */
  nodeRunStatus?: import('../../types/workflow').NodeRunStatus | null;
  /** All saved workflows for sub-workflow picker. */
  workflows?: WorkflowPickerItem[];
  /** Full variable scope from last run — includes upstream extracted values. */
  runtimeVariables?: Record<string, string>;
  /** All nodes in the workflow — used to discover upstream connection IDs. */
  allNodes?: WorkflowNode[];
  /** Global auth profiles from Environment Manager — used by gRPC workflow node auth panel. */
  globalAuthProfiles?: GlobalAuthProfile[];
}

export default function WorkflowNodeConfigModal({
  node, workflowVariables, onUpdateNode, onDeleteNode: _onDeleteNode, onClose, workflowId,
  lastQuickTestRequestUrl, lastRunStepError, effectiveQuickTestBaseUrl,
  resolveBaseUrl, resolveAuth, fallbackBaseUrl = '',
  extractionSampleResponseBody, extractionFetchSample,
  conditionVariableHints = [], httpVariableHints = [], workflowServices = [],
  environments = [], selectedEnvId,
  nodeRunStatus,
  workflows = [],
  runtimeVariables,
  allNodes = [],
  globalAuthProfiles = [],
}: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>(
    () => lastHttpTabByNodeId.get(node.id) ?? 'url',
  );
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

  // Reset draft + restore last HTTP sub-tab when opening a (possibly different) node
  useEffect(() => {
    originalDataRef.current = snapshot(node.data);
    setDraft(snapshot(node.data));
    setHttpTab(lastHttpTabByNodeId.get(node.id) ?? 'url');
    setPanelTab('config');
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (node.type === 'http') {
      lastHttpTabByNodeId.set(node.id, httpTab);
    }
  }, [node.id, node.type, httpTab]);

  const draftNode = useMemo((): WorkflowNode => ({ ...node, data: draft }), [node, draft]);

  const graphqlConfigHasErrors = useMemo(() => {
    if (!isGraphqlWorkflowNodeType(draftNode.type)) return false;
    return hasGraphqlNodeConfigErrors(
      draftNode.type,
      draft as GraphqlQueryNodeData | GraphqlSubscriptionNodeData | GraphqlIntrospectNodeData | GraphqlAssertNodeData,
    );
  }, [draftNode.type, draft]);

  // Compute effective base URL from draft so it updates live when Service changes
  const draftEffectiveBaseUrl = useMemo(() => {
    if (resolveBaseUrl && isHttpWorkflowNode(draftNode)) {
      const resolved = resolveBaseUrl(draftNode.data as HttpNodeData);
      if (resolved) return resolved;
    }
    return fallbackBaseUrl || effectiveQuickTestBaseUrl;
  }, [draftNode, resolveBaseUrl, fallbackBaseUrl, effectiveQuickTestBaseUrl]);

  const draftResolvedAuth = useMemo(() => {
    if (resolveAuth && isHttpWorkflowNode(draftNode)) {
      return resolveAuth(draftNode.data as HttpNodeData);
    }
    return undefined;
  }, [resolveAuth, draftNode]);

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

  // Available WebSocket connection IDs from all wsConnect nodes in the workflow
  const wsConnectionIds = useMemo(() => {
    return [...new Set(
      allNodes
        .filter((n) => n.type === 'wsConnect')
        .map((n) => (n.data as WsConnectNodeData).connectionId?.trim())
        .filter(Boolean),
    )];
  }, [allNodes]);

  // ── Validation fetch hook for HTTP nodes ──
  const httpDraftScenario = isHttpWorkflowNode(draftNode) ? (draftNode.data as HttpNodeData).scenario : null;
  const placeholderScenario = useRef<Scenario>({ id: '', name: '', url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } });
  const validationDraftRef = useRef<Scenario>(httpDraftScenario ?? placeholderScenario.current);
  validationDraftRef.current = httpDraftScenario ?? placeholderScenario.current;
  const handleValidationDraftChange = useCallback((scenarioDraft: Scenario) => {
    updateDraft({ scenario: scenarioDraft } as Partial<WorkflowNodeData>);
  }, [updateDraft]);

  const validationFetch = useWorkflowValidationFetch({
    draftRef: validationDraftRef,
    onDraftChange: handleValidationDraftChange,
    liveVariables: workflowVariables,
    resolvedBaseUrl: draftEffectiveBaseUrl,
    resolvedAuth: draftResolvedAuth,
    resetKey: node.id,
  });

  const nodeTypeLabel = formatNodeTypeLabel(node.type);
  const isGraphqlNode = isGraphqlWorkflowNodeType(node.type);
  const rawLabel = (draft as HttpNodeData).label?.trim();
  // When the user has explicitly set an empty label, fall back to "Step Config"
  // so the modal title still identifies the node's purpose.
  const nodeUserLabel = rawLabel === '' ? 'Step Config' : rawLabel;
  const title = nodeUserLabel && nodeUserLabel !== nodeTypeLabel
    ? `${nodeTypeLabel} — ${nodeUserLabel}`
    : nodeTypeLabel;
  // Node types whose config body hugs content — give the whole modal a stable, snug
  // height that stays constant across the Config/Input/Output/Logs tabs. A tab-scoped
  // `:has([data-testid="…-config"])` rule only applies on the Config tab (the body
  // unmounts on other tabs), so the modal would otherwise jump to the default size.
  const compactHeightClass = COMPACT_MODAL_HEIGHT_CLASS[node.type];
  const dialogClassName = [
    'wf-config-modal',
    isGraphqlNode ? 'wf-config-modal--gql' : '',
    compactHeightClass ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <WorkflowEditorModalFrame
        title={<span id="wf-config-modal-title">{title}</span>}
        titleId="wf-config-modal-title"
        onClose={handleCancel}
        expandMode="fullscreen"
        hideExpandButton
        hideCloseButton
        dialogClassName={dialogClassName}
        toolbar={(
          <div className="wf-config-modal-tabs">
            <button type="button" className={`wf-config-modal-tab${panelTab === 'config' ? ' active' : ''}`} onClick={() => setPanelTab('config')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Config
            </button>
            <button type="button" className={`wf-config-modal-tab${panelTab === 'input' ? ' active' : ''}`} onClick={() => setPanelTab('input')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12"/><polyline points="22 12 18 8"/><polyline points="22 12 18 16"/><rect x="2" y="4" width="12" height="16" rx="2"/></svg>
              Input
              {inputTabHints.length > 0 && <span className="wf-config-modal-tab-badge">{inputTabHints.length}</span>}
            </button>
            <button type="button" className={`wf-config-modal-tab${panelTab === 'output' ? ' active' : ''}`} onClick={() => setPanelTab('output')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="2 12 8 12"/><polyline points="2 12 6 8"/><polyline points="2 12 6 16"/><rect x="10" y="4" width="12" height="16" rx="2"/></svg>
              Output
            </button>
            <button type="button" className={`wf-config-modal-tab${panelTab === 'logs' ? ' active' : ''}`} onClick={() => setPanelTab('logs')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Logs
            </button>
          </div>
        )}
        footer={(
          <div className="wf-config-modal-footer-actions">
            <button type="button" className="btn btn-sm btn-ghost" onClick={handleCancel}>Close</button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleSave}
              disabled={graphqlConfigHasErrors}
              title={graphqlConfigHasErrors ? 'Fix validation errors before saving' : undefined}
            >
              Save
            </button>
          </div>
        )}
      >
          <div>
            {panelTab === 'config' && (
              <WorkflowNodeConfigTypePanels
                draftNode={draftNode}
                draft={draft}
                updateDraft={updateDraft}
                workflowVariables={workflowVariables}
                runtimeVariables={runtimeVariables}
                conditionVariableHints={conditionVariableHints}
                variableInsertHints={variableInsertHints}
                draftVariableHints={draftVariableHints}
                requestVariableInsert={requestVariableInsert}
                workflows={workflows}
                workflowId={workflowId}
                nodeId={node.id}
                nodeRunStatus={nodeRunStatus}
                wsConnectionIds={wsConnectionIds}
                workflowServices={workflowServices}
                environments={environments}
                selectedEnvId={selectedEnvId}
                globalAuthProfiles={globalAuthProfiles}
                httpTab={httpTab}
                setHttpTab={setHttpTab}
                lastRunStepError={lastRunStepError}
                lastQuickTestRequestUrl={lastQuickTestRequestUrl}
                draftEffectiveBaseUrl={draftEffectiveBaseUrl}
                extractionSampleResponseBody={extractionSampleResponseBody}
                extractionFetchSample={extractionFetchSample}
                validationProps={{
                  resolvedBaseUrl: draftEffectiveBaseUrl,
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
                newVarKey={newVarKey}
                setNewVarKey={setNewVarKey}
                newVarValue={newVarValue}
                setNewVarValue={setNewVarValue}
              />
            )}

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
