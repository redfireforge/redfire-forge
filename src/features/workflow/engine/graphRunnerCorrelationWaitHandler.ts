/**
 * Handler for CorrelationWait nodes — pause/resume on external webhook callbacks.
 */
import type { WorkflowNode, CorrelationWaitNodeData } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import { serializeWorkflowState } from './workflowStateSerializer';
import {
  injectWebhookPayload,
  createAbortPromise,
  calculateSyntheticDelay,
  waitWithAbort,
  getMockPayload,
} from './correlationWaitHelpers';
import { toErrorMessage } from '../../../shared/utils/helpers';

export async function handleCorrelationWaitNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as CorrelationWaitNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // Resolve correlation ID from expression (e.g. "{{paymentId}}" → "pay_123")
  let correlationId = hCtx.ctx.resolve(data.correlationIdExpression);
  if (!correlationId) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Correlation ID expression resolved to empty string` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Correlation ID expression resolved to empty string' });
    return;
  }

  const runnerConfig = hCtx.correlationWaitConfig;
  const effectiveMode = runnerConfig?.mode ?? 'wait-for-real';

  // In load test mode with synthetic inject, make correlation ID unique per iteration
  // to avoid conflicts when the same workflow variable is used across iterations.
  if (hCtx.loadTestMode && effectiveMode === 'synthetic-inject') {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    correlationId = `${correlationId}-${uniqueSuffix}`;
  }

  const waitStartTime = Date.now();

  // ── Load Test Mode: Auto-Resume ──
  if (hCtx.loadTestMode && effectiveMode === 'auto-resume') {
    const mockPayload = getMockPayload(nodeId, runnerConfig?.mockPayloads, data.loadTestBehavior?.mockPayload);
    hCtx.log({ prefix: '*', text: `[${label}] Auto-resume mode — skipping wait, injecting mock payload` });

    injectWebhookPayload(mockPayload, correlationId, data, hCtx.ctx, hCtx.log, label);
    hCtx.ctx.set('__cwWaitDurationMs', String(Date.now() - waitStartTime));
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // ── Load Test Mode: Synthetic Inject ──
  if (hCtx.loadTestMode && effectiveMode === 'synthetic-inject') {
    // Fallback: inline delay when no store
    if (!hCtx.correlationStore) {
      const mockPayload = getMockPayload(nodeId, runnerConfig?.mockPayloads, data.loadTestBehavior?.mockPayload);
      const actualDelay = calculateSyntheticDelay(runnerConfig?.syntheticDelayMs ?? 0, runnerConfig?.syntheticJitterMs);

      hCtx.log({ prefix: '*', text: `[${label}] Synthetic inject (inline) — waiting ${Math.round(actualDelay)}ms` });
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'paused', responseDetail: `Synthetic wait ${Math.round(actualDelay)}ms` });

      const completed = await waitWithAbort(actualDelay, hCtx.abortSignal);
      if (!completed) {
        hCtx.log({ prefix: '!', text: `[${label}] Synthetic inject aborted` });
        hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
        return;
      }

      injectWebhookPayload(mockPayload, correlationId, data, hCtx.ctx, hCtx.log, label);
      hCtx.ctx.set('__cwWaitDurationMs', String(Date.now() - waitStartTime));
      hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
      await hCtx.visitOutgoing(nodeId, hCtx.threadId);
      return;
    }

    // Store-based flow: pause in store, injector resumes after delay
    hCtx.log({ prefix: '*', text: `[${label}] Synthetic inject — pausing for background injector (correlationId=${correlationId})` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'paused', responseDetail: `Waiting for synthetic event` });

    const pausedState = serializeWorkflowState(hCtx, nodeId, hCtx.executionId ?? `exec-${Date.now()}`, hCtx.workflowId ?? 'unknown', hCtx.startTime ?? Date.now());

    try {
      const abortPromise = createAbortPromise(hCtx.abortSignal);
      const effectiveTimeout = data.timeoutMs ?? 300000;
      const waitPromise = hCtx.correlationStore.pause(correlationId, data.webhookPath, pausedState, effectiveTimeout, data.webhookFilter);
      const webhookData = abortPromise ? await Promise.race([waitPromise, abortPromise]) : await waitPromise;

      injectWebhookPayload(webhookData, correlationId, data, hCtx.ctx, hCtx.log, label);
      hCtx.ctx.set('__cwWebhookPayload', JSON.stringify(webhookData));
      hCtx.ctx.set('__cwWaitDurationMs', String(Date.now() - waitStartTime));
      hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
      hCtx.log({ prefix: '*', text: `[${label}] Synthetic inject complete — workflow resumed` });
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
      await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    } catch (err) {
      if (hCtx.abortSignal?.aborted) {
        hCtx.log({ prefix: '!', text: `[${label}] Correlation wait aborted` });
        hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
      } else {
        passed.value = false;
        const msg = toErrorMessage(err);
        hCtx.log({ prefix: '!', text: `[${label}] Synthetic inject failed: ${msg}` });
        hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
      }
    }
    return;
  }

  // ── Normal Mode: Wait for Real Webhook ──
  if (!hCtx.correlationStore) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] No correlation store available` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'No correlation store configured' });
    return;
  }

  hCtx.log({ prefix: '*', text: `[${label}] Pausing — waiting for webhook at ${data.webhookPath} (correlationId=${correlationId})` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'paused', responseDetail: `Waiting for ${correlationId}` });

  const pausedState = serializeWorkflowState(hCtx, nodeId, hCtx.executionId ?? `exec-${Date.now()}`, hCtx.workflowId ?? 'unknown', hCtx.startTime ?? Date.now());

  try {
    const abortPromise = createAbortPromise(hCtx.abortSignal);
    const waitPromise = hCtx.correlationStore.pause(
      correlationId, data.webhookPath, pausedState, data.timeoutMs, data.webhookFilter,
      { correlationSource: data.correlationSource, correlationJsonPath: data.correlationJsonPath, correlationHeader: data.correlationHeader, correlationQueryParam: data.correlationQueryParam },
    );
    const webhookData = abortPromise ? await Promise.race([waitPromise, abortPromise]) : await waitPromise;

    injectWebhookPayload(webhookData, correlationId, data, hCtx.ctx, hCtx.log, label);
    hCtx.ctx.set('__cwWebhookPayload', JSON.stringify(webhookData));
    hCtx.ctx.set('__cwWaitDurationMs', String(Date.now() - waitStartTime));
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    const timeStr = data.timeoutMs > 0 ? ` (within ${data.timeoutMs}ms timeout)` : '';
    hCtx.log({ prefix: '*', text: `[${label}] Resumed — webhook received${timeStr}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    hCtx.correlationStore?.cancel(correlationId);
    const isAbort = hCtx.abortSignal?.aborted || hCtx.debugController?.isStopped;
    if (isAbort) {
      hCtx.log({ prefix: '!', text: `[${label}] Correlation wait aborted` });
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
      return;
    }
    passed.value = false;
    const msg = toErrorMessage(err);
    hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}
