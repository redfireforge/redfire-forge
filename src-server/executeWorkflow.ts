/**
 * Shared workflow execution logic used by both webhook-server and cron-scheduler.
 * Eliminates duplicated runGraph → collect results → save execution result pattern.
 */
import { runGraph } from '../src/features/workflow/engine/graphRunner';
import { saveExecutionResult } from './file-storage.js';
import type { ExecutionResult, LogLine } from '../src/shared/types/server-api';
import type { Workflow, NodeRunStatus } from '../src/features/workflow/types/workflow';
import type { RequestResult, WorkflowIterationTrace, ExecutionTraceOptions } from '../src/shared/types/index';
import type { ICorrelationStore } from '../src/features/workflow/engine/correlationStore.js';
import type { KafkaNodeOperations } from '../src/features/workflow/engine/graphRunnerNodeHandlerContext.js';

export interface WorkflowExecutionInput {
  executionId: string;
  workflow: Workflow;
  initialVariables: Record<string, string>;
  triggerType: 'webhook' | 'schedule' | 'kafka-trigger';
  triggerId: string;
  startTime: number;
  onLog?: (line: LogLine) => void;
  /** Trace capture options for Results Explorer support */
  traceOptions?: ExecutionTraceOptions;
  /**
   * Correlation store for CorrelationWait and KafkaWait nodes.
   * When provided, paused nodes can be resumed by incoming webhook or Kafka callbacks.
   * Use ServerCorrelationBridge to bridge the server-side store to this interface.
   */
  correlationStore?: ICorrelationStore;
  /**
   * Kafka client operations for KafkaProduce, KafkaConsume, and KafkaWait nodes.
   * When omitted, Kafka nodes will fail with 'No Kafka operations configured'.
   */
  kafkaOperations?: KafkaNodeOperations;
}

export interface WorkflowExecutionOutput {
  executionId: string;
  status: ExecutionResult['status'];
  passed: boolean;
  duration: number;
  results: RequestResult[];
  /** Iteration trace when traceOptions.captureFullTrace is true */
  iterationTrace?: WorkflowIterationTrace;
}

/**
 * Execute a workflow and save the result. Used by both webhook and schedule triggers.
 */
export async function executeWorkflow(input: WorkflowExecutionInput): Promise<WorkflowExecutionOutput> {
  const {
    executionId, workflow, initialVariables, triggerType, triggerId,
    startTime, onLog, traceOptions, correlationStore, kafkaOperations,
  } = input;

  const executionResults: RequestResult[] = [];
  let executionPassed = true;
  let capturedIterationTrace: WorkflowIterationTrace | undefined;

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
      onComplete: (results: RequestResult[], passed: boolean, _durationMs: number, trace?: WorkflowIterationTrace) => {
        executionResults.push(...results);
        executionPassed = passed;
        // Capture the iteration trace if provided
        if (trace) {
          capturedIterationTrace = trace;
        }
      },
    },
    undefined,        // abortSignal
    undefined,        // environmentLayer
    undefined,        // resolveHttpBaseUrl
    undefined,        // resolveHttpAuth
    undefined,        // debugController
    undefined,        // errorConfig
    undefined,        // resolveSubWorkflow
    correlationStore, // ICorrelationStore — use ServerCorrelationBridge for server-side execution
    false,            // loadTestMode
    undefined,        // correlationWaitConfig
    undefined,        // pollSemaphore
    traceOptions,     // traceOptions for trace capture
    undefined,        // httpTimeoutMs
    kafkaOperations,  // KafkaNodeOperations — wire from server-side KafkaService when available
    undefined,        // WsNodeOperations — wire from server-side WsService when available
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
    iterationTrace: capturedIterationTrace,
  };
}

/**
 * Save an error execution result. Used when workflow execution throws an exception.
 */
export async function saveErrorResult(input: {
  executionId: string;
  workflowId: string;
  triggerId: string;
  triggerType: 'webhook' | 'schedule' | 'kafka-trigger';
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
