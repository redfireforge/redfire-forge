import type { WorkflowNode, WorkflowEdge, HttpNodeData, NodeRunStatus, WorkflowErrorConfig, Workflow } from '../types/workflow';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import type { RequestResult, Scenario } from '../../../shared/types';
import { TokenManager } from '../../../engine/tokenManager';
import { VariableContext } from './variableContext';
import { summarizeRequestFailure } from '../utils/workflowRunErrors';
import { humanizeError, toErrorMessage } from '../../../shared/utils/helpers';
import type { DebugController } from './debugController';
import { findStartNodes } from './graphRunnerHelpers';
import {
  handleHttpNode,
  handleConditionNode,
  handleDelayNode,
  handleStartNode,
  handleWebhookNode,
  handleScheduleNode,
  handleForkNode,
  handleJoinNode,
  handleSwitchNode,
  handleLoopNode,
  handleSetVariableNode,
  handleScriptNode,
  handleAggregateNode,
  handleErrorHandlerNode,
  handleLogDebugNode,
  handleWaitForConditionNode,
  handleSubWorkflowNode,
  type NodeHandlerContext,
  type PassedFlag,
} from './graphRunnerNodeHandlers';

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
  onComplete: (results: RequestResult[], passed: boolean, durationMs: number) => void;
  onLog?: (line: { prefix: '' | '*' | '>' | '<' | '#' | '!'; text: string; ts?: number }) => void;
  /** Fired when a sub-workflow node completes (after retries). */
  onSubWorkflowComplete?: (summary: SubWorkflowRunSummary) => void;
}

/**
 * Execute a workflow graph with topological traversal.
 * Handles HTTP nodes, Condition branching (multiple edges per Yes/No), and Delay nodes.
 * Calls back for canvas animation and variable updates.
 */
export async function runGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  initialVariables: Record<string, string>,
  callbacks: GraphRunCallbacks,
  abortSignal?: AbortSignal,
  /** Low-priority layer (e.g. Harness env base URL as `baseUrl`). Manual initial vars override these. */
  environmentLayer?: Record<string, string>,
  /** Per-HTTP-node base URL when the node sets host env + microservice; falls back to harness when omitted. */
  resolveHttpBaseUrl?: (data: HttpNodeData) => string | undefined,
  /** Optional per-HTTP-node auth profile resolver (workflow-local profile bindings). */
  resolveHttpAuth?: (data: HttpNodeData) => Scenario['auth'] | undefined,
  /** Optional debug controller for step-through execution. */
  debugController?: DebugController,
  /** Workflow-level error handling config. */
  errorConfig?: WorkflowErrorConfig,
  /** Resolver for sub-workflow nodes — returns the child workflow by ID. */
  resolveSubWorkflow?: (workflowId: string) => Workflow | undefined,
): Promise<RequestResult[]> {
  const start = performance.now();
  const ctx = new VariableContext(initialVariables, environmentLayer);
  ctx.registerWorkflowNodes(nodes);
  const tokenManager = new TokenManager();
  const results: RequestResult[] = [];

  const log = (line: { prefix: '' | '*' | '>' | '<' | '#' | '!'; text: string }) => {
    callbacks.onLog?.({ ...line, ts: Date.now() });
  };
  const nodeLabel = (id: string) => {
    const n = nodes.find(nd => nd.id === id);
    return (n?.data as { label?: string })?.label || n?.type || id;
  };

  log({ prefix: '*', text: `Workflow run started — ${nodes.length} nodes` });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    const list = outgoing.get(e.source) ?? [];
    list.push(e);
    outgoing.set(e.source, list);
  }

  const startNodes = findStartNodes(nodes, edges);
  if (startNodes.length === 0) {
    callbacks.onComplete([], true, 0);
    return [];
  }

  for (const node of nodes) {
    callbacks.onNodeStateChange(node.id, { state: 'pending' });
  }

  let allPassed = true;
  const visited = new Set<string>();

  // Join-node barrier: track how many incoming edges have arrived.
  const incomingCount = new Map<string, number>();
  const joinArrived = new Map<string, number>();
  for (const e of edges) {
    incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1);
  }

  async function visit(nodeId: string, threadId = 'main'): Promise<void> {
    if (abortSignal?.aborted || debugController?.isStopped) return;

    /** Follow all outgoing edges from the given node. */
    const visitOutgoing = async (nid: string, tid: string = threadId) => {
      const nextEdges = outgoing.get(nid) ?? [];
      for (const edge of nextEdges) {
        await visit(edge.target, tid);
      }
    };

    const node = nodeMap.get(nodeId);
    if (!node) return;

    // Join barrier: wait until all incoming branches have arrived.
    if (node.type === 'join') {
      const arrived = (joinArrived.get(nodeId) ?? 0) + 1;
      joinArrived.set(nodeId, arrived);
      const expected = incomingCount.get(nodeId) ?? 1;
      if (arrived < expected) {
        // Show waiting state on join node (both debug and normal mode)
        callbacks.onNodeStateChange(nodeId, {
          state: 'running',
          responseDetail: `waiting (${arrived}/${expected})`,
        });
        if (debugController) {
          debugController.markWaitingJoin(nodeId, threadId);
        }
        return; // not all branches arrived yet
      }
      // All branches arrived — fall through to execute once
    }

    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // Debug: pause before executing this node
    if (debugController) {
      callbacks.onNodeStateChange(nodeId, { state: 'paused' });
      await debugController.waitForStep(nodeId, threadId);
      if (debugController.isStopped || abortSignal?.aborted) return;
      debugController.markRunning(nodeId, threadId);
    }

    callbacks.onNodeStateChange(nodeId, { state: 'running' });

    const passedFlag: PassedFlag = { value: allPassed };
    const hCtx: NodeHandlerContext = {
      nodeMap, outgoing, ctx, tokenManager, results,
      allPassed, visited, joinArrived, incomingCount, callbacks,
      abortSignal, initialVariables, environmentLayer,
      resolveHttpBaseUrl, resolveHttpAuth, debugController,
      resolveSubWorkflow, log, nodeLabel,
      visit, visitOutgoing, threadId,
    };

    try {
      if (isHttpWorkflowNode(node)) {
        await handleHttpNode(nodeId, node, hCtx, passedFlag);
      } else if (node.type === 'condition') {
        await handleConditionNode(nodeId, node, hCtx);
      } else if (node.type === 'delay') {
        await handleDelayNode(nodeId, node, hCtx);
      } else if (node.type === 'start') {
        await handleStartNode(nodeId, node, hCtx);
      } else if (node.type === 'webhook') {
        await handleWebhookNode(nodeId, node, hCtx);
      } else if (node.type === 'schedule') {
        await handleScheduleNode(nodeId, node, hCtx);
      } else if (node.type === 'fork') {
        await handleForkNode(nodeId, node, hCtx);
      } else if (node.type === 'join') {
        await handleJoinNode(nodeId, node, hCtx);
      } else if (node.type === 'switch') {
        await handleSwitchNode(nodeId, node, hCtx);
      } else if (node.type === 'loop') {
        await handleLoopNode(nodeId, node, hCtx);
      } else if (node.type === 'setVariable') {
        await handleSetVariableNode(nodeId, node, hCtx);
      } else if (node.type === 'script') {
        await handleScriptNode(nodeId, node, hCtx, passedFlag);
      } else if (node.type === 'aggregate') {
        await handleAggregateNode(nodeId, node, hCtx);
      } else if (node.type === 'errorHandler') {
        await handleErrorHandlerNode(nodeId, node, hCtx, passedFlag);
      } else if (node.type === 'logDebug') {
        await handleLogDebugNode(nodeId, node, hCtx);
      } else if (node.type === 'waitForCondition') {
        await handleWaitForConditionNode(nodeId, node, hCtx, passedFlag);
      } else if (node.type === 'subWorkflow') {
        await handleSubWorkflowNode(nodeId, node, hCtx, passedFlag, runGraph);
      } else if (node.type === 'end') {
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });
      }

      if (!passedFlag.value) allPassed = false;
    } catch (err) {
      allPassed = false;
      const technical = toErrorMessage(err);
      const friendly = humanizeError(technical);
      log({ prefix: '!', text: `[${nodeLabel(nodeId)}] Error — ${friendly}` });
      // Ensure httpStatus is always available even when the node throws before setting it
      if (isHttpWorkflowNode(node) && ctx.get('httpStatus') === undefined) {
        ctx.set('httpStatus', '0');
        ctx.set('status', '0');
        ctx.setForNode(nodeId, 'httpStatus', '0');
        ctx.setForNode(nodeId, 'status', '0');
      }
      callbacks.onNodeStateChange(nodeId, {
        state: 'fail',
        error: friendly,
      });
    }
  }

  for (const startNode of startNodes) {
    if (abortSignal?.aborted) break;
    await visit(startNode.id);
  }

  // ── Workflow-level error handling ──
  // If any node failed and we have a workflow-level error config with 'run-handler',
  // execute the handler subgraph.
  if (!allPassed && errorConfig?.mode === 'run-handler' && errorConfig.handlerEntryNodeId) {
    const handlerNode = nodeMap.get(errorConfig.handlerEntryNodeId);
    if (handlerNode && !visited.has(errorConfig.handlerEntryNodeId)) {
      // Inject workflow-level error info
      const failedResults = results.filter(r => !r.passed);
      const firstFailed = failedResults[0];
      const errVar = errorConfig.errorVariable || 'error.message';
      if (firstFailed) {
        ctx.set(errVar, firstFailed.errorMessage || summarizeRequestFailure(firstFailed));
        ctx.set('error.statusCode', String(firstFailed.httpStatus));
        ctx.set('error.failedCount', String(failedResults.length));
      }
      callbacks.onVariablesChange(ctx.snapshot());
      log({ prefix: '!', text: `Workflow-level error handler triggered — executing handler node "${nodeLabel(errorConfig.handlerEntryNodeId)}"` });
      await visit(errorConfig.handlerEntryNodeId);
    }
  }

  // If any node failed, implicitly mark unvisited End nodes as failed.
  // If all passed, mark unvisited End nodes as pass (in case they weren't reached via edges).
  const endNodes = nodes.filter(n => n.type === 'end');
  for (const endNode of endNodes) {
    if (!visited.has(endNode.id)) {
      if (!allPassed) {
        // Collect error messages from failed nodes
        const failedErrors: string[] = [];
        for (const [_nid, result] of results.entries()) {
          if (result.error) failedErrors.push(result.error);
        }
        const errorSummary = failedErrors.length > 0
          ? failedErrors.join('; ')
          : 'One or more steps failed';
        callbacks.onNodeStateChange(endNode.id, {
          state: 'fail',
          error: errorSummary,
          responseDetail: errorSummary,
        });
      } else {
        callbacks.onNodeStateChange(endNode.id, { state: 'pass' });
      }
    }
  }

  const durationMs = Math.round(performance.now() - start);
  log({ prefix: '*', text: `Workflow ${allPassed ? 'PASS' : 'FAIL'} — ${results.length} step(s), ${durationMs}ms` });
  callbacks.onComplete(results, allPassed, durationMs);
  return results;
}
