import type { WorkflowNode, WorkflowEdge, HttpNodeData, WorkflowErrorConfig, Workflow } from '../types/workflow';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import type { RequestResult, Scenario } from '../../../shared/types';
import { TokenManager } from '../../../engine/tokenManager';
import { VariableContext } from './variableContext';
import { summarizeRequestFailure } from '../utils/workflowRunErrors';
import { humanizeError, toErrorMessage } from '../../../shared/utils/helpers';
import type { DebugController } from './debugController';
import type { ICorrelationStore } from './correlationStore';
import { findStartNodes } from './graphRunnerHelpers';
import type { Semaphore } from '../../../shared/utils/semaphore';
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
  handleCorrelationWaitNode,
  type NodeHandlerContext,
  type PassedFlag,
} from './graphRunnerNodeHandlers';
import { TraceCollector } from './traceCollector';
import type { GraphRunCallbacks, CorrelationWaitRunnerConfig } from './graphRunnerInterfaces';
// Re-export interfaces so existing consumers of graphRunner.ts stay unbroken.
export type { GraphRunCallbacks, SubWorkflowRunSummary, CorrelationWaitRunnerConfig } from './graphRunnerInterfaces';
export { resolveTraceLevel } from './graphRunnerTraceLevel';
import { resolveTraceLevel } from './graphRunnerTraceLevel';

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
  /** Optional correlation store for `CorrelationWait` nodes. When omitted, those nodes will fail. */
  correlationStore?: ICorrelationStore,
  /**
   * When true, the workflow is running under load test mode (N iterations × M concurrency).
   * Event-driven nodes (CorrelationWait, WaitForCondition) may use their loadTestBehavior settings.
   */
  loadTestMode?: boolean,
  /** Runner-level configuration for CorrelationWait behavior. Takes precedence over node-level settings. */
  correlationWaitConfig?: CorrelationWaitRunnerConfig,
  /** Semaphore for throttling concurrent poll operations during load tests. */
  pollSemaphore?: Semaphore,
  /** Options for trace capture (Results Explorer). */
  traceOptions?: import('../../../shared/types').ExecutionTraceOptions,
): Promise<RequestResult[]> {
  const start = performance.now();
  const ctx = new VariableContext(initialVariables, environmentLayer);
  ctx.registerWorkflowNodes(nodes);
  const tokenManager = new TokenManager();
  const results: RequestResult[] = [];
  const traceCollector = new TraceCollector(nodes);
  
  // Initialize maps for capturing execution details
  const capturedHttpDetails = new Map<string, import('./graphRunnerNodeHandlerContext').CapturedHttpNodeDetails>();
  const capturedSubWorkflowTraces = new Map<string, import('../../../shared/types').WorkflowExecutionTrace>();
  const capturedScriptOutput = new Map<string, string[]>();

  const effectiveLevelOnce = resolveTraceLevel(traceOptions);
  const nodeLogBuffer = new Map<string, { prefix: string; text: string; ts: number }[]>();
  const MAX_LOG_LINES_PER_NODE = 200;

  const log = (line: { prefix: string; text: string }, nodeId?: string) => {
    const entry = { ...line, ts: Date.now() };
    callbacks.onLog?.(entry);
    if (effectiveLevelOnce === 'debug' && nodeId) {
      const buf = nodeLogBuffer.get(nodeId);
      if (buf) {
        if (buf.length < MAX_LOG_LINES_PER_NODE) {
          buf.push(entry);
        } else if (buf.length === MAX_LOG_LINES_PER_NODE) {
          buf.push({ prefix: '*', text: `[... log capped at ${MAX_LOG_LINES_PER_NODE} lines]`, ts: entry.ts });
        }
      } else {
        nodeLogBuffer.set(nodeId, [entry]);
      }
    }
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
        // Phase 7e: Record edge traversal
        traceCollector.onEdgeTraversed(edge.id);
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
    const nodeLog = (line: { prefix: string; text: string }) => log(line, nodeId);
    const hCtx: NodeHandlerContext = {
      nodeMap, outgoing, ctx, tokenManager, results,
      allPassed, visited, joinArrived, incomingCount, callbacks,
      abortSignal, initialVariables, environmentLayer,
      resolveHttpBaseUrl, resolveHttpAuth, debugController,
      resolveSubWorkflow, log: nodeLog, nodeLabel,
      visit, visitOutgoing, threadId,
      correlationStore,
      executionId: `exec-${Math.floor(start)}-${Math.random().toString(36).slice(2, 8)}`,
      workflowId: 'unknown',
      startTime: Date.now(),
      loadTestMode,
      correlationWaitConfig,
      pollSemaphore,
      traceCollector,
      traceOptions,
      capturedHttpDetails,
      capturedSubWorkflowTraces,
      capturedScriptOutput,
    };

    // Phase 7e: Record node execution start
    traceCollector.onNodeStart(nodeId);

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
      } else if (node.type === 'correlationWait') {
        await handleCorrelationWaitNode(nodeId, node, hCtx, passedFlag);
      } else if (node.type === 'end') {
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });
      }

      if (!passedFlag.value) allPassed = false;

      // Build execution event details, gated by trace level
      const effectiveLevel = resolveTraceLevel(traceOptions);
      let eventDetails: import('../../../shared/types').ExecutionEventDetails | undefined;

      if (effectiveLevel !== 'minimal') {
        // Standard+: structured data for all node types
        if (isHttpWorkflowNode(node)) {
          const nodeResults = results.filter(r => r.workflowNodeId === nodeId);
          const lastResult = nodeResults[nodeResults.length - 1];
          if (lastResult) {
            eventDetails = {
              statusCode: lastResult.httpStatus,
              responseTimeMs: lastResult.responseTimeMs,
              requestResultId: lastResult.id,
              method: lastResult.method,
              url: lastResult.url,
            };

            if (!lastResult.passed) {
              if (lastResult.errorMessage) {
                eventDetails.error = lastResult.errorMessage;
              } else if (lastResult.failureDetails.length > 0) {
                eventDetails.error = lastResult.failureDetails
                  .map(f => `${f.path}: expected ${f.expected}, got ${f.actual}`)
                  .join('; ');
              }
            }

            // Full/Debug: complete request/response bodies, assertions, variables, mapping traces
            const capturedDetails = capturedHttpDetails.get(nodeId);
            if (capturedDetails && (effectiveLevel === 'full' || effectiveLevel === 'debug')) {
              eventDetails.request = capturedDetails.request;
              eventDetails.response = capturedDetails.response;
              eventDetails.assertions = capturedDetails.assertions;
              eventDetails.variablesSnapshot = capturedDetails.variablesSnapshot;
              eventDetails.extractedVariables = capturedDetails.extractedVariables;
              eventDetails.mappingTraces = capturedDetails.mappingTraces;
            } else if (capturedDetails) {
              // Standard: only assertions and extracted variables (no bodies)
              eventDetails.assertions = capturedDetails.assertions;
              eventDetails.extractedVariables = capturedDetails.extractedVariables;
            }
          }
        } else if (node.type === 'webhook') {
          const webhookInput = ctx.get('__webhookInput');
          const webhookMethod = ctx.get('__webhookMethod');
          const webhookPath = ctx.get('__webhookPath');
          if (webhookInput) {
            eventDetails = {
              webhookInput: { payload: webhookInput, method: webhookMethod, path: webhookPath },
              extractedVariables: ctx.snapshot(),
            };
            ctx.delete('__webhookInput');
            ctx.delete('__webhookMethod');
            ctx.delete('__webhookPath');
          }
        } else if (node.type === 'correlationWait') {
          const cwPayloadRaw = ctx.get('__cwWebhookPayload');
          const cwWaitMs = ctx.get('__cwWaitDurationMs');
          const cwData = node.data as import('../types/workflow').CorrelationWaitNodeData;
          eventDetails = {
            ...(cwPayloadRaw ? {
              webhookInput: { payload: cwPayloadRaw, path: cwData.webhookPath },
            } : {}),
            waitDurationMs: cwWaitMs ? Number(cwWaitMs) : undefined,
            extractedVariables: ctx.snapshot(),
            variablesSnapshot: ctx.snapshot(),
          };
          ctx.delete('__cwWebhookPayload');
          ctx.delete('__cwWaitDurationMs');
        } else if (node.type === 'subWorkflow') {
          const swData = node.data as import('../types/workflow').SubWorkflowNodeData;
          eventDetails = {
            subWorkflowId: swData.workflowId,
            subWorkflowPassed: passedFlag.value,
            subWorkflowTrace: capturedSubWorkflowTraces.get(nodeId),
          };
        }
      } else {
        // Minimal: only capture error info for failed nodes
        if (!passedFlag.value) {
          if (isHttpWorkflowNode(node)) {
            const nodeResults = results.filter(r => r.workflowNodeId === nodeId);
            const lastResult = nodeResults[nodeResults.length - 1];
            if (lastResult && !lastResult.passed) {
              eventDetails = {
                error: lastResult.errorMessage || lastResult.failureDetails
                  .map(f => `${f.path}: expected ${f.expected}, got ${f.actual}`)
                  .join('; '),
              };
            }
          }
        }
      }
      // Debug level: attach buffered log lines and script output to event details
      if (effectiveLevelOnce === 'debug') {
        const buffered = nodeLogBuffer.get(nodeId);
        if (buffered && buffered.length > 0) {
          if (!eventDetails) eventDetails = {};
          eventDetails.logLines = buffered;
        }
        const scriptOut = capturedScriptOutput.get(nodeId);
        if (scriptOut && scriptOut.length > 0) {
          if (!eventDetails) eventDetails = {};
          eventDetails.scriptOutput = scriptOut;
        }
      }

      traceCollector.onNodeComplete(nodeId, passedFlag.value ? 'pass' : 'fail', eventDetails);
    } catch (err) {
      allPassed = false;
      const technical = toErrorMessage(err);
      const friendly = humanizeError(technical);
      nodeLog({ prefix: '!', text: `[${nodeLabel(nodeId)}] Error — ${friendly}` });
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
      
      // Phase 7e: Record node execution completion (exception)
      const catchDetails: import('../../../shared/types').ExecutionEventDetails = {
        error: friendly,
        errorStack: technical,
      };
      if (effectiveLevelOnce === 'debug') {
        const buffered = nodeLogBuffer.get(nodeId);
        if (buffered && buffered.length > 0) {
          catchDetails.logLines = buffered;
        }
      }
      traceCollector.onNodeComplete(nodeId, 'fail', catchDetails);
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
          if (result.errorMessage) failedErrors.push(result.errorMessage);
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
  
  // Phase 7e: Build iteration trace
  const iterationTrace: import('../../../shared/types').WorkflowIterationTrace = {
    index: 0, // Will be set by graphLoadRunner for multi-iteration runs
    passed: allPassed,
    durationMs,
    events: traceCollector.getEvents(),
    finalVariables: ctx.snapshot(),
    traversedEdges: traceCollector.getTraversedEdges(),
  };
  
  callbacks.onComplete(results, allPassed, durationMs, iterationTrace);
  return results;
}
