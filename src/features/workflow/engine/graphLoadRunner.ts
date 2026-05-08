/**
 * Load testing wrapper for graphRunner.
 * Runs a workflow graph N times with M concurrency, tagging each result
 * with iterationIndex and workflowNodeId for per-iteration and per-step metrics.
 */

import type { Workflow } from '../types/workflow';
import type { RequestResult, WorkflowIterationTrace, WorkflowExecutionTrace, ExecutionTraceOptions } from '../../../shared/types';
import { runGraph, type GraphRunCallbacks, type CorrelationWaitRunnerConfig } from './graphRunner';
import { CircuitBreaker } from '../../../engine/circuitBreaker';
import type { ProgressMeta } from '../../../engine/executor';
import { RemoteCorrelationStore } from './remoteCorrelationStore';
import { InMemoryCorrelationStore } from './correlationStore';
import { SyntheticEventInjector } from './syntheticEventInjector';
import { Semaphore } from '../../../shared/utils/semaphore';

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
  const { iterations, concurrency, initialVariables = {}, breaker, abortSignal, onProgress, correlationWaitConfig, maxConcurrentPolls, traceOptions, environmentLayer } = opts;
  
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
          allTraces.push({ ...trace, index: myIterationIndex });
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
        undefined, // resolveHttpBaseUrl
        undefined, // resolveHttpAuth
        undefined, // debugController
        undefined, // errorConfig
        undefined, // resolveSubWorkflow
        correlationStore, // Pass correlation store for wait-for-real mode
        !isWaitForReal, // loadTestMode - false for wait-for-real so it uses real webhook waiting
        correlationWaitConfig, // runner-level config for CorrelationWait behavior
        pollSemaphore, // Throttle concurrent polls across iterations
        traceOptions, // Trace capture options for Results Explorer
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
        // Mark any successful results from this iteration as cancelled
        for (const r of iterationResults) {
          if (r.passed) {
            (r as RequestResult).passed = false;
            (r as RequestResult).errorMessage = 'Cancelled by user';
            (r as RequestResult).cancelled = true;
          }
        }
        // Add a cancelled marker result if no results yet
        if (iterationResults.length === 0) {
          const cancelledResult: RequestResult = {
            id: crypto.randomUUID(),
            scenarioId: 'workflow-cancelled',
            scenarioName: workflow.name,
            featureGroupName: `Workflow: ${workflow.name}`,
            groupName: 'Cancelled',
            url: '',
            method: 'GET',
            httpStatus: 0,
            responseTimeMs: 0,
            responseBody: '',
            timestamp: Date.now(),
            passed: false,
            validationMode: 'none',
            failureDetails: [],
            errorMessage: 'Cancelled by user',
            iterationIndex: myIterationIndex,
            workflowNodeId: 'cancelled',
            cancelled: true,
          };
          iterationResults.push(cancelledResult);
        }
      }
      
      allResults.push(...(iterationResults.length > 0 ? iterationResults : results));
    } catch (err) {
      const isCancelled = abortSignal?.aborted;
      const errorResult: RequestResult = {
        id: crypto.randomUUID(),
        scenarioId: isCancelled ? 'workflow-cancelled' : 'workflow-error',
        scenarioName: workflow.name,
        featureGroupName: `Workflow: ${workflow.name}`,
        groupName: isCancelled ? 'Cancelled' : 'Error',
        url: '',
        method: 'GET',
        httpStatus: 0,
        responseTimeMs: 0,
        responseBody: '',
        timestamp: Date.now(),
        passed: false,
        validationMode: 'none',
        failureDetails: [],
        errorMessage: isCancelled ? 'Cancelled by user' : (err instanceof Error ? err.message : String(err)),
        iterationIndex: myIterationIndex,
        workflowNodeId: isCancelled ? 'cancelled' : 'error',
        cancelled: isCancelled,
      };
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
      const pool: Promise<void>[] = [];
      
      while (launched < iterations) {
        if (abortSignal?.aborted || breaker?.shouldStop) break;
        
        while (pool.length < concurrency && launched < iterations) {
          launched++;
          const p = runOneIteration().then(() => {
            pool.splice(pool.indexOf(p), 1);
          });
          pool.push(p);
        }
        
        if (pool.length > 0) {
          await Promise.race(pool);
        }
      }
      
      await Promise.all(pool);
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
  };

  return { results: allResults, trace: executionTrace };
}
