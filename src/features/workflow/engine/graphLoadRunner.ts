/**
 * Load testing wrapper for graphRunner.
 * Runs a workflow graph N times with M concurrency, tagging each result
 * with iterationIndex and workflowNodeId for per-iteration and per-step metrics.
 */

import type { Workflow, HttpNodeData, KafkaConsumeNodeData } from '../types/workflow';
import type { Scenario, RequestResult, WorkflowIterationTrace, WorkflowExecutionTrace, ExecutionTraceOptions } from '../../../shared/types';
import { runGraph, resolveTraceLevel, type GraphRunCallbacks, type CorrelationWaitRunnerConfig } from './graphRunner';
import type { KafkaNodeOperations, WsNodeOperations } from './graphRunnerNodeHandlerContext';
import { buildWsNodeOperations } from '../../../shared/websocket/buildWsNodeOperations';
import { resolveKafkaConsumeLoadPolicy } from './kafkaLoadPolicy';
import { CircuitBreaker } from '../../../engine/circuitBreaker';
import { toErrorMessage } from '../../../shared/utils/helpers';

function buildWorkflowMarkerResult(
  workflowName: string,
  iterationIndex: number,
  opts: { cancelled?: boolean; errorMessage: string; scenarioId: string; groupName: string; workflowNodeId: string },
): RequestResult {
  return {
    id: nextResultId(),
    scenarioId: opts.scenarioId,
    scenarioName: workflowName,
    featureGroupName: `Workflow: ${workflowName}`,
    groupName: opts.groupName,
    url: '',
    method: 'GET',
    httpStatus: 0,
    responseTimeMs: 0,
    responseBody: '',
    timestamp: Date.now(),
    passed: false,
    validationMode: 'none',
    failureDetails: [],
    errorMessage: opts.errorMessage,
    iterationIndex,
    workflowNodeId: opts.workflowNodeId,
    cancelled: opts.cancelled,
  };
}
import type { ProgressMeta } from '../../../engine/executor';
import { RemoteCorrelationStore } from './remoteCorrelationStore';
import { InMemoryCorrelationStore } from './correlationStore';
import { SyntheticEventInjector } from './syntheticEventInjector';
import { Semaphore } from '../../../shared/utils/semaphore';
import { nextResultId } from '../../../engine/requestExecution';

// Re-export the type for consumers
export type { CorrelationWaitRunnerConfig } from './graphRunner';

export interface GraphLoadRunOpts {
  /** Total number of iterations to run. */
  iterations: number;
  /** Maximum concurrent iterations. */
  concurrency: number;
  /** Initial variables to seed each iteration's VariableContext. */
  initialVariables?: Record<string, string>;
  /** Circuit breaker for error policy enforcement. */
  breaker?: CircuitBreaker;
  /** Abort signal to stop execution. */
  abortSignal?: AbortSignal;
  /** Progress callback - called after each iteration or result batch. */
  onProgress?: (completed: number, total: number, results: RequestResult[], meta?: ProgressMeta) => void;
  /** Configuration for how CorrelationWait nodes behave during load tests. */
  correlationWaitConfig?: CorrelationWaitRunnerConfig;
  /** Maximum concurrent poll operations for WaitForCondition nodes. Defaults to 20. */
  maxConcurrentPolls?: number;
  /** Options for trace capture (Results Explorer). */
  traceOptions?: ExecutionTraceOptions;
  /** Low-priority environment layer (e.g. { baseUrl: 'https://host' }). Workflow variables override these. */
  environmentLayer?: Record<string, string>;
  /** Resolver for sub-workflow nodes — returns the child workflow by ID. */
  resolveSubWorkflow?: (workflowId: string) => Workflow | undefined;
  /** Per-request HTTP timeout in milliseconds for HTTP nodes. Defaults to 30 000 ms. */
  httpTimeoutMs?: number;
  /** Per-HTTP-node base URL resolver (service registry / host profiles). */
  resolveHttpBaseUrl?: (data: HttpNodeData) => string | undefined;
  /** Per-HTTP-node auth resolver (service auth / workflow auth profiles). */
  resolveHttpAuth?: (data: HttpNodeData) => Scenario['auth'] | undefined;
  /** Kafka client operations for produce/consume nodes. When omitted, Kafka nodes will fail. */
  kafkaOperations?: KafkaNodeOperations;
  /** WebSocket client operations for WS nodes. When omitted, WS nodes will fail. */
  wsOperations?: WsNodeOperations;
}

/**
 * Run a workflow graph under load: N iterations × M concurrency.
 * Each iteration gets an isolated VariableContext (no cross-iteration state leakage).
 * Results are tagged with `iterationIndex` and `workflowNodeId` for per-step metrics.
 * Returns both results and execution trace (Phase 7e).
 */
export async function runGraphLoad(
  workflow: Workflow,
  opts: GraphLoadRunOpts,
): Promise<{ results: RequestResult[]; trace: WorkflowExecutionTrace }> {
  const { iterations, concurrency, initialVariables = {}, breaker, abortSignal, onProgress, correlationWaitConfig, maxConcurrentPolls, traceOptions, environmentLayer, resolveSubWorkflow, httpTimeoutMs, resolveHttpBaseUrl, resolveHttpAuth, kafkaOperations, wsOperations } = opts;

  // ── Phase 7B: Pre-run Kafka load policy guard ──────────────────────────
  // Fail fast before any iteration machinery starts if a kafkaConsume node
  // is configured with a mode that is incompatible with workflow load tests.
  for (const node of workflow.nodes) {
    if (node.type !== 'kafkaConsume') continue;
    const consumeMode = (node.data as KafkaConsumeNodeData).loadTestBehavior?.mode;
    const outcome = resolveKafkaConsumeLoadPolicy('workflow', consumeMode);
    if (outcome.decision === 'block') {
      throw new Error(outcome.message ?? `Kafka consume node "${(node.data as { label?: string }).label ?? node.id}" cannot run in workflow load test mode`);
    }
  }

  const allResults: RequestResult[] = [];
  const allTraces: WorkflowIterationTrace[] = [];
  let completedIterations = 0;
  let iterationCounter = 0;
  let iterationDurationSum = 0;
  const startTime = performance.now();

  // Create poll semaphore if there are WaitForCondition nodes
  const hasWaitForCondition = workflow.nodes.some(n => n.type === 'waitForCondition');
  const pollSemaphore = hasWaitForCondition ? new Semaphore(maxConcurrentPolls ?? 20) : undefined;

  // Set up correlation store and injector based on mode
  // - 'wait-for-real': Use RemoteCorrelationStore (webhooks come from external system)
  // - 'synthetic-inject': Use InMemoryCorrelationStore + SyntheticEventInjector (we simulate the webhook)
  // - 'auto-resume': No store needed (handler skips wait entirely)
  let correlationStore: InMemoryCorrelationStore | RemoteCorrelationStore | undefined;
  let syntheticInjector: SyntheticEventInjector | undefined;

  if (correlationWaitConfig?.mode === 'wait-for-real') {
    correlationStore = new RemoteCorrelationStore();
  } else if (correlationWaitConfig?.mode === 'synthetic-inject') {
    correlationStore = new InMemoryCorrelationStore();
    syntheticInjector = new SyntheticEventInjector(correlationStore, {
      responseDelayMs: correlationWaitConfig.syntheticDelayMs ?? 0,
      jitterMs: correlationWaitConfig.syntheticJitterMs ?? 0,
      mockPayloads: correlationWaitConfig.mockPayloads,
      defaultPayload: {},
    });
    syntheticInjector.start();
  }

  // Build a map of node ID → label for tagging results
  const nodeLabels = new Map<string, string>();
  for (const node of workflow.nodes) {
    const label = (node.data as { label?: string })?.label || node.type;
    nodeLabels.set(node.id, label);
  }

  const runOneIteration = async (): Promise<void> => {
    const myIterationIndex = iterationCounter++;
    
    if (abortSignal?.aborted) return;
    if (breaker?.shouldStop) return;

    const iterationResults: RequestResult[] = [];

    const mergedInitialVars = { ...workflow.variables, ...initialVariables };

    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: () => {},
      onVariablesChange: () => {},
      onComplete: (results, _passed, durationMs, trace) => {
        for (const r of results) {
          const stepLabel = nodeLabels.get(r.workflowNodeId || r.scenarioId) || r.scenarioName;
          const tagged: RequestResult = {
            ...r,
            iterationIndex: myIterationIndex,
            featureGroupName: `Workflow: ${workflow.name}`,
            groupName: stepLabel,
            scenarioName: stepLabel,
          };
          iterationResults.push(tagged);
        }
        iterationDurationSum += durationMs;
        if (trace) {
          allTraces.push({
            ...trace,
            index: myIterationIndex,
            initialVariables: { ...mergedInitialVars },
          });
        }
      },
    };

    try {
      // For 'wait-for-real' mode, we don't set loadTestMode so the handler uses the real webhook path
      const isWaitForReal = correlationWaitConfig?.mode === 'wait-for-real';
      
      const results = await runGraph(
        workflow.nodes,
        workflow.edges,
        { ...workflow.variables, ...initialVariables },
        callbacks,
        abortSignal,
        environmentLayer, // environmentLayer — carries baseUrl from harness config
        resolveHttpBaseUrl,
        resolveHttpAuth,
        undefined, // debugController
        undefined, // errorConfig
        resolveSubWorkflow,
        correlationStore, // Pass correlation store for wait-for-real mode
        !isWaitForReal, // loadTestMode - false for wait-for-real so it uses real webhook waiting
        correlationWaitConfig, // runner-level config for CorrelationWait behavior
        pollSemaphore, // Throttle concurrent polls across iterations
        traceOptions, // Trace capture options for Results Explorer
        httpTimeoutMs, // Per-request HTTP timeout (defaults to 30s inside runGraph)
        kafkaOperations,
        wsOperations ? buildWsNodeOperations() : undefined,
      );

      for (const r of results) {
        if (!r.iterationIndex) {
          (r as RequestResult).iterationIndex = myIterationIndex;
        }
        // workflowNodeId is already set by executeHttpNode
        // Also tag results that came directly from runGraph (if onComplete wasn't called)
        if (!r.featureGroupName) {
          const stepLabel = nodeLabels.get(r.workflowNodeId || r.scenarioId) || r.scenarioName;
          (r as RequestResult).featureGroupName = `Workflow: ${workflow.name}`;
          (r as RequestResult).groupName = stepLabel;
          (r as RequestResult).scenarioName = stepLabel;
        }
      }

      // Check if iteration was aborted - mark all its results as cancelled
      if (abortSignal?.aborted) {
        const targetResults = iterationResults.length > 0 ? iterationResults : results;
        for (const r of targetResults) {
          (r as RequestResult).cancelled = true;
          if (!r.errorMessage) {
            (r as RequestResult).errorMessage = 'Cancelled by user';
          }
        }
        if (targetResults.length === 0) {
          iterationResults.push(buildWorkflowMarkerResult(workflow.name, myIterationIndex, {
            cancelled: true, errorMessage: 'Cancelled by user',
            scenarioId: 'workflow-cancelled', groupName: 'Cancelled', workflowNodeId: 'cancelled',
          }));
        }
      }
      
      const finalResults = iterationResults.length > 0 ? iterationResults : results;
      for (const r of finalResults) {
        if (!r.cancelled) breaker?.record(r);
      }
      allResults.push(...finalResults);
    } catch (err) {
      const isCancelled = abortSignal?.aborted;
      const errorResult = buildWorkflowMarkerResult(workflow.name, myIterationIndex, {
        cancelled: isCancelled,
        errorMessage: isCancelled ? 'Cancelled by user' : toErrorMessage(err),
        scenarioId: isCancelled ? 'workflow-cancelled' : 'workflow-error',
        groupName: isCancelled ? 'Cancelled' : 'Error',
        workflowNodeId: isCancelled ? 'cancelled' : 'error',
      });
      allResults.push(errorResult);
      breaker?.record(errorResult);
    }

    completedIterations++;
    
    if (onProgress) {
      const elapsed = performance.now() - startTime;
      onProgress(completedIterations, iterations, allResults, {
        elapsedMs: elapsed,
        targetConcurrency: concurrency,
        currentInFlight: iterationCounter - completedIterations,
        durationMs: 0,
        avgIterationTimeMs: completedIterations > 0
          ? Math.round(iterationDurationSum / completedIterations * 100) / 100
          : undefined,
      });
    }
  };

  try {
    if (concurrency <= 1) {
      for (let i = 0; i < iterations; i++) {
        if (abortSignal?.aborted || breaker?.shouldStop) break;
        await runOneIteration();
      }
    } else {
      let launched = 0;
      let inFlightCount = 0;

      await new Promise<void>((resolveAll) => {
        let resolved = false;
        function finish() {
          if (resolved) return;
          resolved = true;
          resolveAll();
        }
        function launchNext() {
          while (launched < iterations && inFlightCount < concurrency) {
            if (abortSignal?.aborted || breaker?.shouldStop) break;
            launched++;
            inFlightCount++;
            runOneIteration().finally(() => {
              inFlightCount--;
              if (inFlightCount === 0 && (launched >= iterations || abortSignal?.aborted || breaker?.shouldStop)) {
                finish();
              } else if (!abortSignal?.aborted && !breaker?.shouldStop) {
                launchNext();
              }
            });
          }
          if (inFlightCount === 0) finish();
        }
        launchNext();
      });
    }
  } finally {
    // Clean up the synthetic injector if it was started
    if (syntheticInjector) {
      syntheticInjector.stop();
    }
  }

  // Phase 7e: Build complete execution trace
  let totalDurationMs = 0;
  for (const t of allTraces) {
    totalDurationMs += t.durationMs;
  }
  const edgeSet = new Set<string>();
  for (const t of allTraces) {
    for (const e of t.traversedEdges) {
      edgeSet.add(e);
    }
  }
  const allTraversedEdges = Array.from(edgeSet);

  const executionTrace: WorkflowExecutionTrace = {
    workflowId: workflow.id,
    workflowName: workflow.name,
    totalIterations: iterations,
    totalDurationMs,
    iterations: allTraces,
    traversedEdges: allTraversedEdges,
    workflowSnapshot: {
      nodes: workflow.nodes,
      edges: workflow.edges,
    },
    fullTraceCaptured: traceOptions?.captureFullTrace ?? false,
    captureLevel: resolveTraceLevel(traceOptions),
  };

  return { results: allResults, trace: executionTrace };
}
