import { useCallback, useEffect } from 'react';
import type { FetchErrorDetail } from '@shared/components/data-mapper/types';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import { resolveHttpNodeBaseUrl } from '../utils/workflowHostResolve';
import { fetchScenarioSample } from '../engine/fetchScenarioSample';
import type {
  StartNodeData,
  ScheduleTriggerNodeData,
  WorkflowHostProfile,
  WorkflowService,
  WorkflowNode,
} from '../types/workflow';
import type { Microservice } from '@shared/types';
import type { WorkflowRFNode } from '../utils/workflowNodeFactory';
import { prettyJson, isValidJson } from '@shared/utils/helpers';

interface UseWorkflowExtractionSampleOpts {
  selectedNode: WorkflowRFNode | null | undefined;
  /** The node displayed in the open config modal — preferred over selectedNode when available. */
  configModalNode: WorkflowNode | null | undefined;
  selectedId: string | null | undefined;
  selectedNodeId: string | null;
  nodes: WorkflowRFNode[];
  workflowVariables: Record<string, string>;
  runVariableSnapshot: Record<string, string> | null;
  nodeInitialVarsRef: React.MutableRefObject<Record<string, Record<string, string>>>;
  microservices: Microservice[];
  workflowHostProfiles: WorkflowHostProfile[];
  workflowServices: WorkflowService[];
  selectedEnvId: string;
  resolvedBaseUrl: string;
  setExtractionSampleJson: (s: string) => void;
  setExtractionFetching: (b: boolean) => void;
  setExtractionFetchError: (e: FetchErrorDetail | null) => void;
}

/**
 * Encapsulates the design-time "Fetch sample response" flow used by the
 * Extract tab inside the workflow node config modal. Handles seeding from
 * Start/Schedule input variables, host/auth resolution, JSON pretty-printing
 * of error bodies, and resetting state when the selection changes.
 */
export function useWorkflowExtractionSample(opts: UseWorkflowExtractionSampleOpts) {
  const {
    selectedNode, configModalNode, selectedId, selectedNodeId, nodes,
    workflowVariables, runVariableSnapshot, nodeInitialVarsRef,
    microservices, workflowHostProfiles, workflowServices, selectedEnvId, resolvedBaseUrl,
    setExtractionSampleJson, setExtractionFetching, setExtractionFetchError,
  } = opts;

  // Reset extraction sample/error whenever the selected workflow or node changes.
  useEffect(() => {
    setExtractionSampleJson('');
    setExtractionFetchError(null);
  }, [selectedId, selectedNodeId, setExtractionSampleJson, setExtractionFetchError]);

  const handleExtractionFetchSample = useCallback(async () => {
    // Prefer configModalNode (the node currently open in the config modal) over
    // selectedNode — they can diverge if the user clicks the canvas while the
    // modal is still open.
    const effectiveNode = (configModalNode && isHttpWorkflowNode(configModalNode))
      ? configModalNode
      : selectedNode;

    if (!effectiveNode || !isHttpWorkflowNode(effectiveNode)) {
      setExtractionFetchError({ message: 'Select an HTTP step and open Pick path from the Extract tab.' });
      return;
    }
    const scenario = effectiveNode.data.scenario;
    setExtractionFetching(true);
    setExtractionFetchError(null);
    try {
      const httpData = effectiveNode.data;
      const fetchBase =
        resolveHttpNodeBaseUrl(httpData, microservices, workflowHostProfiles, workflowServices, selectedEnvId)
        ?? resolvedBaseUrl;

      // Seed variables from entry-point nodes so design-time Fetch matches Quick Test.
      const entryVars: Record<string, string> = {};
      for (const n of nodes) {
        if (n.type === 'start') {
          const d = n.data as StartNodeData;
          if (d.inputVariables) Object.assign(entryVars, d.inputVariables);
        } else if (n.type === 'schedule') {
          const d = n.data as ScheduleTriggerNodeData;
          if (d.inputVariables) Object.assign(entryVars, d.inputVariables);
        }
      }

      const mergedVars = {
        ...entryVars,
        ...workflowVariables,
        ...(runVariableSnapshot ?? {}),
        ...(nodeInitialVarsRef.current[effectiveNode.id] ?? httpData.initialVariables ?? {}),
      };
      const result = await fetchScenarioSample(scenario, mergedVars, fetchBase, {
        fetchHostEnabled: !!scenario.fetchHostEnabled,
        fetchHostOverride: scenario.fetchHostOverride ?? '',
      });
      if (result.ok) {
        setExtractionSampleJson(result.body);
      } else {
        setExtractionFetchError({
          message: result.error,
          status: result.httpStatus,
          body: result.body,
        });
        // Still surface the error body if it parses as JSON.
        if (result.body && isValidJson(result.body)) {
          setExtractionSampleJson(prettyJson(result.body));
        }
      }
    } finally {
      setExtractionFetching(false);
    }
  }, [
    selectedNode, configModalNode, workflowVariables, runVariableSnapshot, nodes,
    microservices, resolvedBaseUrl, selectedEnvId, workflowHostProfiles, workflowServices,
    nodeInitialVarsRef, setExtractionSampleJson, setExtractionFetching, setExtractionFetchError,
  ]);

  return { handleExtractionFetchSample };
}
