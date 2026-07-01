/**
 * Phase 6B — build immutable gRPC workflow execution snapshots.
 */
import {
  normalizeGrpcMetadata,
  type GrpcDescriptorSourceFingerprint,
  type GrpcTlsConfig,
} from '../../../shared/grpc/contracts';
import { validateGrpcAuthForExecute } from '../../../shared/grpc/grpcAuthPolicy';
import { validateGrpcTlsConfigContract } from '../../../shared/grpc/grpcTlsPolicy';
import { validateGrpcMetadataRecord } from '../../../shared/grpc/metadataValidation';
import { validateResolvedGrpcTargetAddress, withGrpcTargetValidationMessage } from '../../../shared/grpc/targetValidation';
import { assertGrpcCanonicalEnvTokensValidForConnection } from '../../../shared/grpc/grpcCanonicalEnvValidation';
import { captureGrpcTabExecuteSnapshotFromResolution } from '../../grpc/grpcStudioTypes';
import {
  resolveGrpcTabConnection,
  resolutionToGrpcTarget,
  type GrpcConnectionProfile,
  type GrpcTabConnectionPageDefaults,
} from '../../grpc/utils/resolveGrpcTabConnection';
import {
  resolveGrpcTabInterpolationEnvLayers,
} from '../../../shared/grpc/grpcInterpolationPrecedence';
import {
  createGrpcInterpolationEnvSnapshot,
  type GrpcInterpolationEnvSnapshot,
} from '../../../shared/grpc/grpcInterpolationEnvSnapshot';
import { createGrpcWorkflowInterpolationResolver } from '../../../shared/grpc/grpcWorkflowInterpolationResolver';
import { createGrpcInterpolationTemplateResolver } from '../../../shared/grpc/grpcInterpolationResolver';
import type { GrpcWorkflowExecuteSnapshot } from '../types/workflow/grpcWorkflowSnapshot';
import type {
  GrpcServerStreamNodeData,
  GrpcUnaryNodeData,
} from '../types/workflow/node-grpc';
import { defaultGrpcWorkflowTimeoutMs } from './grpcWorkflowNodeValidation';
import {
  assertGrpcWorkflowAuthTemplatesResolved,
  assertGrpcWorkflowJsonTemplatesResolved,
  assertGrpcWorkflowMetadataNormalizeUnique,
  assertGrpcWorkflowTemplatesResolved,
  resolveGrpcWorkflowAuthConfig,
  resolveGrpcWorkflowCollectConfig,
  resolveGrpcWorkflowJsonValue,
  resolveGrpcWorkflowMetadata,
  type GrpcWorkflowTemplateResolver,
} from './grpcWorkflowTemplateResolver';

export interface GrpcWorkflowSnapshotBuildInput {
  nodeId: string;
  requestId: string;
  data: GrpcUnaryNodeData | GrpcServerStreamNodeData;
  capturedAt?: string;
}

export interface GrpcWorkflowSnapshotBuildContext {
  resolveTemplate: GrpcWorkflowTemplateResolver;
  profiles: GrpcConnectionProfile[];
  pageDefaults: GrpcTabConnectionPageDefaults;
  tlsConfig?: GrpcTlsConfig;
  sourceFingerprint?: GrpcDescriptorSourceFingerprint;
  interpolationEnv?: import('../../../shared/grpc/grpcInterpolationEnvSnapshot').GrpcInterpolationEnvSnapshot;
  /** Phase 9C — workflow VariableContext snapshot before node profile merge. */
  activeEnvironment?: Record<string, string>;
  variableContext?: import('../engine/variableContext').VariableContext;
}

function workflowTabId(nodeId: string): string {
  return `workflow:${nodeId}`;
}

function resolveWorkflowNodeInterpolationContext(
  context: GrpcWorkflowSnapshotBuildContext,
  connectionId: string | undefined,
  capturedAt?: string,
): {
  resolveTemplate: GrpcWorkflowTemplateResolver;
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
  if (context.variableContext) {
    return {
      resolveTemplate: createGrpcWorkflowInterpolationResolver(
        context.variableContext,
        interpolationEnv.env,
      ),
      interpolationEnv,
    };
  }
  return {
    resolveTemplate: createGrpcInterpolationTemplateResolver(interpolationEnv.env),
    interpolationEnv,
  };
}

function resolveGrpcWorkflowConnection(
  data: GrpcUnaryNodeData | GrpcServerStreamNodeData,
  resolveTemplate: GrpcWorkflowTemplateResolver,
  profiles: GrpcConnectionProfile[],
  pageDefaults: GrpcTabConnectionPageDefaults,
) {
  const base = resolveGrpcTabConnection(
    {
      target: data.target,
      connectionId: data.connectionId,
      tlsMode: data.tlsMode,
    },
    profiles,
    pageDefaults,
  );
  const resolvedTarget = resolveTemplate(base.target);
  assertGrpcWorkflowTemplatesResolved('gRPC target', resolvedTarget);
  return {
    ...base,
    target: resolvedTarget,
    targetValidation: withGrpcTargetValidationMessage(
      validateResolvedGrpcTargetAddress(resolvedTarget),
    ),
  };
}

function validateResolvedTls(
  tlsMode: GrpcUnaryNodeData['tlsMode'],
  tlsConfig: GrpcTlsConfig | undefined,
): void {
  const issues = validateGrpcTlsConfigContract(tlsMode ?? 'disabled', tlsConfig);
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? 'Invalid TLS configuration');
  }
}

function validateResolvedAuth(auth: GrpcUnaryNodeData['auth']): void {
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

/** Freeze validated workflow node config into an immutable transport snapshot. */
export function buildGrpcWorkflowExecuteSnapshot(
  input: GrpcWorkflowSnapshotBuildInput,
  context: GrpcWorkflowSnapshotBuildContext,
): GrpcWorkflowExecuteSnapshot {
  const { nodeId, requestId, data } = input;
  const nodeInterpolation = resolveWorkflowNodeInterpolationContext(
    context,
    data.connectionId,
    input.capturedAt,
  );
  const {
    resolveTemplate,
    profiles,
    pageDefaults,
    tlsConfig,
    sourceFingerprint,
  } = {
    ...context,
    resolveTemplate: nodeInterpolation.resolveTemplate,
  };
  const interpolationEnv = nodeInterpolation.interpolationEnv ?? context.interpolationEnv;
  if (interpolationEnv) {
    assertGrpcCanonicalEnvTokensValidForConnection(
      interpolationEnv.env,
      {
        target: data.target,
        connectionId: data.connectionId,
        tlsMode: data.tlsMode,
      },
      profiles,
      pageDefaults,
    );
  }

  const resolution = resolveGrpcWorkflowConnection(data, resolveTemplate, profiles, pageDefaults);
  if (!resolution.targetValidation.valid) {
    throw new Error(resolution.targetValidation.reason);
  }
  validateResolvedTls(resolution.tlsMode, tlsConfig);

  const body = resolveGrpcWorkflowJsonValue(data.body, resolveTemplate) as Record<string, unknown>;
  assertGrpcWorkflowJsonTemplatesResolved(body);
  const metadataResolved = resolveGrpcWorkflowMetadata(data.metadata, resolveTemplate);
  for (const [key, value] of Object.entries(metadataResolved)) {
    assertGrpcWorkflowTemplatesResolved('gRPC metadata key', key);
    assertGrpcWorkflowTemplatesResolved('gRPC metadata value', value);
  }
  assertGrpcWorkflowMetadataNormalizeUnique(metadataResolved);
  const metadata = normalizeGrpcMetadata(metadataResolved);
  validateResolvedMetadata(metadata);

  const auth = resolveGrpcWorkflowAuthConfig(data.auth, resolveTemplate);
  assertGrpcWorkflowAuthTemplatesResolved(auth);
  validateResolvedAuth(auth);

  let collectConfig: GrpcWorkflowExecuteSnapshot['collect'];
  if (data.callType === 'server_streaming') {
    collectConfig = resolveGrpcWorkflowCollectConfig(data.collect, resolveTemplate);
    if (collectConfig.untilExpression) {
      assertGrpcWorkflowTemplatesResolved(
        'Server stream untilExpression',
        collectConfig.untilExpression,
      );
    }
  }

  const execute = captureGrpcTabExecuteSnapshotFromResolution(
    {
      id: workflowTabId(nodeId),
      title: data.label,
      target: data.target,
      connectionId: data.connectionId,
      tlsMode: resolution.tlsMode,
      tlsConfig,
      descriptorKey: data.descriptorKey,
      service: data.service,
      method: data.method,
      body,
      metadata,
      auth,
      timeoutMs: data.timeoutMs ?? defaultGrpcWorkflowTimeoutMs(),
      requestMode: 'form',
      lifecycle: 'idle',
      streamLifecycle: 'idle',
      streamMessages: [],
      lastSequence: 0,
      streamPendingBodies: [],
    },
    requestId,
    resolution,
    data.callType,
    {
      sourceFingerprint,
      interpolationEnv,
    },
  );

  if (input.capturedAt) {
    execute.capturedAt = input.capturedAt;
  }

  const snapshot: GrpcWorkflowExecuteSnapshot = {
    nodeId,
    label: data.label,
    saveAs: data.saveAs?.trim() || undefined,
    execute,
    retry: data.retry ? structuredClone(data.retry) : undefined,
    onError: data.onError ?? 'fail',
    collect: collectConfig,
  };

  return snapshot;
}

/** Deep-clone snapshot for transport attempts — isolates retry mutations from canonical snapshot. */
export function cloneGrpcWorkflowExecuteSnapshot(
  snapshot: GrpcWorkflowExecuteSnapshot,
): GrpcWorkflowExecuteSnapshot {
  return structuredClone(snapshot);
}

/** Compare transport-relevant fields for determinism tests (ignores capturedAt by default). */
export function grpcWorkflowExecuteSnapshotTransportFingerprint(
  snapshot: GrpcWorkflowExecuteSnapshot,
  options?: { includeCapturedAt?: boolean },
): string {
  const payload = {
    nodeId: snapshot.nodeId,
    label: snapshot.label,
    saveAs: snapshot.saveAs,
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
    onError: snapshot.onError,
    collect: snapshot.collect,
  };
  return JSON.stringify(payload);
}

export function resolutionToWorkflowGrpcTarget(
  data: GrpcUnaryNodeData | GrpcServerStreamNodeData,
  context: Pick<GrpcWorkflowSnapshotBuildContext, 'resolveTemplate' | 'profiles' | 'pageDefaults' | 'tlsConfig'>,
) {
  const resolution = resolveGrpcWorkflowConnection(
    data,
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
