import { useCallback } from 'react';
import type { TestConfig, RequestResult, WorkflowExecutionTrace, ExecutionTraceOptions } from '@shared/types';
import type { Workflow, WorkflowNode } from '@workflow/types/workflow';
import { runWebhookLoadTest, calculateTotalRequests } from '@workflow/engine/webhookLoadDriver';
import { toErrorMessage } from '@shared/utils/helpers';
import { saveWorkflowRunConfig } from '../utils/workflowRunConfigStorage';
import type { WebhookLoadConfig } from '../components/WebhookLoadDriverPanel';

interface StartExternalExecutionResult {
  reportProgress: (results: RequestResult[], completed: number) => void;
  complete: (config: TestConfig, executionTrace?: WorkflowExecutionTrace) => Promise<void>;
  fail: (message: string) => void;
  abortSignal: AbortSignal;
}

export interface UseWorkflowRunnerWebhookLoadRunParams {
  selectedWorkflow: Workflow | null;
  selectedWorkflowId: string | null;
  webhookLoadConfig: WebhookLoadConfig | null;
  webhookTriggerNode: WorkflowNode | null;
  workflowVariables: Record<string, string>;
  traceOptions: ExecutionTraceOptions;
  startExternalExecution: (
    total: number,
    meta: { projectName: string },
  ) => StartExternalExecutionResult;
}

export function useWorkflowRunnerWebhookLoadRun({
  selectedWorkflow,
  selectedWorkflowId,
  webhookLoadConfig,
  webhookTriggerNode,
  workflowVariables,
  traceOptions,
  startExternalExecution,
}: UseWorkflowRunnerWebhookLoadRunParams): () => Promise<void> {
  return useCallback(async () => {
    if (!selectedWorkflow || !webhookLoadConfig) return;

    const totalReqs = calculateTotalRequests(webhookLoadConfig.rate);
    const captureTraces = traceOptions.captureFullTrace;

    const { reportProgress, complete, fail, abortSignal } = startExternalExecution(
      totalReqs,
      { projectName: `Webhook: ${selectedWorkflow.name}` }
    );

    const collectedResults: RequestResult[] = [];

    try {
      const serverHost = window.location.hostname || 'localhost';
      const registerUrl = `http://${serverHost}:3001/api/workflows/${selectedWorkflow.id}`;
      try {
        const registerRes = await fetch(registerUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedWorkflow),
        });
        if (!registerRes.ok) {
          throw new Error(`Failed to register workflow: ${registerRes.status} ${registerRes.statusText}`);
        }
      } catch (regErr) {
        const errMsg = toErrorMessage(regErr);
        if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
          fail('Webhook server not running. Start it with: npm run server');
          return;
        }
        throw regErr;
      }

      const loadResult = await runWebhookLoadTest(
        {
          webhookUrl: webhookLoadConfig.webhookUrl,
          method: webhookLoadConfig.method,
          payloadTemplate: webhookLoadConfig.payloadTemplate,
          rate: webhookLoadConfig.rate,
          headers: webhookLoadConfig.headers,
          captureTraces,
        },
        {
          onProgress: (_completed, _total, _rps) => {
            // Progress is now reported on each request completion for accuracy
          },
          onRequestComplete: (result) => {
            collectedResults.push(result);
            reportProgress(collectedResults, collectedResults.length);
          },
        },
        abortSignal,
      );

      let executionTrace: WorkflowExecutionTrace | undefined;
      if (captureTraces && loadResult.iterationTraces && loadResult.iterationTraces.length > 0) {
        const allTraversedEdges = new Set<string>();
        for (const iter of loadResult.iterationTraces) {
          for (const edgeId of iter.traversedEdges || []) {
            allTraversedEdges.add(edgeId);
          }
        }

        const webhookNodeId = webhookTriggerNode?.id;
        const filteredNodes = selectedWorkflow.nodes.filter(node => {
          if (node.type !== 'start') return true;
          const outgoingEdges = selectedWorkflow.edges.filter(e => e.source === node.id);
          if (outgoingEdges.length === 0) return false;
          if (outgoingEdges.length === 1 && outgoingEdges[0].target === webhookNodeId) return false;
          return true;
        });

        const removedNodeIds = new Set(
          selectedWorkflow.nodes.filter(n => !filteredNodes.includes(n)).map(n => n.id)
        );
        const filteredEdges = selectedWorkflow.edges.filter(
          e => !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target)
        );

        executionTrace = {
          workflowId: selectedWorkflow.id,
          workflowName: selectedWorkflow.name,
          iterations: loadResult.iterationTraces,
          traversedEdges: Array.from(allTraversedEdges),
          workflowSnapshot: {
            nodes: filteredNodes,
            edges: filteredEdges,
          },
          totalIterations: loadResult.iterationTraces.length,
          totalDurationMs: loadResult.actualDurationMs,
          fullTraceCaptured: true,
        };
      }

      const config: TestConfig = {
        concurrency: 1,
        iterations: totalReqs,
        scenarioWeights: [],
        executionMode: 'workflow',
        workflowId: selectedWorkflowId!,
        traceOptions: captureTraces ? traceOptions : undefined,
      };

      try {
        saveWorkflowRunConfig({ workflowId: selectedWorkflowId!, variables: workflowVariables });
      } catch (err) {
        console.warn('[WorkflowRunner] Could not save run variable history:', err);
      }
      await complete(config, executionTrace);
    } catch (err) {
      if (!abortSignal.aborted) {
        fail(toErrorMessage(err));
      }
    }
  }, [
    selectedWorkflow,
    selectedWorkflowId,
    webhookLoadConfig,
    webhookTriggerNode,
    workflowVariables,
    traceOptions,
    startExternalExecution,
  ]);
}
