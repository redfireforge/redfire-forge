/**
 * Phase 4G — Spring Boot guidance hint rules and copy.
 */
import type { GrpcErrorBody } from '@shared/grpc/contracts';

export const GRPC_STUDIO_HINTS_STORAGE_KEY = 'grpc_studio_hints_dismissed_v1';

export type GrpcStudioHintId = 'spring_health_actuator' | 'spring_permission_denied';

export const GRPC_SPRING_HINT_COPY: Record<GrpcStudioHintId, { title: string; body: string }> = {
  spring_health_actuator: {
    title: 'Spring Boot Actuator health',
    body: 'Spring Boot apps expose Actuator health as named gRPC health services (e.g. `db`, `redis`, `diskSpace`). '
      + 'Leave the service field empty for overall server health, or enter an indicator name to check a specific component.',
  },
  spring_permission_denied: {
    title: 'PERMISSION_DENIED (status 7)',
    body: 'If this is a Spring Boot server, the endpoint may be protected by `@PreAuthorize`. '
      + 'Check the required role or scope and ensure your Bearer token includes it.',
  },
};

export function shouldShowSpringHealthHint(
  serviceFullName: string | undefined,
  methodName: string | undefined,
): boolean {
  return serviceFullName === 'health.v1.Health'
    && (methodName === 'Check' || methodName === 'Watch');
}

export function extractGrpcStatusFromError(error: GrpcErrorBody | undefined): number | undefined {
  if (!error?.details || typeof error.details !== 'object') return undefined;
  const status = (error.details as { grpcStatus?: number }).grpcStatus;
  return typeof status === 'number' ? status : undefined;
}

/** Only status 7 — not UNAUTHENTICATED (16). */
export function shouldShowPermissionDeniedHint(input: {
  unaryStatus?: number;
  streamStatus?: number;
  lastError?: GrpcErrorBody;
  streamError?: GrpcErrorBody;
}): boolean {
  if (input.unaryStatus === 7 || input.streamStatus === 7) return true;
  if (extractGrpcStatusFromError(input.lastError) === 7) return true;
  if (extractGrpcStatusFromError(input.streamError) === 7) return true;
  return false;
}

export function readDismissedGrpcStudioHints(): Set<GrpcStudioHintId> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(GRPC_STUDIO_HINTS_STORAGE_KEY);
    if (!raw?.trim()) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is GrpcStudioHintId => (
      id === 'spring_health_actuator' || id === 'spring_permission_denied'
    )));
  } catch {
    return new Set();
  }
}

export function persistDismissedGrpcStudioHints(ids: Set<GrpcStudioHintId>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(GRPC_STUDIO_HINTS_STORAGE_KEY, JSON.stringify([...ids]));
}
