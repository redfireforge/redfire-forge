/**
 * Phase 8C / 9B / 9C — harness runtime context for gRPC snapshot building.
 */
import type { Microservice } from '../types';
import { buildEnvVarMap } from '../utils/envVarUtils';
import type { GrpcTlsConfig } from './contracts';
import type { GrpcConnectionProfile, GrpcTabConnectionPageDefaults } from '../../features/grpc/utils/resolveGrpcTabConnection';
import type { GrpcHarnessSnapshotBuildContext } from './grpcHarnessSnapshotBuilder';
import {
  createGrpcInterpolationTemplateResolver,
} from './grpcInterpolationResolver';
import {
  buildGrpcStudioInterpolationEnvLayers,
  mergeGrpcInterpolationEnvLayers,
} from './grpcInterpolationPrecedence';
import {
  createGrpcInterpolationEnvSnapshot,
  type GrpcInterpolationEnvSnapshot,
} from './grpcInterpolationEnvSnapshot';

const DEFAULT_PAGE_TARGET = 'localhost:50051';

/** Page default target template — keeps {{grpcHost}} so Phase 9D canonical validation applies. */
export function resolveGrpcHarnessPageDefaultTarget(envVarMap: Record<string, string>): string {
  if ('grpcHost' in envVarMap) {
    return '{{grpcHost}}';
  }
  return DEFAULT_PAGE_TARGET;
}

export interface GrpcHarnessRuntimeOverrides {
  profiles?: GrpcConnectionProfile[];
  pageDefaults?: GrpcTabConnectionPageDefaults;
  tlsConfig?: GrpcTlsConfig;
  sourceFingerprint?: import('./contracts').GrpcDescriptorSourceFingerprint;
  workspaceDefaults?: Record<string, string>;
  profileVariables?: Record<string, string>;
  tabOverrides?: Record<string, string>;
}

export interface GrpcHarnessSnapshotRuntimeContext extends GrpcHarnessSnapshotBuildContext {
  interpolationEnv: GrpcInterpolationEnvSnapshot;
}

export function buildGrpcHarnessInterpolationEnvLayers(
  activeEnvironment: Record<string, string>,
  overrides?: Pick<
    GrpcHarnessRuntimeOverrides,
    'workspaceDefaults' | 'profileVariables' | 'tabOverrides'
  >,
) {
  return buildGrpcStudioInterpolationEnvLayers({
    workspaceDefaults: overrides?.workspaceDefaults,
    activeEnvironment,
    profileVariables: overrides?.profileVariables,
    tabOverrides: overrides?.tabOverrides,
  });
}

export function createGrpcHarnessSnapshotBuildContext(
  envVarMap: Record<string, string> = {},
  overrides?: Partial<GrpcHarnessRuntimeOverrides>,
): GrpcHarnessSnapshotRuntimeContext {
  const layers = buildGrpcHarnessInterpolationEnvLayers(envVarMap, overrides);
  const interpolationEnv = createGrpcInterpolationEnvSnapshot(layers);
  const mergedEnv = mergeGrpcInterpolationEnvLayers(layers);
  return {
    resolveTemplate: createGrpcInterpolationTemplateResolver(mergedEnv),
    profiles: overrides?.profiles ?? [],
    pageDefaults: overrides?.pageDefaults ?? {
      target: resolveGrpcHarnessPageDefaultTarget(mergedEnv),
      tlsMode: 'disabled',
    },
    tlsConfig: overrides?.tlsConfig,
    sourceFingerprint: overrides?.sourceFingerprint,
    interpolationEnv,
    activeEnvironment: { ...envVarMap },
  };
}

export function mergeGrpcHarnessRuntimeContext(
  envVarMap: Record<string, string>,
  overrides?: GrpcHarnessRuntimeOverrides,
): GrpcHarnessSnapshotRuntimeContext {
  return createGrpcHarnessSnapshotBuildContext(envVarMap, overrides);
}

/** Build env map for harness template resolution from runner header context. */
export function buildGrpcHarnessEnvFromRunnerContext(
  microservices: Microservice[] | undefined,
  svcId: string | undefined,
  envId: string | undefined,
  envName?: string,
): Record<string, string> {
  if (!microservices?.length || !svcId || !envId) {
    return {};
  }
  const svc = microservices.find((entry) => entry.id === svcId);
  if (!svc) {
    return {};
  }
  return buildEnvVarMap(svc, envId, 'grpc', envName);
}

export interface ResolveGrpcHarnessEnvInput {
  grpcHarnessEnv?: Record<string, string>;
  microservices?: Microservice[];
  svcId?: string;
  envId?: string;
  envName?: string;
}

/** Prefer explicit runner env map; otherwise derive from microservice + env selection. */
export function resolveGrpcHarnessEnv(input: ResolveGrpcHarnessEnvInput = {}): Record<string, string> {
  if (input.grpcHarnessEnv && Object.keys(input.grpcHarnessEnv).length > 0) {
    return input.grpcHarnessEnv;
  }
  return buildGrpcHarnessEnvFromRunnerContext(
    input.microservices,
    input.svcId,
    input.envId,
    input.envName,
  );
}
