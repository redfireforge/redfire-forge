/**
 * Phase 6C / 9C — workflow runtime context for gRPC snapshot building.
 */
import type { GrpcTlsConfig } from '../../../shared/grpc/contracts';
import type { GrpcConnectionProfile, GrpcTabConnectionPageDefaults } from '../../grpc/utils/resolveGrpcTabConnection';
import type { VariableContext } from '../engine/variableContext';
import type { GrpcWorkflowSnapshotBuildContext } from './grpcWorkflowSnapshotBuilder';
import {
  buildGrpcStudioInterpolationEnvLayers,
  mergeGrpcInterpolationEnvLayers,
} from '../../../shared/grpc/grpcInterpolationPrecedence';
import {
  createGrpcInterpolationEnvSnapshot,
  type GrpcInterpolationEnvSnapshot,
} from '../../../shared/grpc/grpcInterpolationEnvSnapshot';
import { createGrpcWorkflowInterpolationResolver } from '../../../shared/grpc/grpcWorkflowInterpolationResolver';

const DEFAULT_PAGE_TARGET = 'localhost:50051';

/** Page default target template — keeps {{grpcHost}} so Phase 9D canonical validation applies. */
export function resolveGrpcWorkflowPageDefaultTarget(
  envVarMap: Record<string, string>,
): string {
  if ('grpcHost' in envVarMap) {
    return '{{grpcHost}}';
  }
  return DEFAULT_PAGE_TARGET;
}

export interface GrpcWorkflowSnapshotRuntimeContext extends GrpcWorkflowSnapshotBuildContext {
  interpolationEnv: GrpcInterpolationEnvSnapshot;
}

export interface GrpcWorkflowRuntimeOverrides {
  profiles?: GrpcConnectionProfile[];
  pageDefaults?: GrpcTabConnectionPageDefaults;
  tlsConfig?: GrpcTlsConfig;
  sourceFingerprint?: import('../../../shared/grpc/contracts').GrpcDescriptorSourceFingerprint;
  workspaceDefaults?: Record<string, string>;
  profileVariables?: Record<string, string>;
  tabOverrides?: Record<string, string>;
}

export function createGrpcWorkflowSnapshotBuildContext(
  ctx: VariableContext,
  overrides?: Partial<GrpcWorkflowRuntimeOverrides>,
): GrpcWorkflowSnapshotRuntimeContext {
  const envSnapshot = ctx.snapshot();
  const layers = buildGrpcStudioInterpolationEnvLayers({
    workspaceDefaults: overrides?.workspaceDefaults,
    activeEnvironment: envSnapshot,
    profileVariables: overrides?.profileVariables,
    tabOverrides: overrides?.tabOverrides,
  });
  const interpolationEnv = createGrpcInterpolationEnvSnapshot(layers);
  const mergedFlatEnv = mergeGrpcInterpolationEnvLayers(layers);
  const resolveTemplate = createGrpcWorkflowInterpolationResolver(ctx, mergedFlatEnv);

  return {
    resolveTemplate,
    profiles: overrides?.profiles ?? [],
    pageDefaults: overrides?.pageDefaults ?? {
      target: resolveGrpcWorkflowPageDefaultTarget(mergedFlatEnv),
      tlsMode: 'disabled',
    },
    tlsConfig: overrides?.tlsConfig,
    sourceFingerprint: overrides?.sourceFingerprint,
    interpolationEnv,
    activeEnvironment: { ...envSnapshot },
    variableContext: ctx,
  };
}

export function mergeGrpcWorkflowRuntimeOverrides(
  ctx: VariableContext,
  options?: GrpcWorkflowRuntimeOverrides,
): GrpcWorkflowSnapshotRuntimeContext {
  return createGrpcWorkflowSnapshotBuildContext(ctx, options);
}
