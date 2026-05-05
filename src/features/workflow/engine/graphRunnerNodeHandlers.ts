/**
 * Node-type handlers extracted from graphRunner.ts visit() function.
 * Each handler implements the execution logic for a single node type.
 */
import type {
  WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData,
  DelayNodeData, StartNodeData, WebhookTriggerNodeData,
  ScheduleTriggerNodeData, SwitchNodeData, LoopNodeData,
  SetVariableNodeData, AggregateNodeData, LogDebugNodeData,
  WaitForConditionNodeData, ScriptNodeData, CorrelationWaitNodeData,
  NodeRunStatus, Workflow,
} from '../types/workflow';
import type { ICorrelationStore } from './correlationStore';
import { serializeWorkflowState } from './workflowStateSerializer';
import type { RequestResult, Scenario } from '../../../shared/types';
import { expandDataSource, resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
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
  evaluateWaitCondition,
  extractPayloadVariables,
  logHttpResult,
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
  log: (line: { prefix: string; text: string }) => void;
  /** Node label resolver */
  nodeLabel: (id: string) => string;
  /** Visit a node (recursive call back into visit) */
  visit: (nodeId: string, threadId?: string) => Promise<void>;
  /** Visit all outgoing edges from a node */
  visitOutgoing: (nodeId: string, threadId: string) => Promise<void>;
  /** Current thread ID */
  threadId: string;
  /** Correlation store for pause/resume (optional — only needed for correlationWait nodes). */
  correlationStore?: ICorrelationStore;
  /** Execution ID for current workflow run. */
  executionId?: string;
  /** Workflow ID. */
  workflowId?: string;
  /** Workflow start time (ms since epoch). */
  startTime?: number;
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
  const dataSource = httpData.dataSource ?? httpData.scenario?.dataSource;
  const enabledRows = dataSource?.rows?.filter(r => r.enabled) ?? [];

  // ── Data-source expansion: execute once per enabled row ──
  if (dataSource && dataSource.columns.length > 0 && enabledRows.length > 0) {
    hCtx.log({ prefix: '>', text: `[${hCtx.nodeLabel(nodeId)}] Expanding data source → ${enabledRows.length} row(s)` });
    const baseScenario: Scenario = { ...httpData.scenario, dataSource };
    const expandedScenarios = expandDataSource(baseScenario);

    let anyFailed = false;
    for (const expanded of expandedScenarios) {
      hCtx.log({ prefix: '>', text: `[${hCtx.nodeLabel(nodeId)}] ${expanded.dataRowLabel ?? 'row'}: ${expanded.method} request...` });
      const expandedData: HttpNodeData = { ...httpData, scenario: expanded };
      const result = await executeHttpNode(
        expandedData,
        hCtx.ctx,
        hCtx.tokenManager,
        nodeId,
        hCtx.initialVariables,
        hCtx.resolveHttpBaseUrl,
        hCtx.resolveHttpAuth,
      );
      hCtx.results.push(result.requestResult);
      if (!result.requestResult.passed) {
        anyFailed = true;
        passed.value = false;
      }
      logHttpResult(hCtx.nodeLabel(nodeId), hCtx.log, result);
    }

    const state = anyFailed ? 'fail' : 'pass';
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state,
      statusCode: undefined,
      responseTimeMs: undefined,
    });
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // ── Single request (no data source) ──
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

  logHttpResult(hCtx.nodeLabel(nodeId), hCtx.log, result);

  if (!result.requestResult.passed && !result.requestResult.failureDetails?.length) {
    hCtx.log({ prefix: '!', text: `[${hCtx.nodeLabel(nodeId)}] ${humanizeError(status.error ?? 'request failed')}` });
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
      extractPayloadVariables(payload, data.extractVariables, hCtx.ctx);
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
    // Check for inline data source first
    if (data.dataSource) {
      const enabledRows = data.dataSource.rows.filter(r => r.enabled);
      items = enabledRows.map(row => {
        const obj: Record<string, string> = {};
        for (const col of data.dataSource!.columns) {
          obj[col.name] = row.values[col.id] ?? '';
        }
        return obj;
      });
    }
    if (items.length === 0) {
      const raw = hCtx.ctx.resolve(data.sourceExpression ?? '');
      try { items = JSON.parse(raw); } catch { items = []; }
      if (!Array.isArray(items)) items = [];
    }
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
// Handler: CorrelationWait node
// ────────────────────────────────────────────────────────

export async function handleCorrelationWaitNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as CorrelationWaitNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // Resolve correlation ID from expression (e.g. "{{paymentId}}" → "pay_123")
  const correlationId = hCtx.ctx.resolve(data.correlationIdExpression);
  if (!correlationId) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Correlation ID expression resolved to empty string` });
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state: 'fail',
      error: 'Correlation ID expression resolved to empty string',
    });
    return;
  }

  if (!hCtx.correlationStore) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] No correlation store available` });
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state: 'fail',
      error: 'No correlation store configured',
    });
    return;
  }

  hCtx.log({ prefix: '*', text: `[${label}] Pausing — waiting for webhook at ${data.webhookPath} (correlationId=${correlationId})` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'paused', responseDetail: `Waiting for ${correlationId}` });

  // Serialize current workflow state
  const pausedState = serializeWorkflowState(
    hCtx,
    nodeId,
    hCtx.executionId ?? `exec-${Date.now()}`,
    hCtx.workflowId ?? 'unknown',
    hCtx.startTime ?? Date.now(),
  );

  try {
    // Pause and wait for webhook callback, but race against abort signal
    const abortPromise = hCtx.abortSignal
      ? new Promise<never>((_, reject) => {
          if (hCtx.abortSignal!.aborted) {
            reject(new Error('Workflow run aborted'));
            return;
          }
          hCtx.abortSignal!.addEventListener('abort', () => reject(new Error('Workflow run aborted')), { once: true });
        })
      : null;

    const waitPromise = hCtx.correlationStore.pause(
      correlationId,
      data.webhookPath,
      pausedState,
      data.timeoutMs,
      data.webhookFilter,
      {
        correlationSource: data.correlationSource,
        correlationJsonPath: data.correlationJsonPath,
        correlationHeader: data.correlationHeader,
        correlationQueryParam: data.correlationQueryParam,
      },
    );

    const webhookData = abortPromise
      ? await Promise.race([waitPromise, abortPromise])
      : await waitPromise;

    // Inject webhook payload variables into context
    hCtx.ctx.set('webhook.body', JSON.stringify(webhookData));
    hCtx.ctx.set('webhook.correlationId', correlationId);

    // Extract variables from webhook payload
    if (data.extractVariables && data.extractVariables.length > 0) {
      const extracted = extractPayloadVariables(webhookData, data.extractVariables, hCtx.ctx);
      for (const [name, strVal] of Object.entries(extracted)) {
        hCtx.log({ prefix: '#', text: `[${label}] ${name} = ${strVal.length > 80 ? strVal.slice(0, 80) + '…' : strVal}` });
      }
    }

    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    const timeStr = data.timeoutMs > 0 ? ` (within ${data.timeoutMs}ms timeout)` : '';
    hCtx.log({ prefix: '*', text: `[${label}] Resumed — webhook received${timeStr}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });

    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    // Cancel the inflight correlation wait so the long-poll stops
    hCtx.correlationStore?.cancel(correlationId);

    const isAbort = hCtx.abortSignal?.aborted || hCtx.debugController?.isStopped;
    if (isAbort) {
      hCtx.log({ prefix: '!', text: `[${label}] Correlation wait aborted` });
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
      return;
    }

    passed.value = false;
    const msg = err instanceof Error ? err.message : String(err);
    hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}

// ────────────────────────────────────────────────────────
// Re-export extracted handlers for backward compatibility
// ────────────────────────────────────────────────────────
export { handleErrorHandlerNode } from './graphRunnerErrorHandler';
export { handleSubWorkflowNode } from './graphRunnerSubWorkflowHandler';

