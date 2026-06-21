import type { AuthConfig } from '../../../../shared/types';

export interface WorkflowHostProfile {
  id: string;
  name: string;
  hostEnvironmentId?: string;
  hostMicroserviceId?: string;
  hostBaseUrl?: string;
}

export interface WorkflowAuthProfile {
  id: string;
  name: string;
  auth: AuthConfig;
}

// ── Service Registry ─────────────────────────────────

/** @deprecated Kept for migration compatibility only. */
export type WorkflowServiceUrlMode = 'direct' | 'multi-env' | 'adhoc';

/** One row in the endpoint matrix: a service's config for a single environment. */
export interface ServiceEndpoint {
  envId: string;           // environment ID, or '__adhoc__' for adhoc testing
  url: string;             // base URL for this env
  enabled: boolean;        // service available in this env?
  authMode: 'inherit' | 'custom'; // inherit from service.defaultAuth or use custom
  auth?: AuthConfig;       // only when authMode === 'custom'
  source: 'manual' | 'microservice'; // how URL was populated
}

export interface WorkflowService {
  id: string;
  name: string;
  /** Endpoint matrix — one entry per environment (+adhoc). */
  endpoints: ServiceEndpoint[];
  /** Fallback auth for endpoints with authMode='inherit'. */
  defaultAuth?: AuthConfig;
  /** Linked microservice — auto-populates URLs from environment config. */
  microserviceId?: string;
  /** UI hint: when true, single URL input fills all env rows. */
  sameUrlForAll?: boolean;
  /** Optional description. */
  notes?: string;

  // ── Legacy fields (kept for migration, not used by new UI) ──
  /** @deprecated Use endpoints instead. */
  urlMode?: WorkflowServiceUrlMode;
  /** @deprecated Use endpoints instead. */
  directUrl?: string;
  /** @deprecated Use endpoints instead. */
  baseUrls?: Record<string, string>;
  /** @deprecated Use endpoints instead. */
  adhocUrl?: string;
  /** @deprecated Use defaultAuth instead. */
  auth?: AuthConfig;
  /** @deprecated Use endpoints[].auth instead. */
  authPerEnv?: Record<string, AuthConfig>;
}

