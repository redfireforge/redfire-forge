/**
 * Load testing wrapper for graphRunner.
 * Runs a workflow graph N times with M concurrency, tagging each result
 * with iterationIndex and workflowNodeId for per-iteration and per-step metrics.
 */

import type { Workflow } from '../types/workflow';
import type { RequestResult } from '../../../shared/types';
import { runGraph, type GraphRunCallbacks } from './graphRunner';
import { CircuitBreaker } from '../../../engine/circuitBreaker';
import type { ProgressMeta } from '../../../engine/executor';

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
}

/**
 * Run a workflow graph under load: N iterations × M concurrency.
 * Each iteration gets an isolated VariableContext (no cross-iteration state leakage).
 * Results are tagged with `iterationIndex` and `workflowNodeId` for per-step metrics.
 */
export async function runGraphLoad(
  workflow: Workflow,
  opts: GraphLoadRunOpts,
): Promise<RequestResult[]> {
  const { iterations, concurrency, initialVariables = {}, breaker, abortSignal, onProgress } = opts;
  
  const allResults: RequestResult[] = [];
  let completedIterations = 0;
  let iterationCounter = 0;
  const startTime = performance.now();

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
      onComplete: (results, _passed, _durationMs) => {
        for (const r of results) {
          const stepLabel = nodeLabels.get(r.scenarioId) || r.scenarioName;
          const tagged: RequestResult = {
            ...r,
            iterationIndex: myIterationIndex,
            workflowNodeId: r.scenarioId,
            // Tag with workflow name as "feature" and step label as "scenario/group"
            featureGroupName: `Workflow: ${workflow.name}`,
            groupName: stepLabel,
            scenarioName: stepLabel,
          };
          iterationResults.push(tagged);
        }
      },
    };

    try {
      const results = await runGraph(
        workflow.nodes,
        workflow.edges,
        { ...workflow.variables, ...initialVariables },
        callbacks,
        abortSignal,
      );

      for (const r of results) {
        if (!r.iterationIndex) {
          (r as RequestResult).iterationIndex = myIterationIndex;
        }
        if (!r.workflowNodeId) {
          (r as RequestResult).workflowNodeId = r.scenarioId;
        }
        // Also tag results that came directly from runGraph (if onComplete wasn't called)
        if (!r.featureGroupName) {
          const stepLabel = nodeLabels.get(r.scenarioId) || r.scenarioName;
          (r as RequestResult).featureGroupName = `Workflow: ${workflow.name}`;
          (r as RequestResult).groupName = stepLabel;
          (r as RequestResult).scenarioName = stepLabel;
        }
      }

      allResults.push(...(iterationResults.length > 0 ? iterationResults : results));
    } catch (err) {
      const errorResult: RequestResult = {
        id: crypto.randomUUID(),
        scenarioId: 'workflow-error',
        scenarioName: workflow.name,
        featureGroupName: `Workflow: ${workflow.name}`,
        groupName: 'Error',
        url: '',
        method: 'GET',
        httpStatus: 0,
        responseTimeMs: 0,
        responseBody: '',
        timestamp: Date.now(),
        passed: false,
        validationMode: 'none',
        failureDetails: [],
        errorMessage: err instanceof Error ? err.message : String(err),
        iterationIndex: myIterationIndex,
        workflowNodeId: 'error',
      };
      allResults.push(errorResult);
      breaker?.recordResult(errorResult);
    }

    completedIterations++;
    
    if (onProgress) {
      const elapsed = performance.now() - startTime;
      onProgress(completedIterations, iterations, allResults, {
        elapsedMs: elapsed,
        targetConcurrency: concurrency,
        currentInFlight: iterationCounter - completedIterations,
        durationMs: 0,
      });
    }
  };

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

  return allResults;
}
