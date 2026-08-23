/**
 * Phase 8B — build immutable gRPC harness execution snapshots.
 */
import {
  normalizeGrpcMetadata,
  type GrpcDescriptorSourceFingerprint,
  type GrpcTlsConfig,
} from './contracts';
import { validateGrpcAuthForExecute } from './grpcAuthPolicy';
import { validateGrpcTlsConfigContract } from './grpcTlsPolicy';
import { validateGrpcMetadataRecord } from './metadataValidation';
import { validateResolvedGrpcTargetAddress, withGrpcTargetValidationMessage } from './targetValidation';
import { assertGrpcCanonicalEnvTokensValidForConnection } from './grpcCanonicalEnvValidation';
import type { Scenario } from '../types';
import type { GrpcHarnessExecuteSnapshot } from '../types/grpc-harness-snapshot';
import {
  resolveGrpcHarnessCallType,
  validateGrpcHarnessScenario,
} from '../utils/grpcHarnessScenarioContracts';
import {
  captureGrpcTabExecuteSnapshotFromResolution,
} from '@grpc/grpcStudioTypes';
import {
  resolveGrpcTabConnection,
  resolutionToGrpcTarget,
  type GrpcConnectionProfile,
  type GrpcTabConnectionPageDefaults,
} from '@grpc/utils/resolveGrpcTabConnection';
import {
  resolveGrpcTabInterpolationEnvLayers,
} from './grpcInterpolationPrecedence';
import {
  createGrpcInterpolationEnvSnapshot,
  type GrpcInterpolationEnvSnapshot,
} from './grpcInterpolationEnvSnapshot';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';
import {
  assertGrpcHarnessAuthTemplatesResolved,
  assertGrpcHarnessAssertionsTemplatesResolved,
  assertGrpcHarnessJsonTemplatesResolved,
  assertGrpcHarnessMetadataNormalizeUnique,
  assertGrpcHarnessTemplatesResolved,
  resolveGrpcHarnessAuthConfig,
  resolveGrpcHarnessAssertions,
  resolveGrpcHarnessCollectConfig,
  resolveGrpcHarnessJsonValue,
  resolveGrpcHarnessMetadata,
  resolveGrpcHarnessSendMessages,
  type GrpcHarnessTemplateResolver,
} from './grpcHarnessTemplateResolver';

export const DEFAULT_GRPC_HARNESS_TIMEOUT_MS = 30_000;

export interface GrpcHarnessSnapshotBuildInput {
  scenario: Scenario;
  requestId: string;
  capturedAt?: string;
}

export interface GrpcHarnessSnapshotBuildContext {
  resolveTemplate: GrpcHarnessTemplateResolver;
  profiles: GrpcConnectionProfile[];
  pageDefaults: GrpcTabConnectionPageDefaults;
  tlsConfig?: GrpcTlsConfig;
  sourceFingerprint?: GrpcDescriptorSourceFingerprint;
  interpolationEnv?: import('./grpcInterpolationEnvSnapshot').GrpcInterpolationEnvSnapshot;
  /** Phase 9C — runner env before scenario-specific profile/tab merge. */
  activeEnvironment?: Record<string, string>;
}

export function grpcHarnessTabId(scenarioId: string): string {
  return `harness:${scenarioId}`;
}

function resolveHarnessScenarioInterpolationContext(
  context: GrpcHarnessSnapshotBuildContext,
  connectionId: string | undefined,
  capturedAt?: string,
): {
  resolveTemplate: GrpcHarnessTemplateResolver;
  interpolationEnv: GrpcInterpolationEnvSnapshot | undefined;
} {
  const activeEnvironment = context.activeEnvironment ?? context.interpolationEnv?.env;
  if (!activeEnvironment) {
    return {
      resolveTemplate: context.resolveTemplate,
      interpolationEnv: context.interpolationEnv,
    };
  }
  const layers = resolveGrpcTabInterpolationEnvLayers({
    activeEnvironment: { ...activeEnvironment },
    profiles: context.profiles,
    connectionId,
  });
  const interpolationEnv = createGrpcInterpolationEnvSnapshot(
    layers,
    capturedAt ? { capturedAt } : undefined,
  );
  return {
    resolveTemplate: createGrpcInterpolationTemplateResolver(interpolationEnv.env),
    interpolationEnv,
  };
}

function resolveGrpcHarnessConnection(
  config: NonNullable<Scenario['grpcCallAction']>,
  resolveTemplate: GrpcHarnessTemplateResolver,
  profiles: GrpcConnectionProfile[],
  pageDefaults: GrpcTabConnectionPageDefaults,
) {
  const base = resolveGrpcTabConnection(
    {
      target: config.target,
      connectionId: config.connectionId,
      tlsMode: config.tlsMode,
    },
    profiles,
    pageDefaults,
  );
  const resolvedTarget = resolveTemplate(base.target);
  assertGrpcHarnessTemplatesResolved('gRPC target', resolvedTarget);
  return {
    ...base,
    target: resolvedTarget,
    targetValidation: withGrpcTargetValidationMessage(
      validateResolvedGrpcTargetAddress(resolvedTarget),
    ),
  };
}

function validateResolvedTls(
  tlsMode: NonNullable<Scenario['grpcCallAction']>['tlsMode'],
  tlsConfig: GrpcTlsConfig | undefined,
): void {
  const issues = validateGrpcTlsConfigContract(tlsMode ?? 'disabled', tlsConfig);
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? 'Invalid TLS configuration');
  }
}

function validateResolvedAuth(auth: NonNullable<Scenario['grpcCallAction']>['auth']): void {
  const issues = validateGrpcAuthForExecute(auth);
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? 'Invalid gRPC auth configuration');
  }
}

function validateResolvedMetadata(metadata: Record<string, string>): void {
  const error = validateGrpcMetadataRecord(metadata);
  if (error) {
    throw new Error(error);
  }
}

function resolveHarnessBody(
  callType: ReturnType<typeof resolveGrpcHarnessCallType>,
  rawBody: Record<string, unknown> | undefined,
  resolveTemplate: GrpcHarnessTemplateResolver,
): Record<string, unknown> {
  if (callType === 'client_streaming' || callType === 'bidi_streaming') {
    if (rawBody === undefined) return {};
    const body = resolveGrpcHarnessJsonValue(rawBody, resolveTemplate) as Record<string, unknown>;
    assertGrpcHarnessJsonTemplatesResolved(body);
    return body;
  }
  const body = resolveGrpcHarnessJsonValue(rawBody ?? {}, resolveTemplate) as Record<string, unknown>;
  assertGrpcHarnessJsonTemplatesResolved(body);
  return body;
}

/** Freeze validated harness scenario into an immutable transport snapshot. */
export function buildGrpcHarnessExecuteSnapshot(
  input: GrpcHarnessSnapshotBuildInput,
  context: GrpcHarnessSnapshotBuildContext,
): GrpcHarnessExecuteSnapshot {
  const { scenario, requestId } = input;
  const validation = validateGrpcHarnessScenario(scenario);
  if (!validation.valid) {
    throw new Error(
      `Invalid gRPC harness scenario: ${validation.issues.map((issue) => issue.message).join('; ')}`,
    );
  }

  const config = scenario.grpcCallAction!;
  const callType = resolveGrpcHarnessCallType(config);
  const scenarioInterpolation = resolveHarnessScenarioInterpolationContext(
    context,
    config.connectionId,
    input.capturedAt,
  );
  const { resolveTemplate, profiles, pageDefaults, tlsConfig, sourceFingerprint } = {
    ...context,
    resolveTemplate: scenarioInterpolation.resolveTemplate,
  };
  const interpolationEnv = scenarioInterpolation.interpolationEnv ?? context.interpolationEnv;
  if (interpolationEnv) {
    assertGrpcCanonicalEnvTokensValidForConnection(
      interpolationEnv.env,
      {
        target: config.target,
        connectionId: config.connectionId,
        tlsMode: config.tlsMode,
      },
      profiles,
      pageDefaults,
    );
  }

  const resolution = resolveGrpcHarnessConnection(config, resolveTemplate, profiles, pageDefaults);
  if (!resolution.targetValidation.valid) {
    throw new Error(resolution.targetValidation.reason);
  }
  validateResolvedTls(resolution.tlsMode, tlsConfig);

  const body = resolveHarnessBody(callType, config.body, resolveTemplate);
  const metadataResolved = resolveGrpcHarnessMetadata(config.metadata, resolveTemplate);
  for (const [key, value] of Object.entries(metadataResolved)) {
    assertGrpcHarnessTemplatesResolved('gRPC metadata key', key);
    assertGrpcHarnessTemplatesResolved('gRPC metadata value', value);
  }
  assertGrpcHarnessMetadataNormalizeUnique(metadataResolved);
  const metadata = normalizeGrpcMetadata(metadataResolved);
  validateResolvedMetadata(metadata);

  const auth = resolveGrpcHarnessAuthConfig(config.auth, resolveTemplate);
  assertGrpcHarnessAuthTemplatesResolved(auth);
  validateResolvedAuth(auth);

  const assertions = resolveGrpcHarnessAssertions(config.assertions, resolveTemplate);
  assertGrpcHarnessAssertionsTemplatesResolved(assertions);

  let collectConfig: GrpcHarnessExecuteSnapshot['collect'];
  if (callType === 'server_streaming' || callType === 'bidi_streaming') {
    collectConfig = resolveGrpcHarnessCollectConfig(config.collect!);
  }

  let sendMessages: GrpcHarnessExecuteSnapshot['sendMessages'];
  if (callType === 'client_streaming' || callType === 'bidi_streaming') {
    sendMessages = resolveGrpcHarnessSendMessages(config.sendMessages, resolveTemplate);
    sendMessages.forEach((message, index) => {
      assertGrpcHarnessJsonTemplatesResolved(message, `gRPC sendMessages[${index}]`);
    });
  }

  const execute = captureGrpcTabExecuteSnapshotFromResolution(
    {
      id: grpcHarnessTabId(scenario.id),
      title: scenario.name,
      target: config.target,
      connectionId: config.connectionId,
      tlsMode: resolution.tlsMode,
      tlsConfig,
      descriptorKey: config.descriptorKey,
      service: config.service,
      method: config.method,
      body,
      metadata,
      auth,
      timeoutMs: config.timeoutMs ?? DEFAULT_GRPC_HARNESS_TIMEOUT_MS,
      requestMode: 'form',
      lifecycle: 'idle',
      streamLifecycle: 'idle',
      streamMessages: [],
      lastSequence: 0,
      streamPendingBodies: [],
    },
    requestId,
    resolution,
    callType,
    {
      sourceFingerprint,
      interpolationEnv,
    },
  );

  if (input.capturedAt) {
    execute.capturedAt = input.capturedAt;
  }

  const snapshot: GrpcHarnessExecuteSnapshot = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    execute,
    retry: config.retry ? structuredClone(config.retry) : undefined,
    collect: collectConfig,
    sendMessages,
    assertions: assertions?.length ? assertions : undefined,
  };

  if (scenario.dataRowId) snapshot.dataRowId = scenario.dataRowId;
  if (scenario.dataRowLabel) snapshot.dataRowLabel = scenario.dataRowLabel;

  return snapshot;
}

/** Deep-clone snapshot for transport attempts — isolates retry mutations from canonical snapshot. */
export function cloneGrpcHarnessExecuteSnapshot(
  snapshot: GrpcHarnessExecuteSnapshot,
): GrpcHarnessExecuteSnapshot {
  return structuredClone(snapshot);
}

/** Compare transport-relevant fields for determinism tests (ignores capturedAt by default). */
export function grpcHarnessExecuteSnapshotTransportFingerprint(
  snapshot: GrpcHarnessExecuteSnapshot,
  options?: { includeCapturedAt?: boolean },
): string {
  const payload = {
    scenarioId: snapshot.scenarioId,
    scenarioName: snapshot.scenarioName,
    dataRowId: snapshot.dataRowId,
    dataRowLabel: snapshot.dataRowLabel,
    execute: {
      tabId: snapshot.execute.tabId,
      requestId: snapshot.execute.requestId,
      capturedAt: options?.includeCapturedAt ? snapshot.execute.capturedAt : undefined,
      callType: snapshot.execute.callType,
      target: snapshot.execute.target,
      service: snapshot.execute.service,
      method: snapshot.execute.method,
      body: snapshot.execute.body,
      metadata: snapshot.execute.metadata,
      timeoutMs: snapshot.execute.timeoutMs,
      descriptorKey: snapshot.execute.descriptorKey,
      auth: snapshot.execute.auth,
    },
    retry: snapshot.retry,
    collect: snapshot.collect,
    sendMessages: snapshot.sendMessages,
    assertions: snapshot.assertions,
  };
  return JSON.stringify(payload);
}

export function resolutionToHarnessGrpcTarget(
  scenario: Scenario,
  context: Pick<GrpcHarnessSnapshotBuildContext, 'resolveTemplate' | 'profiles' | 'pageDefaults' | 'tlsConfig'>,
) {
  const config = scenario.grpcCallAction;
  if (!config) {
    throw new Error('grpcCallAction is required');
  }
  const resolution = resolveGrpcHarnessConnection(
    config,
    context.resolveTemplate,
    context.profiles,
    context.pageDefaults,
  );
  if (!resolution.targetValidation.valid) {
    throw new Error(resolution.targetValidation.reason);
  }
  validateResolvedTls(resolution.tlsMode, context.tlsConfig);
  return resolutionToGrpcTarget(resolution, context.tlsConfig);
}
