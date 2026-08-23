/**
 * Phase 11N — Handlers for advanced gRPC workflow nodes:
 *   grpcLoadTest   — bounded unary load test; publishes loadTestSummary
 *   grpcSchemaDiff — descriptor diff; fails on breaking changes
 *   grpcMockAssert — unary call against mock listener target
 */
import type { WorkflowNode } from '../types/workflow';
import type { GrpcDescriptor } from '@shared/grpc/contracts';
import {
  captureGrpcLoadTestExecuteSnapshot,
  assertGrpcLoadTestConfig,
  deriveGrpcLoadTestSummaryStatus,
  type GrpcLoadTestConfig,
} from '@shared/grpc/grpcAdvancedFeatureContracts';
import { startGrpcLoadTestSchedulerRun } from '@shared/grpc/grpcLoadTestSchedulerCore';
import { buildGrpcLoadTestRunSummaryExport } from '@shared/grpc/grpcLoadTestMetrics';
import { computeGrpcSchemaDiff } from '@shared/grpc/grpcSchemaDiffEngine';
import { getByPath } from '@shared/utils/jsonPath';
import { toErrorMessage } from '@shared/utils/helpers';
import { nextResultId } from '@engine/core/requestExecution';
import type { FailureDetail, RequestResult } from '@shared/types';
import { buildGrpcWorkflowExecuteSnapshot } from '../utils/grpcWorkflowSnapshotBuilder';
import { createGrpcWorkflowNodeSnapshotContext } from '../utils/grpcWorkflowRuntimeContext';
import type {
  GrpcLoadTestNodeData,
  GrpcMockAssertNodeData,
  GrpcSchemaDiffNodeData,
  GrpcWorkflowLoadTestSummaryRef,
  GrpcWorkflowSchemaDiffSummaryRef,
} from '../types/workflow/node-grpc-advanced';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import { buildGrpcNodeStatusMeta, formatGrpcNodeRunDetail } from '../utils/grpcWorkflowOutputAdapter';

type AdvancedTransportType = 'grpcLoadTest' | 'grpcSchemaDiff' | 'grpcMockAssert';

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

function buildAdvancedResult(
  nodeId: string,
  label: string,
  transportType: AdvancedTransportType,
  target: string,
  durationMs: number,
  passed: boolean,
  errorMessage?: string,
  failureDetails: FailureDetail[] = [],
): RequestResult {
  return {
    id: nextResultId(),
    scenarioId: nodeId,
    scenarioName: label,
    url: `grpc://${transportType}/${target}`,
    method: transportType.toUpperCase(),
    httpStatus: passed ? 200 : 0,
    responseTimeMs: durationMs,
    responseBody: '',
    timestamp: Date.now(),
    passed,
    validationMode: 'none',
    failureDetails,
    workflowNodeId: nodeId,
    transportType,
    errorMessage,
  };
}

async function finishAdvancedFailure(
  nodeId: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
  onError: 'fail' | 'continue',
  errorMessage: string,
  durationMs: number,
  transportType: AdvancedTransportType,
  target: string,
): Promise<void> {
  passed.value = false;
  hCtx.results.push(buildAdvancedResult(
    nodeId,
    label,
    transportType,
    target,
    durationMs,
    false,
    errorMessage,
    [{ path: '(node)', expected: 'pass', actual: errorMessage }],
  ));
  hCtx.log({ prefix: '!', text: `[${label}] ${errorMessage}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: errorMessage, responseTimeMs: durationMs });
  if (onError === 'continue') {
    hCtx.log({ prefix: '*', text: `[${label}] onError=continue — traversing outgoing edges` });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  }
}

function publishLoadTestSummary(
  hCtx: NodeHandlerContext,
  nodeId: string,
  saveAs: string | undefined,
  summary: GrpcWorkflowLoadTestSummaryRef,
): void {
  const registry = hCtx.grpcOutputRegistry;
  if (!registry) {
    throw new Error('GrpcWorkflowOutputRegistry is required to publish load-test summary outputs');
  }
  registry.publishLoadTestSummary(hCtx.ctx, nodeId, saveAs, summary);
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
}

function publishSchemaDiffSummary(
  hCtx: NodeHandlerContext,
  nodeId: string,
  saveAs: string | undefined,
  summary: GrpcWorkflowSchemaDiffSummaryRef,
): void {
  const registry = hCtx.grpcOutputRegistry;
  if (!registry) {
    throw new Error('GrpcWorkflowOutputRegistry is required to publish schema-diff summary outputs');
  }
  registry.publishSchemaDiffSummary(hCtx.ctx, nodeId, saveAs, summary);
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
}

async function resolveDescriptor(
  hCtx: NodeHandlerContext,
  descriptorKey: string,
): Promise<GrpcDescriptor> {
  const resolver = hCtx.grpcOperations?.resolveDescriptor;
  if (!resolver) {
    throw new Error('resolveDescriptor is not configured on grpcOperations');
  }
  const descriptor = await resolver(descriptorKey);
  if (!descriptor) {
    throw new Error(`Descriptor not found for key "${descriptorKey}"`);
  }
  return descriptor;
}

async function resolveLoadTestConfig(
  data: GrpcLoadTestNodeData,
  ops: NonNullable<NodeHandlerContext['grpcOperations']>,
): Promise<GrpcLoadTestConfig> {
  if (data.loadTest) {
    return data.loadTest;
  }
  const profileId = data.profileId?.trim();
  if (!profileId) {
    throw new Error('Either inline loadTest config or profileId is required');
  }
  const resolver = ops.resolveLoadTestProfile;
  if (!resolver) {
    throw new Error('resolveLoadTestProfile is not configured on grpcOperations');
  }
  const config = await resolver(profileId);
  if (!config) {
    throw new Error(`Load test profile not found: ${profileId}`);
  }
  assertGrpcLoadTestConfig('unary', config);
  return config;
}

/** Phase 11N — run inline load-test profile and publish summary variables. */
export async function handleGrpcLoadTestNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GrpcLoadTestNodeData;
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const ops = validateGrpcOps(nodeId, label, hCtx, passed);
  if (!ops) return;

  let snapshot;
  try {
    snapshot = buildGrpcWorkflowExecuteSnapshot(
      { nodeId, requestId: `wf-load-${nodeId}-${Date.now()}`, data },
      createGrpcWorkflowNodeSnapshotContext(hCtx.ctx, data, hCtx.grpcWorkflowExecutionRuntime),
    );
  } catch (err) {
    const msg = toErrorMessage(err);
    await finishAdvancedFailure(
      nodeId,
      label,
      hCtx,
      passed,
      onError,
      `Snapshot build failed: ${msg}`,
      0,
      'grpcLoadTest',
      data.target,
    );
    return;
  }

  const target = snapshot.execute.target.address;
  const runId = `wf-load-${nodeId}-${Date.now()}`;
  hCtx.log({ prefix: '→', text: `[${label}] LOAD_TEST ${snapshot.execute.service}/${snapshot.execute.method} → ${target}` });

  const t0 = performance.now();
  try {
    const loadTestConfig = await resolveLoadTestConfig(data, ops);
    const loadSnapshot = captureGrpcLoadTestExecuteSnapshot({
      runId,
      executeSnapshot: snapshot.execute,
      config: loadTestConfig,
    });
    const scheduler = startGrpcLoadTestSchedulerRun({
      snapshot: loadSnapshot,
      signal: hCtx.abortSignal,
      executeAttempt: async (ctx) => {
        const result = await ops.invokeUnary(
          {
            callType: 'unary',
            requestId: `${ctx.runId}-${ctx.attemptNumber}`,
            target: ctx.executeSnapshot.target,
            service: ctx.executeSnapshot.service,
            method: ctx.executeSnapshot.method,
            body: ctx.executeSnapshot.body,
            metadata: ctx.executeSnapshot.metadata,
            timeoutMs: ctx.executeSnapshot.timeoutMs,
            descriptorKey: ctx.executeSnapshot.descriptorKey,
          },
          ctx.executeSnapshot.tabId,
        );
        return {
          ok: result.status === 0,
          durationMs: result.durationMs,
          statusCode: result.status,
          errorMessage: result.status === 0 ? undefined : result.statusMessage,
        };
      },
    });
    const report = await scheduler.completion;
    const durationMs = Math.round(performance.now() - t0);
    const summaryExport = buildGrpcLoadTestRunSummaryExport({ snapshot: loadSnapshot, report });
    const summaryRef: GrpcWorkflowLoadTestSummaryRef = {
      nodeId,
      status: deriveGrpcLoadTestSummaryStatus({
        counts: report.counts,
        stopReason: report.stopReason,
      }),
      runId,
      totalCalls: report.counts.completed,
      succeeded: report.counts.succeeded,
      failed: report.counts.failed,
      p50Ms: summaryExport.metrics.latency.p50Ms,
      p95Ms: summaryExport.metrics.latency.p95Ms,
      stopReason: report.stopReason,
    };

    publishLoadTestSummary(hCtx, nodeId, data.saveAs, summaryRef);

    const nodePassed = summaryRef.status === 'success';
    if (!nodePassed) {
      await finishAdvancedFailure(
        nodeId,
        label,
        hCtx,
        passed,
        onError,
        `Load test failed: ${summaryRef.failed}/${summaryRef.totalCalls} calls failed`,
        durationMs,
        'grpcLoadTest',
        target,
      );
      return;
    }

    hCtx.results.push(buildAdvancedResult(nodeId, label, 'grpcLoadTest', target, durationMs, true));
    hCtx.log({
      prefix: '✓',
      text: `[${label}] Load test — ${summaryRef.succeeded}/${summaryRef.totalCalls} ok — ${durationMs}ms`,
    });
    const loadStepResult = {
      nodeId,
      callType: 'unary' as const,
      status: 'success' as const,
      durationMs,
    };
    hCtx.callbacks.onNodeStateChange(nodeId, {
      state: 'pass',
      responseTimeMs: durationMs,
      grpcMeta: buildGrpcNodeStatusMeta(loadStepResult, {
        service: snapshot.execute.service,
        method: snapshot.execute.method,
        target,
        callType: 'unary',
      }),
      responseDetail: formatGrpcNodeRunDetail(loadStepResult, {
        service: snapshot.execute.service,
        method: snapshot.execute.method,
        target,
        callType: 'unary',
      }),
    });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      passed.value = false;
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
      return;
    }
    const msg = toErrorMessage(err);
    const durationMs = Math.round(performance.now() - t0);
    await finishAdvancedFailure(nodeId, label, hCtx, passed, onError, msg, durationMs, 'grpcLoadTest', target);
  }
}

/** Phase 11N — compare pinned descriptor keys; fail when breaking > 0. */
export async function handleGrpcSchemaDiffNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GrpcSchemaDiffNodeData;
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const failOnBreaking = data.failOnBreaking !== false;
  const ops = validateGrpcOps(nodeId, label, hCtx, passed);
  if (!ops) return;
  if (!ops.resolveDescriptor) {
    await finishAdvancedFailure(
      nodeId,
      label,
      hCtx,
      passed,
      onError,
      'resolveDescriptor is not configured on grpcOperations',
      0,
      'grpcSchemaDiff',
      data.leftDescriptorKey,
    );
    return;
  }

  const t0 = performance.now();
  hCtx.log({
    prefix: '→',
    text: `[${label}] SCHEMA_DIFF ${data.leftDescriptorKey} ↔ ${data.rightDescriptorKey}`,
  });

  try {
    const [left, right] = await Promise.all([
      resolveDescriptor(hCtx, data.leftDescriptorKey),
      resolveDescriptor(hCtx, data.rightDescriptorKey),
    ]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: data.leftDescriptorKey,
      rightDescriptorKey: data.rightDescriptorKey,
      left,
      right,
    });
    const durationMs = Math.round(performance.now() - t0);
    const summaryRef: GrpcWorkflowSchemaDiffSummaryRef = {
      nodeId,
      status: failOnBreaking && report.summary.breaking > 0 ? 'failed' : 'success',
      breaking: report.summary.breaking,
      warning: report.summary.nonBreaking,
      info: report.summary.informational,
      leftDescriptorKey: data.leftDescriptorKey,
      rightDescriptorKey: data.rightDescriptorKey,
    };
    publishSchemaDiffSummary(hCtx, nodeId, data.saveAs, summaryRef);

    const nodePassed = summaryRef.status === 'success';
    if (!nodePassed) {
      await finishAdvancedFailure(
        nodeId,
        label,
        hCtx,
        passed,
        onError,
        `Schema diff failed: ${report.summary.breaking} breaking change(s)`,
        durationMs,
        'grpcSchemaDiff',
        data.leftDescriptorKey,
      );
      return;
    }

    hCtx.results.push(buildAdvancedResult(
      nodeId,
      label,
      'grpcSchemaDiff',
      data.leftDescriptorKey,
      durationMs,
      true,
    ));
    hCtx.log({
      prefix: '✓',
      text: `[${label}] Schema diff — breaking=${report.summary.breaking} — ${durationMs}ms`,
    });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass', responseTimeMs: durationMs });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const msg = toErrorMessage(err);
    const durationMs = Math.round(performance.now() - t0);
    await finishAdvancedFailure(
      nodeId,
      label,
      hCtx,
      passed,
      onError,
      msg,
      durationMs,
      'grpcSchemaDiff',
      data.leftDescriptorKey,
    );
  }
}

/** Phase 11N — unary assert against mock listener listen target. */
export async function handleGrpcMockAssertNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as GrpcMockAssertNodeData;
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const ops = validateGrpcOps(nodeId, label, hCtx, passed);
  if (!ops) return;

  const target = data.listenTarget.trim();
  const expectedStatus = data.expectedStatus ?? 0;
  hCtx.log({ prefix: '→', text: `[${label}] MOCK_ASSERT ${data.service}/${data.method} → ${target}` });

  const t0 = performance.now();
  try {
    const result = await ops.invokeUnary(
      {
        callType: 'unary',
        requestId: `wf-mock-${nodeId}-${Date.now()}`,
        target: { address: target, tlsMode: 'disabled' },
        service: data.service,
        method: data.method,
        body: data.body ?? {},
        metadata: data.metadata,
        timeoutMs: data.timeoutMs ?? 30_000,
        descriptorKey: data.descriptorKey,
      },
      `workflow:mock:${nodeId}`,
    );
    const durationMs = result.durationMs ?? Math.round(performance.now() - t0);
    const failures: string[] = [];

    if (result.status !== expectedStatus) {
      failures.push(`Expected gRPC status ${expectedStatus}, got ${result.status}`);
    }
    if (data.expectedBodyPath?.trim() && data.expectedBodyValue !== undefined) {
      const actual = getByPath(result.body ?? {}, data.expectedBodyPath);
      const expectedJson = JSON.stringify(data.expectedBodyValue);
      const actualJson = JSON.stringify(actual);
      if (expectedJson !== actualJson) {
        failures.push(`Body path ${data.expectedBodyPath}: expected ${expectedJson}, got ${actualJson}`);
      }
    }

    if (failures.length > 0) {
      await finishAdvancedFailure(
        nodeId,
        label,
        hCtx,
        passed,
        onError,
        failures.join('\n'),
        durationMs,
        'grpcMockAssert',
        target,
      );
      for (const failure of failures) {
        hCtx.log({ prefix: '!', text: `[${label}]   ✗ ${failure}` });
      }
      return;
    }

    hCtx.results.push(buildAdvancedResult(nodeId, label, 'grpcMockAssert', target, durationMs, true));
    hCtx.log({ prefix: '✓', text: `[${label}] Mock assert passed — ${durationMs}ms` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass', responseTimeMs: durationMs });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const msg = toErrorMessage(err);
    const durationMs = Math.round(performance.now() - t0);
    await finishAdvancedFailure(nodeId, label, hCtx, passed, onError, msg, durationMs, 'grpcMockAssert', target);
  }
}
