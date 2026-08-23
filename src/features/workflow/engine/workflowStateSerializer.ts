import type { WorkflowPausedState } from '../types/workflow';
import type { NodeHandlerContext } from './graphRunnerNodeHandlers';
import type { RequestResult } from '@shared/types';

/**
 * Serialize the current workflow execution state so it can be persisted
 * and later resumed (e.g. after a correlation wait webhook callback).
 */
export function serializeWorkflowState(
  hCtx: NodeHandlerContext,
  pausedNodeId: string,
  executionId: string,
  workflowId: string,
  startTime: number,
): WorkflowPausedState {
  return {
    executionId,
    workflowId,
    variables: hCtx.ctx.snapshot(),
    visitedNodes: [...hCtx.visited],
    pausedNodeId,
    threadId: hCtx.threadId,
    joinArrived: Object.fromEntries(hCtx.joinArrived),
    results: hCtx.results.map(stripNonSerializable),
    startTime,
    initialVariables: { ...hCtx.initialVariables },
    environmentLayer: hCtx.environmentLayer ? { ...hCtx.environmentLayer } : undefined,
  };
}

/**
 * Deserialize a persisted workflow state back into the structures
 * needed by the graph runner to resume execution.
 *
 * Returns the plain data — the caller is responsible for constructing
 * the full `NodeHandlerContext` (which requires live callbacks, abort
 * signals, etc. that cannot be serialized).
 */
export function deserializeWorkflowState(state: WorkflowPausedState): {
  variables: Record<string, string>;
  visitedNodes: Set<string>;
  pausedNodeId: string;
  threadId: string;
  joinArrived: Map<string, number>;
  results: RequestResult[];
  startTime: number;
  initialVariables: Record<string, string>;
  environmentLayer?: Record<string, string>;
} {
  return {
    variables: { ...state.variables },
    visitedNodes: new Set(state.visitedNodes),
    pausedNodeId: state.pausedNodeId,
    threadId: state.threadId,
    joinArrived: new Map(Object.entries(state.joinArrived)),
    results: [...state.results],
    startTime: state.startTime,
    initialVariables: { ...state.initialVariables },
    environmentLayer: state.environmentLayer ? { ...state.environmentLayer } : undefined,
  };
}

/**
 * Encode a WorkflowPausedState to a JSON string.
 */
export function encodeWorkflowState(state: WorkflowPausedState): string {
  return JSON.stringify(state);
}

/**
 * Decode a JSON string back to a WorkflowPausedState.
 * Throws if the string is not valid JSON or is missing required fields.
 */
export function decodeWorkflowState(json: string): WorkflowPausedState {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid workflow state: not an object');
  if (typeof parsed.executionId !== 'string') throw new Error('Invalid workflow state: missing executionId');
  if (typeof parsed.workflowId !== 'string') throw new Error('Invalid workflow state: missing workflowId');
  if (typeof parsed.pausedNodeId !== 'string') throw new Error('Invalid workflow state: missing pausedNodeId');
  if (typeof parsed.threadId !== 'string') throw new Error('Invalid workflow state: missing threadId');
  if (!Array.isArray(parsed.visitedNodes)) throw new Error('Invalid workflow state: visitedNodes must be an array');
  if (!Array.isArray(parsed.results)) throw new Error('Invalid workflow state: results must be an array');
  return parsed as WorkflowPausedState;
}

/** Strip non-serializable properties from a RequestResult (functions, circular refs, etc.). */
function stripNonSerializable(r: RequestResult): RequestResult {
  return JSON.parse(JSON.stringify(r));
}
