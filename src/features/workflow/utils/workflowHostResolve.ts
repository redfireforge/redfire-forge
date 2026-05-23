import type { AuthConfig, GlobalAuthProfile, Microservice } from '../../../shared/types';
import type { HttpNodeData, WorkflowHostProfile, WorkflowService, ServiceEndpoint } from '../types/workflow';

/** Normalize a base URL: trim whitespace and strip trailing slash. */
export function stripTrailingSlash(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Resolve the base URL for a workflow service, given a selected environment.
 * New endpoint-matrix model: look up the endpoint row for the selected env.
 * Falls back to legacy fields for backward compatibility.
 */
export function resolveServiceBaseUrl(
  service: WorkflowService,
  microservices: Microservice[],
  selectedEnvId?: string,
): string | undefined {
  // New model: endpoint matrix
  if (service.endpoints?.length) {
    let ep: ServiceEndpoint | undefined;
    if (selectedEnvId) {
      ep = service.endpoints.find((e) => e.envId === selectedEnvId && e.enabled);
    }
    // Fallback to "__all__" pseudo-env (same URL for all environments)
    if (!ep) {
      ep = service.endpoints.find((e) => e.envId === '__all__' && e.enabled);
    }
    // Fallback to first enabled endpoint with a URL
    if (!ep) {
      ep = service.endpoints.find((e) => e.enabled && e.url.trim());
    }
    if (ep?.url?.trim()) return stripTrailingSlash(ep.url);
  }

  // Linked microservice: resolve URL from microservice baseUrls
  if (service.microserviceId) {
    const ms = microservices.find((m) => m.id === service.microserviceId);
    if (ms) {
      if (selectedEnvId) {
        const u = ms.baseUrls[selectedEnvId];
        if (u?.trim()) return stripTrailingSlash(u);
      }
      const first = Object.values(ms.baseUrls)[0];
      if (first?.trim()) return stripTrailingSlash(first);
    }
    return undefined;
  }

  // Legacy fallback: urlMode-based
  switch (service.urlMode) {
    case 'direct':
      return service.directUrl?.trim() ? stripTrailingSlash(service.directUrl) : undefined;
    case 'adhoc':
      return service.adhocUrl?.trim() ? stripTrailingSlash(service.adhocUrl) : undefined;
    case 'multi-env': {
      if (selectedEnvId && service.baseUrls?.[selectedEnvId]) {
        return stripTrailingSlash(service.baseUrls[selectedEnvId]);
      }
      const first = Object.values(service.baseUrls ?? {})[0];
      if (first?.trim()) return stripTrailingSlash(first);
      return undefined;
    }
    default:
      return service.directUrl?.trim() ? stripTrailingSlash(service.directUrl) : undefined;
  }
}

/**
 * Per-step Quick Test base: service binding, explicit URL (subcollection), else env + microservice, else harness.
 * Returns undefined to fall back to the harness-injected `baseUrl` / Initial variables.
 */
export function resolveHttpNodeBaseUrl(
  data: HttpNodeData,
  microservices: Microservice[],
  hostProfiles?: WorkflowHostProfile[],
  services?: WorkflowService[],
  selectedEnvId?: string,
): string | undefined {
  const effectiveEnvId = data.envOverride || selectedEnvId;
  // Service Registry binding (new path)
  if (data.serviceId && services?.length) {
    const svc = services.find((s) => s.id === data.serviceId);
    if (svc) {
      return resolveServiceBaseUrl(svc, microservices, effectiveEnvId);
    }
  }

  const explicit = data.hostBaseUrl?.trim();
  if (explicit) return stripTrailingSlash(explicit);
  const envId = data.hostEnvironmentId?.trim();
  const svcId = data.hostMicroserviceId?.trim();
  if (envId && svcId) {
    const svc = microservices.find((m) => m.id === svcId);
    if (!svc) return undefined;
    const u = svc.baseUrls[envId];
    if (!u?.trim()) return undefined;
    return stripTrailingSlash(u);
  }

  if (data.hostProfileId && hostProfiles?.length) {
    const profile = hostProfiles.find((p) => p.id === data.hostProfileId);
    if (!profile) return undefined;
    const pExplicit = profile.hostBaseUrl?.trim();
    if (pExplicit) return stripTrailingSlash(pExplicit);
    const pEnvId = profile.hostEnvironmentId?.trim();
    const pSvcId = profile.hostMicroserviceId?.trim();
    if (!pEnvId || !pSvcId) return undefined;
    const svc = microservices.find((m) => m.id === pSvcId);
    if (!svc) return undefined;
    const u = svc.baseUrls[pEnvId];
    if (!u?.trim()) return undefined;
    return stripTrailingSlash(u);
  }

  return undefined;
}

/**
 * Resolve the auth config from a workflow service for a given HTTP node.
 * New model: checks endpoint row for custom auth, falls back to defaultAuth.
 */
/**
 * Resolve the auth profile for the given environment from the linked microservice.
 * microservice.authProfileIds[envId] → GlobalAuthProfile.auth
 */
function resolveEnvAuth(
  svc: WorkflowService,
  envId: string,
  microservices: Microservice[],
  globalAuthProfiles: GlobalAuthProfile[],
): AuthConfig | undefined {
  if (!svc.microserviceId) return undefined;
  const ms = microservices.find((m) => m.id === svc.microserviceId);
  if (!ms?.authProfileIds) return undefined;
  const profileId = ms.authProfileIds[envId];
  if (!profileId) return undefined;
  const profile = globalAuthProfiles.find((g) => g.id === profileId);
  return profile?.auth;
}

export function resolveServiceAuth(
  data: HttpNodeData,
  services?: WorkflowService[],
  selectedEnvId?: string,
  microservices?: Microservice[],
  globalAuthProfiles?: GlobalAuthProfile[],
) {
  if (!data.serviceId || !services?.length) return undefined;
  const svc = services.find((s) => s.id === data.serviceId);
  if (!svc) return undefined;

  const effectiveEnvId = data.envOverride || selectedEnvId;

  // New model: endpoint matrix
  if (svc.endpoints?.length && effectiveEnvId) {
    const ep = svc.endpoints.find((e) => e.envId === effectiveEnvId && e.enabled)
      ?? svc.endpoints.find((e) => e.envId === '__all__' && e.enabled);
    if (ep && ep.authMode === 'custom' && ep.auth) {
      return ep.auth;
    }
    // "inherit" → resolve from environment (microservice authProfileIds)
    if (microservices?.length && globalAuthProfiles?.length) {
      const envAuth = resolveEnvAuth(svc, effectiveEnvId, microservices, globalAuthProfiles);
      if (envAuth) return envAuth;
    }
  }
  // Fallback: defaultAuth (new) or auth (legacy)
  if (svc.defaultAuth) return svc.defaultAuth;
  // Legacy per-env auth
  if (effectiveEnvId && svc.authPerEnv?.[effectiveEnvId]) {
    return svc.authPerEnv[effectiveEnvId];
  }
  return svc.auth;
}
