/**
 * Node-type handlers extracted from graphRunner.ts visit() function.
 * Each handler implements the execution logic for a single node type.
 */
import type {
  WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData,
  DelayNodeData, StartNodeData, WebhookTriggerNodeData,
  ScheduleTriggerNodeData, SwitchNodeData, LoopNodeData,
  SetVariableNodeData, AggregateNodeData, LogDebugNodeData,
  WaitForConditionNodeData, ScriptNodeData, NodeRunStatus,
  Workflow,
} from '../types/workflow';
import type { RequestResult, Scenario } from '../../../shared/types';
import type { VariableContext } from './variableContext';
import type { TokenManager } from '../../../engine/tokenManager';
import type { DebugController } from './debugController';
import type { GraphRunCallbacks } from './graphRunner';
import { formatHttpNodeRunDetail, summarizeRequestFailure } from '../utils/workflowRunErrors';
import { humanizeError } from '../../../shared/utils/helpers';
import {
  executeHttpNode,
  evaluateCondition,
  collectReachableFromEdges,
  markSubtreeSkipped,
  classifyErrorType,
  matchesErrorFilter,
  evaluateWaitCondition,
} from './graphRunnerHelpers';
import { executeScript } from './scriptSandbox';
import { loadScriptLibraries, buildLibraryPreamble } from './scriptLibraries';

// ────────────────────────────────────────────────────────
// Shared context passed to every handler
// ────────────────────────────────────────────────────────

export interface NodeHandlerContext {
  /** All nodes in the workflow */
  nodeMap: Map<string, WorkflowNode>;
  /** Outgoing edges per node */
  outgoing: Map<string, WorkflowEdge[]>;
  /** Variable context */
  ctx: VariableContext;
  /** Token manager for auth */
  tokenManager: TokenManager;
  /** Accumulated results */
  results: RequestResult[];
  /** Whether all nodes have passed so far */
  allPassed: boolean;
  /** Set of visited node IDs */
  visited: Set<string>;
  /** Join barrier arrival counts */
  joinArrived: Map<string, number>;
  /** Expected incoming edge counts per node */
  incomingCount: Map<string, number>;
  /** Callbacks for UI updates */
  callbacks: GraphRunCallbacks;
  /** Abort signal */
  abortSignal?: AbortSignal;
  /** Initial variables */
  initialVariables: Record<string, string>;
  /** Environment layer */
  environmentLayer?: Record<string, string>;
  /** Base URL resolver */
  resolveHttpBaseUrl?: (data: HttpNodeData) => string | undefined;
  /** Auth profile resolver */
  resolveHttpAuth?: (data: HttpNodeData) => Scenario['auth'] | undefined;
  /** Debug controller */
  debugController?: DebugController;
  /** Sub-workflow resolver */
  resolveSubWorkflow?: (workflowId: string) => Workflow | undefined;
  /** Log helper */
  log: (line: { prefix: '' | '*' | '>' | '<' | '#' | '!'; text: string }) => void;
  /** Node label resolver */
  nodeLabel: (id: string) => string;
  /** Visit a node (recursive call back into visit) */
  visit: (nodeId: string, threadId?: string) => Promise<void>;
  /** Visit all outgoing edges from a node */
  visitOutgoing: (nodeId: string, threadId: string) => Promise<void>;
  /** Current thread ID */
  threadId: string;
}

/** Mutable flag container so handlers can set allPassed = false */
export interface PassedFlag {
  value: boolean;
}

// ────────────────────────────────────────────────────────
// Handler: HTTP node
// ────────────────────────────────────────────────────────

export async function handleHttpNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const httpData = node.data as HttpNodeData;
  hCtx.log({ prefix: '>', text: `[${hCtx.nodeLabel(nodeId)}] ${httpData.scenario?.method ?? 'GET'} request...` });
  const result = await executeHttpNode(
    httpData,
    hCtx.ctx,
    hCtx.tokenManager,
    nodeId,
    hCtx.initialVariables,
    hCtx.resolveHttpBaseUrl,
    hCtx.resolveHttpAuth,
  );
  hCtx.results.push(result.requestResult);

  const status: NodeRunStatus = {
    state: result.requestResult.passed ? 'pass' : 'fail',
    statusCode: result.requestResult.httpStatus,
    responseTimeMs: result.requestResult.responseTimeMs,
    extracted: result.extracted,
    error: result.requestResult.passed ? undefined : summarizeRequestFailure(result.requestResult),
    responseDetail: formatHttpNodeRunDetail(result.requestResult, { fullResponseBody: result.fullResponseBody }),
  };
  if (!result.requestResult.passed) passed.value = false;
  const rr = result.requestResult;
  const label = hCtx.nodeLabel(nodeId);

  // ── Request details ──
  hCtx.log({ prefix: '>', text: `[${label}] ${rr.method} ${rr.url}` });
  const reqHdrEntries = Object.entries(result.requestHeaders);
  if (reqHdrEntries.length > 0) {
    for (const [k, v] of reqHdrEntries) {
      const display = /auth|token|key|secret|cookie/i.test(k) ? v.slice(0, 8) + '••••' : v;
      hCtx.log({ prefix: '>', text: `[${label}]   ${k}: ${display}` });
    }
  }
  if (result.requestBody) {
    const bodyPreview = result.requestBody.length > 200 ? result.requestBody.slice(0, 200) + '…' : result.requestBody;
    hCtx.log({ prefix: '>', text: `[${label}]   Body: ${bodyPreview}` });
  }

  // ── Response details ──
  const bodyLen = result.fullResponseBody?.length ?? 0;
  const bodySize = bodyLen < 1024 ? `${bodyLen}B` : `${(bodyLen / 1024).toFixed(1)}KB`;
  hCtx.log({ prefix: '<', text: `[${label}] ${rr.httpStatus} — ${rr.responseTimeMs.toFixed(0)}ms — ${bodySize}` });
  const resHdrEntries = Object.entries(result.responseHeaders);
  if (resHdrEntries.length > 0) {
    for (const [k, v] of resHdrEntries) {
      hCtx.log({ prefix: '<', text: `[${label}]   ${k}: ${v}` });
    }
  }
  if (result.fullResponseBody) {
    const respPreview = result.fullResponseBody.length > 300 ? result.fullResponseBody.slice(0, 300) + '…' : result.fullResponseBody;
    hCtx.log({ prefix: '<', text: `[${label}]   Body: ${respPreview}` });
  }

  // ── Assertions ──
  if (rr.failureDetails && rr.failureDetails.length > 0 && !rr.passed) {
    for (const f of rr.failureDetails) {
      hCtx.log({ prefix: '!', text: `[${label}] assertion ${f.path}: expected ${f.expected}, got ${f.actual}` });
    }
  }
  // ── Extracted variables ──
  if (result.extracted && Object.keys(result.extracted).length > 0) {
    for (const [k, v] of Object.entries(result.extracted)) {
      const display = v.length > 80 ? v.slice(0, 80) + '…' : v;
      hCtx.log({ prefix: '#', text: `[${label}] ${k} = ${display}` });
    }
  }
  if (!rr.passed && !rr.failureDetails?.length) {
    hCtx.log({ prefix: '!', text: `[${label}] ${humanizeError(status.error ?? 'request failed')}` });
  }
  hCtx.callbacks.onNodeStateChange(nodeId, status);
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: Condition node
// ────────────────────────────────────────────────────────

export async function handleConditionNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as ConditionNodeData;
  const resolvedLeft = hCtx.ctx.resolve(data.left);
  const resolvedRight = hCtx.ctx.resolve(data.right);
  const condResult = evaluateCondition(data, hCtx.ctx);
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] ${resolvedLeft} ${data.operator} ${resolvedRight} → ${condResult ? 'Yes' : 'No'}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });

  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  const matchesTakenBranch = (e: WorkflowEdge) =>
    condResult ? (e.sourceHandle === 'true' || e.label === 'Yes') : (e.sourceHandle === 'false' || e.label === 'No');
  const matchesSkippedBranch = (e: WorkflowEdge) =>
    condResult ? (e.sourceHandle === 'false' || e.label === 'No') : (e.sourceHandle === 'true' || e.label === 'Yes');

  const matchEdges = nextEdges.filter(matchesTakenBranch);
  const skipEdges = nextEdges.filter(matchesSkippedBranch);

  for (const e of skipEdges) {
    markSubtreeSkipped(e.target, hCtx.outgoing, hCtx.nodeMap, hCtx.visited, hCtx.callbacks, hCtx.incomingCount);
  }
  if (matchEdges.length > 1) {
    await Promise.all(matchEdges.map((e, i) =>
      hCtx.visit(e.target, `${hCtx.threadId}-cond-${i}`)
    ));
  } else {
    for (const e of matchEdges) {
      await hCtx.visit(e.target, hCtx.threadId);
    }
  }
}

// ────────────────────────────────────────────────────────
// Handler: Delay node
// ────────────────────────────────────────────────────────

export async function handleDelayNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as DelayNodeData;
  const ms = data.mode === 'random'
    ? (data.minMs ?? 0) + Math.random() * ((data.maxMs ?? data.delayMs) - (data.minMs ?? 0))
    : data.delayMs;

  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Delay ${Math.round(ms)}ms...` });
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (hCtx.abortSignal) {
      const onAbort = () => { clearTimeout(timer); resolve(); };
      hCtx.abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  });

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: Start node
// ────────────────────────────────────────────────────────

export async function handleStartNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as StartNodeData;
  if (data.inputVariables) {
    for (const [k, v] of Object.entries(data.inputVariables)) {
      hCtx.ctx.set(k, v);
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  }
  const varCount = Object.keys(data.inputVariables ?? {}).length;
  hCtx.log({ prefix: '*', text: `[Start] Initialised${varCount > 0 ? ` with ${varCount} variable(s)` : ''}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: Webhook Trigger node
// ────────────────────────────────────────────────────────

export async function handleWebhookNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as WebhookTriggerNodeData;
  if (data.extractVariables && data.extractVariables.length > 0) {
    try {
      const payload = JSON.parse(data.samplePayload || '{}');
      for (const { name, jsonPath } of data.extractVariables) {
        const keys = jsonPath.replace(/^\$\./, '').split('.');
        let value: unknown = payload;
        for (const key of keys) {
          value = (value as Record<string, unknown>)?.[key];
          if (value === undefined) break;
        }
        if (value !== undefined) {
          hCtx.ctx.set(name, String(value));
        }
      }
    } catch {
      // Invalid JSON in samplePayload - skip extraction
    }
  }
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[Webhook Trigger] Seeded variables from sample payload` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: Schedule Trigger node
// ────────────────────────────────────────────────────────

export async function handleScheduleNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as ScheduleTriggerNodeData;
  const now = new Date();
  hCtx.ctx.set('triggerTime', now.toISOString());
  hCtx.ctx.set('triggerTimestamp', String(Math.floor(now.getTime() / 1000)));
  hCtx.ctx.set('triggerDate', now.toISOString().split('T')[0]);
  hCtx.ctx.set('triggerHour', String(now.getHours()));
  hCtx.ctx.set('triggerMinute', String(now.getMinutes()));
  if (data.inputVariables) {
    for (const [k, v] of Object.entries(data.inputVariables)) {
      hCtx.ctx.set(k, v);
    }
  }
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[Schedule Trigger] Seeded trigger time variables` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: Fork node
// ────────────────────────────────────────────────────────

export async function handleForkNode(
  nodeId: string,
  _node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Forking into ${nextEdges.length} branches` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await Promise.all(nextEdges.map((edge, i) =>
    hCtx.visit(edge.target, `${hCtx.threadId}-branch-${i}`)
  ));
}

// ────────────────────────────────────────────────────────
// Handler: Join node
// ────────────────────────────────────────────────────────

export async function handleJoinNode(
  nodeId: string,
  _node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] All branches joined` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: Switch node
// ────────────────────────────────────────────────────────

export async function handleSwitchNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as SwitchNodeData;
  const resolvedExpr = hCtx.ctx.resolve(data.expression);
  const cases = data.cases ?? [];
  const matchedCase = cases.find(c => c.value === resolvedExpr);
  const matchHandle = matchedCase ? `case-${matchedCase.id}` : 'default';
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Switch "${resolvedExpr}" → ${matchedCase ? (matchedCase.label || matchedCase.value) : 'Default'}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });

  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  const takenEdges = nextEdges.filter(e => e.sourceHandle === matchHandle);
  const skippedEdges = nextEdges.filter(e => e.sourceHandle !== matchHandle);

  for (const e of skippedEdges) {
    markSubtreeSkipped(e.target, hCtx.outgoing, hCtx.nodeMap, hCtx.visited, hCtx.callbacks, hCtx.incomingCount);
  }
  for (const e of takenEdges) {
    await hCtx.visit(e.target, hCtx.threadId);
  }
}

// ────────────────────────────────────────────────────────
// Handler: Loop node
// ────────────────────────────────────────────────────────

export async function handleLoopNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as LoopNodeData;
  const maxIter = data.maxIterations ?? 100;
  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  const bodyEdges = nextEdges.filter(e => e.sourceHandle === 'body');
  const doneEdges = nextEdges.filter(e => e.sourceHandle === 'done');

  const bodyNodeIds = collectReachableFromEdges(bodyEdges, hCtx.outgoing, hCtx.nodeMap, doneEdges.map(e => e.target));

  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Loop (${data.mode}) starting — body: ${bodyNodeIds.size} nodes` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  let iterations = 0;
  let items: unknown[] = [];

  if (data.mode === 'forEach') {
    const raw = hCtx.ctx.resolve(data.sourceExpression ?? '');
    try { items = JSON.parse(raw); } catch { items = []; }
    if (!Array.isArray(items)) items = [];
  }

  const idxVar = data.indexVariable || 'i';
  hCtx.ctx.set(idxVar, '0');
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

  const shouldContinue = (): boolean => {
    if (hCtx.abortSignal?.aborted || hCtx.debugController?.isStopped) return false;
    if (iterations >= maxIter) return false;
    switch (data.mode) {
      case 'count': {
        const countExpr = data.countExpression ? hCtx.ctx.resolve(data.countExpression) : '';
        const total = countExpr ? parseInt(countExpr, 10) : (data.count ?? 1);
        return iterations < (isNaN(total) ? 1 : total);
      }
      case 'forEach':
        return iterations < items.length;
      case 'while':
        return evaluateCondition(
          { label: '', left: data.whileLeft ?? '', operator: data.whileOperator ?? '==', right: data.whileRight ?? '' },
          hCtx.ctx,
        );
      default:
        return false;
    }
  };

  while (shouldContinue()) {
    hCtx.ctx.set(idxVar, String(iterations));

    if (data.mode === 'forEach' && iterations < items.length) {
      const itemVar = data.itemVariable || 'item';
      const val = items[iterations];
      hCtx.ctx.set(itemVar, typeof val === 'string' ? val : JSON.stringify(val));
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    for (const bid of bodyNodeIds) {
      hCtx.visited.delete(bid);
    }
    for (const bid of bodyNodeIds) {
      hCtx.joinArrived.delete(bid);
    }

    hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Iteration ${iterations}` });

    for (const e of bodyEdges) {
      await hCtx.visit(e.target, `${hCtx.threadId}-loop-${iterations}`);
    }

    iterations++;
    hCtx.ctx.set(idxVar, String(iterations));
  }

  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Loop complete — ${iterations} iteration(s)` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });

  for (const e of doneEdges) {
    await hCtx.visit(e.target, hCtx.threadId);
  }
}

// ────────────────────────────────────────────────────────
// Handler: SetVariable node
// ────────────────────────────────────────────────────────

export async function handleSetVariableNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as SetVariableNodeData;
  const assignments = data.assignments ?? [];
  for (const a of assignments) {
    if (a.name) {
      const resolved = hCtx.ctx.resolve(a.expression);
      hCtx.ctx.set(a.name, resolved);
    }
  }
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Set ${assignments.filter(a => a.name).length} variable(s)` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: Script node
// ────────────────────────────────────────────────────────

export async function handleScriptNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as ScriptNodeData;
  hCtx.log({ prefix: '#', text: `[${hCtx.nodeLabel(nodeId)}] Executing script (${data.mode})...` });

  const inputVars: Record<string, string> = {};
  for (const varName of data.inputVariables) {
    inputVars[varName] = hCtx.ctx.resolve(`{{${varName}}}`);
  }

  const result = executeScript(data, inputVars,
    data.libraryIds?.length ? buildLibraryPreamble(loadScriptLibraries(), data.libraryIds) : undefined,
  );

  if (data.captureConsole) {
    for (const line of result.consoleLogs) {
      hCtx.log({ prefix: '#', text: `[${hCtx.nodeLabel(nodeId)}] console: ${line}` });
    }
  }

  if (!result.success) {
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state: 'fail',
      error: result.error,
      responseDetail: result.error,
    });
    passed.value = false;
  } else {
    for (const [k, v] of Object.entries(result.outputs)) {
      hCtx.ctx.set(k, v);
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state: 'pass',
      responseDetail: JSON.stringify(result.outputs, null, 2),
    });
  }

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: Aggregate node
// ────────────────────────────────────────────────────────

export async function handleAggregateNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as AggregateNodeData;
  const mappings = data.mappings ?? [];
  for (const m of mappings) {
    if (!m.targetVariable) continue;
    const sourceVal = hCtx.ctx.resolve(m.sourceExpression);
    let result: string;
    switch (m.strategy) {
      case 'concat': {
        const existing = hCtx.ctx.resolve(`{{${m.targetVariable}}}`);
        let arr: unknown[];
        try { arr = JSON.parse(existing); } catch { arr = []; }
        if (!Array.isArray(arr)) arr = [];
        try { arr.push(JSON.parse(sourceVal)); } catch { arr.push(sourceVal); }
        result = JSON.stringify(arr);
        break;
      }
      case 'first': {
        const existing = hCtx.ctx.resolve(`{{${m.targetVariable}}}`);
        result = existing !== `{{${m.targetVariable}}}` ? existing : sourceVal;
        break;
      }
      case 'last':
        result = sourceVal;
        break;
      case 'count': {
        const existing = hCtx.ctx.resolve(`{{${m.targetVariable}}}`);
        const prev = parseInt(existing, 10);
        result = String((isNaN(prev) ? 0 : prev) + 1);
        break;
      }
      case 'sum': {
        const existing = hCtx.ctx.resolve(`{{${m.targetVariable}}}`);
        const prev = parseFloat(existing);
        const add = parseFloat(sourceVal);
        result = String((isNaN(prev) ? 0 : prev) + (isNaN(add) ? 0 : add));
        break;
      }
      case 'custom':
        result = hCtx.ctx.resolve(m.customExpression ?? sourceVal);
        break;
      default:
        result = sourceVal;
    }
    hCtx.ctx.set(m.targetVariable, result);
  }
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Aggregated ${mappings.filter(m => m.targetVariable).length} mapping(s)` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: LogDebug node
// ────────────────────────────────────────────────────────

export async function handleLogDebugNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as LogDebugNodeData;
  const resolvedMessage = hCtx.ctx.resolve(data.message || '');
  const levelPrefix = data.logLevel === 'error' ? '!' : data.logLevel === 'warn' ? '⚠' : data.logLevel === 'debug' ? '🐛' : 'ℹ';
  hCtx.log({ prefix: levelPrefix, text: `[${hCtx.nodeLabel(nodeId)}] [${data.logLevel.toUpperCase()}] ${resolvedMessage}` });

  const unresolvedVars = resolvedMessage.match(/\{\{([^}]+)\}\}/g);
  if (unresolvedVars) {
    const names = unresolvedVars.map(m => m.slice(2, -2).trim());
    hCtx.log({ prefix: '⚠', text: `[${hCtx.nodeLabel(nodeId)}] Unresolved variable${names.length > 1 ? 's' : ''}: ${names.join(', ')} — not defined by any upstream step or extraction` });
  }

  if (data.snapshotVariables) {
    const snap = hCtx.ctx.snapshot();
    const entries = Object.entries(snap).filter(([k]) => !k.startsWith('__'));
    if (entries.length > 0) {
      hCtx.log({ prefix: '📋', text: `[${hCtx.nodeLabel(nodeId)}] Variable snapshot (${entries.length}):` });
      for (const [k, v] of entries) {
        hCtx.log({ prefix: ' ', text: `  ${k} = ${v.length > 80 ? v.slice(0, 77) + '…' : v}` });
      }
    }
  }

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ────────────────────────────────────────────────────────
// Handler: WaitForCondition node
// ────────────────────────────────────────────────────────

export async function handleWaitForConditionNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as WaitForConditionNodeData;
  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  const bodyEdges = nextEdges.filter(e => e.sourceHandle === 'body');
  const doneEdges = nextEdges.filter(e => e.sourceHandle === 'done');

  const bodyNodeIds = collectReachableFromEdges(
    bodyEdges, hCtx.outgoing, hCtx.nodeMap,
    [...doneEdges.map(e => e.target)],
  );

  hCtx.log({ prefix: '⏳', text: `[${hCtx.nodeLabel(nodeId)}] Polling — interval ${data.pollIntervalMs}ms, timeout ${data.timeoutMs}ms` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  let conditionMet = false;
  let attempt = 0;
  const pollStart = performance.now();

  while (!conditionMet) {
    if (hCtx.abortSignal?.aborted || hCtx.debugController?.isStopped) break;

    if (data.timeoutMs > 0) {
      const elapsed = performance.now() - pollStart;
      if (elapsed >= data.timeoutMs) {
        hCtx.log({ prefix: '!', text: `[${hCtx.nodeLabel(nodeId)}] Timeout after ${Math.round(elapsed)}ms` });
        break;
      }
    }

    if (data.maxAttempts > 0 && attempt >= data.maxAttempts) {
      hCtx.log({ prefix: '!', text: `[${hCtx.nodeLabel(nodeId)}] Max attempts (${data.maxAttempts}) reached` });
      break;
    }

    if (attempt > 0) {
      for (const bid of bodyNodeIds) {
        hCtx.visited.delete(bid);
        hCtx.joinArrived.delete(bid);
      }
    }

    for (const e of bodyEdges) {
      await hCtx.visit(e.target, `${hCtx.threadId}-poll-${attempt}`);
    }
    attempt++;

    conditionMet = evaluateWaitCondition(data.conditionExpression, hCtx.ctx);
    if (conditionMet) {
      hCtx.log({ prefix: '✓', text: `[${hCtx.nodeLabel(nodeId)}] Condition met after ${attempt} attempt(s)` });
      break;
    }

    hCtx.log({ prefix: '⏳', text: `[${hCtx.nodeLabel(nodeId)}] Attempt ${attempt} — condition not met, waiting ${data.pollIntervalMs}ms...` });
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, data.pollIntervalMs);
      if (hCtx.abortSignal) {
        const onAbort = () => { clearTimeout(timer); resolve(); };
        hCtx.abortSignal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  const totalElapsed = Math.round(performance.now() - pollStart);
  hCtx.ctx.set('wait.attempts', String(attempt));
  hCtx.ctx.set('wait.elapsed', String(totalElapsed));
  hCtx.ctx.set('wait.conditionMet', String(conditionMet));
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

  if (conditionMet) {
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  } else {
    passed.value = false;
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: `Condition not met after ${attempt} attempt(s)` });
  }

  for (const e of doneEdges) {
    await hCtx.visit(e.target, hCtx.threadId);
  }
}

// ────────────────────────────────────────────────────────
// Handler: ErrorHandler node
// ────────────────────────────────────────────────────────

export async function handleErrorHandlerNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as import('../types/workflow').ErrorHandlerNodeData;
  const nextEdges = hCtx.outgoing.get(nodeId) ?? [];
  const bodyEdges = nextEdges.filter(e => e.sourceHandle === 'body');
  const catchEdges = nextEdges.filter(e => e.sourceHandle === 'catch');
  const doneEdges = nextEdges.filter(e => e.sourceHandle === 'done');

  const bodyNodeIds = collectReachableFromEdges(
    bodyEdges, hCtx.outgoing, hCtx.nodeMap,
    [...catchEdges.map(e => e.target), ...doneEdges.map(e => e.target)],
  );

  hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Error Handler — body: ${bodyNodeIds.size} nodes, retry: ${data.retryCount ?? 0}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  let succeeded = false;
  let lastError: { message: string; statusCode: number; nodeId: string; nodeLabel: string; type: string } | null = null;
  let attempt = 0;
  const retryStart = performance.now();
  const maxRetries = data.retryCount ?? 0;

  while (attempt <= maxRetries && !succeeded) {
    if (hCtx.abortSignal?.aborted || hCtx.debugController?.isStopped) break;

    if (data.retryTimeoutMs > 0 && attempt > 0) {
      const elapsed = performance.now() - retryStart;
      if (elapsed >= data.retryTimeoutMs) {
        hCtx.log({ prefix: '!', text: `[${hCtx.nodeLabel(nodeId)}] Retry timeout (${data.retryTimeoutMs}ms) exceeded` });
        break;
      }
    }

    if (attempt > 0) {
      for (const bid of bodyNodeIds) {
        hCtx.visited.delete(bid);
        hCtx.joinArrived.delete(bid);
      }
    }

    const preResultCount = hCtx.results.length;
    for (const e of bodyEdges) {
      await hCtx.visit(e.target, `${hCtx.threadId}-try-${attempt}`);
    }

    const bodyResults = hCtx.results.slice(preResultCount);
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

      if (!matchesErrorFilter(errType, data.errorFilter)) {
        hCtx.log({ prefix: '!', text: `[${hCtx.nodeLabel(nodeId)}] Error type "${errType}" does not match filter "${data.errorFilter}" — not retrying` });
        break;
      }

      attempt++;
      if (attempt <= maxRetries) {
        const delay = data.retryBackoff === 'exponential'
          ? (data.retryDelayMs ?? 1000) * Math.pow(2, attempt - 1)
          : (data.retryDelayMs ?? 1000);
        hCtx.log({ prefix: '!', text: `[${hCtx.nodeLabel(nodeId)}] Retry ${attempt}/${maxRetries} in ${delay}ms...` });
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          if (hCtx.abortSignal) {
            const onAbort = () => { clearTimeout(timer); resolve(); };
            hCtx.abortSignal.addEventListener('abort', onAbort, { once: true });
          }
        });
      }
    }
  }

  if (succeeded) {
    hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Body succeeded${attempt > 0 ? ` after ${attempt} retry(ies)` : ''}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    for (const e of catchEdges) {
      markSubtreeSkipped(e.target, hCtx.outgoing, hCtx.nodeMap, hCtx.visited, hCtx.callbacks, hCtx.incomingCount);
    }
  } else {
    if (lastError) {
      hCtx.ctx.set('error.message', lastError.message);
      hCtx.ctx.set('error.statusCode', String(lastError.statusCode));
      hCtx.ctx.set('error.nodeId', lastError.nodeId);
      hCtx.ctx.set('error.nodeLabel', lastError.nodeLabel);
      hCtx.ctx.set('error.retryCount', String(Math.max(0, attempt - 1)));
      hCtx.ctx.set('error.type', lastError.type);
      hCtx.ctx.set('httpStatus', String(lastError.statusCode));
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.log({ prefix: '!', text: `[${hCtx.nodeLabel(nodeId)}] Body failed — executing catch path` });

    if (data.continueOnError) {
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass', error: lastError?.message });
    } else {
      passed.value = false;
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: lastError?.message });
    }

    for (const e of catchEdges) {
      await hCtx.visit(e.target, `${hCtx.threadId}-catch`);
    }
  }

  for (const e of doneEdges) {
    await hCtx.visit(e.target, hCtx.threadId);
  }
}

// ────────────────────────────────────────────────────────
// Handler: SubWorkflow node
// ────────────────────────────────────────────────────────

export async function handleSubWorkflowNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
  /** Recursive reference to runGraph for child execution */
  runGraph: (...args: Parameters<typeof import('./graphRunner').runGraph>) => ReturnType<typeof import('./graphRunner').runGraph>,
): Promise<void> {
  const data = node.data as import('../types/workflow').SubWorkflowNodeData;

  // 1. Depth guard
  const currentDepth = parseInt(hCtx.ctx.get('__subWorkflowDepth') ?? '0', 10) || 0;
  const maxDepth = data.maxDepth ?? 10;
  if (currentDepth >= maxDepth) {
    throw new Error(`Sub-workflow depth limit (${maxDepth}) exceeded`);
  }

  // 2. Resolve child workflow
  const resolvedWorkflowId = data.workflowId.includes('{{') ? hCtx.ctx.resolve(data.workflowId) : data.workflowId;
  const childWorkflow = hCtx.resolveSubWorkflow?.(resolvedWorkflowId);
  if (!childWorkflow) {
    throw new Error(`Sub-workflow "${data.workflowName || resolvedWorkflowId}" not found`);
  }

  // 3. Determine iteration items
  let iterationItems: unknown[] | null = null;
  if (data.multiInstance?.collection) {
    const rawCollection = hCtx.ctx.resolve(data.multiInstance.collection);
    try {
      const parsed = JSON.parse(rawCollection);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      iterationItems = parsed;
    } catch {
      throw new Error(`Multi-instance collection "${data.multiInstance.collection}" did not resolve to a JSON array`);
    }
    if (iterationItems.length === 0) {
      hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Multi-instance collection is empty — skipping` });
      hCtx.ctx.set('__subWorkflowResults', '[]');
      hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
      await hCtx.visitOutgoing(nodeId, hCtx.threadId);
      return;
    }
    hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Multi-instance (${data.multiInstance.mode}) — ${iterationItems.length} item(s) over "${childWorkflow.name}"` });
  } else {
    hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Executing sub-workflow "${childWorkflow.name}" (depth ${currentDepth + 1})` });
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
    const childInputs: Record<string, string> = {};
    for (const m of data.inputMappings) {
      childInputs[m.targetVariable] = hCtx.ctx.resolve(m.sourceExpression);
    }
    childInputs['__subWorkflowDepth'] = String(currentDepth + 1);
    Object.assign(childInputs, extraInputs);

    let childAbort: AbortController | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (data.timeoutMs && data.timeoutMs > 0) {
      childAbort = new AbortController();
      timeoutHandle = setTimeout(() => childAbort!.abort(), data.timeoutMs);
      if (hCtx.abortSignal) {
        const onParentAbort = () => childAbort!.abort();
        hCtx.abortSignal.addEventListener('abort', onParentAbort, { once: true });
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
        hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Retry ${attempt}/${maxRetries} for sub-workflow "${childWorkflow.name}"` });
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
        onComplete: (_r, p) => { childAllPassed = p; },
        onLog: hCtx.callbacks.onLog ? (line) => {
          hCtx.callbacks.onLog?.({ ...line, text: `  [sub] ${line.text}` });
        } : undefined,
      };

      try {
        childResults = await runGraph(
          childWorkflow.nodes,
          childWorkflow.edges,
          childInputs,
          childCallbacks,
          childAbort?.signal ?? hCtx.abortSignal,
          hCtx.environmentLayer,
          hCtx.resolveHttpBaseUrl,
          hCtx.resolveHttpAuth,
          hCtx.debugController,
          childWorkflow.errorConfig,
          hCtx.resolveSubWorkflow,
        );
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }

      finalAttempt = attempt;
      const p = childAllPassed && childResults.every(r => r.passed);
      if (p || attempt >= maxRetries) break;
    }

    const childDurationMs = performance.now() - childStart;
    const childPassed = childAllPassed && childResults.every(r => r.passed);
    return { childResults, childPassed, childFinalVars, childDurationMs, finalAttempt, childNodeStates };
  };

  // Helper to build child steps summary for callback
  const buildChildSteps = (childNodeStates: Record<string, NodeRunStatus>) =>
    childWorkflow.nodes
      .filter(n => childNodeStates[n.id] && n.type === 'http')
      .map(n => {
        const rs = childNodeStates[n.id];
        return {
          nodeId: n.id,
          label: (n.data as { label?: string }).label || n.id,
          state: rs.state === 'pass' ? 'pass' as const : rs.state === 'fail' ? 'fail' as const : 'skipped' as const,
          statusCode: rs.statusCode,
          responseTimeMs: rs.responseTimeMs,
          error: rs.error,
        };
      });

  // 4. Execute
  let aggregateResults: RequestResult[] = [];
  let aggregatePassed = true;

  if (iterationItems) {
    // ── Multi-instance execution ──
    const mi = data.multiInstance!;
    const perItemResults: Array<{ passed: boolean; vars: Record<string, string> }> = [];

    const runOneItem = async (item: unknown, idx: number) => {
      const elementStr = typeof item === 'string' ? item : JSON.stringify(item);
      hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] forEach [${idx + 1}/${iterationItems!.length}] ${mi.elementVariable}=${elementStr.slice(0, 80)}` });
      const extra: Record<string, string> = {
        [mi.elementVariable]: elementStr,
        __subWorkflowIndex: String(idx),
      };
      const run = await executeOneChild(extra);
      aggregateResults.push(...run.childResults);
      if (!run.childPassed) aggregatePassed = false;
      perItemResults[idx] = { passed: run.childPassed, vars: run.childFinalVars };

      if (hCtx.callbacks.onSubWorkflowComplete) {
        hCtx.callbacks.onSubWorkflowComplete({
          parentNodeId: nodeId,
          childWorkflowName: `${childWorkflow.name} [${idx + 1}/${iterationItems!.length}]`,
          passed: run.childPassed,
          durationMs: run.childDurationMs,
          resultCount: run.childResults.length,
          childSteps: buildChildSteps(run.childNodeStates),
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

    hCtx.ctx.set('__subWorkflowResults', JSON.stringify(perItemResults.map(r => ({ passed: r.passed, vars: r.vars }))));
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

  } else {
    // ── Single execution ──
    const run = await executeOneChild();
    aggregateResults = run.childResults;
    aggregatePassed = run.childPassed;

    for (const m of data.outputMappings) {
      const val = run.childFinalVars[m.sourceVariable] ?? '';
      hCtx.ctx.set(m.targetVariable, val);
    }
    if (data.propagateAllOutputs) {
      for (const [k, v] of Object.entries(run.childFinalVars)) {
        if (!k.startsWith('__')) hCtx.ctx.set(k, v);
      }
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    if (hCtx.callbacks.onSubWorkflowComplete) {
      hCtx.callbacks.onSubWorkflowComplete({
        parentNodeId: nodeId,
        childWorkflowName: childWorkflow.name,
        passed: aggregatePassed,
        durationMs: run.childDurationMs,
        resultCount: aggregateResults.length,
        childSteps: buildChildSteps(run.childNodeStates),
        attempt: run.finalAttempt,
      });
    }
  }

  // 5. Aggregate child results
  hCtx.results.push(...aggregateResults);
  const onFailure = data.onChildFailure ?? 'fail';

  if (!aggregatePassed && onFailure === 'continue') {
    hCtx.ctx.set('__subWorkflowFailed', 'true');
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Sub-workflow "${childWorkflow.name}" failed but continuing (onChildFailure=continue)` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  } else {
    if (!aggregatePassed) passed.value = false;
    hCtx.log({ prefix: '*', text: `[${hCtx.nodeLabel(nodeId)}] Sub-workflow "${childWorkflow.name}" ${aggregatePassed ? 'passed' : 'failed'} — ${aggregateResults.length} result(s)` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: aggregatePassed ? 'pass' : 'fail' });
  }

  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}
