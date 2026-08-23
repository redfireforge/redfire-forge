/**
 * Phase 4J-D — isolated grpc.health.v1 health check probe.
 */
import type {
  GrpcAuthConfig,
  GrpcCallResult,
  GrpcCompressionConfig,
  GrpcDescriptor,
  GrpcTlsConfig,
} from '@shared/grpc/contracts';
import { GrpcApiClientError, postGrpcCall } from '@shared/grpc/grpcApiClient';
import { prepareGrpcCallMetadata } from '@shared/grpc/grpcCompressionPolicy';
import { validateGrpcAuthForExecute } from '@shared/grpc/grpcAuthPolicy';
import { validateGrpcTlsConfigContract } from '@shared/grpc/grpcTlsPolicy';
import { releaseCompletedGrpcCall } from '../hooks/grpcStudioSessionHelpers';
import { metadataEntriesFromRecord, validateGrpcMetadataEntries } from '../utils/grpcMetadataEditor';
import { resolutionToGrpcTarget, type GrpcTabConnectionResolution } from './resolveGrpcTabConnection';

export const GRPC_HEALTH_SERVICE_FULL_NAME = 'health.v1.Health';
export const GRPC_HEALTH_CHECK_METHOD = 'Check';
export const GRPC_HEALTH_WATCH_METHOD = 'Watch';

export function findGrpcHealthService(descriptor: GrpcDescriptor | undefined) {
  return descriptor?.services.find(
    (service) => service.fullName === GRPC_HEALTH_SERVICE_FULL_NAME,
  );
}

export function descriptorHasHealthService(descriptor: GrpcDescriptor | undefined): boolean {
  return findGrpcHealthService(descriptor)?.methods.some(
    (method) => method.name === GRPC_HEALTH_CHECK_METHOD,
  ) ?? false;
}

export function descriptorHasHealthWatch(descriptor: GrpcDescriptor | undefined): boolean {
  return findGrpcHealthService(descriptor)?.methods.some(
    (method) => method.name === GRPC_HEALTH_WATCH_METHOD,
  ) ?? false;
}

export interface GrpcHealthProbeParams {
  tabId: string;
  descriptorKey: string;
  resolution: GrpcTabConnectionResolution;
  tlsConfig: GrpcTlsConfig | undefined;
  metadata: Record<string, string>;
  auth: GrpcAuthConfig | undefined;
  compression: GrpcCompressionConfig | undefined;
  timeoutMs: number;
  serviceName: string;
}

export type GrpcHealthProbeResult =
  | { ok: true; result: GrpcCallResult }
  | { ok: false; error: string };

export async function executeGrpcHealthProbe(
  params: GrpcHealthProbeParams,
): Promise<GrpcHealthProbeResult> {
  if (!params.descriptorKey.trim()) {
    return { ok: false, error: 'Reflect services first — descriptor key is required.' };
  }
  if (!params.resolution.targetValidation.valid) {
    return { ok: false, error: params.resolution.targetValidation.reason ?? 'Invalid target address.' };
  }

  const tlsIssues = validateGrpcTlsConfigContract(params.resolution.tlsMode, params.tlsConfig);
  if (tlsIssues.length > 0) {
    return { ok: false, error: tlsIssues[0]?.message ?? 'Invalid TLS configuration.' };
  }

  const authIssues = validateGrpcAuthForExecute(params.auth);
  if (authIssues.length > 0) {
    return {
      ok: false,
      error: authIssues[0]?.message ?? 'Auth configuration is incomplete.',
    };
  }

  const metadataValidation = validateGrpcMetadataEntries(
    metadataEntriesFromRecord(params.metadata),
  );
  if (!metadataValidation.valid) {
    return {
      ok: false,
      error: metadataValidation.message ?? 'Invalid metadata configuration.',
    };
  }

  const requestId = globalThis.crypto?.randomUUID?.() ?? `req-health-${Date.now()}`;
  const target = resolutionToGrpcTarget(params.resolution, params.tlsConfig);

  try {
    const envelope = await postGrpcCall({
      callType: 'unary',
      requestId,
      target,
      service: GRPC_HEALTH_SERVICE_FULL_NAME,
      method: GRPC_HEALTH_CHECK_METHOD,
      body: { service: params.serviceName.trim() },
      metadata: prepareGrpcCallMetadata(params.metadata, params.auth, params.compression),
      auth: params.auth ? structuredClone(params.auth) : undefined,
      timeoutMs: params.timeoutMs,
      descriptorKey: params.descriptorKey,
    }, params.tabId);
    return { ok: true, result: envelope.data };
  } catch (error) {
    if (error instanceof GrpcApiClientError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    };
  } finally {
    releaseCompletedGrpcCall(requestId, params.tabId, { transportMode: 'express' });
  }
}

export function formatGrpcHealthStatusLabel(result: GrpcCallResult): string {
  const status = result.body && typeof result.body.status === 'string'
    ? result.body.status
    : undefined;
  if (status) return status;
  if (result.status === 0) return 'SERVING';
  return result.statusMessage || `gRPC ${result.status}`;
}
