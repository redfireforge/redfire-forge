import type { Microservice } from '../types';
import type { HttpNodeData } from '../types/workflow';

/**
 * Per-step Quick Test base: explicit URL (subcollection), else env + microservice, else harness.
 * Returns undefined to fall back to the harness-injected `baseUrl` / Initial variables.
 */
export function resolveHttpNodeBaseUrl(data: HttpNodeData, microservices: Microservice[]): string | undefined {
  const explicit = data.hostBaseUrl?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const envId = data.hostEnvironmentId?.trim();
  const svcId = data.hostMicroserviceId?.trim();
  if (!envId || !svcId) return undefined;
  const svc = microservices.find((m) => m.id === svcId);
  if (!svc) return undefined;
  const u = svc.baseUrls[envId];
  if (!u?.trim()) return undefined;
  return u.replace(/\/$/, '');
}
