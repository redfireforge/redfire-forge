import { validateGrpcTargetAddress } from '@shared/grpc/targetValidation';

/** Legacy env map when Microservice/env selectors are unavailable. */
export function buildLegacyGrpcEnvVarMap(
  resolvedBaseUrl?: string,
  envName?: string,
  svcName?: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  const candidate = resolvedBaseUrl?.trim();
  if (candidate) {
    const isHttpUrl = /^https?:\/\//i.test(candidate);
    if (!isHttpUrl && validateGrpcTargetAddress(candidate).valid) {
      map.grpcHost = candidate;
    }
  }
  if (envName) map.envName = envName;
  if (svcName) map.svcName = svcName;
  return map;
}
