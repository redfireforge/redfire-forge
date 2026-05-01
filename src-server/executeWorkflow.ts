/**
 * Shared workflow execution logic used by both webhook-server and cron-scheduler.
 * Eliminates duplicated runGraph → collect results → save execution result pattern.
 */
import { runGraph } from '../src/features/workflow/engine/graphRunner';
import { saveExecutionResult } from './file-storage.js';
import type { ExecutionResult, LogLine } from '../src/shared/types/server-api';
import type { Workflow, NodeRunStatus } from '../src/features/workflow/types/workflow';
import type { RequestResult } from '../src/shared/types/index';
import { getErrorMessage } from '../src/features/test-runner/utils/serverFormatters';

export interface WorkflowExecutionInput {
  executionId: string;
  workflow: Workflow;
  initialVariables: Record<string, string>;
  triggerType: 'webhook' | 'schedule';
  triggerId: string;
  startTime: number;
  onLog?: (line: LogLine) => void;
}

export interface WorkflowExecutionOutput {
  executionId: string;
  status: ExecutionResult['status'];
  passed: boolean;
  duration: number;
  results: RequestResult[];
}

/**
 * Execute a workflow and save the result. Used by both webhook and schedule triggers.
 */
export async function executeWorkflow(input: WorkflowExecutionInput): Promise<WorkflowExecutionOutput> {
  const { executionId, workflow, initialVariables, triggerType, triggerId, startTime, onLog } = input;

  const executionResults: RequestResult[] = [];
  let executionPassed = true;

  await runGraph(
    workflow.nodes,
    workflow.edges,
    initialVariables,
    {
      onNodeStateChange: (nodeId: string, status: NodeRunStatus) => {
        if (status.state === 'fail') {
          console.log(`[${triggerType}] Node ${nodeId} failed`);
        }
      },
      onVariablesChange: (_variables: Record<string, string>) => {
        // Variables updated during execution
      },
      onLog,
      onComplete: (results: RequestResult[], passed: boolean, _durationMs: number) => {
        executionResults.push(...results);
        executionPassed = passed;
      },
    }
  );

  const totalDuration = Date.now() - startTime;
  const status: ExecutionResult['status'] = executionPassed ? 'success' : 'failed';

  const executionResult: ExecutionResult = {
    id: executionId,
    workflowId: workflow.id,
    triggerId,
    triggerType,
    status,
    duration: totalDuration,
    results: executionResults.map((r) => ({
      url: r.url,
      statusCode: r.httpStatus,
      responseTime: r.responseTimeMs,
      body: r.responseBody,
    })),
    variables: initialVariables,
    timestamp: new Date(startTime).toISOString(),
  };

  await saveExecutionResult(executionResult);

  return {
    executionId,
    status,
    passed: executionPassed,
    duration: totalDuration,
    results: executionResults,
  };
}

/**
 * Save an error execution result. Used when workflow execution throws an exception.
 */
export async function saveErrorResult(input: {
  executionId: string;
  workflowId: string;
  triggerId: string;
  triggerType: 'webhook' | 'schedule';
  startTime: number;
  error: string;
}): Promise<void> {
  const { executionId, workflowId, triggerId, triggerType, startTime, error } = input;
  try {
    await saveExecutionResult({
      id: executionId,
      workflowId,
      triggerId,
      triggerType,
      status: 'error',
      duration: Date.now() - startTime,
      results: [],
      variables: {},
      timestamp: new Date(startTime).toISOString(),
      error,
    });
  } catch (saveError) {
    console.error(`[${triggerType}] Failed to save error result:`, saveError);
  }
}
