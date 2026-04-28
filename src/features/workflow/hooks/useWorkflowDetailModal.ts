import { useState, useCallback, useMemo, useRef } from 'react';
import type { WorkflowRFNode } from '../utils/workflowNodeFactory';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import type { NodeRunStatus } from '../types/workflow';

type DetailModal =
  | null
  | { type: 'step'; nodeId: string }
  | { type: 'variable'; key: string }
  | { type: 'runError' };

interface UseWorkflowDetailModalOpts {
  nodes: WorkflowRFNode[];
  nodeStatuses: Record<string, NodeRunStatus>;
  selectedNode: WorkflowRFNode | null;
  lastRunError: string | null;
  workflowVariables: Record<string, string>;
  nodeInitialVarsRef: React.MutableRefObject<Record<string, Record<string, string>>>;
  setNodeInitialVars: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  setWorkflowVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSelectedNodeId: (id: string | null) => void;
}

export function useWorkflowDetailModal({
  nodes,
  nodeStatuses,
  selectedNode,
  lastRunError,
  workflowVariables,
  nodeInitialVarsRef,
  setNodeInitialVars,
  setWorkflowVariables,
  setSelectedNodeId,
}: UseWorkflowDetailModalOpts) {
  const [detailModal, setDetailModal] = useState<DetailModal>(null);
  const [variableDetailDraft, setVariableDetailDraft] = useState('');
  const [configModalNodeId, setConfigModalNodeId] = useState<string | null>(null);
  const variableDetailApplyRef = useRef<((newValue: string) => void) | null>(null);

  // Extraction sample state
  const [extractionSampleJson, setExtractionSampleJson] = useState('');
  const [extractionFetching, setExtractionFetching] = useState(false);
  const [extractionFetchError, setExtractionFetchError] = useState<string | null>(null);

  const openStepDetail = useCallback((nodeId: string) => {
    setDetailModal({ type: 'step', nodeId });
  }, []);

  const openVariableDetail = useCallback((key: string, currentValue?: string, onApply?: (newValue: string) => void) => {
    variableDetailApplyRef.current = onApply ?? null;
    if (currentValue !== undefined) {
      setVariableDetailDraft(currentValue);
    } else if (selectedNode?.type === 'http') {
      const iv = nodeInitialVarsRef.current[selectedNode.id];
      setVariableDetailDraft(iv?.[key] ?? '');
    } else {
      setVariableDetailDraft(workflowVariables[key] ?? '');
    }
    setDetailModal({ type: 'variable', key });
  }, [workflowVariables, selectedNode, nodeInitialVarsRef]);

  const openRunErrorDetail = useCallback(() => {
    if (lastRunError?.trim()) setDetailModal({ type: 'runError' });
  }, [lastRunError]);

  const openNodeConfig = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setConfigModalNodeId(nodeId);
  }, [setSelectedNodeId]);

  const handleApplyVariableDetail = useCallback(() => {
    if (detailModal?.type !== 'variable') return;
    const key = detailModal.key;
    if (variableDetailApplyRef.current) {
      variableDetailApplyRef.current(variableDetailDraft);
    } else if (selectedNode && isHttpWorkflowNode(selectedNode)) {
      const nodeId = selectedNode.id;
      setNodeInitialVars((prev) => {
        const updatedVars = { ...(prev[nodeId] ?? {}), [key]: variableDetailDraft };
        nodeInitialVarsRef.current[nodeId] = { ...updatedVars };
        return { ...prev, [nodeId]: updatedVars };
      });
    } else {
      setWorkflowVariables((prev) => ({ ...prev, [key]: variableDetailDraft }));
    }
    variableDetailApplyRef.current = null;
    setDetailModal(null);
  }, [detailModal, variableDetailDraft, selectedNode, setNodeInitialVars, setWorkflowVariables, nodeInitialVarsRef]);

  const stepDetailMeta = useMemo(() => {
    if (detailModal?.type !== 'step') return { title: '', body: '' };
    const n = nodes.find(x => x.id === detailModal.nodeId);
    const label = n && isHttpWorkflowNode(n) ? n.data.label : 'HTTP step';
    const rs = nodeStatuses[detailModal.nodeId];
    const body = rs?.responseDetail ?? rs?.error ?? 'No details available. Run Quick Test again.';
    return { title: label, body };
  }, [detailModal, nodes, nodeStatuses]);

  return {
    detailModal,
    setDetailModal,
    variableDetailDraft,
    setVariableDetailDraft,
    configModalNodeId,
    setConfigModalNodeId,
    extractionSampleJson,
    setExtractionSampleJson,
    extractionFetching,
    setExtractionFetching,
    extractionFetchError,
    setExtractionFetchError,
    openStepDetail,
    openVariableDetail,
    openRunErrorDetail,
    openNodeConfig,
    handleApplyVariableDetail,
    stepDetailMeta,
  } as const;
}
