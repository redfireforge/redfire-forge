/**
 * Handlers for LogDebug and WaitForCondition nodes.
 */
import type {
  WorkflowNode, LogDebugNodeData, WaitForConditionNodeData,
} from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import { collectReachableFromEdges, evaluateWaitCondition } from './graphRunnerHelpers';

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

    // Throttle concurrent polls across iterations using semaphore (if provided)
    if (hCtx.pollSemaphore) {
      await hCtx.pollSemaphore.acquire();
    }
    try {
      for (const e of bodyEdges) {
        hCtx.traceCollector.onEdgeTraversed(e.id);
        await hCtx.visit(e.target, `${hCtx.threadId}-poll-${attempt}`);
      }
    } finally {
      if (hCtx.pollSemaphore) {
        hCtx.pollSemaphore.release();
      }
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
    hCtx.traceCollector.onEdgeTraversed(e.id);
    await hCtx.visit(e.target, hCtx.threadId);
  }
}
