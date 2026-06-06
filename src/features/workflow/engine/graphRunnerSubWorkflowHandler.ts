/**
 * Handler for SubWorkflow nodes — extracted from graphRunnerNodeHandlers.ts
 * to keep file sizes manageable.
 */
import type { WorkflowNode, NodeRunStatus } from '../types/workflow';
import type { RequestResult, WorkflowIterationTrace, WorkflowExecutionTrace } from '../../../shared/types';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlers';
import type { GraphRunCallbacks } from './graphRunner';

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
    childIterationTrace?: WorkflowIterationTrace;
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
    let childIterationTrace: WorkflowIterationTrace | undefined;
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
      childIterationTrace = undefined;
      for (const k of Object.keys(childNodeStates)) delete childNodeStates[k];
      const childCallbacks: GraphRunCallbacks = {
        onNodeStateChange: (nid, status) => { childNodeStates[nid] = status; },
        onVariablesChange: (vars) => { childFinalVars = vars; },
        onComplete: (_r, p, _d, trace) => { childAllPassed = p; childIterationTrace = trace; },
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
          undefined, // correlationStore
          hCtx.loadTestMode,
          undefined, // correlationWaitConfig
          undefined, // pollSemaphore
          hCtx.traceOptions,
          undefined, // httpTimeoutMs
          hCtx.kafkaOperations,
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
    return { childResults, childPassed, childFinalVars, childDurationMs, finalAttempt, childNodeStates, childIterationTrace };
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
  const childIterationTraces: WorkflowIterationTrace[] = [];

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
      if (run.childIterationTrace) {
        childIterationTraces.push({ ...run.childIterationTrace, index: idx });
      }

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
    if (run.childIterationTrace) {
      childIterationTraces.push({ ...run.childIterationTrace, index: 0 });
    }

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

  // Build sub-workflow trace for drill-down in Results Explorer
  if (childIterationTraces.length > 0 && hCtx.capturedSubWorkflowTraces) {
    const totalDurationMs = childIterationTraces.reduce((sum, t) => sum + t.durationMs, 0);
    const traversedEdges = [...new Set(childIterationTraces.flatMap(t => t.traversedEdges))];
    const childTrace: WorkflowExecutionTrace = {
      iterations: childIterationTraces,
      traversedEdges,
      workflowSnapshot: {
        nodes: childWorkflow.nodes,
        edges: childWorkflow.edges,
      },
      workflowId: childWorkflow.id,
      workflowName: childWorkflow.name,
      totalIterations: childIterationTraces.length,
      totalDurationMs,
      fullTraceCaptured: hCtx.traceOptions?.captureFullTrace,
    };
    hCtx.capturedSubWorkflowTraces.set(nodeId, childTrace);
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
