import type { AuthConfig, Scenario } from './index';

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

// ── Node data types ──────────────────────────────────

export interface HttpNodeData {
  [key: string]: unknown;
  label: string;
  scenario: Scenario;
  sourceType?: 'requests' | 'catalog';
  sourceId?: string;
  /** Binding to a workflow-level service from the Service Registry. */
  serviceId?: string;
  /** @deprecated Use serviceId instead. */
  hostProfileId?: string;
  /** @deprecated Use serviceId instead. */
  authProfileId?: string;
  /**
   * When both are set, Quick Test uses this environment + microservice to resolve `{{baseUrl}}`
   * and path-only URLs for this step only. When omitted or incomplete, the harness bar selection applies.
   */
  hostEnvironmentId?: string;
  hostMicroserviceId?: string;
  /**
   * When set (e.g. request from a URL subcollection), used as `baseUrl` for this step if it cannot be
   * expressed as env + microservice alone.
   */
  hostBaseUrl?: string;
  /**
   * `{{name}}` values for this HTTP step only. Merged with workflow-level defaults and upstream
   * extractions when the step runs; highest priority for this step’s request resolution.
   */
  initialVariables?: Record<string, string>;
}

export interface ConditionNodeData {
  [key: string]: unknown;
  label: string;
  left: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not-contains' | 'regex';
  right: string;
}

export interface DelayNodeData {
  [key: string]: unknown;
  label: string;
  delayMs: number;
  mode: 'fixed' | 'random';
  minMs?: number;
  maxMs?: number;
}

export type WorkflowNodeType = 'http' | 'condition' | 'delay';

export type WorkflowNodeData = HttpNodeData | ConditionNodeData | DelayNodeData;

// ── Workflow graph ───────────────────────────────────

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

// ── Saved workflow ───────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, string>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** Optional schema version used by one-time migrations. */
  schemaVersion?: number;
  /** Centralized service definitions with host + auth (replaces per-node config). */
  services?: WorkflowService[];
  /** @deprecated Use services instead. */
  hostProfiles?: WorkflowHostProfile[];
  /** @deprecated Use services instead. */
  authProfiles?: WorkflowAuthProfile[];
  createdAt: number;
  updatedAt: number;
}

// ── Execution state (for canvas animation) ──────────

export type NodeRunState = 'idle' | 'pending' | 'running' | 'pass' | 'fail' | 'skipped';

export interface NodeRunStatus {
  state: NodeRunState;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
  extracted?: Record<string, string>;
  /** Full formatted detail for the step result modal (response + errors). */
  responseDetail?: string;
}
