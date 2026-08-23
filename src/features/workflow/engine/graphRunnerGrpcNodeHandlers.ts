/**
 * Handlers for gRPC workflow nodes (Phase 6C/6D/6E/6G):
 *   grpcUnary        — unary call with retry policy
 *   grpcServerStream — bounded server-stream collector
 *   grpcAssert       — assertion evaluation over frozen step results
 */
import type { WorkflowNode } from '../types/workflow';
import type {
  GrpcAssertNodeData,
  GrpcServerStreamNodeData,
  GrpcUnaryNodeData,
  GrpcWorkflowStepResult,
} from '../types/workflow/node-grpc';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import type { GrpcResultMeta, RequestResult, FailureDetail } from '@shared/types';
import { toErrorMessage, truncate } from '@shared/utils/helpers';
import { nextResultId } from '@engine/core/requestExecution';
import { buildGrpcWorkflowExecuteSnapshot } from '../utils/grpcWorkflowSnapshotBuilder';
import { createGrpcWorkflowNodeSnapshotContext } from '../utils/grpcWorkflowRuntimeContext';
import { publishGrpcWorkflowStepOutput } from '../utils/grpcWorkflowStepOutput';
import { executeGrpcWorkflowUnary, wrapUnaryInvokeWithAbort } from '../utils/grpcWorkflowUnaryExecutor';
import { grpcWorkflowSnapshotToStreamStartRequest } from '../utils/grpcWorkflowTransportAdapter';
import type { GrpcWorkflowStreamStopReason } from '../utils/grpcWorkflowStreamCollector';
import { evaluateGrpcWorkflowAssertions } from '../utils/grpcWorkflowAssertEngine';
import { buildGrpcNodeStatusMeta, formatGrpcNodeRunDetail } from '../utils/grpcWorkflowOutputAdapter';
import {
  logGrpcAssertUpstream,
  logGrpcAssertionResults,
  logGrpcCallResponse,
  logGrpcRequestBody,
  logGrpcRequestMetadata,
  logGrpcSaveAs,
} from './graphRunnerGrpcLogHelpers';

const MAX_BODY_PREVIEW = 512;

function validateGrpcOps(
  nodeId: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
) {
  if (!hCtx.grpcOperations) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] No gRPC operations available` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'gRPC operations not configured' });
    return null;
  }
  return hCtx.grpcOperations;
}

function buildGrpcResult(
  nodeId: string,
  label: string,
  transportType: 'grpcUnary' | 'grpcServerStream' | 'grpcAssert',
  target: string,
  durationMs: number,
  passed: boolean,
  grpcResultMeta?: GrpcResultMeta,
  errorMessage?: string,
  failureDetails: FailureDetail[] = [],
): RequestResult {
  return {
    id: nextResultId(),
    scenarioId: nodeId,
    scenarioName: label,
    url: transportType === 'grpcAssert' ? `grpc://assert/${nodeId}` : `grpc://${target}`,
    method: transportType === 'grpcUnary' ? 'UNARY' : transportType === 'grpcServerStream' ? 'SERVER_STREAM' : 'ASSERT',
    httpStatus: passed ? 200 : 0,
    responseTimeMs: durationMs,
    responseBody: '',
    timestamp: Date.now(),
    passed,
    validationMode: 'none',
    failureDetails,
    workflowNodeId: nodeId,
    transportType,
    grpcResultMeta,
    errorMessage,
  };
}

function publishOptions(hCtx: NodeHandlerContext) {
  return {
    stepStore: hCtx.grpcStepResultStore,
    outputRegistry: hCtx.grpcOutputRegistry,
  };
}

function commitGrpcStepResult(
  hCtx: NodeHandlerContext,
  snapshot: import('../types/workflow/grpcWorkflowSnapshot').GrpcWorkflowExecuteSnapshot,
  stepResult: GrpcWorkflowStepResult,
): void {
  hCtx.grpcStepResultStore?.commit(snapshot.nodeId, snapshot.saveAs, stepResult);
}

async function finishGrpcAssertFailure(
  nodeId: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
  onError: 'fail' | 'continue',
  errorMessage: string,
  durationMs: number,
  source?: string,
  assertionFailures?: string[],
  upstream?: GrpcWorkflowStepResult,
): Promise<void> {
  passed.value = false;
  const failureDetails: FailureDetail[] = (assertionFailures ?? [errorMessage]).map((msg, index) => ({
    path: assertionFailures ? `assertions[${index}]` : '(assert)',
    expected: 'pass',
    actual: msg,
  }));
  hCtx.results.push(buildGrpcResult(
    nodeId,
    label,
    'grpcAssert',
    source ?? '',
    durationMs,
    false,
    {
      service: '',
      method: 'ASSERT',
      target: source ?? '',
      assertionFailures: assertionFailures ?? [errorMessage],
    },
    errorMessage,
    failureDetails,
  ));
  hCtx.log({ prefix: '!', text: `[${label}] ${errorMessage}` });

  const failureList = assertionFailures ?? [errorMessage];
  const stepForMeta: GrpcWorkflowStepResult = upstream
    ? { ...upstream, assertionFailures: failureList, status: 'failed' }
    : {
        nodeId,
        callType: 'unary',
        status: 'failed',
        assertionFailures: failureList,
      };
  const assertAdapterMeta = {
    service: '',
    method: 'ASSERT',
    target: source ?? '',
    callType: 'assert' as const,
    assertSource: source,
  };
  const assertMeta = buildGrpcNodeStatusMeta(stepForMeta, assertAdapterMeta);
  const assertDetail = formatGrpcNodeRunDetail(stepForMeta, assertAdapterMeta);

  captureGrpcDetails(nodeId, hCtx, {
    target: source ?? '',
    service: '',
    method: 'ASSERT',
    callType: upstream?.callType ?? 'unary',
    durationMs,
    grpcStatus: upstream?.grpcStatus,
    grpcStatusMessage: upstream?.grpcStatusMessage,
    messageCount: upstream?.messages?.length,
  });

  hCtx.callbacks.onNodeStateChange(nodeId, {
    state: 'fail',
    error: errorMessage,
    responseTimeMs: durationMs,
    grpcMeta: assertMeta,
    responseDetail: assertDetail,
  });
  if (onError === 'continue') {
    hCtx.log({ prefix: '*', text: `[${label}] onError=continue — traversing outgoing edges` });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  }
}

function captureGrpcDetails(
  nodeId: string,
  hCtx: NodeHandlerContext,
  details: import('../../../shared/types').CapturedGrpcNodeDetails,
): void {
  hCtx.capturedGrpcDetails?.set(nodeId, details);
}

function isStreamCollectionSuccess(
  grpcStatus: number,
  stopReason: GrpcWorkflowStreamStopReason,
): boolean {
  if (stopReason === 'stream_error' || stopReason === 'transport_error' || stopReason === 'cancelled') {
    return false;
  }
  if (stopReason === 'stream_end') {
    return grpcStatus === 0;
  }
  return true;
}

function commitTransportFailureStepResult(
  hCtx: NodeHandlerContext,
  snapshot: import('../types/workflow/grpcWorkflowSnapshot').GrpcWorkflowExecuteSnapshot,
  callType: 'unary' | 'server_streaming',
  durationMs: number,
  errorDetail: string,
): void {
  if (!hCtx.grpcStepResultStore) return;
  commitGrpcStepResult(hCtx, snapshot, {
    nodeId: snapshot.nodeId,
    callType,
    status: 'failed',
    durationMs,
    errorDetail,
  });
}

async function finishGrpcFailure(
  nodeId: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
  snapshot: { onError: 'fail' | 'continue' },
  errorMessage: string,
  opts?: {
    grpcMeta?: import('../types/workflow/node-grpc').GrpcNodeStatusMeta;
    responseDetail?: string;
    responseTimeMs?: number;
  },
): Promise<void> {
  passed.value = false;
  hCtx.log({ prefix: '!', text: `[${label}] ${errorMessage}` });
  hCtx.callbacks.onNodeStateChange(nodeId, {
    state: 'fail',
    error: errorMessage,
    ...(opts?.responseTimeMs !== undefined ? { responseTimeMs: opts.responseTimeMs } : {}),
    ...(opts?.grpcMeta ? { grpcMeta: opts.grpcMeta } : {}),
    ...(opts?.responseDetail ? { responseDetail: opts.responseDetail } : {}),
  });
  if (snapshot.onError === 'continue') {
    hCtx.log({ prefix: '*', text: `[${label}] onError=continue — traversing outgoing edges` });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  }
}

function bodyPreview(body: Record<string, unknown> | undefined): string | undefined {
  if (!body) return undefined;
  return truncate(JSON.stringify(body), MAX_BODY_PREVIEW);
}

/** Phase 6C — execute a grpcUnary workflow node. */
export async function handleGrpcUnaryNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GrpcUnaryNodeData;
  const label = hCtx.nodeLabel(nodeId);
  const ops = validateGrpcOps(nodeId, label, hCtx, passed);
  if (!ops) return;

  let snapshot;
  try {
    snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId,
        requestId: `wf-${nodeId}-${Date.now()}`,
        data,
      },
      createGrpcWorkflowNodeSnapshotContext(hCtx.ctx, data, hCtx.grpcWorkflowExecutionRuntime),
    );
  } catch (err) {
    const msg = toErrorMessage(err);
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Snapshot build failed: ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
    return;
  }

  const target = snapshot.execute.target.address;
  hCtx.log({ prefix: '→', text: `[${label}] UNARY ${snapshot.execute.service}/${snapshot.execute.method} → ${target}` });
  logGrpcRequestMetadata(label, hCtx.log, snapshot.execute.metadata, snapshot.execute.auth);
  logGrpcRequestBody(label, hCtx.log, snapshot.execute.body);

  const t0 = performance.now();
  try {
    const { stepResult, attempts } = await executeGrpcWorkflowUnary(snapshot, {
      invokeUnary: wrapUnaryInvokeWithAbort(ops.invokeUnary, hCtx.abortSignal),
      abortSignal: hCtx.abortSignal,
    });
    const durationMs = stepResult.durationMs ?? Math.round(performance.now() - t0);
    await finalizeGrpcCallNode(nodeId, label, hCtx, passed, snapshot, stepResult, {
      transportType: 'grpcUnary',
      target,
      durationMs,
      attempts,
      callType: 'unary',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      passed.value = false;
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
      return;
    }
    const msg = toErrorMessage(err);
    const durationMs = Math.round(performance.now() - t0);
    commitTransportFailureStepResult(hCtx, snapshot, 'unary', durationMs, msg);
    captureGrpcDetails(nodeId, hCtx, {
      target,
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      callType: 'unary',
      durationMs,
      grpcStatusMessage: msg,
    });
    hCtx.results.push(buildGrpcResult(nodeId, label, 'grpcUnary', target, durationMs, false, {
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      target,
    }, msg));
    // Phase 6G: build minimal grpcMeta so the UI shows "Unary Details" even on transport errors
    const catchMeta = buildGrpcNodeStatusMeta(undefined, {
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      target,
      callType: 'unary',
    });
    await finishGrpcFailure(nodeId, label, hCtx, passed, snapshot, msg, {
      grpcMeta: catchMeta,
      responseTimeMs: durationMs,
    });
  }
}

/** Phase 6D — execute a grpcServerStream workflow node. */
export async function handleGrpcServerStreamNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GrpcServerStreamNodeData;
  const label = hCtx.nodeLabel(nodeId);
  const ops = validateGrpcOps(nodeId, label, hCtx, passed);
  if (!ops) return;

  let snapshot;
  try {
    snapshot = buildGrpcWorkflowExecuteSnapshot(
      {
        nodeId,
        requestId: `wf-${nodeId}-${Date.now()}`,
        data,
      },
      createGrpcWorkflowNodeSnapshotContext(hCtx.ctx, data, hCtx.grpcWorkflowExecutionRuntime),
    );
  } catch (err) {
    const msg = toErrorMessage(err);
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Snapshot build failed: ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
    return;
  }

  const target = snapshot.execute.target.address;
  const collect = snapshot.collect ?? {};
  hCtx.log({
    prefix: '→',
    text: `[${label}] SERVER_STREAM ${snapshot.execute.service}/${snapshot.execute.method} → ${target}`,
  });
  logGrpcRequestMetadata(label, hCtx.log, snapshot.execute.metadata, snapshot.execute.auth);
  logGrpcRequestBody(label, hCtx.log, snapshot.execute.body);

  const t0 = performance.now();
  try {
    const streamRequest = grpcWorkflowSnapshotToStreamStartRequest(snapshot);
    const collection = await ops.collectServerStream(
      streamRequest,
      snapshot.execute.tabId,
      collect,
      { abortSignal: hCtx.abortSignal },
    );
    const durationMs = collection.durationMs;
    const success = isStreamCollectionSuccess(collection.grpcStatus, collection.stopReason);
    const stepResult: GrpcWorkflowStepResult = {
      nodeId,
      callType: 'server_streaming',
      status: success ? 'success' : 'failed',
      grpcStatus: collection.grpcStatus,
      grpcStatusMessage: collection.grpcStatusMessage,
      durationMs,
      messages: collection.messages,
      trailers: collection.trailers,
      streamStopReason: collection.stopReason,
      errorDetail: success ? undefined : (collection.errorDetail ?? collection.grpcStatusMessage),
    };
    await finalizeGrpcCallNode(nodeId, label, hCtx, passed, snapshot, stepResult, {
      transportType: 'grpcServerStream',
      target,
      durationMs,
      callType: 'server_streaming',
      streamStopReason: collection.stopReason,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      passed.value = false;
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
      return;
    }
    const msg = toErrorMessage(err);
    const durationMs = Math.round(performance.now() - t0);
    commitTransportFailureStepResult(hCtx, snapshot, 'server_streaming', durationMs, msg);
    captureGrpcDetails(nodeId, hCtx, {
      target,
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      callType: 'server_streaming',
      durationMs,
      grpcStatusMessage: msg,
    });
    hCtx.results.push(buildGrpcResult(nodeId, label, 'grpcServerStream', target, durationMs, false, {
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      target,
    }, msg));
    // Phase 6G: build minimal grpcMeta so the UI shows "Server Stream Details" even on transport errors
    const catchMeta = buildGrpcNodeStatusMeta(undefined, {
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      target,
      callType: 'server_streaming',
    });
    await finishGrpcFailure(nodeId, label, hCtx, passed, snapshot, msg, {
      grpcMeta: catchMeta,
      responseTimeMs: durationMs,
    });
  }
}

async function finalizeGrpcCallNode(
  nodeId: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
  snapshot: import('../types/workflow/grpcWorkflowSnapshot').GrpcWorkflowExecuteSnapshot,
  stepResult: GrpcWorkflowStepResult,
  meta: {
    transportType: 'grpcUnary' | 'grpcServerStream';
    target: string;
    durationMs: number;
    callType: 'unary' | 'server_streaming';
    attempts?: number;
    streamStopReason?: string;
  },
): Promise<void> {
  const grpcMeta: GrpcResultMeta = {
    service: snapshot.execute.service,
    method: snapshot.execute.method,
    target: meta.target,
    grpcStatus: stepResult.grpcStatus,
    grpcStatusMessage: stepResult.grpcStatusMessage,
    messageCount: stepResult.messages?.length,
    streamStopReason: meta.streamStopReason,
    attempts: meta.attempts,
  };

  if (stepResult.status === 'success') {
    publishGrpcWorkflowStepOutput(hCtx.ctx, snapshot, stepResult, publishOptions(hCtx));
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    captureGrpcDetails(nodeId, hCtx, {
      target: meta.target,
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      callType: meta.callType,
      durationMs: meta.durationMs,
      grpcStatus: stepResult.grpcStatus,
      grpcStatusMessage: stepResult.grpcStatusMessage,
      messageCount: stepResult.messages?.length,
      streamStopReason: meta.streamStopReason,
      attempts: meta.attempts,
      bodyPreview: bodyPreview(stepResult.body ?? stepResult.messages?.[stepResult.messages.length - 1]),
    });

    const adapterMeta = {
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      target: meta.target,
      callType: meta.callType as 'unary' | 'server_streaming',
      attempts: meta.attempts,
    };

    hCtx.results.push(buildGrpcResult(
      nodeId,
      label,
      meta.transportType,
      meta.target,
      meta.durationMs,
      true,
      grpcMeta,
    ));
    logGrpcCallResponse(label, hCtx.log, stepResult, { attempts: meta.attempts });
    logGrpcSaveAs(label, hCtx.log, snapshot.saveAs);
    hCtx.log({ prefix: '✓', text: `[${label}] gRPC succeeded — ${meta.durationMs}ms` });
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state: 'pass',
      responseTimeMs: meta.durationMs,
      grpcMeta: buildGrpcNodeStatusMeta(stepResult, adapterMeta),
      responseDetail: formatGrpcNodeRunDetail(stepResult, adapterMeta),
    });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  passed.value = false;
  commitGrpcStepResult(hCtx, snapshot, stepResult);
  captureGrpcDetails(nodeId, hCtx, {
    target: meta.target,
    service: snapshot.execute.service,
    method: snapshot.execute.method,
    callType: meta.callType,
    durationMs: meta.durationMs,
    grpcStatus: stepResult.grpcStatus,
    grpcStatusMessage: stepResult.grpcStatusMessage,
    messageCount: stepResult.messages?.length,
    streamStopReason: meta.streamStopReason,
    attempts: meta.attempts,
  });

  const errorMessage = stepResult.errorDetail ?? stepResult.grpcStatusMessage ?? 'gRPC call failed';
  const adapterMetaFail = {
    service: snapshot.execute.service,
    method: snapshot.execute.method,
    target: meta.target,
    callType: meta.callType as 'unary' | 'server_streaming',
    attempts: meta.attempts,
  };

  hCtx.results.push(buildGrpcResult(
    nodeId,
    label,
    meta.transportType,
    meta.target,
    meta.durationMs,
    false,
    grpcMeta,
    errorMessage,
  ));
  await finishGrpcFailure(nodeId, label, hCtx, passed, snapshot, errorMessage, {
    grpcMeta: buildGrpcNodeStatusMeta(stepResult, adapterMetaFail),
    responseDetail: formatGrpcNodeRunDetail(stepResult, adapterMetaFail),
    responseTimeMs: meta.durationMs,
  });
}

/** Phase 6E — evaluate grpcAssert against frozen upstream step results (no network I/O). */
export async function handleGrpcAssertNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GrpcAssertNodeData;
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const t0 = performance.now();

  if (!data.source?.trim()) {
    const msg = 'Assert source (node id or saveAs alias) is required';
    const durationMs = Math.round(performance.now() - t0);
    await finishGrpcAssertFailure(nodeId, label, hCtx, passed, onError, msg, durationMs);
    return;
  }

  if (!hCtx.grpcStepResultStore) {
    const msg = 'gRPC step result store not configured';
    const durationMs = Math.round(performance.now() - t0);
    await finishGrpcAssertFailure(nodeId, label, hCtx, passed, onError, msg, durationMs);
    return;
  }

  const source = data.source.trim();
  hCtx.log({ prefix: '→', text: `[${label}] ASSERT source=${source}` });

  const upstream = hCtx.grpcStepResultStore.resolveSource(source);
  if (!upstream) {
    const durationMs = Math.round(performance.now() - t0);
    await finishGrpcAssertFailure(
      nodeId,
      label,
      hCtx,
      passed,
      onError,
      `No committed gRPC step result for source "${source}". Run an upstream grpcUnary/grpcServerStream node first.`,
      durationMs,
      source,
      undefined,
      undefined,
    );
    return;
  }

  logGrpcAssertUpstream(label, hCtx.log, upstream);

  const assertions = data.assertions ?? [];
  const outcome = evaluateGrpcWorkflowAssertions(upstream, assertions);
  const durationMs = Math.round(performance.now() - t0);

  if (!outcome.passed) {
    const errMsg = outcome.failures.join('\n');
    logGrpcAssertionResults(label, hCtx.log, assertions, false, outcome.failures);
    await finishGrpcAssertFailure(nodeId, label, hCtx, passed, onError, errMsg, durationMs, source, outcome.failures, upstream);
    return;
  }

  logGrpcAssertionResults(label, hCtx.log, assertions, true, []);

  hCtx.results.push(buildGrpcResult(nodeId, label, 'grpcAssert', source, durationMs, true, {
    service: '',
    method: 'ASSERT',
    target: source,
    grpcStatus: upstream.grpcStatus,
    messageCount: upstream.messages?.length,
    assertionFailures: [],
  }));
  hCtx.log({
    prefix: '✓',
    text: `[${label}] Assert passed — ${data.assertions?.length ?? 0} assertion(s) — ${durationMs}ms`,
  });
  // Phase 6G: capture grpc details so the trace event has grpcDetails for passing asserts
  captureGrpcDetails(nodeId, hCtx, {
    target: source,
    service: '',
    method: 'ASSERT',
    callType: upstream.callType,
    durationMs,
    grpcStatus: upstream.grpcStatus,
    grpcStatusMessage: upstream.grpcStatusMessage,
    messageCount: upstream.messages?.length,
  });
  const assertPassMeta = buildGrpcNodeStatusMeta(upstream, {
    service: '',
    method: 'ASSERT',
    target: source,
    callType: 'assert',
  });
  // assertionFailures: [] signals "evaluated, all passed" to the UI
  const assertPassMetaWithResult = { ...assertPassMeta, assertionFailures: [] as string[] };
  const assertPassDetail = formatGrpcNodeRunDetail(upstream, {
    service: '',
    method: 'ASSERT',
    target: source,
    callType: 'assert',
    assertSource: source,
  });
  hCtx.callbacks.onNodeStateChange(nodeId, {
    state: 'pass',
    responseTimeMs: durationMs,
    grpcMeta: assertPassMetaWithResult,
    responseDetail: assertPassDetail,
  });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}
