import { useCallback, useMemo, useRef, useEffect } from 'react';
import type { Environment, Microservice, GlobalAuthProfile } from '@shared/types';
import type {
  HttpNodeData,
  WorkflowHostProfile,
  WorkflowAuthProfile,
  WorkflowService,
  Workflow,
} from '../types/workflow';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import { resolveHttpNodeBaseUrl, resolveServiceAuth } from '../utils/workflowHostResolve';
import type { WorkflowRFNode } from '../utils/workflowNodeFactory';

interface UseWorkflowResolversOpts {
  selected: Workflow | null;
  previewWorkflow: Workflow | null;
  selectedEnvId: string;
  resolvedBaseUrl: string;
  environments: Environment[];
  microservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  workflowHostProfiles: WorkflowHostProfile[];
  workflowAuthProfiles: WorkflowAuthProfile[];
  workflowServices: WorkflowService[];
  selectedNode: WorkflowRFNode | undefined;
  onEnvSelect: (id: string) => void;
  update: (id: string, patch: Partial<Workflow>) => void;
}

export function useWorkflowResolvers({
  selected,
  previewWorkflow,
  selectedEnvId,
  resolvedBaseUrl,
  environments,
  microservices,
  globalAuthProfiles,
  workflowHostProfiles,
  workflowAuthProfiles,
  workflowServices,
  selectedNode,
  onEnvSelect,
  update,
}: UseWorkflowResolversOpts) {
  // ── Per-workflow environment: restore when switching workflows ──
  const prevWfIdForEnv = useRef<string | null>(null);
  useEffect(() => {
    if (selected && selected.id !== prevWfIdForEnv.current) {
      const wasSwitch = prevWfIdForEnv.current !== null;
      prevWfIdForEnv.current = selected.id;
      // Only restore the workflow's env when the user switches between workflows,
      // not on initial page load (which would overwrite the persisted selection).
      if (wasSwitch && selected.lastSelectedEnvId && environments.some(e => e.id === selected.lastSelectedEnvId)) {
        onEnvSelect(selected.lastSelectedEnvId);
      }
    } else if (!selected) {
      prevWfIdForEnv.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // ── Per-workflow environment: save when user changes env ──
  const handleEnvSelect = useCallback((envId: string) => {
    onEnvSelect(envId);
    if (selected && !previewWorkflow) {
      update(selected.id, { lastSelectedEnvId: envId });
    }
  }, [onEnvSelect, selected, previewWorkflow, update]);

  // ── Resolver callbacks for execution ──
  const resolveHttpBaseUrlForGraph = useCallback(
    (data: HttpNodeData) => resolveHttpNodeBaseUrl(data, microservices, workflowHostProfiles, workflowServices, selectedEnvId),
    [microservices, workflowHostProfiles, workflowServices, selectedEnvId],
  );

  const resolveHttpAuthForGraph = useCallback(
    (data: HttpNodeData) => {
      const authType = data.scenario?.auth?.type;
      if (authType && authType !== 'inherit') return undefined;
      const svcAuth = resolveServiceAuth(data, workflowServices, selectedEnvId, microservices, globalAuthProfiles);
      if (svcAuth) return svcAuth;
      if (!data.authProfileId) return undefined;
      return workflowAuthProfiles.find((p) => p.id === data.authProfileId)?.auth;
    },
    [workflowAuthProfiles, workflowServices, selectedEnvId, microservices, globalAuthProfiles],
  );

  const effectiveQuickTestBaseUrl = useMemo(() => {
    if (selectedNode && isHttpWorkflowNode(selectedNode)) {
      const custom = resolveHttpNodeBaseUrl(selectedNode.data, microservices, workflowHostProfiles, workflowServices, selectedEnvId);
      if (custom) return custom;
    }
    return resolvedBaseUrl;
  }, [selectedNode, microservices, resolvedBaseUrl, workflowHostProfiles, workflowServices, selectedEnvId]);

  return {
    handleEnvSelect,
    resolveHttpBaseUrlForGraph,
    resolveHttpAuthForGraph,
    effectiveQuickTestBaseUrl,
  };
}
