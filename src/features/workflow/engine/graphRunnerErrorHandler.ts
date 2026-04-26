/**
 * Handler for ErrorHandler nodes — extracted from graphRunnerNodeHandlers.ts
 * to keep file sizes manageable.
 */
import type { WorkflowNode } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlers';
import {
  collectReachableFromEdges,
  markSubtreeSkipped,
  classifyErrorType,
  matchesErrorFilter,
} from './graphRunnerHelpers';
import { summarizeRequestFailure } from '../utils/workflowRunErrors';

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
