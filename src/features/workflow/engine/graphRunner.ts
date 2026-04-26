import type { WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData, DelayNodeData, StartNodeData, WebhookTriggerNodeData, ScheduleTriggerNodeData, SwitchNodeData, LoopNodeData, SetVariableNodeData, AggregateNodeData, ErrorHandlerNodeData, LogDebugNodeData, WaitForConditionNodeData, SubWorkflowNodeData, NodeRunStatus, WorkflowErrorConfig, Workflow } from '../types/workflow';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import type { RequestResult, Scenario } from '../../../shared/types';
import { TokenManager } from '../../../engine/tokenManager';
import { VariableContext } from './variableContext';
import { formatHttpNodeRunDetail, summarizeRequestFailure } from '../utils/workflowRunErrors';
import { humanizeError, toErrorMessage } from '../../../shared/utils/helpers';
import type { DebugController } from './debugController';
import {
  applyTemplateLiteralsFromMap,
  coerceStringMap,
  findStartNodes,
  collectReachableFromEdges,
  markSubtreeSkipped,
  executeHttpNode,
  evaluateCondition,
  classifyErrorType,
  matchesErrorFilter,
  evaluateWaitCondition,
} from './graphRunnerHelpers';

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

    try {
      if (isHttpWorkflowNode(node)) {
        const httpData = node.data as HttpNodeData;
        log({ prefix: '>', text: `[${nodeLabel(nodeId)}] ${httpData.scenario?.method ?? 'GET'} request...` });
        const result = await executeHttpNode(
          httpData,
          ctx,
          tokenManager,
          nodeId,
          initialVariables,
          resolveHttpBaseUrl,
          resolveHttpAuth,
        );
        results.push(result.requestResult);

        const status: NodeRunStatus = {
          state: result.requestResult.passed ? 'pass' : 'fail',
          statusCode: result.requestResult.httpStatus,
          responseTimeMs: result.requestResult.responseTimeMs,
          extracted: result.extracted,
          error: result.requestResult.passed ? undefined : summarizeRequestFailure(result.requestResult),
          responseDetail: formatHttpNodeRunDetail(result.requestResult, { fullResponseBody: result.fullResponseBody }),
        };
        if (!result.requestResult.passed) allPassed = false;
        const rr = result.requestResult;
        const label = nodeLabel(nodeId);

        // ── Request details ──
        log({ prefix: '>', text: `[${label}] ${rr.method} ${rr.url}` });
        const reqHdrEntries = Object.entries(result.requestHeaders);
        if (reqHdrEntries.length > 0) {
          for (const [k, v] of reqHdrEntries) {
            const display = /auth|token|key|secret|cookie/i.test(k) ? v.slice(0, 8) + '••••' : v;
            log({ prefix: '>', text: `[${label}]   ${k}: ${display}` });
          }
        }
        if (result.requestBody) {
          const bodyPreview = result.requestBody.length > 200 ? result.requestBody.slice(0, 200) + '…' : result.requestBody;
          log({ prefix: '>', text: `[${label}]   Body: ${bodyPreview}` });
        }

        // ── Response details ──
        const bodyLen = result.fullResponseBody?.length ?? 0;
        const bodySize = bodyLen < 1024 ? `${bodyLen}B` : `${(bodyLen / 1024).toFixed(1)}KB`;
        log({ prefix: '<', text: `[${label}] ${rr.httpStatus} — ${rr.responseTimeMs.toFixed(0)}ms — ${bodySize}` });
        const resHdrEntries = Object.entries(result.responseHeaders);
        if (resHdrEntries.length > 0) {
          for (const [k, v] of resHdrEntries) {
            log({ prefix: '<', text: `[${label}]   ${k}: ${v}` });
          }
        }
        if (result.fullResponseBody) {
          const respPreview = result.fullResponseBody.length > 300 ? result.fullResponseBody.slice(0, 300) + '…' : result.fullResponseBody;
          log({ prefix: '<', text: `[${label}]   Body: ${respPreview}` });
        }

        // ── Assertions ──
        if (rr.failureDetails && rr.failureDetails.length > 0 && !rr.passed) {
          for (const f of rr.failureDetails) {
            log({ prefix: '!', text: `[${label}] assertion ${f.path}: expected ${f.expected}, got ${f.actual}` });
          }
        }
        // ── Extracted variables ──
        if (result.extracted && Object.keys(result.extracted).length > 0) {
          for (const [k, v] of Object.entries(result.extracted)) {
            const display = v.length > 80 ? v.slice(0, 80) + '…' : v;
            log({ prefix: '#', text: `[${label}] ${k} = ${display}` });
          }
        }
        if (!rr.passed && !rr.failureDetails?.length) {
          log({ prefix: '!', text: `[${label}] ${humanizeError(status.error ?? 'request failed')}` });
        }
        callbacks.onNodeStateChange(nodeId, status);
        callbacks.onVariablesChange(ctx.snapshot());

        await visitOutgoing(nodeId);

      } else if (node.type === 'condition') {
        const data = node.data as ConditionNodeData;
        const resolvedLeft = ctx.resolve(data.left);
        const resolvedRight = ctx.resolve(data.right);
        const condResult = evaluateCondition(data, ctx);
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] ${resolvedLeft} ${data.operator} ${resolvedRight} → ${condResult ? 'Yes' : 'No'}` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        const matchesTakenBranch = (e: WorkflowEdge) =>
          condResult ? (e.sourceHandle === 'true' || e.label === 'Yes') : (e.sourceHandle === 'false' || e.label === 'No');
        const matchesSkippedBranch = (e: WorkflowEdge) =>
          condResult ? (e.sourceHandle === 'false' || e.label === 'No') : (e.sourceHandle === 'true' || e.label === 'Yes');

        const matchEdges = nextEdges.filter(matchesTakenBranch);
        const skipEdges = nextEdges.filter(matchesSkippedBranch);

        for (const e of skipEdges) {
          markSubtreeSkipped(e.target, outgoing, nodeMap, visited, callbacks, incomingCount);
        }
        // Run matched branches in parallel (like fork) when multiple edges share the same handle
        if (matchEdges.length > 1) {
          await Promise.all(matchEdges.map((e, i) =>
            visit(e.target, `${threadId}-cond-${i}`)
          ));
        } else {
          for (const e of matchEdges) {
            await visit(e.target, threadId);
          }
        }

      } else if (node.type === 'delay') {
        const data = node.data as DelayNodeData;
        const ms = data.mode === 'random'
          ? (data.minMs ?? 0) + Math.random() * ((data.maxMs ?? data.delayMs) - (data.minMs ?? 0))
          : data.delayMs;

        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Delay ${Math.round(ms)}ms...` });
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, ms);
          if (abortSignal) {
            const onAbort = () => { clearTimeout(timer); resolve(); };
            abortSignal.addEventListener('abort', onAbort, { once: true });
          }
        });

        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await visitOutgoing(nodeId);

      } else if (node.type === 'start') {
        // Seed variables from the Start node's inputVariables into the context.
        const data = node.data as StartNodeData;
        if (data.inputVariables) {
          for (const [k, v] of Object.entries(data.inputVariables)) {
            ctx.set(k, v);
          }
          callbacks.onVariablesChange(ctx.snapshot());
        }
        const varCount = Object.keys(data.inputVariables ?? {}).length;
        log({ prefix: '*', text: `[Start] Initialised${varCount > 0 ? ` with ${varCount} variable(s)` : ''}` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await visitOutgoing(nodeId);

      } else if (node.type === 'webhook') {
        // Webhook trigger: seed variables from simulated/actual webhook payload.
        // In simulate mode, variables come from workflow-level defaults or manual config.
        // Phase 5 will handle actual webhook server integration.
        const data = node.data as WebhookTriggerNodeData;
        // Extract variables from sample payload if configured
        if (data.extractVariables && data.extractVariables.length > 0) {
          try {
            const payload = JSON.parse(data.samplePayload || '{}');
            for (const { name, jsonPath } of data.extractVariables) {
              // Simple JSONPath extraction (e.g., $.event, $.data.id)
              const keys = jsonPath.replace(/^\$\./, '').split('.');
              let value: unknown = payload;
              for (const key of keys) {
                value = (value as Record<string, unknown>)?.[key];
                if (value === undefined) break;
              }
              if (value !== undefined) {
                ctx.set(name, String(value));
              }
            }
          } catch {
            // Invalid JSON in samplePayload - skip extraction
          }
        }
        callbacks.onVariablesChange(ctx.snapshot());
        log({ prefix: '*', text: `[Webhook Trigger] Seeded variables from sample payload` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await visitOutgoing(nodeId);

      } else if (node.type === 'schedule') {
        // Schedule trigger: seed variables with trigger time and any configured inputs.
        const data = node.data as ScheduleTriggerNodeData;
        // Add schedule-specific variables (matches cron-scheduler.ts behavior)
        const now = new Date();
        ctx.set('triggerTime', now.toISOString());
        ctx.set('triggerTimestamp', String(Math.floor(now.getTime() / 1000)));
        ctx.set('triggerDate', now.toISOString().split('T')[0]);
        ctx.set('triggerHour', String(now.getHours()));
        ctx.set('triggerMinute', String(now.getMinutes()));
        // Seed any configured input variables
        if (data.inputVariables) {
          for (const [k, v] of Object.entries(data.inputVariables)) {
            ctx.set(k, v);
          }
        }
        callbacks.onVariablesChange(ctx.snapshot());
        log({ prefix: '*', text: `[Schedule Trigger] Seeded trigger time variables` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await visitOutgoing(nodeId);

      } else if (node.type === 'fork') {
        // Fork node: execute all outgoing branches in parallel.
        const nextEdges = outgoing.get(nodeId) ?? [];
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Forking into ${nextEdges.length} branches` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await Promise.all(nextEdges.map((edge, i) =>
          visit(edge.target, `${threadId}-branch-${i}`)
        ));
      } else if (node.type === 'join') {
        // Join node: barrier already handled above — just pass through.
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] All branches joined` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await visitOutgoing(nodeId);

      } else if (node.type === 'switch') {
        const data = node.data as SwitchNodeData;
        const resolvedExpr = ctx.resolve(data.expression);
        const cases = data.cases ?? [];
        const matchedCase = cases.find(c => c.value === resolvedExpr);
        const matchHandle = matchedCase ? `case-${matchedCase.id}` : 'default';
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Switch "${resolvedExpr}" → ${matchedCase ? (matchedCase.label || matchedCase.value) : 'Default'}` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        const takenEdges = nextEdges.filter(e => e.sourceHandle === matchHandle);
        const skippedEdges = nextEdges.filter(e => e.sourceHandle !== matchHandle);

        for (const e of skippedEdges) {
          markSubtreeSkipped(e.target, outgoing, nodeMap, visited, callbacks, incomingCount);
        }
        for (const e of takenEdges) {
          await visit(e.target, threadId);
        }

      } else if (node.type === 'loop') {
        const data = node.data as LoopNodeData;
        const maxIter = data.maxIterations ?? 100;
        const nextEdges = outgoing.get(nodeId) ?? [];
        const bodyEdges = nextEdges.filter(e => e.sourceHandle === 'body');
        const doneEdges = nextEdges.filter(e => e.sourceHandle === 'done');

        // Collect all nodes reachable from the body handle (the loop body subgraph).
        const bodyNodeIds = collectReachableFromEdges(bodyEdges, outgoing, nodeMap, doneEdges.map(e => e.target));

        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Loop (${data.mode}) starting — body: ${bodyNodeIds.size} nodes` });
        callbacks.onNodeStateChange(nodeId, { state: 'running' });

        let iterations = 0;
        let items: unknown[] = [];

        if (data.mode === 'forEach') {
          const raw = ctx.resolve(data.sourceExpression ?? '');
          try { items = JSON.parse(raw); } catch { items = []; }
          if (!Array.isArray(items)) items = [];
        }

        // Pre-initialize index variable so while-mode conditions referencing it work on first check.
        const idxVar = data.indexVariable || 'i';
        ctx.set(idxVar, '0');
        callbacks.onVariablesChange(ctx.snapshot());

        const shouldContinue = (): boolean => {
          if (abortSignal?.aborted || debugController?.isStopped) return false;
          if (iterations >= maxIter) return false;
          switch (data.mode) {
            case 'count': {
              const countExpr = data.countExpression ? ctx.resolve(data.countExpression) : '';
              const total = countExpr ? parseInt(countExpr, 10) : (data.count ?? 1);
              return iterations < (isNaN(total) ? 1 : total);
            }
            case 'forEach':
              return iterations < items.length;
            case 'while':
              return evaluateCondition(
                { label: '', left: data.whileLeft ?? '', operator: data.whileOperator ?? '==', right: data.whileRight ?? '' },
                ctx,
              );
            default:
              return false;
          }
        };

        while (shouldContinue()) {
          ctx.set(idxVar, String(iterations));

          if (data.mode === 'forEach' && iterations < items.length) {
            const itemVar = data.itemVariable || 'item';
            const val = items[iterations];
            ctx.set(itemVar, typeof val === 'string' ? val : JSON.stringify(val));
          }
          callbacks.onVariablesChange(ctx.snapshot());

          // Clear visited state for body nodes so they re-execute this iteration.
          for (const bid of bodyNodeIds) {
            visited.delete(bid);
          }
          // Also reset join barriers within the loop body.
          for (const bid of bodyNodeIds) {
            joinArrived.delete(bid);
          }

          log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Iteration ${iterations}` });

          for (const e of bodyEdges) {
            await visit(e.target, `${threadId}-loop-${iterations}`);
          }

          iterations++;
          // Update the index variable so the next shouldContinue (while mode) sees the new value.
          ctx.set(idxVar, String(iterations));
        }

        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Loop complete — ${iterations} iteration(s)` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        // Follow the "done" edges after the loop.
        for (const e of doneEdges) {
          await visit(e.target, threadId);
        }

      } else if (node.type === 'setVariable') {
        const data = node.data as SetVariableNodeData;
        const assignments = data.assignments ?? [];
        for (const a of assignments) {
          if (a.name) {
            const resolved = ctx.resolve(a.expression);
            ctx.set(a.name, resolved);
          }
        }
        callbacks.onVariablesChange(ctx.snapshot());
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Set ${assignments.filter(a => a.name).length} variable(s)` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await visitOutgoing(nodeId);

      } else if (node.type === 'aggregate') {
        const data = node.data as AggregateNodeData;
        const mappings = data.mappings ?? [];
        for (const m of mappings) {
          if (!m.targetVariable) continue;
          const sourceVal = ctx.resolve(m.sourceExpression);
          let result: string;
          switch (m.strategy) {
            case 'concat': {
              // Append to existing array or start a new one
              const existing = ctx.resolve(`{{${m.targetVariable}}}`);
              let arr: unknown[];
              try { arr = JSON.parse(existing); } catch { arr = []; }
              if (!Array.isArray(arr)) arr = [];
              try { arr.push(JSON.parse(sourceVal)); } catch { arr.push(sourceVal); }
              result = JSON.stringify(arr);
              break;
            }
            case 'first': {
              const existing = ctx.resolve(`{{${m.targetVariable}}}`);
              // Keep existing if already set (not an unresolved template)
              result = existing !== `{{${m.targetVariable}}}` ? existing : sourceVal;
              break;
            }
            case 'last':
              result = sourceVal;
              break;
            case 'count': {
              const existing = ctx.resolve(`{{${m.targetVariable}}}`);
              const prev = parseInt(existing, 10);
              result = String((isNaN(prev) ? 0 : prev) + 1);
              break;
            }
            case 'sum': {
              const existing = ctx.resolve(`{{${m.targetVariable}}}`);
              const prev = parseFloat(existing);
              const add = parseFloat(sourceVal);
              result = String((isNaN(prev) ? 0 : prev) + (isNaN(add) ? 0 : add));
              break;
            }
            case 'custom':
              result = ctx.resolve(m.customExpression ?? sourceVal);
              break;
            default:
              result = sourceVal;
          }
          ctx.set(m.targetVariable, result);
        }
        callbacks.onVariablesChange(ctx.snapshot());
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Aggregated ${mappings.filter(m => m.targetVariable).length} mapping(s)` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await visitOutgoing(nodeId);

      } else if (node.type === 'errorHandler') {
        const data = node.data as ErrorHandlerNodeData;
        const nextEdges = outgoing.get(nodeId) ?? [];
        const bodyEdges = nextEdges.filter(e => e.sourceHandle === 'body');
        const catchEdges = nextEdges.filter(e => e.sourceHandle === 'catch');
        const doneEdges = nextEdges.filter(e => e.sourceHandle === 'done');

        const bodyNodeIds = collectReachableFromEdges(
          bodyEdges, outgoing, nodeMap,
          [...catchEdges.map(e => e.target), ...doneEdges.map(e => e.target)],
        );

        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Error Handler — body: ${bodyNodeIds.size} nodes, retry: ${data.retryCount ?? 0}` });
        callbacks.onNodeStateChange(nodeId, { state: 'running' });

        let succeeded = false;
        let lastError: { message: string; statusCode: number; nodeId: string; nodeLabel: string; type: string } | null = null;
        let attempt = 0;
        const retryStart = performance.now();
        const maxRetries = data.retryCount ?? 0;

        while (attempt <= maxRetries && !succeeded) {
          if (abortSignal?.aborted || debugController?.isStopped) break;

          // Check retry timeout
          if (data.retryTimeoutMs > 0 && attempt > 0) {
            const elapsed = performance.now() - retryStart;
            if (elapsed >= data.retryTimeoutMs) {
              log({ prefix: '!', text: `[${nodeLabel(nodeId)}] Retry timeout (${data.retryTimeoutMs}ms) exceeded` });
              break;
            }
          }

          // Clear visited state for body nodes on retry
          if (attempt > 0) {
            for (const bid of bodyNodeIds) {
              visited.delete(bid);
              joinArrived.delete(bid);
            }
          }

          const preResultCount = results.length;
          for (const e of bodyEdges) {
            await visit(e.target, `${threadId}-try-${attempt}`);
          }

          // Check if any body node failed
          const bodyResults = results.slice(preResultCount);
          const failedResult = bodyResults.find(r => !r.passed);

          if (!failedResult) {
            succeeded = true;
          } else {
            const errType = classifyErrorType(failedResult);
            lastError = {
              message: failedResult.errorMessage || summarizeRequestFailure(failedResult),
              statusCode: failedResult.httpStatus,
              nodeId: failedResult.scenarioId ?? '',
              nodeLabel: failedResult.scenarioName ?? '',
              type: errType,
            };

            // Check if error matches filter
            if (!matchesErrorFilter(errType, data.errorFilter)) {
              log({ prefix: '!', text: `[${nodeLabel(nodeId)}] Error type "${errType}" does not match filter "${data.errorFilter}" — not retrying` });
              break;
            }

            attempt++;
            if (attempt <= maxRetries) {
              const delay = data.retryBackoff === 'exponential'
                ? (data.retryDelayMs ?? 1000) * Math.pow(2, attempt - 1)
                : (data.retryDelayMs ?? 1000);
              log({ prefix: '!', text: `[${nodeLabel(nodeId)}] Retry ${attempt}/${maxRetries} in ${delay}ms...` });
              await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, delay);
                if (abortSignal) {
                  const onAbort = () => { clearTimeout(timer); resolve(); };
                  abortSignal.addEventListener('abort', onAbort, { once: true });
                }
              });
            }
          }
        }

        if (succeeded) {
          log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Body succeeded${attempt > 0 ? ` after ${attempt} retry(ies)` : ''}` });
          callbacks.onNodeStateChange(nodeId, { state: 'pass' });
          // Skip the catch path
          for (const e of catchEdges) {
            markSubtreeSkipped(e.target, outgoing, nodeMap, visited, callbacks, incomingCount);
          }
        } else {
          // Inject error variables into context
          if (lastError) {
            ctx.set('error.message', lastError.message);
            ctx.set('error.statusCode', String(lastError.statusCode));
            ctx.set('error.nodeId', lastError.nodeId);
            ctx.set('error.nodeLabel', lastError.nodeLabel);
            ctx.set('error.retryCount', String(Math.max(0, attempt - 1)));
            ctx.set('error.type', lastError.type);
            // Ensure httpStatus is available in catch path for conditions/logging
            ctx.set('httpStatus', String(lastError.statusCode));
          }
          callbacks.onVariablesChange(ctx.snapshot());
          log({ prefix: '!', text: `[${nodeLabel(nodeId)}] Body failed — executing catch path` });

          if (data.continueOnError) {
            callbacks.onNodeStateChange(nodeId, { state: 'pass', error: lastError?.message });
          } else {
            allPassed = false;
            callbacks.onNodeStateChange(nodeId, { state: 'fail', error: lastError?.message });
          }

          // Execute catch path
          for (const e of catchEdges) {
            await visit(e.target, `${threadId}-catch`);
          }
        }

        // Follow done edges
        for (const e of doneEdges) {
          await visit(e.target, threadId);
        }

      } else if (node.type === 'logDebug') {
        // ── Log/Debug node ──
        const data = node.data as LogDebugNodeData;
        const resolvedMessage = ctx.resolve(data.message || '');
        const levelPrefix = data.logLevel === 'error' ? '!' : data.logLevel === 'warn' ? '⚠' : data.logLevel === 'debug' ? '🐛' : 'ℹ';
        log({ prefix: levelPrefix, text: `[${nodeLabel(nodeId)}] [${data.logLevel.toUpperCase()}] ${resolvedMessage}` });

        // Warn about unresolved {{variables}} left in the message
        const unresolvedVars = resolvedMessage.match(/\{\{([^}]+)\}\}/g);
        if (unresolvedVars) {
          const names = unresolvedVars.map(m => m.slice(2, -2).trim());
          log({ prefix: '⚠', text: `[${nodeLabel(nodeId)}] Unresolved variable${names.length > 1 ? 's' : ''}: ${names.join(', ')} — not defined by any upstream step or extraction` });
        }

        if (data.snapshotVariables) {
          const snap = ctx.snapshot();
          const entries = Object.entries(snap).filter(([k]) => !k.startsWith('__'));
          if (entries.length > 0) {
            log({ prefix: '📋', text: `[${nodeLabel(nodeId)}] Variable snapshot (${entries.length}):` });
            for (const [k, v] of entries) {
              log({ prefix: ' ', text: `  ${k} = ${v.length > 80 ? v.slice(0, 77) + '…' : v}` });
            }
          }
        }

        callbacks.onNodeStateChange(nodeId, { state: 'pass' });
        await visitOutgoing(nodeId);

      } else if (node.type === 'waitForCondition') {
        // ── Wait for Condition node ──
        const data = node.data as WaitForConditionNodeData;
        const nextEdges = outgoing.get(nodeId) ?? [];
        const bodyEdges = nextEdges.filter(e => e.sourceHandle === 'body');
        const doneEdges = nextEdges.filter(e => e.sourceHandle === 'done');

        const bodyNodeIds = collectReachableFromEdges(
          bodyEdges, outgoing, nodeMap,
          [...doneEdges.map(e => e.target)],
        );

        log({ prefix: '⏳', text: `[${nodeLabel(nodeId)}] Polling — interval ${data.pollIntervalMs}ms, timeout ${data.timeoutMs}ms` });
        callbacks.onNodeStateChange(nodeId, { state: 'running' });

        let conditionMet = false;
        let attempt = 0;
        const pollStart = performance.now();

        while (!conditionMet) {
          if (abortSignal?.aborted || debugController?.isStopped) break;

          // Check timeout
          if (data.timeoutMs > 0) {
            const elapsed = performance.now() - pollStart;
            if (elapsed >= data.timeoutMs) {
              log({ prefix: '!', text: `[${nodeLabel(nodeId)}] Timeout after ${Math.round(elapsed)}ms` });
              break;
            }
          }

          // Check max attempts
          if (data.maxAttempts > 0 && attempt >= data.maxAttempts) {
            log({ prefix: '!', text: `[${nodeLabel(nodeId)}] Max attempts (${data.maxAttempts}) reached` });
            break;
          }

          // Clear visited state for body nodes on each poll
          if (attempt > 0) {
            for (const bid of bodyNodeIds) {
              visited.delete(bid);
              joinArrived.delete(bid);
            }
          }

          // Execute body (poll step)
          for (const e of bodyEdges) {
            await visit(e.target, `${threadId}-poll-${attempt}`);
          }
          attempt++;

          // Evaluate condition
          conditionMet = evaluateWaitCondition(data.conditionExpression, ctx);
          if (conditionMet) {
            log({ prefix: '✓', text: `[${nodeLabel(nodeId)}] Condition met after ${attempt} attempt(s)` });
            break;
          }

          // Wait before next poll
          log({ prefix: '⏳', text: `[${nodeLabel(nodeId)}] Attempt ${attempt} — condition not met, waiting ${data.pollIntervalMs}ms...` });
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, data.pollIntervalMs);
            if (abortSignal) {
              const onAbort = () => { clearTimeout(timer); resolve(); };
              abortSignal.addEventListener('abort', onAbort, { once: true });
            }
          });
        }

        // Set wait metadata variables
        const totalElapsed = Math.round(performance.now() - pollStart);
        ctx.set('wait.attempts', String(attempt));
        ctx.set('wait.elapsed', String(totalElapsed));
        ctx.set('wait.conditionMet', String(conditionMet));
        callbacks.onVariablesChange(ctx.snapshot());

        if (conditionMet) {
          callbacks.onNodeStateChange(nodeId, { state: 'pass' });
        } else {
          allPassed = false;
          callbacks.onNodeStateChange(nodeId, { state: 'fail', error: `Condition not met after ${attempt} attempt(s)` });
        }

        // Follow done edges
        for (const e of doneEdges) {
          await visit(e.target, threadId);
        }

      } else if (node.type === 'subWorkflow') {
        // ── Sub-Workflow node ──
        const data = node.data as SubWorkflowNodeData;

        // 1. Depth guard
        const currentDepth = parseInt(ctx.get('__subWorkflowDepth') ?? '0', 10) || 0;
        const maxDepth = data.maxDepth ?? 10;
        if (currentDepth >= maxDepth) {
          throw new Error(`Sub-workflow depth limit (${maxDepth}) exceeded`);
        }

        // 2. Resolve child workflow (support dynamic {{expression}} in workflowId)
        const resolvedWorkflowId = data.workflowId.includes('{{') ? ctx.resolve(data.workflowId) : data.workflowId;
        const childWorkflow = resolveSubWorkflow?.(resolvedWorkflowId);
        if (!childWorkflow) {
          throw new Error(`Sub-workflow "${data.workflowName || resolvedWorkflowId}" not found`);
        }

        // 3. Determine iteration items (multi-instance forEach or single run)
        let iterationItems: unknown[] | null = null;
        if (data.multiInstance?.collection) {
          const rawCollection = ctx.resolve(data.multiInstance.collection);
          try {
            const parsed = JSON.parse(rawCollection);
            if (!Array.isArray(parsed)) throw new Error('not an array');
            iterationItems = parsed;
          } catch {
            throw new Error(`Multi-instance collection "${data.multiInstance.collection}" did not resolve to a JSON array`);
          }
          if (iterationItems.length === 0) {
            log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Multi-instance collection is empty — skipping` });
            ctx.set('__subWorkflowResults', '[]');
            callbacks.onVariablesChange(ctx.snapshot());
            callbacks.onNodeStateChange(nodeId, { state: 'pass' });
            await visitOutgoing(nodeId);
            return;
          }
          log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Multi-instance (${data.multiInstance.mode}) — ${iterationItems.length} item(s) over "${childWorkflow.name}"` });
        } else {
          log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Executing sub-workflow "${childWorkflow.name}" (depth ${currentDepth + 1})` });
        }

        // Helper: execute one child run with retry support
        const executeOneChild = async (extraInputs: Record<string, string> = {}): Promise<{
          childResults: RequestResult[];
          childPassed: boolean;
          childFinalVars: Record<string, string>;
          childDurationMs: number;
          finalAttempt: number;
          childNodeStates: Record<string, NodeRunStatus>;
        }> => {
          // Build child input variables from mappings
          const childInputs: Record<string, string> = {};
          for (const m of data.inputMappings) {
            childInputs[m.targetVariable] = ctx.resolve(m.sourceExpression);
          }
          childInputs['__subWorkflowDepth'] = String(currentDepth + 1);
          Object.assign(childInputs, extraInputs);

          // Setup timeout if configured
          let childAbort: AbortController | undefined;
          let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
          if (data.timeoutMs && data.timeoutMs > 0) {
            childAbort = new AbortController();
            timeoutHandle = setTimeout(() => childAbort!.abort(), data.timeoutMs);
            if (abortSignal) {
              const onParentAbort = () => childAbort!.abort();
              abortSignal.addEventListener('abort', onParentAbort, { once: true });
            }
          }

          const maxRetries = data.retryCount ?? 0;
          const retryDelay = data.retryDelayMs ?? 1000;
          let childFinalVars: Record<string, string> = {};
          let childAllPassed = true;
          let childResults: RequestResult[] = [];
          let finalAttempt = 0;
          const childNodeStates: Record<string, NodeRunStatus> = {};
          const childStart = performance.now();

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
              log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Retry ${attempt}/${maxRetries} for sub-workflow "${childWorkflow.name}"` });
              if (retryDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }
            }

            childFinalVars = {};
            childAllPassed = true;
            for (const k of Object.keys(childNodeStates)) delete childNodeStates[k];
            const childCallbacks: GraphRunCallbacks = {
              onNodeStateChange: (nid, status) => { childNodeStates[nid] = status; },
              onVariablesChange: (vars) => { childFinalVars = vars; },
              onComplete: (_r, passed) => { childAllPassed = passed; },
              onLog: callbacks.onLog ? (line) => {
                callbacks.onLog?.({ ...line, text: `  [sub] ${line.text}` });
              } : undefined,
            };

            try {
              childResults = await runGraph(
                childWorkflow.nodes,
                childWorkflow.edges,
                childInputs,
                childCallbacks,
                childAbort?.signal ?? abortSignal,
                environmentLayer,
                resolveHttpBaseUrl,
                resolveHttpAuth,
                debugController,
                childWorkflow.errorConfig,
                resolveSubWorkflow,
              );
            } finally {
              if (timeoutHandle) clearTimeout(timeoutHandle);
            }

            finalAttempt = attempt;
            const passed = childAllPassed && childResults.every(r => r.passed);
            if (passed || attempt >= maxRetries) break;
          }

          const childDurationMs = performance.now() - childStart;
          const childPassed = childAllPassed && childResults.every(r => r.passed);
          return { childResults, childPassed, childFinalVars, childDurationMs, finalAttempt, childNodeStates };
        };

        // 4. Execute — single or multi-instance
        let aggregateResults: RequestResult[] = [];
        let aggregatePassed = true;
        let singleChildFinalVars: Record<string, string> = {};
        let singleChildDurationMs = 0;
        let singleFinalAttempt = 0;
        let singleChildNodeStates: Record<string, NodeRunStatus> = {};

        if (iterationItems) {
          // ── Multi-instance execution ──
          const mi = data.multiInstance!;
          const perItemResults: Array<{ passed: boolean; vars: Record<string, string> }> = [];

          const runOneItem = async (item: unknown, idx: number) => {
            const elementStr = typeof item === 'string' ? item : JSON.stringify(item);
            log({ prefix: '*', text: `[${nodeLabel(nodeId)}] forEach [${idx + 1}/${iterationItems!.length}] ${mi.elementVariable}=${elementStr.slice(0, 80)}` });
            const extra: Record<string, string> = {
              [mi.elementVariable]: elementStr,
              __subWorkflowIndex: String(idx),
            };
            const run = await executeOneChild(extra);
            aggregateResults.push(...run.childResults);
            if (!run.childPassed) aggregatePassed = false;
            perItemResults[idx] = { passed: run.childPassed, vars: run.childFinalVars };

            // Fire per-iteration callback
            if (callbacks.onSubWorkflowComplete) {
              const childSteps = childWorkflow.nodes
                .filter(n => run.childNodeStates[n.id] && n.type === 'http')
                .map(n => {
                  const rs = run.childNodeStates[n.id];
                  return {
                    nodeId: n.id,
                    label: (n.data as { label?: string }).label || n.id,
                    state: rs.state === 'pass' ? 'pass' as const : rs.state === 'fail' ? 'fail' as const : 'skipped' as const,
                    statusCode: rs.statusCode,
                    responseTimeMs: rs.responseTimeMs,
                    error: rs.error,
                  };
                });
              callbacks.onSubWorkflowComplete({
                parentNodeId: nodeId,
                childWorkflowName: `${childWorkflow.name} [${idx + 1}/${iterationItems!.length}]`,
                passed: run.childPassed,
                durationMs: run.childDurationMs,
                resultCount: run.childResults.length,
                childSteps,
                attempt: run.finalAttempt,
              });
            }
          };

          if (mi.mode === 'parallel') {
            await Promise.all(iterationItems.map((item, idx) => runOneItem(item, idx)));
          } else {
            for (let idx = 0; idx < iterationItems.length; idx++) {
              await runOneItem(iterationItems[idx], idx);
            }
          }

          // Store aggregated per-item results as __subWorkflowResults
          ctx.set('__subWorkflowResults', JSON.stringify(perItemResults.map(r => ({ passed: r.passed, vars: r.vars }))));
          callbacks.onVariablesChange(ctx.snapshot());

        } else {
          // ── Single execution ──
          const run = await executeOneChild();
          aggregateResults = run.childResults;
          aggregatePassed = run.childPassed;
          singleChildFinalVars = run.childFinalVars;
          singleChildDurationMs = run.childDurationMs;
          singleFinalAttempt = run.finalAttempt;
          singleChildNodeStates = run.childNodeStates;

          // Map child outputs back to parent context (single mode only)
          for (const m of data.outputMappings) {
            const val = singleChildFinalVars[m.sourceVariable] ?? '';
            ctx.set(m.targetVariable, val);
          }
          if (data.propagateAllOutputs) {
            for (const [k, v] of Object.entries(singleChildFinalVars)) {
              if (!k.startsWith('__')) ctx.set(k, v);
            }
          }
          callbacks.onVariablesChange(ctx.snapshot());

          // Fire sub-workflow completion callback (single mode)
          if (callbacks.onSubWorkflowComplete) {
            const childSteps = childWorkflow.nodes
              .filter(n => singleChildNodeStates[n.id] && n.type === 'http')
              .map(n => {
                const rs = singleChildNodeStates[n.id];
                return {
                  nodeId: n.id,
                  label: (n.data as { label?: string }).label || n.id,
                  state: rs.state === 'pass' ? 'pass' as const : rs.state === 'fail' ? 'fail' as const : 'skipped' as const,
                  statusCode: rs.statusCode,
                  responseTimeMs: rs.responseTimeMs,
                  error: rs.error,
                };
              });
            callbacks.onSubWorkflowComplete({
              parentNodeId: nodeId,
              childWorkflowName: childWorkflow.name,
              passed: aggregatePassed,
              durationMs: singleChildDurationMs,
              resultCount: aggregateResults.length,
              childSteps,
              attempt: singleFinalAttempt,
            });
          }
        }

        // 5. Aggregate child results into parent
        results.push(...aggregateResults);
        const onFailure = data.onChildFailure ?? 'fail';

        if (!aggregatePassed && onFailure === 'continue') {
          ctx.set('__subWorkflowFailed', 'true');
          callbacks.onVariablesChange(ctx.snapshot());
          log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Sub-workflow "${childWorkflow.name}" failed but continuing (onChildFailure=continue)` });
          callbacks.onNodeStateChange(nodeId, { state: 'pass' });
        } else {
          if (!aggregatePassed) allPassed = false;
          log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Sub-workflow "${childWorkflow.name}" ${aggregatePassed ? 'passed' : 'failed'} — ${aggregateResults.length} result(s)` });
          callbacks.onNodeStateChange(nodeId, { state: aggregatePassed ? 'pass' : 'fail' });
        }

        await visitOutgoing(nodeId);

      } else if (node.type === 'end') {
        // End node: terminal — mark pass (no outgoing edges).
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });
      }
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
