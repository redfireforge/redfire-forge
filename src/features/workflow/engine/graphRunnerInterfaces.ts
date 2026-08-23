/**
 * Shared interface declarations for the workflow graph runner.
 * Kept separate to avoid circular imports between graphRunner.ts and
 * graphRunnerNodeHandlerContext.ts.
 */
import type { NodeRunStatus } from '../types/workflow';
import type { RequestResult } from '@shared/types';

// Re-export from canonical location to avoid duplication
export type { CorrelationWaitRunnerConfig } from '@shared/types';

export interface SubWorkflowRunSummary {
  /** Parent node ID that triggered the sub-workflow. */
  parentNodeId: string;
  /** Child workflow name. */
  childWorkflowName: string;
  /** Whether the child workflow passed. */
  passed: boolean;
  /** Duration of the child workflow execution in ms. */
  durationMs: number;
  /** Number of results produced by the child. */
  resultCount: number;
  /** Step summaries from the child workflow (HTTP nodes only). */
  childSteps: Array<{
    nodeId: string;
    label: string;
    state: 'pass' | 'fail' | 'skipped';
    statusCode?: number;
    responseTimeMs?: number;
    error?: string;
  }>;
  /** Which retry attempt produced this result (0 = first attempt). */
  attempt: number;
}

export interface GraphRunCallbacks {
  onNodeStateChange: (nodeId: string, status: NodeRunStatus) => void;
  onVariablesChange: (variables: Record<string, string>) => void;
  onComplete: (
    results: RequestResult[], 
    passed: boolean, 
    durationMs: number,
    /** Phase 7e: Execution trace for visual replay (optional for backwards compatibility) */
    trace?: import('../../../shared/types').WorkflowIterationTrace,
  ) => void;
  onLog?: (line: { prefix: string; text: string; ts?: number }) => void;
  /** Fired when a sub-workflow node completes (after retries). */
  onSubWorkflowComplete?: (summary: SubWorkflowRunSummary) => void;
}

