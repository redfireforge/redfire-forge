import type { GrpcTabExecuteSnapshot, GrpcCallType, GrpcDescriptor } from '@shared/grpc/contracts';
import type { GrpcStudioTransportMode } from '@shared/grpc/grpcWebTransportContracts';
import { defaultGrpcStudioTransportModeForPlatform } from '@shared/grpc/grpcWebTransportContracts';
import {
  captureGrpcLoadTestExecuteSnapshot,
  transitionGrpcAdvancedOperationState,
  createInitialGrpcAdvancedOperationState,
  validateGrpcLoadTestConfig,
  deriveGrpcLoadTestOperationOutcome,
  buildGrpcLoadTestRunFailureMessage,
  type GrpcLoadTestConfig,
  type GrpcAdvancedOperationState,
} from '@shared/grpc/grpcAdvancedFeatureContracts';
import { startGrpcLoadTestSchedulerRun, type GrpcLoadTestSchedulerRun } from '@shared/grpc/grpcLoadTestSchedulerCore';
import { captureAndStartGrpcLoadTestStreamSchedulerRun } from '@shared/grpc/grpcLoadTestStreamScheduler';
import {
  buildGrpcLoadTestRunSummaryExport,
  type GrpcLoadTestRunSummaryExport,
} from '@shared/grpc/grpcLoadTestMetrics';
import { invokeGrpcUnary } from '@shared/grpc/grpcTransportFacade';
import { snapshotToUnaryCallRequest, snapshotToStreamStartRequest } from '../grpcStudioTypes';
import { collectGrpcWorkflowServerStream } from '@workflow/utils/grpcWorkflowStreamCollector';
import { computeGrpcSchemaDiff } from '@shared/grpc/grpcSchemaDiffEngine';
import type { GrpcSchemaDiffReport } from '@shared/grpc/grpcSchemaDiffContracts';
import {
  resolveGrpcTabMockConfig,
  type GrpcMockConfigSource,
  type GrpcMockResolvedMockConfig,
} from '@shared/grpc/grpcMockConfigResolution';
import type { GrpcMockLatencyPolicy } from '@shared/grpc/grpcMockLatencySimulation';
import type { GrpcMockRuleSet } from '@shared/grpc/grpcMockRuleContracts';
import {
  createGrpcMockRuntimeRegistry,
  type GrpcMockRuntimeRegistry,
} from '@shared/grpc/grpcMockRuntimeRegistry';

export function resolveFrozenLoadTestTransportMode(
  executeSnapshot: Pick<GrpcTabExecuteSnapshot, 'transportMode'>,
): GrpcStudioTransportMode {
  return executeSnapshot.transportMode ?? defaultGrpcStudioTransportModeForPlatform();
}

export function validateLoadTestPreconditions(
  callType: GrpcCallType | undefined,
  config: GrpcLoadTestConfig,
  options?: { methodResolved?: boolean; transportMode?: GrpcStudioTransportMode },
): string | undefined {
  if (options?.methodResolved === false) {
    return 'Selected method was not found in the loaded descriptor.';
  }
  if (callType === 'client_streaming' || callType === 'bidi_streaming') {
    return 'Load testing supports unary and server-streaming RPCs only.';
  }
  const effectiveTransportMode = callType === 'server_streaming'
    ? (options?.transportMode ?? defaultGrpcStudioTransportModeForPlatform())
    : options?.transportMode;
  if (
    callType === 'server_streaming'
    && (effectiveTransportMode === 'grpc-web' || effectiveTransportMode === 'spring-servlet')
  ) {
    return 'Server-streaming load tests require Express proxy or native transport.';
  }
  const issues = validateGrpcLoadTestConfig(callType ?? 'unary', config);
  return issues[0]?.message;
}

export function isGrpcAdvancedOperationInFlight(
  status: GrpcAdvancedOperationState['status'],
): boolean {
  return status === 'running' || status === 'validating';
}

export function nextLoadTestRunGeneration(current: number | undefined): number {
  return (current ?? 0) + 1;
}

export function shouldApplyLoadTestRunResult(
  currentGeneration: number | undefined,
  capturedGeneration: number,
): boolean {
  return currentGeneration === capturedGeneration;
}

export function isGrpcStudioTabLive(
  tabs: ReadonlyArray<{ id: string }>,
  tabId: string,
): boolean {
  return tabs.some((tab) => tab.id === tabId);
}

function normalizeMockLatencyPolicy(
  latencyPolicy?: GrpcMockLatencyPolicy,
): GrpcMockLatencyPolicy | undefined {
  if (latencyPolicy == null) {
    return undefined;
  }
  const normalized: GrpcMockLatencyPolicy = {};
  if (latencyPolicy.defaultLatencyMs != null) {
    normalized.defaultLatencyMs = latencyPolicy.defaultLatencyMs;
  }
  if (latencyPolicy.jitterMs != null) {
    normalized.jitterMs = latencyPolicy.jitterMs;
  }
  if (latencyPolicy.seed != null) {
    normalized.seed = latencyPolicy.seed;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function buildLoadTestRunId(tabId: string): string {
  return `load-${tabId}-${Date.now()}`;
}

export interface StartGrpcLoadTestRunParams {
  tabId: string;
  executeSnapshot: GrpcTabExecuteSnapshot;
  config: GrpcLoadTestConfig;
  resolvedEnvName?: string;
}

export function startGrpcStudioLoadTestRun(params: StartGrpcLoadTestRunParams): GrpcLoadTestSchedulerRun {
  if (params.executeSnapshot.callType === 'server_streaming') {
    const frozenTransportMode = resolveFrozenLoadTestTransportMode(params.executeSnapshot);
    const preconditionError = validateLoadTestPreconditions('server_streaming', params.config, {
      transportMode: frozenTransportMode,
    });
    if (preconditionError) {
      throw new Error(preconditionError);
    }
    return captureAndStartGrpcLoadTestStreamSchedulerRun({
      runId: buildLoadTestRunId(params.tabId),
      executeSnapshot: params.executeSnapshot,
      config: params.config,
      resolvedEnvName: params.resolvedEnvName,
      collectServerStream: (request, tabId, collect, options) => collectGrpcWorkflowServerStream(
        request,
        tabId,
        collect,
        {
          abortSignal: options?.abortSignal,
          transportMode: frozenTransportMode,
        },
      ),
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => snapshotToStreamStartRequest({
        ...executeSnapshot,
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
      }),
    });
  }

  const snapshot = captureGrpcLoadTestExecuteSnapshot({
    runId: buildLoadTestRunId(params.tabId),
    executeSnapshot: params.executeSnapshot,
    config: params.config,
    resolvedEnvName: params.resolvedEnvName,
  });

  return startGrpcLoadTestSchedulerRun({
    snapshot,
    executeAttempt: async (ctx) => {
      const started = Date.now();
      try {
        const request = snapshotToUnaryCallRequest({
          ...ctx.executeSnapshot,
          requestId: `${ctx.executeSnapshot.requestId}-lt-${ctx.attemptNumber}`,
        });
        const envelope = await invokeGrpcUnary({
          request,
          tabId: ctx.executeSnapshot.tabId,
          transportMode: ctx.executeSnapshot.transportMode,
        });
        const result = envelope.data;
        return {
          ok: result.status === 0,
          durationMs: result.durationMs ?? Date.now() - started,
          statusCode: result.status,
          errorMessage: result.status !== 0 ? result.statusMessage : undefined,
        };
      } catch (error) {
        return {
          ok: false,
          durationMs: Date.now() - started,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}

export function applyGrpcLoadTestRequestTemplate(
  executeSnapshot: GrpcTabExecuteSnapshot,
  config: GrpcLoadTestConfig,
): GrpcTabExecuteSnapshot {
  if (executeSnapshot.callType !== 'unary') {
    return executeSnapshot;
  }
  const template = config.requestTemplateJson?.trim();
  if (!template) {
    return executeSnapshot;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(template);
  } catch {
    throw new Error('Request template must be valid JSON.');
  }
  if (parsed == null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Request template must be a JSON object.');
  }
  return {
    ...executeSnapshot,
    body: parsed as Record<string, unknown>,
  };
}

export async function finalizeGrpcLoadTestRun(
  run: GrpcLoadTestSchedulerRun,
): Promise<ReturnType<typeof buildGrpcLoadTestRunSummaryExport>> {
  const report = await run.completion;
  return buildGrpcLoadTestRunSummaryExport({ snapshot: run.snapshot, report });
}

export function resolveLoadTestRunOperationTransition(
  state: GrpcAdvancedOperationState,
  summary: Pick<GrpcLoadTestRunSummaryExport, 'counts' | 'stopReason'>,
): GrpcAdvancedOperationState {
  const outcome = deriveGrpcLoadTestOperationOutcome(summary);
  if (outcome === 'cancelled') {
    return transitionAdvancedOpToCancelled(state);
  }
  if (outcome === 'failed') {
    return transitionAdvancedOpToFailed(state, buildGrpcLoadTestRunFailureMessage(summary.counts));
  }
  return transitionAdvancedOpToCompleted(state);
}

export function computeGrpcStudioSchemaDiffReport(input: {
  baseline: GrpcDescriptor;
  candidate: GrpcDescriptor;
  generatedAt?: string;
}): GrpcSchemaDiffReport {
  return computeGrpcSchemaDiff({
    left: input.baseline,
    right: input.candidate,
    leftDescriptorKey: input.baseline.key,
    rightDescriptorKey: input.candidate.key,
    generatedAt: input.generatedAt,
  });
}

export function resolveGrpcStudioMockConfig(input: {
  tabId: string;
  connectionId?: string;
  mockConfigOverride?: GrpcMockConfigSource;
  profileConnectionId?: string;
  profileMockConfig?: GrpcMockConfigSource;
  workspaceDefault: GrpcMockConfigSource;
}): GrpcMockResolvedMockConfig {
  return resolveGrpcTabMockConfig(
    {
      tabId: input.tabId,
      connectionId: input.connectionId,
      mockConfigOverride: input.mockConfigOverride,
    },
    input.profileMockConfig != null
      ? { connectionId: input.profileConnectionId ?? input.tabId, mockConfig: input.profileMockConfig }
      : undefined,
    input.workspaceDefault,
  );
}

export function buildMockConfigSourceFromEditor(
  ruleSet: GrpcMockRuleSet,
  latencyPolicy?: GrpcMockLatencyPolicy,
): GrpcMockConfigSource {
  const normalizedLatency = normalizeMockLatencyPolicy(latencyPolicy);
  return {
    ruleSet: structuredClone(ruleSet),
    ...(normalizedLatency != null ? { latencyPolicy: normalizedLatency } : {}),
  };
}

let sharedMockRegistry: GrpcMockRuntimeRegistry | undefined;

export function getGrpcStudioMockRuntimeRegistry(): GrpcMockRuntimeRegistry {
  if (sharedMockRegistry == null) {
    sharedMockRegistry = createGrpcMockRuntimeRegistry();
  }
  return sharedMockRegistry;
}

export function resetGrpcStudioMockRuntimeRegistryForTests(): void {
  sharedMockRegistry = undefined;
}

export function resetAdvancedOpIfTerminal(
  state: GrpcAdvancedOperationState,
): GrpcAdvancedOperationState {
  if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
    return transitionGrpcAdvancedOperationState(state, 'idle');
  }
  return state;
}

export function transitionAdvancedOpToRunning(
  state: GrpcAdvancedOperationState,
  operationId: string,
): GrpcAdvancedOperationState {
  let base = resetAdvancedOpIfTerminal(state);
  if (base.status !== 'idle') {
    base = createInitialGrpcAdvancedOperationState();
  }
  let next = transitionGrpcAdvancedOperationState(base, 'validating', { operationId });
  next = transitionGrpcAdvancedOperationState(next, 'running', { operationId });
  return next;
}

export function transitionAdvancedOpQuickComplete(
  state: GrpcAdvancedOperationState,
): GrpcAdvancedOperationState {
  let base = resetAdvancedOpIfTerminal(state);
  if (base.status === 'idle') {
    base = transitionGrpcAdvancedOperationState(base, 'validating');
  }
  if (base.status === 'validating') {
    base = transitionGrpcAdvancedOperationState(base, 'running');
  }
  if (base.status === 'running') {
    return transitionGrpcAdvancedOperationState(base, 'completed');
  }
  return base;
}

export function transitionAdvancedOpToCompleted(
  state: GrpcAdvancedOperationState,
): GrpcAdvancedOperationState {
  if (state.status === 'running') {
    return transitionGrpcAdvancedOperationState(state, 'completed');
  }
  return transitionAdvancedOpQuickComplete(state);
}

export function transitionAdvancedOpToFailed(
  state: GrpcAdvancedOperationState,
  message: string,
): GrpcAdvancedOperationState {
  let base = resetAdvancedOpIfTerminal(state);
  if (base.status === 'idle') {
    base = transitionGrpcAdvancedOperationState(base, 'validating');
  }
  const running = base.status === 'validating'
    ? transitionGrpcAdvancedOperationState(base, 'running')
    : base;
  return transitionGrpcAdvancedOperationState(running, 'failed', {
    error: { category: 'runtime', message },
  });
}

export function transitionAdvancedOpToCancelled(
  state: GrpcAdvancedOperationState,
): GrpcAdvancedOperationState {
  if (state.status === 'running') {
    return transitionGrpcAdvancedOperationState(state, 'cancelled');
  }
  let base = resetAdvancedOpIfTerminal(state);
  if (base.status === 'idle') {
    base = transitionGrpcAdvancedOperationState(base, 'validating');
  }
  const running = base.status === 'validating'
    ? transitionGrpcAdvancedOperationState(base, 'running')
    : base;
  return transitionGrpcAdvancedOperationState(running, 'cancelled');
}

export function resetAdvancedOpToIdle(
  state: GrpcAdvancedOperationState,
): GrpcAdvancedOperationState {
  if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
    return transitionGrpcAdvancedOperationState(state, 'idle');
  }
  return createInitialGrpcAdvancedOperationState();
}
