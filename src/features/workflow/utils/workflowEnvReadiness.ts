import type { WorkflowService } from '../types/workflow';

export interface EnvServiceIssue {
  serviceName: string;
  serviceId: string;
  missingUrl: boolean;
  missingAuth: boolean;
}

export interface EnvReadiness {
  envId: string;
  ready: boolean;
  issues: EnvServiceIssue[];
}

/**
 * Check whether every service used in the workflow has a configured (enabled + URL)
 * endpoint for the given environment.
 */
export function checkEnvReadiness(
  envId: string,
  services: WorkflowService[],
): EnvReadiness {
  const issues: EnvServiceIssue[] = [];

  for (const svc of services) {
    if (!svc.endpoints?.length) continue;
    // Check for exact env match first, then fall back to the __all__ pseudo-env
    // which means "same URL for all environments" (mirrors workflowHostResolve logic).
    const ep = svc.endpoints.find((e) => e.envId === envId)
      ?? svc.endpoints.find((e) => e.envId === '__all__');
    const missingUrl = !ep || !ep.enabled || !ep.url.trim();
    if (missingUrl) {
      issues.push({ serviceName: svc.name, serviceId: svc.id, missingUrl: true, missingAuth: false });
    }
  }

  return { envId, ready: issues.length === 0, issues };
}

/**
 * Check readiness for all environments. Returns a map of envId → EnvReadiness.
 */
export function checkAllEnvReadiness(
  envIds: string[],
  services: WorkflowService[],
): Map<string, EnvReadiness> {
  const map = new Map<string, EnvReadiness>();
  for (const envId of envIds) {
    map.set(envId, checkEnvReadiness(envId, services));
  }
  return map;
}
