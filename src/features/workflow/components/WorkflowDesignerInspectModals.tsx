import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';
import WorkflowDetailModal from './modals/WorkflowDetailModal';
import WorkflowNodeConfigModal from './modals/WorkflowNodeConfigModal';
import WorkflowDefaultsModal from './modals/WorkflowDefaultsModal';

/** Modals that sit inside WorkflowInspectProvider (detail, node config, defaults). */
export function WorkflowDesignerInspectModals({ vm }: { vm: WorkflowDesignerViewModel }) {
  const {
    detailModal,
    setDetailModal,
    detailModalDerived,
    variableDetailDraft,
    setVariableDetailDraft,
    handleApplyVariableDetail,
    configModalNode,
    configModalNodeId,
    setConfigModalNodeId,
    workflowVariables,
    runVariableSnapshot,
    handleUpdateNode,
    handleDeleteNode,
    selected,
    lastQuickTestRequestUrl,
    nodeStatuses,
    effectiveQuickTestBaseUrl,
    resolveHttpBaseUrlForGraph,
    resolveHttpAuthForGraph,
    resolvedBaseUrl,
    extractionSampleJson,
    handleExtractionFetchSample,
    extractionFetching,
    extractionFetchError,
    conditionVariableHints,
    httpVariableHints,
    workflowServices,
    environments,
    selectedEnvId,
    configModalWorkflows,
    showDefaultsModal,
    setShowDefaultsModal,
    handleUpdateWorkflowVariables,
    workflowErrorConfig,
    setWorkflowErrorConfig,
    persistWorkflow,
    nodes,
  } = vm;

  return (
    <>
      <WorkflowDetailModal
        open={detailModal !== null}
        title={detailModalDerived.title}
        subtitle={detailModalDerived.subtitle}
        body={detailModalDerived.body}
        failureReport={detailModalDerived.failureReport}
        variableMode={detailModal?.type === 'variable'}
        variableValue={variableDetailDraft}
        onVariableChange={setVariableDetailDraft}
        onApplyVariable={detailModal?.type === 'variable' ? handleApplyVariableDetail : undefined}
        onClose={() => setDetailModal(null)}
      />

      {configModalNode && (
        <WorkflowNodeConfigModal
          key={configModalNode.id}
          node={configModalNode}
          workflowVariables={workflowVariables}
          runtimeVariables={runVariableSnapshot ?? undefined}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setConfigModalNodeId(null)}
          workflowId={selected?.id}
          lastQuickTestRequestUrl={lastQuickTestRequestUrl}
          lastRunStepError={configModalNodeId ? nodeStatuses[configModalNodeId]?.error : undefined}
          effectiveQuickTestBaseUrl={effectiveQuickTestBaseUrl}
          resolveBaseUrl={resolveHttpBaseUrlForGraph}
          resolveAuth={resolveHttpAuthForGraph}
          fallbackBaseUrl={resolvedBaseUrl}
          extractionSampleResponseBody={extractionSampleJson}
          extractionFetchSample={{
            onFetch: handleExtractionFetchSample,
            fetching: extractionFetching,
            error: extractionFetchError,
          }}
          conditionVariableHints={conditionVariableHints}
          httpVariableHints={httpVariableHints}
          workflowServices={workflowServices}
          environments={environments}
          selectedEnvId={selectedEnvId}
          nodeRunStatus={configModalNodeId ? nodeStatuses[configModalNodeId] : undefined}
          workflows={configModalWorkflows}
          allNodes={nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data } as import('../types/workflow').WorkflowNode))}
        />
      )}

      <WorkflowDefaultsModal
        open={showDefaultsModal}
        workflowVariables={workflowVariables}
        onUpdateWorkflowVariables={handleUpdateWorkflowVariables}
        onClose={() => setShowDefaultsModal(false)}
        workflowServices={workflowServices}
        errorConfig={workflowErrorConfig}
        onUpdateErrorConfig={(cfg) => { setWorkflowErrorConfig(cfg); persistWorkflow({ errorConfig: cfg }); }}
        workflowNodes={nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data } as import('../types/workflow').WorkflowNode))}
      />
    </>
  );
}
