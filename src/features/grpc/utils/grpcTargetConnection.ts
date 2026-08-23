/**
 * gRPC Studio — Connect/Disconnect target probe helpers (Phase 1 mockup 01).
 */
import { getGrpcStatus } from '@shared/grpc/grpcApiClient';
import type { GrpcTargetConnectionSession } from '@shared/grpc/contracts';
import type { GrpcTabConnectionResolution } from './resolveGrpcTabConnection';

export const GRPC_DEFAULT_TARGET_PROBE_TIMEOUT_MS = 5_000;

export function resolveGrpcTargetProbeTimeoutMs(timeoutMs: number | undefined): number {
  const tabTimeout = Number.isFinite(timeoutMs) && (timeoutMs ?? 0) > 0
    ? timeoutMs!
    : GRPC_DEFAULT_TARGET_PROBE_TIMEOUT_MS;
  return Math.min(tabTimeout, GRPC_DEFAULT_TARGET_PROBE_TIMEOUT_MS);
}

export function createIdleTargetConnectionSession(): GrpcTargetConnectionSession {
  return { state: 'idle' };
}

export function resetTargetConnectionSession(): GrpcTargetConnectionSession {
  return createIdleTargetConnectionSession();
}

export async function probeGrpcTargetConnection(
  resolution: GrpcTabConnectionResolution,
  timeoutMs = GRPC_DEFAULT_TARGET_PROBE_TIMEOUT_MS,
): Promise<GrpcTargetConnectionSession> {
  if (!resolution.targetValidation.valid) {
    return {
      state: 'error',
      errorMessage: resolution.targetValidation.reason ?? 'Invalid target address.',
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const envelope = await getGrpcStatus({
      address: resolution.target,
      tlsMode: resolution.tlsMode,
      timeoutMs,
    });
    const data = envelope.data;
    if (data?.reachable) {
      return {
        state: 'connected',
        latencyMs: data.latencyMs,
        checkedAt: new Date().toISOString(),
      };
    }
    return {
      state: 'error',
      errorMessage: data?.errorMessage ?? 'Target is unreachable.',
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection probe failed.';
    return {
      state: 'error',
      errorMessage: message,
      checkedAt: new Date().toISOString(),
    };
  }
}
